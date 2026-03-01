# 致卓收银 - 快速部署指南（Docker 一键部署）

> 本文档面向已有云服务器的场景，一键部署后端 API 服务。

---

## 目录

1. [服务架构](#服务架构)
2. [前置要求](#前置要求)
3. [一键部署](#一键部署)
4. [安全组配置](#安全组配置)
5. [日常运维](#日常运维)
6. [更新部署](#更新部署)
7. [环境配置说明](#环境配置说明)
8. [常见问题](#常见问题)

---

## 服务架构

```
                    ┌──────────────────────────────────┐
                    │        Docker Network             │
  用户请求           │     (zhizhuo-network)             │
     │              │                                    │
     ▼              │  ┌─────────┐    ┌──────────────┐  │
  :8800 ───────────►│  │  Nginx  │───►│  Node.js API │  │
  (Nginx入口)       │  │  :80    │    │  :3000       │  │
                    │  └─────────┘    └──────┬───────┘  │
                    │                         │          │
                    │              ┌──────────┼────────┐ │
                    │              ▼                    ▼ │
                    │         ┌─────────┐      ┌───────┐ │
                    │         │  MySQL   │      │ Redis │ │
                    │         │  :3306   │      │ :6379 │ │
                    │         └─────────┘      └───────┘ │
                    │         (内部访问)        (内部访问)  │
                    └──────────────────────────────────┘
```

**端口使用**（避免与其他项目冲突）：

| 端口 | 用途 | 对外暴露 |
|------|------|----------|
| 8800 | Nginx 入口（可配置） | ✅ |
| 3000 | API 直连（调试用，可配置） | ✅ |
| 3306 | MySQL | ❌ 仅内部 |
| 6379 | Redis | ❌ 仅内部 |

---

## 前置要求

- 云服务器（2核4G+，Ubuntu 20.04/22.04）
- Docker 已安装（`docker --version`）
- Docker Compose V2 已安装（`docker compose version`）

如未安装 Docker：
```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker && sudo systemctl enable docker
sudo usermod -aG docker $USER
# 重新登录后生效
```

---

## 一键部署

### 步骤 1：上传项目到服务器

**方法 A：本地打包上传（推荐）**

```bash
# 本地 (Windows)
cd D:\ZhiZhuo

# 打包（排除 node_modules、.git、前端等）
tar -czf zhizhuo-deploy.tar.gz \
  --exclude='node_modules' --exclude='.git' --exclude='dist' \
  server/ nginx/ docker-compose.prod.yml .env.prod deploy.sh

# 上传
scp zhizhuo-deploy.tar.gz ubuntu@你的服务器IP:~/

# 服务器上解压
ssh ubuntu@你的服务器IP
mkdir -p ~/zhizhuo-deploy
tar -xzf ~/zhizhuo-deploy.tar.gz -C ~/zhizhuo-deploy
chmod +x ~/zhizhuo-deploy/deploy.sh
```

**方法 B：Git Clone**

```bash
ssh ubuntu@你的服务器IP
git clone https://你的仓库.git ~/zhizhuo-deploy
```

### 步骤 2：配置环境变量

编辑 `~/zhizhuo-deploy/.env.prod`：

```bash
cd ~/zhizhuo-deploy
nano .env.prod
```

核心配置项：

```env
# MySQL 密码（必改，用强密码）
MYSQL_ROOT_PASSWORD=你的强密码

# JWT 密钥（必改）
JWT_SECRET=用 openssl rand -hex 32 生成

# 运行模式
# development = 开启 mock 登录（测试阶段用）
# production = 正式模式（需要微信 AppID/Secret）
NODE_ENV=development

# 端口（如与其他项目冲突可修改）
API_PORT=3000
NGINX_PORT=8800

# 微信配置（正式上线时填写）
WX_APPID=
WX_SECRET=
WX_MCH_ID=
WX_PAY_API_KEY=
```

### 步骤 3：一键启动

```bash
cd ~/zhizhuo-deploy
./deploy.sh
```

脚本会自动：
1. ✅ 检查 Docker 环境
2. ✅ 拉取基础镜像（MySQL、Redis、Nginx、Node.js）
3. ✅ 构建 API 镜像
4. ✅ 启动所有 4 个容器
5. ✅ 等待健康检查通过
6. ✅ 执行数据库 Schema 同步（Prisma db push）

### 步骤 4：导入演示数据

```bash
# 导入 Seed 数据（门店、员工、服务、会员等）
docker exec zhizhuo-api sh -c "node dist/seed.js"
```

### 步骤 5：验证

```bash
# 健康检查
curl http://localhost:8800/health
# 返回: {"status":"ok","timestamp":"..."}

# 测试登录（development 模式）
curl -X POST http://localhost:8800/api/v1/auth/wx-login \
  -H "Content-Type: application/json" \
  -d '{"code":"dev-E001"}'
# 返回: {"code":0,"data":{"needBind":true,"openid":"mock_openid_dev-E001"}}
```

---

## 安全组配置

> ⚠️ 部署完成后，需要在云服务商控制台开放端口，否则外部无法访问。

### 腾讯云

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 云服务器 → 安全组 → 找到对应安全组
3. 添加入站规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 8800 | 0.0.0.0/0 | 致卓 Nginx 入口 |
| TCP | 3000 | 0.0.0.0/0 | 致卓 API 直连（可选，调试用） |

### 阿里云

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. 安全组 → 配置规则 → 入方向 → 添加

配置同上。

### 验证外部访问

```bash
# 从本地电脑
curl http://你的服务器IP:8800/health
```

---

## 日常运维

deploy.sh 提供了所有日常运维命令：

```bash
cd ~/zhizhuo-deploy

# 查看服务状态
./deploy.sh status

# 查看 API 日志
./deploy.sh logs
./deploy.sh logs mysql    # MySQL 日志
./deploy.sh logs redis    # Redis 日志

# 重启所有服务
./deploy.sh restart

# 停止所有服务
./deploy.sh stop

# 重新部署（代码更新后）
./deploy.sh update

# 查看部署信息
./deploy.sh info
```

### 数据库备份

```bash
# 手动备份
docker exec zhizhuo-mysql mysqldump -uroot -p'你的密码' zhizhuo_pos > backup_$(date +%Y%m%d).sql

# 定时备份（每天凌晨3点）
mkdir -p ~/zhizhuo-backups
crontab -e
# 添加：
# 0 3 * * * docker exec zhizhuo-mysql mysqldump -uroot -p'你的密码' zhizhuo_pos | gzip > ~/zhizhuo-backups/$(date +\%Y\%m\%d).sql.gz

# 恢复备份
gunzip < backup_20260301.sql.gz | docker exec -i zhizhuo-mysql mysql -uroot -p'你的密码' zhizhuo_pos
```

---

## 更新部署

代码更新后，只需 3 步：

```bash
# 1. 本地打包
cd D:\ZhiZhuo
tar -czf zhizhuo-deploy.tar.gz --exclude='node_modules' --exclude='.git' --exclude='dist' \
  server/ nginx/ docker-compose.prod.yml .env.prod deploy.sh

# 2. 上传到服务器
scp zhizhuo-deploy.tar.gz ubuntu@你的服务器IP:~/

# 3. 服务器上解压并更新
ssh ubuntu@你的服务器IP
tar -xzf ~/zhizhuo-deploy.tar.gz -C ~/zhizhuo-deploy
cd ~/zhizhuo-deploy && ./deploy.sh update
```

`./deploy.sh update` 会自动重新构建 API 镜像、重启服务、同步数据库。

---

## 环境配置说明

### 文件结构

```
zhizhuo-deploy/
├── .env.prod                  # 环境变量（密码、密钥等）
├── deploy.sh                  # 一键部署/运维脚本
├── docker-compose.prod.yml    # Docker Compose 配置
├── nginx/
│   └── nginx.conf             # Nginx 反向代理配置
└── server/
    ├── Dockerfile             # API 镜像构建
    ├── package.json
    ├── prisma/                # 数据库 Schema + Seed
    ├── src/                   # 后端源码
    └── tsconfig.json
```

### docker-compose.prod.yml 服务说明

| 服务 | 镜像 | 容器名 | 说明 |
|------|------|--------|------|
| mysql | mysql:8.0 | zhizhuo-mysql | 数据库，数据持久化到 volume |
| redis | redis:7-alpine | zhizhuo-redis | 缓存，数据持久化到 volume |
| api | 自建镜像 | zhizhuo-api | Node.js 后端，依赖 mysql+redis |
| nginx | nginx:alpine | zhizhuo-nginx | 反向代理，统一入口 |

### 切换到正式模式

当微信小程序审核通过、支付配置完成后：

```bash
# 编辑 .env.prod
nano ~/zhizhuo-deploy/.env.prod

# 修改：
NODE_ENV=production
WX_APPID=wx你的appid
WX_SECRET=你的secret
WX_MCH_ID=你的商户号
WX_PAY_API_KEY=你的API密钥

# 重启
cd ~/zhizhuo-deploy && ./deploy.sh update
```

---

## 常见问题

### Q: Prisma 报 libssl 错误

```
Error loading shared library libssl.so.1.1
```

**原因**：Alpine 镜像缺少 OpenSSL。
**解决**：Dockerfile 中已添加 `apk add --no-cache openssl`，同时 Prisma schema 已配置 `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`。如仍报错，重新构建：
```bash
./deploy.sh update
```

### Q: 端口冲突

编辑 `.env.prod` 修改端口：
```env
API_PORT=3001      # 默认 3000
NGINX_PORT=8801    # 默认 8800
```
然后 `./deploy.sh update`。

### Q: 外部无法访问

1. 确认安全组已开放对应端口
2. 确认容器正在运行：`./deploy.sh status`
3. 确认 Nginx 正常：`docker logs zhizhuo-nginx`

### Q: 数据库数据会丢失吗？

不会。MySQL 和 Redis 数据存储在 Docker Volume 中，容器重启/重建不会丢失数据。
除非执行 `./deploy.sh destroy`（会删除所有数据）。

### Q: 如何查看数据库？

```bash
# 进入 MySQL 容器
docker exec -it zhizhuo-mysql mysql -uroot -p'你的密码' zhizhuo_pos

# 查看表
SHOW TABLES;
SELECT * FROM store;
SELECT * FROM employee;
```

---

## 当前部署信息

| 项目 | 值 |
|------|-----|
| 服务器 | 43.138.68.65 (腾讯云) |
| 部署目录 | /home/ubuntu/zhizhuo-deploy |
| Nginx 入口 | http://43.138.68.65:8800 |
| API 直连 | http://43.138.68.65:3000 |
| 运行模式 | development（mock 登录开启） |
| 数据库 | zhizhuo_pos (Docker 内部 MySQL) |
| 测试账号 | E001 张店长(admin), E002 李收银(cashier), E003-E005 技师 |
