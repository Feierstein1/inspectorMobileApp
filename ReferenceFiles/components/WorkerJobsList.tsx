"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { UploadSheetModal } from "@/components/UploadSheetModal";

const LS_PERIOD = "worker_period";
const LS_STATUS = "worker_status";
const LS_SEARCH = "worker_search";

const PAGE_SIZE = 10;

type Period = "today" | "week" | "all";
type StatusFilter = "all" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "all",   label: "All" },
];

const STATUS_FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "PENDING",     label: "Pending" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED",   label: "Completed" },
];

const itemStatusColors: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const jobStatusColors: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

type FailureReport = { status: string; resolvedAt: Date | string | null };

type SubmissionInfo = {
  id: string;
  result: string | null;
  editedAt: string | Date | null;
  createdAt: string | Date;
  failureReport: FailureReport | null;
};

type JobItem = {
  id: string;
  status: string;
  tag: string | null;
  template: { name: string };
  submission: SubmissionInfo | null;
};

type Job = {
  id: string;
  name: string;
  status: string;
  clientName: string | null;
  location: string | null;
  scheduledAt: string | Date | null;
  items: JobItem[];
};

function isToday(date: string | Date | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(date: string | Date | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  startOfWeek.setDate(now.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

type UploadTarget = { jobId: string; itemId: string; templateName: string };

export function WorkerJobsList({
  jobs,
  canEditSubmissions,
}: {
  jobs: Job[];
  canEditSubmissions: boolean;
}) {
  const [period, setPeriod]             = useState<Period>("today");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [downloading, setDownloading]   = useState<string | null>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem(LS_PERIOD) as Period | null;
      const s = localStorage.getItem(LS_STATUS) as StatusFilter | null;
      const q = localStorage.getItem(LS_SEARCH) ?? "";
      if (p && ["today", "week", "all"].includes(p)) setPeriod(p);
      if (s && ["all", "PENDING", "IN_PROGRESS", "COMPLETED"].includes(s)) setStatusFilter(s);
      if (q) setSearch(q);
    } catch { /* localStorage unavailable */ }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (period === "today" && !isToday(job.scheduledAt)) return false;
      if (period === "week"  && !isThisWeek(job.scheduledAt)) return false;
      if (statusFilter !== "all" && job.status !== statusFilter) return false;
      if (q && !job.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, period, statusFilter, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handlePeriod(p: Period) {
    setPeriod(p);
    setPage(1);
    try { localStorage.setItem(LS_PERIOD, p); } catch { /* ignore */ }
  }

  function handleStatus(s: StatusFilter) {
    setStatusFilter(s);
    setPage(1);
    try { localStorage.setItem(LS_STATUS, s); } catch { /* ignore */ }
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
    try { localStorage.setItem(LS_SEARCH, v); } catch { /* ignore */ }
  }

  async function handleDownload(jobId: string, itemId: string) {
    setDownloading(itemId);
    try {
      const res  = await fetch(`/api/jobs/${jobId}/items/${itemId}/download`);
      if (!res.ok) { const j = await res.json(); alert(j.error ?? "Download failed."); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "job.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No jobs assigned to you yet.</p>;
  }

  return (
    <div className="space-y-4">
      {uploadTarget && (
        <UploadSheetModal
          inspectionId={uploadTarget.jobId}
          itemId={uploadTarget.itemId}
          templateName={uploadTarget.templateName}
          onClose={() => setUploadTarget(null)}
        />
      )}

      {/* Period filter */}
      <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0.5">
        {PERIOD_TABS.map((tab) => {
          const active = period === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handlePeriod(tab.key)}
              className={`px-3 py-1.5 text-xs md:text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + status filter row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0.5">
          {STATUS_FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleStatus(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4">
          {search
            ? "No jobs match your search."
            : period === "today"
              ? "No jobs scheduled for today."
              : period === "week"
                ? "No jobs scheduled for this week."
                : "No jobs found."}
        </p>
      )}

      {/* Job cards */}
      {paginated.map((job) => {
        const myItems        = job.items;
        const completedCount = myItems.filter((i) => i.status === "COMPLETED").length;
        const todayCard      = isToday(job.scheduledAt);

        return (
          <div
            key={job.id}
            className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden transition-colors ${
              todayCard
                ? "border-2 border-blue-400 dark:border-blue-500"
                : "border border-gray-100 dark:border-gray-800"
            }`}
          >
            {/* Job header */}
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/worker/jobs/${job.id}`} className="font-semibold text-gray-900 dark:text-white text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{job.name}</Link>
                  {todayCard && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      Today
                    </span>
                  )}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${jobStatusColors[job.status]}`}>
                    {job.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {job.clientName && <span>{job.clientName}</span>}
                  {job.location   && <span>{job.location}</span>}
                  {job.scheduledAt && (
                    <span>Scheduled: {new Date(job.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 shrink-0 pt-0.5">
                {completedCount}/{myItems.length} done
              </p>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {myItems.map((item) => {
                const hasSubmission = !!item.submission;
                const canEdit = hasSubmission && canEditSubmissions;

                return (
                  <div key={item.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200">
                          {item.template.name}
                          {item.tag && <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500 font-normal">· {item.tag}</span>}
                        </p>
                        {item.submission && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Submitted {new Date(item.submission.createdAt).toLocaleDateString()}
                            {item.submission.editedAt && " · edited"}
                            {item.submission.result && (
                              <span className={`ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-medium uppercase ${
                                item.submission.result === "pass"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}>
                                {item.submission.result}
                              </span>
                            )}
                            {item.submission.result === "fail" && item.submission.failureReport && (
                              <span className={`ml-1 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                item.submission.failureReport.status === "RESOLVED"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : item.submission.failureReport.status === "IN_PROGRESS"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}>
                                {item.submission.failureReport.status === "RESOLVED"
                                  ? "Resolved"
                                  : item.submission.failureReport.status === "IN_PROGRESS"
                                    ? "In Progress"
                                    : "Open"}
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${itemStatusColors[item.status]}`}>
                          {item.status}
                        </span>
                        {!hasSubmission && (
                          <Link
                            href={`/worker/jobs/${job.id}/items/${item.id}`}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View
                          </Link>
                        )}
                        {hasSubmission && (
                          <Link
                            href={`/worker/jobs/${job.id}/items/${item.id}?view=1`}
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View
                          </Link>
                        )}
                        {canEdit && (
                          <Link
                            href={`/worker/jobs/${job.id}/items/${item.id}?edit=1`}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Offline / Excel section */}
                    {!hasSubmission && (
                      <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-800">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                          Download the pre-filled Excel form to complete in the field, then upload it here when you're back online.
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleDownload(job.id, item.id)}
                            disabled={downloading === item.id}
                            className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline disabled:opacity-40 transition-colors"
                          >
                            {downloading === item.id ? "Downloading…" : "↓ Download Sheet"}
                          </button>
                          <button
                            onClick={() => setUploadTarget({ jobId: job.id, itemId: item.id, templateName: item.template.name })}
                            className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline transition-colors"
                          >
                            ↑ Upload Sheet
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} job{filtered.length !== 1 ? "s" : ""} · page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
