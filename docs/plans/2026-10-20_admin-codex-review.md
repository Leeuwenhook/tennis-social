# 后台改进 Codex review（2026-10-20）

## 范围与结论

本轮由 Codex 独立 review/fix，不另请 Claude review。审查覆盖 `93a90e4..519c6f5` **以及当前全部未提交差异和新增文件**，包括已合并 PR #31/#32；最终 PR 的比较基线仍为 `origin/main = ea14064fb4818a0bd6531126dd5941dc60f32e98`。当前分支 `fix/admin-review-2026-10-20`，HEAD `519c6f5` 只比指定安全快照 `6a1d70b` 多一份约束文档，没有替换快照。

本轮修复登录限制、CSRF、取消退款/邮件恢复、审计原子性、撤销并发检查、支付中预订字段保护、分页和按需读取等问题。所有源码、测试、迁移和本报告均保留未提交。没有执行 commit/push/merge/reset/clean、部署或数据库迁移；没有操作原 checkout、Claude 会话、生产数据库、Stripe 或邮件服务，也没有读取原 checkout 的环境文件。

**结论边界：离线检查通过不等于生产验收。** 数据库 SQL/锁行为依据代码审查和隔离 mock 测试判断，本轮按约束没有连接任何数据库；桌面/手机真实浏览器交互和截图仍须人工补验。迁移须由操作者核实、批准后另行执行。

## #1–16 完整性 checklist

“代码已核查”表示已检查实现和相关离线证据，不表示浏览器或生产状态已经验收。

| # | 状态 | 核查结论与证据 |
|---|---|---|
| 1 | 代码已核查 | 重置按钮、`app/api/admin/reset/route.ts`、`resetSeed` 已移除；搜索 `app/components/lib/tests` 无残留调用。保留原有首次初始化机制，没有执行任何清理。 |
| 2 | 仅核查说明 | 计划记载 2026-10-19 清理 12 条演示预订、5 个场次并备份、保留 2 个测试场次。本轮没有查询生产库或查验备份内容，不重复清理，也不把说明当成本轮实测。 |
| 3 | 修复后代码/mock 核查 | 弹窗默认退款；Stripe 未成功时不释放名额；持久命令固定首次退款选择；状态、席位、业务审计原子提交；邮件有持久领取、失败重试和界面待发送提示。见 F03–F05 及退款安全说明。 |
| 4 | 修复后代码/mock 核查 | 用户名跨 IP、IP 跨用户名任一 15 分钟内失败 5 次即限制，持久保存从触发时起 15 分钟的锁；事务串行化检查与记录；IP 仅 HMAC；登录成功/失败进入操作记录。缺表时返回 503，不绕过限制。 |
| 5 | 修复后代码/mock 核查 | 默认概览、未来七个伦敦日历日、名单、待处理跳转、本周收款/报名；风险提示限制未来 48 小时。周统计采用**本周创建且当前 confirmed 的预订**，不是会计口径现金流水；退款后不计入。 |
| 6 | 代码/SSR 核查 | 场次名单展开，展示姓名、人数、水平、形式、联系方式、金额；复制名单函数已有测试。SSR 验证双语名单及 HTML 转义；剪贴板、展开交互需浏览器验收。 |
| 7 | 修复后代码/mock 核查 | 未来/过去/全部、场地、状态及姓名/邮箱/电话/预订号服务端筛选；LIKE 通配符按字面转义；50 条一页，新增游标。未来/过去按伦敦**日期**切分，当日已结束场次仍归“未来”范围，未扩展成小时级语义。 |
| 8 | 代码已核查 | 名单、编辑按钮；复制四周、二维码、满员和删除位于更多菜单，删除末尾且 destructive。菜单键盘/触摸交互待验。 |
| 9 | 代码已核查 | 新建/导入、列表/周历/过期、更多菜单（导出、模板、二维码、操作记录/撤销）；模板地址保留。实际导入导出与下载需离线 mock 浏览器验收。 |
| 10 | CSS/SSR 核查，视觉待验 | 窄屏标签下拉、场次和预订卡片样式均存在；SSR 验证下拉选项。没有截图或真实 viewport 测试，不能宣称移动端视觉已通过。 |
| 11 | CSS 核查，视觉待验 | 已检查租赁说明、confirmed 状态样式及后台桌面边距；没有测量渲染后的对比度或视觉溢出。 |
| 12 | 代码/SSR 核查 | 独立 `tennis-match-admin-language`，首次可继承前台语言，之后分别保存；独立后台页头，SSR 无前台账号控件。localStorage 跨刷新切换需人工验收。 |
| 13 | 前后台拆分已核查；控制器保留 | `/admin` 使用独立 `AdminApp`，前台删除后台状态、函数和组件导入；各标签独立组件。概览/预订/评价/审计自行加载；场次/场地/需求保留共享编辑控制器，读取按当前标签触发。没有为追求“每个组件自己 fetch”而重写全部编辑流程。 |
| 14 | 修复后代码/mock 核查 | 登录后不再拉全部业务数据；场次/名单仅场次标签读取，需求仅需求标签读取，其他标签自己加载。场地/设置是共享元数据。场次 API 默认未来+最近 30 天，显式 `all=1` 才读全部历史；预订及审计支持 cursor，保留 offset 兼容旧调用。场次名单所需的非 scope 预订接口仍按日期批量返回，并非所有端点均分页。 |
| 15 | 修复后代码/mock 核查 | 业务动作使用签名会话中的管理员；创建、编辑、状态、删除、导入、评价与媒体审核、设置、取消退款、撤销和后台代建需求均有审计。普通单行写入及日志为同一 CTE，批量导入/审核使用事务；失败不报告成功。登录记录并入按时间倒序、可按对象类型筛选的列表；API 也支持 targetId。 |
| 16 | 修复后代码/mock 核查 | 持久撤销场次编辑/状态/满员、场地编辑；比较修改后快照，容量和支付中预订也受保护；目标写入、已撤销标记和新日志原子完成。删除、退款、取消不可撤销。移除计划外“撤销新建=删除场次”。刷新后的实际使用及多连接并发仍待人工/隔离环境验收。 |

