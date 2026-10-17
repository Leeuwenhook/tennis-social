# Tennis Match 反馈计划 — 代码核查评审 + 3.2 赛后评论模块详细规格

> 评审对象：`docs/plans/2026-10-17_tennis-match-feedback-plan.md`
> 核查基准：分支 `feat/feedback-2026-10-17`（HEAD = `494af90`），2026-10-17
> 约定：以计划末尾「确认内容」为准，覆盖前文的“待确认”。本文只给方案，**不改源码**。
> 行号以本次核查时的文件为准，实施前请用 `grep` 复核。

---

# Part A — 计划核查（1.x / 2.x / 3.1）

## A.0 全局事实核查

| 项 | 计划描述 | 实际 | 结论 |
|---|---|---|---|
| 最新 migration | 计划写新建 `0018_...` | `db/migrations/0017_structured_partner_requests.sql` 是最新；`meta/_journal.json` 最后 idx=17；`meta/0017_snapshot.json` 存在 | 0018 编号正确，但见下方编号冲突 |
| migration 生成方式 | 未说明 | `package.json`：`db:generate` = `drizzle-kit generate`，`db:migrate` = `drizzle-kit migrate`；0017 带 snapshot | 应改 `db/schema.ts` 后用 `npm run db:generate -- --name <name>` 生成，保证 snapshot + journal 一致，**不要只手写 SQL** |
| migration 部署 | 未说明 | Vercel 部署**不会**执行 migration（`vercel.json` 只有 `buildCommand`） | **遗漏**：每个含 migration 的 PR 合并前必须先手动对生产库 `npm run db:migrate` |
| Cron | “Hobby 只能每日一次” | `vercel.json` 已有 2 条 cron：`/api/cron/booking-reminders` 在 `0 17 * * *` 和 `0 18 * * *`（UTC，覆盖 BST/GMT 的伦敦 18:00） | 现有写法说明项目按“每天一次”的 Hobby 约束设计。Hobby：每条 cron 每天最多一次，且只保证在该小时内触发（分钟不精确）。数量上限以 Vercel 当前文档为准 |
| Cron 鉴权 | 未说明 | `lib/server/booking-reminder-cron.ts:9-13` 校验 `Authorization: Bearer ${CRON_SECRET}` | 新 cron 必须复用同样的鉴权方式 |
| 测试/检查命令 | 只写了 `npm run lint` + `npm run build` | `package.json` 没有 `test` / `typecheck` 脚本；`tests/*.test.ts` 用 `node:test` | 正确命令：`npx tsx --test tests/*.test.ts`（直接用 `node --test` 会因无扩展名 import 失败）、`npx tsc --noEmit`、`npm run lint`（oxlint）、`npm run build` |
| 邮件服务 | nodemailer SMTP | `lib/server/email.ts:297-307` 用 nodemailer（默认 `smtp.hostinger.com`）；README 写的是 “Resend”，**README 已过时** | 计划正确，README 可顺手修 |
| 视图路由 | “场地页” | 没有独立场地页。SPA 用 `/?view=detail&session=<id>`（`lib/tennis-utils.ts:33-52`），详情页是 `components/views/detail-view.tsx`，展示**场次**＋场地 | “场地页”实际就是 `DetailView`；3.2 的留言墙按 `venueId` 放在这里（见 Part B） |
| i18n | “`lib/translations.ts`（中英文）” | `lib/translations.ts` 同时有 en（约 1–370 行）和 zh（约 372 行起）。**但** `components/public-partner-requests.tsx:85-141` 自带一份中英文案字典，不走 `lib/translations.ts` | 这两处都要改 |

### Migration 编号冲突（重要）
计划把 `0018` 给了 2.1，但 1.3（建议加管理员通知状态列）和 3.1（`followup_email_status`）也要改 schema。建议按发布顺序编号：

| 版本 | migration | 内容 |
|---|---|---|
| v1 | `0018_admin_booking_notifications` | `bookings.admin_notification_status` 等 |
| v2 | `0019_partner_request_slots_contacts` | 2.1 + 2.2 |
| v2 | `0020_booking_followup_emails` | 3.1 |
| v3 | `0021_session_reviews` | 3.2 |

（2.1 / 2.2 / 3.1 如果同一个 PR 发布，可合成一个 0019。）

---

## A.1.1 允许 capacity = 0 / “标记已满”

**核查结论**
- 正确：`app/page.tsx:1548-1549`（`saveDraft` 里 `!Number.isInteger(capacity) || capacity < 1`）。
- 正确：`lib/server/admin-validation.ts:195`（`capacity < 1 || capacity > 1000` → issue `'capacity'`）。
- **不准确**：`app/api/admin/sessions/import/route.ts:145` 只是把 `capacity` 传给 `generateSessionDescriptions`。导入的真正校验是 `sessionInputIssues`/`validateSessionInput`（同文件 157-158 行），改完 `admin-validation.ts` 导入就自动支持 0，不需要单独改 import。
- **遗漏**：`components/views/admin-view.tsx:485` 的 `<Input type="number" min="1">`，浏览器会直接挡住 0。
- 正确：`lib/server/session-description.ts:37` 在 capacity ≤ 0 时不输出人数文案。
- 服务端已经防止容量低于已订人数：`app/api/admin/sessions/[id]/route.ts:56-58`（`capacity_too_low`）和 `:69`（`WHERE booked_spots <= capacity`）。`app/page.tsx:1567` 前端也有检查。
- 前台“已满”显示：`home-view.tsx:44-45,117`、`courtside-home-view.tsx:192-193`、`detail-view.tsx:42-43,138`；结账时 `app/api/checkout/route.ts:198`（`booked_spots + n <= capacity`）会拒单。都已支持 capacity=0。

**风险与遗漏**
1. 场次已有报名时**不能**设为 0（服务端会返回 409）。“设为 0”只适用于 `bookedSpots = 0` 的场次；有报名的场次要用“标记已满”（capacity = bookedSpots）。UI 需要说清楚，并把 `capacity_too_low` 翻译成可读提示。
2. `booked_spots` 包含 `pending_payment` 的 30 分钟占位（`expireStaleReservations` 会释放）。在有占位时“标记已满”，占位过期后场次会重新出现名额。可以接受，但要在按钮 tooltip 或文档里写明；更稳的做法是“标记已满”时服务端用 `capacity = (SELECT SUM(participant_count) FROM bookings WHERE status='confirmed')`，但这样会让仍在付款中的人超卖失败，所以**保持 capacity = booked_spots**，只在文档中说明这一点。
3. `courtside-home-view.tsx:346-348` 在 capacity=0 时会显示 “0 / 0”，`SpotMeter`（128-130 行）显示 0 格，都不会报错，但观感一般，建议 `capacity === 0` 时只显示 `t.full`。
4. `home-view.tsx:117`：满员卡片的按钮是 `disabled`，但文案是 “View details”，用户点不进详情。这是现有 bug，建议顺手改为可点击（详情页的预订按钮本来就会禁用）。
5. 没有 capacity 相关的测试。

