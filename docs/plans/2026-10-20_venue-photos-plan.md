# 场地照片管理与前台展示改进：开发计划

> 范围：评审意见第 2、5、6 项。只读核对的代码基线是 `a290ef4`。线上数据核对时间为 2026-10-20，用的是 `curl https://www.tennismatch.space/api/venues`。状态：待用户确认第 13 节后再开发。

## 0. 现状核对

- **线上 `/api/venues` 响应约 1.0 MB。** 24 个场地里只有 1 个（`venue-f9a37735…`）存的是 data URL，约 479 KB。`serializeVenue` 同时输出 `photo` 和 `photos`，这张图在响应里出现两遍。把它迁到 Blob 就能解决大部分体积问题。
- **18 个场地实际用的是占位图**：`photo = /venues/victoria-park.jpg` 且 id 不是 `victoria-park`。notes 里的标记有中文 `（复用照片）` 和英文 `(reused photo)` 两种（`lib/translations.ts`）。`venue-51452487…` 用了占位图但没有标记。
- **清除标记的正则只认中文（bug）**：`admin-app.tsx` 和 `admin-venues-tab.tsx` 里用 `/[（(]复用照片[）)]/`，英文标记清不掉。
- **会话导入也写这个标记**：`app/api/admin/sessions/import/route.ts` 自动建场地时写 `notes: '（复用照片）'`。
- **前台照片渲染点**：`components/venue-photo.tsx` 是唯一公共组件（只有左右箭头，无 lazy、无 srcset、不支持滑动）；使用处 `home-view.tsx`、`courtside-home-view.tsx`（卡片）、`detail-view.tsx`、`booking-view.tsx`；`confirmation-view.tsx` 直接写 `<img src={venue.photo}>`；地图不显示照片；邮件不用照片。
- **可复用**：`components/ui/carousel.tsx`（embla）。
- **构建是 vinext + nitro（vite）**，`next/image` / Vercel Image Optimization 是否可用不确定，计划不依赖它。
- **Blob 参考模式**：`app/api/reviews/upload/route.ts`（`handleUpload` + `onBeforeGenerateToken`）、`components/review-form.tsx` 的 `compressImage`（canvas 2048px JPEG）、`lib/server/reviews.ts` 的 `verifyUploadedMedia`（`head()` 复核）、`lib/server/review-media-cleanup.ts`（`list` + `del`，cron 每天 03:30）、开关 `reviewMediaEnabled()`。
- **审计日志**：只在照片变化时快照 `photo/photos_json`；`venue.update` 可撤销（`COALESCE` 恢复旧照片）；`venue.delete` 不可撤销。

## 1. 目标

1. 数据库只存 URL，不再存 base64，接口响应回到 KB 级。
2. 上传前浏览器压缩缩放，直传 Vercel Blob，用 `requireAdmin` 鉴权。
3. 管理端支持上移/下移、设为封面、删除、追加 URL；封面 = `photos[0]`，界面明确标出。
4. 用字段 `photo_is_placeholder` 取代 notes 里的"(复用照片)"，并清理现有 notes。
5. 前台：响应式缩略图、懒加载、详情/预订页轮播（滑动、看大图）、占位图标为"示意图"。
6. 删除照片、删除场地、上传后放弃的文件都能自动清理，且不破坏审计撤销。

## 2. 数据模型

新增迁移 `0029_venue_photo_placeholder.sql`（同步 `db/schema.ts` 并 `npm run db:generate`）。**迁移手动执行，必须先在生产库执行再合并。**

```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS photo_is_placeholder boolean NOT NULL DEFAULT false;
UPDATE venues SET photo_is_placeholder = true
 WHERE notes ~ '[（(](复用照片|reused photo)[）)]'
    OR (photo = '/venues/victoria-park.jpg' AND id <> 'victoria-park');
UPDATE venues SET notes = btrim(regexp_replace(notes, '\s*[（(](复用照片|reused photo)[）)]\s*', ' ', 'g'))
 WHERE notes ~ '[（(](复用照片|reused photo)[）)]';
```

- `photos_json` 仍是 `string[]`（存 URL），`photo` 仍等于 `photos[0]`，保持 NOT NULL 以兼容邮件和导入。
- 缩略图按命名约定推导：每张图上传 `venue-photos/{uuid}.webp`（长边 1600）和 `venue-photos/{uuid}.thumb.webp`（长边 480），`addRandomSuffix:false`；`serializeVenue` 对这类 URL 推导 `thumbs[]`，其他 URL 用原图。
- API 只做加法：新增 `photoIsPlaceholder`、`thumbs`。同步 `Venue` 类型、`VenueRow` 和所有 venue 列清单。

