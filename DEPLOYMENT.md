# 致卓收银 - 上线部署指南

## 前置条件清单

在开始之前，确认你有以下材料：

- [ ] 企业营业执照（个体工商户也行）
- [ ] 法人身份证正反面照片
- [ ] 一个已备案的域名（如 `zhizhuo.com`）
- [ ] 一台云服务器（2核4G起步）
- [ ] 一张企业对公银行账户（微信支付结算用）

---

## 第一阶段：注册微信小程序账号

### 步骤 1.1：注册小程序

1. 打开 https://mp.weixin.qq.com/
2. 点击右上角「立即注册」
3. 选择「小程序」类型
4. 用一个**未注册过微信公众平台**的邮箱注册
5. 进入邮箱点击激活链接
6. 选择主体类型「企业」或「个体工商户」
7. 上传营业执照、填写法人信息、进行法人微信扫码验证
8. 等待审核（通常 1-3 个工作日）

### 步骤 1.2：获取 AppID 和 AppSecret

1. 登录微信小程序后台 https://mp.weixin.qq.com/
2. 左侧菜单 →「开发」→「开发管理」→「开发设置」
3. 记录下：
   - **AppID(小程序ID)**: `wx________________`
   - **AppSecret(小程序密钥)**: 点击「重置」获取，**只显示一次，立即保存**

### 步骤 1.3：配置服务器域名

> ⚠️ 这一步需要先完成第二阶段（有域名和HTTPS后再来配置）

1. 小程序后台 →「开发」→「开发管理」→「开发设置」→「服务器域名」
2. 点击「修改」，配置：
   - request合法域名: `https://api.你的域名.com`
   - uploadFile合法域名: `https://api.你的域名.com`
   - downloadFile合法域名: `https://api.你的域名.com`

---

## 第二阶段：购买云服务器和域名

### 步骤 2.1：购买云服务器

推荐阿里云或腾讯云，新用户首年有优惠：

| 平台 | 推荐配置 | 参考价格 |
|------|----------|----------|
| 阿里云 ECS | 2核4G, 40G SSD, CentOS/Ubuntu | ~100元/月 |
| 腾讯云 CVM | 2核4G, 50G SSD, Ubuntu 22.04 | ~100元/月 |

**操作步骤（以腾讯云为例）：**
1. 打开 https://cloud.tencent.com/
2. 注册/登录 → 完成企业实名认证
3. 控制台 → 云服务器 → 新建实例
4. 选择：
   - 地域：选离你客户最近的（如华东-上海）
   - 镜像：Ubuntu 22.04 LTS
   - 规格：2核4G
   - 硬盘：50G SSD
   - 带宽：5Mbps（后续可调）
   - 安全组：放开 22(SSH)、80(HTTP)、443(HTTPS)、3000(API临时调试) 端口
5. 设置 root 密码，记住它
6. 购买完成后，记录**公网IP地址**

### 步骤 2.2：购买并备案域名

1. 在同一云平台购买域名（如 `zhizhuo.com`，约 50-80元/年）
2. 进行 ICP 备案（**必须，否则微信不允许**）：
   - 云平台控制台 → 备案中心 → 开始备案
   - 填写主体信息（企业）、网站信息
   - 上传营业执照、法人身份证
   - 等待管局审核（7-20个工作日）
3. 备案通过后，添加 DNS 解析：
   - `api.你的域名.com` → A记录 → 指向你的服务器公网IP

---

## 第三阶段：服务器环境搭建

### 步骤 3.1：SSH 连接服务器

```bash
# 在本地终端（Windows可用 PowerShell 或 Git Bash）
ssh root@你的服务器IP
```

### 步骤 3.2：安装 Docker

```bash
# Ubuntu 22.04
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 安装 Docker Compose
apt install docker-compose-plugin -y

# 验证
docker --version
docker compose version
```

### 步骤 3.3：上传项目到服务器

**方法A：通过 Git（推荐）**
```bash
# 服务器上
apt install git -y
mkdir -p /opt/zhizhuo
cd /opt/zhizhuo

# 如果你的代码在 GitHub/Gitee
git clone https://你的仓库地址.git .
```

**方法B：通过 SCP 直接上传**
```bash
# 在本地电脑执行（Windows PowerShell）
scp -r D:\ZhiZhuo\server root@你的服务器IP:/opt/zhizhuo/server
scp D:\ZhiZhuo\docker-compose.yml root@你的服务器IP:/opt/zhizhuo/
```

### 步骤 3.4：配置生产环境变量

