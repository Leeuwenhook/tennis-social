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

Validation: 61 tests passed (21 more than baseline); TypeScript, lint and production build passed. Exact `npx tsx --test tests/*.test.ts` is blocked by sandbox IPC binding (EPERM); the same tests run via `node --import tsx --test --test-isolation=none tests/*.test.ts`.

A.5 external acceptance items 5 (Vercel env setup), 15, 25 and 32 (Preview/mobile/SMTP/Stripe smoke tests) remain owner steps because this task explicitly prohibits Vercel and production access. All application and migration implementation items are included. Git commits are exported separately due to the read-only original Git metadata; no original branch switch, push, migration or deployment occurred.


Final review fix-up: admin notification is attempted independently even if customer confirmation email fails; phone preference fields now show required labels consistently, and undated application dialogs show slot labels. Added regression tests for admin claim ownership and swallowed database errors. New modules and tests were formatted with the repository formatter.

Email links use the production site origin. During Preview unsubscribe acceptance, replace the link's origin with the Preview origin so that Preview's token secret and test database handle the request.


## Round 2

The owner’s three updated decisions supersede the earlier per-session description and 09:00/20:00 UTC guidance above. Work remains uncommitted on `feat/feedback-2026-10-17`; no commit, push, branch switch, production DB access, remote Vercel action, live email or 3.2 reviews/media implementation was performed. Partner-request date behavior is unchanged.

### Changes and files

- Admin notifications: `lib/server/email.ts` now defaults to exactly `una.ge2502@gmail.com` and `leeuwenhook.sun@gmail.com` when `ADMIN_NOTIFY_EMAIL` is unset or blank. A nonblank comma-separated override replaces the defaults; validation/deduplication remains. Updated `.env.example`, `lib/server/booking-email.ts`, `tests/admin-notify.test.ts` and code-review N1 (resolved). SMTP configuration remains required.
- Venue descriptions: nullable bilingual `venues.description` / `description_zh` in `db/schema.ts`, migration `0021_venue_descriptions.sql`, generated `meta/0021_snapshot.json` and journal. `lib/venue-description.ts` supplies public name/area/address/postcode fallback text independently per language. No court/surface/facility fields exist, so no such facts are invented. Internal `notes` never feeds generated public descriptions.
- Venue editing and serialization: `components/views/admin-view.tsx`, `app/page.tsx`, public/admin venue API routes, `lib/server/admin-validation.ts`, `lib/server/database.ts`, `lib/tennis-utils.ts`, `lib/demo-data.ts` and `types/tennis.ts`. Admin venue create/edit has two description fields with the requested bilingual placeholder; blank values save as NULL, and text follows the existing 2,000-character validation limit.
- Session descriptions retired from forms, validation, serialized responses/payloads, Excel mapping (old columns ignored), weekly copying, demo data, and detail display. Removed `lib/server/session-description.ts` and replaced `tests/session-description.test.ts` with `tests/venue-description.test.ts`. Updated session API routes, `lib/session-import.ts`, `lib/formatters.ts` and `lib/translations.ts`. The detail header now resolves venue copy; the removed 活动介绍 section stays removed. Confirmation emails/calendar attachments also use venue copy; updated email input types/queries, reminders and `app/email-preview/page.tsx` accordingly.
- Follow-ups: `vercel.json` schedules 20:00 and 21:00 UTC. `lib/server/booking-followups.ts` exposes a pure London-hour predicate; `lib/server/booking-followup-cron.ts` checks authorization first, then returns HTTP 200 `{ skipped: "outside_london_21h" }` outside London 21:00–21:59. Authenticated `?force=1` bypasses only the hour gate. Confirmed status, suppression, the inclusive 1–72 elapsed-hour eligibility window and idempotent claim/recheck/retry logic are preserved. `tests/booking-followups.test.ts` covers both schedules in BST/GMT, DST transition dates, minute 00/59, force authorization and the exact 72-hour boundary.

### Migration 0021 and backfill

Generated offline with `npm run db:generate -- --name venue_descriptions`, then appended SQL backfill. Each language independently selects the most recent nonblank handwritten session description for the venue, ordered by session date, start time, creation timestamp and id descending. Anchored English/Chinese legacy auto-generator signatures exclude generated descriptions, including stale copies after session edits and capacity-zero text without player counts. No qualifying copy leaves the venue field NULL. The backfill updates only NULL venue fields, so replaying its UPDATE statements preserves owner overrides.

Session description columns are deliberately retained with their existing NOT NULL shape for safe rollback; new sessions insert empty legacy values and edits preserve old stored copy. A schema/migration TODO defers dropping these columns to a later migration after the rollback window. Public and admin product session serialization no longer exposes them.

Validated the actual migration SQL against disposable PostgreSQL 18 data under `/tmp`, using PostgreSQL single-user mode because the sandbox blocks listening sockets. Fixtures covered latest handwritten selection, newer generated exclusions, bilingual and capacity-zero templates, whitespace-only/no-copy venues, independent per-language selection and replay preserving a manual venue override. No production database or network connection was used.

### Validation

| Check | Final result |
|---|---|
| `npx tsx --test tests/*.test.ts` | Sandbox IPC `EPERM`; used the authorized equivalent below |
| `node --import tsx --test --test-isolation=none tests/*.test.ts` | **69 passed, 0 failed** |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed, no diagnostics |
| `npm run build` | Passed (local production build only) |
| Migration/backfill on disposable PostgreSQL 18 | Passed all SQL assertions and result inspection |
| `git diff --check` | Passed |

Initial checks caught a restored tool type declaration, a test fixture field and an unused import; all were corrected before final verification.

### Owner manual steps

1. Review and commit the working-tree changes. Through the normal controlled process, back up the target database and apply pending migrations in order through **0021 before deploying this code** (0018–0020 if not already applied). Inspect migrated venue descriptions, especially session-oriented handwritten text that may need editorial cleanup; clear either language to use its venue fallback.
2. `ADMIN_NOTIFY_EMAIL` is optional; remove an unintended existing override to use both built-in owners. Verify SMTP/EMAIL_FROM, CRON_SECRET and the independent ≥32-byte REVIEW_TOKEN_SECRET in the owner-managed environments.
3. On the owner’s Preview environment, check venue create/edit/blank fallback in both languages, session form/copy/import behavior, detail header and email previews. Verify booking/request notifications reach both owners once. Test follow-ups with `Authorization: Bearer <CRON_SECRET>` and `?force=1` on eligible test bookings; repeat to confirm no duplicate, and check suppression/refunds. Without force, verify the skip response outside London 21h. The owner handles deployment and confirmation of the updated cron schedules.

Deviations: no scope deviations. The test runner and disposable PostgreSQL single-user mode are sandbox accommodations. Preview/mobile, SMTP/Stripe and deployed cron acceptance remain owner steps; no remote services were touched.
