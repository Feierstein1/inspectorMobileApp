import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMobileToken, extractBearerToken } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload;
  try {
    payload = await verifyMobileToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const { sub: userId, accountId } = payload;

  const items = await prisma.jobItem.findMany({
    where: {
      assignedToUserId: userId,
      job: { accountId, deletedAt: null },
    },
    select: {
      id: true,
      tag: true,
      status: true,
      job: {
        select: {
          id: true,
          name: true,
          clientName: true,
          location: true,
          scheduledAt: true,
          notes: true,
          type: true,
          status: true,
          requireClientSignature: true,
          clientSignatureUrl: true,
          clientReviewedAt: true,
        },
      },
      template: {
        select: {
          id: true,
          name: true,
          requireWorkerSignature: true,
          currentSchema: {
            select: { id: true, schema: true },
          },
          schema: true,
        },
      },
      submission: {
        select: {
          id: true,
          result: true,
          createdAt: true,
          updatedAt: true,
          data: true,
          workerSignatureUrl: true,
          photos: {
            select: { id: true, url: true, filename: true, fieldId: true },
          },
        },
      },
    },
    orderBy: { job: { scheduledAt: "asc" } },
  });

  // Group items by job and embed template schema
  const jobMap = new Map<string, {
    id: string;
    name: string;
    clientName: string | null;
    location: string | null;
    scheduledAt: Date | null;
    notes: string | null;
    type: string;
    status: string;
    requireClientSignature: boolean;
    clientSignatureUrl: string | null;
    clientReviewedAt: Date | null;
    items: typeof items;
  }>();

  for (const item of items) {
    const job = item.job;
    if (!jobMap.has(job.id)) {
      jobMap.set(job.id, { ...job, items: [] });
    }
    jobMap.get(job.id)!.items.push({
      ...item,
      // resolve schema: prefer currentSchema, fall back to template.schema
      template: {
        ...item.template,
        resolvedSchema: item.template.currentSchema?.schema ?? item.template.schema,
      },
    } as typeof item);
  }

  return NextResponse.json(Array.from(jobMap.values()));
}
