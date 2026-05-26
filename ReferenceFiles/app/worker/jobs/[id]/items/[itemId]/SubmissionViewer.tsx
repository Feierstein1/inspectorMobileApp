"use client";

import Image from "next/image";

export type ViewerEntry = {
  fieldId: string;
  label:   string;
  type:    string;
  value:   unknown;
};

export type ViewerPhoto = {
  id:       string;
  url:      string;
  filename: string;
  fieldId:  string | null;
};

function formatValue(type: string, val: unknown): React.ReactNode {
  if (val === undefined || val === null || val === "") {
    return <span className="text-sm text-gray-400 dark:text-gray-500 italic">Not answered</span>;
  }

  if (type === "pass_fail") {
    const str = String(val).toLowerCase();
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
        str === "pass"
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      }`}>
        {str}
      </span>
    );
  }

  if (type === "date") {
    try {
      return (
        <span className="text-sm text-gray-800 dark:text-gray-200">
          {new Date(String(val)).toLocaleDateString([], { dateStyle: "medium" })}
        </span>
      );
    } catch { /* fall through */ }
  }

  if (type === "datetime") {
    try {
      return (
        <span className="text-sm text-gray-800 dark:text-gray-200">
          {new Date(String(val)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </span>
      );
    } catch { /* fall through */ }
  }

  return (
    <span className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{String(val)}</span>
  );
}

export function SubmissionViewer({
  entries,
  photos,
  result,
  submittedAt,
  editedAt,
}: {
  entries:     ViewerEntry[];
  photos:      ViewerPhoto[];
  result:      string | null;
  submittedAt: string;
  editedAt:    string | null;
}) {
  const generalPhotos = photos.filter((p) => !p.fieldId);
  const photosForField = (fieldId: string) => photos.filter((p) => p.fieldId === fieldId);

  const answerEntries = entries.filter((e) => e.type !== "photo");
  const photoEntries  = entries.filter((e) => e.type === "photo");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Submitted {new Date(submittedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          {editedAt && ` · edited ${new Date(editedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
        </p>
        {result && (
          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
            result === "pass"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            Overall: {result}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-4 py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No submission data found.</p>
        </div>
      ) : (
        <>
          {answerEntries.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden divide-y divide-gray-50 dark:divide-gray-800">
              {answerEntries.map((entry) => (
                <div key={entry.fieldId} className="px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{entry.label}</p>
                  <div>{formatValue(entry.type, entry.value)}</div>
                </div>
              ))}
            </div>
          )}

          {photoEntries.map((entry) => {
            const fieldPhotos = photosForField(entry.fieldId);
            return (
              <div key={entry.fieldId} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-4 py-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{entry.label}</p>
                {fieldPhotos.length === 0 ? (
                  <span className="text-sm text-gray-400 dark:text-gray-500 italic">No photos uploaded</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fieldPhotos.map((photo) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                        <Image
                          src={photo.url}
                          alt={photo.filename}
                          width={80}
                          height={80}
                          className="rounded object-cover w-20 h-20 border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {generalPhotos.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg px-4 py-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Attachments</p>
          <div className="flex flex-wrap gap-2">
            {generalPhotos.map((photo) => (
              <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                <Image
                  src={photo.url}
                  alt={photo.filename}
                  width={80}
                  height={80}
                  className="rounded object-cover w-20 h-20 border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
