import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useSyncStore } from '@/store/sync';

export default function SyncStatusBar() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    forbiddenCount,
    syncProgress,
    lastSyncError,
    setLastSyncError,
  } = useSyncStore();

  // ── Active sync — show progress label + bar ──────────────────────────────
  if (isSyncing) {
    const label = syncProgress?.label ?? 'Syncing your data…';
    const pct =
      syncProgress && syncProgress.total > 0
        ? Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))
        : null;

    return (
      <View style={{ backgroundColor: '#1D4ED8' }}>
        <View style={styles.bar}>
          <ActivityIndicator size="small" color="#93C5FD" style={styles.icon} />
          <Text style={[styles.message, { color: '#EFF6FF' }]} numberOfLines={1}>
            {label}
          </Text>
          {pct !== null && (
            <Text style={styles.pctLabel}>{pct}%</Text>
          )}
        </View>
        {pct !== null && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        )}
      </View>
    );
  }

  // ── Post-sync error — dismissible ────────────────────────────────────────
  if (lastSyncError) {
    return (
      <TouchableOpacity
        style={[styles.bar, { backgroundColor: '#7F1D1D' }]}
        onPress={() => setLastSyncError(null)}
        activeOpacity={0.8}
      >
        <View style={[styles.dot, { backgroundColor: '#FCA5A5' }]} />
        <Text style={[styles.message, { color: '#FEE2E2' }]} numberOfLines={2}>
          {lastSyncError} · Tap to dismiss
        </Text>
      </TouchableOpacity>
    );
  }

  // ── Offline ───────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <View style={[styles.bar, { backgroundColor: '#991B1B' }]}>
        <View style={[styles.dot, { backgroundColor: '#FCA5A5' }]} />
        <Text style={[styles.message, { color: '#FEE2E2' }]} numberOfLines={2}>
          {pendingCount > 0
            ? `Offline · ${pendingCount} submission${pendingCount !== 1 ? 's' : ''} queued for sync`
            : 'Offline · changes will sync when reconnected'}
        </Text>
      </View>
    );
  }

  // ── Failed submissions ────────────────────────────────────────────────────
  if (failedCount > 0) {
    return (
      <View style={[styles.bar, { backgroundColor: '#7F1D1D' }]}>
        <View style={[styles.dot, { backgroundColor: '#FCA5A5' }]} />
        <Text style={[styles.message, { color: '#FEE2E2' }]} numberOfLines={2}>
          {`${failedCount} submission${failedCount !== 1 ? 's' : ''} failed to sync · Open Settings → Sync Now to retry`}
        </Text>
      </View>
    );
  }

  // ── Pending uploads ───────────────────────────────────────────────────────
  if (pendingCount > 0) {
    return (
      <View style={[styles.bar, { backgroundColor: '#78350F' }]}>
        <View style={[styles.dot, { backgroundColor: '#FCD34D' }]} />
        <Text style={[styles.message, { color: '#FEF3C7' }]} numberOfLines={1}>
          {`${pendingCount} submission${pendingCount !== 1 ? 's' : ''} pending upload`}
        </Text>
      </View>
    );
  }

  // ── Forbidden edits ───────────────────────────────────────────────────────
  if (forbiddenCount > 0) {
    return (
      <View style={[styles.bar, { backgroundColor: '#78350F' }]}>
        <View style={[styles.dot, { backgroundColor: '#FCD34D' }]} />
        <Text style={[styles.message, { color: '#FEF3C7' }]} numberOfLines={1}>
          {`${forbiddenCount} edit${forbiddenCount !== 1 ? 's' : ''} blocked · Open Settings to clear`}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  icon: { flexShrink: 0 },
  message: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  pctLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#93C5FD',
  },
});