未实现 #17–19。共享控制器保留是避免重复开发的保守选择；若要求完全消除跨标签 props，需要单独安排结构重构，不把它伪装成本轮已经完成。

## 问题、原始位置、证据、修复及回归

以下“原始”均指本轮修复前 `519c6f5` 的源码行号（与安全快照业务源码相同）；“修后”指当前工作区行号。严重程度：High 为资金、数据或鉴权完整性；Medium 为功能遗漏、错误响应或一致性；Low 为测试/说明问题。mock 验证 SQL 结构与调用顺序，不等同于真实 PostgreSQL 并发执行。

| ID / 严重程度 | 原始位置 → 修后位置 | 复现 / 证据 | 修复 | 回归测试 |
|---|---|---|---|---|
| F01 High | `lib/server/admin-auth.ts:120` → `:121`、`:130`；登录/退出入口 | 原 `requireAdmin` 只验 cookie，无请求来源校验；同站点恶意子域不受 SameSite=Lax 完整隔离。 | 写请求统一校验 Origin/跨站 Fetch Metadata，登录、退出同样校验；无 Origin 的非浏览器调用仍需有效 cookie。 | `admin-security-routes`：外站、兄弟子域、opaque Origin 均 403；同源合法请求；篡改会话不能换 actor。 |
| F02 High | `lib/server/admin-login-guard.ts:10,27` → `:10,22,44`；`auth/login/route.ts:38` → `:45` | 原限制是用户名+IP 组合 5 次 / IP 20 次，换 IP 可绕过账号限制；检查和写记录分离；缺表异常未统一处理。 | 用户名或 IP 各 5 次；咨询锁后在同事务新语句快照中计数并记录；新增锁截止时间，避免第一个失败过期便提早解锁；失败关闭并返回 503。 | `admin-login-guard` 和 `admin-security-routes`：阈值、窗口、HMAC、锁在计数之前、429 不发 cookie、缺表 503。完整真实并发计数未实测。 |
| F03 High | `lib/server/admin-cancel-booking.ts:21,31` → `:18,36` | 原退款成功后若数据库写入失败、webhook 先改状态或响应丢失，重试可能只得到 already_processed；也没有协调退款/不退款的并发选择。 | `admin_booking_cancellations` 固定首次选择和发起管理员，允许从中断处继续；同幂等键退款；已知 refunded 时直接恢复收尾；完成标记、状态、席位及审计同条 SQL。 | `admin-cancellation-recovery`：webhook 先赢、首次选择不被重试覆盖、非退款/免费预订不调用 Stripe、终态无命令不得发起新退款、Stripe 成功后数据库失败再经 webhook 恢复。列表也为未收尾命令保留重试入口。 |
| F04 High | `lib/server/admin-cancel-booking.ts:65` → `:76` | 原邮件失败被吞掉，终态重试不再发信；并发/响应丢失无持久发送状态。 | 持久 pending/sending/sent，随机领取凭据、超时恢复、失败释放领取；列表显示待发送及重试，接口返回 emailPending。 | `admin-cancellation-recovery`：邮件 skipped 仍待发送、取消后重试不再次退款、已 sent 不重复调用发送函数。SMTP 不提供严格 exactly-once，见下文。 |
| F05 High | `lib/server/admin-cancel-booking.ts:31` → `:36`；`app/api/stripe/webhook/route.ts:102` → `:102,107` | 原将 HTTP 200 的 pending/failed 退款也当成功；webhook 用未锁定的旧 status 决定释放席位，与后台取消竞争可能重复释放。 | 只接受 succeeded；webhook 先锁 booking 再读决定释放的状态。 | `admin-cancellation-recovery`：pending/failed/canceled 不取消、不发送邮件；webhook 早于后台收尾。webhook 的真实双连接竞争仅做 SQL 审查，未实测。 |
| F06 High | `lib/server/audit-log.ts:137,168,187` → `:187,214,242` | 原 session UPDATE 漏 end_time、formats、levels、marked_full 的写入时比较；venue UPDATE 没有条件比较；目标、撤销标记、日志分三次写。 | 快照字段全量 JSONB 条件比较；锁审计记录，写目标/标记/新日志同条 CTE；支付中预订锁价时和容量。 | `admin-audit-log`：合法状态撤销、已变更拒绝、锁定价格拒绝、写入时竞争返回 changed_since；断言全量比较与日志在同 SQL。 |
| F07 High | `app/api/admin/sessions/[id]/route.ts:50,73` → `:50,74`；`venues/[id]/route.ts:41` → `:41,51` | 原场次只按 confirmed 锁时间/价格，pending_payment 可仍付款；读取后普通更新可能覆盖服务器并发更改。 | 已占席位（包括支付中）锁关键字段；写入时再检查容量及快照。场地更新同样比较已读取完整快照。省略 markedFull 继续保留当前值；审计 before 在行锁下读取。 | `session-marked-full-route`：支付中改价 409、end-time 竞争 409、省略满员标记保留另一管理员设置、显式开关有效。场地写入/撤销由 helper/undo SQL mock 检查，未做真实并发。 |
| F08 High | `lib/server/audit-log.ts:60` → `:63`；各写路由；`components/admin/admin-paste-requests.tsx:115` ；`app/api/reservation-requests/route.ts:83` → `:88` | 原写入后独立记录且吞掉异常，缺审计表仍能改业务；后台粘贴需求走公共 API，完全没有审计。 | 单行 mutation+before/after+actor+日志同 CTE；导入、审核与多条媒体更新同事务；代建需求识别有效管理员并写日志；删除评价的数据库删除及日志同 SQL，Blob 删除边界见下文。 | `admin-audited-mutation`：锁 before、参数无缺口、值不拼进 SQL、仅 changed 产生日志、登录列表不泄露 IP 哈希；`session-marked-full-route`：审计存储失败返回 503；需求状态 mock 验证带审计的 mutation。 |
| F09 Medium | `components/admin/admin-app.tsx:126,157` → `:126,157` | 原登录后概览也全量抓场次、预订、需求，分页 UI 没有减少初始业务读取。 | 重业务读取按标签触发；设置/场地仍共享；移除概览初次未加载却显示全零的顶部摘要。API 默认最近 30 天，全部历史须显式请求。 | `admin-ui-render` 验证概览不显示未加载的零摘要；读取门控代码审查，无浏览器 network trace。 |
| F10 Medium | `lib/server/admin-bookings.ts:53` → `:64,77`；`components/admin/admin-bookings.tsx:137` → `:144`；审计列表同类位置 | 原 offset 无 ID 平局排序，插入/删除导致错页；Load more 旧响应能把旧筛选结果写回，连点还可能重复追加，网络错误无处理。 | 唯一 ID 平局排序、keyset cursor；按筛选 key 和待加载 offset 条件追加，拒绝旧结果；错误绑定筛选 key，隐藏旧筛选卡片。 | `admin-pagination`：游标结构、参数绑定、seek 顺序、cursor 时不再 offset；UI 条件更新静态审查，异步点击/切换未做真实浏览器测试。 |
| F11 Medium | `lib/server/admin-overview.ts:116` → `:116` | 原风险条件对未来七天都可触发，而计划为 48 小时。 | 增加开始时间在未来 48 小时内条件，保留实际 18 点伦敦自动退款决策规则、支付中人数及线下满员保护。 | `admin-pagination`：约 46 小时的孤单场次报警，四天后的不报警；现有夏令时/周界测试保留。 |
| F12 Medium | `bookings/[id]/route.ts:19` → `:18`；`settings/route.ts:39` → `:39`；申请状态路由 `:11` → `:11` | JSON `null` 可在 try 之外访问属性并抛异常。 | 先验证对象，返回 400。 | `admin-security-routes`：取消/设置 null 在任何服务调用前返回 400；申请路由同样加 guard，未单独覆盖其 null 用例。 |
| F13 High | `app/api/admin/reservation-requests/[id]/applications/[applicationId]/route.ts:28` → `:28,41` | 原两个接受操作更新不同申请行，单条语句内 COUNT 仍可各看到同一个空位，代码注释的“防超额”不成立。 | 同 request 的接受、其他申请状态修改及需求状态修改用同一事务咨询锁；取得锁后新语句重新检查容量和需求仍开放，并原子审计。 | `admin-security-routes`：预检查尚有空位、真正写入已失去最后名额，要求锁先于最终容量/状态检查并返回 409；未连接数据库执行双连接压力测试。 |
| F14 Medium | `lib/server/audit-log.ts:33` → `:33`；原 `:157` 删除分支已移除 | 计划只允许撤销编辑，原实现却把 session.create 撤销变成删除；扩大不可逆面且存在额外竞争。 | 保守收回到计划范围：新建不提供撤销，删除仍使用独立受保护流程。同步双语提示。 | `admin-audit-log`：新建/删除/退款均不可撤销，创建记录拒绝撤销。 |
| F15 Low（基线测试） | `tests/admin-audit-log.test.ts:47`、`tests/reservation-request-status.test.ts:95` → 当前对应测试 | 基线两个失败：有 confirmed 预订却回退价格的测试误期望成功；另一个 mock 把新增审计 SQL 也计成状态 UPDATE。 | 成功撤销用例改为合法状态变更，仍保留非法价格撤销拒绝；需求 mock 区分真实事务/审计并验证动作与 actor，未简单把 4 改成 8。 | 基线 114/116；最终结果见检查表。 |

