import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { put } from "@vercel/blob";
import { verifyMobileToken, extractBearerToken } from "@/lib/mobileAuth";
import { LIMITS } from "@/lib/limits";

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

  // Verify worker owns this item
  const item = await prisma.jobItem.findFirst({
    where: {
      id: jobItemId,
      assignedToUserId: userId,
      job: { accountId, deletedAt: null },
    },
    include: { submission: { select: { id: true, photos: { select: { id: true } } } } },
  });

  if (!item) return NextResponse.json({ error: "Job item not found." }, { status: 404 });
  if (!item.submission) return NextResponse.json({ error: "Submit the form before uploading photos." }, { status: 400 });

  const submissionId = item.submission.id;
  const existingCount = item.submission.photos.length;

  // Soft guard: no hard per-submission cap — per-field cap is enforced client-side
  void existingCount;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Multipart form data required." }, { status: 400 });

  const file = formData.get("photo") as File | null;
  const fieldId = formData.get("fieldId") as string | null;

  if (!file) return NextResponse.json({ error: "photo field is required." }, { status: 400 });

  if (file.size > LIMITS.MAX_PHOTO_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Photo exceeds the ${LIMITS.MAX_PHOTO_SIZE_MB} MB limit.` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `photos/${submissionId}/${Date.now()}.${ext}`;

  const blob = await put(filename, file, { access: "public" });

  const photo = await prisma.submissionPhoto.create({
    data: {
      submissionId,
      url: blob.url,
      filename: file.name,
      size: file.size,
      fieldId: fieldId || null,
    },
  });

  return NextResponse.json({ id: photo.id, url: photo.url }, { status: 201 });
}
