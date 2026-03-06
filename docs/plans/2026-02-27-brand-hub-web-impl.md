# Brand Hub Web 前端实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use summ:executing-plans to implement this plan task-by-task.

**Goal:** 为 Brand Hub 添加前端页面，包括登录、注册、用户信息和管理后台。

**Architecture:** 纯 HTML + CSS + JS，由 Fastify 静态托管。前端通过 fetch 调用后端 API，使用 localStorage 存储 refresh_token。

**Tech Stack:** HTML5, CSS3, Vanilla JS, Fastify Static

---

## Task 1: 安装依赖并配置静态服务

**Files:**
- Modify: `package.json`
- Modify: `src/app.js`

**Step 1: 安装 @fastify/static**

```bash
npm install @fastify/static
```

**Step 2: 修改 src/app.js，在 init() 函数中注册静态服务**

在 `await fastify.register(cors, {...})` 之后添加：

```javascript
// Register static file serving
await fastify.register(require('@fastify/static'), {
  root: require('path').join(__dirname, '..', 'public'),
  prefix: '/',
});

// Redirect root to login or profile
fastify.get('/', async (request, reply) => {
  return reply.redirect('/login.html');
});
```

需要在文件顶部添加：

```javascript
const path = require('path');
```

**Step 3: 验证服务启动**

```bash
npm run dev
```

Expected: 服务正常启动，访问 http://localhost:3000/ 返回 404（因为 public 目录还不存在）

**Step 4: Commit**

```bash
git add package.json package-lock.json src/app.js
git commit -m "feat: add @fastify/static for serving frontend files"
```

---

## Task 2: 创建目录结构和通用样式

**Files:**
- Create: `public/`
- Create: `public/css/style.css`

**Step 1: 创建目录结构**

```bash
mkdir -p public/css public/js/pages public/admin
```

**Step 2: 创建通用样式 public/css/style.css**

遵循节物设计规范：

```css
/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Typography */
html {
  font-size: 16px;
}

body {
  font-family: "PingFang SC", "Noto Sans SC", "Helvetica Neue", sans-serif;
  color: #1a1a1a;
  background: #ffffff;
  line-height: 1.6;
}

/* Color System */
:root {
  /* Text levels */
  --text-l1: #1a1a1a;
  --text-l2: #555555;
  --text-l3: #666666;
  --text-l4: #888888;
  --text-l5: #999999;
  --text-l6: #aaaaaa;
  --text-l7: #bbbbbb;
  --text-l8: #cccccc;

  /* Borders */
  --border-primary: #1a1a1a;
  --border-secondary: #eeeeee;
  --border-micro: #f5f5f5;

  /* Semantic colors */
  --warn-border: #d4b8b8;
  --warn-text: #8a5a5a;
  --info-border: #b8c8d4;
  --info-text: #5a6a8a;
  --success-border: #b8d4b8;
  --success-text: #5a8a5a;
}

/* Layout */
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-primary);
  margin-bottom: 28px;
}

.header-brand {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 4px;
  color: var(--text-l5);
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Section */
.section {
  margin-bottom: 28px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--text-l5);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-secondary);
  margin-bottom: 12px;
}

/* Form */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-l5);
  margin-bottom: 4px;
  letter-spacing: 1px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  border: 1px solid var(--border-secondary);
  border-radius: 2px;
  outline: none;
  transition: border-color 0.15s;
}

.form-input:focus {
  border-color: var(--text-l3);
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-input {
  flex: 1;
}

.form-row .btn {
  flex-shrink: 0;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 10px 20px;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  letter-spacing: 1px;
  border: 1px solid var(--border-primary);
  border-radius: 2px;
  background: #fff;
  color: var(--text-l1);
  cursor: pointer;
  text-decoration: none;
}

.btn:hover {
  background: var(--text-l1);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  width: 100%;
  background: var(--text-l1);
  color: #fff;
}

.btn-primary:hover {
  background: var(--text-l2);
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--text-l3);
  text-decoration: underline;
}

.btn-link:hover {
  color: var(--text-l1);
  background: none;
}

/* Table */
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 1px;
  color: var(--text-l5);
  text-align: left;
  padding: 8px;
  border-bottom: 1px solid var(--border-secondary);
}

.table td {
  padding: 8px;
  border-bottom: 1px solid var(--border-micro);
  color: var(--text-l2);
}

.table td:first-child {
  font-weight: 500;
  color: var(--text-l1);
}

/* Data list */
.data-list {
  font-size: 14px;
}

.data-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-micro);
}

.data-label {
  color: var(--text-l5);
  font-size: 12px;
}

.data-value {
  color: var(--text-l2);
}

/* Tags */
.tag {
  display: inline-block;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 3px 10px;
  border: 1px solid var(--border-secondary);
  border-radius: 2px;
  color: var(--text-l4);
}

.tag-success {
  border-color: var(--success-border);
  color: var(--success-text);
}

.tag-warn {
  border-color: var(--warn-border);
  color: var(--warn-text);
}

.tag-info {
  border-color: var(--info-border);
  color: var(--info-text);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-l4);
}

/* Navigation */
.nav {
  display: flex;
  gap: 16px;
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary);
}

.nav-link {
  font-size: 12px;
  color: var(--text-l4);
  text-decoration: none;
  letter-spacing: 1px;
}

.nav-link:hover,
.nav-link.active {
  color: var(--text-l1);
}

/* Message */
.message {
  padding: 12px 16px;
  border-radius: 2px;
  font-size: 13px;
  margin-bottom: 16px;
}

.message-error {
  border-left: 3px solid var(--warn-border);
  background: #fdf8f6;
  color: var(--warn-text);
}

.message-success {
  border-left: 3px solid var(--success-border);
  background: #f6fdf6;
  color: var(--success-text);
}

/* Links */
.link {
  font-size: 13px;
  color: var(--text-l4);
  text-align: center;
  margin-top: 20px;
}

.link a {
  color: var(--text-l2);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  padding: 24px;
  border-radius: 2px;
  max-width: 400px;
  width: 100%;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.hidden {
  display: none;
}

/* Responsive */
@media (max-width: 720px) {
  .container {
    padding: 24px;
  }
}

@media (max-width: 430px) {
  .container {
    padding: 16px;
  }
}
```