## 架构、迁移及外部服务安全

### 架构与并发

前台入口不再导入 AdminView/AdminApp 或后台编辑逻辑；后台独立入口、语言存储、认证状态保留。构建产生独立 `admin-app` client/SSR chunk。共享 translations 和工具函数仍可能含后台文案，不声称整个前台产物没有任何“admin”字符串。没有运行浏览器验证实际网络加载图。

常规编辑对服务器“读到写之间”的竞争使用条件更新；这不等于完整的客户端版本协议。两个浏览器先后提交各自缓存的完整表单，仍可能按最后一次有意提交覆盖字段；操作日志保留实际 before/after。需要严格拒绝所有陈旧表单时，必须另加客户端版本 token，未在本轮擅自扩展。

撤销只还原允许字段，不还原 booked_spots；容量在写入时检查。新增退款 webhook 行锁避免按旧 status 重复释放。所有并发结论均为代码/SQL 结构审查和 mock 证据，真实 PostgreSQL 锁调度、死锁重试、隔离级别尚未实测。

### 待批准的迁移

| 迁移 | 来源 / 风险 / 发布要求 |
|---|---|
| `0025_admin_login_attempts.sql` | 已合并阶段的迁移。本轮只读代码，不能确认生产是否执行；登录失败记录的基础表必须存在。 |
| `0026_admin_audit_log.sql` | 原快照新增，最终 PR 需要。新表及索引；业务写入依赖其成功写日志，未迁移时应 503 而非静默丢审计。 |
| `0027_admin_booking_cancellations.sql` | 本轮新增。创建空的取消命令/邮件状态表（FK 到 bookings），给登录记录加两个可空锁截止时间字段；旧数据无需重写或删除。表初始为空，历史已取消预订不会自动补发邮件或再次退款。 |

