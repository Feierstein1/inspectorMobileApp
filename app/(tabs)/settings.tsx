import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { useThemeStore, useColors, ThemeMode } from '@/store/theme';
import { useSyncStore } from '@/store/sync';
import { useJobsStore } from '@/store/jobs';
import { drainSyncQueue, resetFailedSubmissions, clearForbiddenSubmissions } from '@/lib/sync';
import { api } from '@/lib/api';

const MODES: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'light', label: 'Light', icon: '☀️' },
  { key: 'dark', label: 'Dark', icon: '🌙' },
];

export default function SettingsScreen() {
  const c = useColors();
  const { user, clearAuth, refreshUser } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const { pendingCount, failedCount, failedPhotoCount, forbiddenCount, isSyncing, lastSyncError, setLastSyncError } = useSyncStore();
  const { persistJobs, lastSyncAt } = useJobsStore();

  const [syncing, setSyncing] = useState(false);

  async function handleManualSync() {
    if (syncing || isSyncing) return;
    setSyncing(true);
    try {
      await resetFailedSubmissions();
      await drainSyncQueue();
      const [jobs] = await Promise.all([
        api.getJobs(),
        refreshUser().catch(() => {}),
      ]);
      await persistJobs(jobs);
    } catch {
      // Status bar reflects the result — no popup needed
    } finally {
      setSyncing(false);
    }
  }

  const syncBusy = syncing || isSyncing;
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Page header */}
      <View style={[styles.header, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
      </View>

      {/* Account section */}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>ACCOUNT</Text>

        <View style={[styles.row, { borderBottomColor: c.border }]}>
          <Text style={[styles.rowKey, { color: c.textSecondary }]}>Name</Text>
          <Text style={[styles.rowVal, { color: c.text }]}>
            {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
          </Text>
        </View>

        <View style={[styles.row, { borderBottomColor: c.border }]}>
          <Text style={[styles.rowKey, { color: c.textSecondary }]}>Email</Text>
          <Text style={[styles.rowVal, { color: c.text }]} numberOfLines={1}>
            {user?.email ?? '—'}
          </Text>
        </View>

        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[styles.rowKey, { color: c.textSecondary }]}>Role</Text>
          <Text style={[styles.rowVal, { color: c.text }]}>{user?.role ?? '—'}</Text>
        </View>
      </View>

      {/* Sync section */}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>DATA SYNC</Text>

        <View style={[styles.row, { borderBottomColor: c.border }]}>
          <Text style={[styles.rowKey, { color: c.textSecondary }]}>Last synced</Text>
          <Text style={[styles.rowVal, { color: c.text }]}>{lastSyncLabel}</Text>
        </View>

        <View style={[styles.row, { borderBottomColor: c.border }]}>
          <Text style={[styles.rowKey, { color: c.textSecondary }]}>Pending uploads</Text>
          <Text style={[styles.rowVal, { color: pendingCount > 0 ? c.warning : c.success }]}>
            {pendingCount > 0 ? `${pendingCount} queued` : 'All synced'}
          </Text>
        </View>

        {failedCount > 0 && (
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowKey, { color: c.textSecondary }]}>Failed submissions</Text>
            <Text style={[styles.rowVal, { color: c.danger }]}>
              {failedCount} form{failedCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {failedPhotoCount > 0 && (
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowKey, { color: c.textSecondary }]}>Failed photos</Text>
            <Text style={[styles.rowVal, { color: c.danger }]}>
              {failedPhotoCount} photo{failedPhotoCount > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {forbiddenCount > 0 && (
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowKey, { color: c.textSecondary }]}>Edit not permitted</Text>
            <TouchableOpacity onPress={() => clearForbiddenSubmissions()}>
              <Text style={[styles.rowVal, { color: c.danger }]}>
                {forbiddenCount} blocked · Clear
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {lastSyncError && (
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowKey, { color: c.textSecondary }]}>Last sync error</Text>
            <TouchableOpacity onPress={() => setLastSyncError(null)} style={{ flex: 2 }}>
              <Text style={[styles.rowVal, { color: c.danger }]} numberOfLines={2}>
                {lastSyncError} · Tap to clear
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <TouchableOpacity
            style={[styles.syncBtn, { backgroundColor: syncBusy ? c.surfaceAlt : c.primary }]}
            onPress={handleManualSync}
            disabled={syncBusy}
            activeOpacity={0.8}
          >
            {syncBusy ? (
              <ActivityIndicator color={c.textMuted} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Sync Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Appearance section */}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>APPEARANCE</Text>

        <View style={[styles.modeContainer, { backgroundColor: c.bg }]}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.modeBtn,
                  active
                    ? { backgroundColor: c.primary }
                    : { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 },
                ]}
                onPress={() => setMode(m.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.modeIcon}>{m.icon}</Text>
                <Text style={[styles.modeBtnText, { color: active ? '#fff' : c.textSecondary }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutBtn, { backgroundColor: c.dangerBg, borderColor: c.danger }]}
        onPress={clearAuth}
        activeOpacity={0.8}
      >
        <Text style={[styles.signOutText, { color: c.danger }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700' },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowKey: { fontSize: 15, flex: 1 },
  rowVal: { fontSize: 15, flex: 2, textAlign: 'right' },
  syncBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modeContainer: { flexDirection: 'row', padding: 12, gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    gap: 4,
  },
  modeIcon: { fontSize: 18 },
  modeBtnText: { fontSize: 12, fontWeight: '600' },
  signOutBtn: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  signOutText: { fontSize: 16, fontWeight: '600' },
});