**Step 3: Commit**

```bash
git add public/
git commit -m "feat: add directory structure and base CSS styles"
```

---

## Task 3: 创建 API 封装模块

**Files:**
- Create: `public/js/api.js`

**Step 1: 创建 public/js/api.js**

```javascript
/**
 * API Client for Brand Hub
 */

const API_BASE = '';

const api = {
  // Token management
  getAccessToken() {
    return sessionStorage.getItem('access_token');
  },

  setAccessToken(token) {
    if (token) {
      sessionStorage.setItem('access_token', token);
    } else {
      sessionStorage.removeItem('access_token');
    }
  },

  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },

  setRefreshToken(token) {
    if (token) {
      localStorage.setItem('refresh_token', token);
    } else {
      localStorage.removeItem('refresh_token');
    }
  },

  clearTokens() {
    sessionStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_info');
  },

  // User info
  getUserInfo() {
    const info = sessionStorage.getItem('user_info');
    return info ? JSON.parse(info) : null;
  },

  setUserInfo(info) {
    if (info) {
      sessionStorage.setItem('user_info', JSON.stringify(info));
    } else {
      sessionStorage.removeItem('user_info');
    }
  },

  // Request helper
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || 'Request failed');
      error.code = data.code;
      error.status = response.status;
      throw error;
    }

    return data;
  },

  // Auth APIs
  async sendSmsCode(phone, scene) {
    return this.request('/auth/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone, scene }),
    });
  },

  async register(phone, code, invite_code, nickname) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, code, invite_code, nickname }),
    });
    this.setTokensFromResponse(data);
    return data;
  },

  async login(phone, code) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    this.setTokensFromResponse(data);
    return data;
  },

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const data = await this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    this.setAccessToken(data.access_token);
    this.setRefreshToken(data.refresh_token);
    return data;
  },

  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (e) {
        // Ignore logout errors
      }
    }
    this.clearTokens();
  },

  setTokensFromResponse(data) {
    this.setAccessToken(data.access_token);
    this.setRefreshToken(data.refresh_token);
    if (data.user) {
      this.setUserInfo(data.user);
    }
  },

  // User APIs
  async getMe() {
    return this.request('/users/me');
  },

  async updateMe(nickname) {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ nickname }),
    });
  },

  // Admin APIs
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/users?${query}`);
  },

  async getUser(sub) {
    return this.request(`/admin/users/${sub}`);
  },

  async updateUserStatus(sub, status) {
    return this.request(`/admin/users/${sub}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async grantMembership(sub, plan, duration_days) {
    return this.request(`/admin/users/${sub}/membership`, {
      method: 'POST',
      body: JSON.stringify({ plan, duration_days }),
    });
  },

  async getInvitations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/invitations?${query}`);
  },

  async createInvitations(data) {
    return this.request('/admin/invitations/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Auth guard
  async ensureAuth() {
    const token = this.getRefreshToken();
    if (!token) {
      window.location.href = '/login.html';
      return false;
    }

    if (!this.getAccessToken()) {
      try {
        await this.refreshAccessToken();
      } catch (e) {
        this.clearTokens();
        window.location.href = '/login.html';
        return false;
      }
    }

    return true;
  },

  async ensureAdmin() {
    const authed = await this.ensureAuth();
    if (!authed) return false;

    const user = this.getUserInfo();
    if (!user || !user.roles || !user.roles.includes('admin')) {
      window.location.href = '/profile.html';
      return false;
    }

    return true;
  },
};

// Export for ES modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
```

**Step 2: Commit**

```bash
git add public/js/api.js
git commit -m "feat: add API client module"
```

---

## Task 4: 创建登录页

**Files:**
- Create: `public/login.html`

**Step 1: 创建 public/login.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - 节物</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">节物</div>
    </header>

    <main>
      <div id="message" class="message hidden"></div>

      <form id="loginForm">
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input type="tel" class="form-input" id="phone" placeholder="请输入手机号" required>
        </div>

        <div class="form-group">
          <label class="form-label">验证码</label>
          <div class="form-row">
            <input type="text" class="form-input" id="code" placeholder="6位验证码" maxlength="6" required>
            <button type="button" class="btn btn-small" id="sendCodeBtn">获取验证码</button>
          </div>
        </div>

        <div class="form-group">
          <button type="submit" class="btn btn-primary">登 录</button>
        </div>
      </form>

      <div class="link">
        没有账号？<a href="/register.html">前往注册</a>
      </div>
    </main>
  </div>

  <script src="/js/api.js"></script>
  <script>
    (function() {
      const form = document.getElementById('loginForm');
      const phoneInput = document.getElementById('phone');
      const codeInput = document.getElementById('code');
      const sendCodeBtn = document.getElementById('sendCodeBtn');
      const messageEl = document.getElementById('message');

      let countdown = 0;

      function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message message-' + type;
        messageEl.classList.remove('hidden');
      }

      function hideMessage() {
        messageEl.classList.add('hidden');
      }

      function startCountdown(seconds) {
        countdown = seconds;
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = countdown + 's';

        const timer = setInterval(function() {
          countdown--;
          if (countdown <= 0) {
            clearInterval(timer);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '获取验证码';
          } else {
            sendCodeBtn.textContent = countdown + 's';
          }
        }, 1000);
      }

      sendCodeBtn.addEventListener('click', async function() {
        const phone = phoneInput.value.trim();

        if (!phone) {
          showMessage('请输入手机号', 'error');
          return;
        }

        hideMessage();

        try {
          const result = await api.sendSmsCode(phone, 'login');
          startCountdown(result.cooldown || 60);
          showMessage('验证码已发送', 'success');
        } catch (error) {
          showMessage(error.message || '发送失败', 'error');
        }
      });

      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideMessage();

        const phone = phoneInput.value.trim();
        const code = codeInput.value.trim();

        if (!phone || !code) {
          showMessage('请填写完整信息', 'error');
          return;
        }

        try {
          const result = await api.login(phone, code);
          window.location.href = '/profile.html';
        } catch (error) {
          showMessage(error.message || '登录失败', 'error');
        }
      });

      // Redirect if already logged in
      if (api.getRefreshToken()) {
        window.location.href = '/profile.html';
      }
    })();
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/login.html
git commit -m "feat: add login page"
```

---

## Task 5: 创建注册页

**Files:**
- Create: `public/register.html`

**Step 1: 创建 public/register.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>注册 - 节物</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">节物</div>
    </header>

    <main>
      <div id="message" class="message hidden"></div>

      <form id="registerForm">
        <div class="form-group">
          <label class="form-label">手机号</label>
          <input type="tel" class="form-input" id="phone" placeholder="请输入手机号" required>
        </div>

        <div class="form-group">
          <label class="form-label">验证码</label>
          <div class="form-row">
            <input type="text" class="form-input" id="code" placeholder="6位验证码" maxlength="6" required>
            <button type="button" class="btn btn-small" id="sendCodeBtn">获取验证码</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">昵称</label>
          <input type="text" class="form-input" id="nickname" placeholder="请输入昵称" maxlength="50" required>
        </div>

        <div class="form-group">
          <label class="form-label">邀请码</label>
          <input type="text" class="form-input" id="inviteCode" placeholder="请输入邀请码" required>
        </div>

        <div class="form-group">
          <button type="submit" class="btn btn-primary">注 册</button>
        </div>
      </form>

      <div class="link">
        已有账号？<a href="/login.html">前往登录</a>
      </div>
    </main>
  </div>

  <script src="/js/api.js"></script>
  <script>
    (function() {
      const form = document.getElementById('registerForm');
      const phoneInput = document.getElementById('phone');
      const codeInput = document.getElementById('code');
      const nicknameInput = document.getElementById('nickname');
      const inviteCodeInput = document.getElementById('inviteCode');
      const sendCodeBtn = document.getElementById('sendCodeBtn');
      const messageEl = document.getElementById('message');

      let countdown = 0;

      function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message message-' + type;
        messageEl.classList.remove('hidden');
      }

      function hideMessage() {
        messageEl.classList.add('hidden');
      }

      function startCountdown(seconds) {
        countdown = seconds;
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = countdown + 's';

        const timer = setInterval(function() {
          countdown--;
          if (countdown <= 0) {
            clearInterval(timer);
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = '获取验证码';
          } else {
            sendCodeBtn.textContent = countdown + 's';
          }
        }, 1000);
      }

      sendCodeBtn.addEventListener('click', async function() {
        const phone = phoneInput.value.trim();

        if (!phone) {
          showMessage('请输入手机号', 'error');
          return;
        }

        hideMessage();

        try {
          const result = await api.sendSmsCode(phone, 'register');
          startCountdown(result.cooldown || 60);
          showMessage('验证码已发送', 'success');
        } catch (error) {
          showMessage(error.message || '发送失败', 'error');
        }
      });

      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideMessage();

        const phone = phoneInput.value.trim();
        const code = codeInput.value.trim();
        const nickname = nicknameInput.value.trim();
        const inviteCode = inviteCodeInput.value.trim();

        if (!phone || !code || !nickname || !inviteCode) {
          showMessage('请填写完整信息', 'error');
          return;
        }

        try {
          await api.register(phone, code, inviteCode, nickname);
          window.location.href = '/profile.html';
        } catch (error) {
          showMessage(error.message || '注册失败', 'error');
        }
      });

      // Redirect if already logged in
      if (api.getRefreshToken()) {
        window.location.href = '/profile.html';
      }
    })();
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/register.html
git commit -m "feat: add register page"
```

---

## Task 6: 创建用户信息页

**Files:**
- Create: `public/profile.html`

**Step 1: 创建 public/profile.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>个人信息 - 节物</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">节物</div>
      <div class="header-actions">
        <button class="btn btn-link" id="logoutBtn">登出</button>
      </div>
    </header>

    <main>
      <div id="message" class="message hidden"></div>

      <section class="section">
        <h2 class="section-title">个人信息</h2>
        <div class="data-list" id="profileData">
          <div class="data-row">
            <span class="data-label">手机</span>
            <span class="data-value" id="phone">-</span>
          </div>
          <div class="data-row">
            <span class="data-label">昵称</span>
            <span class="data-value">
              <span id="nicknameDisplay">-</span>
              <input type="text" class="form-input hidden" id="nicknameInput" style="width: 150px; display: inline-block;">
              <button class="btn btn-small" id="editNicknameBtn">修改</button>
              <button class="btn btn-small hidden" id="saveNicknameBtn">保存</button>
              <button class="btn btn-small btn-link hidden" id="cancelNicknameBtn">取消</button>
            </span>
          </div>
          <div class="data-row">
            <span class="data-label">角色</span>
            <span class="data-value" id="roles">-</span>
          </div>
          <div class="data-row">
            <span class="data-label">注册时间</span>
            <span class="data-value" id="createdAt">-</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">会员信息</h2>
        <div class="data-list">
          <div class="data-row">
            <span class="data-label">等级</span>
            <span class="data-value"><span class="tag" id="membershipPlan">free</span></span>
          </div>
          <div class="data-row">
            <span class="data-label">到期时间</span>
            <span class="data-value" id="membershipExpires">-</span>
          </div>
          <div class="data-row">
            <span class="data-label">来源</span>
            <span class="data-value" id="membershipSource">-</span>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script src="/js/api.js"></script>
  <script>
    (function() {
      const messageEl = document.getElementById('message');
      const phoneEl = document.getElementById('phone');
      const nicknameDisplayEl = document.getElementById('nicknameDisplay');
      const nicknameInputEl = document.getElementById('nicknameInput');
      const editNicknameBtn = document.getElementById('editNicknameBtn');
      const saveNicknameBtn = document.getElementById('saveNicknameBtn');
      const cancelNicknameBtn = document.getElementById('cancelNicknameBtn');
      const rolesEl = document.getElementById('roles');
      const createdAtEl = document.getElementById('createdAt');
      const membershipPlanEl = document.getElementById('membershipPlan');
      const membershipExpiresEl = document.getElementById('membershipExpires');
      const membershipSourceEl = document.getElementById('membershipSource');
      const logoutBtn = document.getElementById('logoutBtn');

      function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message message-' + type;
        messageEl.classList.remove('hidden');
      }

      function hideMessage() {
        messageEl.classList.add('hidden');
      }

      function maskPhone(phone) {
        if (!phone || phone.length < 7) return phone;
        return phone.slice(0, 3) + '****' + phone.slice(-4);
      }

      function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
      }

      function formatPlan(plan) {
        const plans = {
          'free': '免费',
          'monthly': '月度会员',
          'yearly': '年度会员',
          'lifetime': '永久会员'
        };
        return plans[plan] || plan;
      }

      async function loadProfile() {
        try {
          const user = await api.getMe();

          phoneEl.textContent = maskPhone(user.phone);
          nicknameDisplayEl.textContent = user.nickname;
          nicknameInputEl.value = user.nickname;
          rolesEl.textContent = user.roles ? user.roles.join(', ') : 'user';
          createdAtEl.textContent = formatDate(user.created_at);

          membershipPlanEl.textContent = formatPlan(user.membership?.plan || 'free');
          membershipExpiresEl.textContent = user.membership?.expires_at
            ? formatDate(user.membership.expires_at)
            : (user.membership?.plan === 'lifetime' ? '永久' : '-');
          membershipSourceEl.textContent = user.membership?.source || '-';

          // Update stored user info
          api.setUserInfo(user);
        } catch (error) {
          showMessage(error.message || '加载失败', 'error');
        }
      }

      // Edit nickname
      editNicknameBtn.addEventListener('click', function() {
        nicknameDisplayEl.classList.add('hidden');
        editNicknameBtn.classList.add('hidden');
        nicknameInputEl.classList.remove('hidden');
        saveNicknameBtn.classList.remove('hidden');
        cancelNicknameBtn.classList.remove('hidden');
        nicknameInputEl.focus();
      });

      cancelNicknameBtn.addEventListener('click', function() {
        nicknameInputEl.classList.add('hidden');
        saveNicknameBtn.classList.add('hidden');
        cancelNicknameBtn.classList.add('hidden');
        nicknameDisplayEl.classList.remove('hidden');
        editNicknameBtn.classList.remove('hidden');
        nicknameInputEl.value = nicknameDisplayEl.textContent;
      });

      saveNicknameBtn.addEventListener('click', async function() {
        const newNickname = nicknameInputEl.value.trim();

        if (!newNickname) {
          showMessage('昵称不能为空', 'error');
          return;
        }

        try {
          const result = await api.updateMe(newNickname);
          nicknameDisplayEl.textContent = result.nickname;
          nicknameInputEl.classList.add('hidden');
          saveNicknameBtn.classList.add('hidden');
          cancelNicknameBtn.classList.add('hidden');
          nicknameDisplayEl.classList.remove('hidden');
          editNicknameBtn.classList.remove('hidden');
          showMessage('昵称已更新', 'success');
          setTimeout(hideMessage, 2000);
        } catch (error) {
          showMessage(error.message || '更新失败', 'error');
        }
      });

      // Logout
      logoutBtn.addEventListener('click', async function() {
        await api.logout();
        window.location.href = '/login.html';
      });

      // Init
      api.ensureAuth().then(function(authed) {
        if (authed) {
          loadProfile();
        }
      });
    })();
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/profile.html
git commit -m "feat: add profile page with nickname editing"
```

