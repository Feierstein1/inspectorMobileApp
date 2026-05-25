import { create } from 'zustand';
import { Job, JobItem, Submission } from '@/lib/api';
import { getDb } from '@/lib/db';

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
    await db.runAsync('DELETE FROM jobs');
    for (const job of jobs) {
      await db.runAsync(
        'INSERT OR REPLACE INTO jobs (id, data, synced_at) VALUES (?, ?, ?)',
        [job.id, JSON.stringify(job), now]
      );
    }
    set({ jobs, lastSyncAt: now });
  },

  loadJobsFromDb: async () => {
    const db = getDb();
    const rows = await db.getAllAsync<{ id: string; data: string; synced_at: number }>(
      'SELECT * FROM jobs'
    );
    if (rows.length > 0) {
      const jobs = rows.map((r) => JSON.parse(r.data) as Job);
      const lastSyncAt = Math.max(...rows.map((r) => r.synced_at));
      set({ jobs, lastSyncAt });
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
    // Persist the optimistic update
    const db = getDb();
    const now = Date.now();
    updatedJobs.forEach((job) => {
      db.runAsync('INSERT OR REPLACE INTO jobs (id, data, synced_at) VALUES (?, ?, ?)', [
        job.id,
        JSON.stringify(job),
        now,
      ]);
    });
  },
}));
