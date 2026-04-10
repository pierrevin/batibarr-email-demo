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

type DbError = {
  code?: string;
  message?: string;
};

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function isMissingRelationOrColumnError(error: unknown): boolean {
  const e = error as DbError | null;
  const code = e?.code ?? "";
  const message = (e?.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
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

    const runEmailQuery = async (withCampaignFilter: boolean, withDescriptifFilter: boolean) => {
      let query = supabase
        .schema(schema)
        .from("batibarr_client_ia")
        .select("id, id_tiers, sent_to_batibarr_date, email_brouillon_sujet, descriptif")
        .order("sent_to_batibarr_date", { ascending: false, nullsFirst: false });
      if (withCampaignFilter && campagneId) query = query.eq("campagne_id", campagneId);
      if (withDescriptifFilter) query = query.not("descriptif", "is", null).neq("descriptif", "");
      return query;
    };

    const primaryRes = await runEmailQuery(true, true);
    let emailRows = primaryRes.data as unknown[] | null;
    let emailErr = primaryRes.error;

    // If campaign filtering fails (type mismatch, bad value, etc.), keep UI usable.
    if (emailErr && campagneId) {
      const retryWithoutCampaign = await runEmailQuery(false, true);
      if (!retryWithoutCampaign.error) {
        emailRows = retryWithoutCampaign.data as unknown[] | null;
        emailErr = null;
      }
    }
    if (emailErr && isMissingRelationOrColumnError(emailErr)) {
      // Fallback for prod schemas where descriptif/campagne_id may be absent.
      let fallbackQ = supabase
        .schema(schema)
        .from("batibarr_client_ia")
        .select("id, id_tiers, sent_to_batibarr_date, email_brouillon_sujet")
        .order("sent_to_batibarr_date", { ascending: false, nullsFirst: false });
      if (campagneId) fallbackQ = fallbackQ.eq("campagne_id", campagneId);
      const fallback = await fallbackQ;
      emailRows = fallback.data as unknown[] | null;
      emailErr = fallback.error;
      if (emailErr && isMissingRelationOrColumnError(emailErr)) {
        // Last resort when campagne_id itself is absent.
        const lastFallback = await supabase
          .schema(schema)
          .from("batibarr_client_ia")
          .select("id, id_tiers, sent_to_batibarr_date, email_brouillon_sujet")
          .order("sent_to_batibarr_date", { ascending: false, nullsFirst: false });
        emailRows = lastFallback.data as unknown[] | null;
        emailErr = lastFallback.error;
      }
    }
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
      const companyResPrimary = await supabase
        .schema(schema)
        .from("batibarr_clients")
        .select("id, name, entity, address, town, state, country_code, email, phone, id_commercial")
        .in("id", tierIds);
      let companyData = companyResPrimary.data as unknown[] | null;
      let companyErr = companyResPrimary.error;
      if (companyErr && isMissingRelationOrColumnError(companyErr)) {
        const companyResFallback = await supabase
          .schema(schema)
          .from("batibarr_clients")
          .select("id, name, entity, address, town, state, country_code, email, phone")
          .in("id", tierIds);
        companyData = companyResFallback.data as unknown[] | null;
        companyErr = companyResFallback.error;
      }
      if (companyErr) throw companyErr;
      companies = (companyData ?? []) as unknown as CompanyRow[];
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
      if (!representativeErr) {
        representatives = (data ?? []) as unknown as RepresentativeRow[];
      } else if (!isMissingRelationOrColumnError(representativeErr)) {
        throw representativeErr;
      }
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

