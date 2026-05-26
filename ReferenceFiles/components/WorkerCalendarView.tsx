"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type CalendarItem = { id: string; status: string; template: { name: string } };
type CalendarJob = {
  id: string;
  name: string;
  status: string;
  scheduledAt: string;
  clientName: string | null;
  location: string | null;
  items: CalendarItem[];
};
type ByDay = Record<string, CalendarJob[]>;

const DAY_HEADERS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES  = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const STATUS_COLORS: Record<string, string> = {
  PENDING:     "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};
const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};
const PANEL_LIMIT = 5;

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime(iso: string): string | null {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  if (h === 0 && m === 0) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
}

function SidePanel({
  selectedKey,
  selectedLabel,
  jobs,
}: {
  selectedKey:   string | null;
  selectedLabel: string;
  jobs:          CalendarJob[];
}) {
  if (!selectedKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4">
        <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-400 dark:text-gray-500">Select a day to view your assignments</p>
      </div>
    );
  }

  const visible  = jobs.slice(0, PANEL_LIMIT);
  const overflow = jobs.length > PANEL_LIMIT;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedLabel}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
        {visible.map((job) => {
          const time = formatTime(job.scheduledAt);
          const completedItems = job.items.filter((i) => i.status === "COMPLETED").length;

          return (
            <div key={job.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{job.name}</p>
                  {time && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{time}</p>
                  )}
                  {job.clientName && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{job.clientName}</p>
                  )}
                </div>
                <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[job.status] ?? ""}`}>
                  {job.status.replace("_", " ")}
                </span>
              </div>

              {job.items.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    My tasks ({completedItems}/{job.items.length} done)
                  </p>
                  {job.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <Link
                        href={
                          item.status === "COMPLETED"
                            ? `/worker/jobs/${job.id}/items/${item.id}?view=1`
                            : `/worker/jobs/${job.id}/items/${item.id}`
                        }
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                      >
                        {item.template.name}
                      </Link>
                      <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-xs font-medium ${ITEM_STATUS_COLORS[item.status] ?? ""}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {overflow && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/worker/jobs?date=${selectedKey}`}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all {jobs.length} jobs →
          </Link>
        </div>
      )}
    </div>
  );
}

export function WorkerCalendarView() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());
  const [byDay, setByDay] = useState<ByDay>({});
  const [loading, setLoading]         = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const fetchMonth = useCallback(async (m: number, y: number) => {
    setLoading(true);
    setSelectedKey(null);
    const res = await fetch(`/api/worker/calendar?month=${m}&year=${y}`);
    if (res.ok) {
      const data = await res.json();
      setByDay(data.byDay);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMonth(month, year); }, [month, year, fetchMonth]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const leadingBlanks  = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const daysInMonth    = new Date(year, month, 0).getDate();

  const selectedJobs = selectedKey ? (byDay[selectedKey] ?? []) : [];
  const selectedLabel = selectedKey
    ? new Date(selectedKey + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">

      {/* ── Calendar grid ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 dark:text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 h-16 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="bg-white dark:bg-gray-900 h-16" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day  = i + 1;
              const key  = toDateKey(year, month, day);
              const jobs = byDay[key] ?? [];
              const count = jobs.length;

              const allItems       = jobs.flatMap((job) => job.items);
              const completedCount = allItems.filter((it) => it.status === "COMPLETED").length;
              const pendingCount   = allItems.length - completedCount;

              const todayCell = isToday(year, month, day);
              const selected  = selectedKey === key;

              return (
                <div
                  key={key}
                  className={`bg-white dark:bg-gray-900 h-16 p-1.5 flex flex-col ${
                    count > 0 ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10" : ""
                  } ${selected ? "ring-2 ring-inset ring-blue-400 dark:ring-blue-500" : ""} transition-colors`}
                  onClick={() => count > 0 && setSelectedKey(selected ? null : key)}
                >
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    todayCell
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }`}>
                    {day}
                  </span>

                  {count > 0 && (
                    <div className="flex-1 flex items-center justify-center gap-1">
                      {completedCount > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          {completedCount}
                        </span>
                      )}
                      {pendingCount > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {pendingCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Side panel ── */}
      <div className="lg:w-72 xl:w-80 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden flex flex-col">
        <SidePanel
          selectedKey={selectedKey}
          selectedLabel={selectedLabel}
          jobs={selectedJobs}
        />
      </div>
    </div>
  );
}
