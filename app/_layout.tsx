import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/auth';
import { useSyncStore } from '@/store/sync';
import { useJobsStore } from '@/store/jobs';
import { initDb } from '@/lib/db';
import { drainSyncQueue } from '@/lib/sync';
import { api } from '@/lib/api';
import { useThemeStore, useIsDark } from '@/store/theme';

export default function RootLayout() {
  const { loadFromStorage, isLoading, token } = useAuthStore();
  const { setOnline } = useSyncStore();
  const { persistJobs } = useJobsStore();
  const { loadTheme } = useThemeStore();
  const isDark = useIsDark();

  useEffect(() => {
    initDb().then(() => {
      loadFromStorage();
      loadTheme();
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    api.getJobs().then((jobs) => persistJobs(jobs)).catch(() => {});
  }, [token]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(online);
      if (online && token) {
        drainSyncQueue().catch(() => {});
        api.getJobs().then((jobs) => persistJobs(jobs)).catch(() => {});
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
