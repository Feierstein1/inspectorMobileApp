import { create } from 'zustand';
import { Job, JobItem, Submission } from '@/lib/api';
import { getDb } from '@/lib/db';
import { getPendingCount, getPendingItemIds } from '@/lib/sync';
import { useSyncStore } from '@/store/sync';

interface JobsState {
  jobs: Job[];
  lastSyncAt: number | null;
  isRefreshing: boolean;
  setRefreshing: (v: boolean) => void;
  persistJobs: (jobs: Job[]) => Promise<void>;
  loadJobsFromDb: () => Promise<void>;
  markItemSubmitted: (jobId: string, itemId: string, data: JobItem['submission']) => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  lastSyncAt: null,
  isRefreshing: false,

  setRefreshing: (isRefreshing) => set({ isRefreshing }),

  persistJobs: async (jobs) => {
    const db = getDb();
    const now = Date.now();
    // Atomic replace: if any insert fails the DELETE is rolled back too
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM jobs');
      for (const job of jobs) {
        await db.runAsync(
          'INSERT OR REPLACE INTO jobs (id, data, synced_at) VALUES (?, ?, ?)',
          [job.id, JSON.stringify(job), now]
        );
      }
    });
    set({ jobs, lastSyncAt: now });
  },

  loadJobsFromDb: async () => {
    const db = getDb();
    const rows = await db.getAllAsync<{ id: string; data: string; synced_at: number }>(
      'SELECT * FROM jobs'
    );
    if (rows.length > 0) {
      const jobs: Job[] = [];
      let lastSyncAt = 0;
      for (const r of rows) {
        try {
          jobs.push(JSON.parse(r.data) as Job);
          if (r.synced_at > lastSyncAt) lastSyncAt = r.synced_at;
        } catch {
          // Skip any row whose JSON is corrupted rather than crashing the entire load
        }
      }
      if (jobs.length > 0) {
        set({ jobs, lastSyncAt });
      }
    }
  },

  markItemSubmitted: (jobId, itemId, submission) => {
    const updatedJobs = get().jobs.map((job) => {
      if (job.id !== jobId) return job;
      return {
        ...job,
        items: job.items.map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, status: 'COMPLETED', submission };
        }),
      };
    });
    set({ jobs: updatedJobs });
    const db = getDb();
    const now = Date.now();
    Promise.all(
      updatedJobs.map((job) =>
        db.runAsync('INSERT OR REPLACE INTO jobs (id, data, synced_at) VALUES (?, ?, ?)', [
          job.id,
          JSON.stringify(job),
          now,
        ])
      )
    ).catch(() => {});
    Promise.all([getPendingCount(), getPendingItemIds()])
      .then(([count, ids]) => {
        useSyncStore.getState().setPendingCount(count);
        useSyncStore.getState().setPendingItemIds(ids);
      })
      .catch(() => {});
  },
}));