**修正建议**
- `admin-validation.ts:195` → `capacity < 0`。
- `app/page.tsx:1549` → `capacity < 0`；`admin-view.tsx:485` → `min="0"`。
- 在 `admin-view.tsx` 场次行操作（约 1153-1175 行，Edit / Create next weeks / Delete 旁边）加按钮 `t.markFull`。仅当 `session.capacity > session.bookedSpots` 时显示。点击后调用 `app/page.tsx` 里新的 `onMarkSessionFull(session)`：PATCH `/api/admin/sessions/:id`，payload 为 `sessionPayload({...session, capacity: session.bookedSpots})`（复用 `app/page.tsx:1515`），成功后更新本地 `sessions` state。不需要新 API。
- 新 i18n key：`markFull`（“Mark as full” / “标记已满”）、`markFullHint`。
- 测试 `tests/admin-validation.test.ts`：capacity 为 0 时合法、-1 时 issue 为 `capacity`、1001 时 issue 为 `capacity`。

## A.1.2 时长标签阈值

**核查结论**：正确，`lib/formatters.ts:55` 是 `if (durationMinutes < 120) return null;`。**遗漏**：52 行的 doc 注释写的是 “two hours or more”，要同步改。调用方：`home-view.tsx:47`、`courtside-home-view.tsx:195,337-339`。

**风险**
- 标签文案是 `Number((min/60).toFixed(2))`：65 分钟会显示 “1.08h session”，75 分钟显示 “1.25小时场”。阈值降到 60 分钟后，这种非整半小时的时长会更常见。
- 歧义：“1 小时以上”是否包含正好 60 分钟？计划默认 >60，这里**采纳 >60**。

**修正建议**
- `if (durationMinutes <= 60) return null;`，注释改为 “longer than one hour”。
- 时长不是 30 分钟倍数时，标签改用 `formatDuration`（例如 “1h 5m session” / “1小时 5分钟场”）。
- 测试 `tests/formatters.test.ts`：60 分钟返回 null；90 分钟返回 “1.5h session” / “1.5小时场”；120 分钟返回 “2h session”。

## A.1.3 下单后管理员通知邮件（+ 找球友申请通知）

**核查结论**
- 正确：`sendBookingConfirmationEmail`（`lib/server/email.ts:309-327`）只发到 `input.booking.email`。
- **不准确/遗漏**：确认邮件有**两个**触发点，都会调用 `sendConfirmedBookingEmail`（`lib/server/booking-email.ts:25`）：
  1. Stripe webhook：`app/api/stripe/webhook/route.ts:86`
  2. 付款返回页轮询：`app/api/bookings/[id]/route.ts:74`（每次刷新确认页都会调用）
  `sendConfirmedBookingEmail` 用 `confirmation_email_status` 的 pending/sending/sent 认领机制保证只发一次。**管理员邮件如果直接挂在这两处会重复发送**。
- webhook 中 `sendConfirmedBookingEmail` 抛错会删除 `webhook_events` 记录，让 Stripe 重试（webhook 115-119 行）。管理员邮件**绝不能抛错**到这一层。
- `lib/server/runtime.ts` 目前没有 `ADMIN_NOTIFY_EMAIL`，`.env.example` 也没有。
- 找球友申请：`app/api/reservation-requests/route.ts:79`（新需求）和 `app/api/reservation-requests/[id]/applications/route.ts:42`（加入申请）都只写库，不发邮件。
- **计划 2.2 提到“接受后邮件”，但它不存在**：全仓只有确认和提醒两种 `sendMail`。`app/api/admin/reservation-requests/[id]/applications/[applicationId]/route.ts` 接受申请时只改状态，不发邮件。

**风险**
- 重复通知（见上）。上线时老订单在确认页刷新也可能触发补发。
- 收件人：两位管理员（una.ge2502@gmail.com、leeuwenhook.sun@gmail.com）。用一封邮件 `to: [a, b]`，两人能看到彼此地址，可以接受；这些地址**只写在 Vercel env 和 `.env.example` 注释里，不硬编码进源码**。
- 邮件内容含用户输入（姓名、留言），HTML 必须用现有的 `escapeHtml`（`email.ts:28`）。
- 邮件含个人数据（邮箱、电话），只发给管理员，不要加到日志里（`console.error` 只记 booking id）。
- 在 serverless 环境里不 await 的 Promise 可能被中断，必须 `await` 并 `try/catch`（会给申请接口增加约 1 秒 SMTP 延迟，可以接受）。

**修正建议**
1. `runtime.ts` 增加 `ADMIN_NOTIFY_EMAIL?: string`；`.env.example` 增加：
   ```
   # Comma-separated admin notification recipients (production: una.ge2502@gmail.com,leeuwenhook.sun@gmail.com)
   # ADMIN_NOTIFY_EMAIL=admin1@example.com,admin2@example.com
   ```
2. `lib/server/email.ts` 新增：
   - `adminNotifyRecipients(): string[]`：按逗号拆分、trim、用 `/^\S+@\S+\.\S+$/` 过滤、去重。未配置时返回 `[]`，调用方直接跳过。
   - `renderAdminBookingNotificationEmail(input: BookingEmailInput)`，主题 `新报名：{venue.nameZh||name} {date} {start}–{end} · {participant_count}人`，正文包含 booking id、contact_name、email、phone、format、participants（水平）、racket_count、total（`formatMoney`）、优惠，以及后台链接 `/admin`。
   - `sendAdminBookingNotification(input)`、`renderAdminRequestNotificationEmail(row)` / `sendAdminRequestNotification(...)`（区分“新找球友/订场需求”和“新加入申请”两种 kind）。
3. 幂等：migration `0018_admin_booking_notifications` 给 `bookings` 加 `admin_notification_status text not null default 'pending'`（枚举 `pending|sending|sent|skipped`）和 `admin_notification_claimed_at text`、`admin_notification_sent_at text`。**migration 里对已有数据执行 `UPDATE bookings SET admin_notification_status = 'skipped';`**，防止补发历史订单。
4. `lib/server/booking-email.ts` 新增 `sendAdminBookingNotificationOnce(db, bookingId)`，复制 `sendConfirmedBookingEmail` 的认领模式（STALE_CLAIM 10 分钟），内部 catch 所有错误只记日志，返回状态值、不抛错。在 webhook `:86` 之后和 `bookings/[id]/route.ts:74` 之后**各调用一次**（认领机制保证只发一封），并放在自己的 `try/catch` 里。
5. 同步更新 `lib/server/database.ts:41` 的 `BookingRow` 类型，以及 `app/email-preview/page.tsx:34-66` 的 `booking` 字面量（不改会导致 `tsc` 报错）。在 email-preview 页加一张“管理员新报名通知”预览卡片。
6. 申请类通知：`reservation-requests/route.ts` 插入成功后、`applications/route.ts` 插入成功后，执行 `try { await sendAdminRequestNotification(...) } catch { console.error(...) }`。这两类不需要状态列，因为插入只会成功一次。
7. 测试 `tests/admin-notify.test.ts`：`adminNotifyRecipients` 的解析（空值、空格、非法地址、重复）；render 输出包含 escape 后的姓名，且不包含原始 `<script>`。

## A.1.4 场地描述（删除“活动介绍”）

