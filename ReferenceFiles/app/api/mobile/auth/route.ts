import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      accountId: true,
      deletedAt: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user || user.deletedAt) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  if (user.role !== "INSPECTOR") {
    return NextResponse.json({ error: "Mobile app is for workers only." }, { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await signMobileToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    accountId: user.accountId,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      accountId: user.accountId,
    },
  });
}
