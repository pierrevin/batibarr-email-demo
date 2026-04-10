import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDemoSession } from "../../_utils/requireDemoToken";

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

type EmailRow = {
  id: string | number;
  id_tiers: string | number | null;
  sent_to_batibarr_date: string | null;
  email_brouillon_sujet: string | null;
  email_brouillon_corps: string | null;
  email_brouillon_points_cles: unknown;
  descriptif: string | null;
  marches: string | null;
  concurrents: string | null;
  actualites: string | null;
  salons: string | null;
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

function isInvalidInputSyntaxError(error: unknown): boolean {
  const e = error as DbError | null;
  return e?.code === "22P02";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = requireDemoSession(req);
  if (denied) return denied;

  const { id } = await context.params;
  const url = new URL(req.url);
  const sourceRaw = url.searchParams.get("source");
  const schema = sourceRaw === "preprod" ? "preprod" : "data";

  try {
    const supabase = getSupabaseAdmin();

    const { data: emailRow, error: emailErr } = await supabase
      .schema(schema)
      .from("batibarr_client_ia")
      .select("id_tiers, sent_to_batibarr_date, email_brouillon_sujet, email_brouillon_corps, email_brouillon_points_cles, descriptif, marches, concurrents, actualites, salons")
      .eq("id", id)
      .maybeSingle();

    if (emailErr) throw emailErr;
    if (!emailRow) {
      return NextResponse.json({ error: "Email introuvable." }, { status: 404 });
    }

    const emailRowTyped = emailRow as unknown as EmailRow;
    const idTiers = emailRowTyped.id_tiers;
    let company: Company = null;
    if (idTiers) {
      let companyRes = await supabase
        .schema(schema)
        .from("batibarr_clients")
        .select("id, name, entity, address, town, state, country_code, email, phone, id_commercial")
        .eq("id", idTiers)
        .maybeSingle();
      if (companyRes.error && isMissingRelationOrColumnError(companyRes.error)) {
        companyRes = await supabase
          .schema(schema)
          .from("batibarr_clients")
          .select("id, name, entity, address, town, state, country_code, email, phone")
          .eq("id", idTiers)
          .maybeSingle();
      }

      if (companyRes.error && isInvalidInputSyntaxError(companyRes.error)) {
        companyRes = { data: null, error: null, count: null, status: 200, statusText: "OK" };
      }
      if (companyRes.error) throw companyRes.error;
      if (companyRes.data) {
        const companyRow = companyRes.data;
        const companyRowTyped = companyRow as unknown as CompanyRow;
        let representative: NonNullable<Company>["representative"] = null;
        if (companyRowTyped.id_commercial) {
          const { data: representativeRow, error: representativeErr } = await supabase
            .schema(schema)
            .from("batibarr_representatives")
            .select("*")
            .eq("id", companyRowTyped.id_commercial)
            .maybeSingle();
          if (
            representativeErr &&
            !isMissingRelationOrColumnError(representativeErr) &&
            !isInvalidInputSyntaxError(representativeErr)
          ) {
            throw representativeErr;
          }
          if (representativeRow) {
            const row = representativeRow as unknown as RepresentativeRow;
            const raw = representativeRow as Record<string, unknown>;
            const firstName = pickString(raw, ["first_name", "firstname", "prenom", "firstName"]);
            const lastName = pickString(raw, ["last_name", "lastname", "nom", "lastName"]);
            const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
            const fallbackName = pickString(raw, ["name", "full_name", "display_name", "label"]);
            representative = {
              id: String(row.id),
              name: fullName || fallbackName || null,
              email: pickString(raw, ["email", "mail"]),
              phone: pickString(raw, ["phone", "telephone", "mobile", "tel"]),
            };
          }
        }
        company = {
          id: String(companyRowTyped.id),
          name: companyRowTyped.name ?? null,
          entity: companyRowTyped.entity ?? null,
          address: companyRowTyped.address ?? null,
          town: companyRowTyped.town ?? null,
          state: companyRowTyped.state ?? null,
          country_code: companyRowTyped.country_code ?? null,
          email: companyRowTyped.email ?? null,
          phone: companyRowTyped.phone ?? null,
          representative,
        };
      }
    }

    const pointsRaw = emailRowTyped.email_brouillon_points_cles;
    const points = Array.isArray(pointsRaw) && pointsRaw.every((x) => typeof x === "string") ? pointsRaw : [];

    return NextResponse.json({
      id: String(emailRowTyped.id ?? id),
      date_generation: emailRowTyped.sent_to_batibarr_date ?? null,
      email_brouillon_sujet: emailRowTyped.email_brouillon_sujet ?? null,
      email_brouillon_corps: emailRowTyped.email_brouillon_corps ?? null,
      email_brouillon_points_cles: points,
      descriptif: emailRowTyped.descriptif ?? null,
      marches: emailRowTyped.marches ?? null,
      concurrents: emailRowTyped.concurrents ?? null,
      actualites: emailRowTyped.actualites ?? null,
      salons: emailRowTyped.salons ?? null,
      company,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

