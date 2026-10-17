# 代码评审 — `feat/feedback-2026-10-17`（v1 + v2-a + v2-b/3.1）

> 评审范围：`git diff 02e7c82..HEAD`（Codex 的 4 个提交：a979fc4、6dcf717、c148fb5、9411072）
> 对照文档：`2026-10-17_tennis-match-feedback-plan.md`、`2026-10-17_plan-review-and-3.2-spec.md`（A.5 清单）、`2026-10-17_implementation-report.md`
> 3.2（评论/媒体模块）按约定**未实现**，本次也没有实现。
> 日期：2026-10-17。修复都在工作区里，**没有 commit / push**，没有连接生产库或 Vercel。

## 总体结论

实现基本覆盖了 A.5 的 1–31 条，质量比较高：
- 管理员通知和赛后邮件都有独立的 `pending/sending/sent/skipped` 认领和 10 分钟过期重认领。
- 0018 和 0020 会把历史数据置为 `skipped`。
- 公开 serializer 不返回任何联系方式。
- 签名 token 使用 `timingSafeEqual`，有长度检查，也绑定了 purpose。
- 邮件 HTML 都经过 `escapeHtml`。
- webhook 用 `try/finally` 隔离管理员通知，不会让 Stripe 重试流程出错。
- 伦敦时区处理覆盖了 BST/GMT、秋季重复小时和 `24:00`。

发现 **1 个 BLOCKER、3 个 SHOULD-FIX、11 个 NIT**。BLOCKER 和 SHOULD-FIX 已全部修复，并补了测试。

## Findings

### BLOCKER

- **B1 自动生成的场次描述会写进错误日期，内容也不会随编辑更新** — `app/page.tsx:1693`（`createRecurringSessions`）、`app/api/admin/sessions/[id]/route.ts:35-38`、`app/api/admin/sessions/route.ts:35-38`
  - 现象：`generateSessionDescriptions` 生成的中英文文案包含具体日期、时间和“最多 N 人”。描述为空时服务端只自动生成一次，之后这段文案就和普通文本一样固定下来。
  - 场景 1：后台点“创建后续几周”时，会原样复制源场次的 `description`。4 个新场次的详情页顶部都会写着**源场次的日期**。这正是 1.4 要解决的“顶部简介”位置，用户会看到错误日期。
  - 场景 2：修改日期/时间，或点“标记已满”（capacity 改为 bookedSpots）后，文案里仍然是旧日期，或“最多 8 人”。
  - 已修复：新增 `resolveSessionDescriptions(current, previous?)`（`lib/server/session-description.ts`）。
    - 描述为空时，按当前字段生成。
    - 描述**和旧字段生成的自动文案完全一致**（也就是管理员没有改过）时，按新字段重新生成。
    - 自定义文案保持不变。
    - PATCH 用数据库里的旧行作为 `previous`。`createRecurringSessions` 在复制前判断源描述是否为自动文案，是的话清空，由 POST 按新日期重新生成。
  - 测试：`tests/session-description.test.ts`。

### SHOULD-FIX

- **S1 发布窗口内旧代码写入的找球友需求会从看板消失，也无法申请** — `app/api/reservation-requests/route.ts:39`、`app/api/reservation-requests/[id]/applications/route.ts:27,48`
  - 现象：按流程，0019 会在合并前先在生产库执行。从迁移到新代码部署之间，旧代码插入的行 `expires_on IS NULL`（0019 的 backfill 只处理执行迁移时已经存在的行）。新代码用 `expires_on >= today` 过滤，NULL 比较为假，这些需求会从公开看板消失，申请时一直返回 `request_closed`。
  - 已修复：三处改为 `COALESCE(requests.expires_on, requests.preferred_date) >= today`。这和 serializer 的 `expires_on ?? preferred_date` 一致。表很小，索引是否命中不影响性能。

