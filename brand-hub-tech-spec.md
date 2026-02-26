# 品牌中台（Brand Hub）技术实现方案

> 版本：v2.0｜状态：Draft｜最后更新：2026-02-26

---

## 1. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js（Fastify） | 轻量、生态成熟 |
| 数据库 | SQLite（better-sqlite3） | 零运维、单文件、足够支撑万级用户 |
| 验证码/频率限制 | lru-cache | 省去 Redis 依赖，进程重启后自然清空 |
| Token 签名 | RS256（固定密钥对） | 非对称签名，无密钥轮换 |
| 短信通道 | spug | 已确定 |
| 反向代理 | Nginx | 路径区分子产品，非子域名 |
| 容器化 | Docker Compose | 单机部署 |

### 资源预算

| 服务 | 内存 |
|------|------|
| Brand Hub（Node.js） | ≤ 80MB |
| 单个子产品 | ≤ 100MB |
| Nginx | ≤ 10MB |
| **合计** | **< 200MB** |

无 PostgreSQL、无 Redis。一台 1C1G 的 VPS 即可运行。

---

## 2. 路由设计

Nginx 通过路径前缀区分品牌中台与各子产品，统一使用同一个域名：

```
https://yourbrand.com
  ├── /hub/*          → Brand Hub :3000（认证、会员、管理）
  ├── /eat-healthy/*  → eat-healthy :3001
  ├── /fit-daily/*    → fit-daily :3002（未来）
  └── ...
```

Nginx 核心配置：

```nginx
server {
    listen 443 ssl;
    server_name yourbrand.com;

    location /hub/ {
        proxy_pass http://127.0.0.1:3000/;
    }

    location /eat-healthy/ {
        proxy_pass http://127.0.0.1:3001/;
    }
}
```

公钥端点地址：`https://yourbrand.com/hub/.well-known/jwks.json`

---

## 3. 数据库设计

### 3.1 单文件策略

品牌中台和每个子产品各自使用独立的 SQLite 文件：

```
/data/
  ├── brand.db          ← 品牌中台
  ├── eat-healthy.db    ← 子产品各自独立
  └── fit-daily.db
```

子产品无权访问 `brand.db`（进程隔离天然保证）。

### 3.2 品牌层表结构（brand.db）

**users 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| sub | TEXT PK | UUID，全局用户标识 |
| phone | TEXT UNIQUE NOT NULL | 手机号（含国际区号） |
| nickname | TEXT NOT NULL | 昵称 |
| status | TEXT DEFAULT 'active' | active / suspended |
| roles | TEXT DEFAULT 'user' | 逗号分隔：user / admin |
| created_at | TEXT | ISO8601 |
| updated_at | TEXT | ISO8601 |

**invitations 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| code | TEXT PK | 邀请码，如 XK7F-9M2P |
| created_by | TEXT FK → users.sub | 管理员（可为 NULL） |
| used_by | TEXT FK → users.sub | 使用者 |
| channel | TEXT | 渠道标签 |
| preset_membership | TEXT DEFAULT 'free' | free / monthly / yearly / lifetime |
| preset_duration_days | INTEGER | monthly/yearly 时必填，lifetime 为 NULL |
| expires_at | TEXT | 过期时间 |
| used_at | TEXT | 使用时间 |
| created_at | TEXT | 创建时间 |

**memberships 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_sub | TEXT NOT NULL FK → users.sub | 用户标识 |
| plan | TEXT DEFAULT 'free' | free / monthly / yearly / lifetime |
| status | TEXT DEFAULT 'active' | active / expired / cancelled |
| starts_at | TEXT NOT NULL | 开始时间 |
| expires_at | TEXT | 到期时间，lifetime 为 NULL |
| cancelled_at | TEXT | 取消时间 |
| source | TEXT DEFAULT 'self' | self / invitation / admin |
| created_at | TEXT | 创建时间 |

约束：同一 user_sub 只能有一条 status='active' 的记录。

**refresh_tokens 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_sub | TEXT NOT NULL FK → users.sub | 用户标识 |
| token_hash | TEXT UNIQUE NOT NULL | SHA-256(refresh_token) |
| device_info | TEXT | User-Agent |
| expires_at | TEXT NOT NULL | 过期时间 |
| created_at | TEXT | 创建时间 |

