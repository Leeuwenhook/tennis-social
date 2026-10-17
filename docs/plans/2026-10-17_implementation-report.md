# Feedback implementation and owner rollout

Work stays on `feat/feedback-2026-10-17`. No push, database migration, Vercel configuration or deployment is performed here.

## v1

Capacity zero is valid; marking full preserves current booked spots (including payment holds, which can expire and reopen places). Full sessions remain viewable. Durations over 60 minutes are highlighted, with readable irregular durations. Empty descriptions are generated per session and language. Admin notifications have a separate atomic claim and never propagate failures to users. Migration 0018 marks all existing bookings skipped for admin delivery.

Validation: sandbox denies the IPC socket opened by `npx tsx --test tests/*.test.ts` (EPERM). Equivalent actual tests run with `node --import tsx --test --test-isolation=none tests/*.test.ts`: 44 passed. TypeScript, lint and production build passed. Preview SMTP/Stripe and mobile acceptance require owner environment access.

Owner: before merging, apply the reviewed migrations to production using the normal controlled migration process. Configure `ADMIN_NOTIFY_EMAIL` in Production and Preview (production recipients are documented in `.env.example`), verify SMTP settings and test payment notification delivery and repeated confirmation refreshes on Preview. No production actions were taken by Codex.
