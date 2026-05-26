import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useJobsStore } from '@/store/jobs';
import { useColors } from '@/store/theme';
import { Job } from '@/lib/api';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const PANEL_LIMIT = 5;

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isTodayCell(year: number, month: number, day: number): boolean {
  const n = new Date();
  return n.getFullYear() === year && n.getMonth() + 1 === month && n.getDate() === day;
}

export default function CalendarScreen() {
  const c = useColors();
  const { jobs } = useJobsStore();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (!job.scheduledAt) continue;
      const key = job.scheduledAt.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(job);
    }
    return map;
  }, [jobs]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedKey(null);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedKey(null);
  }

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const leadingBlanks = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const selectedJobs = selectedKey ? (byDay[selectedKey] ?? []) : [];
  const selectedLabel = selectedKey
    ? new Date(selectedKey + 'T12:00:00').toLocaleDateString([], {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : '';

  const cellSize = Math.floor((Dimensions.get('window').width - 32) / 7);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: c.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Page header */}
      <View style={[styles.pageHeader, { backgroundColor: c.bg }]}>
        <Text style={[styles.pageTitle, { color: c.text }]}>Calendar</Text>
      </View>

      {/* Month navigation */}
      <View style={[styles.monthNav, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
          <Text style={[styles.navArrow, { color: c.textSecondary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: c.text }]}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
          <Text style={[styles.navArrow, { color: c.textSecondary }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dayHeaders}>
        {DAY_HEADERS.map((d) => (
          <View key={d} style={{ width: cellSize, alignItems: 'center' }}>
            <Text style={[styles.dayHeaderText, { color: c.textMuted }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={[styles.grid, { backgroundColor: c.border }]}>
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View
            key={`blank-${i}`}
            style={[styles.cell, { width: cellSize, height: cellSize + 14, backgroundColor: c.surface }]}
          />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = toDateKey(year, month, day);
          const dayJobs = byDay[key] ?? [];
          const count = dayJobs.length;
          const allItems = dayJobs.flatMap((j) => j.items);
          const completedCount = allItems.filter((it) => it.status === 'COMPLETED').length;
          const pendingCount = allItems.length - completedCount;
          const todayCell = isTodayCell(year, month, day);
          const selected = selectedKey === key;

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize + 14,
                  backgroundColor: selected ? c.primaryBg : c.surface,
                },
              ]}
              onPress={() => count > 0 && setSelectedKey(selected ? null : key)}
              activeOpacity={count > 0 ? 0.7 : 1}
            >
              <View
                style={[
                  styles.dayCircle,
                  todayCell && { backgroundColor: c.primary },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    { color: todayCell ? '#fff' : c.text },
                  ]}
                >
                  {day}
                </Text>
              </View>
              {count > 0 && (
                <View style={styles.dotRow}>
                  {completedCount > 0 && (
                    <View style={[styles.countDot, { backgroundColor: c.successBg }]}>
                      <Text style={[styles.countDotText, { color: c.success }]}>
                        {completedCount}
                      </Text>
                    </View>
                  )}
                  {pendingCount > 0 && (
                    <View style={[styles.countDot, { backgroundColor: c.warningBg }]}>
                      <Text style={[styles.countDotText, { color: c.warning }]}>
                        {pendingCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day panel */}
      {selectedKey ? (
        <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.panelHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.panelDate, { color: c.text }]}>{selectedLabel}</Text>
            <Text style={[styles.panelCount, { color: c.textSecondary }]}>
              {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {selectedJobs.slice(0, PANEL_LIMIT).map((job: Job) => {
            const done = job.items.filter((i) => i.status === 'COMPLETED').length;
            const statusBg =
              job.status === 'COMPLETED' ? c.successBg :
              job.status === 'IN_PROGRESS' ? c.primaryBg : c.warningBg;
            const statusColor =
              job.status === 'COMPLETED' ? c.success :
              job.status === 'IN_PROGRESS' ? c.primary : c.warning;

            return (
              <TouchableOpacity
                key={job.id}
                style={[styles.panelJob, { borderBottomColor: c.borderLight }]}
                onPress={() => router.push(`/(app)/jobs/${job.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.panelJobLeft}>
                  <Text style={[styles.panelJobName, { color: c.text }]} numberOfLines={1}>
                    {job.name}
                  </Text>
                  {job.clientName && (
                    <Text style={[styles.panelJobMeta, { color: c.textMuted }]}>
                      {job.clientName}
                    </Text>
                  )}
                  <Text style={[styles.panelJobMeta, { color: c.textMuted }]}>
                    {done}/{job.items.length} done
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                  <Text style={[styles.statusPillText, { color: statusColor }]}>
                    {job.status.replace('_', ' ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {selectedJobs.length > PANEL_LIMIT && (
            <View style={[styles.panelMore, { borderTopColor: c.border }]}>
              <Text style={[styles.panelMoreText, { color: c.textMuted }]}>
                +{selectedJobs.length - PANEL_LIMIT} more jobs
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: c.textMuted }]}>
            Tap a day with jobs to view your assignments
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  pageTitle: { fontSize: 28, fontWeight: '700' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  navBtn: { padding: 6 },
  navArrow: { fontSize: 26, lineHeight: 28 },
  monthTitle: { fontSize: 16, fontWeight: '600' },
  dayHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  dayHeaderText: { fontSize: 11, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cell: { alignItems: 'center', paddingTop: 5, paddingBottom: 3 },
  dayCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dayNumber: { fontSize: 11, fontWeight: '500' },
  dotRow: { flexDirection: 'row', gap: 2 },
  countDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDotText: { fontSize: 9, fontWeight: '700' },
  panel: { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  panelHeader: { padding: 14, borderBottomWidth: 1 },
  panelDate: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  panelCount: { fontSize: 12 },
  panelJob: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  panelJobLeft: { flex: 1, marginRight: 10 },
  panelJobName: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  panelJobMeta: { fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  panelMore: { padding: 12, borderTopWidth: 1, alignItems: 'center' },
  panelMoreText: { fontSize: 12 },
  hint: { alignItems: 'center', paddingTop: 20 },
  hintText: { fontSize: 13 },
});
