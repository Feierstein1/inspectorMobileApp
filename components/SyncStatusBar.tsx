import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useSyncStore } from '@/store/sync';

type StatusConfig = {
  bg: string;
  textColor: string;
  dotColor: string;
  message: string;
  spinner?: boolean;
};

function getConfig(
  isOnline: boolean,
  isSyncing: boolean,
  pendingCount: number,
  failedCount: number,
  forbiddenCount: number
): StatusConfig | null {
  if (!isOnline) {
    return {
      bg: '#991B1B',
      textColor: '#FEE2E2',
      dotColor: '#FCA5A5',
      message:
        pendingCount > 0
          ? `Offline · ${pendingCount} submission${pendingCount !== 1 ? 's' : ''} queued for sync`
          : 'Offline · working locally, changes will sync when reconnected',
    };
  }
  if (isSyncing) {
    return {
      bg: '#1D4ED8',
      textColor: '#EFF6FF',
      dotColor: '#93C5FD',
      message: 'Syncing your data…',
      spinner: true,
    };
  }
  if (failedCount > 0) {
    return {
      bg: '#7F1D1D',
      textColor: '#FEE2E2',
      dotColor: '#FCA5A5',
      message: `${failedCount} submission${failedCount !== 1 ? 's' : ''} failed to sync · Open Settings → Sync Now to retry`,
    };
  }
  if (pendingCount > 0) {
    return {
      bg: '#78350F',
      textColor: '#FEF3C7',
      dotColor: '#FCD34D',
      message: `${pendingCount} submission${pendingCount !== 1 ? 's' : ''} pending upload`,
    };
  }
  if (forbiddenCount > 0) {
    return {
      bg: '#78350F',
      textColor: '#FEF3C7',
      dotColor: '#FCD34D',
      message: `${forbiddenCount} edit${forbiddenCount !== 1 ? 's' : ''} blocked · Open Settings to clear`,
    };
  }
  return null; // All good — no banner needed
}

export default function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount, failedCount, forbiddenCount } = useSyncStore();
  const config = getConfig(isOnline, isSyncing, pendingCount, failedCount, forbiddenCount);

  if (!config) return null;

  return (
    <View style={[styles.bar, { backgroundColor: config.bg }]}>
      {config.spinner ? (
        <ActivityIndicator size="small" color={config.dotColor} style={styles.icon} />
      ) : (
        <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      )}
      <Text style={[styles.message, { color: config.textColor }]} numberOfLines={2}>
        {config.message}
      </Text>
    </View>
  );
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
});