## 3. 上传 API

新文件 `app/api/admin/venues/upload/route.ts`，照抄评价上传：

- `onBeforeGenerateToken` 内先 `requireAdmin`；`pathname` 必须匹配 `^venue-photos/[0-9a-f-]{36}(\.thumb)?\.(webp|jpg)$`。
- 类型 `image/webp`、`image/jpeg`，上限 4 MB，`addRandomSuffix:false`，不设 `onUploadCompleted`。
- 进程内限流（如 200 次/小时）。Blob 未配置时返回 404 `uploads_disabled`，前端隐藏上传按钮。

保存校验（`lib/server/admin-validation.ts`）：

- 允许：本地 `/venues/*.jpg`；本 Blob 存储 `venue-photos/` 下的 https URL；其他 https 外链（待定，见 13.1）。
- 每个场地最多 8 张，去重；新出现的 Blob URL 用 `head()` 复核。
- `data:`：PR2 起只允许与库里现值相同的；PR4 迁移后完全拒绝。单个 URL 长度上限改为 2000 字符。

## 4. 客户端压缩

- 抽出 `lib/client/image-compress.ts`：`(file, {maxEdge, type, quality})`，`review-form.tsx` 改为调用它。
- `createImageBitmap(file, {imageOrientation:'from-image'})` → canvas → `toBlob('image/webp', 0.82)`；不是 webp 时（老 Safari）回退 `image/jpeg, 0.85`。重新编码会去掉 EXIF/GPS。不放大小图。
- 原始文件上限放宽到 20 MB；解码失败（如 HEIC）提示"格式不支持，请先转为 JPG"。去掉 1 MB 限制和 `readAsDataURL`。

## 5. 一次性迁移脚本

`scripts/migrate-venue-photos-to-blob.ts`：

- 只读显式传入的 `MIGRATE_DATABASE_URL`，不读 `.env`。默认 dry-run，`--apply` 才执行。
- 幂等：pathname 用内容哈希 `venue-photos/migrated-{sha256前16位}.{ext}`；先 `head()` 已存在就跳过；更新带乐观锁 `WHERE id=$1 AND photos_json=$old`。
- 不做服务端压缩，不生成缩略图（前台回退原图）。写一条 `venue.photo_migrate` 审计记录。
- 旧审计记录里仍有 data URL，撤销它们会写回 data URL（见 13.7）。生产只需处理 1 个场地，先在分支库演练。

## 6. 孤儿文件清理

`lib/server/venue-media-cleanup.ts`，仿照 `review-media-cleanup.ts`：

- 保留集合 = 所有 `venues.photo/photos_json` 的 pathname ∪ 未撤销的 venue 审计记录 `before_json/after_json` 中的 `venue-photos/…` pathname；主图保留时其 `.thumb` 也保留。
- `list({prefix:'venue-photos/'})` 分页，删除不在保留集合且上传超过 1 天的文件。
- 删除场地/照片时不同步删 Blob，统一交给 cron。在现有 review-media-cleanup cron 里追加调用（是否改名见 13.5）。

## 7. 管理端界面

- 照片区改为网格卡片：缩略图、第 1 张"封面"徽标、↑ / ↓（首末禁用）、设为封面、查看、删除。拖拽排序以后再加（原生 DnD，不加依赖）。
- 上传：逐个"压缩 → `upload()` 直传 → 加到末尾"，显示进度和错误，上传中禁用保存。
- URL：改为独立的"添加图片链接"输入框 + 添加按钮，只追加，不再改 `photos[0]`。
- "复用照片"按钮改为"使用占位图"开关：打开时 `photos=[占位图]`、`photoIsPlaceholder=true`；添加真实照片时自动关闭并去掉占位图；不再改 notes，删除 `reusedPhotoNote` 和两处正则。
- 列表行显示封面缩略图，占位场地显示"占位图"Badge，可选"仅看占位图场地"筛选。
- 会话导入新建场地写 `photo_is_placeholder=true`、`notes=''`，同步改提示文案。

## 8. 前台界面

重写 `components/venue-photo.tsx`：

