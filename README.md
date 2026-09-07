# Tennis Social

Responsive bilingual tennis session booking community demo for London.

## Included

- English by default with a Simplified Chinese switch.
- Desktop and mobile layouts with real venue photos.
- Session browsing, detail pages, participant levels, friend bookings and racket rental.
- Simulated payment success and failure states with a clear fee breakdown.
- Demo admin at `/admin` for session editing, booking review, cancellation and data reset.

## Run locally

```bash
npm install
npm run dev
```

The demo uses browser local storage. It does not take real payments or send email/SMS messages.

See [PLAN.public.md](PLAN.public.md) for the product scope and acceptance criteria.

## Deploy to Vercel

Import this repository into Vercel. The included `vercel.json` uses the Vinext/Nitro Vercel target and runs `npm run build:vercel`. Nitro writes the Vercel Build Output API files to `.vercel/output`, which Vercel detects automatically. The project requires Node.js 22.13 or newer.
