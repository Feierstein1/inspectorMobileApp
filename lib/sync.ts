import * as FileSystem from 'expo-file-system';
import { getDb } from '@/lib/db';
import { api, SubmissionEntry } from '@/lib/api';
import { useSyncStore } from '@/store/sync';

export async function getPendingCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM submissions_queue WHERE status = 'pending'"
  );
  return row?.count ?? 0;
}

export async function drainSyncQueue(): Promise<void> {
  const { setSyncing, setPendingCount } = useSyncStore.getState();
  setSyncing(true);

  try {
    const db = getDb();

    // ── Submissions ──────────────────────────────────────────────────────
    const pendingSubmissions = await db.getAllAsync<{
      id: string;
      job_item_id: string;
      data: string;
      attempts: number;
    }>("SELECT * FROM submissions_queue WHERE status = 'pending' AND attempts < 3");

    for (const row of pendingSubmissions) {
      try {
        const data: SubmissionEntry[] = JSON.parse(row.data);
        const result = await api.submitForm(row.job_item_id, data);
        await db.runAsync(
          "UPDATE submissions_queue SET status = 'synced' WHERE id = ?",
          [row.id]
        );
        await db.runAsync(
          "UPDATE photos_queue SET submission_id = ? WHERE job_item_id = ? AND status = 'pending'",
          [result.id, row.job_item_id]
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        const code = parseInt(msg.split(':')[0].replace('HTTP_', ''));
        const fatal = !isNaN(code) && code >= 400 && code < 500;
        await db.runAsync(
          "UPDATE submissions_queue SET attempts = attempts + 1, status = ? WHERE id = ?",
          [fatal ? 'failed' : 'pending', row.id]
        );
      }
    }

    // ── Photos ───────────────────────────────────────────────────────────
    const pendingPhotos = await db.getAllAsync<{
      id: string;
      submission_id: string;
      job_item_id: string;
      local_uri: string;
      field_id: string | null;
      attempts: number;
    }>(
      "SELECT * FROM photos_queue WHERE status = 'pending' AND submission_id IS NOT NULL AND attempts < 3"
    );

    for (const row of pendingPhotos) {
      try {
        await api.uploadPhoto(row.job_item_id, row.local_uri, row.field_id ?? undefined);
        await db.runAsync(
          "UPDATE photos_queue SET status = 'synced' WHERE id = ?",
          [row.id]
        );
        await FileSystem.deleteAsync(row.local_uri, { idempotent: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        const code = parseInt(msg.split(':')[0].replace('HTTP_', ''));
        const fatal = !isNaN(code) && code >= 400 && code < 500;
        await db.runAsync(
          "UPDATE photos_queue SET attempts = attempts + 1, status = ? WHERE id = ?",
          [fatal ? 'failed' : 'pending', row.id]
        );
      }
    }

    const count = await getPendingCount();
    setPendingCount(count);
  } finally {
    useSyncStore.getState().setSyncing(false);
  }
}
