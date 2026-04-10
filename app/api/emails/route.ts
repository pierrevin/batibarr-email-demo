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
  representative: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
} | null;

type RepresentativeStat = {
  representativeId: string | null;
  representativeName: string;
  companyCount: number;
};

type EmailRow = {
  id: string | number;
  id_tiers: string | number | null;
  sent_to_batibarr_date: string | null;
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
  id_commercial: string | number | null;
};

type RepresentativeRow = {
  id: string | number;
} & Record<string, unknown>;

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function pickDateValue(row: Record<string, unknown>): string | null {
  const keys = [
    "date_generation",
    "created_at",
    "campaign_date",
    "date",
    "generated_at",
    "sent_to_batibarr_date",
    "start_date",
  ];

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value))) {
      return value;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const denied = requireDemoSession(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const campagneIdRaw = url.searchParams.get("campagne_id");

  const campagneId =
    campagneIdRaw && campagneIdRaw.trim().length > 0 ? campagneIdRaw.trim() : null;
  const sourceRaw = url.searchParams.get("source");
  const schema = sourceRaw === "preprod" ? "preprod" : "data";

  try {
    const supabase = getSupabaseAdmin();
    let campaignStartIso: string | null = null;
    let campaignEndIso: string | null = null;

    if (campagneId) {
      const { data: campaignRow, error: campaignErr } = await supabase
        .schema(schema)
        .from("batibarr_campaigns")
        .select("*")
        .eq("id", campagneId)
        .maybeSingle();
      if (campaignErr) throw campaignErr;

      if (!campaignRow) {
        return NextResponse.json({
          items: [],
          hasMore: false,
          stats: {
            totalCompanies: 0,
            byRepresentative: [],
          },
        });
      }

      const dateRaw = pickDateValue(campaignRow as Record<string, unknown>);
      if (dateRaw) {
        const ts = Date.parse(dateRaw);
        if (!Number.isNaN(ts)) {
          campaignStartIso = new Date(ts).toISOString();
          campaignEndIso = new Date(ts + 60 * 60 * 1000).toISOString();
        }
      }
    }

    let q = supabase
      .schema(schema)
      .from("batibarr_client_ia")
      .select("id, id_tiers, sent_to_batibarr_date, email_brouillon_sujet, descriptif")
      .order("sent_to_batibarr_date", { ascending: false, nullsFirst: false });

    if (campaignStartIso && campaignEndIso) {
      q = q.gte("sent_to_batibarr_date", campaignStartIso).lt("sent_to_batibarr_date", campaignEndIso);
    }
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
        .schema(schema)
        .from("batibarr_clients")
        .select("id, name, entity, address, town, state, country_code, email, phone, id_commercial")
        .in("id", tierIds);
      if (companyErr) throw companyErr;
      companies = (data ?? []) as unknown as CompanyRow[];
    }

    const representativeIds = Array.from(
      new Set(
        companies
          .map((c) => c.id_commercial)
          .filter((v): v is string | number => v !== null && v !== undefined),
      ),
    );

    let representatives: RepresentativeRow[] = [];
    if (representativeIds.length > 0) {
      const { data, error: representativeErr } = await supabase
        .schema(schema)
        .from("batibarr_representatives")
        .select("*")
        .in("id", representativeIds);
      if (representativeErr) throw representativeErr;
      representatives = (data ?? []) as unknown as RepresentativeRow[];
    }

    const representativeById = new Map<string, NonNullable<Company>["representative"]>();
    for (const raw of representatives) {
      const row = raw as Record<string, unknown>;
      const id = String(raw.id);
      const firstName = pickString(row, ["first_name", "firstname", "prenom", "firstName"]);
      const lastName = pickString(row, ["last_name", "lastname", "nom", "lastName"]);
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      const fallbackName = pickString(row, ["name", "full_name", "display_name", "label"]);
      representativeById.set(id, {
        id,
        name: fullName || fallbackName || null,
        email: pickString(row, ["email", "mail"]),
        phone: pickString(row, ["phone", "telephone", "mobile", "tel"]),
      });
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
        representative: c.id_commercial
          ? representativeById.get(String(c.id_commercial)) ?? null
          : null,
      });
    }

    const items = emailRowsTyped.map((r) => {
      const company = r.id_tiers ? companyById.get(String(r.id_tiers)) ?? null : null;
      return {
        id: String(r.id),
        date_generation: r.sent_to_batibarr_date ?? null,
        id_tiers: r.id_tiers ? String(r.id_tiers) : null,
        email_brouillon_sujet: r.email_brouillon_sujet ?? null,
        company,
      };
    });

    const distinctCompanyIds = new Set<string>();
    const companyIdsByRepresentative = new Map<string, Set<string>>();
    for (const r of emailRowsTyped) {
      if (!r.id_tiers) continue;
      const companyId = String(r.id_tiers);
      distinctCompanyIds.add(companyId);
      const representativeId = companyById.get(companyId)?.representative?.id ?? "__unassigned__";
      const bucket = companyIdsByRepresentative.get(representativeId) ?? new Set<string>();
      bucket.add(companyId);
      companyIdsByRepresentative.set(representativeId, bucket);
    }

    const byRepresentative: RepresentativeStat[] = Array.from(companyIdsByRepresentative.entries())
      .map(([representativeIdRaw, companyIds]) => {
        const isUnassigned = representativeIdRaw === "__unassigned__";
        const representativeId = isUnassigned ? null : representativeIdRaw;
        const representativeName = isUnassigned
          ? "Non assigne"
          : (representativeById.get(representativeIdRaw)?.name ?? `Commercial #${representativeIdRaw}`);
        return {
          representativeId,
          representativeName,
          companyCount: companyIds.size,
        };
      })
      .sort((a, b) => b.companyCount - a.companyCount || a.representativeName.localeCompare(b.representativeName));

    return NextResponse.json({
      items,
      hasMore: false,
      stats: {
        totalCompanies: distinctCompanyIds.size,
        byRepresentative,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

