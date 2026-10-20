你是本轮唯一代码 reviewer/fixer。用户已明确改为：Claude 已基本完成开发，现在由 Codex review，发现问题直接修复，操作者独立验证后 commit/push/PR；取消额外 Claude review。不要重做功能开发。

工作目录 /home/weiyi/.codex/worktrees/tennis-admin-review-2026-10-20，feature branch fix/admin-review-2026-10-20。原 checkout /home/weiyi/tennis-social 中 Claude 会话 idle，不得编辑/操作该目录、resume/终止 Claude。当前 HEAD 6a1d70b28e68e1730c208e1178d8e032791ee75e 是对 Claude HEAD 68144fc 加全部未提交源代码/测试/迁移的安全快照；.claude 私有设置未导入。不要重置/清理/覆盖快照。

先读 docs/plans/2026-10-19_admin-improvement-plan.md，逐条核查 #1–16（#2 是已经完成的生产清理，仅核查现有说明，不做清理）。完整 review 范围应是 git diff 93a90e4..HEAD：此 base 在 admin safety/daily ops/structure 之前，包含已合并的 PR #31/#32 和当前 Claude 未发布成果。PR 最终相对 origin/main ea14064（前两阶段已合并），不要漏审已合并 commits，也不要重复实现它们。

重点检查：功能回归、管理员鉴权/CSRF、登录限流、分页和筛选、按需加载/后台前台拆分、双语界面/移动端、操作审计覆盖及真实管理员身份、持久撤销与并发竞态、锁定字段和容量/预订一致性、迁移顺序/旧数据/缺表兼容、Stripe 退款和取消邮件幂等/失败恢复（仅代码/mock 测试，不连 Stripe/数据库/邮件）。新增测试必须复现真实问题，不只修改断言迎合错误实现。所有发现记录严重程度、原始 file:line、复现/验证证据、修复及回归测试。只修 review 发现的问题及计划内遗漏，不扩展 #17–19 或其他需求。计划本身有不合理之处应解释、采用保守默认，不擅自扩展。

必须生成 docs/plans/2026-10-20_admin-codex-review.md（中文）：逐项完整性 checklist；问题列表（severity/file:line/evidence/fix/tests）；架构/迁移/退款邮件安全结论；基线与修后检查结果区分；未完成/人工验收。文档中记录原始行号与修后行号。若某项无法验证应明说，不伪造。

操作者已先在快照执行 npm ci、lint、build、tests、typecheck，日志在 /home/weiyi/.hermes/handoffs/tennis-admin-2026-10-20/baseline-*，baseline-results.json。先读其结果用于归因。你仍需在修复后真实运行 npm run lint、npm run build、npx tsc --noEmit、npx tsx --test tests/*.test.ts（或 package 中等价正式命令）。sandbox 若 tsx IPC 被拒，可用 node --import tsx --test --test-isolation=none tests/*.test.ts 并说明；操作者会在 sandbox 外独立运行原命令。尽可能用离线 mock/隔离测试验证 admin API 和 UI，不连接生产。浏览器截图仅允许 mock 或显式拦截写操作；不能做则记录缺口。

禁止 git commit/push/merge、分支切换、生产部署、Stripe live/退款、生产 DB 查询/写入/迁移、生产 env 变更。不要读取/复制原 checkout .env，禁止网络外部副作用。不要委派额外 Claude review。所有修复保留 uncommitted，操作者决定提交。不要写到当前 worktree 之外（handoff 文件只读）。结束明确列出阻塞、修改、测试结果、需要批准的 migration；若未通过不得声称通过。