- **S2 聊天助手的回归：只有日期、没有时间段的草稿永远不能提交** — `app/api/chat/route.ts:118-136`
  - 现象：校验规则要求“非 booked 时至少 1 个 slot”。聊天草稿不带 `venueBookingStatus`（默认 `unknown`），所以只要 Gemini 返回了具体日期和时间、但 `preferredSlots` 为空（模型经常这样），`readyToSubmit` 就一直是 false。用户会卡在“总结 → 不能提交”的循环里。Codex 的做法是在 `tests/booking-chat.test.ts` 的 fixture 里补上 `preferredSlots`，这样测试能通过，但问题被掩盖了。
  - 已修复：新增 `slotForSchedule(date, startTime)`（`lib/partner-request-slots.ts`）。草稿没有 slot、但有完整日期时，按星期几和开始时间推导一个 slot（周末 → `weekend_any`，<12 点 → 上午，<17 点 → 下午，其他 → 晚上）。同时把 system prompt 第一句恢复为身份说明，时间段提示放到后面。
  - 测试：`tests/booking-chat.test.ts` 新增“dated drafts without time slots…”。

- **S3 退订链接用 GET 直接改状态，会被邮件安全扫描或链接预取误触发** — `app/api/email/unsubscribe/route.ts`
  - 现象：Outlook Safe Links、企业邮件网关和部分客户端会自动 GET 邮件里的链接，收件人没有点击也会被退订。邮件里也没有 `List-Unsubscribe` 头。
  - 已修复：
    - GET 只校验 token，然后返回一个带 POST 表单的确认页（`no-store`、`no-referrer`），不写库。
    - POST 校验 token 后写入 `email_suppressions`。POST 同时支持 RFC 8058 one-click。
    - `sendBookingFollowupEmail` 增加 `List-Unsubscribe: <url>` 和 `List-Unsubscribe-Post: List-Unsubscribe=One-Click`，Gmail/Apple Mail 会显示原生“退订”按钮。
  - 测试：`tests/email-unsubscribe.test.ts` 改为验证 GET 不访问数据库、POST 幂等写入、非法 token 在 GET 和 POST 都返回 400。

### NIT（未修，原因见每条）

- **N1 — Round 2 已解决**：未设置或留空 `ADMIN_NOTIFY_EMAIL` 时，内建收件人为 `una.ge2502@gmail.com` 和 `leeuwenhook.sun@gmail.com`；可用逗号分隔的 env 值覆盖。无需为启用通知配置此 env。非空但全为非法地址的覆盖仍会跳过发送。
- **N2** `db/migrations/0018_admin_booking_notifications.sql:4` — 迁移把**所有**订单（包括执行迁移时正在付款的 `pending_payment`）都置为 `skipped`，这几笔付款成功后不会通知管理员。这是计划要求的保守做法，可以接受。
- **N3** `lib/server/booking-followups.ts` — 同一个邮箱在同一场次有多笔 booking 时，会收到多封赛后邮件。目前一个 booking 对应一个联系人，实际很少出现。
- **N4** `lib/server/booking-followup-cron.ts:7` — `CRON_SECRET` 用 `!==` 比较，不是 timing-safe。这和现有 `booking-reminder-cron.ts` 一致，而且 secret 是高熵随机值，风险可以忽略。如果要改，两处一起改。
- **N5** `lib/server/london-time.ts:20` — 春季拨快那天，01:00–01:59 的结束时间不存在，函数会返回 null，这类场次不会发赛后邮件。网球场次不会在这个时间结束。
- **N6** `lib/partner-request-slots.ts` `requestExpiresOn`、`reservation-requests` 的 `today` — 都用 UTC 日期，伦敦 BST 午夜后的 1 小时内会差一天。原有代码就是这样，影响可以忽略。
- **N7** `components/views/admin-view.tsx:146,1321` — 后台的“首选联系方式”直接显示原始枚举值（`email`/`wechat`），没有翻译。只有管理员能看到。
- **N8** `components/admin-paste-requests.tsx:178` — `language={t.email === '邮箱' ? 'zh' : 'en'}` 通过文案反推语言，比较 hacky。功能正确。
- **N9** `components/public-partner-requests.tsx:460-464` — 时间那一行重复判断了 `startTime && endTime`。另外 `PartnerContactFields` 在公开看板里使用 `field`/`native-input` 类，和 `cs-pr-field` 的输入框样式可能不完全一致。需要在手机上验收时看一下。
- **N10** `app/globals.css:1345-1347,3564`、`components/views/detail-view.tsx:150` — 删除 `.detail-about` 后留下了多余空行。
- **N11** `components/views/request-view.tsx:314` — 从“未订场”切换到“已订场”时会清空日期，但不会清空已选的 slot，slot 会一起提交。服务端可以接受，数据无害。

