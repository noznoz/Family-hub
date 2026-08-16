# Family Hub

A private, mobile-first **Progressive Web App** that helps one family manage the
complete UK university journey of twin sons **Hamza** and **Omar** — from
preparation and arrival, through every academic year, to graduation.

> **Simple. Private. Family-focused. Mobile-first. Long-term.**
> Common actions should take no more than 2–3 taps.

Family Hub is a **completely independent product** — its own repository, Supabase
project, database, storage, authentication, and Vercel deployment. It shares
nothing with any other application.

---

## Contents

- [Product](#product)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Local setup](#local-setup)
- [Supabase setup](#supabase-setup)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Seed data](#seed-data)
- [PWA configuration](#pwa-configuration)
- [Install on iPhone](#install-on-iphone)
- [Install on Android](#install-on-android)
- [Vercel deployment](#vercel-deployment)
- [Custom domain](#custom-domain)
- [Security architecture](#security-architecture)
- [Row Level Security](#row-level-security)
- [Testing](#testing)
- [Build phases](#build-phases)

---

## Product

Family Hub is organised around three time horizons:

| Horizon | Question it answers |
| --- | --- |
| **Today** | What needs attention? |
| **This academic year** | How are Hamza and Omar doing this year? |
| **Entire journey** | What has happened since they started university? |

Core modules: Home (parent & student dashboards), Family Chat, Tasks, Money
(budgets, expenses, funding, payment requests), Documents, Travel, Accommodation,
University, Scholarship, Support (recipes/laundry/home basics), Calendar and
Notifications.

**Key domain rules**

- **Relationship ≠ role.** A person's family relationship (Dad, Mom, Step Mom,
  Sister…) is separate from their authorization role (`admin`, `parent`,
  `student`, `family_member`).
- **Funding is a first-class, historical entity.** Omar starts *Family Funded*;
  when he later moves to a *Government Scholarship*, a **new funding period** is
  created — the old one is never overwritten.
- **Nothing meaningful is deleted.** Academic years, tasks, expenses, trips,
  documents, and milestones are preserved for the whole journey, including after
  **graduation** (students become `Graduated`, not removed).
- **Students never automatically see another student's private finances.**

---

## Technology stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript (strict)**
- **Tailwind CSS** with a custom design system + shadcn-style UI primitives
- **Supabase** — PostgreSQL, Auth, Realtime, Storage
- **Vercel** for hosting
- PWA: Web App Manifest + custom Service Worker (hybrid offline model)

---

## Architecture

- **Server Components** fetch data through the Supabase server client; every
  read is constrained by **Row Level Security**.
- **Client Components** handle realtime and interactive surfaces (chat, forms,
  the future voice recorder).
- **Permissions** are resolved as `role default` overlaid by per-member
  overrides, mirrored in both the database (`has_perm()`) and the app
  (`src/lib/permissions.ts`).
- **Graceful demo mode.** When Supabase env vars are absent the app renders a
  fully browsable experience from `src/lib/demo-data.ts` and a cookie-based
  "who are you?" picker, so the UI can be reviewed before a backend exists.

---

## Folder structure

```
family-hub-pwa/
├── public/
│   ├── manifest.webmanifest      # PWA manifest
│   ├── sw.js                     # service worker (app-shell + safe hybrid cache)
│   └── icons/                    # generated PWA/Apple/maskable icons + source SVGs
├── scripts/
│   └── generate-icons.mjs        # rasterizes icon.svg → all PNG sizes (sharp)
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql       # all tables, enums, indexes, triggers
│   │   ├── 0002_rls.sql          # RLS helpers + policies (mandatory)
│   │   └── 0003_reference_and_auth.sql  # roles/permissions, auth trigger, storage
│   ├── seed.sql                  # removable dev seed data (one family id)
│   └── seed_teardown.sql         # deletes all seed data in one statement
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # demo picker + real Supabase sign-in
│   │   ├── (app)/                # authed shell: home, chat, tasks, money, more, …
│   │   ├── offline/              # offline fallback page
│   │   ├── layout.tsx            # metadata, PWA registration
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # Button, Card, Chip, Avatar, Input, …
│   │   ├── nav/                  # bottom nav (mobile) + sidebar (desktop)
│   │   ├── home/ chat/ tasks/ money/   # feature components
│   │   ├── brand/app-logo.tsx
│   │   └── pwa/                  # register + offline indicator
│   ├── lib/
│   │   ├── supabase/             # browser / server / middleware clients
│   │   ├── env.ts                # zod-validated environment
│   │   ├── permissions.ts        # roles + granular permissions
│   │   ├── session.ts            # current-member resolution
│   │   ├── types.ts  utils.ts  demo-data.ts
│   └── middleware.ts             # session refresh + auth gating
└── ...config (tsconfig, tailwind, eslint, prettier, next)
```

---

## Local setup

```bash
npm install
cp .env.example .env.local     # fill in your own Supabase values (optional for demo)
npm run dev                    # http://localhost:3000
```

Without Supabase configured the app runs in **demo mode** — pick a family member
on the login screen to explore.

Useful scripts:

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint
npm run icons       # regenerate PWA icons from public/icons/icon.svg
```

---

## Supabase setup

1. Create a **new, independent** Supabase project (do not reuse another
   project's URL or keys).
2. In the SQL editor, run the migrations in order:
   `0001_schema.sql`, `0002_rls.sql`, `0003_reference_and_auth.sql`.
   (`0003` also creates the private `documents` and `media` storage buckets.)
3. Optionally run `supabase/seed.sql` for development data.
4. Create auth users (email/password) for each real family member, then link
   them to their seeded member rows:

   ```sql
   update public.family_members fm
      set profile_id = u.id
     from auth.users u
    where u.email = fm.invite_email and fm.profile_id is null;
   ```

If you use the Supabase CLI, the `supabase/migrations` folder is CLI-compatible
(`supabase db push`).

---

## Environment variables

See `.env.example`. All production values are configurable — nothing is
hard-coded.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | App URL (dev/prod) |
| `NEXT_PUBLIC_PRODUCTION_DOMAIN` | Custom domain used in metadata (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — admin/seed operations |
| `NEXT_PUBLIC_SUPABASE_DOCS_BUCKET` | Documents bucket name |
| `NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET` | Media bucket name |

Secrets are never committed (`.env*` is git-ignored).

---

## Database migrations

`supabase/migrations` defines a normalized schema with **UUID primary keys**,
foreign keys, constraints, indexes, and `created_at` / `updated_at` /
`created_by` columns. Highlights:

- Identity & permissions: `families`, `profiles`, `family_members`,
  `family_relationships`, `roles`, `permissions`, `role_permissions`,
  `member_permissions`.
- Students & journey: `student_profiles`, `academic_years`, `academic_terms`,
  `student_milestones`, `universities`.
- Funding: `funding_sources` (historical periods), `scholarships`,
  `scholarship_requirements`.
- Work & chat: `tasks`, `task_comments`, `task_recurrences`, `conversations`,
  `conversation_members`, `messages`, `message_attachments/reactions/reads`.
- Money: `budgets`, `expenses`, `payment_requests`.
- Vault: `documents`, `document_versions`, `document_shares`.
- Logistics: `trips`, `trip_members`, `flights`, `accommodations`,
  `accommodation_photos`, `calendar_events`.
- Support: `support_categories/guides/steps/media/audio`, `recipes`,
  `recipe_ingredients/steps/media/favorites`.
- `notifications`, `notification_preferences`, `audit_logs`.

---

## Seed data

`supabase/seed.sql` seeds one demo family (Dad, Mom, Sister, Step Mom, Step Dad,
Hamza, Omar) plus a university, funding sources (Hamza *Government Scholarship*,
Omar *Family Funded*), tasks, messages, expenses, a payment request, documents,
a trip, an accommodation, a laundry guide, a recipe (with voice-note placeholder
metadata), notifications and calendar events.

Remove it all at any time:

```sql
\i supabase/seed_teardown.sql   -- deletes the demo family (cascades)
```

---

## PWA configuration

- `public/manifest.webmanifest` — standalone display, theme color `#0F2A4A`,
  app shortcuts, and icon set including **maskable** (Android) icons.
- `public/sw.js` — network-first navigations with an **offline fallback**, and
  stale-while-revalidate for static assets. **Sensitive traffic (Supabase, API,
  auth) is never cached**, so dangerous stale offline writes are prevented.
- Icons are generated from `public/icons/icon.svg` (deep-navy rounded square with
  a white home + family + graduation-cap mark and a subtle UK-colored accent).
  Regenerate with `npm run icons`.

The service worker only registers in production builds.

## Install on iPhone

Open the site in **Safari** → Share → **Add to Home Screen**. Launches
standalone with the Family Hub icon and respects safe areas (notch / home
indicator).

## Install on Android

Open in **Chrome** → menu → **Install app / Add to Home screen**. Uses the
maskable icon and standalone display.

---

## Vercel deployment

1. Import the repository into a **new** Vercel project.
2. Add the environment variables above (Production + Preview).
3. Deploy. Vercel provides a temporary `*.vercel.app` domain for development.

## Custom domain

Add your domain in Vercel → **Domains**, then set
`NEXT_PUBLIC_PRODUCTION_DOMAIN` and `NEXT_PUBLIC_APP_URL` to it and update your
Supabase Auth redirect URLs. No code changes required.

---

## Security architecture

- **Supabase Auth** for sign-in; sessions refreshed in `middleware.ts`.
- **Row Level Security** on every table (see below).
- **Private storage** buckets with family-scoped policies; files delivered via
  **signed URLs**.
- **Server-side authorization** for reads/writes; permissions mirrored in the app.
- **Audit logs** (`audit_logs`) for sensitive actions: payment approval, funding
  changes, permission changes, document deletion, scholarship changes, and member
  access changes.
- Input/upload validation and size limits are enforced at the write layer.
- **Secrets are never committed.**

## Row Level Security

RLS is **mandatory** — no permissive development policies ship. Policies are
defined in `0002_rls.sql` using `SECURITY DEFINER` helpers:

- `is_family_member(family)` — user belongs to the family.
- `is_parent_admin(family)` — user is a parent/admin.
- `has_perm(family, permission)` — resolves per-member override, else role default.
- `owns_student(student)` — the current user *is* that student.
- `in_conversation(conversation)` — conversation membership gate for chat.

Guarantees enforced by policy:

- Users only access families they belong to.
- Chat requires conversation membership.
- **Students cannot see another student's private financial records.**
- Finances require `view_/manage_student_finances`; approvals require
  `approve_payment_requests`.
- Private documents follow their `visibility` setting.
- Admin functions require admin/`manage_*` permissions.
- **Storage policies mirror database permissions.**

---

## Testing

Critical flows to verify (login, role authorization, permissions, send message,
create/complete task, message→task, create expense, payment request + approval,
document upload/visibility, create trip, funding history, open recipe, laundry
guide) plus responsive layouts (iPhone/Android/tablet/desktop), PWA
installability, offline states, and RLS.

Baseline checks:

```bash
npm run typecheck && npm run lint && npm run build
```

---

## Build phases

Delivered in the standard order — **Phase 1 (Foundation)** and the **first
vertical slice** (Login → Home → Chat → Tasks → Money) are complete: independent
repo, design system + UI primitives, Supabase clients, env validation, full
schema + RLS + seed, PWA (manifest, service worker, iOS/Android icons),
navigation, and role-based dashboards.

Later phases (Documents, Travel/Accommodation, University/Scholarship, Support
with recipe images + voice notes, Calendar/Notifications, and production
hardening) build on this foundation; their modules are scaffolded with clear
planned-capability screens.

After every phase: typecheck → lint → build → run → fix → check responsiveness →
check permissions → commit a clean checkpoint.
