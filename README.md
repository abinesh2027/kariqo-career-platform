# Kariqo — Brain Strom

Kariqo is a Supabase-backed student workspace. It uses Supabase Auth for accounts, PostgreSQL with row-level security for private progress, and Supabase Storage for profile photos. It does not provide sample accounts or fake dashboard records.

## Use the app

Open the live app at https://classy-kelpie-cf9faf.netlify.app/ and create an account or sign in. The macOS wrapper opens the same hosted app and needs an internet connection. Its sign-in session is separate from a browser session, so sign in once in the Mac app too.

## Develop from source

Requirements: Node.js 20.19+ (or 22.12+) and npm.

1. Copy `.env.example` to `.env.local` and fill in the Supabase project URL, publishable key, and Edge Function URL.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.
4. Build the production bundle with `npm run build`.

## Supabase setup

The project `qszldlumbgjjajkndtpy` has been created in the Brain Strom free organization, in South Asia (Mumbai). Its database schema, RLS policies, private `avatars` bucket, authenticated-user grants, and new-account profile trigger have been applied.

For a fresh Supabase project, run the SQL migrations in `supabase/migrations/` in order using the Supabase Dashboard SQL Editor. The migration creates owner-scoped tables for profiles, preferences, skills, projects, roadmaps, notifications, and support messages. Published opportunity, mentor, class, and announcement catalogs are readable by signed-in users; the Brain Strom team controls catalog publishing.

The `skill-roadmap` Edge Function is deployed at the configured project URL and uses Google Gemini. Add a `GEMINI_API_KEY` secret in Supabase Dashboard → Edge Functions → Secrets to enable AI roadmap generation. Keep that secret server-side; never place it in a `VITE_` variable. Without the secret, the function returns an explicit configuration error instead of generating sample content. Create the key in Google AI Studio.

## Mentor and Live Classes membership

Mentor Connect and Live Classes are gated by a verified Razorpay subscription: **₹199 INR per month**. The app checks the `memberships` table, opens Razorpay's hosted checkout, and unlocks access only after server-side status verification. Razorpay plans are created separately in the Razorpay Dashboard; the checkout function refuses plans that do not match ₹199/month. Subscriptions are configured for up to 100 billing cycles.

For the current Kariqo Supabase project, the membership table and these three Edge Functions are deployed: `create-membership-subscription`, `membership-status`, and `razorpay-membership-webhook`. The webhook verifies Razorpay's HMAC signature. The Razorpay merchant account is still waiting for video KYC, so checkout is not live yet. After account activation, create a Razorpay plan for ₹199 INR monthly and set these secrets under Supabase Dashboard → Edge Functions → Secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the Razorpay webhook URL as `https://qszldlumbgjjajkndtpy.supabase.co/functions/v1/razorpay-membership-webhook` and subscribe to the `subscription.*` lifecycle events. Test with Razorpay Test Mode credentials before switching to live credentials. The API key secret and webhook secret stay server-side and must never be put in the app or `.env` file.

For a fresh Supabase project, apply `supabase/migrations/202609240001_memberships.sql` and deploy the same three functions, including `_shared/membership.ts`.

## Owner management dashboard

Open the app with `?portal=owner` to reach the owner sign-in screen. Owner accounts are deliberately not self-service: apply `supabase/migrations/202609250002_owner_dashboard.sql`, then add the approved Supabase Auth user's UUID to `public.skillora_owner_accounts` using a trusted SQL Editor session. The owner-only `owner-dashboard` Edge Function reads subscription records and reports whether the Razorpay secrets are present; it never returns secret values. The client cannot assign itself owner access.

## ATS resume and company portal

Apply `supabase/migrations/202609250003_recruiter_portal.sql` and deploy the `company-dashboard` and updated `owner-dashboard` Edge Functions. The Skill Passport unlocks its ATS-friendly plain-text resume only after the student has a saved roadmap, a completed project, and confirms study and interview readiness. Students must separately opt in to share their profile and resume with approved companies; they can turn sharing off at any time. Employers only see opted-in candidates with a 50% or higher exact skill-name match for one of their open jobs. Offers appear in the student's Job Offers page.

Company access is approved and provisioned by Kariqo management. Create a company and connect its approved Supabase Auth user in SQL Editor:

```sql
insert into public.skillora_companies (name) values ('Example Company') returning id;
-- Use the returned company id and the employer's existing Supabase Auth user UUID:
insert into public.skillora_company_accounts (user_id, company_id, approved)
values ('EMPLOYER_AUTH_USER_UUID', 'COMPANY_UUID', true);
```

Company Pro recurring billing is also implemented. Create a Razorpay monthly plan for **₹2,499 INR**, then set its ID as `RAZORPAY_COMPANY_PLAN_ID` in Supabase Edge Function Secrets. Both student and company plans use the shared `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the webhook at `https://qszldlumbgjjajkndtpy.supabase.co/functions/v1/razorpay-membership-webhook` for `subscription.*` events. Use Test Mode keys and plan IDs first; use Live Mode only after Razorpay merchant activation/KYC. Never place secrets in the browser app, source control, or chat.

Employers sign in at `?portal=company`. Student accounts cannot use the company portal unless the owner provisions and approves them.

The current app build and native bundle include this dashboard. Owner access still requires a deliberate account grant in Supabase before the dashboard can show private management data.

The app project's existing catalog currently has no mentor, class, or opportunity rows. After a subscription is active, those pages still need real entries published by the Brain Strom team.

## Data behavior

Student pages read and write the signed-in user’s records under RLS. Public catalog pages show empty states until the Brain Strom team publishes real content. Profile photos upload to the private `avatars` bucket. Notifications are account-scoped; catalog or account events can populate them through trusted server-side logic.
