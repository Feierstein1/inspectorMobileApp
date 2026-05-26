import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SubmissionForm } from "./SubmissionForm";
import { SubmissionViewer, type ViewerEntry, type ViewerPhoto } from "./SubmissionViewer";
import { FailureReportPanel } from "./FailureReportPanel";
import { isAdmin } from "@/lib/roles";

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
  };
}

export default async function WorkerItemPage({
  params,
  searchParams,
}: {
  params: { id: string; itemId: string };
  searchParams: { edit?: string; view?: string; from?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const userRole = session!.user.role;
  const savedSignatureUrl = session!.user.signatureUrl ?? null;
  const bypassGate = isAdmin(userRole);

  const canEditSubmissions = bypassGate
    ? true
    : (await prisma.user.findUnique({ where: { id: userId }, select: { canEditSubmissions: true } }))?.canEditSubmissions ?? false;

  const item = await prisma.jobItem.findFirst({
    where: {
      id: params.itemId,
      jobId: params.id,
      assignedToUserId: userId,
      job: { deletedAt: null },
    },
    include: {
      template: true,
      job: { select: { id: true, name: true, clientName: true, location: true, scheduledAt: true } },
      submission: {
        include: {
          photos: { select: { id: true, url: true, filename: true, fieldId: true } },
          failureReport: { select: { id: true, status: true, notes: true, resolvedAt: true } },
        },
      },
    },
  });

  if (!item) notFound();

  const isEdit = searchParams.edit === "1";
  const isView = searchParams.view === "1";
  const hasSubmission = !!item.submission;
  const redirectTo = searchParams.from === "my-work" ? "/my-work" : "/worker/jobs";

  if (isEdit && !hasSubmission) redirect(`/worker/jobs/${params.id}/items/${params.itemId}`);
  if (isEdit && !canEditSubmissions) redirect(redirectTo);
  if (hasSubmission && !isEdit && !isView) redirect(redirectTo);

  const schema = item.template.schema as unknown as SchemaItem[];
  const initialData = hasSubmission
    ? (item.submission!.data as Array<{ itemId: string; type: string; value: unknown }>)
    : null;
  const initialPhotos = hasSubmission ? (item.submission!.photos ?? []) : [];

  let viewerEntries: ViewerEntry[] = [];
  let viewerPhotos: ViewerPhoto[] = [];

  if (isView && hasSubmission) {
    const schemaMap = new Map<string, { label: string; type: string }>();
    for (const field of schema) {
      schemaMap.set(field.id, { label: field.label, type: field.type });
    }

    const rawData = item.submission!.data;
    const dataArray: Array<Record<string, unknown>> = Array.isArray(rawData)
      ? (rawData as Array<Record<string, unknown>>)
      : [];

    for (const row of dataArray) {
      const fieldId = String(row.itemId ?? "");
      const schemaField = schemaMap.get(fieldId);
      viewerEntries.push({
        fieldId,
        label: schemaField?.label ?? String(row.label ?? fieldId),
        type:  schemaField?.type  ?? String(row.type  ?? "text"),
        value: row.value ?? null,
      });
    }

    viewerPhotos = (item.submission!.photos ?? []).map((p) => ({
      id:       p.id,
      url:      p.url,
      filename: p.filename,
      fieldId:  p.fieldId ?? null,
    }));
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link href="/worker/jobs" className="hover:text-gray-600 dark:hover:text-gray-300">
          My Jobs
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{item.job.name}</span>
      </div>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {isView ? "Submission" : isEdit ? "Edit Submission" : "Submit Job"} — {item.template.name}
          {item.tag && (
            <span className="ml-2 text-base font-normal text-gray-400 dark:text-gray-500">· {item.tag}</span>
          )}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
          {item.job.clientName && <span>{item.job.clientName}</span>}
          {item.job.location && <span>{item.job.location}</span>}
          {item.job.scheduledAt && (
            <span>Scheduled: {new Date(item.job.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
          )}
        </div>
        {isEdit && item.submission && (
          <p className="text-xs text-gray-400 mt-1">
            Last submitted {new Date(item.submission.createdAt).toLocaleDateString()}
            {item.submission.editedAt && ` · edited ${new Date(item.submission.editedAt).toLocaleDateString()}`}
          </p>
        )}
      </div>

      {isView && hasSubmission ? (
        <>
          <SubmissionViewer
            entries={viewerEntries}
            photos={viewerPhotos}
            result={item.submission!.result}
            submittedAt={item.submission!.createdAt.toISOString()}
            editedAt={item.submission!.editedAt?.toISOString() ?? null}
          />
          {item.submission!.result === "fail" && (
            <FailureReportPanel
              submissionId={item.submission!.id}
              initialReport={item.submission!.failureReport
                ? {
                    id:         item.submission!.failureReport.id,
                    status:     item.submission!.failureReport.status,
                    notes:      item.submission!.failureReport.notes,
                    resolvedAt: item.submission!.failureReport.resolvedAt?.toISOString() ?? null,
                  }
                : null
              }
            />
          )}
        </>
      ) : (
        <SubmissionForm
          jobItemId={item.id}
          submissionId={isEdit ? item.submission!.id : null}
          schema={schema}
          initialData={initialData}
          initialPhotos={initialPhotos}
          jobId={params.id}
          redirectTo={redirectTo}
          requireWorkerSignature={item.template.requireWorkerSignature}
          existingWorkerSignatureUrl={item.submission?.workerSignatureUrl ?? null}
          savedSignatureUrl={savedSignatureUrl}
        />
      )}
    </div>
  );
}
