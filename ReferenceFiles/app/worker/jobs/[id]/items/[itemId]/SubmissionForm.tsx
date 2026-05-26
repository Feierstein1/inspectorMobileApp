"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LIMITS } from "@/lib/limits";
import { PhotoUploader, type PhotoUploaderHandle, type SavedPhoto } from "@/components/PhotoUploader";
import { SignatureCanvas, type SignatureCanvasHandle } from "@/components/SignatureCanvas";

type SavedPhotoWithField = SavedPhoto & { fieldId?: string | null };

interface SchemaItem {
  id: string;
  label: string;
  type: "pass_fail" | "text" | "number" | "dropdown" | "date" | "datetime" | "photo";
  required: boolean;
  options?: {
    choices?: string[];
    photoRequiredOnFail?: boolean;
    min?: number;
    max?: number;
    maxPhotos?: number;
  };
}

type AnswerValue = string | number | null;

export function SubmissionForm({
  jobItemId,
  submissionId,
  schema,
  initialData,
  initialPhotos = [],
  jobId,
  redirectTo = "/worker/jobs",
  requireWorkerSignature = false,
  existingWorkerSignatureUrl = null,
  savedSignatureUrl = null,
}: {
  jobItemId: string;
  submissionId: string | null;
  schema: SchemaItem[];
  initialData: Array<{ itemId: string; type: string; value: unknown }> | null;
  initialPhotos?: SavedPhotoWithField[];
  jobId: string;
  redirectTo?: string;
  requireWorkerSignature?: boolean;
  existingWorkerSignatureUrl?: string | null;
  savedSignatureUrl?: string | null;
}) {
  const router = useRouter();
  const isEdit = !!submissionId;
  const uploaderRef = useRef<PhotoUploaderHandle>(null);
  const fieldUploaderRefs = useRef<Map<string, PhotoUploaderHandle | null>>(new Map());
  const signatureRef = useRef<SignatureCanvasHandle>(null);
  const [resignMode, setResignMode] = useState(false);

  const generalPhotos = initialPhotos.filter((p) => !p.fieldId);
  function photosForField(fieldId: string) {
    return initialPhotos.filter((p) => p.fieldId === fieldId);
  }

  const DRAFT_KEY = `submission_draft_${jobItemId}`;

  const seed: Record<string, AnswerValue> = {};
  if (initialData) {
    for (const entry of initialData) seed[entry.itemId] = entry.value as AnswerValue;
  }

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(seed);
  const [draftRestored, setDraftRestored] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // After a new submission is saved but photos failed, we enter "retry" mode.
  // The submission already exists in the DB so we can retry photos without re-POSTing answers.
  const [retrySub, setRetrySub] = useState<string | null>(null);

  // Restore draft from localStorage for new submissions
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.answers && Object.keys(draft.answers).length > 0) {
        setAnswers(draft.answers);
        setDraftRestored(true);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function saveDraft(next: Record<string, AnswerValue>) {
    if (isEdit) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: next })); } catch { /* ignore */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      saveDraft(next);
      return next;
    });
  }

  function validate(): string | null {
    for (const item of schema) {
      if (item.type === "photo") continue;
      const val = answers[item.id];
      if (item.required && (val === undefined || val === null || val === "")) {
        return `"${item.label}" is required.`;
      }
      if (item.type === "text" && typeof val === "string" && val.length > LIMITS.TEXT_ANSWER) {
        return `"${item.label}" cannot exceed ${LIMITS.TEXT_ANSWER} characters.`;
      }
      if (item.type === "number" && typeof val === "number") {
        const min = item.options?.min ?? LIMITS.NUMBER_ABS_MIN;
        const max = item.options?.max ?? LIMITS.NUMBER_ABS_MAX;
        if (val < min || val > max) {
          return `"${item.label}" must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`;
        }
      }
    }
    return null;
  }

  function getAllUploaders() {
    return [
      uploaderRef.current,
      ...Array.from(fieldUploaderRefs.current.values()),
    ].filter((u): u is PhotoUploaderHandle => u !== null && u !== undefined);
  }

  async function runPhotoUploads(subId: string): Promise<string[]> {
    const uploaders = getAllUploaders().filter((u) => u.hasPending());
    const photoErrors: string[] = [];
    for (const uploader of uploaders) {
      try {
        await uploader.uploadPending(subId);
      } catch (e) {
        photoErrors.push(e instanceof Error ? e.message : "Photo upload failed.");
      }
    }
    return photoErrors;
  }

  async function handleRetryPhotos() {
    if (!retrySub) return;
    setLoading(true);
    setError("");
    const photoErrors = await runPhotoUploads(retrySub);
    setLoading(false);
    if (photoErrors.length === 0) {
      router.push(redirectTo);
      router.refresh();
    } else {
      setError(
        `${photoErrors.length} photo${photoErrors.length !== 1 ? "s" : ""} still failed to upload. ` +
        "Check each field above for details. You can try again or skip and edit later."
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // If we already saved the submission but photos failed, treat this as a retry
    if (retrySub) {
      await handleRetryPhotos();
      return;
    }

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    // Block submit if any uploader already has a pre-flight validation error
    if (getAllUploaders().some((u) => u.hasError())) {
      setError("Please resolve the photo errors shown above before submitting.");
      return;
    }

    // Require signature when configured and worker hasn't signed yet
    const needsNewSignature = requireWorkerSignature && (resignMode || !existingWorkerSignatureUrl);
    if (needsNewSignature && signatureRef.current?.isEmpty()) {
      setError("Please sign before submitting.");
      return;
    }

    setLoading(true);
    setError("");

    const data = schema.map((item) => ({
      itemId: item.id,
      label: item.label,
      type: item.type,
      value: item.type === "photo" ? null : (answers[item.id] ?? null),
    }));

    const url = isEdit ? `/api/submissions/${submissionId}` : `/api/submissions`;
    const method = isEdit ? "PATCH" : "POST";
    const body = isEdit ? { data } : { jobItemId, data };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Failed to save. Please try again.");
      setLoading(false);
      return;
    }

    const json = await res.json();
    const savedSubId = isEdit ? submissionId! : json.id;

    // Upload photos one at a time. If any fail the submission is already saved —
    // we never abort so the worker's text answers are preserved.
    const photoErrors = await runPhotoUploads(savedSubId);

    if (photoErrors.length > 0) {
      if (!isEdit) {
        // Submission is saved; fire notifications anyway
        await fetch(`/api/submissions/${savedSubId}/finalize`, { method: "POST" }).catch(() => {});
        setRetrySub(savedSubId);
        setError(
          `Your answers were saved, but ${photoErrors.length} photo${photoErrors.length !== 1 ? "s" : ""} failed to upload. ` +
          "Check each photo field above for details, then click Retry Photos — or skip and edit your submission later."
        );
      } else {
        setError(
          `Changes saved, but ${photoErrors.length} photo${photoErrors.length !== 1 ? "s" : ""} failed to upload. ` +
          "Check each photo field above and try submitting again."
        );
      }
      setLoading(false);
      return;
    }

    // Upload worker signature if needed
    if (needsNewSignature && signatureRef.current && !signatureRef.current.isEmpty()) {
      await fetch(`/api/submissions/${savedSubId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: signatureRef.current.toDataURL() }),
      }).catch(() => {}); // non-fatal — submission is already saved
    }

    // All photos succeeded — fire notification and navigate
    if (!isEdit) {
      await fetch(`/api/submissions/${savedSubId}/finalize`, { method: "POST" }).catch(() => {});
      clearDraft();
    }

    router.push(redirectTo);
    router.refresh();
  }

  const inputBase =
    "w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {draftRestored && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-4 py-2.5">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Your previous inputs were restored from a saved draft.
          </p>
          <button
            type="button"
            onClick={() => { clearDraft(); setAnswers(seed); setDraftRestored(false); }}
            className="text-xs text-amber-700 dark:text-amber-400 underline shrink-0"
          >
            Clear draft
          </button>
        </div>
      )}
      {schema.map((item) => {
        const choices = item.options?.choices ?? [];
        const numMin = item.options?.min ?? LIMITS.NUMBER_ABS_MIN;
        const numMax = item.options?.max ?? LIMITS.NUMBER_ABS_MAX;

        return (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-4"
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {item.label}
              {item.required && <span className="text-red-500 ml-1">*</span>}
            </p>

            {item.type === "pass_fail" && (
              <div className="flex gap-3">
                {["pass", "fail"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={!!retrySub}
                    onClick={() => setAnswer(item.id, v)}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium border capitalize transition-colors disabled:opacity-60 ${
                      answers[item.id] === v
                        ? v === "pass"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-red-500 text-white border-red-500"
                        : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            {item.type === "text" && (
              <>
                <textarea
                  value={(answers[item.id] as string) ?? ""}
                  onChange={(e) => setAnswer(item.id, e.target.value)}
                  maxLength={LIMITS.TEXT_ANSWER}
                  rows={3}
                  disabled={!!retrySub}
                  className={`${inputBase} resize-none disabled:opacity-60`}
                />
                {(() => {
                  const len = ((answers[item.id] as string) ?? "").length;
                  const remaining = LIMITS.TEXT_ANSWER - len;
                  return remaining <= LIMITS.TEXT_ANSWER * 0.1 ? (
                    <p className={`text-xs mt-1 text-right ${remaining <= 0 ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}>
                      {len} / {LIMITS.TEXT_ANSWER}
                    </p>
                  ) : null;
                })()}
              </>
            )}

            {item.type === "number" && (
              <input
                type="number"
                value={(answers[item.id] as number) ?? ""}
                min={numMin}
                max={numMax}
                disabled={!!retrySub}
                onChange={(e) => setAnswer(item.id, e.target.value !== "" ? Number(e.target.value) : null)}
                placeholder={`${numMin.toLocaleString()} – ${numMax.toLocaleString()}`}
                className={`${inputBase} disabled:opacity-60`}
              />
            )}

            {item.type === "dropdown" && (
              <select
                value={(answers[item.id] as string) ?? ""}
                onChange={(e) => setAnswer(item.id, e.target.value)}
                disabled={!!retrySub}
                className={`${inputBase} disabled:opacity-60`}
              >
                <option value="">Select an option…</option>
                {choices.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {item.type === "date" && (
              <input
                type="date"
                value={(answers[item.id] as string) ?? ""}
                onChange={(e) => setAnswer(item.id, e.target.value)}
                disabled={!!retrySub}
                className={`${inputBase} disabled:opacity-60`}
              />
            )}

            {item.type === "datetime" && (
              <input
                type="datetime-local"
                value={(answers[item.id] as string) ?? ""}
                onChange={(e) => setAnswer(item.id, e.target.value)}
                disabled={!!retrySub}
                className={`${inputBase} disabled:opacity-60`}
              />
            )}

            {item.type === "photo" && (
              <PhotoUploader
                ref={(el) => { fieldUploaderRefs.current.set(item.id, el); }}
                submissionId={retrySub ?? submissionId ?? undefined}
                savedPhotos={photosForField(item.id)}
                fieldId={item.id}
                maxPhotos={item.options?.maxPhotos}
              />
            )}
          </div>
        );
      })}

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Attachments <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(optional)</span>
        </p>
        <PhotoUploader
          ref={uploaderRef}
          submissionId={retrySub ?? submissionId ?? undefined}
          savedPhotos={generalPhotos}
        />
      </div>

      {/* Worker signature */}
      {requireWorkerSignature && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Worker Sign-Off <span className="text-red-500 ml-0.5">*</span>
          </p>
          {existingWorkerSignatureUrl && !resignMode ? (
            <div className="space-y-2">
              <img
                src={existingWorkerSignatureUrl}
                alt="Existing signature"
                className="h-20 border border-gray-200 dark:border-gray-700 rounded-lg bg-white object-contain p-1"
              />
              <button
                type="button"
                onClick={() => setResignMode(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Re-sign
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Draw your signature below{savedSignatureUrl ? ", or apply your saved signature." : "."}
              </p>
              {savedSignatureUrl && (
                <button
                  type="button"
                  onClick={() => signatureRef.current?.loadImage(savedSignatureUrl)}
                  className="mb-2 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-1 transition-colors"
                >
                  Apply saved signature
                </button>
              )}
              <SignatureCanvas ref={signatureRef} disabled={!!retrySub} />
            </>
          )}
        </div>
      )}

      {error && (
        <div className={`text-sm rounded-md px-3 py-2 border ${
          retrySub
            ? "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
            : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}>
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {retrySub ? (
          <>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Uploading…" : "Retry Photos"}
            </button>
            <button
              type="button"
              onClick={() => { router.push(redirectTo); router.refresh(); }}
              className="px-6 py-3 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Done (skip photos)
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Submit"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => router.push(redirectTo)}
              className="px-6 py-3 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </form>
  );
}
