# Batibarr - Emails IA (démo)

Mini application Next.js pour afficher les emails générés et les infos de la société ciblée.

## Déploiement rapide / prérequis

1. Créez les variables d’environnement (serveur uniquement) :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEMO_EMAIL`
   - `DEMO_PASSWORD_HASH`
   - `DEMO_SESSION_SECRET` (optionnel mais recommandé)

2. Vérifiez que :
   - `preprod.batibarr_client_ia` contient les champs utilisés (`email_brouillon_sujet`, `email_brouillon_corps`, `email_brouillon_points_cles`, `date_generation`, `id_tiers`, `campagne_id`)
   - `preprod.batibarr_clients` contient au moins `id`, `name`, `entity`, `address`, `town`, `state`, `country_code`, `email`, `phone`

## Lancer en local

```bash
cp .env.example .env.local
npm run dev
```

Puis ouvrez : `http://localhost:3000`

La page demandera un `email + mot de passe` de démonstration.

## Déploiement Vercel

Importez le dossier `email-demo` dans Vercel et configurez les mêmes variables d’environnement :
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_EMAIL`, `DEMO_PASSWORD_HASH`, `DEMO_SESSION_SECRET`.