**products 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| name | TEXT PK | 子产品标识，如 eat-healthy |
| display_name | TEXT NOT NULL | 显示名称 |
| status | TEXT DEFAULT 'active' | active / disabled |
| created_at | TEXT | 创建时间 |

### 3.3 子产品表规范

子产品所有与用户关联的业务表必须：

- 使用 `user_sub TEXT NOT NULL` 作为用户标识（值来自 JWT 的 sub）
- 为 `user_sub` 建立索引
- 不建立任何用户信息表（无 phone、无 nickname 存储）

---

## 4. 认证与凭证

### 4.1 密钥

固定一对 RS256 密钥，不做轮换：

```
/etc/brand-hub/
  ├── private.pem    ← Brand Hub 独占，用于签发 Token
  └── public.pem     ← 通过 JWKS 端点公开，子产品用于验证
```

生成方式：`openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem`

### 4.2 Access Token（有效期 15 分钟）

Payload 字段：

| 字段 | 说明 |
|------|------|
| sub | 用户 UUID |
| iss | `https://yourbrand.com/hub` |
| aud | 授权的子产品列表，如 `["eat-healthy"]` |
| exp | 过期时间 |
| iat | 签发时间 |
| nickname | 用户昵称 |
| brand.membership | 会员等级：free / monthly / yearly / lifetime |
| brand.membership_exp | 到期时间，lifetime 为 null |
| brand.roles | 角色列表 |

### 4.3 Refresh Token（有效期 30 天）

Payload 字段：sub、type="refresh"、jti（对应数据库记录 ID）、exp。

### 4.4 Token 刷新机制

- 一次性轮换：每次刷新签发新 Refresh Token，旧 Token 立即删除。
- 重放检测：若已删除的 Refresh Token 被再次使用，撤销该用户所有 Refresh Token。
- 刷新时自动同步最新的 nickname、membership 状态到新 Access Token。

---

## 5. 短信验证码

### 5.1 内存存储结构

使用 lru-cache 库管理所有验证码及频率限制，利用其原生 TTL 能力自动清理过期数据，避免手写 Timer 造成的句柄泄漏。

```
const { LRUCache } = require('lru-cache');

// 通用配置
const cacheOptions = {
  max: 10000, // 最大缓存条目数
  ttlAutopurge: true, // 自动清理过期条目
};

// 实例化不同的缓存空间
const codeStore = new LRUCache({ ...cacheOptions, ttl: 300000 }); // 验证码有效期 5 分钟
const cooldownStore = new LRUCache({ ...cacheOptions, ttl: 60000 }); // 60 秒冷却
const dailyLimitStore = new LRUCache({ ...cacheOptions, ttl: 86400000 }); // 24 小时（每日限额）
const ipLimitStore = new LRUCache({ ...cacheOptions, ttl: 3600000 }); // 1 小时（IP 限额）
```



| Key 模式 | Value | TTL | 用途 |
|----------|-------|-----|------|
| `code:{phone}` | `{ code, attempts }` | 300s | 验证码及错误计数 |
| `cooldown:{phone}` | `true` | 60s | 单号发送冷却 |
| `daily:{phone}` | `count` | 到当日 24:00 | 单号每日上限（10 条） |
| `ip:{ip}` | `count` | 3600s | 单 IP 每小时上限（20 条） |

进程重启后内存清空，用户需重新获取验证码，可接受。

### 5.2 发送流程

前置校验逻辑增强：

1. 场景区分：接口需接收 scene 参数（login 或 register）。
2. 登录场景检查：若 scene === 'login'，先查询数据库。若手机号未注册，直接返回 401 错误，不消耗发送配额。
3. 注册场景检查：若 scene === 'register'，PRD 要求先校验邀请码再发码（业务逻辑前置）。



**详细流程**：

