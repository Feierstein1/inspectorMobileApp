import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.MOBILE_JWT_SECRET ?? "change-me-in-production"
);

const ALGORITHM = "HS256";
const EXPIRY = "30d";

export interface MobileTokenPayload {
  sub: string;       // userId
  email: string;
  role: string;
  accountId: string;
}

export async function signMobileToken(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyMobileToken(token: string): Promise<MobileTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
  return payload as unknown as MobileTokenPayload;
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
