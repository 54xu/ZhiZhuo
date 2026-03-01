# 致卓收银 - ZhiZhuo POS System

足浴/SPA门店微信小程序收银管理系统。

## 技术栈

- **前端**: UniApp (Vue 3 + Composition API) + Pinia + TypeScript, 目录 `miniapp/`
- **后端**: Node.js + Express 5 + Prisma 5 + MySQL 8.0 + TypeScript, 目录 `server/`
- **数据库**: MySQL `zhizhuo_pos`, root用户空密码, `mysql://root:@localhost:3306/zhizhuo_pos`
- **测试**: Jest + ts-jest (84 tests, 4 suites)
- **部署**: Docker Compose (4容器: MySQL + Redis + API + Nginx)

## 项目结构

```
ZhiZhuo/
├── miniapp/                    # UniApp 前端
│   ├── .env.development        # 开发环境 API 地址
│   ├── .env.production         # 生产环境 API 地址 (当前指向云服务器)
│   └── src/
│       ├── pages/              # 主包 TabBar (workspace/customer/member/mine/index)
│       ├── sub-packages/       # 分包 (cashier/member/staff/report/admin)
│       ├── store/modules/      # Pinia stores (user/room/order/schedule/feature-flag)
│       ├── api/                # API 封装 (request.ts 统一封装, 各模块独立文件)
│       ├── core/               # PluginSlot 插件槽位系统
│       └── components/         # 公共组件
├── server/                     # Node.js 后端
│   ├── Dockerfile              # 多阶段构建 (node:18-alpine, 含 OpenSSL 修复)
│   ├── src/
│   │   ├── core/               # EventBus, HookRegistry, FeatureFlag 扩展基础设施
│   │   ├── modules/            # 业务模块 (auth/admin/cashier/member/schedule/commission/report/payment)
│   │   ├── middleware/         # JWT认证, RBAC权限
│   │   └── __tests__/          # Jest 单元测试
│   └── prisma/
│       ├── schema.prisma       # 18个模型, 含V2/V3预留字段, binaryTargets含musl
│       └── seed.ts             # 演示数据
├── docker-compose.prod.yml     # 生产Docker编排 (4服务, 与EMS隔离)
├── .env.prod                   # 生产环境变量
├── nginx/nginx.conf            # Nginx反向代理配置
├── deploy.sh                   # 一键部署/管理脚本
├── DEPLOY-QUICK.md             # 部署快速指南
└── ssh_deploy.py               # Python SSH部署工具 (paramiko)
```

## 启动方式

```bash
# 后端 (端口3000)
cd server && npm run build && npm start
# 或开发模式: npm run dev

# 前端 H5 预览 (端口5173)
cd miniapp && node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js
# 注意: Windows下 npx/npm 作为 runtimeExecutable 会 ENOENT, 必须用 node 直接执行

# 前端编译微信小程序
cd miniapp && node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build --platform mp-weixin
# 输出到 dist/build/mp-weixin/, 用微信开发者工具导入

# 数据库初始化
cd server && npx prisma db push && npm run seed
```

## 云服务器部署

### 服务器信息
- **IP**: 43.138.68.65 (腾讯云)
- **用户**: ubuntu
- **部署目录**: ~/zhizhuo-deploy/
- **同服务器还有**: EMS项目 (ems-mysql:3306, ems-redis:6379, ems-backend:8080, ems-nginx:80/443)

### 致卓收银容器架构
| 容器 | 端口 | 说明 |
|------|------|------|
| zhizhuo-mysql | 内部3306 (不暴露) | MySQL 8.0, 数据库zhizhuo_pos |
| zhizhuo-redis | 内部6379 (不暴露) | Redis 7 (预留) |
| zhizhuo-api | 3000:3000 | Node.js API服务 |
| zhizhuo-nginx | 8800:80 | Nginx反向代理 |

### 部署命令
```bash
# 通过 ssh_deploy.py 或直接SSH到服务器
cd ~/zhizhuo-deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 初始化数据库
docker compose -f docker-compose.prod.yml exec api npx prisma db push
docker compose -f docker-compose.prod.yml exec api node dist/seed.js

# 查看状态
docker compose -f docker-compose.prod.yml ps
```