```
客户端调用 POST /auth/sms/send { phone, scene }
  ↓
若 scene === 'login'：
  → 查询 users 表
  → 若不存在：返回 401 PHONE_NOT_REGISTERED（流程结束）
  → 若存在：继续
  ↓
检查 cooldown:{phone} 是否存在 → 存在则返回 429 SMS_COOLDOWN
  ↓
检查 daily:{phone}:{date} ≥ 10 → 超限则返回 429 SMS_DAILY_LIMIT
  ↓
检查 ip:{ip} ≥ 20 → 超限则返回 429 SMS_IP_LIMIT
  ↓
生成 6 位随机数字验证码
  ↓
写入缓存：
  codeStore.set(`code:${phone}`, { code, attempts: 0 })
  cooldownStore.set(`cooldown:${phone}`, true)
  dailyLimitStore.increment(`daily:${phone}:${date}`) // 伪代码，需实现自增
  ipLimitStore.increment(`ip:${ip}`)
  ↓
调用 spug 发送短信
  ↓
返回 200 { cooldown: 60 }
```



---

## 6. API 设计

Base URL: `https://yourbrand.com/hub`

### 6.1 短信验证码

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/sms/send` | 发送验证码。Body: { phone, scene: "login" |

### 6.2 注册与登录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册。Body: `{ phone, code, invite_code, nickname }`。校验验证码 → 校验邀请码 → 创建用户 → 根据邀请码预设等级创建会员 → 标记邀请码已用 → 签发 Token |
| POST | `/auth/login` | 登录。Body: `{ phone, code }`。校验验证码 → 查用户 → 检查状态 → 签发 Token |
| POST | `/auth/refresh` | 刷新。Body: `{ refresh_token }`。轮换 Refresh Token，签发新 Access Token（含最新会员状态和昵称） |
| POST | `/auth/logout` | 登出。Body: `{ refresh_token }`。删除数据库中对应记录 |

### 6.3 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/me` | 获取个人资料（需 Token） |
| PATCH | `/users/me` | 修改昵称。Body: `{ nickname }` |

### 6.4 会员

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/membership` | 查看当前会员状态 |
| POST | `/membership/subscribe` | 订阅。Body: `{ plan: "monthly" \| "yearly" }` |
| POST | `/membership/cancel` | 取消订阅。终身会员不可取消 |

### 6.5 管理接口（需 admin 角色）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/invitations/batch` | 批量生成邀请码。Body: `{ count, channel?, expires_at?, preset_membership, preset_duration_days? }` |
| GET | `/admin/invitations` | 查看邀请码列表。支持 status/channel/preset_membership 筛选 |
| GET | `/admin/users` | 用户列表。支持 search、分页 |
| PATCH | `/admin/users/:sub/status` | 暂停/恢复用户 |
| POST | `/admin/users/:sub/membership` | 手动授予会员。Body: `{ plan, duration_days? }` |

### 6.6 公钥端点（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/.well-known/jwks.json` | JWKS 公钥。Cache-Control: public, max-age=86400 |

### 6.7 统一错误格式

```json
{ "error": { "code": "INVITE_CODE_USED", "message": "该邀请码已被使用" } }
```

错误码清单：

| HTTP | 错误码 | 说明 |
|------|--------|------|
| 400 | INVALID_PARAMS | 参数校验失败 |
| 400 | SMS_CODE_INCORRECT | 验证码错误 |
| 400 | SMS_CODE_EXPIRED | 验证码过期或未发送 |
| 400 | SMS_CODE_MAX_ATTEMPTS | 错误次数超限 |
| 400 | LIFETIME_CANNOT_CANCEL | 终身会员不可取消 |
| 400 | INVALID_SCENE | 场景参数缺失或非法 |
| 401 | PHONE_NOT_REGISTERED | 手机号未注册 |
| 401 | TOKEN_EXPIRED | Access Token 过期 |
| 401 | TOKEN_REVOKED | Refresh Token 已撤销 |
| 403 | INSUFFICIENT_ROLE | 非管理员 |
| 409 | PHONE_EXISTS | 手机号已注册 |
| 409 | ACTIVE_MEMBERSHIP_EXISTS | 已有活跃会员 |
| 422 | INVITE_CODE_INVALID | 邀请码不存在 |
| 422 | INVITE_CODE_USED | 邀请码已使用 |
| 422 | INVITE_CODE_EXPIRED | 邀请码已过期 |
| 423 | ACCOUNT_SUSPENDED | 账号已暂停 |
| 429 | SMS_COOLDOWN | 60 秒冷却中 |
| 429 | SMS_DAILY_LIMIT | 今日发送上限 |
| 429 | SMS_IP_LIMIT | IP 发送频率超限 |

