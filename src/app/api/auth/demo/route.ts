import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

const PAYLOAD = "public-demo.operator.v1";

function signedSession(): string | null {
  const secret = process.env.CREDENTIALS_SECRET;
  if (!secret || secret.length < 32) return null;
  const signature = createHmac("sha256", secret).update(PAYLOAD).digest("base64url");
  return `${PAYLOAD}.${signature}`;
}

export async function POST() {
  if (process.env.MDM_PUBLIC_DEMO !== "true") {
    return NextResponse.json({ error: "Demo access is disabled" }, { status: 404 });
  }
  const session = signedSession();
  if (!session) {
    return NextResponse.json({ error: "Demo access is not configured" }, { status: 503 });
  }
  const response = NextResponse.json({ role: "operator", mode: "simulation" });
  response.cookies.set("mdm-demo", session, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
