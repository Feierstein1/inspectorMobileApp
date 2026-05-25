import { useState } from 'react';
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
import { useJobsStore } from '@/store/jobs';
import { api, JobItem } from '@/lib/api';
import SignatureModal from '@/components/SignatureModal';

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: 'Inspection',
  MAINTENANCE: 'Maintenance',
  REPAIR: 'Repair',
  INSTALLATION: 'Installation',
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs } = useJobsStore();
  const job = jobs.find((j) => j.id === id);

  const [sigModalVisible, setSigModalVisible] = useState(false);
  const [sigLoading, setSigLoading] = useState(false);

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Job not found.</Text>
      </View>
    );
  }

  async function handleClientSignature(imageData: string) {
    if (!job) return;
    setSigLoading(true);
    try {
      await api.uploadClientSignature(job.id, imageData);
      Alert.alert('Signature saved', 'The client signature has been recorded.');
    } catch {
      Alert.alert('Error', 'Failed to save signature. Please try again.');
    } finally {
      setSigLoading(false);
    }
  }

  const pendingItems = job.items.filter((i) => i.status === 'PENDING');
  const completedItems = job.items.filter((i) => i.status === 'COMPLETED');

  return (
    <>
      <Stack.Screen options={{ title: job.name }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Job Info Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.typeTag}>{TYPE_LABEL[job.type] ?? job.type}</Text>
            <Text style={[styles.statusTag, job.status === 'COMPLETED' && styles.statusDone]}>
              {job.status.replace('_', ' ')}
            </Text>
          </View>
          {job.clientName && <InfoRow label="Client" value={job.clientName} />}
          {job.location && <InfoRow label="Location" value={job.location} />}
          {job.scheduledAt && (
            <InfoRow
              label="Scheduled"
              value={new Date(job.scheduledAt).toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            />
          )}
          {job.notes && <InfoRow label="Notes" value={job.notes} />}
        </View>

        {/* Client Signature */}
        {job.requireClientSignature && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Client Signature</Text>
            {job.clientSignatureUrl ? (
              <View style={styles.signedRow}>
                <Text style={styles.signedText}>✓ Signed</Text>
                {job.clientReviewedAt && (
                  <Text style={styles.signedDate}>
                    {new Date(job.clientReviewedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sigBtn, sigLoading && styles.btnDisabled]}
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

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View>
            <Text style={styles.listHeader}>To Do</Text>
            {pendingItems.map((item) => (
              <ItemRow key={item.id} item={item} jobId={job.id} />
            ))}
          </View>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <View>
            <Text style={styles.listHeader}>Completed</Text>
            {completedItems.map((item) => (
              <ItemRow key={item.id} item={item} jobId={job.id} />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ItemRow({ item, jobId }: { item: JobItem; jobId: string }) {
  const done = item.status === 'COMPLETED';
  return (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/(app)/jobs/${jobId}/items/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.itemDot, done && styles.itemDotDone]} />
        <View>
          <Text style={styles.itemName}>{item.template.name}</Text>
          {item.tag && <Text style={styles.itemTag}>Tag: {item.tag}</Text>}
        </View>
      </View>
      <Text style={styles.itemChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#6B7280', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeTag: {
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusTag: {
    backgroundColor: '#FEF3C7',
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDone: { backgroundColor: '#DCFCE7', color: '#16A34A' },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoLabel: { width: 90, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 14, color: '#111827' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  signedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signedText: { fontSize: 15, color: '#16A34A', fontWeight: '600' },
  signedDate: { fontSize: 13, color: '#6B7280' },
  sigBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  sigBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  listHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D97706' },
  itemDotDone: { backgroundColor: '#16A34A' },
  itemName: { fontSize: 15, fontWeight: '500', color: '#111827' },
  itemTag: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  itemChevron: { fontSize: 22, color: '#9CA3AF' },
});
