# 远程部署

访问地址：http://20.48.103.233/where_to_eat/

SSH 目标为 `lucent@20.48.103.233`，应用目录为 `/srv/where_to_eat`，Compose 项目名为 `where_to_eat`。前端、Express API 和 PostgreSQL 分别运行在容器中。Web 只绑定服务器 `127.0.0.1:8081`，由现有 Nginx 的 `/where_to_eat/` 路径转发，数据库不开放公网端口。

## 更新

在本地项目根目录运行：

```sh
bash deploy/deploy.sh
```

脚本使用 `~/Documents/lucent-azure_key.pem`，在 macOS 上通过仓库内的直连代理避开 TUN 路由。可用 `WTE_SSH_KEY` 覆盖密钥路径。部署前需要本地 `.env.remote`，包含远程数据库密码、演示账号和管理员密码、AMap Key，以及 `APP_ORIGIN=http://20.48.103.233`。此文件已被 Git 和 Docker 构建上下文忽略；不要提交或分享其完整内容。账号名为 `demo` 和 `admin`，密码分别查看该文件的 `DEMO_PASSWORD` 和 `ADMIN_PASSWORD`。

脚本上传当前工作区源码并在服务器构建，不要求先提交 Git。数据库使用独立持久卷 `where_to_eat_postgres_data`。日常更新应保留 `.env.remote` 中的数据库密码；修改环境变量不会自动修改已有 PostgreSQL 用户密码。

## 维护

SSH 登录服务器后执行：

```sh
cd /srv/where_to_eat
sudo docker compose -f compose.yaml -f compose.server.yaml ps
sudo docker compose -f compose.yaml -f compose.server.yaml logs --tail=100 api
sudo docker compose -f compose.yaml -f compose.server.yaml restart
```

不要使用 `down -v`，它会删除数据库持久卷。数据库备份可使用容器内的 `pg_dump`；备份文件应保存在应用目录之外并限制访问。

前端构建基路径和会话 Cookie 路径均为 `/where_to_eat/`，本地默认部署仍使用根路径。当前为 HTTP IP 访问，浏览器通常不允许自动定位，可使用地标搜索或手动坐标。自动定位及加密登录需要后续配置 HTTPS。

## 本次验证

三容器健康检查、网页及静态资源、公网地点搜索、真实高德附近餐厅查询、登录、收藏读取、管理员权限拒绝、跨站请求拒绝、退出与会话撤销均已通过。原有 `/`、`/notes/` 和 `/phonebook/` 访问返回 200。本地 17 项接口集成测试通过。
