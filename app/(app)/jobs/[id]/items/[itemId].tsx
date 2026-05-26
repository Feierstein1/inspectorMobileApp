import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { cacheDirectory, copyAsync } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useJobsStore } from '@/store/jobs';
import { useSyncStore } from '@/store/sync';
import { getDb } from '@/lib/db';
import { drainSyncQueue } from '@/lib/sync';
import { SchemaItem, SubmissionEntry } from '@/lib/api';
import FormField from '@/components/FormField';
import SignatureModal from '@/components/SignatureModal';
import { useColors } from '@/store/theme';

type FormValues = Record<string, string | number | null>;
type PhotoMap = Record<string, string[]>;

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function FormSubmissionScreen() {
  const c = useColors();
  const { id: jobId, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const { jobs, markItemSubmitted } = useJobsStore();
  const { isOnline } = useSyncStore();

  const job = jobs.find((j) => j.id === jobId);
  const item = job?.items.find((i) => i.id === itemId);

  const draftKey = `draft_${itemId}`;
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [values, setValues] = useState<FormValues>(() => {
    if (!item?.submission?.data) return {};
    return Object.fromEntries(item.submission.data.map((e) => [e.itemId, e.value]));
  });

  const [photos, setPhotos] = useState<PhotoMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sigVisible, setSigVisible] = useState(false);
  const [workerSig, setWorkerSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Load draft on mount (only if no existing submission)
  useEffect(() => {
    if (item?.submission) {
      setDraftLoaded(true);
      return;
    }
    AsyncStorage.getItem(draftKey).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setValues((prev) => ({ ...parsed, ...prev }));
        } catch {}
      }
      setDraftLoaded(true);
    });
  }, [itemId]);

  // Auto-save draft with 500ms debounce
  useEffect(() => {
    if (!draftLoaded || item?.submission) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(draftKey, JSON.stringify(values)).catch(() => {});
    }, 500);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [values, draftLoaded]);

  if (!job || !item) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.notFound, { color: c.textSecondary }]}>Form not found.</Text>
      </View>
    );
  }

  const schema: SchemaItem[] = item.template.resolvedSchema;

  function setValue(fieldId: string, value: string | number | null) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: '' }));
  }

  async function pickPhoto(fieldId: string) {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const dest = `${cacheDirectory}${uuid()}.jpg`;
    await copyAsync({ from: asset.uri, to: dest });

    setPhotos((prev) => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] ?? []), dest],
    }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: '' }));
  }

  function removePhoto(fieldId: string, uri: string) {
    setPhotos((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] ?? []).filter((u) => u !== uri),
    }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    for (const field of schema) {
      const val = values[field.id];
      const fieldPhotos = photos[field.id] ?? [];

      if (field.required && field.type !== 'photo') {
        if (val === null || val === undefined || val === '') {
          newErrors[field.id] = 'This field is required.';
        }
      }

      if (field.type === 'pass_fail' && val === 'fail' && field.options?.photoRequiredOnFail) {
        if (fieldPhotos.length === 0) {
          newErrors[field.id] = 'A photo is required when result is FAIL.';
        }
      }

      if (field.type === 'photo' && field.required && fieldPhotos.length === 0) {
        newErrors[field.id] = 'At least one photo is required.';
      }

      if (field.type === 'number' && val !== null && val !== '') {
        const n = Number(val);
        if (field.options?.min !== undefined && n < field.options.min) {
          newErrors[field.id] = `Minimum value is ${field.options.min}.`;
        }
        if (field.options?.max !== undefined && n > field.options.max) {
          newErrors[field.id] = `Maximum value is ${field.options.max}.`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      Alert.alert('Incomplete form', 'Please fix the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const db = getDb();
      const queueId = uuid();
      const now = Date.now();

      const data: SubmissionEntry[] = schema.map((field) => ({
        itemId: field.id,
        label: field.label,
        type: field.type,
        value: field.type === 'photo' ? null : (values[field.id] ?? null),
      }));

      await db.runAsync(
        'INSERT INTO submissions_queue (id, job_item_id, data, photos, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [queueId, item.id, JSON.stringify(data), '[]', 'pending', now]
      );

      const allPhotos = Object.entries(photos);
      for (const [fieldId, uris] of allPhotos) {
        for (const uri of uris) {
          await db.runAsync(
            'INSERT INTO photos_queue (id, job_item_id, local_uri, field_id, status) VALUES (?, ?, ?, ?, ?)',
            [uuid(), item.id, uri, fieldId || null, 'pending']
          );
        }
      }

      const allFieldPhotos = Object.values(photos).flat();
      markItemSubmitted(job.id, item.id, {
        id: queueId,
        result: null,
        createdAt: new Date().toISOString(),
        data,
        workerSignatureUrl: workerSig,
        photos: allFieldPhotos.map((uri, i) => ({
          id: `local_${i}`,
          url: uri,
          filename: uri.split('/').pop() ?? 'photo.jpg',
          fieldId: null,
        })),
      });

      // Clear draft after successful submit
      await AsyncStorage.removeItem(draftKey);

      if (isOnline) {
        drainSyncQueue().catch(() => {});
      }

      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: item.template.name }} />
      <ScrollView
        style={[styles.scroll, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
      >
        {item.submission && (
          <View style={[styles.existingBanner, { backgroundColor: c.warningBg }]}>
            <Text style={[styles.existingText, { color: c.warning }]}>
              Previously submitted on{' '}
              {new Date(item.submission.createdAt).toLocaleDateString()}. Submitting again will
              update the record.
            </Text>
          </View>
        )}

        {schema.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={values[field.id] ?? null}
            onChange={(v) => setValue(field.id, v)}
            localPhotos={photos[field.id] ?? []}
            onAddPhoto={() => pickPhoto(field.id)}
            onRemovePhoto={(uri) => removePhoto(field.id, uri)}
            error={errors[field.id]}
          />
        ))}

        {/* Worker signature */}
        {item.template.requireWorkerSignature && (
          <View style={[styles.sigSection, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sigLabel, { color: c.text }]}>Your Signature</Text>
            {workerSig ? (
              <View style={styles.sigDone}>
                <Text style={[styles.sigDoneText, { color: c.success }]}>✓ Signature captured</Text>
                <TouchableOpacity onPress={() => setWorkerSig(null)}>
                  <Text style={[styles.sigRedo, { color: c.primary }]}>Redo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sigBtn, { borderColor: c.primary }]}
                onPress={() => setSigVisible(true)}
              >
                <Text style={[styles.sigBtnText, { color: c.primary }]}>Add Signature</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: c.primary }, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>
              {item.submission ? 'Update Submission' : 'Submit Form'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <SignatureModal
        visible={sigVisible}
        title="Your Signature"
        onSave={(sig) => setWorkerSig(sig)}
        onClose={() => setSigVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16 },
  existingBanner: { borderRadius: 10, padding: 12, marginBottom: 20 },
  existingText: { fontSize: 13 },
  sigSection: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  sigLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  sigDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sigDoneText: { fontSize: 15, fontWeight: '600' },
  sigRedo: { fontSize: 14 },
  sigBtn: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  sigBtnText: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
