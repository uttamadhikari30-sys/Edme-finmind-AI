# FINMIND AI — Edme MIS Platform

A production-ready SaaS scaffold for **Edme Insurance Brokers Limited's** financial intelligence platform. Built on Next.js 14 (App Router), Supabase (Auth + Postgres with RLS), and Tailwind CSS — with the brand and visual language taken from the v12 concept.

## What's inside

- **Multi-tenant** auth + workspace model. Each user belongs to one or more `organizations`, scoped by Postgres RLS.
- **Financial accounting core**: chart of accounts, fiscal periods, journal entries with debit/credit lines, balanced-entry validation, posting workflow.
- **Reports** generated from posted entries via Postgres RPCs:
  - **Dashboard** (period KPIs, monthly trend chart, AI insights stub)
  - **P&L Statement** (period-scoped, by account)
  - **Balance Sheet** (cumulative as-of any date)
  - **Variance Analysis** (actual vs. budget, by revenue/expense account)
- **Operations**: Journal Entries CRUD + posting, Reconciliation list, Chart of Accounts grouped by type, Settings.
- **Auth**: email + password via Supabase Auth, signup creates a workspace seeded with 12 fiscal periods + COA + verticals.
- **Brand**: navy (#1C3687), red (#ED1B2F), gold (#C8952A), green (#00a878). Cormorant Garamond for display, DM Sans for UI, JetBrains Mono for numerals.

## Project structure

```
finmind-ai/
├── app/
│   ├── (auth)/login, signup, callback     ← email+password
│   ├── (app)/dashboard, pl, balance-sheet, journal-entries,
│   │         reconciliation, variance, chart-of-accounts, settings
│   ├── onboarding/                        ← creates org + seeds COA on first login
│   ├── globals.css                        ← FINMIND tokens & utility classes
│   ├── layout.tsx                         ← root with fonts
│   └── page.tsx                           ← redirects authed → /dashboard, else → /login
├── components/
│   ├── shell/sidebar, header, org-context
│   ├── ui/card, page-header, empty-state, period-selector
│   ├── kpi/kpi-card
│   ├── charts/monthly-pl-chart            ← Recharts ComposedChart
│   └── journal/journal-entry-form, post-button
├── lib/
│   ├── supabase/client, server, middleware
│   ├── auth.ts, types.ts, utils.ts
├── supabase/
│   ├── migrations/                        ← already applied to your project
│   └── seed/demo_seed.sql                 ← run after first signup for demo data
├── middleware.ts                          ← session refresh + auth gate
├── tailwind.config.ts
├── next.config.js
├── vercel.json
└── package.json
```

## Local development

```bash
npm install
cp .env.example .env.local   # already pre-filled with your Supabase project
npm run dev
```

Open http://localhost:3000. Create an account, complete the workspace setup wizard, and you're in.

## Database

The schema and RPCs have already been applied to your Supabase project (`finmind-ai` in `ap-south-1`). To replay or extend, the SQL is in this conversation's transcript and can be re-applied via the Supabase dashboard SQL editor.

### To populate demo data

Once you've signed up and completed onboarding, open Supabase SQL Editor and run `supabase/seed/demo_seed.sql`. It seeds an AOP budget plus 6 months of posted journal entries against the most recently created org so the dashboard, P&L, and variance pages show real numbers.

## Deployment

**Environment variables** (set in Vercel project settings):
- `NEXT_PUBLIC_SUPABASE_URL` = `https://gdtqujtdsdmvvtnxjdks.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_FB_WD-hkoj4vLQEnLzAP8g_H5fb3ZB0`

**Vercel:**
```bash
npx vercel --prod
```
or push the repo to GitHub and import in the Vercel dashboard.

**Supabase Auth — important:**
- In Supabase Dashboard → Authentication → URL Configuration, add your Vercel domain (e.g. `https://finmind-ai.vercel.app`) to **Site URL** and **Redirect URLs** so email confirmations and magic links land in the right place.
- For development, you can disable email confirmation under Authentication → Providers → Email so signups go straight in.

## Brand tokens

Pulled from `FINMIND_AI_v12_final.html`:

| Token | Value |
|---|---|
| Primary navy | `#1C3687` |
| Brand red | `#ED1B2F` |
| Edme gold | `#C8952A` |
| Success green | `#00a878` |
| Display font | Cormorant Garamond |
| UI font | DM Sans |
| Mono font | JetBrains Mono |

The wordmark is rendered as **FINMIND <span style="color:#ED1B2F">AI</span>** — no logo image required. Drop a real SVG into `public/logo.svg` to replace it.

## Roadmap (mapped from your v12 concept)

The current build covers the four modules you prioritised. The remaining v12 modules can layer on top of this foundation without schema changes:

- **Month-on-Month P&L** — already supported by `fn_monthly_pl`; just needs a UI.
- **LE & Forecast** — mirror the `budgets` table as `forecasts`, reuse variance UI.
- **Vertical Performance** — group `journal_entry_lines.business_unit_id`.
- **Variable Pay (VPB)** — calculator over revenue × tier × incentive.
- **Insurance Market** — content/news module, no schema changes needed.
- **Cash Flow Statement** — derived from balance changes; add `fn_cash_flow` RPC.
- **Board Reports** — composed of the existing P&L, Balance Sheet, and Variance views.
- **Maya AI** — wire the chip in the header to an Anthropic/OpenAI endpoint with read-only Supabase queries.

## Security

- Postgres RLS is on for every table. The `user_org_ids()` SECURITY DEFINER function is the single source of truth for tenant scoping.
- Journal-entry posting goes through `fn_post_journal_entry`, which verifies tenant access and that debits = credits.
- The middleware refreshes Supabase sessions and redirects unauthenticated users away from app routes.
- Service-role keys are **never** exposed to the client; only the publishable anon key.
