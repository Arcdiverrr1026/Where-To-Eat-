# Where To Eat

基于 FastAPI、静态前端和 SQLite 的校园餐厅检索与评价原型。当前默认分支为 Python 实现。

## 功能

本版本提供：

- 首页筛选、推荐榜单、地图视图、店铺详情
- 评论导入页与后台管理页
- 店铺详情页支持用户直接提交用户评论并即时刷新页面概况
- 支持本地 JSON / CSV 文件导入评论
- 餐厅基础信息缓存
- 评论导入持久化
- 高德周边搜索接入骨架
- 无高德 Key 时的 mock 回退链路

## 技术栈

- Backend: FastAPI
- Frontend: FastAPI 静态页面
- Storage: SQLite
- Config: python-dotenv

## 数据来源

餐厅数据来自地图服务或本地演示数据；评论来自用户提交及 JSON / CSV 导入。用户提交内容未经第三方平台验证，不等同于已核验消费评价。页面评论概况基于当前已存储数据。

## 目录结构

```text
app/
  api/                HTTP 路由
  clients/            外部服务客户端
  core/               配置、评论摘要
  data/               mock 餐厅与评论
  db/                 SQLite 存储层
  services/           推荐、评论、餐厅数据服务
frontend/
  *.html              页面
  assets/             JS 与 CSS
scripts/
  bootstrap_demo.py   初始化数据库并预热演示数据
  fetch_reviews_experimental.py  实验性抓取页面评论并转成导入格式
data/
  where_to_eat.db     SQLite 数据库文件
```

## 环境配置

可选 `.env` 配置：

```bash
AMAP_API_KEY=your_key_here
AMAP_JS_API_KEY=your_js_key_here
AMAP_SECURITY_JS_CODE=your_security_js_code
AMAP_RADIUS_METERS=3000
AMAP_PAGE_SIZE=20
SQLITE_PATH=/absolute/path/to/where_to_eat.db
USE_MOCK_FALLBACK=true
USE_MOCK_REVIEW_FALLBACK=false
ADMIN_TOKEN=change_this_for_local_admin
```

如果没有配置 `AMAP_API_KEY`，系统会自动回退到本地 mock 数据。

如果希望 `/map-view` 显示真实高德底图，还需要额外配置：

- `AMAP_JS_API_KEY`：高德 Web 端 JS API Key
- `AMAP_SECURITY_JS_CODE`：高德 JS API 安全密钥

默认情况下，系统不会再使用预置 mock 评论参与页面展示判断。

- `USE_MOCK_REVIEW_FALLBACK=false`：仅使用用户提交 / 导入的用户评论
- `USE_MOCK_REVIEW_FALLBACK=true`：开发演示时允许回退到 mock 评论
- `ADMIN_TOKEN`：访问后台管理 API 和清空试运行数据时需要在后台页输入的管理令牌

## 安装

项目当前使用 `uv` 管理依赖与虚拟环境。首次进入项目后执行：

```bash
git clone https://github.com/Arcdiverrr1026/Where-To-Eat-.git
cd Where-To-Eat-
uv sync
```

这会根据 `pyproject.toml` 和仓库内提交的 `uv.lock` 创建或更新 `.venv` 并安装依赖。
如果依赖声明有调整，重新执行一次 `uv sync` 即可。

## 演示数据初始化

首次启动前，建议先执行一次：

```bash
cd Where-To-Eat-
uv run python scripts/bootstrap_demo.py
```

这个脚本会：

- 初始化 SQLite 表
- 预热 mock 餐厅缓存

它不会清空你已有的导入评论。

## 实验性评论导入

如果你想把“自动抓取评价”与现有导入链路分开，可以使用：

```bash
cd Where-To-Eat-
uv run python scripts/fetch_reviews_experimental.py \
  --restaurant-id r001 \
  --url 'https://example.com/restaurant-page' \
  --output /tmp/r001_reviews.json
```

如果只是先离线实验，也可以先保存 HTML 再解析：

```bash
uv run python scripts/fetch_reviews_experimental.py \
  --restaurant-id r001 \
  --html-file /path/to/page.html \
  --import-to-db
```

说明：

- 这是实验脚本，不会修改推荐主链路
- 当前优先尝试从页面里的 `application/ld+json` 或内联 JSON 提取评论
- 输出格式会对齐现有评论导入接口
- 如果传入 `--import-to-db`，脚本会复用项目当前的评论导入服务写入 SQLite

## 启动

```bash
cd Where-To-Eat-
uv run uvicorn app.main:app --reload
```

启动后可访问：

- `/` 首页筛选
- `/recommendations` 推荐榜单
- `/map-view` 地图视图
- `/restaurant-view?id=r001` 店铺详情
- `/review-import?id=r001` 评论导入页
- `/admin` 后台管理页
- `/docs` FastAPI Swagger 文档

## 主要接口

```text
POST /api/recommend/restaurants
GET  /api/restaurants/{restaurant_id}
POST /api/reviews/feedback
POST /api/reviews/import
GET  /api/admin/dashboard
GET  /health
```

## 评论提交

在 `/restaurant-view?id=r001` 页面里，用户可以直接：

- 选择一个口语化态度档位
- 填写一句用户评论
- 提交后立即出现在这家店的评论区里

## 评论导入格式

你可以在 `/review-import` 页面里：

- 直接粘贴 JSON / CSV
- 选择本地 `.json` / `.csv` 文件后自动载入

导入后会立即刷新这家店的评论概况。

默认导入方式为“追加并去重”。如果需要重建某家店的历史评论，可以在导入页选择“覆盖旧评论”。

JSON:

```json
[
  { "rating": 5, "content": "羊肉串很香，分量足", "days_ago": 1 },
  { "rating": 2, "content": "高峰排队久", "days_ago": 3 }
]
```

CSV:

```csv
rating,content,days_ago
5,红烧肉下饭，价格友好,1
4,适合一个人吃，出餐快,2
```

## 数据与运行边界

- `data/where_to_eat.db` 是本地 SQLite 数据库，已加入 `.gitignore`
- 依赖版本由 `uv.lock` 锁定，日常安装与同步请使用 `uv sync`
- 导入评论和缓存餐厅都会写入 SQLite
- 当前评论来源仍以 mock 与导入数据为主，真实平台评论抓取尚未接入
- 当前前端为静态页面方案，适合原型、实习项目演示和快速联调
