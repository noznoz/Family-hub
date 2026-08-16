# Family Hub — Go‑Live Guide

This takes Family Hub from the repo to a **live, installable PWA** on your own
independent Supabase + Vercel accounts. It shares nothing with any other project.

Estimated time: **~15 minutes.**

---

## 0. Prerequisites

- A GitHub account with this repository (`noznoz/Family-hub`).
- A [Supabase](https://supabase.com) account (free tier is fine).
- A [Vercel](https://vercel.com) account (free tier is fine).

---

## 1. Create the Supabase project (backend)

1. In Supabase, **New project** → name it `family-hub` → choose a region close to
   the UK (e.g. London / `eu-west-2`) → set a strong database password.
2. Wait for it to provision (~2 min).

### 1a. Create the database

- Open **SQL Editor** → **New query**.
- Paste the entire contents of [`supabase/all_in_one.sql`](supabase/all_in_one.sql)
  and **Run**. This creates every table, all Row Level Security policies, the
  roles/permissions reference data, the auth trigger, and the private storage
  buckets (`documents`, `media`).
- *(Optional, recommended for first look)* Run
  [`supabase/seed.sql`](supabase/seed.sql) to load the demo family, students,
  funding, tasks, expenses, etc. Remove later with `supabase/seed_teardown.sql`.

### 1b. Grab your keys

- **Project Settings → API**:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` *(server‑only; never exposed)*

### 1c. Configure Auth

- **Authentication → Providers → Email**: enable Email/Password.
- **Authentication → URL Configuration**: set **Site URL** to your Vercel URL
  (fill in after step 2) and add it to **Redirect URLs**.

---

## 2. Deploy to Vercel (frontend)

1. Vercel → **Add New → Project** → import `noznoz/Family-hub`.
2. Framework preset: **Next.js** (auto‑detected). No build overrides needed.
3. **Environment Variables** (Production **and** Preview):

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL (e.g. `https://family-hub.vercel.app`) |
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1b |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1b |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1b |
   | `NEXT_PUBLIC_PRODUCTION_DOMAIN` | *(optional)* your custom domain later |

4. **Deploy.** Vercel gives you a temporary `*.vercel.app` URL.
5. Go back to Supabase **Auth → URL Configuration** and set **Site URL** +
   **Redirect URLs** to that Vercel URL.

> Once `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present,
> the app automatically switches from **demo mode** to **live mode** (real
> sign‑in, RLS‑protected data, persistence).

---

## 3. Create the family accounts

For each real family member:

1. Supabase **Authentication → Users → Add user** → email + password (or invite).
2. The `profiles` row is created automatically by the `handle_new_user` trigger.
3. **Link the auth user to their family member row.** If you loaded the seed,
   run this once in the SQL Editor (it matches by the seeded `invite_email`):

   ```sql
   update public.family_members fm
      set profile_id = u.id
     from auth.users u
    where u.email = fm.invite_email and fm.profile_id is null;
   ```

   For members you add later from inside the app, set `profile_id` the same way,
   or accept the invite flow.

4. Sign in at your Vercel URL. Dad/Admin lands on the parent dashboard; Hamza and
   Omar each get their student dashboard.

---

## 4. Install on phones

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu → **Install app**.

Launches standalone with the Family Hub icon.

---

## 5. Custom domain (optional, later)

1. Vercel → **Project → Domains** → add your domain and follow DNS steps.
2. Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PRODUCTION_DOMAIN` to the domain.
3. Update Supabase **Auth → URL Configuration** to the domain.
4. Redeploy.

No code changes are required — everything is environment‑driven.

---

## Security checklist (already enforced)

- ✅ Row Level Security on every table; no permissive dev policies.
- ✅ Students cannot see another student's private finances.
- ✅ Private storage buckets; access mirrors DB permissions.
- ✅ Audit logs on member/role/permission changes (and other sensitive actions).
- ✅ Secrets only in Vercel env vars — never committed.
- ✅ Service‑role key is server‑only.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Still shows "Demo mode" on login | `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` missing in Vercel — add and redeploy. |
| Signed in but "profile isn't set up" | Link the auth user to a `family_members` row (step 3). |
| Redirect loop after login | Supabase **Site URL** / **Redirect URLs** don't match the Vercel URL. |
| Can't see finances as a parent | Enable the finance permissions for that member (Family → member → permissions). |
