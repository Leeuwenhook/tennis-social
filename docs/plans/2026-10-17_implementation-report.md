# Feedback implementation and owner rollout

Work stays on `feat/feedback-2026-10-17`. No push, database migration, Vercel configuration or deployment is performed here.

## v1

Capacity zero is valid; marking full preserves current booked spots (including payment holds, which can expire and reopen places). Full sessions remain viewable. Durations over 60 minutes are highlighted, with readable irregular durations. Empty descriptions are generated per session and language. Admin notifications have a separate atomic claim and never propagate failures to users. Migration 0018 marks all existing bookings skipped for admin delivery.

Validation: sandbox denies the IPC socket opened by `npx tsx --test tests/*.test.ts` (EPERM). Equivalent actual tests run with `node --import tsx --test --test-isolation=none tests/*.test.ts`: 44 passed. TypeScript, lint and production build passed. Preview SMTP/Stripe and mobile acceptance require owner environment access.

Owner: before merging, apply the reviewed migrations to production using the normal controlled migration process. Configure `ADMIN_NOTIFY_EMAIL` in Production and Preview (production recipients are documented in `.env.example`), verify SMTP settings and test payment notification delivery and repeated confirmation refreshes on Preview. No production actions were taken by Codex.

## v2-a

Partner requests support four bilingual time slots, nullable schedules, a 30-day lifetime for undated requests, and private WeChat/WhatsApp/preferred-contact fields in both request and application forms. Booked requests still require a concrete date/time; other requests require slots. The parser, chat draft normalization, admin tools and public board support slots. Migration 0019 backfills `expires_on = preferred_date`. Public serialization never returns contact details.

Validation: 48 tests passed using the alternate sandbox-compatible runner, TypeScript/lint/build passed. Preview/mobile checks remain manual.

Git limitation: the actual shared Git metadata is mounted read-only (`index.lock: Read-only file system`). Phase commits are preserved in `/tmp/tennis-feedback-commits.git` and will be exported as patches; the original branch ref cannot be updated here.

## v2-b / 3.1

Follow-ups use an atomic pending/sending/sent/skipped claim, a 10-minute stale timeout, a three-day lookback, confirmed-status rechecks and suppression checks before SMTP. London end times support BST/GMT, DST transitions and 24:00. Recommendations include at most three published sessions with places available at the same venue or area within seven days. Emails are bilingual; the optional review button is hidden. There is no review/media module or Blob dependency.

Migration 0020 adds follow-up state, its index and `email_suppressions`; it skips historical ended sessions and restores eligibility only for sessions still in the future when the migration runs. Signed unsubscribe links use the independent `REVIEW_TOKEN_SECRET` (minimum 32 bytes). Unsubscribing does not suppress transactional confirmations or reminders.

Owner setup: configure `REVIEW_TOKEN_SECRET` in Production and Preview, retain SMTP and `CRON_SECRET`, and apply 0018–0020 before merging. The new `/api/cron/session-followups` schedules are 09:00 and 20:00 UTC daily. Test authenticated cron invocation, repeated invocation, historical/refunded bookings, signed unsubscribe and subsequent suppression on Preview. No remote smoke tests were attempted and no live email was sent.

Validation: 59 tests passed (19 more than baseline); TypeScript, lint and production build passed. Exact `npx tsx --test tests/*.test.ts` is blocked by sandbox IPC binding (EPERM); the same tests run via `node --import tsx --test --test-isolation=none tests/*.test.ts`.

A.5 external acceptance items 5 (Vercel env setup), 15, 25 and 32 (Preview/mobile/SMTP/Stripe smoke tests) remain owner steps because this task explicitly prohibits Vercel and production access. All application and migration implementation items are included. Git commits are exported separately due to the read-only original Git metadata; no original branch switch, push, migration or deployment occurred.
