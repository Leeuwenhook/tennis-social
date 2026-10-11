# 约球需求与球友匹配 MVP 开发计划

> **For Codex:** 在 `feat/partner-request-matching` 上使用独立 worktree 完成实现；各子任务只修改分配的文件范围，集成前运行完整验证。

**Goal:** 将当前“场地 / 球友预约申请”从一段自由留言升级为可筛选、可申请加入、可由管理员确认的结构化约球需求，覆盖“已有场地找球友”“已有球友找场地”“场地和球友都需要”三类场景。

**Architecture:** 保留现有 `reservation_requests` 作为需求主表，新增结构化字段并用数据库默认值兼容旧数据；新增 `partner_request_applications` 保存潜在搭子的申请。公开接口只返回不含联系方式的开放需求，管理员接口负责查看申请、接受 / 拒绝并推进状态。首版不自动承诺匹配成功、不自动放宽条件、不处理付款或正式订场。

**Tech Stack:** React 19 + Vinext/Nitro + TypeScript、Drizzle/PostgreSQL、现有双语翻译体系、现有账户与管理员认证。

---

## 产品范围

### 用户可以

1. 从首页进入“发布约球需求”，选择：
   - 已有场地，找球友（`find_partners`）
   - 已有球友，找场地（`find_court`）
   - 场地和球友都需要（`find_both`）
2. 填写日期、时间、是否必须全程参加、已有球友人数及水平、还缺几人、希望水平、单双打 / 练球形式，以及场地预订状态。
3. 在“快速发布”中粘贴类似群聊文案；系统只做确定性提取并生成**可编辑草稿**，缺少日期、缺额等字段时明确要求补充，不能猜测或直接发布。
4. 浏览开放需求，按区域、日期、形式、水平和可参加时长筛选，查看“已有球友 / 还缺几人 / 场地是否已订”等关键信息。
5. 对需求提交“申请加入”，填写自己的水平、形式、是否能参加完整时段和联系方式。
6. 提交后看到申请编号和“等待发起人 / 管理员确认”，不显示其他人的联系方式。

### 管理员可以

1. 在现有 Requests 页面查看结构化需求和申请人。
2. 将需求置为 New / In Review / Completed / Cancelled。
3. 对申请执行 Pending / Accepted / Rejected；接受申请时显示匹配理由所需字段，但不自动声称已成局。
4. 看到申请者联系方式以便人工确认；公开 API 永不返回这些字段。

### 明确不做

- 自动保证匹配、自动替用户放宽水平或时间条件。
- 自动付款、自动订场、自动退款。
- 公开邮箱、电话或完整申请人名单。
- 依赖 Gemini 才能发布需求；粘贴解析必须有无模型的可用路径。

---

## 数据与接口

### 1. 扩展 `reservation_requests`

在 `db/schema.ts` 和对应 migration 中增加以下字段；旧记录使用安全默认值：

- `request_kind`: `find_partners | find_court | find_both`，旧记录默认 `find_court`。
- `venue_booking_status`: `booked | not_booked | unknown`，默认 `unknown`。
- `existing_player_levels_json`: 已有球友水平数组，默认 `[]`。
- `seeking_player_count`: 还需招募人数，默认 `0`。
- `seeking_levels_json`: 希望招募的水平数组，默认 `[]`。
- `preferred_format`: `singles | doubles | practice | flexible`，默认 `flexible`。
- `full_duration_required`: 布尔值，默认 `false`。
- `budget_pence`: 可选预算 / 每人费用，允许 `NULL`。

`request_type` 继续表示地点输入方式（指定场地 / 附近邮编），不要用它承载需求类别。

### 2. 新增 `partner_request_applications`

字段至少包括：`id`、`request_id`、可选 `user_id`、姓名、邮箱、电话、`tennis_level`、`preferred_format`、`can_attend_full_duration`、留言、状态、创建 / 更新时间。对 `request_id + email` 建唯一约束，避免重复申请。

### 3. 接口

- `POST /api/reservation-requests`: 接受新结构化字段；沿用现有校验，按 `request_kind` 校验地点和招募字段。
- `GET /api/reservation-requests`: 只返回 `pending` / `reviewing` 的公开需求摘要，必须去除联系人字段和内部留言中的联系方式；支持 `postcode/area/date/level/format` 查询参数。
- `POST /api/reservation-requests/[id]/applications`: 创建申请；校验需求仍开放、水平和形式合法、可参加完整时段等条件；重复邮箱返回明确错误。
- 管理员 GET / PATCH：扩展现有 Requests 接口或新增同级 applications 接口，返回申请详情并支持接受 / 拒绝；必须复用现有管理员认证。
- 所有接口在数据库未配置时保持现有演示 / 错误行为，不泄露 SQL 或内部异常。

### 4. 公开序列化

新增明确的 `serializePublicReservationRequest`，只输出：需求 ID、地点摘要、区域、日期、时间、时长、需求类别、已有水平、希望水平、缺额、形式、是否必须全程、场地状态、预算（如有）。禁止复用包含姓名 / 邮箱 / 电话的管理员序列化结果。

---

## 实现任务

### Task 1：数据契约、迁移与服务端校验

**负责范围：** `db/schema.ts`、`db/migrations/*`、`types/tennis.ts`、`lib/server/database.ts`、`lib/server/reservation-request-validation.ts`、API 路由及相关单元测试。

