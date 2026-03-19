import { NextResponse } from "next/server";
import { requireDemoSession } from "../../_utils/requireDemoToken";

export async function GET(req: Request) {
  const denied = requireDemoSession(req);
  if (denied) return denied;
  return NextResponse.json({ authenticated: true });
}

