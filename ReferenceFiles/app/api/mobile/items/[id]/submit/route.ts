import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMobileToken, extractBearerToken } from "@/lib/mobileAuth";
import { syncJobStatus, computeResult } from "@/lib/inspectionStatus";
import { LIMITS } from "@/lib/limits";
import { upsertTemplateSchema } from "@/lib/templateSchema";
import { logAction } from "@/lib/audit";

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
  const jobItemId = params.id;

  const body = await req.json().catch(() => null);
  const { data } = body ?? {};

  if (!Array.isArray(data)) {
    return NextResponse.json({ error: "data array is required." }, { status: 400 });
  }

  for (const entry of data) {
    if (entry.type === "text" && typeof entry.value === "string" && entry.value.length > LIMITS.TEXT_ANSWER) {
      return NextResponse.json({ error: `"${entry.label}" exceeds the character limit.` }, { status: 400 });
    }
  }

  const item = await prisma.jobItem.findFirst({
    where: {
      id: jobItemId,
      assignedToUserId: userId,
      job: { accountId, deletedAt: null },
    },
    include: {
      submission: { select: { id: true } },
      job: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, currentSchemaId: true, schema: true } },
    },
  });

  if (!item) return NextResponse.json({ error: "Job item not found." }, { status: 404 });
  if (item.submission) {
    return NextResponse.json({ error: "A submission already exists. Use PATCH to edit." }, { status: 409 });
  }

  const result = computeResult(data);
  const templateSchemaId = item.template.currentSchemaId
    ?? await upsertTemplateSchema(prisma, item.template.id, item.template.schema as unknown[]);

  const submission = await prisma.$transaction(async (tx) => {
    const sub = await tx.submission.create({
      data: {
        jobItemId,
        submittedByUserId: userId,
        data,
        result,
        templateSchemaId,
      },
    });
    await tx.jobItem.update({ where: { id: jobItemId }, data: { status: "COMPLETED" } });
    return sub;
  });

  await syncJobStatus(item.job.id);

  await logAction({
    accountId,
    userId,
    userEmail: payload.email,
    action: "SUBMISSION_CREATED",
    entityType: "Submission",
    entityId: submission.id,
    metadata: { jobName: item.job.name, templateName: item.template.name, result: result ?? "n/a", source: "mobile" },
  });

  return NextResponse.json({ id: submission.id, result }, { status: 201 });
}

export async function PATCH(
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
  const jobItemId = params.id;

  const body = await req.json().catch(() => null);
  const { data } = body ?? {};

  if (!Array.isArray(data)) {
    return NextResponse.json({ error: "data array is required." }, { status: 400 });
  }

  const item = await prisma.jobItem.findFirst({
    where: {
      id: jobItemId,
      assignedToUserId: userId,
      job: { accountId, deletedAt: null },
    },
    include: {
      submission: true,
      job: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  });

  if (!item) return NextResponse.json({ error: "Job item not found." }, { status: 404 });
  if (!item.submission) return NextResponse.json({ error: "No submission to edit." }, { status: 404 });

  const result = computeResult(data);

  const updated = await prisma.submission.update({
    where: { id: item.submission.id },
    data: { data, result, editedAt: new Date() },
  });

  await logAction({
    accountId,
    userId,
    userEmail: payload.email,
    action: "SUBMISSION_EDITED",
    entityType: "Submission",
    entityId: updated.id,
    metadata: { jobName: item.job.name, result: result ?? "n/a", source: "mobile" },
  });

  return NextResponse.json({ id: updated.id, result });
}