### 安全组需开放端口
- TCP 3000 (API直连)
- TCP 8800 (Nginx代理)

### 关键部署修复记录
1. **Prisma libssl.so.1.1**: Alpine 3.21 用 OpenSSL 3.x, 需在 Dockerfile 加 `apk add openssl openssl-dev` + schema.prisma 加 `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`
2. **Seed ESM 问题**: 容器内 ts-node 不支持 import, Dockerfile 中用 tsc 编译 seed.ts → dist/seed.js
3. **NODE_ENV=production 阻止 mock 登录**: .env.prod 中设 `NODE_ENV=development` 使开发登录可用
4. **Docker权限**: ubuntu用户需 `sg docker -c "命令"` 或 sudo 运行 docker 命令

## 微信小程序编译

### 环境变量
- `miniapp/.env.development` → `VITE_API_BASE_URL=http://43.138.68.65:3000/api/v1`
- `miniapp/.env.production` → `VITE_API_BASE_URL=http://43.138.68.65:3000/api/v1`
- **重要**: `build` 模式 (dist/build/) 读 `.env.production`, `dev` 模式 (dist/dev/) 读 `.env.development`

### 编译命令
```bash
cd miniapp
node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build --platform mp-weixin
# 输出: dist/build/mp-weixin/
# 微信开发者工具导入此目录
```

### 微信开发者工具设置
- 勾选 "不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书" (因为用HTTP非HTTPS)
- 位置: 详情 → 本地设置

### PluginSlot 小程序兼容
`miniapp/src/components/PluginSlot.vue` 已简化为空占位组件，因为:
- `<component :is>` 不支持小程序
- JSDoc 中的 HTML 示例会被 Vue 编译器解析报错

## API 结构

所有后端路由挂载在 `/api/v1/*`，前端 `request.ts` 中 `BASE_URL` 从环境变量读取。

| 路由前缀 | 模块 | 说明 |
|-----------|------|------|
| `/api/v1/auth` | auth | 微信登录/绑定/profile |
| `/api/v1/stores` | admin | 门店 CRUD |
| `/api/v1/zones` | admin | 区域 CRUD |
| `/api/v1/rooms` | admin | 房台 CRUD + 状态管理 |
| `/api/v1/services` | admin | 服务项目 CRUD |
| `/api/v1/employees` | admin | 员工 CRUD |
| `/api/v1/recharge-plans` | admin | 充值方案 CRUD |
| `/api/v1/commission-rules` | admin | 提成规则 CRUD |
| `/api/v1/orders` | cashier | 开单/加单/结账/退款 |
| `/api/v1/members` | member | 会员 CRUD + 充值 (搜索用 `?keyword=`) |
| `/api/v1/schedules` | schedule | 排班管理 |
| `/api/v1/commissions` | commission | 提成记录查询 |
| `/api/v1/reports` | report | 报表统计 + Excel导出 |
| `/api/v1/payment` | payment | 微信支付(create/notify/refund) |
| `/api/v1/feature-flags` | core | 功能开关查询 |

## 测试账号 (seed数据)

| 角色 | 工号 | 手机号 | 姓名 |
|------|------|--------|------|
| admin | E001 | 13800000001 | 张店长 |
| cashier | E002 | 13800000002 | 李收银 |
| technician | E003 | 13800000003 | 王师傅 |
| technician | E004 | 13800000004 | 赵师傅 |
| technician | E005 | 13800000005 | 刘师傅 |

门店: 致卓足浴旗舰店 (id=1), 3个区域(A/B/C), 9个房台, 6个服务项目, 3个会员, 4个充值方案, 3个提成规则, 3个排班

## 开发模式登录 (绕过微信)

登录页有"开发测试快速登录"区域，选角色后点击"快速登录"按钮。流程:
1. 前端调 `authApi.wxLogin('dev-E001')` → 每个账号用不同 mock code `dev-${employeeNo}`
2. 后端识别 mock code → 如已绑定直接返回 token，否则前端自动调 bind
3. 保存 token 后 `uni.switchTab` 跳转工作台

## 扩展架构 (V2/V3预留)

