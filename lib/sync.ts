import { deleteAsync } from 'expo-file-system/legacy';
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

export async function getPendingItemIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ job_item_id: string }>(
    "SELECT DISTINCT job_item_id FROM submissions_queue WHERE status = 'pending'"
  );
  return rows.map((r) => r.job_item_id);
}

export async function getForbiddenCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM submissions_queue WHERE status = 'forbidden'"
  );
  return row?.count ?? 0;
}

export async function getFailedCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM submissions_queue WHERE status = 'failed'"
  );
  return row?.count ?? 0;
}

// Counts both failed photo uploads and failed worker signature uploads — both are
// "attachment uploads that failed after the form data was already saved."
export async function getFailedPhotoCount(): Promise<number> {
  const db = getDb();
  const [photos, sigs] = await Promise.all([
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM photos_queue WHERE status = 'failed'"
    ),
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM worker_signatures_queue WHERE status = 'failed'"
    ),
  ]);
  return (photos?.count ?? 0) + (sigs?.count ?? 0);
}

// Returns true when the server definitively rejected the request and retrying is pointless:
// - UNAUTHORIZED: token is gone
// - 4xx (except 429 rate-limit): server rejected the payload itself
// - TIMEOUT / network error / 5xx: transient — keep retrying
function isFatalSyncError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : '';
  if (msg === 'UNAUTHORIZED') return true;
  const firstSegment = msg.split(':')[0];
  const code = parseInt(firstSegment.replace('HTTP_', ''));
  return !isNaN(code) && code >= 400 && code < 500 && code !== 429;
}

export async function clearForbiddenSubmissions(): Promise<void> {
  const db = getDb();
  await db.execAsync(
    "DELETE FROM submissions_queue WHERE status = 'forbidden'"
  );
  useSyncStore.getState().setForbiddenCount(0);
}

export async function resetFailedSubmissions(): Promise<void> {
  const db = getDb();
  await db.execAsync(`
    UPDATE submissions_queue SET status = 'pending', attempts = 0 WHERE status = 'failed';
    UPDATE photos_queue SET status = 'pending', attempts = 0 WHERE status = 'failed';
    UPDATE worker_signatures_queue SET status = 'pending', attempts = 0 WHERE status = 'failed';
  `);
  const { setFailedCount, setFailedPhotoCount } = useSyncStore.getState();
  setFailedCount(0);
  setFailedPhotoCount(0);
}

export async function drainSyncQueue(): Promise<void> {
  const syncStore = useSyncStore.getState();
  // Guard against concurrent invocations (NetInfo + manual sync + background fetch)
  if (syncStore.isSyncing) return;

  const {
    setSyncing,
    setPendingCount,
    setPendingItemIds,
    setFailedCount,
    setFailedPhotoCount,
    setForbiddenCount,
  } = syncStore;
  setSyncing(true);

  try {
    const db = getDb();

    // ── 1. Submissions ───────────────────────────────────────────────────
    const pendingSubmissions = await db.getAllAsync<{
      id: string;
      job_item_id: string;
      data: string;
      attempts: number;
      is_update: number;
      photo_deletes: string;
    }>("SELECT * FROM submissions_queue WHERE status = 'pending' AND attempts < 3");

    for (const row of pendingSubmissions) {
      try {
        const data: SubmissionEntry[] = JSON.parse(row.data);
        const deletedPhotoIds: string[] = JSON.parse(row.photo_deletes || '[]');
        let result: { id: string; result: string | null };

        if (row.is_update) {
          result = await api.updateSubmission(row.job_item_id, data, deletedPhotoIds);
        } else {
          try {
            result = await api.submitForm(row.job_item_id, data);
          } catch (postErr: unknown) {
            const msg = postErr instanceof Error ? postErr.message : '';
            if (msg.startsWith('HTTP_409')) {
              // Server already has a submission for this item — treat as an update
              await db.runAsync(
                'UPDATE submissions_queue SET is_update = 1 WHERE id = ?',
                [row.id]
              );
              result = await api.updateSubmission(row.job_item_id, data);
            } else {
              throw postErr;
            }
          }
        }

        await db.runAsync(
          "UPDATE submissions_queue SET status = 'synced' WHERE id = ?",
          [row.id]
        );
        await db.runAsync(
          "UPDATE photos_queue SET submission_id = ? WHERE job_item_id = ? AND status = 'pending'",
          [result.id, row.job_item_id]
        );
        await db.runAsync(
          "UPDATE worker_signatures_queue SET submission_id = ? WHERE job_item_id = ? AND status = 'pending'",
          [result.id, row.job_item_id]
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        const is403 = msg.startsWith('HTTP_403');
        const fatal = is403 || isFatalSyncError(err);
        const newStatus = is403 ? 'forbidden' : fatal ? 'failed' : 'pending';
        await db.runAsync(
          "UPDATE submissions_queue SET attempts = attempts + 1, status = ? WHERE id = ?",
          [newStatus, row.id]
        );
      }
    }

    // ── 2. Photos ────────────────────────────────────────────────────────
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
        await deleteAsync(row.local_uri, { idempotent: true });
      } catch (err: unknown) {
        const fatal = isFatalSyncError(err);
        await db.runAsync(
          "UPDATE photos_queue SET attempts = attempts + 1, status = ? WHERE id = ?",
          [fatal ? 'failed' : 'pending', row.id]
        );
      }
    }

    // ── 3. Worker signatures ─────────────────────────────────────────────
    // Runs after submissions so the server-side submission record exists (avoids 409).
    const pendingSigs = await db.getAllAsync<{
      id: string;
      job_item_id: string;
      image_data: string;
      attempts: number;
    }>(
      "SELECT * FROM worker_signatures_queue WHERE status = 'pending' AND submission_id IS NOT NULL AND attempts < 3"
    );

    for (const row of pendingSigs) {
      try {
        await api.uploadWorkerSignature(row.job_item_id, row.image_data);
        await db.runAsync(
          "UPDATE worker_signatures_queue SET status = 'synced' WHERE id = ?",
          [row.id]
        );
      } catch (err: unknown) {
        const fatal = isFatalSyncError(err);
        await db.runAsync(
          "UPDATE worker_signatures_queue SET attempts = attempts + 1, status = ? WHERE id = ?",
          [fatal ? 'failed' : 'pending', row.id]
        );
      }
    }

    const [count, itemIds, failed, failedPhotos, forbidden] = await Promise.all([
      getPendingCount(),
      getPendingItemIds(),
      getFailedCount(),
      getFailedPhotoCount(),
      getForbiddenCount(),
    ]);
    setPendingCount(count);
    setPendingItemIds(itemIds);
    setFailedCount(failed);
    setFailedPhotoCount(failedPhotos);
    setForbiddenCount(forbidden);
  } finally {
    useSyncStore.getState().setSyncing(false);
  }
}