## 已核对、没有问题的点

- **隐私**：`serializePublicReservationRequest` 只返回场地、时间、slot、水平等字段，不包含 email/phone/wechat/whatsapp/preferredContact。公开 GET 和申请接口的响应都不包含联系方式。新联系方式字段只加在两个找球友表单上，符合 owner 决定。
- **签名 token**：HMAC-SHA256，签名输入是 `purpose.body`，payload 里也有 `p`。`timingSafeEqual` 前先比较长度，长度上限 4096。base64url 格式校验、`exp` 检查、拒绝非对象 payload 都有。secret 至少 32 字节，不回落到 `ADMIN_SESSION_SECRET`。缺少 secret 时 `verifyToken` 返回 null，cron 返回 `token_not_configured`。
- **退订滥用**：没有有效签名就不能为任意邮箱退订。重复退订由 `ON CONFLICT DO NOTHING` 保证幂等。退订只影响赛后邮件，不影响交易邮件。
- **HTML escaping**：管理员通知把整段文本放进 `<pre>` 并 `escapeHtml`。赛后邮件的姓名、场地、URL 都经过 escape。有测试覆盖 `<script>`。
- **幂等**：
  - 管理员订单通知使用独立认领。webhook 和确认页轮询都会调用，但只发一封。失败只记录 booking id，不抛出，也不影响用户确认邮件。
  - 赛后邮件：认领时重新检查 `status='confirmed'` 和 suppression，SMTP 前再检查一次，只看 72 小时窗口，并且有 `LIMIT 100`。
  - 找球友通知：await + 内部 catch，不会让提交失败。
- **迁移**：
  - 0018–0020 都是合法的 Postgres SQL。snapshot 的 `prevId` 链为 0017 → 0018 → 0019 → 0020，journal 的 `when` 单调递增，并且大于 0017。
  - `DROP INDEX idx_reservation_requests_status_date` 对应 0005 创建的索引。
  - 新增的 NOT NULL 列都有 default，`DROP NOT NULL` 不影响已有数据。
  - 0020 用 `now() AT TIME ZONE 'Europe/London'` 判断“尚未结束”，`'24:00' > 'HH24:MI'` 的字符串比较也成立。
  - 先迁移、后部署期间，旧代码和新表结构可以兼容（唯一的问题是 S1，已修）。
- **时区**：`londonSessionEnd` 在秋季重复小时取较晚的时刻（不会提前发送），`24:00` 正确跨日。测试覆盖 BST/GMT。
- **i18n**：新增 key（slot、wechat、whatsapp、preferredContact、contactPrivacyNote、markFull、markFullHint、autoDescription）en/zh 两边都有。公开看板自带的文案字典也同步更新了。`aboutSession` 已在两边删除。
- **其他需求**：capacity=0、标记已满、`min="0"`、满员卡片仍可进入详情、时长 >60 分钟显示标签（非 30 分钟倍数时用“1h 5m”格式）、cron `0 9`/`0 20` UTC，都符合计划。

## 检查结果（修复后）

| 命令 | 结果 |
|---|---|
| `npx tsx --test tests/*.test.ts` | ✅ 64 passed / 0 failed（原 61 个，新增 3 个；退订测试已重写） |
| `npx tsc --noEmit` | ✅ 无错误 |
| `npm run lint`（oxlint） | ✅ 无告警 |
| `npm run build` | ✅ 构建成功 |

