# Brand Hub 实现计划

> 基于品牌中台产品需求文档 (v1.1) 和技术实现方案 (v2.0)
> 创建时间：2026-02-26

---

## 项目概述

构建品牌中台（Brand Hub）作为基础设施层，统一管理用户身份、会员资格和访问控制。子产品通过 API 获取用户身份与会员状态，不持有用户管理能力。

**技术栈**：
- 运行时：Node.js (Fastify)
- 数据库：SQLite (better-sqlite3)
- 缓存：lru-cache
- 认证：RS256 JWT
- 短信：spug
- 部署：Docker Compose

---

## Phase 1: 项目初始化与基础设施

### Step 1.1: 项目脚手架搭建

**目标**：创建 Node.js 项目基础结构

**任务清单**：
- [ ] 初始化 npm 项目 (`npm init`)
- [ ] 安装核心依赖：
  - `fastify` - Web 框架
  - `@fastify/cors` - CORS 支持
  - `better-sqlite3` - SQLite 数据库
  - `lru-cache` - 内存缓存
  - `jsonwebtoken` - JWT 处理
  - `jose` - JWKS 支持
  - `uuid` - UUID 生成
  - `pino` - 日志（Fastify 内置）
- [ ] 安装开发依赖：
  - `vitest` - 测试框架
  - `supertest` - HTTP 测试
  - `eslint` - 代码检查
  - `prettier` - 代码格式化
- [ ] 创建目录结构：
  ```
  brand-hub/
  ├── package.json
  ├── src/
  │   ├── index.js           # 入口
  │   ├── app.js             # Fastify 应用
  │   ├── config.js          # 配置管理
  │   ├── db/
  │   │   ├── index.js       # 数据库连接
  │   │   ├── schema.js      # 表结构定义
  │   │   └── migrations/    # 迁移脚本
  │   ├── routes/
  │   │   ├── auth.js        # 认证路由
  │   │   ├── users.js       # 用户路由
  │   │   ├── membership.js  # 会员路由
  │   │   └── admin.js       # 管理路由
  │   ├── services/
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
  │   ├── setup.js
  │   ├── auth.test.js
  │   ├── invitation.test.js
  │   ├── membership.test.js
  │   └── admin.test.js
  ├── Dockerfile
  └── docker-compose.yml
  ```

**验收标准**：
- `npm test` 可执行（即使为空）
- `npm run dev` 可启动服务器
- 基本健康检查端点 `/health` 返回 200

---

### Step 1.2: 数据库层实现

**目标**：创建 SQLite 数据库和所有表结构

**任务清单**：
- [ ] 实现数据库连接模块 (`src/db/index.js`)
- [ ] 创建表结构 (`src/db/schema.js`)：
  - `users` 表：sub, phone, nickname, status, roles, created_at, updated_at
  - `invitations` 表：code, created_by, used_by, channel, preset_membership, preset_duration_days, expires_at, used_at, created_at
  - `memberships` 表：id, user_sub, plan, status, starts_at, expires_at, cancelled_at, source, created_at
  - `refresh_tokens` 表：id, user_sub, token_hash, device_info, expires_at, created_at
  - `products` 表：name, display_name, status, created_at
- [ ] 实现初始化迁移脚本
- [ ] 创建种子数据脚本（管理员用户、测试产品）

**验收标准**：
- 应用启动时自动创建数据库文件
- 所有表存在且结构正确
- 可通过测试验证表结构

---

### Step 1.3: 配置管理与环境变量

**目标**：实现配置管理系统

**任务清单**：
- [ ] 创建配置模块 (`src/config.js`)
- [ ] 定义环境变量：
  - `NODE_ENV` - 运行环境
  - `PORT` - 服务端口
  - `DB_PATH` - 数据库路径
  - `JWT_PRIVATE_KEY_PATH` - 私钥路径
  - `JWT_ISSUER` - JWT 签发者
  - `JWT_ACCESS_EXPIRES_IN` - Access Token 有效期（默认 15 分钟）
  - `JWT_REFRESH_EXPIRES_IN` - Refresh Token 有效期（默认 30 天）
  - `SMS_PROVIDER_URL` - spug 服务地址
  - `SMS_PROVIDER_KEY` - spug API Key