0027 SQL、schema、journal 和 snapshot 由本地 `drizzle-kit generate` 同步生成，仅生成文件，**未执行迁移**。已静态核查 journal 顺序 0025→0026→0027 及 snapshot 链；此前 0023/0024 等现有业务表也是前提。没有验证真实旧库 schema、迁移历史、缺列恢复或 FK DDL 时锁等待。

操作者须在已批准的流程中核实迁移历史、备份和环境，先完成缺失迁移，再部署依赖新表的新代码。0027 对旧代码是加法，但新代码回退不应删除命令/邮件状态或撤销审计，否则破坏恢复能力。不要重复运行裸 SQL 冒充幂等迁移。登录缺表、审计缺表或命令表缺失时允许明确失败，不退回无保护业务写入。

### 退款和邮件

- 保留已合并代码使用的 `refund-admin_cancel-<bookingId>` 幂等键（共享 Stripe helper 的 reason 为 admin_cancel）。计划中的字面名称 `admin-refund-<id>` 没有强行改用，避免同一操作跨版本换 key；自动退款使用另一个 reason。Stripe 还会阻止重复全额退款，但这不替代业务恢复。
- 只把 succeeded 当作后台退款成功；pending/failed/canceled 和抛异常都不取消、不释放席位。pending 后可能由 webhook 先改为 refunded，下次重试可完成命令和邮件。
- 命令首次创建保存真实发起管理员及是否退款；后续重试沿用首次选择。界面已写明此行为，避免并发勾选差异造成资金歧义；取消后不通过此 API 改成另一种资金操作。
- Stripe 成功与数据库提交无法组成一个跨服务事务。若中断，持久命令和相同幂等键允许重试；若 webhook 已记录 refunded，则跳过新退款调用，继续收尾。需要操作者重试，未新增后台队列/cron。
- 邮件只在取消落库后发送；失败/未配置保留 pending，界面提供重试。领取凭据防普通并发重复发送，过期领取可恢复。**SMTP 已接收但 sent 标记未落库、或极慢发送超过领取期限时，重试仍可能重复送达**；本轮不宣称严格 exactly-once。没有连接 SMTP 或 Stripe。
- 评价 Blob 文件删除与数据库也不能跨服务原子提交；保留先删文件、再原子删除数据库行/审计的顺序。若第二步失败会返回错误且保留记录供重试，但文件可能已删除。这是已有外部服务边界，没有实际删除文件。
- 既有自动退款任务不在本轮重写；其邮件未使用本轮管理员取消命令表。不能把管理员取消的恢复保证外推到全部自动退款/所有邮件任务。

