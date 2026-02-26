# Brand Hub

品牌中台（Brand Hub）是整个品牌生态的基础设施层，统一管理用户身份、会员资格和访问控制。

## 特性

- **统一身份认证** - 一次注册，多产品通用
- **邀请码准入** - 通过邀请码控制用户增长，可预设会员等级
- **会员集中管理** - 支持 free/monthly/yearly/lifetime 四个等级
- **JWT 凭证** - RS256 非对称签名，Token 中嵌入会员状态
- **轻量架构** - SQLite + lru-cache，无需 Redis/PostgreSQL

## 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js 20+ | Fastify 框架 |
| 数据库 | SQLite (better-sqlite3) | 零运维，单文件 |
| 缓存 | lru-cache | 验证码和频率限制 |
| Token | RS256 JWT | jose + jsonwebtoken |
| 部署 | Docker Compose | 单机部署 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成密钥对

```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必要参数
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm start
```

### 5. 验证服务

```bash
# 健康检查
curl http://localhost:3000/health

# JWKS 端点
curl http://localhost:3000/.well-known/jwks.json
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `NODE_ENV` | 否 | development | 运行环境 (development/production/test) |
| `PORT` | 否 | 3000 | 服务端口 |
| `DB_PATH` | 否 | ./data/brand.db | SQLite 数据库路径 |
| `JWT_PRIVATE_KEY_PATH` | 否 | ./keys/private.pem | JWT 私钥路径 |
| `JWT_PUBLIC_KEY_PATH` | 否 | ./keys/public.pem | JWT 公钥路径 |
| `JWT_ISSUER` | 否 | https://yourbrand.com/hub | JWT 签发者 |
| `JWT_ACCESS_EXPIRES_IN` | 否 | 15m | Access Token 有效期 |
| `JWT_REFRESH_EXPIRES_IN` | 否 | 30d | Refresh Token 有效期 |
| `SMS_PROVIDER_URL` | 生产必填 | - | 短信服务地址 |
| `SMS_PROVIDER_KEY` | 生产必填 | - | 短信服务 API Key |
| `SMS_MOCK_MODE` | 否 | false | Mock 模式（测试用） |

## API 端点

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/sms/send` | 发送短信验证码 |
| POST | `/auth/register` | 用户注册 |
| POST | `/auth/login` | 用户登录 |
| POST | `/auth/refresh` | 刷新 Token |
| POST | `/auth/logout` | 登出 |

### 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/me` | 获取个人资料 |
| PATCH | `/users/me` | 修改昵称 |

### 会员

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/membership` | 查看会员状态 |
| POST | `/membership/subscribe` | 订阅会员 |
| POST | `/membership/cancel` | 取消订阅 |

### 管理后台 (需 admin 角色)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/invitations/batch` | 批量生成邀请码 |
| GET | `/admin/invitations` | 查看邀请码列表 |
| GET | `/admin/users` | 用户列表 |
| GET | `/admin/users/:sub` | 用户详情 |
| PATCH | `/admin/users/:sub/status` | 暂停/恢复用户 |
| POST | `/admin/users/:sub/membership` | 手动授予会员 |

### 公开端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/.well-known/jwks.json` | JWKS 公钥 |

## 错误码

| HTTP | 错误码 | 说明 |
|------|--------|------|
| 400 | INVALID_PARAMS | 参数校验失败 |
| 400 | SMS_CODE_INCORRECT | 验证码错误 |
| 400 | SMS_CODE_EXPIRED | 验证码过期 |
| 400 | SMS_CODE_MAX_ATTEMPTS | 错误次数超限 |
| 400 | LIFETIME_CANNOT_CANCEL | 终身会员不可取消 |
| 400 | INVALID_SCENE | 场景参数非法 |
| 401 | PHONE_NOT_REGISTERED | 手机号未注册 |
| 401 | TOKEN_EXPIRED | Token 过期 |
| 401 | TOKEN_REVOKED | Token 已撤销 |
| 403 | INSUFFICIENT_ROLE | 权限不足 |
| 409 | PHONE_EXISTS | 手机号已注册 |
| 409 | ACTIVE_MEMBERSHIP_EXISTS | 已有活跃会员 |
| 422 | INVITE_CODE_INVALID | 邀请码不存在 |
| 422 | INVITE_CODE_USED | 邀请码已使用 |
| 422 | INVITE_CODE_EXPIRED | 邀请码已过期 |
| 423 | ACCOUNT_SUSPENDED | 账号已暂停 |
| 429 | SMS_COOLDOWN | 60 秒冷却中 |
| 429 | SMS_DAILY_LIMIT | 今日发送上限 |
| 429 | SMS_IP_LIMIT | IP 发送频率超限 |