V1 已实现四大扩展基础设施:
- **EventBus** (`core/event-bus.ts`): 异步事件 (ORDER_CHECKOUT_SUCCESS 等)
- **HookRegistry** (`core/hook-registry.ts`): 同步钩子 (cashier.checkout validate→before→after)
- **FeatureFlag** (`core/feature-flag.service.ts`): 门店级功能开关 (feature_flag表)
- **PluginSlot** (`core/plugin-slot.vue`): 前端UI动态注入 (小程序中为空占位)

数据库表已预留 V2/V3 nullable 字段 (coupon_id, points_used, level_discount 等)。

## 当前进度

### 已完成 (V1)
- [x] 项目骨架 + 数据库18表
- [x] 扩展基础设施 (EventBus/HookRegistry/FeatureFlag/PluginSlot)
- [x] 后端全部8个模块 (auth/admin/cashier/member/schedule/commission/report/payment)
- [x] 前端29个页面 (5 TabBar + 24分包页面)
- [x] 微信支付集成 (含开发模式mock)
- [x] Excel报表导出 (5类)
- [x] Seed演示数据
- [x] 84个单元测试全部通过
- [x] 开发模式快速登录 (绕过微信, 每个角色独立mock code)
- [x] API端到端验证通过 (登录→开单→结账→余额扣减→提成→报表)

### 已完成 (部署)
- [x] Docker 多阶段构建 + Alpine 兼容修复
- [x] docker-compose.prod.yml (4容器, 与 EMS 隔离)
- [x] 一键部署脚本 deploy.sh + ssh_deploy.py
- [x] 云服务器部署成功 (43.138.68.65, API端口3000, Nginx端口8800)
- [x] 数据库初始化 + seed 数据导入
- [x] API 远程验证通过 (健康检查/登录/绑定/房台/服务/开单 全部OK)
- [x] 部署文档 (DEPLOY-QUICK.md)

### 已完成 (小程序编译)
- [x] 微信小程序编译通过 (mp-weixin)
- [x] PluginSlot 小程序兼容修复
- [x] .env.production 指向云服务器 API
- [x] 微信开发者工具可导入运行

### 待验证
- [ ] 微信开发者工具中快速登录功能 (API地址已修正, 需用户重新导入验证)

### 未开始
- [ ] V2 模块 (优惠券/积分/礼品/子卡/通知/二维码/分单/销售分析)
- [ ] V3 模块 (会员等级/余额转移/预约/分期/退货/客服/连锁)
- [ ] 域名 ICP 备案 (zzwangluo.com, 腾讯云要求备案才能通过域名访问)
- [ ] 微信支付真实对接 (当前为mock模式)
- [ ] HTTPS/SSL 配置 (当前API通过HTTP访问)

## PRD 位置

完整PRD文档: `C:\Users\Tye\.claude\plans\encapsulated-dancing-hanrahan.md`

## 注意事项

- **禁止使用 preview_start 启动服务**：preview 内置 Chromium 与 UniApp H5 开发模式不兼容，会频繁卡死/崩溃（target closed）。改用后台 Bash 运行服务，通过 curl 验证 API。
- **小程序编译环境变量**: build 模式读 `.env.production`, dev 模式读 `.env.development`, 改了 API 地址后必须对应修改正确的 env 文件
- UniApp 不支持 PATCH 方法, 只用 GET/POST/PUT/DELETE
- 会员搜索是 `GET /api/v1/members?keyword=xxx`, 不是 `/members/search`
- 会员余额分3字段: balance(总额), real_balance(实充), gift_balance(赠送), 消费时先扣赠送
- Windows 下启动前端必须用 `node` 直接执行 uni.js, npx 会报 ENOENT
- 后端 Express 5 的路由处理器不需要 next(), 但异步错误需要手动 catch
- MySQL DATE 字段时区：Prisma 将 DATE 读为 `YYYY-MM-DDT00:00:00.000Z`（UTC 午夜），查询 DATE 字段必须用 `new Date(dateStr + 'T00:00:00Z')` 而非本地时间。DateTime 字段（createdAt 等）用本地时间没问题。
- `<component :is>` 在小程序环境不支持, PluginSlot 已简化为空占位
- Prisma 在 Alpine 容器需要 `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` + 安装 openssl