**核查结论**
- 重复显示确认：`components/views/detail-view.tsx:61-63`（`.detail-description`）和 `:150-160`（`.detail-about`，标题 `t.aboutSession` = “活动介绍”，`lib/translations.ts:394`；en 为 “About this session”，`:22`）显示的都是 `selectedSession.description(Zh)`。
- **不准确**：计划写“顶部短简介来自 venue”。实际顶部用的是**场次**描述；`venues` 表（`db/schema.ts:9-25`）**没有公开的描述字段**。`venues.notes` 是后台内部备注（导入时写入 `（复用照片）` 标记，`import/route.ts:129`，只在 `admin-view.tsx:1406` 显示），**不能用作公开文案**。
- 自动生成器已存在：`lib/server/session-description.ts` 的 `generateSessionDescriptions`，但目前只在 Excel 导入时使用（`import/route.ts:138-153`）。手动建场次要求必填（`admin-validation.ts:193`），默认草稿文案是固定句子（`lib/tennis-utils.ts:270-271`）。

**风险**：删除 `.detail-about` 后，`app/globals.css` 中 775、1346-1365、3558、3585 附近的 `.detail-about` 样式成为死代码。3.2 的留言墙正好放在这个位置。

**修正建议（按确认内容：没有自定义文案就自动生成）**
1. 删除 `detail-view.tsx:150-160` 整块，以及对应 CSS；如果 `aboutSession` 不再被引用，从 en/zh 两边一起删除。
2. 场次描述改为可选：`admin-validation.ts:193` 不再因空描述报 `description` issue。在 `app/api/admin/sessions/route.ts`（POST）和 `[id]/route.ts`（PATCH）中，描述为空时查出 venue 的 name/name_zh，用 `generateSessionDescriptions` 填充（和导入逻辑一致）。`app/page.tsx:1544-1545` 去掉前端必填；`lib/tennis-utils.ts:270-271` 的默认值改为 `''`，表单 placeholder 写“留空自动生成”。
3. 后台编辑表单加“重新生成描述”按钮：把两个字段清空后保存即可。已有的 Tanner St Park 场次需要管理员手动清空一次才能使用新文案。
4. **待决（不阻塞 v1）**：如果想要真正的“场地介绍”（跨场次复用，例如场地设施、交通），需要新增 `venues.description` / `description_zh`（新 migration），详情页顶部显示 venue 描述，没有时回落到场次描述。建议放到 v2 再定。

---

## A.2.1 偏好时间段替代具体日期

**核查结论**
- 正确：`db/schema.ts:146` 的 `preferred_date` 是 NOT NULL；表单 `components/views/request-view.tsx:326-335` 用 `type="date"`，带必填星号。
- **部分不准确**：`components/public-partner-requests.tsx:250` 的 `type="date"` 是**筛选器**，不是提交表单；公开看板的加入申请表单本身没有日期字段。
- **遗漏（会导致功能失效）**：
  1. `start_time` / `end_time` 也是 NOT NULL（`schema.ts:147-148`），计划没处理。只选时间段时这两个字段填什么？
  2. 公开 GET `app/api/reservation-requests/route.ts:36` 有 `requests.preferred_date >= ${today}`，`preferred_date` 为 NULL 时**请求不会出现在看板上**；42 行 `ORDER BY preferred_date` 也会受影响。
  3. 加入申请 `applications/route.ts:33` 和 `:47` 有 `preferred_date >= today`，SQL 中 NULL 比较为假，**会永远返回 `request_closed`**。
  4. 后台卡片 `components/views/admin-view.tsx:1296-1311` 用 `new Date(\`${request.preferredDate}T12:00:00\`)`，NULL 时会显示 NaN 或 Invalid Date。
  5. 校验 `lib/server/reservation-request-validation.ts:94-99` 强制要求日期和时间。
  6. 类型 `types/tennis.ts:143,166`（`preferredDate: string`）、`components/public-partner-requests.tsx:19-21`、`:317,321,399,569`。
  7. 聊天助手：`app/api/chat/route.ts:21,119` 和 `lib/booking-assistant.ts:4` 也收集 `preferredDate`。
  8. 粘贴解析器 `lib/partner-request-parser.ts:7,119,146`：缺日期会被当成缺字段；`components/admin-paste-requests.tsx:68,177-178` 日期必填。
  9. 索引 `idx_reservation_requests_status_date`（`schema.ts:165`）。
  10. 已有测试：`tests/partner-request-contract.test.ts`、`partner-request-parser.test.ts`、`reservation-partner-details.test.ts`、`reservation-request-status.test.ts` 都要更新。
- **过期问题**：没有日期的需求永远不会自然过期，看板会越积越多。

**修正建议**
- migration 0019：
  ```sql
  ALTER TABLE reservation_requests ALTER COLUMN preferred_date DROP NOT NULL;
  ALTER TABLE reservation_requests ALTER COLUMN start_time DROP NOT NULL;
  ALTER TABLE reservation_requests ALTER COLUMN end_time DROP NOT NULL;
  ALTER TABLE reservation_requests ADD COLUMN preferred_slots_json text NOT NULL DEFAULT '[]';
  ALTER TABLE reservation_requests ADD COLUMN expires_on text; -- YYYY-MM-DD
  UPDATE reservation_requests SET expires_on = preferred_date WHERE expires_on IS NULL;
  ```
  （改 `schema.ts` 后用 drizzle-kit 生成，再手动补上 UPDATE 语句。）
- 取值集合放在共享模块 `lib/partner-request-slots.ts`：`PREFERRED_SLOTS = ['weekday_morning','weekday_afternoon','weekday_evening','weekend_any'] as const`，同时提供中英文 label。是否要拆成 `weekend_morning` 等更细的时段？**按计划只保留 4 个**。
- 校验规则：`venueBookingStatus === 'booked'` 时必须填日期和时间（保持现状）；否则至少选 1 个 slot，日期和时间可选，但必须成对出现（要么都填，要么都不填）。`expires_on` = 有日期时取 `preferredDate`，没有时取 `today + 30 天`（常量 `SLOT_REQUEST_TTL_DAYS = 30`）。
- 所有 `preferred_date >= today` 改为 `expires_on >= today`（公开 GET、applications 两处）。排序改为 `ORDER BY preferred_date NULLS LAST, created_at DESC`。日期筛选：带 `date` 参数时只匹配有日期的需求；新增 `slot` 参数，条件为 `preferred_slots_json::jsonb @> ${JSON.stringify([slot])}::jsonb`。
- UI：`request-view.tsx` 根据 `venueBookingStatus` 切换显示日期/时间输入或 slot chips（可用 `components/ui/toggle-group.tsx`）。`public-partner-requests.tsx` 的卡片在没有日期时显示 slot 标签，筛选器增加 slot。`admin-view.tsx:1296-1311` 没有日期时显示 slot 标签。`admin-paste-requests.tsx` 中日期改为可选，并增加 slot chips。
- 解析器：从文本识别“工作日晚上 / weekday evening / 周末”等词映射到 slot；`missing` 规则改为“日期和 slot 至少有一个”。
- 聊天助手：`app/api/chat/route.ts` 的 JSON schema 增加 `preferredSlots: string[] | null`，提示词说明“没有具体日期时询问时间段”。
- `serializeReservationRequest` / `serializePublicReservationRequest`（`lib/server/database.ts:297-336`）输出 `preferredSlots`、`expiresOn`。

## A.2.2 联系方式规则（同时解决原需求 #6）

**核查结论**：`reservation_requests.phone`、`partner_request_applications.phone`、`bookings.phone`、`users.phone` 都是 `text default ''`。各表单都把电话标为 optional：`request-view.tsx:390-391`、`public-partner-requests.tsx:440`、`admin-paste-requests.tsx:208`、`booking-view.tsx:313-314`。公开 GET 的 `serializePublicReservationRequest` 已经不返回联系方式（隐私承诺成立）。

