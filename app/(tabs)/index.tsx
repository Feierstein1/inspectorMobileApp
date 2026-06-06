import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useJobsStore } from '@/store/jobs';
import { useSyncStore } from '@/store/sync';
import { api, Job } from '@/lib/api';
import { useColors, Colors } from '@/store/theme';

type Period = 'today' | 'week' | 'all';
type StatusFilter = 'all' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All' },
];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

const PAGE_SIZE = 10;

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function isThisWeek(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  const day = n.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(n);
  start.setDate(n.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

export default function JobsListScreen() {
  const c = useColors();
  const { jobs, persistJobs, isRefreshing, setRefreshing } = useJobsStore();
  const { pendingItemIds } = useSyncStore();

  const [period, setPeriod] = useState<Period>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (period === 'today' && !isToday(job.scheduledAt)) return false;
      if (period === 'week' && !isThisWeek(job.scheduledAt)) return false;
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      if (q && !job.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, period, statusFilter, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function handlePeriod(p: Period) {
    setPeriod(p);
    setVisibleCount(PAGE_SIZE);
  }

  function handleStatus(s: StatusFilter) {
    setStatusFilter(s);
    setVisibleCount(PAGE_SIZE);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setVisibleCount(PAGE_SIZE);
  }

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await api.getJobs();
      await persistJobs(fresh);
    } catch {
      // Jobs remain visible from cache; no alert needed — user can try again with another pull
    } finally {
      setRefreshing(false);
    }
  }, []);

  const emptyMessage =
    search
      ? 'No jobs match your search.'
      : period === 'today'
      ? 'No jobs scheduled for today.'
      : period === 'week'
      ? 'No jobs scheduled this week.'
      : 'No jobs assigned to you.';

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Page header */}
      <View style={[styles.header, { backgroundColor: c.bg }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>My Jobs</Text>
      </View>

      {/* Period filter */}
      <View style={[styles.segRow, { backgroundColor: c.surfaceAlt, marginHorizontal: 16, marginBottom: 10 }]}>
        {PERIOD_TABS.map((tab) => {
          const active = period === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.segBtn, active && { backgroundColor: c.surface }]}
              onPress={() => handlePeriod(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segBtnText, { color: active ? c.text : c.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: c.surface, borderColor: c.border, marginHorizontal: 16, marginBottom: 8 }]}>
        <Text style={[styles.searchIcon, { color: c.textMuted }]}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search by name…"
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={[styles.searchClear, { color: c.textMuted }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter (underline tabs) */}
      <View style={[styles.statusRow, { borderBottomColor: c.border, marginHorizontal: 16 }]}>
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.statusTab,
                active && { borderBottomColor: c.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => handleStatus(tab.key)}
            >
              <Text style={[styles.statusTabText, { color: active ? c.primary : c.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Job list */}
      <FlatList
        data={visible}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={c.textMuted}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>{emptyMessage}</Text>
            <Text style={[styles.emptyHint, { color: c.textMuted }]}>Pull down to refresh.</Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              style={[styles.loadMore, { borderColor: c.border }]}
              onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
            >
              <Text style={[styles.loadMoreText, { color: c.primary }]}>
                Load more ({filtered.length - visibleCount} remaining)
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item: job }) => (
          <JobCard job={job} c={c} pendingItemIds={pendingItemIds} />
        )}
      />
    </View>
  );
}

function JobCard({
  job,
  c,
  pendingItemIds,
}: {
  job: Job;
  c: Colors;
  pendingItemIds: string[];
}) {
  const total = job.items.length;
  const done = job.items.filter((i) => i.status === 'COMPLETED').length;
  const todayJob = isToday(job.scheduledAt);
  const needsClientSig =
    job.requireClientSignature &&
    job.status === 'COMPLETED' &&
    !job.clientSignatureUrl;

  const jobBg: Record<string, string> = {
    PENDING: c.warningBg,
    IN_PROGRESS: c.primaryBg,
    COMPLETED: c.successBg,
  };
  const jobColor: Record<string, string> = {
    PENDING: c.warning,
    IN_PROGRESS: c.primary,
    COMPLETED: c.success,
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: todayJob ? c.primary : c.border,
          borderWidth: todayJob ? 2 : 1,
        },
      ]}
    >
      {/* Job header */}
      <TouchableOpacity
        style={[styles.cardHeader, { borderBottomColor: c.borderLight }]}
        onPress={() => router.push(`/(app)/jobs/${job.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.cardName, { color: c.text }]} numberOfLines={2}>
            {job.name}
          </Text>
          <View style={styles.badges}>
            {todayJob && (
              <View style={[styles.todayBadge, { backgroundColor: c.primaryBg }]}>
                <Text style={[styles.todayBadgeText, { color: c.primary }]}>Today</Text>
              </View>
            )}
            {needsClientSig && (
              <View style={[styles.statusBadge, { backgroundColor: c.warningBg }]}>
                <Text style={[styles.statusBadgeText, { color: c.warning }]}>Awaiting Signature</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: jobBg[job.status] ?? c.warningBg }]}>
              <Text style={[styles.statusBadgeText, { color: jobColor[job.status] ?? c.warning }]}>
                {job.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          {job.clientName && (
            <Text style={[styles.metaText, { color: c.textSecondary }]}>{job.clientName}</Text>
          )}
          {job.location && (
            <Text style={[styles.metaText, { color: c.textSecondary }]}>{job.location}</Text>
          )}
          {job.scheduledAt && (
            <Text style={[styles.metaText, { color: c.textSecondary }]}>
              {new Date(job.scheduledAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          )}
        </View>

        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: c.primary, width: `${total > 0 ? (done / total) * 100 : 0}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: c.textSecondary }]}>
            {done}/{total}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Inline items */}
      {job.items.map((item, idx) => {
        const isLast = idx === job.items.length - 1;
        const itemDone = item.status === 'COMPLETED';
        const result = item.submission?.result;
        const isPendingSync = pendingItemIds.includes(item.id);

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemRow,
              !isLast && { borderBottomWidth: 1, borderBottomColor: c.borderLight },
            ]}
            onPress={() => router.push(`/(app)/jobs/${job.id}/items/${item.id}`)}
            activeOpacity={0.6}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.itemDot, { backgroundColor: itemDone ? c.success : c.warning }]} />
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: c.text }]} numberOfLines={1}>
                  {item.template.name}
                </Text>
                {item.tag && (
                  <Text style={[styles.itemTag, { color: c.textMuted }]}>Tag: {item.tag}</Text>
                )}
                {item.submission && (
                  <Text style={[styles.itemMeta, { color: c.textMuted }]}>
                    Submitted {new Date(item.submission.createdAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.itemRight}>
              {isPendingSync && (
                <View style={[styles.itemStatusBadge, { backgroundColor: c.warningBg }]}>
                  <Text style={[styles.itemStatusText, { color: c.warning }]}>PENDING SYNC</Text>
                </View>
              )}
              {!isPendingSync && (
                <View
                  style={[
                    styles.itemStatusBadge,
                    { backgroundColor: itemDone ? c.successBg : c.warningBg },
                  ]}
                >
                  <Text
                    style={[styles.itemStatusText, { color: itemDone ? c.success : c.warning }]}
                  >
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              )}
              {result && (
                <View
                  style={[
                    styles.resultBadge,
                    { backgroundColor: result === 'pass' ? c.successBg : c.dangerBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.resultText,
                      { color: result === 'pass' ? c.success : c.danger },
                    ]}
                  >
                    {result.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  segRow: { flexDirection: 'row', borderRadius: 10, padding: 4, gap: 2 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segBtnText: { fontSize: 13, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 15 },
  searchClear: { fontSize: 14, paddingLeft: 8 },
  statusRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 8 },
  statusTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  statusTabText: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptyHint: { fontSize: 13 },
  loadMore: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: { fontSize: 14, fontWeight: '500' },
  card: { borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardHeader: { padding: 14, borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  badges: { flexDirection: 'row', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' },
  todayBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  todayBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaText: { fontSize: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, width: 28, textAlign: 'right' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  itemLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 10 },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: '500' },
  itemTag: { fontSize: 11, marginTop: 1 },
  itemMeta: { fontSize: 11, marginTop: 1 },
  itemRight: { flexDirection: 'row', gap: 4, alignItems: 'center', flexShrink: 0 },
  itemStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  itemStatusText: { fontSize: 10, fontWeight: '600' },
  resultBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  resultText: { fontSize: 10, fontWeight: '700' },
});