## 合并前清单（owner）

### 1. Vercel 环境变量（Production + Preview）
- [ ] `ADMIN_NOTIFY_EMAIL` 可省略（默认两位 owner）；仅需更改收件人时设置逗号分隔的覆盖。
- [ ] `REVIEW_TOKEN_SECRET`：新生成的 ≥32 字节随机值，例如 `openssl rand -base64 48`。**不要复用** `ADMIN_SESSION_SECRET`。Preview 和 Production 建议使用不同的值。
- [ ] 确认已有的 `CRON_SECRET`、`SMTP_*`、`EMAIL_FROM` 在两个环境都存在。
- [ ] 确认 Vercel 套餐接受 4 条 cron（原有 2 条 reminders，加上 2 条 session-followups）。Preview 部署成功即说明配置被接受。

### 2. 生产库迁移顺序（合并前，在本地用生产 `DATABASE_URL` 执行）
1. [ ] 备份或创建 Neon 分支快照。
2. [ ] `npm run db:migrate`：按 journal 顺序执行 0018 → 0019 → 0020 → 0021（Round 2 新增，见文末）。
3. [ ] 抽查：
   - `SELECT admin_notification_status, followup_email_status, count(*) FROM bookings GROUP BY 1,2;`：历史订单应为 `skipped`，未来场次的订单应为 followup `pending`。
   - `SELECT count(*) FROM reservation_requests WHERE expires_on IS NULL;`：应为 0。
4. [ ] 尽快合并并部署。从迁移到部署之间，旧代码新建的需求 `expires_on` 为 NULL，新代码已经用 COALESCE 兼容，不需要再补 UPDATE。

### 3. Preview 手动验收
- [ ] 后台：无人报名的场次设为 capacity 0 后，首页、courtside、详情页都显示“已满”，checkout 返回 409。有报名的场次点“标记已满”后同样生效。
- [ ] ~~后台：新建场次时描述留空，会自动生成中英文……（B1）~~ Round 2 已取消场次描述，改为场地描述，验收项见文末“Round 2 review”。
- [ ] 1.5h 场次显示时长标签，1h 场次不显示。详情页不再出现重复的“活动介绍”。
- [ ] Stripe 测试卡下单：用户收到 1 封确认邮件，两位管理员收到 1 封通知。刷新确认页 5 次，不会重复发送。
- [ ] 提交找球友需求和加入申请后，管理员各收到 1 封通知。在 DevTools 检查 `GET /api/reservation-requests` 的响应：不能包含 email/phone/wechat/whatsapp。
- [ ] 找球友：“未订场 + 工作日晚上”的需求能在看板上看到，按 slot 能筛选，能申请。“已订场”时必须填日期和时间。首选 WeChat 但没填 WeChat 时会被拒绝。
- [ ] 聊天助手：只说“12 月 20 日 18:00–20:00”、不提时间段，也能完成并提交（S2）。
- [ ] 赛后邮件：执行 `curl -H "Authorization: Bearer $CRON_SECRET" "<preview>/api/cron/session-followups?force=1"`（Round 2 起，不带 `force=1` 时在伦敦 21 点以外只返回 `{"skipped":"outside_london_21h"}`）。结束超过 1 小时的测试订单收到 1 封邮件，重复调用不重发。历史订单和退款订单不发。
- [ ] 退订：Preview 环境里把邮件链接的域名换成 Preview 域名后打开。打开链接只显示确认页，**不会直接退订**；点按钮后才退订，之后 cron 不再给该邮箱发送。Gmail 里应显示原生“退订”入口。
- [ ] 手机端走查 request-view、公开看板申请弹窗（联系方式字段样式，N9）和后台卡片。

## Round 2 review（commit b760273，`git diff 9fa1f1d..HEAD`）