**歧义**：2.2 放在“找球友表单”阶段，但原需求 #5 没有限定范围。是否也作用于**订场表单（booking-view）和用户资料（users）**？**建议**：v2 只改找球友需求表单和加入申请表单（`reservation_requests`、`partner_request_applications`）；booking 只增加可选的 WeChat/WhatsApp 字段，不加首选方式（订场流程已有邮件确认）。由 owner 最终确认，不阻塞开发。

**修正建议**
- migration 0019 给 `reservation_requests` 和 `partner_request_applications` 各加：`wechat text not null default ''`、`whatsapp text not null default ''`、`preferred_contact text not null default 'email'`（枚举 `email|phone|wechat|whatsapp`）。
- 校验：email 必填（保持现状）；phone/whatsapp 去掉空格后匹配 `^\+?[0-9 ()-]{6,20}$`；wechat 长度 ≤ 40；`preferred_contact ≠ email` 时对应字段必填，否则返回 `invalid_request`。
- UI：所选首选方式对应的输入框标为必填；文案使用 i18n key `wechat`、`whatsapp`、`preferredContact`、`contactPrivacyNote`（“联系方式仅在审核后与匹配球友共享”）。
- 计划说的“接受后邮件”**目前不存在**。接受申请后由管理员线下联系，或另立需求（不在本次范围）。后台卡片显示全部联系方式，首选方式高亮。
- 管理员通知邮件（A.1.3）中包含这些字段。

## A.3.1 Session 结束后自动邮件

**核查结论**：现有 `lib/server/booking-reminders.ts` 的认领模式（`pending|sending|sent` + `claimed_at` + 10 分钟过期认领）值得复用。计划只写了 `pending/sent`，**过于简化**。`app/email-preview/page.tsx` 已有预览页（`emails` 数组），新样例加到这里即可。

**风险与遗漏**
1. **历史订单群发**：加列时默认 `pending`，会让上线前所有已结束的 confirmed 订单都收到邮件。migration 必须把历史数据置为 `skipped`，查询也必须限定时间窗口。
2. Hobby 套餐不能每小时跑 cron。
3. 时区：`sessions.date/start_time/end_time` 都是伦敦本地时间字符串，`end_time` 可以是 `24:00`（`admin-validation.ts:186`）。
4. 退款或取消（`status` 变为 `refunded`/`cancelled`）的订单不发，认领时要再检查 `status='confirmed'`。
5. 一封订单只有一个联系邮箱（`participants_json` 只存水平，没有姓名），所以每个 booking 只发一封。
6. 邮件含“下次场次推荐”属于营销内容。英国 PECR 的 soft opt-in 要求提供退订方式，**必须**在邮件中提供退订链接，或至少写明“回复 unsubscribe”。
7. 评价链接依赖 3.2。v2 先发不带链接的版本，或链接指向 3.2 上线后才生效的页面（**建议 3.1 直接生成 3.2 的签名 token**，3.2 上线前隐藏按钮，见 B.3）。

**修正建议**
- migration 0020：`bookings` 增加 `followup_email_status text not null default 'pending'`（`pending|sending|sent|skipped`）、`followup_email_sent_at`、`followup_email_message_id`、`followup_email_claimed_at`，索引 `(status, followup_email_status)`。之后执行 `UPDATE bookings SET followup_email_status='skipped' WHERE session_id IN (SELECT id FROM sessions WHERE date < <migration 当天>)`。更简单的做法：先全部置为 `skipped`，再把未来场次的订单设回 `pending`。
- 新文件：`lib/server/booking-followups.ts`（`sendDueBookingFollowups(db, now)`，结构仿照 `booking-reminders.ts`）、`lib/server/booking-followup-cron.ts`（仿照 `booking-reminder-cron.ts` 的 CRON_SECRET 鉴权）、`app/api/cron/session-followups/route.ts`。
- 时间判断写成纯函数 `isFollowupDue(sessionDate, endTime, now)`：把伦敦时间的 `date + end_time + 60 分钟` 和 `londonDateTime(now)` 比较（复用 `booking-reminders.ts:29` 的写法，建议抽到共享模块）。SQL 先粗筛 `sessions.date BETWEEN today-3 AND today`，再用这个函数精筛。超过 3 天未发的订单不再补发。
- `vercel.json` 增加 2 条（Hobby 兼容）：`{"path":"/api/cron/session-followups","schedule":"0 9 * * *"}` 和 `"0 20 * * *"`（UTC）。晚上一次覆盖白天结束的场次，早上一次覆盖晚场。handler 不按小时过滤，只看“结束超过 1 小时且未发送”。升级 Pro 后改为 `0 * * * *` 一条即可。
- 邮件：`renderBookingFollowupEmail(input & { reviewUrl?: string; nextSessions: Array<...> })`，内容为感谢、评价/上传照片按钮（`reviewUrl` 为空时隐藏）、最多 3 个未来 7 天内**同场地或同区域**、`status='published'` 且有空位的场次（链接 `/?view=detail&session=<id>`），以及退订说明。
- 退订：最小方案是在 `bookings` 上加 `marketing_opt_out`？由于没有用户体系，建议新建 `email_suppressions(email primary key, created_at)` 表（放进 0020），退订链接 `/api/email/unsubscribe?t=<signed>`；发送前检查 suppression 表。如果想再简化，至少在文案里写“回复 STOP 即不再收到推荐”，由管理员手动处理。**推荐做 suppression 表**。
- `app/email-preview/page.tsx` 增加 `followup` 卡片。
- 测试 `tests/booking-followups.test.ts`：`isFollowupDue` 覆盖 BST/GMT、`24:00`、刚好 60 分钟、跨日。

---

## A.4 计划未覆盖但需决定的歧义汇总

1. 原需求 #5/#6 是否作用于订场表单和用户资料（见 A.2.2，建议 v2 只改找球友表单）。
2. “场地描述”在 v1 用场次级自动生成，是否需要 venue 级描述（A.1.4 第 4 条）。
3. 时长标签：非整半小时的显示格式（A.1.2）。
4. Vercel 套餐是 Hobby 还是 Pro，决定 3.1 的 cron 频率。
5. 退订实现：suppression 表还是只靠文案（A.3.1）。
6. 没有日期的找球友需求有效期是否为 30 天。

---

## A.5 实施清单（给 Codex）— 不含 3.2

> 每个 PR：从 `main` 拉分支 → 实现 → 运行下方检查 → Vercel Preview 在手机上手测 → 含 migration 的 PR **合并前先在生产库执行 `npm run db:migrate`** → owner 确认后合并。
> 检查命令（全部必须通过）：
> ```
> npx tsx --test tests/*.test.ts
> npx tsc --noEmit
> npm run lint
> npm run build
> ```

