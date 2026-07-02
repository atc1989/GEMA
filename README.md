This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment

Create a `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Secret used to sign/verify registration QR tokens (>=16 chars). Required in
# production; a dev fallback is used when unset in development.
QR_SIGNING_SECRET=<random-long-secret>

# Service-role key (Supabase dashboard → Settings → API). Server-only; used to
# create an auth account when converting a prospect into a member. Never expose.
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# One Grinders Guild server-to-server login verification. Server-only; never
# expose this key to browser code.
ONEGRINDERS_API_KEY=<api-key-with-users.login-scope>
# Optional override; defaults to the production endpoint from the API guide.
ONEGRINDERS_LOGIN_URL=https://onegrindersguild.ph/api/v1/auth/login.php
```

Apply these SQL files once (after `schema.sql`), in the Supabase SQL editor:
- `supabase/qr_attendance.sql` — `record_attendance` routine for the scanner.
- `supabase/prospect_registration.sql` — public prospect registration +
  referral resolution routines used by `/invite/[eventId]` and `/register/[eventId]`.
- `supabase/member_onboarding.sql` — `onboard_member` routine that lets a signed-in
  user activate a member account (used by `/onboarding` and the member dashboard).
- `supabase/referrals_rls_fix.sql` — adds the missing INSERT/UPDATE policies on
  `referrals` (the existing-project migration only shipped a SELECT policy), so
  members can create referral links from `/member/referrals`.
- `supabase/commissions.sql` — builds/maintains the genealogy closure table,
  recreates `onboard_member` to link genealogy, and adds
  `convert_prospect_to_member` + multi-level commission generation. Powers
  `/admin/prospects`, `/admin/commissions`, and `/member/earnings`.

Auth uses cookie-based sessions via `@supabase/ssr`; `src/middleware.ts` refreshes
the session and gates `/admin/*` (unauthenticated users are redirected to `/login`).

### Admin access

The admin workspace requires a Supabase Auth user whose `public.profiles` row has
`is_admin = true` (or `role = 'admin'`) — this is what RLS's `is_admin()` checks.
After creating the auth user, ensure a matching profile exists, e.g.:

```sql
insert into public.profiles (id, email, full_name, role, is_admin)
values ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin', true)
on conflict (id) do update set role = 'admin', is_admin = true;
```

Then sign in at `/login` and manage events at `/admin/events`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
