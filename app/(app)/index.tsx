import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useJobsStore } from '@/store/jobs';
import { useAuthStore } from '@/store/auth';
import { api, Job } from '@/lib/api';

const STATUS_ORDER = ['IN_PROGRESS', 'PENDING', 'COMPLETED'];
const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  PENDING: 'Pending',
  COMPLETED: 'Completed',
};
const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: '#2563EB',
  PENDING: '#D97706',
  COMPLETED: '#16A34A',
};

export default function JobsListScreen() {
  const { jobs, loadJobsFromDb, persistJobs, isRefreshing, setRefreshing } = useJobsStore();
  const { clearAuth } = useAuthStore();

  useEffect(() => {
    loadJobsFromDb();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await api.getJobs();
      await persistJobs(fresh);
    } catch {}
    setRefreshing(false);
  }, []);

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    data: jobs.filter((j) => j.status === status),
  })).filter((g) => g.data.length > 0);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        style={styles.list}
        data={grouped}
        keyExtractor={(g) => g.status}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No jobs assigned to you.</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Jobs</Text>
            <TouchableOpacity onPress={clearAuth}>
              <Text style={styles.logout}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: group }) => (
          <View>
            <View style={styles.sectionHeader}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[group.status] }]} />
              <Text style={styles.sectionTitle}>{STATUS_LABEL[group.status]}</Text>
            </View>
            {group.data.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </View>
        )}
      />
    </>
  );
}

function JobCard({ job }: { job: Job }) {
  const total = job.items.length;
  const done = job.items.filter((i) => i.status === 'COMPLETED').length;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/jobs/${job.id}`)}
      activeOpacity={0.7}
    >
      <Text style={styles.jobName}>{job.name}</Text>
      {job.clientName && <Text style={styles.meta}>{job.clientName}</Text>}
      {job.location && <Text style={styles.meta}>{job.location}</Text>}
      {job.scheduledAt && (
        <Text style={styles.meta}>{new Date(job.scheduledAt).toLocaleDateString()}</Text>
      )}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${total > 0 ? (done / total) * 100 : 0}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {done}/{total}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#111827' },
  logout: { color: '#DC2626', fontSize: 15 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  jobName: { fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 4 },
  meta: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
  progressText: { fontSize: 13, color: '#6B7280', fontWeight: '500', width: 32, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#374151', fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { color: '#9CA3AF', fontSize: 14 },
});