---

## 7. 关键流程描述

### 7.1 注册

1. 客户端调用 `POST /auth/sms/send` 发送验证码
2. 客户端调用 `POST /auth/register`，提交 phone、code、invite_code、nickname
3. 校验短信验证码（内存中比对，通过后删除）
4. 查询 invitations 表：校验邀请码存在、未使用、未过期
5. 查询 users 表：校验手机号未注册
6. 在同一事务中执行：插入 users → 插入 memberships（plan 和 expires_at 由邀请码的 preset_membership 和 preset_duration_days 决定）→ 更新 invitations（标记 used_by 和 used_at）→ 插入 refresh_tokens
7. 签发 Access Token（包含 nickname 和会员信息）+ Refresh Token
8. 返回 Token 和用户信息
9. 若步骤 3–6 任一失败，事务回滚，邀请码不被消耗

### 7.2 登录

1. 客户端调用 `POST /auth/sms/send` 发送验证码（此步会校验手机号已注册）
2. 客户端调用 `POST /auth/login`，提交 phone、code
3. 校验短信验证码
4. 查询 users 表 + 关联查询 active membership
5. 检查 user.status 是否为 active → suspended 则返回 423
6. 插入 refresh_tokens 记录
7. 签发 Access Token（含最新 membership 和 nickname）+ Refresh Token
8. 返回 Token 和用户信息

### 7.3 Token 刷新

1. 客户端提交 refresh_token
2. 计算 SHA-256(refresh_token)，查询 refresh_tokens 表
3. 校验记录存在且未过期；若记录不存在且曾存在过（重放），撤销该 user_sub 的所有 Refresh Token
4. 查询 user + active membership，获取最新状态
5. 检查 user.status 是否为 active → suspended 则返回 401
6. 事务中删除旧记录、插入新记录
7. 签发新 Access Token（含最新 nickname 和 membership）+ 新 Refresh Token

### 7.4 子产品请求

1. 客户端携带 Access Token 请求子产品 API
2. 子产品中间件从 JWKS 端点获取公钥（缓存，TTL 24 小时）
3. 本地验证 JWT：签名 → issuer → audience 包含本产品 → 未过期
4. 从 Token 中提取 sub、nickname、brand.membership
5. 根据 membership 判断功能权限
6. 用 sub 查询子产品自己的业务数据库
7. 返回业务数据

---

## 8. 子产品接入规范

### 8.1 接入清单

1. 在 brand.db 的 products 表注册产品标识（name）
2. 配置 JWKS 端点：`https://yourbrand.com/hub/.well-known/jwks.json`
3. 实现 JWT 验证中间件：验证签名、issuer、audience、过期时间
4. 从 Token 中提取 `sub`（用户标识）、`nickname`（展示用）、`brand.membership`（权限判断）
5. 实现会员权限中间件：等级层级为 free < monthly < yearly < lifetime
6. 建立独立 SQLite 文件，业务表中使用 `user_sub TEXT NOT NULL` + 索引
7. 在 Nginx 中添加路径转发规则
8. 通过接入验收测试

### 8.2 禁止事项

- 不得创建用户表或存储手机号等身份信息
- 不得实现注册/登录/发送验证码
- 不得修改会员状态
- 不得持久化 Token 中的敏感信息
- 不得直接访问 brand.db

### 8.3 接入验收测试项

| 编号 | 测试项 | 预期 |
|------|--------|------|
| A1 | 无 Token 请求 | 401 |
| A2 | 过期 Token | 401 |
| A3 | 伪造签名的 Token | 401 |
| A4 | audience 不匹配的 Token | 401 |
| A5 | Free Token 请求付费功能 | 403 + upgrade 提示 |
| A6 | Monthly Token 请求付费功能 | 200 |
| A7 | Lifetime Token 请求付费功能 | 200 |
| A8 | 用户 A 不能访问用户 B 的数据 | 404 或空 |
| A9 | Token 中的 nickname 可正确读取 | 接口返回正确昵称 |
| A10 | 子产品进程无法读取 brand.db | 文件权限拒绝 |

---

## 9. E2E 测试设计

### 9.1 测试策略