```bash
# 在服务器上
cd /opt/zhizhuo/server

# 创建生产环境 .env 文件
cat > .env << 'EOF'
DATABASE_URL="mysql://root:这里换成强密码@mysql:3306/zhizhuo_pos"
JWT_SECRET="这里换成随机字符串-至少32位"
JWT_EXPIRES_IN="2h"
JWT_REFRESH_EXPIRES_IN="7d"

# 第一阶段获取的微信小程序配置
WX_APPID="wx你的appid"
WX_SECRET="你的appsecret"

# 第四阶段获取的微信支付配置（先留空，后面填）
WX_MCH_ID=""
WX_PAY_API_KEY=""
WX_PAY_NOTIFY_URL="https://api.你的域名.com/api/v1/payment/notify"
WX_PAY_CERT_PATH="./certs/apiclient_cert.pem"
WX_PAY_KEY_PATH="./certs/apiclient_key.pem"

REDIS_HOST="redis"
REDIS_PORT=6379
REDIS_PASSWORD=""
PORT=3000
NODE_ENV="production"
EOF
```

生成随机 JWT_SECRET 的方法：
```bash
openssl rand -hex 32
```

### 步骤 3.5：配置 MySQL 密码

```bash
cd /opt/zhizhuo

# 创建 .env 文件给 docker-compose 使用
cat > .env << 'EOF'
MYSQL_ROOT_PASSWORD=这里换成强密码（和上面server/.env里的一致）
JWT_SECRET=和上面一致的随机字符串
EOF
```

### 步骤 3.6：启动服务

```bash
cd /opt/zhizhuo

# 构建并启动所有服务（MySQL + Redis + API）
docker compose up -d --build

# 查看启动状态
docker compose ps

# 查看日志（确认无报错）
docker compose logs -f api
```

等待看到 `[Server] 致卓收银后端服务启动 - http://localhost:3000` 表示成功。

### 步骤 3.7：初始化数据库

```bash
# 进入 API 容器
docker compose exec api sh

# 在容器内执行
npx prisma db push
node -e "require('./dist/prisma/seed.js')"

# 退出容器
exit
```

如果 seed 报错，用以下方式：
```bash
# 在服务器上（容器外），安装 Node.js 用于执行 seed
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

cd /opt/zhizhuo/server
npm install
npx prisma db push
npm run seed
```

### 步骤 3.8：验证后端服务

```bash
# 在服务器上测试
curl http://localhost:3000/api/v1/feature-flags?storeId=1
# 应返回: {"code":200,"data":{}}

curl -X POST http://localhost:3000/api/v1/auth/wx-login \
  -H "Content-Type: application/json" \
  -d '{"code":"dev-E001"}'
# 应返回包含 token 的 JSON
```

---

## 第四阶段：配置 HTTPS（Nginx 反向代理）

### 步骤 4.1：安装 Nginx

```bash
apt install nginx -y
```

### 步骤 4.2：申请 SSL 证书（免费）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx -y

# 先配置基础 Nginx（让 certbot 验证域名）
cat > /etc/nginx/sites-available/zhizhuo << 'EOF'
server {
    listen 80;
    server_name api.你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/zhizhuo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 申请证书（自动配置 HTTPS）
certbot --nginx -d api.你的域名.com
# 按提示输入邮箱，同意条款，选择 redirect HTTP to HTTPS
```

### 步骤 4.3：验证 HTTPS

```bash
# 在本地浏览器访问
https://api.你的域名.com/api/v1/feature-flags?storeId=1
# 应返回 JSON 数据，浏览器显示安全锁
```

### 步骤 4.4：配置证书自动续期

```bash
# certbot 已自动设置定时任务，验证一下
certbot renew --dry-run
```

### 步骤 4.5：回到微信后台配置域名

现在你有了 HTTPS 域名，回到**步骤 1.3**，在微信小程序后台配置 `https://api.你的域名.com` 为合法域名。

---

## 第五阶段：申请微信支付（可与前面并行）

### 步骤 5.1：申请微信支付商户号

1. 打开 https://pay.weixin.qq.com/
2. 点击「接入微信支付」→「注册微信支付商户号」
3. 填写：
   - 商户类型：企业 / 个体工商户
   - 经营类目：选「生活服务」→「美容/美发/美甲」或「足浴/SPA」
   - 上传营业执照、法人身份证
   - 填写结算银行账户信息
4. 等待审核（1-5个工作日）
5. 审核通过后，获取：
   - **商户号 (mch_id)**: `16xxxxxxxx`
   - **API密钥**: 在商户平台 →「账户中心」→「API安全」→ 设置APIv2密钥

### 步骤 5.2：关联小程序

1. 商户平台 →「产品中心」→「AppID账号管理」
2. 关联你的小程序 AppID
3. 在小程序后台确认关联

### 步骤 5.3：下载支付证书

1. 商户平台 →「账户中心」→「API安全」→「API证书」
2. 下载证书压缩包，包含：
   - `apiclient_cert.pem`
   - `apiclient_key.pem`

### 步骤 5.4：上传证书到服务器

```bash
# 在本地执行
scp apiclient_cert.pem root@你的服务器IP:/opt/zhizhuo/server/certs/
scp apiclient_key.pem root@你的服务器IP:/opt/zhizhuo/server/certs/
```

### 步骤 5.5：更新服务器环境变量

```bash
# 在服务器上编辑
cd /opt/zhizhuo/server
nano .env

# 填入微信支付配置
WX_MCH_ID="你的商户号"
WX_PAY_API_KEY="你设置的API密钥"

# 重启服务
cd /opt/zhizhuo
docker compose restart api
```

---

## 第六阶段：编译并发布小程序

### 步骤 6.1：修改前端配置

在你的本地电脑（D:\ZhiZhuo）操作：

**1) 填入 AppID**

