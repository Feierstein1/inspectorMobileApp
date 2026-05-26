import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { WorkerJobsList } from "@/components/WorkerJobsList";

export default async function WorkerJobsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const userRole = session!.user.role;

  const bypassGate = isAdmin(userRole);

  const canEditSubmissions = bypassGate
    ? true
    : (await prisma.user.findUnique({ where: { id: userId }, select: { canEditSubmissions: true } }))?.canEditSubmissions ?? false;

  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      items: { some: { assignedToUserId: userId } },
    },
    select: {
      id: true,
      name: true,
      status: true,
      clientName: true,
      location: true,
      scheduledAt: true,
      items: {
        where: { assignedToUserId: userId },
        select: {
          id: true,
          status: true,
          tag: true,
          template: { select: { name: true } },
          submission: {
            select: {
              id: true,
              result: true,
              editedAt: true,
              createdAt: true,
              failureReport: { select: { status: true, resolvedAt: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-5">My Jobs</h1>
      <WorkerJobsList jobs={jobs} canEditSubmissions={canEditSubmissions} />
    </div>
  );
}