- [ ] 实现配置验证（启动时检查必要配置）

**验收标准**：
- 缺少必要配置时启动失败并给出明确错误
- 支持默认值覆盖

---

### Step 1.4: JWT 密钥生成与管理

**目标**：实现 RS256 密钥对管理

**任务清单**：
- [ ] 创建密钥生成脚本 (`scripts/generate-keys.js`)
- [ ] 实现密钥加载模块
- [ ] 实现 JWKS 端点 (`/.well-known/jwks.json`)
- [ ] 实现密钥存在性检查（启动时）

**验收标准**：
- 可生成有效的 RS256 密钥对
- JWKS 端点返回正确的公钥 JWK 格式
- 缓存头设置正确 (`Cache-Control: public, max-age=86400`)

---

## Phase 2: 核心认证服务

### Step 2.1: 短信验证码服务

**目标**：实现短信验证码发送与校验

**任务清单**：
- [ ] 创建缓存管理模块 (`src/services/cache.js`)
  - 验证码缓存 (5 分钟 TTL)
  - 冷却缓存 (60 秒 TTL)
  - 每日限额缓存 (到当日 24:00)
  - IP 限额缓存 (1 小时 TTL)
- [ ] 创建短信服务模块 (`src/services/sms.js`)
  - 验证码生成 (6 位数字)
  - spug API 调用
  - Mock 模式支持（测试环境固定验证码）
- [ ] 创建验证码路由 (`src/routes/auth.js` - 部分)
  - `POST /auth/sms/send` 端点
  - 参数校验 (phone, scene)
  - 登录场景预检查手机号注册状态
  - 频率限制检查
  - 错误码处理

**验收标准**：
- 通过所有短信验证码测试用例（9.2 测试套件）
- 错误码正确返回
- 频率限制生效

---

### Step 2.2: 用户注册服务

**目标**：实现邀请码注册流程

**任务清单**：
- [ ] 创建邀请码服务 (`src/services/invitation.js`)
  - 邀请码生成 (格式: `XK7F-9M2P`)
  - 邀请码校验（存在、未使用、未过期）
  - 批量生成逻辑
- [ ] 创建注册路由 (`src/routes/auth.js` - 部分)
  - `POST /auth/register` 端点
  - 参数校验 (phone, code, invite_code, nickname)
  - 验证码校验
  - 邀请码校验
  - 手机号唯一性检查
  - 事务处理：创建用户 → 创建会员 → 标记邀请码 → 创建 Refresh Token
  - 签发 Access Token + Refresh Token

**验收标准**：
- 通过所有邀请码注册测试用例（9.3 测试套件）
- 事务原子性保证（失败时回滚，邀请码不被消耗）
- Token 包含正确的 membership 信息

---

### Step 2.3: 登录与 Token 管理

**目标**：实现登录、Token 刷新、登出流程

**任务清单**：
- [ ] 创建 Token 服务 (`src/services/token.js`)
  - Access Token 签发（包含 sub, nickname, membership, roles）
  - Refresh Token 生成与哈希存储
  - Token 刷新（一次性轮换）
  - 重放检测
- [ ] 实现登录路由
  - `POST /auth/login` 端点
  - 验证码校验
  - 用户状态检查（suspended 返回 423）
  - Token 签发
- [ ] 实现 Token 刷新路由
  - `POST /auth/refresh` 端点
  - Refresh Token 校验
  - 重放检测（撤销所有 Token）
  - 新 Token 签发（同步最新 membership）
- [ ] 实现登出路由
  - `POST /auth/logout` 端点
  - Refresh Token 删除

**验收标准**：
- 通过所有登录与会话测试用例（9.4 测试套件）
- Token 刷新后旧 Token 失效
- 重放攻击防护有效

---

## Phase 3: 用户与会员管理

### Step 3.1: 用户资料管理

**目标**：实现用户信息查询与修改

**任务清单**：
- [ ] 创建认证中间件 (`src/middleware/auth.js`)
  - JWT 验证
  - 用户信息注入 request
