# Brand Hub 部署交接文档

## 概述

Brand Hub 是统一的用户认证与会员管理平台，为子产品提供 JWT Token 验证服务。

## 架构

```
用户请求 → Nginx (:4000 HTTPS) → Brand Hub (:4001) → SQLite
                                         ↓
                                  SMS Provider (Spug)
```

> Nginx 使用自签名 SSL 证书提供 HTTPS 服务

## 目录结构

```
/data/dev/brand-hub/          # 开发目录（Git 仓库，唯一源码）
├── src/                      # 源代码
├── public/                   # 静态文件
├── scripts/                  # 工具脚本
├── ecosystem.config.cjs      # PM2 配置
├── package.json
└── ...

/data/app/brand-hub/          # 部署目录（仅配置和数据）
├── data/                     # SQLite 数据库
│   └── brand.db
├── keys/                     # JWT 密钥 (RS256)
│   ├── private.pem           # 私钥 (600)
│   └── public.pem            # 公钥 (644)
└── .env                      # 环境配置（备用）
```

## 部署流程

### 开发完成后上线

```bash
# 1. 在开发目录提交代码
cd /data/dev/brand-hub
git add .
git commit -m "your changes"

# 2. 如有新依赖，安装到生产环境
npm install --omit=dev

# 3. 重启服务
pm2 restart brand-hub
```

### 首次部署

```bash
# 1. 确保部署目录存在配置和数据
ls /data/app/brand-hub/
# data/  keys/  .env

# 2. 从开发目录启动服务
cd /data/dev/brand-hub
pm2 start ecosystem.config.cjs --env production
pm2 save
```

## 服务管理

```bash
# 查看状态
pm2 status brand-hub

# 查看日志
pm2 logs brand-hub

# 重启服务
pm2 restart brand-hub

# 停止服务
pm2 stop brand-hub
```

## 配置说明

环境变量在 `ecosystem.config.cjs` 中配置，使用绝对路径指向部署目录：

| 变量 | 值 | 说明 |
|------|-----|------|
| PORT | 4001 | 服务端口 |
| DB_PATH | /data/app/brand-hub/data/brand.db | 数据库路径 |
| JWT_PRIVATE_KEY_PATH | /data/app/brand-hub/keys/private.pem | 私钥路径 |
| JWT_PUBLIC_KEY_PATH | /data/app/brand-hub/keys/public.pem | 公钥路径 |
| JWT_ISSUER | https://jievow.com/hub | Token 签发者 |
| JWT_AUDIENCES | brand-hub,eat-healthy | 授权产品列表 |
| JWT_ACCESS_EXPIRES_IN | 15m | Access Token 有效期 |
| JWT_REFRESH_EXPIRES_IN | 30d | Refresh Token 有效期 |
| SMS_MOCK_MODE | false | 生产环境 (真实短信) |

## API 端点

### 公开接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/.well-known/jwks.json` | GET | JWT 公钥 (JWKS) |
| `/auth/sms/send` | POST | 发送验证码 |
| `/auth/register` | POST | 用户注册 |
| `/auth/login` | POST | 用户登录 |
| `/auth/refresh` | POST | 刷新 Token |

### 需认证接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/users/me` | GET | 用户资料 |
| `/membership` | GET | 会员状态 |

### 管理员接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/invitations` | POST | 生成邀请码 |
| `/admin/invitations` | GET | 邀请码列表 |
| `/admin/users` | GET | 用户列表 |
| `/admin/users/:sub/status` | PATCH | 更新用户状态 |
| `/admin/users/:sub/membership` | POST | 授予会员 |

## JWT Claims

```json
{
  "sub": "user-uuid",
  "iss": "https://jievow.com/hub",
  "aud": ["brand-hub", "eat-healthy"],
  "nickname": "用户昵称",
  "brand.roles": ["user"],
  "brand.membership": "yearly",
  "brand.membership_exp": "2025-12-31T00:00:00Z"
}
```

## 子产品接入

### 1. 获取公钥

```bash
curl -k https://localhost:4000/hub/.well-known/jwks.json
# 或
curl https://jievow.com/hub/.well-known/jwks.json
```

### 2. 验证 Token

使用 JWKS 公钥验证 JWT 签名，检查：
- `iss` = `https://jievow.com/hub`
- `aud` 包含你的产品名 (如 `eat-healthy`)
- `exp` 未过期

### 3. 获取用户信息

从 Token claims 中读取：
- `sub` - 用户唯一标识
- `nickname` - 昵称
- `brand.membership` - 会员等级

## 常见问题

### Q: 如何添加新的子产品？

1. 修改 `ecosystem.config.cjs` 中的 `JWT_AUDIENCES`，添加产品名
2. 重启服务: `pm2 restart brand-hub`

### Q: 如何重新生成 JWT 密钥？

```bash
cd /data/dev/brand-hub
node scripts/generate-keys.js
# 密钥会生成到 ./keys/ 目录
# 然后复制到部署目录
cp keys/*.pem /data/app/brand-hub/keys/
pm2 restart brand-hub
```

⚠️ 注意：重新生成密钥后，所有已发行的 Token 将失效

### Q: 如何查看数据库？

```bash
cd /data/dev/brand-hub
node -e "
const db = require('better-sqlite3')('/data/app/brand-hub/data/brand.db');
console.log(db.prepare('SELECT * FROM users').all());
"
```

### Q: 短信发送失败？

1. 检查 `ecosystem.config.cjs` 中的 `SPUG_TOKEN` 是否有效
2. 查看日志: `pm2 logs brand-hub`
3. 临时启用 Mock 模式测试: 修改 `SMS_MOCK_MODE: 'true'`

## Nginx 配置

位置: `/data/app/nginx_jievow/`

### 目录结构

```
/data/app/nginx_jievow/
├── nginx.conf          # Nginx 配置
├── docker-compose.yml  # Docker Compose 配置
└── ssl/                # SSL 证书目录
    ├── server.crt      # 自签名证书
    └── server.key      # 私钥
```

### SSL 证书

- **类型**: 自签名证书
- **有效期**: 365 天
- **TLS 版本**: TLSv1.2, TLSv1.3

### 配置示例

```nginx
server {
    listen 4000 ssl;

    ssl_certificate /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location /hub/ {
        proxy_pass http://localhost:4001/;
        # ... 其他代理配置
    }
}
```

### 重启 Nginx

```bash
cd /data/app/nginx_jievow
docker compose restart
```

### 重新生成 SSL 证书

```bash
cd /data/app/nginx_jievow
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/server.key \
  -out ssl/server.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Jievow/CN=jievow.com"
docker compose restart
```

## 联系方式

- **开发仓库**: `/data/dev/brand-hub`
- **生产配置/数据**: `/data/app/brand-hub`
- **文档更新**: 2026-02-27