### PR v1（1.1 + 1.2 + 1.3 + 1.4，migration 0018）
1. [ ] `lib/server/admin-validation.ts:195` 改为 `capacity < 0`；`app/page.tsx:1549` 改为 `capacity < 0`；`components/views/admin-view.tsx:485` 改为 `min="0"`。
2. [ ] 在 `admin-view.tsx` 场次行增加“标记已满”按钮（`capacity > bookedSpots` 时显示），在 `app/page.tsx` 实现 `onMarkSessionFull`，调用 PATCH 并传 `capacity = bookedSpots`。前端提示 `capacity_too_low`。i18n 增加 `markFull`（en/zh）。
3. [ ] `courtside-home-view.tsx:346-348` 在 capacity 为 0 时显示 `t.full`；`home-view.tsx:117` 让满员卡片仍能进入详情。
4. [ ] `lib/formatters.ts:52-55` 阈值改为 `<= 60` 并更新注释；非 30 分钟倍数时用 `formatDuration` 格式。
5. [ ] `runtime.ts` 和 `.env.example` 增加 `ADMIN_NOTIFY_EMAIL`（注释里写明生产值 `una.ge2502@gmail.com,leeuwenhook.sun@gmail.com`）；在 Vercel Production 和 Preview 配置该变量。
6. [ ] 在 `db/schema.ts` 的 bookings 中加 `adminNotificationStatus/ClaimedAt/SentAt`，执行 `npm run db:generate -- --name admin_booking_notifications`，在 SQL 末尾补 `UPDATE bookings SET admin_notification_status='skipped';`。
7. [ ] 更新 `lib/server/database.ts` 的 `BookingRow` 和 `app/email-preview/page.tsx` 的 booking 字面量。
8. [ ] 在 `email.ts` 中实现 `adminNotifyRecipients`、render/send 管理员订单通知、render/send 管理员申请通知（使用 `escapeHtml`）。
9. [ ] 在 `booking-email.ts` 中实现带认领机制的 `sendAdminBookingNotificationOnce`（不抛错）；在 `stripe/webhook/route.ts:86` 后和 `bookings/[id]/route.ts:74` 后调用。
10. [ ] `reservation-requests/route.ts` 和 `reservation-requests/[id]/applications/route.ts` 插入成功后执行 `await` + `try/catch` 发送通知。
11. [ ] `email-preview` 增加管理员通知预览。
12. [ ] 删除 `detail-view.tsx:150-160` 和 `globals.css` 中的 `.detail-about` 样式；如果 `aboutSession` 不再使用，一并删除。
13. [ ] 场次描述改为可选，并在服务端 POST/PATCH 中用 `generateSessionDescriptions` 自动生成；`tennis-utils.ts:270-271` 默认值改为空；表单 placeholder 写“留空自动生成”。
14. [ ] 新测试：`tests/admin-validation.test.ts`、`tests/formatters.test.ts`、`tests/admin-notify.test.ts`。
15. [ ] 验收：后台把无人报名的场次设为 0，首页、courtside 和详情页显示“已满”，checkout 返回 409；有报名的场次点“标记已满”后同样生效；1.5h 场次显示标签、1h 不显示；Preview 环境用 Stripe 测试卡下单，用户和两位管理员各收到 1 封邮件，刷新确认页 5 次不重复；提交找球友需求和加入申请后管理员各收到 1 封；详情页不再出现重复段落；新建场次描述留空时自动生成中英文。

### PR v2-a（2.1 + 2.2，migration 0019）
16. [ ] 修改 `schema.ts`：`preferredDate/startTime/endTime` 可空，加 `preferredSlotsJson`、`expiresOn`；两张表加 `wechat/whatsapp/preferredContact`。执行 `npm run db:generate -- --name partner_request_slots_contacts`，补 `UPDATE ... SET expires_on = preferred_date`。
17. [ ] 新建 `lib/partner-request-slots.ts`，包含 slot 常量和双语 label。
18. [ ] 按 A.2.1 和 A.2.2 修改 `reservation-request-validation.ts`（两个 validate 函数）。
19. [ ] 修改 `reservation-requests/route.ts`：GET 用 `expires_on` 过滤、新增 `slot` 过滤、`NULLS LAST` 排序；POST 写入新列。`applications/route.ts` 两处 `preferred_date` 改为 `expires_on`。
20. [ ] 修改 `database.ts` 的 row 类型和两个 serializer；`types/tennis.ts:143,166` 改为 `preferredDate: string | null`，并加 `preferredSlots`、`expiresOn`、`wechat`、`whatsapp`、`preferredContact`。
21. [ ] UI：`request-view.tsx`（slot chips 与日期切换、联系方式和首选方式）、`public-partner-requests.tsx`（卡片显示、slot 筛选、加入申请表单的联系方式，**更新其内置文案字典**）、`admin-view.tsx:1296-1311`（无日期时的显示和联系方式）、`admin-paste-requests.tsx`。
22. [ ] 在 `lib/partner-request-parser.ts` 中识别 slot 关键词并调整 `missing` 规则；在 `app/api/chat/route.ts` 和 `lib/booking-assistant.ts` 中加 `preferredSlots`。
23. [ ] `lib/translations.ts` 增加 en/zh 两套 key：slot 标签、`wechat`、`whatsapp`、`preferredContact`、`contactPrivacyNote`。
24. [ ] 更新已有 4 个 partner-request 测试，新增 slot 校验、过期和解析器测试。
25. [ ] 验收：创建一个“未订场 + 工作日晚上”的需求，看板能看到，按 slot 能筛选，能提交加入申请；创建“已订场”需求时仍要求日期和时间；首选 WeChat 但没填 WeChat 时被拒；公开 API 响应中没有任何联系方式（DevTools 检查）。

### PR v2-b（3.1，migration 0020）
26. [ ] 按 A.3.1 修改 `schema.ts`，执行 `npm run db:generate -- --name booking_followup_emails`，补上把历史数据置为 skipped 的 UPDATE；新建 `email_suppressions` 表。
27. [ ] 新建 `lib/server/booking-followups.ts`（含纯函数 `isFollowupDue`、认领发送、推荐场次查询、suppression 检查）、`lib/server/booking-followup-cron.ts`、`app/api/cron/session-followups/route.ts`。
28. [ ] 在 `email.ts` 中实现 `renderBookingFollowupEmail` 和 `sendBookingFollowupEmail`；在 `email-preview` 中增加 followup 卡片。
29. [ ] 新建 `app/api/email/unsubscribe/route.ts`（签名 token，复用 B.3 的 `lib/server/signed-token.ts`，可以在这个 PR 先实现）。
30. [ ] `vercel.json` 增加 `0 9 * * *` 和 `0 20 * * *` 两条 `/api/cron/session-followups`。
31. [ ] 新建 `tests/booking-followups.test.ts`。
32. [ ] 验收：在 Preview 用 `curl -H "Authorization: Bearer $CRON_SECRET" <preview>/api/cron/session-followups`，已结束超过 1 小时的测试订单收到 1 封，重复调用不重发；上线前的历史订单不发；退款订单不发；退订后不再发送。

---

# Part B — 3.2 赛后评论模块：详细开发规格

## B.1 目标与范围
- 打过球的球友（有 **confirmed booking**）通过 3.1 的赛后邮件链接，提交 1 条留言 + 最多 6 个媒体（≤5 张图片、≤1 段视频）。
- 默认 `pending`，管理员审核通过（`approved`）后才公开。
- 公开展示在 `DetailView`（按 `venueId` 聚合）的“球友留言 / Player stories”墙。
- 不引入用户账号；身份通过**签名 token** 证明。