- [ ] 创建用户路由 (`src/routes/users.js`)
  - `GET /users/me` 获取个人资料
  - `PATCH /users/me` 修改昵称
  - 参数校验

**验收标准**：
- 认证中间件正确拒绝无效 Token
- 用户信息正确返回
- 昵称修改成功并同步到后续 Token

---

### Step 3.2: 会员服务

**目标**：实现会员订阅与取消

**任务清单**：
- [ ] 创建会员服务 (`src/services/membership.js`)
  - 订阅创建
  - 取消订阅
  - 过期检查
  - 状态查询
- [ ] 创建会员路由 (`src/routes/membership.js`)
  - `GET /membership` 查看当前状态
  - `POST /membership/subscribe` 订阅（monthly/yearly）
  - `POST /membership/cancel` 取消（lifetime 不可取消）
- [ ] 实现会员等级判断逻辑

**验收标准**：
- 通过所有会员生命周期测试用例（9.5 测试套件）
- 订阅后 Token 刷新同步状态
- 过期后自动降级

---

## Phase 4: 管理后台 API

### Step 4.1: 管理员中间件

**目标**：实现管理员权限检查

**任务清单**：
- [ ] 创建管理员中间件 (`src/middleware/admin.js`)
  - 检查 `brand.roles` 包含 `admin`
  - 返回 403 INSUFFICIENT_ROLE

**验收标准**：
- 普通用户请求管理接口返回 403
- 管理员可正常访问

---

### Step 4.2: 邀请码管理

**目标**：实现邀请码批量生成与查询

**任务清单**：
- [ ] 实现邀请码批量生成
  - `POST /admin/invitations/batch` 端点
  - 参数：count, channel?, expires_at?, preset_membership, preset_duration_days?
  - count 限制 1-500
  - 唯一性保证
- [ ] 实现邀请码列表查询
  - `GET /admin/invitations` 端点
  - 支持筛选：status, channel, preset_membership
  - 分页支持

**验收标准**：
- 通过管理后台测试用例（9.7 测试套件）
- 邀请码格式正确
- 预设会员等级正确存储

---

### Step 4.3: 用户管理

**目标**：实现用户查询与状态管理

**任务清单**：
- [ ] 实现用户列表查询
  - `GET /admin/users` 端点
  - 支持搜索（手机号模糊匹配）
  - 分页支持
- [ ] 实现用户状态管理
  - `PATCH /admin/users/:sub/status` 端点
  - 暂停/恢复账号
- [ ] 实现手动授予会员
  - `POST /admin/users/:sub/membership` 端点
  - 支持所有等级（含 lifetime）

**验收标准**：
- 搜索功能正常
- 暂停用户后无法刷新 Token
- 手动授予会员生效

---

## Phase 5: 测试与质量保证

### Step 5.1: 单元测试

**目标**：为所有核心模块编写单元测试

**任务清单**：
- [ ] 短信服务测试
- [ ] Token 服务测试
- [ ] 邀请码服务测试
- [ ] 会员服务测试
- [ ] 工具函数测试

**验收标准**：
- 测试覆盖率 ≥ 80%
- 所有测试通过

---

### Step 5.2: E2E 测试

**目标**：实现完整的端到端测试

**任务清单**：
- [ ] 创建测试基础设施
  - 临时数据库设置
  - Mock 短信服务
  - 测试密钥对
- [ ] 短信验证码测试套件 (9.2)
- [ ] 邀请码注册测试套件 (9.3)
- [ ] 登录与会话测试套件 (9.4)
- [ ] 会员生命周期测试套件 (9.5)
- [ ] 管理后台测试套件 (9.7)

**验收标准**：
- 所有 E2E 测试用例通过
- 测试可重复执行

---

### Step 5.3: 子产品接入验证

**目标**：创建子产品接入验收测试

**任务清单**：
- [ ] 创建子产品 Mock 服务
- [ ] 实现 JWT 验证中间件测试
- [ ] 实现权限中间件测试
- [ ] 实现数据隔离测试

**验收标准**：
- 通过所有子产品接入测试用例（9.6）
- 测试套件可复用于新子产品

