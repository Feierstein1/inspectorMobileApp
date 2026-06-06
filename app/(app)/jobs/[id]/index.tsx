import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useJobsStore } from '@/store/jobs';
import { api, JobItem } from '@/lib/api';
import SignatureModal from '@/components/SignatureModal';
import { useColors, Colors } from '@/store/theme';

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: 'Inspection',
  MAINTENANCE: 'Maintenance',
  REPAIR: 'Repair',
  INSTALLATION: 'Installation',
};

export default function JobDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs, persistJobs, markClientSigned } = useJobsStore();
  const job = jobs.find((j) => j.id === id);

  const [sigModalVisible, setSigModalVisible] = useState(false);
  const [sigLoading, setSigLoading] = useState(false);
  const [localSig, setLocalSig] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (!job) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.notFound, { color: c.textSecondary }]}>Job not found.</Text>
      </View>
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const fresh = await api.getJobs();
      await persistJobs(fresh);
    } catch {}
    setRefreshing(false);
  }

  async function handleClientSignature(imageData: string) {
    if (!job) return;
    setLocalSig(imageData);
    setSigLoading(true);
    try {
      const result = await api.uploadClientSignature(job.id, imageData);
      markClientSigned(job.id, result.url);
    } catch {
      Alert.alert('Error', 'Failed to save signature. Please try again.');
      setLocalSig(null);
    } finally {
      setSigLoading(false);
    }
  }

  const pendingItems = job.items.filter((i) => i.status === 'PENDING');
  const completedItems = job.items.filter((i) => i.status === 'COMPLETED');

  const jobTypeBg = c.primaryBg;
  const jobTypeColor = c.primary;
  const jobStatusBg = job.status === 'COMPLETED' ? c.successBg : job.status === 'IN_PROGRESS' ? c.primaryBg : c.warningBg;
  const jobStatusColor = job.status === 'COMPLETED' ? c.success : job.status === 'IN_PROGRESS' ? c.primary : c.warning;

  return (
    <>
      <Stack.Screen options={{ title: job.name }} />
      <ScrollView
        style={[styles.scroll, { backgroundColor: c.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.textMuted} />
        }
      >
        {/* Job info card */}
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: jobTypeBg }]}>
              <Text style={[styles.tagText, { color: jobTypeColor }]}>
                {TYPE_LABEL[job.type] ?? job.type}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: jobStatusBg }]}>
              <Text style={[styles.tagText, { color: jobStatusColor }]}>
                {job.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {job.clientName && <InfoRow label="Client" value={job.clientName} c={c} />}
          {job.location && <InfoRow label="Location" value={job.location} c={c} />}
          {job.scheduledAt && (
            <InfoRow
              label="Scheduled"
              value={new Date(job.scheduledAt).toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              c={c}
            />
          )}
          {job.notes && <InfoRow label="Notes" value={job.notes} c={c} />}
        </View>

        {/* Client signature — only surfaced once all items are COMPLETED */}
        {job.requireClientSignature && job.status === 'COMPLETED' && (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Client Signature</Text>

            {localSig || job.clientSignatureUrl ? (
              <>
                <Image
                  source={{ uri: localSig ?? job.clientSignatureUrl! }}
                  style={styles.sigPreview}
                  resizeMode="contain"
                />
                <View style={styles.sigCapturedRow}>
                  <View style={styles.sigCapturedLeft}>
                    {sigLoading ? (
                      <ActivityIndicator size="small" color={c.primary} />
                    ) : (
                      <Text style={[styles.signedText, { color: c.success }]}>✓ Signature captured</Text>
                    )}
                    {job.clientReviewedAt && (
                      <Text style={[styles.signedDate, { color: c.textSecondary }]}>
                        {new Date(job.clientReviewedAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setSigModalVisible(true)}
                    disabled={sigLoading}
                  >
                    <Text style={[styles.redoText, { color: c.primary }]}>Redo</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.sigBtn, { backgroundColor: c.primary }, sigLoading && styles.btnDisabled]}
                onPress={() => setSigModalVisible(true)}
                disabled={sigLoading}
              >
                {sigLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sigBtnText}>Capture Client Signature</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pending items */}
        {pendingItems.length > 0 && (
          <View>
            <Text style={[styles.listHeader, { color: c.textMuted }]}>To Do</Text>
            {pendingItems.map((item) => (
              <ItemRow key={item.id} item={item} jobId={job.id} c={c} />
            ))}
          </View>
        )}

        {/* Completed items */}
        {completedItems.length > 0 && (
          <View>
            <Text style={[styles.listHeader, { color: c.textMuted }]}>Completed</Text>
            {completedItems.map((item) => (
              <ItemRow key={item.id} item={item} jobId={job.id} c={c} />
            ))}
          </View>
        )}
      </ScrollView>

      <SignatureModal
        visible={sigModalVisible}
        title="Client Signature"
        onSave={handleClientSignature}
        onClose={() => setSigModalVisible(false)}
      />
    </>
  );
}

function InfoRow({ label, value, c }: { label: string; value: string; c: Colors }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: c.borderLight }]}>
      <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

function ItemRow({ item, jobId, c }: { item: JobItem; jobId: string; c: Colors }) {
  const done = item.status === 'COMPLETED';
  return (
    <TouchableOpacity
      style={[styles.itemCard, { backgroundColor: c.surface, borderColor: c.border }]}
      onPress={() => router.push(`/(app)/jobs/${jobId}/items/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.itemDot, { backgroundColor: done ? c.success : c.warning }]} />
        <View>
          <Text style={[styles.itemName, { color: c.text }]}>{item.template.name}</Text>
          {item.tag && <Text style={[styles.itemTag, { color: c.textSecondary }]}>Tag: {item.tag}</Text>}
        </View>
      </View>
      <Text style={[styles.itemChevron, { color: c.textMuted }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 16 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tagText: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1 },
  infoLabel: { width: 90, fontSize: 14, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  signedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signedText: { fontSize: 15, fontWeight: '600' },
  signedDate: { fontSize: 13, marginTop: 2 },
  sigPreview: {
    width: '100%',
    height: 130,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sigCapturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sigCapturedLeft: { flex: 1 },
  redoText: { fontSize: 15, fontWeight: '600', paddingLeft: 12 },
  sigBtn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  sigBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  listHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemDot: { width: 12, height: 12, borderRadius: 6 },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemTag: { fontSize: 13, marginTop: 2 },
  itemChevron: { fontSize: 22 },
});
