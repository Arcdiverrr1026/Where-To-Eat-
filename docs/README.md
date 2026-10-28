# Where To Eat

React + JavaScript、Express、PostgreSQL 的附近就餐决策应用。前后端应用代码统一使用箭头函数。以易读、可讲解的代码为目标，不使用 TypeScript、ORM、微服务或大模型。

## 在 OrbStack 中运行

要求 Node.js 22+、npm 和已启动的 OrbStack（Docker context 为 `orbstack`）。

```sh
npm install
npm run setup
docker compose up -d --build --wait
```

打开 http://localhost:8080 。开发机只映射前端端口；数据库和 Express 均在容器网络中，不干扰已有的 5432 数据库。

`npm run setup` 创建未跟踪的 `.env`，随机生成数据库和管理员密码，保留已有配置。普通演示用户名为 `demo`，初始密码为 `eat-together-2026`；可以在首次启动前更改 `.env` 中的 `DEMO_PASSWORD`。管理员用户名默认 `admin`，密码查看本机 `.env` 的 `ADMIN_PASSWORD`。不要把 `.env` 提交到 Git。

首次启动自动应用 SQL 迁移并创建普通演示账号和管理员账号，不创建餐厅或评价。重新启动保留账号、会话、收藏和评价；更改环境变量不会自动重置已有账号密码。需要改密时通过受控的数据库维护操作更新密码哈希，不要为改密删除数据卷。

## 配置真实地图

在高德开放平台申请 **Web 服务 API Key**，填入 `.env` 的 `AMAP_API_KEY`，再运行：

```sh
docker compose up -d --force-recreate api
```

浏览器从不接收这个 Key。前端通过本站 API 请求周边餐厅和地理编码，辅助地图通过链接打开高德地图，无需 JS SDK Key。缺 Key、Key 无效、服务失败或无结果时均显示对应状态，绝不自动添加示例餐厅。

可输入“城市 + 地标”查询位置，也可使用浏览器定位；浏览器 WGS84 坐标在查询前转换为高德 GCJ-02，手动坐标入口需要填写 GCJ-02。浏览器定位需要 localhost 或 HTTPS。地标匹配可能有歧义，请确认所返回地址。地图人均和营业时间由第三方提供，不是本站核实的实时承诺。Key 配额及可存储/展示范围以你申请的高德服务条款为准。

## 已实现的流程

- 游客：选择位置 → 口味、预算、距离筛选 → 推荐理由 → 餐厅详情 → 在高德地图查看。
- 演示账号：登录/退出、收藏/取消收藏、发表/更新/删除自己的评价。
- 管理员：浏览分页餐厅和评价，覆盖店名/地址/价格，隐藏/恢复餐厅，删除不当评价。管理员登录后导航出现“管理”。

同一演示账号的使用者共享收藏和评价，所以“本站评价数”不是独立用户数。没有注册、短信、邮箱找回或第三方登录。

## 排序与数据边界

高德返回附近最多 25 家候选，后端再按直线距离和预算筛选，12 家一页。页面明确展示这个候选范围，不承诺枚举所有附近餐厅。

```
距离得分 = 80 × max(0, 1 - 直线距离 / 搜索半径)
评价得分 = 本站评价数 >= 3 ? 20 × 本站均分 / 5 : 0
排序分 = 距离得分 + 评价得分
```

分数仅用于排序，不是推荐准确率；同分按距离和高德 ID 确定顺序。预算是过滤条件，价格未知时不猜测；口味是传递给地图的搜索关键词，不是用户画像。理由和得分均由后端产生，前端不复制排序规则。

## 代码入口

| 路径                            | 职责                               |
| ------------------------------- | ---------------------------------- |
| `frontend/src/App.jsx`          | 导航、账号状态、收藏与通知         |
| `frontend/src/pages/`           | 页面：搜索、详情、收藏、登录、管理 |
| `frontend/src/components/`      | 可复用界面组件                     |
| `frontend/src/hooks/`           | `useResource`、`useRoute`          |
| `frontend/src/services/`        | 写操作与搜索请求、坐标转换         |
| `frontend/src/utils/`           | 价格、日期与地图链接格式化         |
| `backend/src/app.js`            | Express 中间件、错误处理           |
| `backend/src/routes.js`         | 请求校验、权限检查和接口           |
| `backend/src/restaurants.js`    | 手写 SQL 与餐厅数据访问            |
| `backend/src/recommendation.js` | 无副作用的推荐规则                 |
| `backend/src/amap.js`           | 地图 HTTP 请求、超时与字段解析     |
| `backend/src/auth.js`           | scrypt 密码、Cookie 会话、登录限流 |
| `backend/sql/001-initial.sql`   | 数据表、外键、约束和索引           |

旧 Python、静态页面与评分推断逻辑已移除，旧实现可从 Git 历史查看。现有 SQLite 不自动导入；迁移前检查未跟踪文件，若确有需要保留的业务数据，再写显式迁移脚本。旧设计文档仅描述历史版本，见 `docs/legacy/`。

## 检查

```sh
npm run lint
npm test
npm run build
npm run test:integration
# 全容器启动后，验证 nginx → Express → PostgreSQL 与登录
npm run test:smoke
```

集成测试要求 Docker 和 Postman CLI 1.70+，会自动启动隔离的临时 PostgreSQL（本机 55439 端口）及本地 Postman simulation（4901 端口），验证真正的 Express → HTTP 地图替身 → PostgreSQL 链路；结束后清理测试容器。不会清空应用数据卷，不需要真实 Key。测试夹具清楚标为非真实餐厅，不会出现在正常应用中。

完整接口及错误语义见 `docs/api.md`；架构与学习路线见 `docs/architecture.md`。测试通过仅说明本地与受控 HTTP 替身行为，不能替代真实高德 Key 联调。

## 本机热更新

先仅启动带本地端口的数据库，再分别启动 Express 和 Vite：

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db
npm run dev:api
# 另一个终端
npm run dev
```

前端位于 http://localhost:5173 ，Express 位于 3001，开发脚本从 `.env` 读取数据库密码并连接 localhost:5433。Vite 将 `/api` 代理到 Express；开发脚本将允许来源设为 5173。可使用 DATABASE_URL 覆盖数据库连接。回到全容器模式时执行 `docker compose up -d --build --wait`，数据库将恢复仅容器内可访问。

## 停止与后续部署

```sh
docker compose down
```

默认保留数据卷。**不要执行 `docker compose down -v`，除非明确要永久删除数据库。**

服务器部署留到后续：准备 HTTPS 反向代理、修改 APP_ORIGIN 与账号密码、安排备份，再决定公网绑定。当前 Compose 仅绑定 127.0.0.1，适合本地开发和服务器反向代理，不会直接暴露到公网。