编辑 `miniapp/src/manifest.json`，找到 mp-weixin 部分：
```json
"mp-weixin": {
  "appid": "wx你的真实appid",
  "setting": {
    "urlCheck": true
  },
  "usingComponents": true
}
```

**2) 修改 API 地址**

编辑 `miniapp/.env.production`：
```
VITE_API_BASE_URL=https://api.你的域名.com/api/v1
```

### 步骤 6.2：编译微信小程序

```bash
cd D:\ZhiZhuo\miniapp

# 编译为微信小程序（生产模式）
node node_modules/@dcloudio/vite-plugin-uni/bin/uni.js build -p mp-weixin
```

编译成功后，输出目录在 `miniapp/dist/build/mp-weixin/`。

### 步骤 6.3：安装微信开发者工具

1. 下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 安装并用**小程序管理员的微信**扫码登录

### 步骤 6.4：导入项目到开发者工具

1. 打开微信开发者工具
2. 点击「导入项目」
3. 目录选择：`D:\ZhiZhuo\miniapp\dist\build\mp-weixin`
4. AppID 填入你的真实 AppID
5. 点击「导入」

### 步骤 6.5：在开发者工具中测试

1. 确认页面正常加载
2. 测试登录流程（此时需用真实微信登录，不是 dev 快速登录）
3. 测试开单→结账→支付全流程
4. 检查控制台无报错

> ⚠️ 真机测试：点击工具栏「真机调试」，用手机微信扫码，在真实手机上测试

### 步骤 6.6：上传代码

1. 在微信开发者工具中，点击右上角「上传」
2. 填写版本号（如 `1.0.0`）和项目备注
3. 上传成功

### 步骤 6.7：提交审核

1. 登录微信小程序后台 https://mp.weixin.qq.com/
2. 左侧「管理」→「版本管理」
3. 在「开发版本」中找到刚上传的版本
4. 点击「提交审核」
5. 填写：
   - 功能页面：选择小程序的主要页面截图
   - 类目：与营业执照经营范围一致
   - 功能介绍：简述小程序功能
6. 等待审核（通常 1-3 天，快的话几小时）

### 步骤 6.8：发布上线

审核通过后：
1. 小程序后台 →「管理」→「版本管理」→「审核版本」
2. 点击「全量发布」
3. 小程序正式上线，用户可以通过搜索或扫码访问

---

## 第七阶段：上线后配置

### 7.1 关闭开发模式登录

编辑 `server/src/modules/auth/auth.service.ts`，在生产环境禁用 mock openid：
```typescript
// 生产环境不应该有 dev mock，NODE_ENV=production 时已自动禁用
// 确保 .env 中 NODE_ENV="production"
```

### 7.2 配置门店数据

上线后通过小程序管理端（admin 角色登录）配置真实数据：
- 修改门店名称、地址
- 添加真实员工
- 配置真实服务项目和价格
- 设置提成规则
- 配置充值方案

### 7.3 数据备份

```bash
# 添加定时备份（每天凌晨3点）
crontab -e

# 添加这行
0 3 * * * docker compose -f /opt/zhizhuo/docker-compose.yml exec -T mysql mysqldump -uroot -p你的密码 zhizhuo_pos | gzip > /opt/zhizhuo/backups/$(date +\%Y\%m\%d).sql.gz
```

```bash
# 创建备份目录
mkdir -p /opt/zhizhuo/backups
```

---

## 费用估算（每年）

| 项目 | 费用 | 说明 |
|------|------|------|
| 云服务器 | ~1200元/年 | 2核4G，新用户首年更便宜 |
| 域名 | ~60元/年 | .com 域名 |
| SSL证书 | 免费 | Let's Encrypt |
| 微信小程序认证 | 300元/年 | 每年审核费 |
| 微信支付手续费 | 交易额 0.6% | 按实际交易扣 |
| **合计（固定成本）** | **~1560元/年** | 不含支付手续费 |

---

## 常见问题

**Q: 备案要多久？**
A: 首次备案通常 7-20 个工作日。建议第一阶段就开始申请备案，与其他步骤并行。

**Q: 可以用个人身份注册小程序吗？**
A: 可以注册，但个人小程序**无法接入微信支付**。收银系统必须用企业/个体工商户主体。

**Q: 小程序审核不通过怎么办？**
A: 常见原因：类目不匹配、缺少隐私协议、功能不完整。根据审核反馈修改后重新提交。

**Q: 没有对公账户怎么办？**
A: 个体工商户可以用法人个人银行账户作为结算账户。
