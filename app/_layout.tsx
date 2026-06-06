import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/auth';
import { useAccountStore } from '@/store/account';
import { useSyncStore } from '@/store/sync';
import { useJobsStore } from '@/store/jobs';
import { initDb } from '@/lib/db';
import {
  drainSyncQueue,
  getPendingCount,
  getPendingItemIds,
  getFailedCount,
  getFailedPhotoCount,
  getForbiddenCount,
} from '@/lib/sync';
import { registerBackgroundSync } from '@/lib/background';
import { api } from '@/lib/api';
import { useThemeStore, useIsDark } from '@/store/theme';

export default function RootLayout() {
  const { loadFromStorage, refreshUser, clearAuth, isLoading, token } = useAuthStore();
  const { blockReason } = useAccountStore();
  const {
    setOnline,
    failedCount,
    failedPhotoCount,
    forbiddenCount,
    setPendingCount,
    setPendingItemIds,
    setFailedCount,
    setFailedPhotoCount,
    setForbiddenCount,
  } = useSyncStore();
  const { persistJobs } = useJobsStore();
  const { loadTheme } = useThemeStore();
  const isDark = useIsDark();

  // Mid-session account block — sign out immediately so the login screen shows the reason
  useEffect(() => {
    if (blockReason && token) {
      clearAuth();
    }
  }, [blockReason]);

  const prevFailedCount = useRef(0);
  const prevFailedPhotoCount = useRef(0);
  const prevForbiddenCount = useRef(0);

  useEffect(() => {
    initDb()
      .then(async () => {
        await loadFromStorage();
        await loadTheme();
        refreshUser().catch(() => {}); // Non-blocking — updates permissions silently
        await registerBackgroundSync();
        // Hydrate pending/failed state from SQLite on startup
        const [count, ids, failed, failedPhotos, forbidden] = await Promise.all([
          getPendingCount(),
          getPendingItemIds(),
          getFailedCount(),
          getFailedPhotoCount(),
          getForbiddenCount(),
        ]);
        setPendingCount(count);
        setPendingItemIds(ids);
        setFailedCount(failed);
        setFailedPhotoCount(failedPhotos);
        setForbiddenCount(forbidden);
      })
      .catch(() => {
        Alert.alert(
          'Storage Error',
          'Failed to initialize local storage. Some features may not work correctly. Try restarting the app.',
          [{ text: 'OK' }]
        );
      });
  }, []);

  // Alert the worker when a form submission has permanently failed (3 attempts exhausted)
  useEffect(() => {
    if (failedCount > 0 && failedCount > prevFailedCount.current) {
      Alert.alert(
        'Submission Failed',
        `${failedCount} form submission${failedCount > 1 ? 's' : ''} could not be sent to the server after multiple attempts. Your form data is saved. Tap "Sync Now" in Settings to retry.`,
        [{ text: 'OK' }]
      );
    }
    prevFailedCount.current = failedCount;
  }, [failedCount]);

  // Alert separately when photos fail — form data is already safe, user just needs to know
  useEffect(() => {
    if (failedPhotoCount > 0 && failedPhotoCount > prevFailedPhotoCount.current) {
      Alert.alert(
        'Photo Upload Failed',
        `${failedPhotoCount} photo${failedPhotoCount > 1 ? 's' : ''} could not be uploaded after multiple attempts. Your form answers are saved. Tap "Sync Now" in Settings to retry the upload.`,
        [{ text: 'OK' }]
      );
    }
    prevFailedPhotoCount.current = failedPhotoCount;
  }, [failedPhotoCount]);

  // 403 from server — worker does not have edit permission
  useEffect(() => {
    if (forbiddenCount > 0 && forbiddenCount > prevForbiddenCount.current) {
      Alert.alert(
        'Edit Not Allowed',
        'You do not have permission to edit submissions. Contact your administrator if you believe this is an error. Your original submission remains on file.',
        [{ text: 'OK' }]
      );
    }
    prevForbiddenCount.current = forbiddenCount;
  }, [forbiddenCount]);

  useEffect(() => {
    if (!token) return;
    api.getJobs().then((jobs) => persistJobs(jobs)).catch(() => {});
  }, [token]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(online);
      // drainSyncQueue guards itself against concurrent runs; no extra check needed here
      if (online && token) {
        drainSyncQueue()
          .then(() => api.getJobs())
          .then((jobs) => persistJobs(jobs))
          .catch(() => {});
      }
    });
    return unsub;
  }, [token]);

  useEffect(() => {
    if (isLoading) return;
    router.replace(token ? '/(tabs)' : '/login');
  }, [isLoading, token]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
