import prisma from "@/lib/prisma";
import { sendJobCompleteEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { dispatchReportEmail } from "@/lib/pdf/sendReportEmail";

export async function syncJobStatus(jobId: string, options?: { skipNotifications?: boolean }): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      name: true,
      clientName: true,
      location: true,
      accountId: true,
      requireManagerSignature: true,
      requireClientSignature: true,
      items: { select: { status: true, assignedToUserId: true } },
    },
  });

  if (!job) return;

  const { items } = job;
  let newStatus = "PENDING";
  if (items.length > 0) {
    const allDone = items.every((i) => i.status === "COMPLETED");
    const someDone = items.some((i) => i.status === "COMPLETED");
    if (allDone) newStatus = "COMPLETED";
    else if (someDone) newStatus = "IN_PROGRESS";
  }

  const isNewlyCompleted = newStatus === "COMPLETED" && job.status !== "COMPLETED";

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: newStatus,
      ...(isNewlyCompleted ? { completedAt: new Date() } : {}),
    },
  });

  if (isNewlyCompleted && !options?.skipNotifications) {
    createNotification({
      accountId: job.accountId,
      type: "JOB_COMPLETED",
      title: `Job completed — ${job.name}`,
      body: `All ${items.length} item${items.length !== 1 ? "s" : ""} submitted${job.clientName ? ` for ${job.clientName}` : ""}.`,
      entityId: jobId,
    });

    const account = await prisma.account.findUnique({
      where: { id: job.accountId },
      select: { emailOnJobComplete: true, reportEmailToAdmin: true, reportEmailToClient: true },
    });

    if (account?.emailOnJobComplete) {
      const admins = await prisma.user.findMany({
        where: { accountId: job.accountId, role: { in: ["ADMIN", "MASTER_ADMIN"] }, deletedAt: null },
        select: { email: true },
      });
      for (const admin of admins) {
        sendJobCompleteEmail({
          to: admin.email,
          jobName: job.name,
          clientName: job.clientName,
          location: job.location,
          jobId,
          totalItems: items.length,
        });
      }
    }

    const noSigsRequired = !job.requireClientSignature && !job.requireManagerSignature;

    if (job.requireClientSignature) {
      // Notify each assigned worker to capture the client signature in person
      const workerIds = Array.from(new Set(items.map((i) => i.assignedToUserId)));
      for (const userId of workerIds) {
        createNotification({
          accountId: job.accountId,
          userId,
          type: "CLIENT_SIGNATURE_NEEDED",
          title: `Client signature needed — ${job.name}`,
          body: "All items submitted. Please have the client sign off on the completed job.",
          entityId: jobId,
        });
      }
    }

    if (noSigsRequired && (account?.reportEmailToAdmin || account?.reportEmailToClient)) {
      dispatchReportEmail(jobId, job.accountId);
    }
  }
}

export function computeResult(
  data: Array<{ type: string; value: unknown }>
): string | null {
  const pfItems = data.filter((d) => d.type === "pass_fail");
  if (pfItems.length === 0) return null;
  return pfItems.some((d) => d.value === "fail") ? "fail" : "pass";
}