---

## Task 7: 创建管理员页面 - 用户列表

**Files:**
- Create: `public/admin/index.html`

**Step 1: 创建 public/admin/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>用户管理 - 节物</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">节物</div>
      <div class="header-actions">
        <span id="adminName" style="font-size: 12px; color: #888;"></span>
      </div>
    </header>

    <main>
      <div id="message" class="message hidden"></div>

      <section class="section">
        <h2 class="section-title">用户管理</h2>

        <div class="form-row" style="margin-bottom: 16px;">
          <input type="text" class="form-input" id="searchInput" placeholder="搜索手机号">
          <button class="btn btn-small" id="searchBtn">搜索</button>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>手机</th>
              <th>昵称</th>
              <th>会员</th>
              <th>状态</th>
              <th>注册时间</th>
            </tr>
          </thead>
          <tbody id="userTableBody">
            <tr>
              <td colspan="5" style="text-align: center; color: #888;">加载中...</td>
            </tr>
          </tbody>
        </table>

        <div class="pagination" id="pagination"></div>
      </section>

      <nav class="nav">
        <a href="/admin/index.html" class="nav-link active">用户管理</a>
        <a href="/admin/invitations.html" class="nav-link">邀请码管理</a>
        <a href="/profile.html" class="nav-link">返回前台</a>
      </nav>
    </main>
  </div>

  <script src="/js/api.js"></script>
  <script>
    (function() {
      const messageEl = document.getElementById('message');
      const adminNameEl = document.getElementById('adminName');
      const searchInput = document.getElementById('searchInput');
      const searchBtn = document.getElementById('searchBtn');
      const tableBody = document.getElementById('userTableBody');
      const paginationEl = document.getElementById('pagination');

      let currentPage = 1;
      let totalPages = 1;
      const limit = 20;

      function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message message-' + type;
        messageEl.classList.remove('hidden');
      }

      function maskPhone(phone) {
        if (!phone || phone.length < 7) return phone;
        return phone.slice(0, 3) + '****' + phone.slice(-4);
      }

      function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
      }

      function formatPlan(plan) {
        const plans = {
          'free': '免费',
          'monthly': '月度',
          'yearly': '年度',
          'lifetime': '永久'
        };
        return plans[plan] || plan;
      }

      function statusTag(status) {
        if (status === 'active') {
          return '<span class="tag tag-success">正常</span>';
        }
        return '<span class="tag tag-warn">禁用</span>';
      }

      async function loadUsers(page, search) {
        const params = { page, limit };
        if (search) {
          params.search = search;
        }

        try {
          const result = await api.getUsers(params);

          if (result.items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">暂无数据</td></tr>';
          } else {
            tableBody.innerHTML = result.items.map(function(user) {
              return '<tr style="cursor: pointer;" onclick="window.location.href=\'/admin/user-detail.html?sub=' + user.sub + '\'">' +
                '<td>' + maskPhone(user.phone) + '</td>' +
                '<td>' + (user.nickname || '-') + '</td>' +
                '<td><span class="tag">' + formatPlan(user.membership?.plan || 'free') + '</span></td>' +
                '<td>' + statusTag(user.status) + '</td>' +
                '<td>' + formatDate(user.created_at) + '</td>' +
              '</tr>';
            }).join('');
          }

          currentPage = result.page;
          totalPages = Math.ceil(result.total / limit);
          renderPagination();
        } catch (error) {
          showMessage(error.message || '加载失败', 'error');
        }
      }

      function renderPagination() {
        if (totalPages <= 1) {
          paginationEl.innerHTML = '';
          return;
        }

        let html = '';

        if (currentPage > 1) {
          html += '<button class="btn btn-small" onclick="loadUsers(' + (currentPage - 1) + ', searchInput.value)">上一页</button>';
        }

        html += '<span>第 ' + currentPage + '/' + totalPages + ' 页</span>';

        if (currentPage < totalPages) {
          html += '<button class="btn btn-small" onclick="loadUsers(' + (currentPage + 1) + ', searchInput.value)">下一页</button>';
        }

        paginationEl.innerHTML = html;
      }

      searchBtn.addEventListener('click', function() {
        loadUsers(1, searchInput.value.trim());
      });

      searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          loadUsers(1, searchInput.value.trim());
        }
      });

      // Init
      api.ensureAdmin().then(function(authed) {
        if (authed) {
          const user = api.getUserInfo();
          adminNameEl.textContent = user?.nickname || 'admin';
          loadUsers(1);
        }
      });
    })();
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/admin/index.html
git commit -m "feat: add admin user list page"
```

---

## Task 8: 创建管理员页面 - 邀请码管理

**Files:**
- Create: `public/admin/invitations.html`

**Step 1: 创建 public/admin/invitations.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>邀请码管理 - 节物</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">节物</div>
      <div class="header-actions">
        <span id="adminName" style="font-size: 12px; color: #888;"></span>
      </div>
    </header>

    <main>
      <div id="message" class="message hidden"></div>

      <section class="section">
        <h2 class="section-title">邀请码管理</h2>

        <div style="margin-bottom: 16px;">
          <button class="btn" id="createBtn">批量生成</button>
        </div>

        <div class="form-row" style="margin-bottom: 16px;">
          <select class="form-input" id="statusFilter" style="max-width: 150px;">
            <option value="">全部状态</option>
            <option value="unused">未使用</option>
            <option value="used">已使用</option>
          </select>
          <select class="form-input" id="channelFilter" style="max-width: 150px;">
            <option value="">全部渠道</option>
            <option value="web">web</option>
            <option value="app">app</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>邀请码</th>
              <th>渠道</th>
              <th>预设会员</th>
              <th>状态</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody id="invitationTableBody">
            <tr>
              <td colspan="5" style="text-align: center; color: #888;">加载中...</td>
            </tr>
          </tbody>
        </table>

        <div class="pagination" id="pagination"></div>
      </section>

      <nav class="nav">
        <a href="/admin/index.html" class="nav-link">用户管理</a>
        <a href="/admin/invitations.html" class="nav-link active">邀请码管理</a>
        <a href="/profile.html" class="nav-link">返回前台</a>
      </nav>
    </main>
  </div>

  <!-- Create Modal -->
  <div class="modal-overlay hidden" id="createModal">
    <div class="modal">
      <h3 class="modal-title">批量生成邀请码</h3>
      <div class="form-group">
        <label class="form-label">数量</label>
        <input type="number" class="form-input" id="createCount" value="10" min="1" max="500">
      </div>
      <div class="form-group">
        <label class="form-label">渠道</label>
        <input type="text" class="form-input" id="createChannel" value="admin">
      </div>
      <div class="form-group">
        <label class="form-label">预设会员</label>
        <select class="form-input" id="createMembership">
          <option value="free">免费</option>
          <option value="monthly">月度会员</option>
          <option value="yearly">年度会员</option>
          <option value="lifetime">永久会员</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">有效天数（可选）</label>
        <input type="number" class="form-input" id="createDays" placeholder="留空则永久有效">
      </div>
      <div class="modal-actions">
        <button class="btn btn-small btn-link" id="cancelCreateBtn">取消</button>
        <button class="btn btn-small" id="confirmCreateBtn">生成</button>
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
  <script>
    (function() {
      const messageEl = document.getElementById('message');
      const adminNameEl = document.getElementById('adminName');
      const statusFilter = document.getElementById('statusFilter');
      const channelFilter = document.getElementById('channelFilter');
      const tableBody = document.getElementById('invitationTableBody');
      const paginationEl = document.getElementById('pagination');
      const createBtn = document.getElementById('createBtn');
      const createModal = document.getElementById('createModal');
      const cancelCreateBtn = document.getElementById('cancelCreateBtn');
      const confirmCreateBtn = document.getElementById('confirmCreateBtn');

      let currentPage = 1;
      let totalPages = 1;
      const limit = 20;

      function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message message-' + type;
        messageEl.classList.remove('hidden');
      }

      function hideMessage() {
        messageEl.classList.add('hidden');
      }

      function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
      }

      function formatPlan(plan) {
        const plans = {
          'free': '免费',
          'monthly': '月度',
          'yearly': '年度',
          'lifetime': '永久'
        };
        return plans[plan] || plan;
      }

      function statusTag(status) {
        if (status === 'unused') {
          return '<span class="tag tag-success">未使用</span>';
        }
        return '<span class="tag tag-info">已使用</span>';
      }

      async function loadInvitations(page) {
        const params = { page, limit };
        if (statusFilter.value) {
          params.status = statusFilter.value;
        }
        if (channelFilter.value) {
          params.channel = channelFilter.value;
        }

        try {
          const result = await api.getInvitations(params);

          if (result.items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">暂无数据</td></tr>';
          } else {
            tableBody.innerHTML = result.items.map(function(inv) {
              return '<tr>' +
                '<td style="font-family: monospace;">' + inv.code + '</td>' +
                '<td>' + (inv.channel || '-') + '</td>' +
                '<td>' + formatPlan(inv.preset_membership) + '</td>' +
                '<td>' + statusTag(inv.status) + '</td>' +
                '<td>' + formatDate(inv.created_at) + '</td>' +
              '</tr>';
            }).join('');
          }

          currentPage = result.page;
          totalPages = Math.ceil(result.total / limit);
          renderPagination();
        } catch (error) {
          showMessage(error.message || '加载失败', 'error');
        }
      }

      function renderPagination() {
        if (totalPages <= 1) {
          paginationEl.innerHTML = '';
          return;
        }

        let html = '';

        if (currentPage > 1) {
          html += '<button class="btn btn-small" onclick="loadInvitations(' + (currentPage - 1) + ')">上一页</button>';
        }

        html += '<span>第 ' + currentPage + '/' + totalPages + ' 页</span>';

        if (currentPage < totalPages) {
          html += '<button class="btn btn-small" onclick="loadInvitations(' + (currentPage + 1) + ')">下一页</button>';
        }

        paginationEl.innerHTML = html;
      }

      statusFilter.addEventListener('change', function() {
        loadInvitations(1);
      });

      channelFilter.addEventListener('change', function() {
        loadInvitations(1);
      });

      createBtn.addEventListener('click', function() {
        createModal.classList.remove('hidden');
      });

      cancelCreateBtn.addEventListener('click', function() {
        createModal.classList.add('hidden');
      });

      confirmCreateBtn.addEventListener('click', async function() {
        const count = parseInt(document.getElementById('createCount').value, 10);
        const channel = document.getElementById('createChannel').value.trim();
        const presetMembership = document.getElementById('createMembership').value;
        const durationDays = document.getElementById('createDays').value;

        if (!count || count < 1 || count > 500) {
          showMessage('数量必须在 1-500 之间', 'error');
          return;
        }

        try {
          const result = await api.createInvitations({
            count,
            channel,
            preset_membership: presetMembership,
            preset_duration_days: durationDays ? parseInt(durationDays, 10) : undefined,
          });

          createModal.classList.add('hidden');
          showMessage('已生成 ' + result.count + ' 个邀请码', 'success');
          setTimeout(hideMessage, 3000);
          loadInvitations(1);
        } catch (error) {
          showMessage(error.message || '生成失败', 'error');
        }
      });

      // Init
      api.ensureAdmin().then(function(authed) {
        if (authed) {
          const user = api.getUserInfo();
          adminNameEl.textContent = user?.nickname || 'admin';
          loadInvitations(1);
        }
      });
    })();
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/admin/invitations.html
git commit -m "feat: add admin invitations management page"
```

