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

export default function RootLayout() {
  const { loadFromStorage, isLoading, token } = useAuthStore();
  const { setOnline } = useSyncStore();
  const { persistJobs } = useJobsStore();

  // Boot: init SQLite then load token from SecureStore
  useEffect(() => {
    initDb().then(() => loadFromStorage());
  }, []);

  // When token is available, prefetch jobs
  useEffect(() => {
    if (!token) return;
    api.getJobs().then((jobs) => persistJobs(jobs)).catch(() => {});
  }, [token]);

  // Watch connectivity; drain queue and refresh jobs on reconnect
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

  // Navigate once auth state is resolved
  useEffect(() => {
    if (isLoading) return;
    router.replace(token ? '/(app)' : '/login');
  }, [isLoading, token]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
