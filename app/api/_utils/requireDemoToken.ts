import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const DEMO_SESSION_COOKIE = "batibarr_demo_session";

function buildExpectedSessionValue(email: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}

function getCookieValue(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${name}=`));
  if (!found) return null;
  return decodeURIComponent(found.slice(name.length + 1));
}

export function getAuthConfig() {
  const demoEmail = process.env.DEMO_EMAIL;
  const demoPasswordHash = process.env.DEMO_PASSWORD_HASH;
  const sessionSecret = process.env.DEMO_SESSION_SECRET || demoPasswordHash;

  if (!demoEmail || !demoPasswordHash) {
    throw new Error("Missing env vars DEMO_EMAIL or DEMO_PASSWORD_HASH");
  }
  if (!sessionSecret) {
    throw new Error("Missing env var DEMO_SESSION_SECRET");
  }

  return { demoEmail, demoPasswordHash, sessionSecret };
}

export function makeSessionCookieValue() {
  const { demoEmail, sessionSecret } = getAuthConfig();
  return buildExpectedSessionValue(demoEmail.toLowerCase(), sessionSecret);
}

export function requireDemoSession(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookieValue = getCookieValue(cookieHeader, DEMO_SESSION_COOKIE);
    if (!cookieValue) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const expected = makeSessionCookieValue();
    if (cookieValue !== expected) {
      return NextResponse.json({ error: "Session invalide." }, { status: 401 });
    }
    return null;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

