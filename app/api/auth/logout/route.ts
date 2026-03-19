import { NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "../../_utils/requireDemoToken";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

