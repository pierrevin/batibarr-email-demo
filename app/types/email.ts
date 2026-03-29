export type Company = {
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

export type EmailListItem = {
  id: string;
  date_generation: string | null;
  id_tiers: string | null;
  email_brouillon_sujet: string | null;
  company: Company;
};

export type EmailDetail = {
  id: string;
  date_generation: string | null;
  email_brouillon_sujet: string | null;
  email_brouillon_corps: string | null;
  email_brouillon_points_cles: string[];
  descriptif: string | null;
  marches: string | null;
  concurrents: string | null;
  actualites: string | null;
  salons: string | null;
  company: Company;
};
