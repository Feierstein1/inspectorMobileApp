"use client";

import { useState } from "react";

type FailureReport = {
  id: string;
  status: string;
  notes: string | null;
  resolvedAt: string | null;
};

const statusColors: Record<string, string> = {
  OPEN:        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  RESOLVED:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const statusLabels: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved",
};

export function FailureReportPanel({
  submissionId,
  initialReport,
}: {
  submissionId: string;
  initialReport: FailureReport | null;
}) {
  const [report, setReport]     = useState<FailureReport | null>(initialReport);
  const [editing, setEditing]   = useState(false);
  const [status, setStatus]     = useState(initialReport?.status ?? "OPEN");
  const [notes, setNotes]       = useState(initialReport?.notes ?? "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  function openEdit() {
    setStatus(report?.status ?? "OPEN");
    setNotes(report?.notes ?? "");
    setEditing(true);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/submissions/${submissionId}/failure-report`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status, notes }),
    });
    if (res.ok) {
      const data = await res.json();
      setReport(data.failureReport);
      setEditing(false);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  const inputCls =
    "w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm " +
    "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Failure Report</h3>
        {!editing && (
          <button
            type="button"
            onClick={openEdit}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {report ? "Edit" : "Create Report"}
          </button>
        )}
      </div>

      {!editing ? (
        report ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[report.status] ?? ""}`}>
                {statusLabels[report.status] ?? report.status}
              </span>
              {report.resolvedAt && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Resolved {new Date(report.resolvedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {report.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 border border-gray-100 dark:border-gray-700">
                {report.notes}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">No report created yet. Create one to track remediation.</p>
        )
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Describe the issue or steps taken to resolve…"
              className={`${inputCls} resize-none`}
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
