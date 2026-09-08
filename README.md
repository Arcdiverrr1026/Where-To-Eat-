# Where To Eat

公共美食地图 + 个人餐厅体验库：先浏览大家自愿公开的真实体验，登录后再记录自己的足迹，并可切换我的、朋友的和融合地图。

## 功能

- 首次进入公共美食地图，无需登录即可浏览地点和公开体验；登录后在同一部署的不同设备访问自己的足迹。
- 记录餐厅、日期、评分、体验、人均实付、标签和是否再来；编辑、删除、收藏记录。
- 按自己的体验、朋友的体验、特别喜欢筛选，支持搜索与排序。
- 高德附近搜索和地图，地点可带入表单。地图资料不等于用餐评价，失败时不展示虚构餐厅。
- 分享选定的自有记录，支持 1 / 7 / 30 天有效期与撤销。
- 朋友登录后先预览再导入；副本保留作者与原文，不能冒充自己的体验编辑或重新分享。
- 记录默认私密；记录表单可主动公开到公共地图，取消公开即可撤回。

## 本地运行

需要 Python 3.14、uv、Node.js 20.19+ 或 22.12+。在项目根目录执行：

```bash
uv sync
npm --prefix frontend ci
npm --prefix frontend run build
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

访问 http://127.0.0.1:8000 ，首次注册后个人库为空，不会自动加入演示记录。
前端开发另开终端运行 `npm --prefix frontend run dev`，Vite 将 API 请求代理到本机 8000 端口的后端。

## 配置

根目录 `.env` 自动加载，已有密钥无需复制到前端源码：

```dotenv
AMAP_API_KEY=your_web_service_key
AMAP_JS_API_KEY=your_browser_js_key
AMAP_SECURITY_JS_CODE=your_browser_security_code
SQLITE_PATH=/absolute/path/to/where_to_eat.db
RECOMMENDATION_PREWARM_ENABLED=false
```

高德服务端搜索使用 Web 服务 Key，浏览器底图使用 JS API Key 和对应安全配置。请在高德控制台配置适用域名及权限。无有效密钥时仍可手动记餐。浏览器地图配置按 SDK 要求下发，不要复用服务端密钥；不要提交 `.env`。

## 分享边界

记录默认仅账号本人可见，只有选中的自有记录进入分享快照。完整分享码仅生成时显示一次，服务端只保存哈希。请妥善保存并仅交给信任的人；持码且已登录的人均可预览和导入，并非绑定指定收件人。

修改原记录不会改变已有快照。撤销或过期阻止后续预览和导入，但不会删除已导入的副本。删除原记录会撤销包含它的分享，也不会召回副本。同一来源记录经不同分享码重复导入会去重，不覆盖已保留版本。

分享码只在同一部署及其数据库内有效。跨设备和远程朋友访问需要共同可达的服务地址；localhost 不能直接给远程朋友使用，也不会自动连接其他独立安装。

## 部署与安全

- 生产环境先构建前端，通过 HTTPS 反向代理提供同源页面和 API；数据库放在持久化目录。
- 会话使用 HttpOnly、SameSite=Strict Cookie，HTTPS 下设置 Secure，默认有效期 30 天。
- 代理须正确转发 Host 和协议，Uvicorn 仅信任实际代理来源，否则会影响同源校验和安全 Cookie。
- 应用层限流保存在单进程内；多进程或公网部署需要代理层限流及滥用防护。
- 当前没有邮箱验证、找回密码、修改密码或账号删除功能。
- 账号隔离不是端到端加密；服务器与数据库管理员仍能读取数据。不要记录敏感个人信息。
- SQLite 适合小规模使用，扩展部署前需规划共享存储、迁移与备份。

## 数据与备份

新数据位于 SQLite 的 `library_*` 表。旧餐厅和匿名评论保留，不自动归属给任何账号。旧公开推荐、餐厅详情和反馈 API 已废弃并要求管理员令牌；旧管理与导入 API 保留，前端不再提供公共评论流程。

备份整个数据库才能保留账号、记录、会话和分享：

```bash
sqlite3 data/where_to_eat.db ".backup '/safe/path/where_to_eat_backup.db'"
```

如配置了 `SQLITE_PATH`，替换为实际路径。备份目录需预先存在，限制访问权限：备份包含私人内容及凭据哈希。恢复前停止服务、保留现有数据库副本，再恢复到配置路径并核对文件权限。

旧 `scripts/sqlite_backup.py` 只导出历史餐厅与评论，不包含个人库数据，不能用作当前产品的完整备份。

## 验证

```bash
uv run python -m pytest tests -q
npm --prefix frontend test
npm --prefix frontend run build
cd frontend
npx playwright install chromium
npm run test:e2e
```

端到端测试使用隔离临时数据库和两个账号，覆盖记录、选定分享、预览导入、权限隔离、撤销和手机布局。真实高德请求依赖密钥权限与外部网络，不由离线测试保证。

## 项目结构

- `app/api/library.py`：账号、个人库、分享与附近餐厅 API。
- `app/services/library_service.py`：账号隔离、持久化、分享快照与导入去重。
- `frontend/src/library/`：React 个人库、表单、分享与地图界面。
- `PRODUCT.md`：产品定位；`CONTEXT.md`：领域术语。
- `/docs`：FastAPI 接口文档；`/health`：健康检查。
- `docs/legacy-public-reviews.md`：旧版历史说明，不作为当前运行指南。
