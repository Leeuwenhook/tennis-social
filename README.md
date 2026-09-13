# Tennis Social

Responsive bilingual tennis session booking community demo for London.

## Included

- English by default with a Simplified Chinese switch.
- Desktop and mobile layouts with real venue photos.
- Session browsing, detail pages, participant levels, friend bookings and racket rental.
- Stripe Checkout handoff with server-side pricing, 30-minute reservations and webhook confirmation.
- Demo admin at `/admin` for local session editing, booking review, cancellation and data reset.

## Run locally

```bash
npm install
npm run dev
```

The public session catalogue has a browser fallback for local previews, but real checkout uses the platform database and Stripe Checkout. The demo admin state is still browser-local, and it does not send email/SMS messages yet.

## Stripe test setup

Copy `.dev.vars.example` to `.dev.vars` for local Cloudflare development and add Stripe test-mode values. Keep the secret values out of Git:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

The database migration is in `drizzle/`. A pending booking reserves its places for 30 minutes; `checkout.session.completed` confirms it and `checkout.session.expired` releases it. Configure the same two values as hosted runtime secrets before accepting real payments. Use Stripe test cards until the full refund and cancellation policy is in place.

See [PLAN.public.md](PLAN.public.md) for the product scope and acceptance criteria.

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` uses the Vinext/Nitro Vercel target and runs `npm run build:vercel`. Nitro writes the Vercel Build Output API files to `.vercel/output`, which Vercel detects automatically. The project requires Node.js 22.13 or newer.
