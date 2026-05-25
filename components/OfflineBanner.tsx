import { View, Text, StyleSheet } from 'react-native';
import { useSyncStore } from '@/store/sync';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing } = useSyncStore();

  if (isOnline && pendingCount === 0) return null;

  const plural = pendingCount !== 1 ? 's' : '';
  const message = !isOnline
    ? pendingCount > 0
      ? `Offline — ${pendingCount} item${plural} pending sync`
      : 'Offline'
    : isSyncing
    ? 'Syncing...'
    : `${pendingCount} item${plural} pending sync`;

  return (
    <View style={[styles.banner, isOnline ? styles.syncing : styles.offline]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
  offline: { backgroundColor: '#DC2626' },
  syncing: { backgroundColor: '#D97706' },
  text: { color: '#fff', fontSize: 13, fontWeight: '500' },
});
