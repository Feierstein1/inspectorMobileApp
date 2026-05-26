import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WorkerShell } from "@/components/WorkerShell";

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const role = session.user.role;
  // Admins are allowed through so they can edit submissions from the My Work tab.
  if (role !== "INSPECTOR" && role !== "ADMIN" && role !== "MASTER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <WorkerShell email={session.user.email}>
      {children}
    </WorkerShell>
  );
}
