# Tennis Match

Responsive, bilingual (English & Simplified Chinese) tennis session booking and community platform designed for London players and organisers.

Built on Vinext (Next.js App Router on Vite) and Nitro, backed by Neon Serverless PostgreSQL, Stripe Checkout, and Resend.

---

## Features

### 1. Player & Session Experience
- **Bilingual by Design**: Seamless one-click switching between English and Simplified Chinese (with language preference and active form state preserved).
- **Session Catalogue**: Live calendar of upcoming tennis sessions across London venues, with date, time, duration, fee per person, game formats (singles/doubles), and real-time remaining spots.
- **Seeking Levels & Matching**: Visual indicators for participant tennis levels (ITN/NTRP 1.0 to 5.0) and preferred formats to help players find matching games.
- **Group Bookings & Equipment Rental**:
  - Book for yourself or bring friends with individual tennis level selection for each participant.
  - Optional tennis racket rental (£2 per racket) automatically capped to the group size.
- **Session Sharing**: Direct link sharing via Web Share API with clipboard fallback.
- **Court & Partner Requests**: Visitors can request custom sessions for specific venues or request court finding near a London postcode (`find_nearby`), with guaranteed booking for requests made at least 7 days in advance.
- **Optional Booking Assistant**: A chat assistant has a bilingual interface and can collect court requests, partner-finding needs, tennis level, and singles/doubles preferences when `GEMINI_API_KEY` is configured. Before submission, signed-out visitors can register or sign in inside the assistant, or submit as a guest. Registration reuses collected details and asks for remaining profile fields; passwords go directly to the account API and are excluded from model messages and browser storage. Partner requirements are saved in court request notes. Transient provider errors receive a bounded retry, then a fallback model attempt. It never claims a request is booked.

See [Booking assistant flow and example wording](docs/booking-assistant-flow.md) for the request submission and inline registration flowcharts.

### 2. Payments & Transactional Notifications
- **Stripe Checkout Integration**:
  - Server-side price calculation in integer pence.
  - Atomic PostgreSQL reservation holding places for 30 minutes to eliminate race conditions and overselling.
  - Stripe Webhook handling for `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and refunds.
- **Automated Email Pipeline (Resend)**:
  - **Confirmation Email**: Instant booking confirmation with order breakdown, venue notes, and an attached `tennis-social-booking.ics` iCalendar file for 1-click addition to Apple/Google/Outlook calendars.
  - **Day-Before Reminder**: Automated reminder sent at 18:00 London time on the evening before the session via protected Vercel Cron endpoints (`0 17 * * *` and `0 18 * * *` UTC schedules covering both BST and GMT).
  - Preview interface at `/email-preview` for inspecting email templates.

### 3. Member Accounts & Loyalty Program
- **Player Accounts**: Optional member registration with encrypted passwords (scrypt + salt) and secure session cookies. Pre-fills contact and playing preferences.
- **Permanent Loyalty Discount**: Members who complete 10 confirmed paid sessions automatically unlock a permanent 10% discount on the session activity fee for all future bookings (racket rentals remain standard price).
- **Legacy Voucher Support**: The previous 50% milestone voucher schema is retained and can be enabled via `ENABLE_LEGACY_LOYALTY_COUPONS=true`.

### 4. Admin Management Dashboard (`/admin`)
- **Secure Authentication**: HMAC-SHA256 signed session cookies with timing-safe verification. Supports primary and optional secondary admin accounts configured via environment variables.
- **Session Operations**:
  - Interactive table view and 7-day calendar view.
  - Create and edit sessions with field locking for sessions with confirmed bookings.
  - Bulk publish / draft status toggling with undo capability.
  - Automated 4-week recurring session generator with collision avoidance.
  - Excel (`.xlsx`) batch session import with template download and validation report.
  - One-click CSV export of session schedules.
- **Venue & Asset Management**:
  - Multi-photo gallery support per venue with local file upload (up to 1 MB) or URL input.
  - Independent peak and off-peak baseline pricing.
  - Venue notes and court details.
- **Bookings & Requests Review**:
  - Real-time booking log with participant levels, format, equipment rental, and one-click cancellation (releasing held spots).
  - Reservation request workflow tracking (New / In Review / Completed).
  - One-click demo data reset to restore baseline fixtures.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Vinext](https://github.com/vinext) (Next.js App Router on Vite) + [Nitro](https://nitro.unjs.io/) |
| **Frontend** | React 19, Tailwind CSS v4, Base UI / shadcn/ui components, Lucide Icons |
| **Database** | [Neon](https://neon.tech/) Serverless PostgreSQL |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit |
| **Payments** | [Stripe Checkout](https://stripe.com/) & Webhooks |
| **Email & Calendar** | [Resend](https://resend.com/) API + `.ics` iCalendar generation |
| **Code Quality** | [oxlint](https://oxc.rs/) & [oxfmt](https://oxc.rs/) |

---

## Local Development

### Prerequisites
- Node.js `>= 22.13.0`
- A Neon PostgreSQL database (or compatible PostgreSQL instance)

### 1. Installation
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Key environment variables:
```ini
# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require

# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Hostinger SMTP Email
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=bookings@yourdomain.com
SMTP_PASSWORD=your_hostinger_mailbox_password
EMAIL_FROM=Tennis Match <bookings@your-verified-domain.com>

# Optional booking assistant (server-side only)
GEMINI_API_KEY=your_gemini_api_key
# GEMINI_MODEL=gemini-3.5-flash-lite
# GEMINI_FALLBACK_MODEL=gemini-3.8-flash

# Vercel Cron Security (minimum 16 random characters)
CRON_SECRET=your_long_random_cron_secret

# Admin Dashboard Access (Configure your credentials)
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_admin_password
ADMIN_SESSION_SECRET=your_random_32_character_secret

# Optional Second Admin Account
# ADMIN_USERNAME_2=second_admin
# ADMIN_PASSWORD_2=second_secure_password

# Legacy Policy Flag
# ENABLE_LEGACY_LOYALTY_COUPONS=true
```

> **Security Note**: Never commit `.env` or production credentials to source control. Set unique, strong passwords for `ADMIN_PASSWORD` and generate random secrets for `ADMIN_SESSION_SECRET` and `CRON_SECRET`.
> The booking assistant remains unavailable when `GEMINI_API_KEY` is unset. Keep this key server-side; do not expose it through a `NEXT_PUBLIC_*` variable.

The assistant defaults to `gemini-3.5-flash-lite`. On transient HTTP errors or network timeouts it retries once with exponential backoff, then tries `GEMINI_FALLBACK_MODEL` (by default `gemini-3.8-flash`, or `gemini-3.5-flash-lite` when another primary model is configured). Each provider attempt has a 10-second timeout, with at most three attempts. Authentication and other non-transient errors return immediately. Failed messages remain in the input so visitors can retry without duplicating conversation turns.

After the assistant summarizes a valid, complete request, the confirm-and-submit button appears immediately. Clicking it or typing `确认` / `confirm` starts the same submission and account check flow. Other input revises the draft; the previous submit action is disabled until the assistant produces a new complete summary. The chat response's `complete` flag means the summary is ready to submit, not that the request has already been confirmed or saved.

### 3. Run Database Migrations
```bash
npm run db:migrate
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application, or [http://localhost:3000/admin](http://localhost:3000/admin) to access the admin workspace.

---

## Database Migrations

Generate migration files from schema changes in [db/schema.ts](db/schema.ts):
```bash
npm run db:generate
```

Apply pending migrations to the configured database:
```bash
npm run db:migrate
```

---

## Deployment (Vercel)

The repository includes `vercel.json` configured for Nitro's Vercel build output (`npm run build:vercel`):

1. **Connect Repository**: Import the project into Vercel.
2. **Environment Variables**: Add all variables from `.env.example` in Vercel Project Settings > Environment Variables.
3. **Database Integration**: Connect Neon Postgres via Vercel Marketplace or supply `DATABASE_URL`. Run `npm run db:migrate` against your production database.
4. **Stripe Webhook**: In Stripe Dashboard > Webhooks, create an endpoint pointing to:
   ```
   https://<your-vercel-domain>/api/stripe/webhook
   ```
   Select events: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. **Scheduled Reminders**: Vercel Cron automatically activates in production according to `vercel.json` crons configuration.