- 测试框架：vitest + supertest
- 数据库：每个测试套件使用临时 SQLite 文件（`:memory:` 或 tmpdir），测试后销毁
- 短信：spug Mock 模式，验证码固定为 `123456` 或从内存 Map 直接读取
- 运行方式：`npm test` 直接运行，无需 Docker

### 9.2 测试套件：短信验证码

| 用例 | 步骤 | 预期 |
|------|------|------|
| 正常发送 | POST /auth/sms/send | 200, cooldown=60, 内存中存在验证码 |
| 60 秒冷却 | 连续发送两次 | 第二次 429 SMS_COOLDOWN |
| 每日上限 | 设置 daily 计数为 10 后发送 | 429 SMS_DAILY_LIMIT |
| IP 上限 | 设置 IP 计数为 20 后发送 | 429 SMS_IP_LIMIT |
| 错误次数超限 | 连续 5 次提交错误验证码 | 第 5 次 400 SMS_CODE_MAX_ATTEMPTS，之后正确码也返回 SMS_CODE_EXPIRED |
| 过期 | 手动清除内存中的验证码后提交 | 400 SMS_CODE_EXPIRED |

### 9.3 测试套件：邀请码注册

| 用例 | 步骤 | 预期 |
|------|------|------|
| free 邀请码注册 | 发送验证码 → 注册 | 200, Token 中 membership=free, membership_exp=null |
| monthly 邀请码注册 | 使用 preset_membership=monthly, duration=30 的邀请码注册 | Token 中 membership=monthly, membership_exp ≈ now+30d, GET /membership 返回 source=invitation |
| lifetime 邀请码注册 | 使用 preset_membership=lifetime 的邀请码注册 | Token 中 membership=lifetime, membership_exp=null |
| 邀请码重复使用 | 用已消耗的邀请码注册 | 422 INVITE_CODE_USED |
| 邀请码不存在 | 用虚假邀请码注册 | 422 INVITE_CODE_INVALID |
| 邀请码过期 | 用 expires_at 为过去的邀请码注册 | 422 INVITE_CODE_EXPIRED |
| 手机号重复 | 用已注册手机号 + 新邀请码注册 | 409 PHONE_EXISTS，且新邀请码未被消耗 |
| 事务原子性 | 用有效邀请码 + 已注册手机号注册失败后，用同一邀请码 + 新手机号注册 | 第二次注册成功 |
| nickname 校验 | 注册后解析 Token | Token 中 nickname 等于提交值 |

### 9.4 测试套件：登录与会话

| 用例 | 步骤 | 预期 |
|------|------|------|
| 正常登录 | 发送验证码 → 登录 | 200, Token 有效, nickname 正确 |
| 未注册手机号 | 对未注册手机号发送验证码 | 401 PHONE_NOT_REGISTERED |
| 验证码错误 | 提交错误验证码 | 400 SMS_CODE_INCORRECT |
| 账号暂停 | 管理员暂停用户后登录 | 423 ACCOUNT_SUSPENDED |
| Token 刷新 | POST /auth/refresh | 新 Token 有效, 旧 Refresh Token 失效 |
| Refresh Token 重放 | 用已被轮换掉的旧 Refresh Token 刷新 | 401, 且该用户所有 Refresh Token 被撤销 |
| 登出 | POST /auth/logout 后用 Refresh Token 刷新 | 401 |
| 多设备会话 | 设备 A、B 分别登录，A 登出 | A 的 Refresh Token 失效，B 不受影响 |

### 9.5 测试套件：会员生命周期

| 用例 | 步骤 | 预期 |
|------|------|------|
| 订阅月度 | Free 用户 POST /membership/subscribe { plan: "monthly" } | plan=monthly, source=self, expires_at ≈ now+30d |
| 刷新后状态同步 | 订阅后刷新 Token | 新 Token 中 brand.membership=monthly |
| 重复订阅 | 已有 active 会员再次订阅 | 409 ACTIVE_MEMBERSHIP_EXISTS |
| 取消订阅 | POST /membership/cancel | status=cancelled, expires_at 不变, 刷新后仍为 monthly |
| 终身会员不可取消 | lifetime 用户 POST /membership/cancel | 400 LIFETIME_CANNOT_CANCEL |
| 过期后降级 | 手动设置 expires_at 为过去 → 刷新 Token | brand.membership=free |
| 终身永不过期 | lifetime 用户任意时间刷新 | brand.membership=lifetime |
| 管理员授予 | POST /admin/users/:sub/membership { plan: "lifetime" } | plan=lifetime, source=admin |
| 子产品联动 | Free → 付费接口 403 → 订阅 → 刷新 → 付费接口 200 → 模拟过期 → 刷新 → 付费接口 403 | 全链路通过 |