---

## Phase 6: 部署与文档

### Step 6.1: Docker 化

**目标**：创建生产级 Docker 配置

**任务清单**：
- [ ] 编写 Dockerfile
  - 多阶段构建
  - 非 root 用户
  - 健康检查
- [ ] 编写 docker-compose.yml
  - 数据卷挂载
  - 密钥只读挂载
  - 网络配置
- [ ] 编写 Nginx 配置
  - 路径转发
  - SSL 配置模板

**验收标准**：
- `docker-compose up -d` 可正常启动
- 健康检查端点可访问

---

### Step 6.2: 日志与监控

**目标**：实现结构化日志

**任务清单**：
- [ ] 实现日志中间件
- [ ] 定义日志事件：
  - `auth.login.success`
  - `auth.login.failed`
  - `auth.register.success`
  - `auth.sms.sent`
  - `membership.subscribe`
  - `membership.cancel`
- [ ] 确保敏感信息脱敏（手机号、验证码、Token）

**验收标准**：
- 日志格式为 JSON
- 敏感信息已脱敏
- 包含关键业务指标

---

### Step 6.3: API 文档

**目标**：编写 API 文档

**任务清单**：
- [ ] 使用 Swagger/OpenAPI 规范
- [ ] 文档包含所有端点
- [ ] 文档包含所有错误码
- [ ] 提供示例请求/响应

**验收标准**：
- 文档可通过 `/docs` 访问
- 文档与实现一致

---

### Step 6.4: 部署文档

**目标**：编写部署指南

**任务清单**：
- [ ] 环境变量说明
- [ ] 密钥生成步骤
- [ ] 数据库初始化步骤
- [ ] Nginx 配置说明
- [ ] 子产品接入指南
- [ ] 常见问题排查

**验收标准**：
- 按文档可完成完整部署
- 新团队成员可理解

---

## 依赖关系图

```
Phase 1 (基础设施)
    ├── Step 1.1 项目脚手架
    ├── Step 1.2 数据库层 ────────────┐
    ├── Step 1.3 配置管理            │
    └── Step 1.4 JWT 密钥            │
                                      │
Phase 2 (认证服务)                   │
    ├── Step 2.1 短信验证码 ←─────────┤
    ├── Step 2.2 用户注册 ←───────────┤
    └── Step 2.3 登录与 Token ←───────┘
            │
            ▼
Phase 3 (用户与会员)
    ├── Step 3.1 用户资料 ←─ Step 2.3
    └── Step 3.2 会员服务 ←─ Step 2.3
            │
            ▼
Phase 4 (管理后台)
    ├── Step 4.1 管理员中间件 ←─ Step 3.1
    ├── Step 4.2 邀请码管理 ←─ Step 4.1
    └── Step 4.3 用户管理 ←─ Step 4.1
            │
            ▼
Phase 5 (测试)
    ├── Step 5.1 单元测试 ←─ Phase 2-4
    ├── Step 5.2 E2E 测试 ←─ Phase 2-4
    └── Step 5.3 接入验证 ←─ Phase 5.2
            │
            ▼
Phase 6 (部署文档)
    ├── Step 6.1 Docker 化
    ├── Step 6.2 日志监控
    ├── Step 6.3 API 文档
    └── Step 6.4 部署文档
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| spug 短信服务不稳定 | 用户无法注册/登录 | 实现 Mock 模式；监控短信发送成功率 |
| SQLite 并发写入限制 | 高并发下性能下降 | 使用 WAL 模式；考虑后续迁移 PostgreSQL |
| 进程重启导致验证码丢失 | 用户需重新获取验证码 | 可接受；文档说明 |
| JWT 密钥泄露 | 安全风险 | 密钥文件权限控制；定期轮换流程设计 |

---

## 下一步行动

1. **确认环境**：确保 Node.js 18+ 环境
2. **开始 Phase 1**：从 Step 1.1 项目脚手架开始
3. **并行任务**：Phase 1 中 Step 1.1 可先行，Step 1.2-1.4 可部分并行

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-02-26 | 初始版本，基于 PRD v1.1 和技术方案 v2.0 |