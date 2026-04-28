# Where To Eat

一个面向大学生的校园餐厅真实评论平台原型。

当前项目已经包含：

- 首页筛选、推荐榜单、地图视图、店铺详情
- 评论导入页与后台管理页
- 店铺详情页支持用户直接提交真实评论并即时刷新页面概况
- 支持本地 JSON / CSV 文件导入评论
- 餐厅基础信息缓存
- 评论导入持久化
- 高德周边搜索接入骨架
- 无高德 Key 时的 mock 回退链路

## Tech Stack

- Backend: FastAPI
- Frontend: FastAPI 静态页面
- Storage: SQLite
- Config: python-dotenv

## Product Positioning

这个项目的核心不是“附近有什么吃的”，而是“学校附近这家店，最近大家到底怎么说”。

系统目前支持两类评论来源：

- 用户在店铺详情页直接提交真实评论
- 管理端或运营侧通过 JSON / CSV 批量补录历史评论

提交后会立即进入 SQLite，并更新这家店的评论概况，逐步形成校园内自己的餐厅评论池。

## Project Structure

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

## Environment

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

- `USE_MOCK_REVIEW_FALLBACK=false`：仅使用用户提交 / 导入的真实评论
- `USE_MOCK_REVIEW_FALLBACK=true`：开发演示时允许回退到 mock 评论
- `ADMIN_TOKEN`：访问后台管理 API 和清空试运行数据时需要在后台页输入的管理令牌

## Setup

项目当前使用现有虚拟环境。若本机已存在 `.venv`，可直接安装依赖：

```bash
cd "/Users/arcdiverrr/python program/where to eat"
./.venv/bin/pip install -e .
```

如果你已经按当前开发过程装好了依赖，可以跳过这一步。

## Bootstrap Demo Data

首次启动前，建议先执行一次：

```bash
cd "/Users/arcdiverrr/python program/where to eat"
PYTHONPATH=. ./.venv/bin/python scripts/bootstrap_demo.py
```

这个脚本会：

- 初始化 SQLite 表
- 预热 mock 餐厅缓存

它不会清空你已有的导入评论。

## Experimental Review Fetch Script

如果你想把“自动抓取评价”与现有导入链路分开，可以使用：

```bash
cd "/Users/arcdiverrr/python program/where to eat"
PYTHONPATH=. ./.venv/bin/python scripts/fetch_reviews_experimental.py \
  --restaurant-id r001 \
  --url 'https://example.com/restaurant-page' \
  --output /tmp/r001_reviews.json
```

如果只是先离线实验，也可以先保存 HTML 再解析：

```bash
PYTHONPATH=. ./.venv/bin/python scripts/fetch_reviews_experimental.py \
  --restaurant-id r001 \
  --html-file /path/to/page.html \
  --import-to-db
```

说明：

- 这是实验脚本，不会修改推荐主链路
- 当前优先尝试从页面里的 `application/ld+json` 或内联 JSON 提取评论
- 输出格式会对齐现有评论导入接口
- 如果传入 `--import-to-db`，脚本会复用项目当前的评论导入服务写入 SQLite

## Run

```bash
cd "/Users/arcdiverrr/python program/where to eat"
PYTHONPATH=. ./.venv/bin/uvicorn app.main:app --reload
```

启动后可访问：

- `/` 首页筛选
- `/recommendations` 推荐榜单
- `/map-view` 地图视图
- `/restaurant-view?id=r001` 店铺详情
- `/review-import?id=r001` 评论导入页
- `/admin` 后台管理页
- `/docs` FastAPI Swagger 文档

## Main APIs

```text
POST /api/recommend/restaurants
GET  /api/restaurants/{restaurant_id}
POST /api/reviews/feedback
POST /api/reviews/import
GET  /api/admin/dashboard
GET  /health
```

## Review Feedback

在 `/restaurant-view?id=r001` 页面里，用户可以直接：

- 选择一个口语化态度档位
- 填写一句真实评论
- 提交后立即出现在这家店的评论区里

## Review Import Format

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

## Notes

- `data/where_to_eat.db` 是本地 SQLite 数据库，已加入 `.gitignore`
- 导入评论和缓存餐厅都会写入 SQLite
- 当前评论来源仍以 mock 与导入数据为主，真实平台评论抓取尚未接入
- 当前前端为静态页面方案，适合原型、实习项目演示和快速联调
