"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { LIMITS } from "@/lib/limits";

export type SavedPhoto = { id: string; url: string; filename: string };
export type PhotoUploaderHandle = {
  uploadPending: (subId: string) => Promise<void>;
  hasError: () => boolean;
  hasPending: () => boolean;
};

// ─── Photo picker for new/edit forms ─────────────────────────────────────────
// Handles local preview. Parent form calls uploadPending() after submission is
// saved. Each photo is uploaded in a separate request to stay within Vercel's
// 4.5 MB serverless body limit.

export const PhotoUploader = forwardRef<PhotoUploaderHandle, {
  submissionId?: string;
  savedPhotos?: SavedPhoto[];
  onSavedPhotosChange?: (photos: SavedPhoto[]) => void;
  fieldId?: string;
  maxPhotos?: number;
}>(function PhotoUploader({
  submissionId,
  savedPhotos = [],
  onSavedPhotosChange,
  fieldId,
  maxPhotos,
}, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedPhoto[]>(savedPhotos);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useImperativeHandle(ref, () => ({
    uploadPending,
    hasError: () => errors.length > 0,
    hasPending: () => pending.length > 0,
  }));

  const photoLimit = maxPhotos ?? 10;
  const totalCount = saved.length + pending.length;
  const slotsLeft = photoLimit - totalCount;

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setErrors([]);
    const newErrors: string[] = [];
    const toAdd: File[] = [];

    for (const file of Array.from(fileList)) {
      if (toAdd.length + pending.length + saved.length >= photoLimit) {
        newErrors.push(`Maximum ${photoLimit} photo${photoLimit === 1 ? "" : "s"} allowed.`);
        break;
      }
      if (file.size > LIMITS.MAX_PHOTO_SIZE_BYTES) {
        newErrors.push(`"${file.name}" is over the ${LIMITS.MAX_PHOTO_SIZE_MB} MB size limit.`);
        continue;
      }
      toAdd.push(file);
    }

    if (newErrors.length) setErrors(newErrors);
    setPending((p) => [...p, ...toAdd]);
    setPreviews((p) => [...p, ...toAdd.map((f) => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePending(idx: number) {
    URL.revokeObjectURL(previews[idx]);
    setPending((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
    setErrors([]);
  }

  async function deleteSaved(photoId: string) {
    if (!submissionId) return;
    setDeletingId(photoId);
    const res = await fetch(`/api/submissions/${submissionId}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (res.ok) {
      const next = saved.filter((p) => p.id !== photoId);
      setSaved(next);
      onSavedPhotosChange?.(next);
    } else {
      setErrors(["Failed to delete photo."]);
    }
    setDeletingId(null);
  }

  // Upload each photo in its own request to stay under the 4.5 MB serverless
  // body limit. Failed photos remain in the pending list so the user can retry.
  async function uploadPending(subId: string): Promise<void> {
    if (!pending.length) return;
    setUploading(true);
    setErrors([]);

    const stillPending: File[] = [];
    const stillPreviews: string[] = [];
    const newSaved: SavedPhoto[] = [];
    const uploadErrors: string[] = [];

    for (let i = 0; i < pending.length; i++) {
      const file = pending[i];
      const preview = previews[i];
      const fd = new FormData();
      fd.append("photos", file);
      if (fieldId) fd.append("fieldId", fieldId);

      try {
        const res = await fetch(`/api/submissions/${subId}/photos`, { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));

        if (res.ok && json.photos?.length) {
          (json.photos as SavedPhoto[]).forEach((p) =>
            newSaved.push({ id: p.id, url: p.url, filename: p.filename })
          );
          URL.revokeObjectURL(preview);
          if (json.errors?.length) uploadErrors.push(...json.errors);
        } else {
          const msg = json.error ?? `Failed to upload "${file.name}".`;
          uploadErrors.push(msg);
          stillPending.push(file);
          stillPreviews.push(preview);
        }
      } catch {
        uploadErrors.push(`"${file.name}" could not be uploaded — check your connection and try again.`);
        stillPending.push(file);
        stillPreviews.push(preview);
      }
    }

    setPending(stillPending);
    setPreviews(stillPreviews);

    const next = [...saved, ...newSaved];
    setSaved(next);
    onSavedPhotosChange?.(next);
    setUploading(false);

    if (uploadErrors.length) {
      setErrors(uploadErrors);
      throw new Error(uploadErrors[0]);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Photos
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            ({totalCount} / {photoLimit})
          </span>
        </p>
        {slotsLeft > 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Add photo{slotsLeft > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* No capture attribute — lets the device show both camera and gallery options */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {totalCount > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
          {saved.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <img src={photo.url} alt={photo.filename} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => deleteSaved(photo.id)}
                disabled={deletingId === photo.id}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                aria-label="Delete photo"
              >
                &times;
              </button>
            </div>
          ))}
          {previews.map((url, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border-2 border-blue-300 dark:border-blue-600">
              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 inset-x-0 bg-blue-600/80 text-white text-center text-xs py-0.5">
                {uploading ? "uploading…" : "pending"}
              </div>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove photo"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {uploading && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Uploading {pending.length} photo{pending.length !== 1 ? "s" : ""}…
        </p>
      )}

      {errors.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
});