## B.2 现有认证体系（实际情况）
- 管理员：`lib/server/admin-auth.ts`，HMAC-SHA256 签名 cookie（`ADMIN_SESSION_SECRET`），API 用 `requireAdmin(request)`。新管理员 API 全部用这个。
- 用户账号：`lib/server/user-auth.ts`（可选注册，cookie session，`bookings.user_id` 可空）。评论**不依赖**账号；登录用户可以在 `account-view.tsx` 的历史订单中看到“写评价”入口（Phase 3 可选，入口生成同样的 token）。
- 付款返回页的鉴权方式是 booking id + Stripe checkout session id（`bookings/[id]/route.ts:36-38`），不适合用于评论。

## B.3 签名 token 设计
- 新模块 `lib/server/signed-token.ts`（通用，同时供退订使用）：
  - `signToken(purpose: 'review' | 'unsubscribe', payload: Record<string, string|number>, ttlSeconds)` 生成 `base64url(JSON{p:purpose, ...payload, exp}).base64url(HMAC_SHA256(secret, purpose + '.' + body))`；`verifyToken(purpose, token)` 用 `timingSafeEqual` 校验，返回 payload 或 null。实现方式参考 `admin-auth.ts:42-68`。
  - secret：新 env `REVIEW_TOKEN_SECRET`。生产环境缺失时直接拒绝（同 `admin-auth.ts:17-21` 的做法），**不要回落到 ADMIN_SESSION_SECRET**，避免密钥复用。
- review token payload：`{ b: bookingId, v: 1, exp }`。TTL 90 天（提交窗口 30 天由服务端另外判断，剩余时间用于自助修改或删除）。
- 每次使用时服务端都要重新校验：booking 存在、`status = 'confirmed'`（退款或取消后 token 失效）、场次已结束；**提交**要求在场次结束后 30 天内，**删除**在 token 有效期内都允许。
- 链接：`https://www.tennismatch.space/review?t=<token>`。3.1 邮件里的 `reviewUrl` 由 `REVIEWS_ENABLED === 'true'` 控制，3.2 上线前不显示按钮。
- token 只出现在 URL 中，页面加载后用 `history.replaceState` 把它移到内存，减少 Referer 和浏览器历史泄露；页面加 `<meta name="referrer" content="no-referrer">`。

## B.4 数据模型（migration `0021_session_reviews`）

```ts
// db/schema.ts
export const sessionReviews = pgTable('session_reviews', {
  id: text('id').primaryKey(),                         // `review-${uuid}`
  bookingId: text('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  venueId: text('venue_id').notNull(),                 // 冗余，便于按场地查询
  displayName: text('display_name').notNull(),         // 用户自填昵称或名，≤40 字符
  rating: integer('rating'),                           // 1–5，可选
  body: text('body').notNull(),                        // 1–1000 字符
  language: text('language', { enum: ['en', 'zh'] }).notNull().default('en'),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'hidden'] }).notNull().default('pending'),
  consentPublic: boolean('consent_public').notNull(),          // 同意公开展示文字
  consentMedia: boolean('consent_media').notNull().default(false), // 同意公开展示图片/视频（含其中可识别的人）
  consentAt: text('consent_at').notNull(),
  moderationNote: text('moderation_note').notNull().default(''),
  moderatedBy: text('moderated_by'),                   // admin username（来自 cookie 的 sub）
  moderatedAt: text('moderated_at'),
  submitIpHash: text('submit_ip_hash'),                // sha256(ip + secret)，用于防刷，不存明文 IP
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('session_reviews_booking_unique').on(t.bookingId),   // 每个 booking 1 条
  index('idx_session_reviews_venue_status_created').on(t.venueId, t.status, t.createdAt),
  index('idx_session_reviews_status_created').on(t.status, t.createdAt),
]);

export const reviewMedia = pgTable('review_media', {
  id: text('id').primaryKey(),
  reviewId: text('review_id').references(() => sessionReviews.id, { onDelete: 'cascade' }), // 上传时可为空，提交时绑定
  bookingId: text('booking_id').notNull(),             // 上传阶段的归属
  kind: text('kind', { enum: ['image', 'video'] }).notNull(),
  blobUrl: text('blob_url').notNull(),
  blobPathname: text('blob_pathname').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'), height: integer('height'),
  durationSeconds: integer('duration_seconds'),        // 客户端上报，仅供参考
  posterUrl: text('poster_url'),                       // 视频封面（客户端截帧上传的 jpg）
  status: text('status', { enum: ['uploaded', 'attached', 'pending', 'approved', 'rejected', 'hidden'] }).notNull().default('uploaded'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('review_media_blob_pathname_unique').on(t.blobPathname),
  index('idx_review_media_review').on(t.reviewId, t.sortOrder),
  index('idx_review_media_booking_status').on(t.bookingId, t.status),
]);
```
- 状态语义：`pending` 等待审核；`approved` 公开；`rejected` 不公开（7 天后清理 blob）；`hidden` 曾公开、被管理员下架（保留 blob，可恢复）。媒体可以单独审核：评论 approved 但某张图 rejected 时，只公开其余媒体。
- `reviewMedia.status` 的 `uploaded` 表示已上传但还没提交评论（孤儿），24 小时后由清理任务删除。
- 用 `npm run db:generate -- --name session_reviews` 生成。这张表是新建的，没有历史数据问题。

## B.5 API 路由

| 方法 & 路径 | 鉴权 | 说明 |
|---|---|---|
| `GET /api/reviews/context?t=` | review token | 返回 `{ booking: {id, venueName, date, startTime, endTime}, existingReview?, canSubmit, canDelete, limits }`。**不返回邮箱或电话** |
| `POST /api/reviews/upload` | review token（放在 `clientPayload`） | `@vercel/blob/client` 的 `handleUpload` 端点，见 B.6 |
| `POST /api/reviews` | review token（body.t） | 提交：`{ t, displayName, rating?, body, language, consentPublic: true, consentMedia, media: [{url, kind, width?, height?, durationSeconds?, posterUrl?}] }`。校验见 B.6/B.9；写 review(pending)，并把 media 状态改为 `pending`、绑定 `reviewId`；通知管理员（复用 A.1.3 的 `adminNotifyRecipients`） |
| `PATCH /api/reviews` | review token | 在 `pending` 状态下允许修改；`approved` 之后修改会回到 `pending` |
| `DELETE /api/reviews?t=` | review token | 用户自助删除：删除 DB 行并 `del()` 所有 blob，返回 204（GDPR 删除权） |
| `GET /api/venues/:id/reviews?cursor=&limit=` | 公开 | 只返回 `approved` 且 `consent_public` 的评论；只有 `consent_media` 为 true 时才返回 approved 媒体。字段：`id, displayName, rating, body, language, createdAt(仅月份), sessionDate(仅月份), media[{kind,url,posterUrl,width,height}]`。按 `(created_at, id)` 做 keyset 分页，`limit ≤ 12`，默认 6 |
| `GET /api/admin/reviews?status=pending&cursor=` | `requireAdmin` | 审核列表，包含 booking 联系人（仅管理员可见）、全部媒体（含 pending） |
| `PATCH /api/admin/reviews/:id` | `requireAdmin` | `{ status, moderationNote?, mediaStatus?: {[mediaId]: status} }` |
| `DELETE /api/admin/reviews/:id` | `requireAdmin` | 硬删除（DB + blob），用于处理邮件提出的删除请求 |
| `GET /api/cron/review-media-cleanup` | `CRON_SECRET` | 每日：删除超过 24 小时的 `uploaded` 孤儿媒体、超过 7 天的 rejected 媒体对应的 blob |