评审范围：owner 本轮三项决定，即管理员通知默认收件人、场地级描述取代场次描述（迁移 0021）、赛后邮件只在伦敦 21 点发送。本轮未 commit/push，未连接生产库或 Vercel，未实现 3.2，也未改动找球友需求的日期逻辑。

结论：**0 个 BLOCKER、4 个 SHOULD-FIX（已修复）、6 个 NIT（未修）**。

### SHOULD-FIX（已修复）

- **R2-S1** `lib/server/booking-email.ts:77-83`：确认邮件查询场地时只取了固定几列，没有 `description, description_zh`。结果是场地即使写了自定义介绍，确认邮件正文和 `.ics` 的 `Activity:` 也总是自动生成的文案。已在 SELECT 中补上这两列。另外给 `sendConfirmedBookingEmail` 加了可注入的 `send` 参数（默认值不变，写法与 `sendDueBookingFollowups` 一致）。新增测试 `tests/venue-description.test.ts`「booking confirmation loads the stored venue description」：测试里的假 DB 只返回 SELECT 中列出的列；去掉修复后测试失败，加上修复后通过。提醒邮件不使用描述，无需改动。
- **R2-S2** `db/migrations/0021_venue_descriptions.sql:9-45`：回填只排除了自动生成器的文案，没有排除 demo 种子文案。`ensureSeeded` 会给空库写入 demo 场次，`resetSeed` 也会重新写入。这些文案是场次级的，例如 “Friday evening tennis … One place left.”“A full Saturday morning group …”“目前只剩 1 个名额”。如果某场地的真实场次都是自动文案，回填就会退回到这些 demo 文案，并把它们变成长期公开的场地介绍。已用 `NOT IN` 排除历史上全部 demo 文案：英文 9 条（含 f358612 之前 `lib/server/seed.ts` 中的 “Longer Sunday session …” 变体），中文 8 条。
- **R2-S3** `public/session-import-template.xlsx`、`lib/translations.ts:137,511`：模板里仍有 “Description (English/Chinese, optional)” 两列，说明页也写着“留空后会根据场次信息自动生成”，后台导入提示文字也是这样写的。现在这两列会被解析器静默忽略，管理员填进去的内容会直接丢失。处理如下：
  - 已从模板删除这两列，状态列移到 H，寻找水平列移到 I，下拉校验改为 `H6:H205`。
  - 已删除说明页的描述行。
  - 顺带把名额说明从“1 至 1000”改为“0 至 1000；0 表示已满”，与 v1 的 capacity 0 一致。
  - 中英文提示改为“场地介绍在场地设置中维护，不通过导入填写”。
  - 解析器按表头名称匹配列，旧模板（带描述列）仍能导入。
- **R2-S4** 本文档“合并前清单”有 3 处已过时：迁移顺序缺 0021；验收项仍要求测试场次描述（B1）；手动测试赛后邮件的 curl 没有带 `?force=1`，在伦敦 21 点以外只会返回 `skipped`。已在原处更正。

### NIT（未修）

- **R2-N1** `components/views/admin-view.tsx:621-634`：场地描述的标签和 placeholder 直接写成中英双语，没有走 `t.*`。后台场地表单原本就有类似写法，影响不大。
- **R2-N2** `lib/server/email.ts:348`：如果 `ADMIN_NOTIFY_EMAIL` 非空但地址全部非法，通知会被跳过，只打一条 `console.info`，不会回退到默认收件人。这符合“env 覆盖默认值”的决定，已在 N1 说明。
- **R2-N3** `lib/server/booking-followups.ts`：每次最多处理 `LIMIT 100` 条，每天实际只有 1 次通过时间门。如果一天内符合条件的订单超过 100 笔，多出的会顺延到第二天（仍在 72 小时窗口内）。按当前规模不需要处理。
- **R2-N4** `lib/server/email.ts:128,159`：确认邮件只用英文场地介绍。这与现有确认邮件只有英文一致。
- **R2-N5** 迁移中的 `btrim` 只去掉空格。如果有人手动编辑过自动文案并留下了首尾换行，这条文案不会被识别为自动文案。实际几乎不会发生。
- **R2-N6** 新建场次的旧 `description` 列写入的是 `''`。如果回滚到旧代码，这些新场次的详情页简介会是空的（旧代码只在保存时生成文案）。这是回滚期可以接受的降级。

