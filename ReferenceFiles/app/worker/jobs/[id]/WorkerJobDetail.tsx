"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { SignatureCanvas, type SignatureCanvasHandle } from "@/components/SignatureCanvas";

const statusColors: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const resultColors: Record<string, string> = {
  pass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  fail: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type Submission = {
  id: string;
  result: string | null;
  createdAt: string | Date;
  editedAt: string | Date | null;
};

type Item = {
  id: string;
  tag: string | null;
  status: string;
  template: { name: string };
  submission: Submission | null;
};

type Job = {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  location: string | null;
  scheduledAt: string | Date | null;
  notes: string | null;
  requireClientSignature: boolean;
  clientSignatureUrl: string | null;
  clientReviewedAt: string | Date | null;
  clientRefusedToSign: boolean;
  items: Item[];
};

export function WorkerJobDetail({
  job: initial,
  userId,
  savedSignatureUrl,
}: {
  job: Job;
  userId: string;
  savedSignatureUrl: string | null;
}) {
  const [job, setJob] = useState(initial);
  const sigRef = useRef<SignatureCanvasHandle>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const needsClientSig =
    job.requireClientSignature &&
    job.status === "COMPLETED" &&
    !job.clientReviewedAt &&
    !job.clientSignatureUrl;

  const clientSigned =
    job.requireClientSignature &&
    (job.clientSignatureUrl || job.clientReviewedAt);

  async function handleSubmitSig() {
    if (sigRef.current?.isEmpty()) { setError("Please provide a signature first."); return; }
    setSaving(true);
    setError("");
    try {
      const imageData = sigRef.current!.toDataURL();
      const res = await fetch(`/api/jobs/${job.id}/client-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save signature.");
        return;
      }
      const data = await res.json();
      setJob((prev) => ({ ...prev, clientSignatureUrl: data.url }));
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Job info */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{job.name}</h1>
          <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status] ?? ""}`}>
            {job.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          {job.clientName && <span>Client: <strong className="text-gray-700 dark:text-gray-200">{job.clientName}</strong></span>}
          {job.location && <span>Location: <strong className="text-gray-700 dark:text-gray-200">{job.location}</strong></span>}
          {job.scheduledAt && (
            <span>
              Scheduled:{" "}
              <strong className="text-gray-700 dark:text-gray-200">
                {new Date(job.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </strong>
            </span>
          )}
        </div>
        {job.notes && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2 border border-gray-100 dark:border-gray-700 whitespace-pre-wrap">
            {job.notes}
          </p>
        )}
      </div>

      {/* My items */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">My Items</h2>
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {job.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.template.name}</p>
                {item.tag && <p className="text-xs text-gray-400">{item.tag}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.submission?.result && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultColors[item.submission.result] ?? ""}`}>
                    {item.submission.result.toUpperCase()}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status] ?? ""}`}>
                  {item.status.replace("_", " ")}
                </span>
                {item.status !== "COMPLETED" && (
                  <Link
                    href={`/worker/jobs/${job.id}/items/${item.id}`}
                    className="text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-1 transition-colors"
                  >
                    {item.submission ? "Re-submit" : "Submit"}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Client signature capture */}
      {job.requireClientSignature && job.status === "COMPLETED" && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Client Sign-Off</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Please hand the device to the client and have them sign below to confirm the completed work.
          </p>

          {done || clientSigned ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Signed
              </span>
              <span className="text-xs text-gray-500">Client signature captured</span>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSignatureUrl && (
                <button
                  type="button"
                  onClick={() => sigRef.current?.loadImage(savedSignatureUrl)}
                  className="text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-1 transition-colors"
                >
                  Apply saved signature
                </button>
              )}
              <SignatureCanvas ref={sigRef} width={480} height={160} />
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmitSig}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
                >
                  {saving ? "Saving…" : "Confirm Signature"}
                </button>
                <button
                  type="button"
                  onClick={() => sigRef.current?.clear()}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
