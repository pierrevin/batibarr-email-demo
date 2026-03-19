import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDemoToken } from "../../_utils/requireDemoToken";

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
  email_brouillon_corps: string | null;
  email_brouillon_points_cles: unknown;
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

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = requireDemoToken(req);
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: emailRow, error: emailErr } = await supabase
      .schema("preprod")
      .from("batibarr_clients_ia")
      .select("id_tiers, date_generation, email_brouillon_sujet, email_brouillon_corps, email_brouillon_points_cles")
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
      const { data: companyRow, error: companyErr } = await supabase
        .from("batibarr_clients")
        .select("id, name, entity, address, town, state, country_code, email, phone")
        .eq("id", idTiers)
        .maybeSingle();

      if (companyErr) throw companyErr;
      if (companyRow) {
        const companyRowTyped = companyRow as unknown as CompanyRow;
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
        };
      }
    }

    const pointsRaw = emailRowTyped.email_brouillon_points_cles;
    const points = Array.isArray(pointsRaw) && pointsRaw.every((x) => typeof x === "string") ? pointsRaw : [];

    return NextResponse.json({
      id: String(emailRowTyped.id ?? id),
      date_generation: emailRowTyped.date_generation ?? null,
      email_brouillon_sujet: emailRowTyped.email_brouillon_sujet ?? null,
      email_brouillon_corps: emailRowTyped.email_brouillon_corps ?? null,
      email_brouillon_points_cles: points,
      company,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