### 已核对、没有问题的点

- **迁移正则 vs 历史生成器**：用 `git log -G` 确认，生成器文案只在 ad6723d 引入过一次，直到 9fa1f1d 删除前都没有变过；a979fc4 只是开始调用它。我用 9fa1f1d 的原始 `generateSessionDescriptions` 生成了 240 种组合，两个正则全部命中，3 条相近的手写文案都没有误判。组合覆盖：
  - 单打 / 双打 / 两者 / 空格式；
  - capacity 为 0、1、8、1000、2.5；
  - 空白场地名、带括号、引号或换行的场地名；
  - BST 和 GMT 日期。

  这次是用 JS 正则（加 `s` 标志，模拟 Postgres ARE 中 `.` 默认匹配换行）验证的。本会话没有获准启动临时 Postgres，所以没有在真实 PG 上重跑；Codex 在实现报告中已用 PG18 单用户模式验证过。
- **生产 Postgres 安全性**：
  - `ADD COLUMN text` 可空、无默认值，只改元数据，不重写表。
  - 回填只更新为 NULL 的字段，重放是安全的。
  - sessions 的列保持不动，可以回滚。
  - journal 的 `when` 单调递增，snapshot 中已有两列。
- **场次描述残留**：以下位置都已经不再引用场次描述：
  - 聊天/预订助手：`app/api/chat/route.ts` 只用静态场地的名称和区域。
  - 提醒、赛后和管理员通知邮件。
  - email-preview、demo 数据、导入解析器。
  - SEO：`app/layout.tsx` 是静态 metadata，没有按场次生成的 meta。

  只有 `lib/translations.ts` 的导入提示和 xlsx 模板还有残留，已在 R2-S3 修复。
- **cron 时间门**：
  - 先校验 `CRON_SECRET`：未配置时返回 503，鉴权失败返回 401。之后才看 `?force=1`。未鉴权的 `force` 无法绕过时间门，测试已覆盖。
  - `vercel.json` 配置为 `0 20` / `0 21` UTC。伦敦时间判断用的是 `Intl` + `Europe/London`，3/29 和 10/25 两个切换日都正确。
  - Vercel cron 在整点内的触发抖动不影响判断，因为判断以小时为粒度。
- **管理员收件人**：env 未设置或为空白时，默认发给两位 owner；有覆盖值时以覆盖为准。测试已覆盖。
- 找球友需求的日期逻辑没有改动。

### 检查结果（本轮修复后）

| 检查 | 结果 |
|---|---|
| `npx tsx --test tests/*.test.ts` | ✅ 70 通过，0 失败 |
| `npx tsc --noEmit` | ✅ |
| `npm run lint`（oxlint） | ✅ 无告警 |
| `npm run build` | ✅ |
| `git diff --check` | ✅ |

### Round 2 合并前补充（owner）

- [ ] 在 Neon 分支或 Preview 库上先执行 0021，然后运行 `SELECT id, name, description, description_zh FROM venues ORDER BY id;`，逐条看回填出来的场地介绍。不合适的直接在后台清空，清空后会使用自动生成的场地文案。确认无误后再在生产库执行。
- [ ] Preview 验收：
  - 后台新建或编辑场地时，中英文介绍留空，详情页显示自动文案，且文案中不出现日期、时间、名额。
  - 填写介绍后，详情页和确认邮件都显示填写的内容（R2-S1）。
  - 场次表单中已没有描述字段。
  - 从后台下载的导入模板已没有描述列。
- [ ] 部署后在 Vercel Cron 页面确认 session-followups 的两条计划为 `0 20 * * *` 和 `0 21 * * *`。
