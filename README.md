# Tennis Social

Responsive bilingual tennis session booking community demo for London.

## Included

- English by default with a Simplified Chinese switch.
- Desktop and mobile layouts with real venue photos.
- Session browsing, detail pages, participant levels, friend bookings and racket rental.
- Stripe Checkout handoff with server-side pricing, 30-minute reservations and webhook confirmation.
- Payment confirmation emails sent through Resend with booking details and an attached `.ics` calendar invite.
- Shared demo sessions, bookings and venues backed by Neon Postgres, with a protected admin at `/admin` for session editing, venue/image management, default pricing, booking review, cancellation and data reset.
- Vercel-ready Vinext/Nitro build output; browser storage remains only as a local preview fallback.

## Run locally

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

Before running the migration, set `DATABASE_URL` in `.env` to your Neon Postgres connection string. Without a database, the public catalogue and browser-only admin preview remain available, but shared admin changes and checkout are unavailable. The local demo login defaults to `admin` / `admin1234`; set `ADMIN_USERNAME`, `ADMIN_PASSWORD` and a strong `ADMIN_SESSION_SECRET` before deploying. The app does not send SMS messages.

## Vercel, Neon and Stripe test setup

Create a Neon Postgres database through the Vercel Marketplace, then make `DATABASE_URL` available in the Vercel Preview and Production environments. To initialize the schema, open the Neon Console from the integration, click **Connect**, copy the connection string, and put it in a local-only `.env` file as `DATABASE_URL`:

```bash
# Replace the placeholder in .env with the connection string copied from Neon.
npm run db:migrate
```

Vercel Production secrets may be redacted as `[SENSITIVE]` when pulled by the CLI, so do not use that placeholder for migrations. Keep the real connection string only in the ignored local `.env` file.

Set these Stripe test-mode values locally and in the matching Vercel environments. Keep the secret values out of Git:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Set the Resend values as well. `EMAIL_FROM` must use a sender address from a verified Resend domain; the API key must stay server-side:

```text
RESEND_API_KEY=re_...
EMAIL_FROM=Tennis Social <bookings@your-verified-domain.example>
```

Run `npm run db:migrate` after pulling the new migration. Venue images can be entered as public paths/URLs or selected locally from the admin form (up to 1 MB). A pending booking reserves its places for 30 minutes; `checkout.session.completed` confirms it and triggers the confirmation email; `checkout.session.expired` releases it. The email includes the booking summary, activity description and a `tennis-social-booking.ics` calendar attachment. Point the Stripe webhook to `https://<your-vercel-domain>/api/stripe/webhook`. Use Stripe test cards until the full refund and cancellation policy is in place.

See [PLAN.public.md](PLAN.public.md) for the product scope and acceptance criteria.

## Deploy to Vercel

Import this repository into Vercel after configuring Neon and Stripe. The included `vercel.json` runs `npm run build:vercel`; Nitro writes the Vercel Build Output API files to `.vercel/output`, which Vercel detects automatically. The project requires Node.js 22.13 or newer.
