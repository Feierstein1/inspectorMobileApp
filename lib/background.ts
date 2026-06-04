import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { drainSyncQueue } from '@/lib/sync';
import { api } from '@/lib/api';
import { useJobsStore } from '@/store/jobs';

export const BACKGROUND_SYNC_TASK = 'background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await drainSyncQueue();
    const jobs = await api.getJobs();
    await useJobsStore.getState().persistJobs(jobs);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes — OS may delay further
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Already registered or not supported on this platform — safe to ignore
  }
}