1. 为结构化字段定义联合类型和表单类型，保留旧字段兼容。
2. 增加 Drizzle schema 字段、索引和申请表；生成 migration，不手写破坏性删列。
3. 扩展输入校验：水平必须来自现有 `TENNIS_LEVELS`，时间结束晚于开始，缺额为非负整数，需求类别与地点字段一致。
4. 实现公共 / 管理序列化的字段边界。
5. 添加 POST、GET、application POST、admin application PATCH 所需路由。
6. 添加验证、去敏、重复申请和状态转换测试。

**验收：** `npm test`（若仓库已有测试入口则使用现有命令）及针对新增路由的 Node 测试通过；旧格式请求仍能保存。

### Task 2：用户需求表单与粘贴草稿

**负责范围：** `components/views/request-view.tsx`、`components/booking-chat.tsx`（仅必要时）、`lib/` 中新的纯函数解析器、`types/tennis.ts` 中已约定的类型使用、相关 CSS 和双语翻译。

1. 将表单第一步改为需求类别选择，并根据类别显示地点、已有球友、缺额和招募条件。
2. 增加已有水平 / 期望水平的可增删控件，单双打 / 练球、全程参加、场地预订状态和可选预算。
3. 增加“粘贴约球文案”折叠入口；解析结果必须先进入可编辑草稿，不得自动提交。至少支持：场地名、`4–5PM` / `18:00-20:00` 时间、`2.5` / `3.0` 水平和“连续 2 小时 / full duration”提示。
4. 必填项、错误提示、成功摘要和提交 payload 完整双语化。
5. 继续支持旧需求字段和登录用户预填，不破坏账户 / 助手入口。

**验收：** 以用户给出的 Ravenscourt Park / Chestnuts Park 文案生成两个可编辑草稿；缺少日期或缺额时显示待补字段；手机端可完整提交。

### Task 3：公开需求列表与申请加入

**负责范围：** `components/views/courtside-home-view.tsx` 或新的公开列表组件、必要的 `app/page.tsx` 状态 / 路由、`components` 中申请表单、相关 CSS 和翻译。

1. 在首页场次列表附近增加“Open partner requests / 正在找搭子”区块；只加载公开 GET 结果。
2. 卡片必须展示地点、日期、时间、时长、已有水平、期望水平、缺额、形式和场地状态；将“报名”与“申请加入”视觉区分。
3. 提供区域、日期、形式、水平、完整时段筛选；无结果时给出扩大条件的明确提示，但不自动扩大。
4. 实现申请加入表单，登录用户预填资料，访客也可填写；提交后展示申请编号和等待确认状态。
5. 在加载、空数据、过期、满额 / 已关闭和接口失败时给出双语状态。

**验收：** 公开页面不出现需求发起人的邮箱、电话或内部留言；申请成功不会伪装成已确认报名。

### Task 4：管理员撮合视图

**负责范围：** `components/views/admin-view.tsx` 及其直接子组件、管理员接口调用、翻译 / 样式、相关测试。

1. 扩展 Requests tab：按需求类别、地点、日期、状态展示结构化字段。
2. 点击需求可查看申请列表，显示姓名、联系方式、水平、形式、完整时段和留言。
3. 支持申请 Pending / Accepted / Rejected 和需求状态流转；接受最后一个缺额时给出确认提示，并保持幂等。
4. 状态和申请更新失败时不修改本地展示，给出明确错误。

**验收：** 未登录管理员不能读取申请联系方式；重复点击状态操作不会重复产生副作用；现有旧请求仍可在后台处理。

### Task 5：集成、文档与回归验证

**负责范围：** `README.md`、`docs/page-features.md`、必要的 migration 文档和集成测试。

1. 更新页面功能文档、数据迁移说明和用户流程。
2. 用现有种子 / 演示数据验证旧预约流程、现有聊天助手、账户注册、管理员状态更新。
3. 运行 `npm run lint`、`npm run build` 和完整测试；修复本功能引入的错误，不重写无关的设计分支。
4. 检查 git diff，确认没有 `.env`、凭证、生成物或 `node_modules` 被提交。

---

## 并行开发与集成策略

1. `main` 已先从 `origin/main` 快进同步；所有开发从 `feat/partner-request-matching` worktree 开始。
2. Task 1 先完成并提交，作为数据契约基线。
3. Task 2、Task 3、Task 4 分别使用独立 worktree 和 Codex agent 并行开发；严格遵守负责范围，避免同时改同一文件。
4. 由集成 agent 在 feature worktree 合并三个子分支，解决冲突后运行完整验证；冲突解决以本计划和现有行为为准，不覆盖用户已有改动。
5. 不自动合并到 `main`，不自动创建或合并 PR；完成后报告分支、提交、测试结果和未解决事项。

## 验收清单

- [ ] 三类需求均可提交：已有场地找球友、已有球友找场地、两者都需要。
- [ ] 群聊文案只生成可编辑草稿，不能在信息不完整时直接发布。
- [ ] 公开需求可按地点 / 时间 / 水平 / 形式 / 全程参加筛选。
- [ ] 申请加入后有独立申请记录，重复申请被阻止。
- [ ] 管理员能查看申请并接受 / 拒绝，状态更新幂等。
- [ ] 公开 API 完全去除联系方式和内部信息。
- [ ] 中英文文案、移动端和键盘操作保持可用。
- [ ] 旧预约、聊天助手、账户、付款和后台现有测试不回归。
- [ ] `npm run lint`、`npm run build`、测试均有真实执行结果。
