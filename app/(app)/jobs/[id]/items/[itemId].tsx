import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useJobsStore } from '@/store/jobs';
import { useSyncStore } from '@/store/sync';
import { getDb } from '@/lib/db';
import { drainSyncQueue } from '@/lib/sync';
import { SchemaItem, SubmissionEntry } from '@/lib/api';
import FormField from '@/components/FormField';
import SignatureModal from '@/components/SignatureModal';

type FormValues = Record<string, string | number | null>;
type PhotoMap = Record<string, string[]>;

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function FormSubmissionScreen() {
  const { id: jobId, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const { jobs, markItemSubmitted } = useJobsStore();
  const { isOnline } = useSyncStore();

  const job = jobs.find((j) => j.id === jobId);
  const item = job?.items.find((i) => i.id === itemId);

  // Seed form values from existing submission if any
  const [values, setValues] = useState<FormValues>(() => {
    if (!item?.submission?.data) return {};
    return Object.fromEntries(item.submission.data.map((e) => [e.itemId, e.value]));
  });

  // Local photo URIs keyed by field id ('' = general/no field)
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sigVisible, setSigVisible] = useState(false);
  const [workerSig, setWorkerSig] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!job || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Form not found.</Text>
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
    // Copy to a persistent temp location
    const dest = `${FileSystem.cacheDirectory}${uuid()}.jpg`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });

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

      // Queue the submission
      await db.runAsync(
        'INSERT INTO submissions_queue (id, job_item_id, data, photos, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [queueId, item.id, JSON.stringify(data), '[]', 'pending', now]
      );

      // Queue all photos
      const allPhotos = Object.entries(photos);
      for (const [fieldId, uris] of allPhotos) {
        for (const uri of uris) {
          await db.runAsync(
            'INSERT INTO photos_queue (id, job_item_id, local_uri, field_id, status) VALUES (?, ?, ?, ?, ?)',
            [uuid(), item.id, uri, fieldId || null, 'pending']
          );
        }
      }

      // Optimistically update the jobs store so the UI reflects completion
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

      // Attempt immediate sync if online
      if (isOnline) {
        drainSyncQueue().catch(() => {});
      }

      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to save form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: item.template.name }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {item.submission && (
          <View style={styles.existingBanner}>
            <Text style={styles.existingText}>
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

        {/* Worker Signature */}
        {item.template.requireWorkerSignature && (
          <View style={styles.sigSection}>
            <Text style={styles.sigLabel}>Your Signature</Text>
            {workerSig ? (
              <View style={styles.sigDone}>
                <Text style={styles.sigDoneText}>✓ Signature captured</Text>
                <TouchableOpacity onPress={() => setWorkerSig(null)}>
                  <Text style={styles.sigRedo}>Redo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.sigBtn}
                onPress={() => setSigVisible(true)}
              >
                <Text style={styles.sigBtnText}>Add Signature</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
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
  notFound: { color: '#6B7280', fontSize: 16 },
  existingBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  existingText: { fontSize: 13, color: '#92400E' },
  sigSection: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  sigLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  sigDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sigDoneText: { fontSize: 15, color: '#16A34A', fontWeight: '600' },
  sigRedo: { fontSize: 14, color: '#2563EB' },
  sigBtn: {
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  sigBtnText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
