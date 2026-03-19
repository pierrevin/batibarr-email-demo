import { NextResponse } from "next/server";

export function requireDemoToken(req: Request) {
  const expected = process.env.DEMO_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "DEMO_TOKEN non configuré côté serveur." },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : auth;
  if (!token || token !== expected) {
    return NextResponse.json({ error: "Non autorisé (token démo invalide)." }, { status: 401 });
  }

  return null;
}