所有路由都设置 `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`（同现有路由）。错误码风格沿用 `{ error: 'snake_case' }`。

## B.6 Vercel Blob 客户端直传

**依赖与配置**：`npm i @vercel/blob`；在 Vercel 项目中创建 Blob Store（会自动注入 `BLOB_READ_WRITE_TOKEN`），`.env.example` 加上该变量的注释。

**服务端** `app/api/reviews/upload/route.ts`：
```ts
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body, request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { t, kind } = JSON.parse(clientPayload ?? '{}');
        const ctx = await loadReviewContext(t);              // verifyToken + booking confirmed + 场次已结束 + 30 天内
        if (!ctx?.canSubmit) throw new Error('forbidden');
        await assertMediaQuota(ctx.bookingId, kind);         // DB 计数：image ≤5, video ≤1（含 uploaded 状态）
        return {
          allowedContentTypes: kind === 'video'
            ? ['video/mp4', 'video/quicktime', 'video/webm']
            : ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: kind === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024,
          addRandomSuffix: true,
          // pathname 由客户端提供，服务端在提交时校验其前缀
          tokenPayload: JSON.stringify({ bookingId: ctx.bookingId, kind }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 可选的冗余登记；本地开发时 Vercel 回调不到 localhost，所以**不依赖**此回调
        await recordUploadedMedia(blob, tokenPayload);       // ON CONFLICT (blob_pathname) DO NOTHING
      },
    });
    return Response.json(result);
  } catch { return Response.json({ error: 'upload_forbidden' }, { status: 400 }); }
}
```
- 客户端 pathname 约定：`reviews/<bookingId>/<uuid>.<ext>`。提交时服务端校验 URL 的 host 属于本 store、pathname 以 `reviews/<bookingId>/` 开头，再调用 `head(url)` 取得**真实**的 `size` 和 `contentType` 并重新校验，然后写入或更新 `review_media`。即使 `onUploadCompleted` 没有触发，提交时也会登记。
- **服务端强制项**：token 有效性、媒体数量配额、content-type 白名单、大小上限（由 Blob token 本身限制，并在提交时用 `head()` 复核）、pathname 归属。
- **只能在客户端强制的项**：视频时长 ≤ 60 秒。上传前用隐藏的 `<video preload="metadata">` 加载 `URL.createObjectURL(file)`，在 `loadedmetadata` 时读取 `duration`，`> 60.5` 时拒绝并提示。服务端只把客户端上报的 `durationSeconds` 存下来供参考。**管理员审核是兜底**：审核界面显示真实时长（`<video>` 播放器）。可选 Phase 3：服务端用 Range 请求读取 MP4/MOV 的 `moov/mvhd` box 解析时长（几 KB，不需要 ffmpeg），超时就拒绝。
- **客户端图片处理**：`createImageBitmap` + canvas 把长边缩到 ≤ 2048px，重新编码为 JPEG（质量 0.85）。这样能**去掉 EXIF（包括 GPS 位置）**，也能降低存储和流量成本。HEIC：iOS Safari 的 `<input accept="image/*">` 通常会自动转成 JPEG；仍然收到 `image/heic` 时，canvas 无法解码，提示用户换格式（白名单本身也不包含 heic）。
- **视频**：不转码。iPhone 默认 HEVC `.mov`，在部分 Android 和 Chrome 上无法播放。前端提示“建议使用 1080p / 兼容格式”；审核界面在无法播放时显示“该格式在部分设备无法播放”。视频的 GPS 元数据无法在客户端可靠去除，在同意条款中说明，审核时注意。
- **50MB / 60 秒的现实问题**：iPhone 1080p30 的 H.264 视频约 100MB/分钟，HEVC 约 60MB/分钟。**很多 60 秒视频会超过 50MB**。前端提示“请先在相册中剪辑，或使用 720p 拍摄”。是否放宽到 100MB 列为开放问题（O-2）。
- **封面**：客户端在视频第 1 秒截帧到 canvas，作为一张 image（kind=image，标记 `posterFor`）上传，或者直接把 URL 填到 `posterUrl`。截帧失败就不显示封面。
- **Blob 访问权限**：使用 `access: 'public'` 加随机后缀。待审核的媒体虽然理论上可以通过 URL 访问，但 URL 不可猜测且不会被列出；rejected 的媒体 7 天内会被删除。如果 owner 要求待审核内容严格私有，可以评估 Vercel Blob 的 private 存储（以当时文档为准）。列为开放问题 O-3。

## B.7 前端：提交页 `/review`
- 新文件 `app/review/page.tsx`（独立页面，参考 `app/email-preview/page.tsx` 和 `app/admin/page.tsx` 的做法），客户端组件 `components/review-form.tsx`。复用 `components/ui/{input,textarea,checkbox,button,field,progress,alert}`。不加入 SPA 的 `View` 枚举（避免改 `routeStateFromLocation`）。
- 流程：读取 `?t` → `GET /api/reviews/context` → 显示场次信息 → 填写表单：昵称（placeholder “名字或昵称，将公开显示”，默认预填 `contact_name` 的**名**（first token），用户可修改）、星级（可选）、留言、媒体选择器（显示每个文件的进度，用 `upload()` 的 `onUploadProgress`）→ 勾选同意 → 提交 → 显示“感谢，审核后展示”。已经提交过时显示现有内容和“删除我的评价”按钮。
- 同意项（双语，`lib/translations.ts` 新增 `review*` key）：
  1. **必选**：“我同意 Tennis Match 在网站上公开展示我的留言和昵称。”
  2. **有媒体时必选**：“我确认照片/视频由我拍摄或已获得画面中所有人的同意，并同意公开展示。”
  3. 隐私说明链接：说明数据用途、保留期、如何删除（自助删除链接或发邮件给管理员）。
- 提交按钮在所有上传完成前保持禁用。

## B.8 管理员审核 UI
- `types/tennis.ts:7` 的 `AdminTab` 增加 `'reviews'`。`components/views/admin-view.tsx:875-915` 的 tab 栏加一个按钮（带 pending 数量 badge），并在 `:917` 起的条件渲染中加入 `adminTab === 'reviews'` 分支。建议把内容抽成独立组件 `components/admin-reviews.tsx`（参考 `components/admin-paste-requests.tsx` 的独立组件模式），避免 `admin-view.tsx`（1436 行）继续膨胀。数据加载放在组件内部用 `fetch`，不放进 `app/page.tsx` 的 state。
- 列表：状态筛选（pending 默认 / approved / rejected / hidden），每条显示场地、场次日期、联系人姓名和邮箱（仅后台可见）、昵称、星级、留言、媒体缩略图（图片 `loading="lazy"`；视频 `<video controls preload="metadata">`，并显示文件大小和上报时长）、同意项状态。
- 操作：通过 / 拒绝（可填备注）/ 隐藏 / 恢复 / 单个媒体拒绝 / 硬删除（二次确认，使用 `components/ui/alert-dialog.tsx`）。
- 管理员通知：有新的 pending 评论时，用 `sendAdminReviewNotification` 发邮件给 `ADMIN_NOTIFY_EMAIL`。