### 9.6 测试套件：子产品接入验证

通用套件，每个新子产品必须通过：

| 用例 | 步骤 | 预期 |
|------|------|------|
| 无 Token | 请求子产品 API | 401 |
| 伪造 Token | 随机密钥签发的 JWT | 401 |
| 错误 audience | aud 不含本产品的 Token | 401 |
| 过期 Token | exp 为过去的 Token | 401 |
| 正常访问 | 有效 Token 请求 | 200, 数据属于当前 user_sub |
| Nickname 传递 | 注册时 nickname="测试" | 子产品可从 Token 读取到 "测试" |
| Free 付费拦截 | Free Token 请求付费接口 | 403 含 upgrade_url |
| Monthly 付费通过 | Monthly Token 请求付费接口 | 200 |
| Lifetime 付费通过 | Lifetime Token 请求付费接口 | 200 |
| 数据隔离 | 用户 A 创建数据, 用户 B 访问 | 404 或空（不泄露存在性） |
| DB 隔离 | 子产品进程尝试访问 brand.db | 无权限（独立文件，进程无法读取） |

### 9.7 测试套件：管理后台

| 用例 | 步骤 | 预期 |
|------|------|------|
| 批量生成邀请码 | POST /admin/invitations/batch { count: 5, preset_membership: "monthly", preset_duration_days: 30 } | 返回 5 个唯一邀请码 |
| 生成 lifetime 邀请码 | POST /admin/invitations/batch { count: 2, preset_membership: "lifetime" } | 2 个邀请码, preset_duration_days=null |
| 非管理员拒绝 | 普通用户请求 /admin/* | 403 INSUFFICIENT_ROLE |
| 暂停用户 | PATCH /admin/users/:sub/status { suspended } → 该用户刷新 Token | 暂停成功, 刷新返回 401 |
| 手动授予终身 | POST /admin/users/:sub/membership { plan: "lifetime" } → 用户刷新 | source=admin, 刷新后 membership=lifetime |
| 用户搜索 | GET /admin/users?search=138 | 返回手机号含 138 的用户 |

---

## 10. 部署

### 10.1 Docker Compose

```yaml
version: "3.9"

services:
  brand-hub:
    build: .
    container_name: brand-hub
    restart: unless-stopped
    environment:
      # 数据库路径指向容器内挂载点
      DB_PATH: /app/data/brand.db
      JWT_PRIVATE_KEY_PATH: /app/keys/private.pem
      JWT_ISSUER: https://yourbrand.com/hub
      # ... 其他环境变量
    volumes:
      # 挂载数据目录：
      - ./data:/app/data
      # 挂载密钥目录：只读挂载，安全起见
      - ./keys:/app/keys:ro
    networks:
      - brand-network

networks:
  brand-network:
    external: true
```

### 10.2 目录结构

```
project/
  ├── brand-hub/              ← 品牌中台 Node.js 项目
  │   ├── package.json
  │   ├── src/
  │   └── Dockerfile
  ├── tests/
  │   └── e2e/                ← E2E 测试
  ├── keys/
  │   ├── private.pem
  │   └── public.pem
  ├── nginx.conf
  ├── docker-compose.yml
  └── docker-compose.test.yml
```

### 10.3 新增子产品

1. 创建子产品项目目录
2. 在 docker-compose.yml 中添加 service
3. 在 nginx.conf 中添加 `location /{product-name}/` 规则
4. 在 brand.db 的 products 表中注册
5. 运行子产品接入验收测试套件

---

## 11. 日志

日志格式（JSON，stdout）：

```json
{ "ts": "...", "level": "info", "event": "auth.login.success", "user_sub": "...", "phone_suffix": "****8000", "duration_ms": 120 }
```

禁止记录：完整手机号、验证码、Token 原文。