## 检查结果：基线与修后分列

基线来自只读 handoff：`/home/weiyi/.hermes/handoffs/tennis-admin-2026-10-20/baseline-results.json` 和对应日志。

| 检查 | 操作者修复前基线 | Codex 最终修后 |
|---|---|---|
| npm ci | 操作者已执行；未重复安装 | 未更改 package/lockfile |
| `npm run lint` | exit 0 | **exit 0**；`outputs/admin-review/final/lint.log` |
| `npm run build` | exit 0 | **exit 0**；`outputs/admin-review/final/build.log` |
| `npx tsc --noEmit` | exit 0 | **exit 0**；`outputs/admin-review/final/typecheck.log` |
| `npx tsx --test tests/*.test.ts` | exit 1；116 个，114 pass / 2 fail | sandbox 的 IPC `listen EPERM`，不能据此说原命令通过 |
| sandbox 兼容测试 | 无 | **exit 0；27 个文件，140 个用例全部通过，0 fail**；`outputs/admin-review/final/tests/` |
| `git diff --check` | 未提供基线 | **exit 0** |
| 浏览器截图/交互 | 计划来源提到既往截图；不是本轮证据 | 未执行；SSR/mock 不能代替截图验收 |

最终测试采用每个文件独立子进程执行 `node --import tsx --test --test-isolation=none "$test_file"`，保证真实 `node:test` 用例被执行，又避免跨文件全局 fetch/env mock 互相覆盖。直接把所有文件放在一个 `--test-isolation=none` 进程会发生现有 mock 干扰；不将这种运行方式的结果与产品失败混为一谈。另一次默认隔离 runner 只汇报文件数，因此不把文件数当测试用例数。最终以逐文件命名测试和 `outputs/admin-review/final/results.json` 汇总为准，操作者还须在 sandbox 外独立运行原 `npx tsx` 命令。

