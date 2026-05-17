# Deploying FINMIND AI

You picked the **GitHub-import deploy** path: push this folder to a GitHub repo, then let Vercel import and auto-deploy on every commit. End-to-end this takes about 5 minutes.

## What's already done

✅ Supabase project `finmind-ai` (ap-south-1) is live, schema + RPCs applied.
✅ App code is in this folder.
✅ `.env.production` is committed with the publishable Supabase keys (safe — they're public by design).
✅ `.gitignore` excludes `node_modules`, `.next`, `.vercel`, and local `.env*.local`.

## Step 1 — Create a GitHub repo

Either via CLI:
```bash
cd "C:\Users\BI620799\OneDrive - Edme Insurance Brokers Ltd\Documents\Claude\Projects\FinmindAI"
gh repo create finmind-ai --private --source=. --remote=origin
```
Or in the GitHub web UI: New repo → name it `finmind-ai`, leave it empty (no README/license/.gitignore). Then locally:
```bash
cd "C:\Users\BI620799\OneDrive - Edme Insurance Brokers Ltd\Documents\Claude\Projects\FinmindAI"
git init
git add .
git commit -m "FINMIND AI v1 — initial scaffold"
git branch -M main
git remote add origin git@github.com:<your-username>/finmind-ai.git
git push -u origin main
```

## Step 2 — Import in Vercel

1. Go to https://vercel.com/new
2. Pick the `finmind-ai` repo (you may need to grant access).
3. Framework: **Next.js** is auto-detected.
4. Root directory: **leave as `./`**.
5. Build command: leave default (`next build`).
6. Output directory: leave default.
7. **Environment Variables** — add these (the public ones are in `.env.production`, but Vercel UI overrides take precedence):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://gdtqujtdsdmvvtnxjdks.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_FB_WD-hkoj4vLQEnLzAP8g_H5fb3ZB0`
   - `SUPABASE_SERVICE_ROLE_KEY` = *(Supabase Dashboard → Settings → API → `service_role` key — NEVER expose in NEXT_PUBLIC_*)*. Required for the admin "Create user directly" flow.
   - `RESEND_API_KEY` = *(from https://resend.com → API Keys)*. Enables auto-email of temp passwords to newly created users. If omitted, the admin UI falls back to showing the password on-screen for manual sharing.
   - `EMAIL_FROM` = `FINMIND AI <noreply@yourdomain.com>` *(must be a Resend-verified sender domain — see https://resend.com/domains. While testing you can use `onboarding@resend.dev`.)*
   - `APP_URL` = `https://your-deployment.vercel.app` *(optional — used as the login link in the welcome email; otherwise inferred from request origin.)*
8. Click **Deploy**.

The first build takes ~90 seconds. You'll get a URL like `https://finmind-ai-xxx.vercel.app`.

## Step 3 — Configure Supabase Auth callback

In your Supabase dashboard (https://supabase.com/dashboard/project/gdtqujtdsdmvvtnxjdks/auth/url-configuration):

- **Site URL**: `https://finmind-ai.vercel.app` (or whatever your Vercel domain is)
- **Redirect URLs** — add: `https://finmind-ai.vercel.app/auth/callback`
- Also keep `http://localhost:3000/**` for local dev.

For the fastest first-run experience:
- Authentication → Providers → Email → **disable "Confirm email"** (so signups don't need to click a confirmation link). You can re-enable it once you're ready for production.

## Step 4 — First sign-in

1. Open your Vercel URL.
2. Click **Create one** on the login page.
3. Fill in name + email + password (min 8 chars). You're routed to onboarding.
4. Confirm `Edme Insurance Brokers Limited` as the org name and click **Create my workspace**.
5. The onboarding flow auto-creates 12 fiscal periods, your starter Chart of Accounts (18 accounts), and 5 verticals (Corporate / SME / Health / Retail / Motor).
6. You land on the dashboard. It's empty — no entries yet.

## Step 5 — Optional demo data

To populate Dashboard / P&L / Variance with realistic numbers immediately:

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/gdtqujtdsdmvvtnxjdks/sql/new
2. Paste the contents of `supabase/seed/demo_seed.sql`
3. Run it. It seeds an AOP budget plus 6 months of posted journal entries against your most-recently-created org (yours).
4. Refresh the dashboard — KPIs, monthly chart, P&L, and Variance now show real numbers.

## Future deploys

Just `git push`. Vercel rebuilds and ships in ~90s. Each PR gets a preview URL automatically.

## Troubleshooting

**"Can't reach Supabase" / 401 errors**
Env vars not set on Vercel. Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present and redeploy.

**Middleware 500 error**
Check the Function logs in Vercel. Most often a missing env var or stale cookies — clear browser cookies for the domain and try again.

**"Invalid login credentials" on first signup**
Email confirmation is enabled in Supabase. Either disable it (Step 3) or check your inbox for the confirmation email.

**"new row violates row-level security policy" on workspace creation**
The user finished signup but no `org_members` row was inserted. The onboarding page handles this; if you skipped it, run this SQL substituting your auth user id:
```sql
insert into org_members (org_id, user_id, role)
values ('<org_id>', '<auth_user_id>', 'owner');
```

**Tables exist but Dashboard says "No data"**
You haven't posted any journal entries yet (drafts don't count). Either create one in `/journal-entries/new` or run the demo seed.
