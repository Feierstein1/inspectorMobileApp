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
  Image,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { cacheDirectory, copyAsync } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useJobsStore } from '@/store/jobs';
import { useSyncStore } from '@/store/sync';
import { useAuthStore } from '@/store/auth';
import { getDb } from '@/lib/db';
import { drainSyncQueue } from '@/lib/sync';
import { SchemaItem, Submission, SubmissionEntry } from '@/lib/api';
import FormField from '@/components/FormField';
import SignatureModal from '@/components/SignatureModal';
import { useColors, Colors } from '@/store/theme';

type FormValues = Record<string, string | number | null>;
type PhotoMap = Record<string, string[]>;

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function FormSubmissionScreen() {
  const c = useColors();
  const { id: jobId, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const { jobs, markItemSubmitted } = useJobsStore();
  const { user } = useAuthStore();
  const canEdit = user?.canEditSubmissions ?? false;
  const { isOnline } = useSyncStore();

  const job = jobs.find((j) => j.id === jobId);
  const item = job?.items.find((i) => i.id === itemId);

  const draftKey = `draft_${itemId}`;
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editMode, setEditMode] = useState(false);
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
  const isViewMode = !!item.submission && !editMode;

  function setValue(fieldId: string, value: string | number | null) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: '' }));
  }

  async function pickPhoto(fieldId: string) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please allow camera access in your device settings to add photos.'
      );
      return;
    }

    try {
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
    } catch {
      Alert.alert('Photo Error', 'Failed to capture or save the photo. Please try again.');
    }
  }

  function removePhoto(fieldId: string, uri: string) {
    setPhotos((prev) => ({
      ...prev,
      [fieldId]: (prev[fieldId] ?? []).filter((u) => u !== uri),
    }));
  }

  function validateFields(): boolean {
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
        if (isNaN(n)) {
          newErrors[field.id] = 'Please enter a valid number.';
        } else {
          if (field.options?.min !== undefined && n < field.options.min) {
            newErrors[field.id] = `Minimum value is ${field.options.min}.`;
          }
          if (field.options?.max !== undefined && n > field.options.max) {
            newErrors[field.id] = `Maximum value is ${field.options.max}.`;
          }
        }
      }

      if (
        field.type === 'text' &&
        field.options?.maxLength !== undefined &&
        typeof val === 'string' &&
        val.length > field.options.maxLength
      ) {
        newErrors[field.id] =
          `Maximum ${field.options.maxLength} characters allowed (currently ${val.length}).`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    // Check signature first (not part of the schema field loop)
    if (item!.template.requireWorkerSignature && !workerSig) {
      Alert.alert('Signature Required', 'Please add your signature before submitting.');
      return;
    }

    // Server limit: ~2M encoded chars (~1.5MB raw). Signature canvases are almost always
    // well under this, but guard anyway so the user gets a clear message instead of a 4xx.
    if (workerSig && workerSig.length > 2_000_000) {
      Alert.alert(
        'Signature Too Large',
        'Your signature image exceeds the maximum size. Please redo it with simpler strokes.'
      );
      return;
    }

    if (!validateFields()) {
      Alert.alert('Incomplete Form', 'Please fix the highlighted fields before submitting.');
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

      // Single transaction: all three queues are inserted atomically.
      // If any INSERT fails, none of them commit — no orphaned partial state.
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'INSERT INTO submissions_queue (id, job_item_id, data, photos, status, created_at, is_update) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [queueId, item!.id, JSON.stringify(data), '[]', 'pending', now, editMode && !!item!.submission ? 1 : 0]
        );

        for (const [fieldId, uris] of Object.entries(photos)) {
          for (const uri of uris) {
            await db.runAsync(
              'INSERT INTO photos_queue (id, job_item_id, local_uri, field_id, status) VALUES (?, ?, ?, ?, ?)',
              [uuid(), item!.id, uri, fieldId || null, 'pending']
            );
          }
        }

        // Queue signature upload. submission_id is NULL here — drainSyncQueue fills it in
        // once the submission is confirmed on the server, enforcing the required order.
        if (workerSig) {
          await db.runAsync(
            'INSERT INTO worker_signatures_queue (id, job_item_id, image_data, status) VALUES (?, ?, ?, ?)',
            [uuid(), item!.id, workerSig, 'pending']
          );
        }
      });

      // Preserve fieldId per photo so the view mode can group them correctly
      const photosWithField = Object.entries(photos).flatMap(([fieldId, uris]) =>
        uris.map((uri, i) => ({ fieldId, uri, i }))
      );

      markItemSubmitted(job!.id, item!.id, {
        id: queueId,
        result: null,
        createdAt: new Date().toISOString(),
        data,
        workerSignatureUrl: workerSig,
        photos: photosWithField.map(({ fieldId, uri }, i) => ({
          id: `local_${i}`,
          url: uri,
          filename: uri.split('/').pop() ?? 'photo.jpg',
          fieldId,
        })),
      });

      await AsyncStorage.removeItem(draftKey).catch(() => {});

      if (isOnline) {
        drainSyncQueue().catch(() => {});
      }

      router.back();
    } catch {
      Alert.alert(
        'Save Failed',
        'Could not save your form. Your draft has been preserved — please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: item.template.name }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: c.bg }]}
          contentContainerStyle={styles.content}
        >
          {isViewMode ? (
            <SubmissionViewMode
              schema={schema}
              submission={item.submission!}
              canEdit={canEdit}
              onEdit={() => {
                setValues(
                  Object.fromEntries(item.submission!.data.map((e) => [e.itemId, e.value]))
                );
                setEditMode(true);
              }}
              c={c}
            />
          ) : (
            <>
              {item.submission && (
                <View style={[styles.existingBanner, { backgroundColor: c.warningBg }]}>
                  <Text style={[styles.existingText, { color: c.warning }]}>
                    Previously submitted on{' '}
                    {new Date(item.submission.createdAt).toLocaleDateString()}. Submitting again
                    will update the record.
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

              {item.template.requireWorkerSignature && (
                <View
                  style={[styles.sigSection, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <Text style={[styles.sigLabel, { color: c.text }]}>Your Signature</Text>
                  {workerSig ? (
                    <View style={styles.sigDone}>
                      <Text style={[styles.sigDoneText, { color: c.success }]}>
                        ✓ Signature captured
                      </Text>
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
                style={[
                  styles.submitBtn,
                  { backgroundColor: c.primary },
                  submitting && styles.btnDisabled,
                ]}
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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SignatureModal
        visible={sigVisible}
        title="Your Signature"
        onSave={(sig) => setWorkerSig(sig)}
        onClose={() => setSigVisible(false)}
      />
    </>
  );
}

// ── Read-only submission view ──────────────────────────────────────────────

function SubmissionViewMode({
  schema,
  submission,
  canEdit,
  onEdit,
  c,
}: {
  schema: SchemaItem[];
  submission: Submission;
  canEdit: boolean;
  onEdit: () => void;
  c: Colors;
}) {
  const valueMap = Object.fromEntries(submission.data.map((e) => [e.itemId, e.value]));

  // Photos with a null fieldId are pre-sync local photos; show them on the first photo field
  const firstPhotoFieldId = schema.find((f) => f.type === 'photo')?.id ?? null;
  const unassignedPhotos = submission.photos.filter((p) => p.fieldId === null);

  return (
    <>
      <View style={[viewStyles.header, { backgroundColor: c.successBg }]}>
        <Text style={[viewStyles.headerText, { color: c.success }]}>
          Submitted {new Date(submission.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {schema.map((field) => {
        const value = valueMap[field.id];
        const fieldPhotos =
          field.type === 'photo'
            ? [
                ...submission.photos.filter((p) => p.fieldId === field.id),
                // Pre-sync fallback: unassigned photos show on the first photo field only
                ...(field.id === firstPhotoFieldId ? unassignedPhotos : []),
              ]
            : [];

        return (
          <View
            key={field.id}
            style={[viewStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[viewStyles.label, { color: c.textSecondary }]}>{field.label}</Text>

            {field.type === 'pass_fail' ? (
              <View
                style={[
                  viewStyles.badge,
                  { backgroundColor: value === 'pass' ? '#16A34A' : value === 'fail' ? '#DC2626' : c.border },
                ]}
              >
                <Text style={viewStyles.badgeText}>
                  {value === 'pass' ? 'PASS' : value === 'fail' ? 'FAIL' : '—'}
                </Text>
              </View>
            ) : field.type === 'photo' ? (
              fieldPhotos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={viewStyles.photoRow}
                >
                  {fieldPhotos.map((p) => (
                    <Image key={p.id} source={{ uri: p.url }} style={viewStyles.photoThumb} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={[viewStyles.empty, { color: c.textMuted }]}>No photos</Text>
              )
            ) : (
              <Text style={[viewStyles.value, { color: c.text }]}>
                {value !== null && value !== undefined && value !== '' ? String(value) : '—'}
              </Text>
            )}
          </View>
        );
      })}

      {canEdit ? (
        <TouchableOpacity
          style={[viewStyles.editBtn, { borderColor: c.primary }]}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Text style={[viewStyles.editBtnText, { color: c.primary }]}>Edit Submission</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[viewStyles.noEditText, { color: c.textMuted }]}>
          You do not have permission to edit this submission.
        </Text>
      )}
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

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

const viewStyles = StyleSheet.create({
  header: { borderRadius: 10, padding: 12, marginBottom: 16 },
  headerText: { fontSize: 13, fontWeight: '600' },
  card: { marginBottom: 12, borderRadius: 12, padding: 14, borderWidth: 1 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: { fontSize: 16 },
  empty: { fontSize: 14, fontStyle: 'italic' },
  badge: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  photoRow: { flexDirection: 'row' },
  photoThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  editBtn: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  editBtnText: { fontSize: 16, fontWeight: '600' },
  noEditText: { fontSize: 13, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
