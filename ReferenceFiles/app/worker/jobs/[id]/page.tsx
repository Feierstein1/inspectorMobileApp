import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { WorkerJobDetail } from "./WorkerJobDetail";

export default async function WorkerJobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const accountId = session!.user.accountId;
  const savedSignatureUrl = session!.user.signatureUrl ?? null;

  const job = await prisma.job.findFirst({
    where: { id: params.id, accountId, deletedAt: null },
    include: {
      items: {
        where: { assignedToUserId: userId },
        include: {
          template: { select: { name: true } },
          submission: {
            select: {
              id: true,
              result: true,
              createdAt: true,
              editedAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!job) notFound();

  // Worker must be assigned to at least one item on this job
  if (job.items.length === 0) notFound();

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/worker/jobs" className="hover:text-gray-600">My Jobs</Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{job.name}</span>
      </div>
      <WorkerJobDetail
        job={job}
        userId={userId}
        savedSignatureUrl={savedSignatureUrl}
      />
    </div>
  );
}
