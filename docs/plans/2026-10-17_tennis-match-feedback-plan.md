# Tennis Match 网站修改 — 开发计划

> 来源：Google Doc《网球🎾Tennis 网站修改Tips》（2026-10-17 读取，含 4 张截图）
> 仓库：`/home/weiyi/tennis-social`（Leeuwenhook/tennis-social，Vercel 生产 https://www.tennismatch.space）
> 技术栈：vinext (Next/React 19) + Neon Postgres (drizzle) + nodemailer SMTP + Vercel Cron

---

## 需求清单（对应文档 9 条）

| # | 需求 | 现状（代码核查） | 优先级 |
|---|------|----------------|-------|
| 1 | 报满后不删场次，capacity 可设为 0，前台显示“已满” | 前台已有 `isFull` 显示（home/courtside/detail view）；但后台校验 `capacity < 1` 被拒（`app/page.tsx:1548`，以及 `lib/server/admin-validation.ts`） | P0 |
| 2 | ≥1 小时以上（如 1.5h）也高亮时长标签 | `lib/formatters.ts:55` 阈值写死 `< 120` 分钟 | P0 |
| 3 | 客户下单后管理员同步收到邮件 | `sendBookingConfirmationEmail` 只发给 `input.booking.email`，无管理员通知 | P0 |
| 4 | 找球友申请：具体日期 → 偏好时间段（工作日上午/下午/晚上、周末任意） | `reservation_requests.preferred_date` 为必填 date；request-view 与 public-partner-requests 都用 `type="date"` | P1 |
| 5 | 联系方式除邮件外增加 WeChat / WhatsApp / Phone | 只有 `email` + `phone` | P1 |
| 6 | 手机号目前是选填 | 表单标注 `(optional)`；需确认：改为必填，还是“至少填一种联系方式” | P1（待确认） |
| 7 | 球友打完后可评论：留言 + 图片/视频 | 无此模块 | P2 |
| 8 | Session 结束后自动发邮件 | 已有 booking-reminders cron（赛前提醒），无赛后邮件 | P1 |
| 9 | 场地描述更改 | 截图为 Tanner St Park：顶部简介和“活动介绍”是同一段文字重复 | P0（内容）/ 待确认文案 |

---

## 阶段 1：快速修复（P0，约半天，可一次发布）

### 1.1 允许 capacity = 0 / 一键“标记已满”
- 改 `lib/server/admin-validation.ts`、`app/page.tsx:1534-1570`：`capacity >= 0` 且 `capacity >= bookedSpots`。
- 后台场次列表加按钮 **“标记已满”** → 把 capacity 设为当前 `bookedSpots`（线下报满时不用删场）。
- `app/api/admin/sessions/import/route.ts:145` 导入同样允许 0。
- `lib/server/session-description.ts:37` 已兼容 0（不输出人数文案），确认无回归。
- 验证：后台把某场设为 0 → 首页卡片显示“已满”、详情页按钮 disabled、`/api/checkout` 拒绝下单（`booked_spots + n <= capacity` 已保证）。

### 1.2 时长高亮阈值改为 >1 小时
- `lib/formatters.ts:55`：`if (durationMinutes <= 60) return null;`（1.5h → “1.5小时场”，1h 不标）。
- 确认：正好 1 小时不需要标。文档写“1小时以上”，默认按 **>60 分钟**。

### 1.3 下单后管理员抄送邮件
- 新增环境变量 `ADMIN_NOTIFY_EMAIL`（`lib/server/runtime.ts` 读取，`.env.example` 补充；Vercel 生产环境配置）。
- `lib/server/email.ts` 新增 `sendAdminBookingNotification(input)`：主题“新报名：{场地} {日期} {时间} · {人数}人”，正文含报名编号、姓名、水平、联系方式、金额。
- 在支付成功后发送确认邮件的同一位置调用（Stripe webhook / `booking-email.ts`），失败不影响用户确认邮件，只记日志。
- 同样给“找球友申请/加入申请”提交加一条管理员通知（截图 4 是后台申请卡片，目前只能登录后台看）。
- 验证：测试环境下单 → 用户与管理员各收到一封。

### 1.4 场地描述修改
- 问题：详情页顶部简介与“活动介绍”使用同一 `description`，重复显示。
- 方案：顶部保留短简介（场地介绍，来自 venue），“活动介绍”全部删除。

---

## 阶段 2：找球友表单升级（P1，约 1–1.5 天）

### 2.1 偏好时间段替代具体日期
- 新字段（migration `0018_partner_request_time_slots.sql`）：
  - `preferred_slots_json text not null default '[]'`，取值：`weekday_morning` / `weekday_afternoon` / `weekday_evening` / `weekend_any`（可多选）。
  - `preferred_date` 改为可空（保留兼容旧数据和“我已订好场”的情况）。
- 表单逻辑：
  - “已订场 (booked)” → 仍填具体日期 + 时间；
  - “未订场/找场” → 多选时间段 chips，不再强制年月日。
- 公开看板 `components/public-partner-requests.tsx`：日期筛选改为“时间段”筛选；卡片显示“工作日晚上 · 周末任意”。
- 后台卡片 & 粘贴解析器 `lib/partner-request-parser.ts` 同步支持时间段。
- 更新 `lib/server/reservation-request-validation.ts`、`lib/translations.ts`（中英文）。

### 2.2 联系方式 规则
- 表单：Email（必填）+ Phone / WeChat / WhatsApp，并加“首选联系方式”单选，默认email。
- 仍保持“审核后才共享联系方式”的隐私承诺：公开看板不显示，只在后台和接受后邮件中展示。

---

## 阶段 3：赛后流程（P1→P2，约 2–3 天）

### 3.1 Session 结束后自动邮件（P1）
- `bookings` 加 `followup_email_status`（pending/sent）。
- 新 cron `app/api/cron/session-followups/route.ts`：每小时扫描 `end_time` 已过 1–2 小时、状态 confirmed 且未发送的预订，发送感谢邮件 + “留下评价/上传照片”链接 + 下次场次推荐。将邮件样例添加到样例网页中。
- `vercel.json` 增加 cron（注意 Vercel 套餐的 cron 频率限制；Hobby 只能每日一次，届时改为每晚 21:00 汇总发送）。

### 3.2 赛后评论模块：留言 + 图片/视频（P2）
- 集中设计一个评论模块，展示使用过的球友的留言和图片（如有）。
- 媒体存储：建议 **Vercel Blob**（图片 ≤10MB，视频 ≤50MB/≤60 秒），客户端直传；视频不做转码，前端 `<video>` 播放。
- 默认需管理员审核后公开；后台新增“评论审核”列表。
- 展示：场地页底部“球友留言”墙。

---

## 建议发布顺序
1. **v1（本周）**：1.1 + 1.2 + 1.3 + 1.4 —— 改动小、立刻见效。
2. **v2**：2.1 + 2.2 + 3.1。
3. **v3**：3.2 评论/媒体墙。

每个阶段：分支 → `npm run lint` + `npm run build` → Vercel Preview 手测（手机端） → 你确认后合并到 main 发布生产。

## 确认内容

1. 管理员通知邮件发到邮箱:una.ge2502@gmail.com 以及 leeuwenhook.sun@gmail.com
2. 场地描述：Tanner St Park（及其它场地）的新文案如未设置，则自动生成。
3. 评论模块：需要审核后才公开。视频大小/时长限制可以接受。
