import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { put } from "@vercel/blob";
import { verifyMobileToken, extractBearerToken } from "@/lib/mobileAuth";
import { dispatchReportEmail } from "@/lib/pdf/sendReportEmail";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload;
  try {
    payload = await verifyMobileToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const { sub: userId, accountId } = payload;
  const jobId = params.id;

  // Worker must have at least one item assigned to this job
  const hasItem = await prisma.jobItem.findFirst({
    where: { jobId, assignedToUserId: userId, job: { accountId, deletedAt: null } },
    select: { id: true },
  });
  if (!hasItem) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const job = await prisma.job.findFirst({
    where: { id: jobId, accountId, deletedAt: null },
    select: { id: true, requireClientSignature: true, clientSignatureUrl: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (!job.requireClientSignature) {
    return NextResponse.json({ error: "This job does not require a client signature." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const { imageData } = body ?? {};

  if (!imageData || typeof imageData !== "string" || !imageData.startsWith("data:image/")) {
    return NextResponse.json({ error: "imageData (base64 PNG data URL) is required." }, { status: 400 });
  }

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const path = `signatures/jobs/${jobId}/client-${Date.now()}.png`;
  const blob = await put(path, buffer, { access: "public", contentType: "image/png" });

  await prisma.job.update({
    where: { id: jobId },
    data: { clientSignatureUrl: blob.url },
  });

  dispatchReportEmail(jobId, accountId);

  return NextResponse.json({ url: blob.url });
}