---

## Task 9: 创建管理员页面 - 用户详情

**Files:**
- Create: `public/admin/user-detail.html`

**Step 1: 创建 public/admin/user-detail.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>用户详情 - 节物</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">节物</div>
      <div class="header-actions">
        <span id="adminName" style="font-size: 12px; color: #888;"></span>
      </div>
    </header>

    <main>
      <div id="message" class="message hidden"></div>

      <div style="margin-bottom: 20px;">
        <button class="btn btn-link" onclick="window.location.href='/admin/index.html'">← 返回列表</button>
      </div>

      <section class="section">
        <h2 class="section-title">用户信息</h2>
        <div class="data-list">
          <div class="data-row">
            <span class="data-label">手机</span>
            <span class="data-value" id="phone">-</span>
          </div>
          <div class="data-row">
            <span class="data-label">昵称</span>
            <span class="data-value" id="nickname">-</span>
          </div>
          <div class="data-row">
            <span class="data-label">角色</span>
            <span class="data-value" id="roles">-</span>
          </div>
          <div class="data-row">
            <span class="data-label">状态</span>
            <span class="data-value">
              <span id="statusTag">-</span>
              <button class="btn btn-small" id="toggleStatusBtn">禁用</button>
            </span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">邀请码信息</h2>
        <div class="data-list" id="invitationInfo">
          <div class="data-row">
            <span class="data-label">邀请码</span>
            <span class="data-value">-</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">会员记录</h2>
        <table class="table">
          <thead>
            <tr>
              <th>等级</th>
              <th>状态</th>
              <th>开始时间</th>
              <th>到期时间</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody id="membershipTableBody">
            <tr>
              <td colspan="5" style="text-align: center; color: #888;">加载中...</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <button class="btn" id="grantMembershipBtn">授予会员</button>
      </section>
    </main>
  </div>

  <!-- Grant Modal -->
  <div class="modal-overlay hidden" id="grantModal">
    <div class="modal">
      <h3 class="modal-title">授予会员</h3>
      <div class="form-group">
        <label class="form-label">会员等级</label>
        <select class="form-input" id="grantPlan">
          <option value="monthly">月度会员</option>
          <option value="yearly">年度会员</option>
          <option value="lifetime">永久会员</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">有效天数</label>
        <input type="number" class="form-input" id="grantDays" placeholder="留空则按等级默认">
      </div>
      <div class="modal-actions">
        <button class="btn btn-small btn-link" id="cancelGrantBtn">取消</button>
        <button class="btn btn-small" id="confirmGrantBtn">授予</button>
      </div>
    </div>
  </div>

  <script src="/js/api.js"></script>
  <script>
    (function() {
      const params = new URLSearchParams(window.location.search);
      const userSub = params.get('sub');

      if (!userSub) {
        window.location.href = '/admin/index.html';
        return;
      }

      const messageEl = document.getElementById('message');
      const adminNameEl = document.getElementById('adminName');
      const phoneEl = document.getElementById('phone');
      const nicknameEl = document.getElementById('nickname');
      const rolesEl = document.getElementById('roles');
      const statusTagEl = document.getElementById('statusTag');
      const toggleStatusBtn = document.getElementById('toggleStatusBtn');
      const invitationInfoEl = document.getElementById('invitationInfo');
      const membershipTableBody = document.getElementById('membershipTableBody');
      const grantMembershipBtn = document.getElementById('grantMembershipBtn');
      const grantModal = document.getElementById('grantModal');
      const cancelGrantBtn = document.getElementById('cancelGrantBtn');
      const confirmGrantBtn = document.getElementById('confirmGrantBtn');

      let currentUser = null;

      function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = 'message message-' + type;
        messageEl.classList.remove('hidden');
      }

      function hideMessage() {
        messageEl.classList.add('hidden');
      }

      function formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
      }

      function formatPlan(plan) {
        const plans = {
          'free': '免费',
          'monthly': '月度会员',
          'yearly': '年度会员',
          'lifetime': '永久会员'
        };
        return plans[plan] || plan;
      }

      function statusTag(status) {
        if (status === 'active') {
          return '<span class="tag tag-success">正常</span>';
        }
        return '<span class="tag tag-warn">禁用</span>';
      }

      async function loadUser() {
        try {
          currentUser = await api.getUser(userSub);

          phoneEl.textContent = currentUser.phone;
          nicknameEl.textContent = currentUser.nickname || '-';
          rolesEl.textContent = currentUser.roles ? currentUser.roles.join(', ') : 'user';
          statusTagEl.innerHTML = statusTag(currentUser.status);
          toggleStatusBtn.textContent = currentUser.status === 'active' ? '禁用' : '启用';

          // Invitation info
          if (currentUser.invitation) {
            invitationInfoEl.innerHTML =
              '<div class="data-row"><span class="data-label">邀请码</span><span class="data-value" style="font-family: monospace;">' + currentUser.invitation.code + '</span></div>' +
              '<div class="data-row"><span class="data-label">预设会员</span><span class="data-value">' + formatPlan(currentUser.invitation.preset_membership) + '</span></div>' +
              '<div class="data-row"><span class="data-label">使用时间</span><span class="data-value">' + formatDate(currentUser.invitation.used_at) + '</span></div>';
          } else {
            invitationInfoEl.innerHTML = '<div class="data-row"><span class="data-label">邀请码</span><span class="data-value">-</span></div>';
          }

          // Membership history
          if (currentUser.memberships && currentUser.memberships.length > 0) {
            membershipTableBody.innerHTML = currentUser.memberships.map(function(m) {
              return '<tr>' +
                '<td>' + formatPlan(m.plan) + '</td>' +
                '<td>' + statusTag(m.status) + '</td>' +
                '<td>' + formatDate(m.starts_at) + '</td>' +
                '<td>' + (m.plan === 'lifetime' ? '永久' : formatDate(m.expires_at)) + '</td>' +
                '<td>' + (m.source || '-') + '</td>' +
              '</tr>';
            }).join('');
          } else {
            membershipTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">暂无记录</td></tr>';
          }
        } catch (error) {
          showMessage(error.message || '加载失败', 'error');
        }
      }

      toggleStatusBtn.addEventListener('click', async function() {
        if (!currentUser) return;

        const newStatus = currentUser.status === 'active' ? 'suspended' : 'active';

        try {
          await api.updateUserStatus(userSub, newStatus);
          currentUser.status = newStatus;
          statusTagEl.innerHTML = statusTag(newStatus);
          toggleStatusBtn.textContent = newStatus === 'active' ? '禁用' : '启用';
          showMessage('状态已更新', 'success');
          setTimeout(hideMessage, 2000);
        } catch (error) {
          showMessage(error.message || '更新失败', 'error');
        }
      });

      grantMembershipBtn.addEventListener('click', function() {
        grantModal.classList.remove('hidden');
      });

      cancelGrantBtn.addEventListener('click', function() {
        grantModal.classList.add('hidden');
      });

      confirmGrantBtn.addEventListener('click', async function() {
        const plan = document.getElementById('grantPlan').value;
        const days = document.getElementById('grantDays').value;

        try {
          await api.grantMembership(userSub, plan, days ? parseInt(days, 10) : undefined);
          grantModal.classList.add('hidden');
          showMessage('会员已授予', 'success');
          setTimeout(hideMessage, 2000);
          loadUser();
        } catch (error) {
          showMessage(error.message || '授予失败', 'error');
        }
      });

      // Init
      api.ensureAdmin().then(function(authed) {
        if (authed) {
          const user = api.getUserInfo();
          adminNameEl.textContent = user?.nickname || 'admin';
          loadUser();
        }
      });
    })();
  </script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add public/admin/user-detail.html
git commit -m "feat: add admin user detail page"
```

---

## Task 10: 测试和验证

**Step 1: 启动服务**

```bash
npm run dev
```

**Step 2: 验证功能**

1. 访问 http://localhost:3000/ - 应重定向到登录页
2. 访问 http://localhost:3000/login.html - 登录页正常显示
3. 访问 http://localhost:3000/register.html - 注册页正常显示
4. 测试注册流程（使用 SMS_MOCK_MODE=true）
5. 测试登录流程
6. 测试用户信息页
7. 测试管理员页面（需要 admin 角色用户）

**Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete brand-hub-web frontend implementation"
```

---

## Summary

- 10 个任务
- 预计实现时间：约 2 小时
- 技术栈：HTML + CSS + JS，Fastify Static
- 遵循节物设计规范
