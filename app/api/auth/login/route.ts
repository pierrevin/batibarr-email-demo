import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  DEMO_SESSION_COOKIE,
  getAuthConfig,
  makeSessionCookieValue,
} from "../../_utils/requireDemoToken";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const { demoEmail, demoPasswordHash } = getAuthConfig();
    const body = (await req.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    const emailOk = email === demoEmail.trim().toLowerCase();
    const passwordOk = await bcrypt.compare(password, demoPasswordHash);

    if (!emailOk || !passwordOk) {
      return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(DEMO_SESSION_COOKIE, makeSessionCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

