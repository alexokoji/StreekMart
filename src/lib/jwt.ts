import { SignJWT, jwtVerify } from "jose";

// Every account is implicitly a buyer; opt-in flags grant additional powers.
export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  isSeller: boolean;
  isDesigner: boolean;
  [key: string]: unknown;
}

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-please-change-in-production-min32",
);

const ALG = "HS256";
const EXP = "7d";

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXP)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
