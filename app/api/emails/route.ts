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
  id_commercial: string | number | null;
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
  details?: string;
  hint?: string;
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

function isInvalidInputSyntaxError(error: unknown): boolean {
  const e = error as DbError | null;
  return e?.code === "22P02";
}

function keepNumericIds(values: Array<string | number>): string[] {
  return values
    .map((v) => String(v).trim())
    .filter((v) => /^\d+$/.test(v));
}

function normalizeJoinId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Normalize numeric-like IDs: "123", "123.0", "00123" => "123"
  if (/^\d+(\.0+)?$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) return String(n);
  }
  return raw;
}

function formatApiError(error: unknown): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
} {
  if (error instanceof Error) return { message: error.message };
  if (error && typeof error === "object") {
    const e = error as DbError & Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : JSON.stringify(e),
      code: typeof e.code === "string" ? e.code : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      hint: typeof e.hint === "string" ? e.hint : undefined,
    };
  }
  return { message: String(error) };
}

export async function GET(req: Request) {
  const denied = requireDemoSession(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const campagneIdRaw = url.searchParams.get("campagne_id");

  const campagneId =
    campagneIdRaw && campagneIdRaw.trim().length > 0 ? campagneIdRaw.trim() : null;
  if (campagneId && campagneId.includes(",")) {
    return NextResponse.json(
      {
        error: "Paramètre campagne_id invalide: une seule valeur est attendue.",
        errorDetails: { campagneIdRaw },
      },
      { status: 400 },
    );
  }
  const sourceRaw = url.searchParams.get("source");
  const schema = sourceRaw === "preprod" ? "preprod" : "data";

  try {
    const supabase = getSupabaseAdmin();

    const runEmailQuery = async (
      withCampaignFilter: boolean,
      withDescriptifFilter: boolean,
      withCommercialColumn: boolean,
    ) => {
      let query = supabase
        .schema(schema)
        .from("batibarr_client_ia")
        .select(
          withCommercialColumn
            ? "id, id_tiers, id_commercial, sent_to_batibarr_date, email_brouillon_sujet, descriptif"
            : "id, id_tiers, sent_to_batibarr_date, email_brouillon_sujet, descriptif",
        )
        .order("sent_to_batibarr_date", { ascending: false, nullsFirst: false });
      if (withCampaignFilter && campagneId) query = query.eq("campagne_id", campagneId);
      if (withDescriptifFilter) query = query.not("descriptif", "is", null).neq("descriptif", "");
      return query;
    };

    let withCommercialColumn = true;
    let primaryRes = await runEmailQuery(true, true, withCommercialColumn);
    if (primaryRes.error && isMissingRelationOrColumnError(primaryRes.error)) {
      withCommercialColumn = false;
      primaryRes = await runEmailQuery(true, true, withCommercialColumn);
    }
    let emailRows = primaryRes.data as unknown[] | null;
    let emailErr = primaryRes.error;

    // If campaign filtering fails (type mismatch, bad value, etc.), keep UI usable.
    if (emailErr && campagneId) {
      const retryWithoutCampaign = await runEmailQuery(false, true, withCommercialColumn);
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
          .map((r) => normalizeJoinId(r.id_tiers))
          .filter((v): v is string => v !== null),
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
      if (companyErr && isInvalidInputSyntaxError(companyErr)) {
        // If one tier ID is malformed, retry with numeric IDs only to keep valid joins.
        const numericTierIds = keepNumericIds(tierIds);
        if (numericTierIds.length > 0) {
          const companyResRetry = await supabase
            .schema(schema)
            .from("batibarr_clients")
            .select("id, name, entity, address, town, state, country_code, email, phone, id_commercial")
            .in("id", numericTierIds);
          companyData = companyResRetry.data as unknown[] | null;
          companyErr = companyResRetry.error;
        } else {
          companyData = [];
          companyErr = null;
        }
      }
      if (companyErr) throw companyErr;
      companies = (companyData ?? []) as unknown as CompanyRow[];
    }

    const representativeIds = Array.from(
      new Set(
        companies
          .map((c) => normalizeJoinId(c.id_commercial))
          .filter((v): v is string => v !== null),
      ),
    );

    let representatives: RepresentativeRow[] = [];
    if (representativeIds.length > 0) {
      let representativeRes = await supabase
        .schema(schema)
        .from("batibarr_representatives")
        .select("*")
        .in("id", representativeIds);
      if (representativeRes.error && isInvalidInputSyntaxError(representativeRes.error)) {
        const numericRepresentativeIds = keepNumericIds(representativeIds);
        if (numericRepresentativeIds.length > 0) {
          representativeRes = await supabase
            .schema(schema)
            .from("batibarr_representatives")
            .select("*")
            .in("id", numericRepresentativeIds);
        } else {
          representativeRes = { data: [], error: null, count: null, status: 200, statusText: "OK" };
        }
      }
      if (!representativeRes.error) {
        representatives = (representativeRes.data ?? []) as unknown as RepresentativeRow[];
      } else if (
        !isMissingRelationOrColumnError(representativeRes.error) &&
        !isInvalidInputSyntaxError(representativeRes.error)
      ) {
        throw representativeRes.error;
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
        representative: normalizeJoinId(c.id_commercial)
          ? representativeById.get(normalizeJoinId(c.id_commercial) as string) ?? null
          : null,
      });
    }

    const items = emailRowsTyped.map((r) => {
      const normalizedTierId = normalizeJoinId(r.id_tiers);
      const company = normalizedTierId ? companyById.get(normalizedTierId) ?? null : null;
      const lineRepresentativeId =
        normalizeJoinId(r.id_commercial) ?? company?.representative?.id ?? null;
      return {
        id: String(r.id),
        date_generation: r.sent_to_batibarr_date ?? null,
        id_tiers: normalizedTierId,
        representative_id: lineRepresentativeId,
        email_brouillon_sujet: r.email_brouillon_sujet ?? null,
        company,
      };
    });

    const distinctCompanyIds = new Set<string>();
    const companyIdsByRepresentative = new Map<string, Set<string>>();
    for (const r of emailRowsTyped) {
      const companyId = normalizeJoinId(r.id_tiers);
      if (!companyId) continue;
      distinctCompanyIds.add(companyId);
      const representativeId =
        normalizeJoinId(r.id_commercial) ??
        companyById.get(companyId)?.representative?.id ??
        "__unassigned__";
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
    const formatted = formatApiError(e);
    console.error("api/emails error", formatted);
    return NextResponse.json(
      {
        error: formatted.message,
        errorDetails: {
          ...formatted,
          campagneIdRaw,
          campagneId,
        },
      },
      { status: 500 },
    );
  }
}

