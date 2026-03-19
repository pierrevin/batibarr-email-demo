import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDemoSession } from "../_utils/requireDemoToken";

type Company = {
  id: string;
  name: string | null;
  entity: string | null;
  address: string | null;
  town: string | null;
  state: string | null;
  country_code: string | null;
  email: string | null;
  phone: string | null;
} | null;

type EmailRow = {
  id: string | number;
  id_tiers: string | number | null;
  date_generation: string | null;
  email_brouillon_sujet: string | null;
  descriptif: string | null;
};

type CompanyRow = {
  id: string | number;
  name: string | null;
  entity: string | null;
  address: string | null;
  town: string | null;
  state: string | null;
  country_code: string | null;
  email: string | null;
  phone: string | null;
};

export async function GET(req: Request) {
  const denied = requireDemoSession(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit") ?? "50";
  const offsetRaw = url.searchParams.get("offset") ?? "0";
  const campagneIdRaw = url.searchParams.get("campagne_id");

  const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);
  const offset = Math.max(Number(offsetRaw) || 0, 0);
  const campagneId =
    campagneIdRaw && campagneIdRaw.trim().length > 0 ? campagneIdRaw.trim() : null;

  try {
    const supabase = getSupabaseAdmin();

    let q = supabase
      .schema("preprod")
      .from("batibarr_client_ia")
      .select("id, id_tiers, date_generation, email_brouillon_sujet, descriptif")
      .order("date_generation", { ascending: false })
      .range(offset, offset + limit - 1);

    if (campagneId) q = q.eq("campagne_id", campagneId);
    q = q.not("descriptif", "is", null).neq("descriptif", "");

    const { data: emailRows, error: emailErr } = await q;
    if (emailErr) throw emailErr;

    const emailRowsTyped = (emailRows ?? []) as unknown as EmailRow[];
    const tierIds = Array.from(
      new Set(
        emailRowsTyped
          .map((r) => r.id_tiers)
          .filter((v): v is string | number => v !== null && v !== undefined),
      ),
    );

    let companies: CompanyRow[] = [];
    if (tierIds.length > 0) {
      const { data, error: companyErr } = await supabase
        .schema("preprod")
        .from("batibarr_clients")
        .select("id, name, entity, address, town, state, country_code, email, phone")
        .in("id", tierIds);
      if (companyErr) throw companyErr;
      companies = (data ?? []) as unknown as CompanyRow[];
    }

    const companyById = new Map<string, Company>();
    for (const c of companies) {
      companyById.set(String(c.id), {
        id: String(c.id),
        name: c.name ?? null,
        entity: c.entity ?? null,
        address: c.address ?? null,
        town: c.town ?? null,
        state: c.state ?? null,
        country_code: c.country_code ?? null,
        email: c.email ?? null,
        phone: c.phone ?? null,
      });
    }

    const items = emailRowsTyped.map((r) => {
      const company = r.id_tiers ? companyById.get(String(r.id_tiers)) ?? null : null;
      return {
        id: String(r.id),
        date_generation: r.date_generation ?? null,
        id_tiers: r.id_tiers ? String(r.id_tiers) : null,
        email_brouillon_sujet: r.email_brouillon_sujet ?? null,
        company,
      };
    });

    return NextResponse.json({
      items,
      hasMore: emailRowsTyped.length === limit,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