日志放在当前 worktree 已忽略的 `outputs/admin-review/`，不作为源码提交。上述表格为最终真实 exit code 与用例总数；早期中间 lint/test 失败日志归档在 earlier-run，不作为最终结果。

## 未完成、阻塞和人工验收

1. **发布前置条件**：批准并核实 0025/0026/0027 迁移状态；本轮禁止执行，不能验证生产现状或历史脏数据。新代码不能先于必需迁移发布。
2. **操作者独立验证**：原 tsx 全套命令、lint/build/typecheck；本轮已经运行的兼容测试不会替代这一步。所有改动未提交，由操作者决定 commit/push/PR。
3. **安全浏览器验收**：仅使用离线 mock 或全局拦截写操作的测试环境，检查桌面及 360/390px、双语切换与独立记忆、登录/429/503、七标签切换及请求时机、筛选连改/Load more 连点/旧响应、菜单和键盘焦点、卡片无溢出、复制名单、导入预览、二维码及下载、取消/重试邮件提示、刷新后撤销。不得直接在生产界面验证写操作。
4. **SQL/迁移验收缺口**：在另行获准的隔离数据库验证升级旧数据、缺表/缺列失败关闭、并发接受最后一个名额、支付中改价、双管理员撤销、webhook/取消竞争，以及 SQL DDL/CTE 实际执行。当前禁令下只做 mock 和代码审查。
5. **人工故障恢复**：取消邮件 pending、取消命令未完成或支付平台 pending 时需重试/核对；SMTP 的送达后崩溃歧义不能靠本轮代码完全消除。没有宣称真实退款或真实邮件已测试成功。
6. **结构边界**：共享编辑控制器保留；需要“各标签完全拥有其所有状态和 fetch”的严格架构验收时，#13 仍属于部分满足。此项已明确列出，不以重复开发扩大本轮范围。