## 部署

### Docker Compose

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### Nginx 配置

```nginx
server {
    listen 443 ssl;
    server_name yourbrand.com;

    # SSL 配置
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Brand Hub
    location /hub/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 子产品示例
    location /eat-healthy/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 子产品接入指南

### 1. 注册产品

在 `brand.db` 的 `products` 表中注册产品标识：

```sql
INSERT INTO products (name, display_name, status)
VALUES ('your-product', 'Your Product', 'active');
```

### 2. 配置 JWKS 端点

```javascript
const JWKS_URL = 'https://yourbrand.com/hub/.well-known/jwks.json';
```

### 3. 实现 JWT 验证中间件

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-client');

const client = jwksClient({
  jwksUri: 'https://yourbrand.com/hub/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000, // 24 小时缓存
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.publicKey || key.rsaPublicKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: 'https://yourbrand.com/hub',
      algorithms: ['RS256'],
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}
```

### 4. 从 Token 获取用户信息

```javascript
// Token payload 示例
{
  "sub": "user-uuid",
  "nickname": "用户昵称",
  "brand.membership": "monthly",
  "brand.membership_exp": "2026-03-28T00:00:00.000Z",
  "brand.roles": ["user"]
}
```

### 5. 禁止事项

- ❌ 不得创建用户表或存储手机号等身份信息
- ❌ 不得实现注册/登录/发送验证码
- ❌ 不得修改会员状态
- ❌ 不得持久化 Token 中的敏感信息
- ❌ 不得直接访问 brand.db

## 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

## 项目结构

```
brand-hub/
├── src/
│   ├── index.js           # 入口
│   ├── app.js             # Fastify 应用
│   ├── config.js          # 配置管理
│   ├── db/
│   │   └── index.js       # 数据库连接和 Schema
│   ├── routes/
│   │   ├── auth.js        # 认证路由
│   │   ├── users.js       # 用户路由
│   │   ├── membership.js  # 会员路由
│   │   ├── admin.js       # 管理路由
│   │   ├── health.js      # 健康检查
│   │   └── jwks.js        # JWKS 端点
│   ├── services/
│   │   ├── cache.js       # 缓存服务
│   │   ├── sms.js         # 短信服务
│   │   ├── token.js       # Token 服务
│   │   ├── invitation.js  # 邀请码服务
│   │   └── membership.js  # 会员服务
│   ├── middleware/
│   │   └── auth.js        # 认证中间件
│   └── utils/
│       ├── errors.js      # 错误处理
│       └── validators.js  # 参数校验
├── tests/
│   └── e2e.test.js        # E2E 测试
├── keys/                   # JWT 密钥（不提交）
├── data/                   # SQLite 数据（不提交）
├── Dockerfile
├── docker-compose.yml
├── nginx.conf.example
├── .env.example
└── package.json
```

## 常见问题

### Q: 验证码发送失败？

检查 `SMS_PROVIDER_URL` 和 `SMS_PROVIDER_KEY` 是否正确配置。开发环境可设置 `SMS_MOCK_MODE=true` 使用 Mock 模式。

### Q: Token 验证失败？

1. 确认 JWKS 端点可访问
2. 检查 Token 是否过期
3. 验证 `iss` 是否匹配 `JWT_ISSUER`

### Q: 如何创建管理员？

```bash
# 运行种子数据脚本（在 src/db/index.js 中）
# 或手动更新数据库
sqlite3 data/brand.db "UPDATE users SET roles='admin,user' WHERE phone='管理员手机号'"
```

### Q: 数据库迁移？

项目使用 SQLite，Schema 在启动时自动创建。如需修改表结构，直接修改 `src/db/index.js` 中的 `createTables()` 函数。

## 许可证

ISC