- 卡片模式：只显示封面缩略图，`loading="lazy"`、`decoding="async"`、`srcset`（480w / 1600w）+ `sizes`，CSS `aspect-ratio` 防跳动。
- 详情模式：用 `components/ui/carousel.tsx`，触摸滑动，圆点或 `n/m`；首张 `fetchpriority="high"`，其余 lazy；点击用 Dialog 看大图；只有一张时不显示控件。
- 占位场地：角标"示意图 / Illustrative photo"，详情页不显示轮播，可附"场地照片待补充"。`onError` 回退占位图。
- `confirmation-view.tsx` 改用 `<VenuePhoto controls={false}>`；`detail-view.tsx`、`booking-view.tsx` 用轮播；地图本期不加照片。补 `app/globals.css` 样式，回归检查 `courtside.css`。

## 9. 审计日志

- `VENUE_FIELDS` 加 `photo_is_placeholder`，撤销时一并恢复（旧快照没有就保持现值）。
- 照片变成短 URL 后，"只在变化时快照照片"可在 PR4 后简化为始终快照，`venueSnapshots` 和 SQL 两处保持一致。
- 清理任务依赖审计日志里的 pathname，耦合要写注释。

## 10. 分阶段上线

| PR | 内容 | 前置条件 |
|---|---|---|
| PR1 占位标记 | 迁移 0029 和回填；类型、serializer、列清单；"使用占位图"开关；导入路由；审计字段；删除 notes 正则 | 先在生产执行 0029 |
| PR2 Blob 上传和压缩 | `image-compress.ts`（review-form 同步）；上传路由；管理端直传；校验接受 Blob URL，只放行已存在的 data URL；`head()` 复核 | 生产有 `BLOB_READ_WRITE_TOKEN` |
| PR3 编辑体验 | 上下移动、设为封面、封面徽标、URL 追加框、上传进度、列表占位 Badge | PR2 |
| PR4 迁移和清理 | 迁移脚本（dry-run → 生产 apply）；完全拒绝 `data:`；清理接入 cron；简化审计快照 | 脚本先 apply 再合并 |
| PR5 前台展示 | 重写 VenuePhoto（缩略图、lazy、轮播、大图、角标、回退）；confirmation-view；CSS | 可与 PR2 并行 |

## 11. 测试

- `tests/venue-photos.test.ts`：照片校验各种情况；`thumbs` 推导和 `photoIsPlaceholder`；迁移脚本纯函数（解析、哈希、dry-run、二次执行无改动）。
- `tests/venue-media-cleanup.test.ts`：假 `{list, del}`，覆盖引用保留、审计引用保留、`.thumb` 跟随、新上传保留、其余删除。
- `tests/admin-security-routes.test.ts`：上传路由未登录拒绝、pathname 不合规拒绝。
- `tests/admin-audit-log.test.ts`：快照和撤销包含 `photo_is_placeholder`。
- `tests/admin-ui-render.test.ts`：封面徽标、上下移动禁用状态、占位开关、notes 不再被改写。
- 手动：iOS Safari / Android Chrome 上传 HEIC 或大 JPG，查方向和体积；慢速 3G 懒加载；迁移后 `/api/venues` < 30 KB。

## 12. 风险

- 预览和生产如果共用 Blob token，生产清理会删掉只被预览库引用的文件（评价上传已有同样问题）。建议按环境加前缀 `venue-photos/{VERCEL_ENV}/` 或分 store。
- 撤销与清理：只要审计记录未撤销，其引用的图就在保留集合里；前提是审计日志不做物理清理。
- Safari 不能编码 webp，靠回退 JPEG。上传后取消会留孤儿文件，最多 1 天后清理。Blob URL 公开可访问，场地照片本就公开。

## 13. 需要用户决定

1. 是否允许任意 https 外链？建议允许并提示"外链可能失效，建议上传"。
2. 占位图：继续用 `victoria-park.jpg` 加"示意图"角标，还是新做一张中性插画？建议后者。
3. 缩略图：客户端上传两份（默认），还是先验证 Vercel Image Optimization 能否用？
4. 每个场地照片上限：建议 8 张。
5. cron 路由保留 `review-media-cleanup` 名字追加调用，还是改名 `media-cleanup`？
6. Blob 是否按环境隔离？
7. 含 data URL 的旧审计记录，PR4 后是否禁用撤销？
8. 公开 API 是否去掉重复的 `photo` 字段？建议保留。