## B.9 公开留言墙（DetailView）
- 新组件 `components/venue-reviews.tsx`，插入到 `detail-view.tsx` 原 `.detail-about` 的位置（v1 删除后空出的地方），props：`venueId, language, t`。
- 首屏只请求 `GET /api/venues/:id/reviews?limit=6`。用 `IntersectionObserver` 在组件进入视口时才开始 fetch。有更多数据时显示“加载更多”按钮（不做无限滚动），分页用 keyset cursor。
- 图片：`<img loading="lazy" decoding="async" width height>`，点击用 `components/ui/dialog.tsx` 打开大图。视频：`<video preload="none" poster={posterUrl} controls playsInline>`，用户点击才加载，**不自动播放**。
- 隐私：只显示 `displayName`（服务端再截断到 40 字符）、月份级日期（“2026 年 10 月”）、星级；**不显示**姓氏、邮箱、具体场次时间。没有评论时整个区块不渲染（或显示“打完球后可以在邮件里留言”）。
- 可选：在 `home-view` / `courtside-home-view` 的场地卡片上显示平均星级（Phase 3）。

## B.10 防刷与滥用
- 主要门槛是 token：只有 confirmed booking 的邮箱能拿到链接；每个 booking 只能有 1 条评论（唯一索引），媒体配额 ≤5 张图 + ≤1 个视频（上传 token 生成时检查 DB 计数，包含孤儿媒体，所以反复上传也会被挡住）。
- 频率：同一 booking 每 10 分钟最多生成 20 个上传 token。基于 DB 计数实现（查 `review_media.created_at`），不引入 Redis。`submit_ip_hash` 只用于审计。
- 内容：body 长度 1–1000，displayName 1–40，去掉控制字符；只渲染纯文本（React 默认转义），URL 不自动变成链接。审核本身就是最终的过滤。
- 提交接口的 JSON body 限制在 20KB 以内（媒体只传 URL）。

## B.11 删除与 GDPR（UK GDPR / DPA 2018）
- 合法依据：公开展示基于**同意**（明确勾选，`consent_at` 留痕），并且可以随时撤回。
- 删除权：
  1. 用户自助：在 token 有效期（90 天）内通过 `/review?t=` 删除，DB 行和 blob 立即删除。
  2. token 过期后：用户发邮件给管理员，管理员在后台硬删除。隐私说明里写明联系邮箱。
  3. 预订数据被删除时（`bookings` 行），通过外键 cascade 删除 review 和 media 行。blob 需要应用层调用 `del()`，所以任何删除都必须走 `deleteReviewCompletely(db, reviewId)` 这个统一函数（先 `del(urls)`，再删 DB 行）。
- 保留期：rejected 的媒体 7 天后删除 blob（cron），rejected 的文字 90 天后删除；hidden 保留到管理员手动处理。
- 最小化：不存明文 IP；不在公开 API 中返回 booking/email；图片在客户端去掉 EXIF；日志不打印 token 和邮箱。
- 未成年人：同意文案中加入“未成年人出现在画面中需监护人同意”，审核时注意。
- 隐私政策页：仓库目前**没有**隐私政策页面。至少要在提交页内放一段隐私说明（B.7）。建议另立需求补正式的隐私政策页面（开放问题 O-5）。

## B.12 环境变量
| 变量 | 说明 |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Store 自动注入；本地用 `vercel env pull` 获取 |
| `REVIEW_TOKEN_SECRET` | 32+ 字节随机值；生产缺失时评论功能返回 503 |
| `REVIEWS_ENABLED` | `true` 时 3.1 邮件显示评价按钮、`/review` 可用；用于灰度上线 |
| `ADMIN_NOTIFY_EMAIL` | 复用 A.1.3 |
| `CRON_SECRET` | 复用，用于清理 cron |
同步更新 `lib/server/runtime.ts` 和 `.env.example`。

## B.13 成本估算（以 Vercel 当前定价页为准）
- Blob 按存储量（GB·月）、数据传输量（GB）和操作次数计费，Hobby 有少量免费额度。
- 估算：每月 50 条评论，每条 3 张图（压缩后约 0.5MB）加 20% 带 1 段 30MB 视频，每月新增约 0.4GB 存储。**主要成本在视频流量**：一个视频被播放 100 次就是 3GB 流量。所以视频必须 `preload="none"` 并显示封面，留言墙首屏不加载视频。
- 降本手段：客户端压缩图片；清理孤儿和 rejected 媒体；视频是否放宽大小（O-2）需要和流量成本一起权衡；必要时只在后台展示视频，公开墙只展示封面加点击播放（已经是这个设计）。
- `vercel.json` 新增 `review-media-cleanup` 每日 1 条（Hobby 兼容）。

## B.14 测试计划
- 单元测试（`npx tsx --test tests/*.test.ts`）：
  - `tests/signed-token.test.ts`：签名和校验、过期、篡改 payload、purpose 混用（拿 unsubscribe token 当 review token 用）被拒。
  - `tests/review-validation.test.ts`：body 和 displayName 的长度与控制字符；consent 规则（有媒体但 `consentMedia=false` 时被拒）；媒体数量上限；URL 前缀归属校验。
  - `tests/review-eligibility.test.ts`：场次未结束、结束超过 30 天、refunded/cancelled 等情况下 `canSubmit` 为 false；删除在 90 天内允许。
  - `tests/review-serialize.test.ts`：公开序列化不包含 email/booking id，日期只到月份，`consentMedia=false` 时不返回媒体。
- 手动测试（Vercel Preview，因为需要真实的 Blob Store）：iOS Safari 和 Android Chrome 上传 HEIC/JPEG、61 秒视频被拒、55MB 文件被拒（服务端 token 限制）、断网重试、审核流程、公开墙分页和懒加载（DevTools Network 中视频在点击前不请求）、自助删除后 blob URL 返回 404。
- `npx tsc --noEmit`、`npm run lint`、`npm run build` 全部通过。

## B.15 上线阶段
1. **Phase 0（随 v2-b 一起）**：实现 `lib/server/signed-token.ts`；3.1 邮件预留 `reviewUrl`（由 `REVIEWS_ENABLED` 控制，默认关闭）。
2. **Phase 1：只有文字评论**。migration 0021（两张表都建好）、`/review` 页面、提交/删除 API、后台审核 tab、DetailView 留言墙。打开 `REVIEWS_ENABLED`。
3. **Phase 2：图片**。接入 `@vercel/blob`、上传端点、客户端压缩、媒体审核、清理 cron。
4. **Phase 3：视频**，以及可选的服务端时长解析、account-view 的“写评价”入口、场地卡片平均星级。
每个阶段都按 A.5 的检查命令执行；migration 先在生产库执行再合并。

## B.16 开放问题
- O-1 一个 booking 有多名参与者时，是否允许每个人各写一条？目前 `participants_json` 只有水平信息、没有邮箱，所以**只支持联系人写 1 条**。
- O-2 视频大小限制是否从 50MB 放宽到 100MB（结合 B.6 中的实际视频大小和 B.13 的流量成本）。
- O-3 待审核媒体是否必须严格私有（private blob），还是接受“不可猜测的公开 URL + 不列出”。
- O-4 星级是否需要；是否在场地卡片上显示平均分。
- O-5 是否单独做隐私政策页面，以及正式的数据控制者联系邮箱。
- O-6 评论是否要关联到 venue 级描述（A.1.4 第 4 条）一起展示。
