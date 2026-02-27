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
    // 清除 cookie
    document.cookie = 'brand_hub_token=; path=/; max-age=0';
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
      // 如果请求携带了 token 但返回 401，说明 token 过期/失效，跳转到 401 页面
      if (response.status === 401 && token) {
        this.clearTokens();
        window.location.href = '401.html';
        throw new Error('Unauthorized');
      }
      const errorMsg = data.error?.message || data.message || 'Request failed';
      const error = new Error(errorMsg);
      error.code = data.error?.code || data.code;
      error.status = response.status;
      throw error;
    }

    return data;
  },

  // Auth APIs
  async verifyInviteCode(invite_code) {
    return this.request('auth/invite/verify', {
      method: 'POST',
      body: JSON.stringify({ invite_code }),
    });
  },

  async sendSmsCode(phone, scene, invite_token) {
    const body = { phone, scene };
    if (invite_token) {
      body.invite_token = invite_token;
    }
    return this.request('auth/sms/send', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async register(phone, code, invite_token, nickname) {
    const data = await this.request('auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, code, invite_token, nickname }),
    });
    this.setTokensFromResponse(data);
    // Clear invite token after successful registration
    sessionStorage.removeItem('invite_token');
    sessionStorage.removeItem('invite_code');
    sessionStorage.removeItem('preset_membership');
    return data;
  },

  async login(phone, code) {
    const data = await this.request('auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    this.setTokensFromResponse(data);
    return data;
  },

  async loginPassword(phone, password) {
    const data = await this.request('auth/login-password', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    this.setTokensFromResponse(data);
    return data;
  },

  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const data = await this.request('auth/refresh', {
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
        await this.request('auth/logout', {
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
    // 写入 cookie 供同源下的其他应用（如 eat-healthy）读取
    if (data.access_token) {
      const maxAge = 30 * 24 * 60 * 60; // 30 days
      document.cookie = `brand_hub_token=${data.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  },

  // User APIs
  async getMe() {
    return this.request('users/me');
  },

  async updateMe(nickname) {
    return this.request('users/me', {
      method: 'PATCH',
      body: JSON.stringify({ nickname }),
    });
  },

  // Admin APIs
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`../admin/users?${query}`);
  },

  async getUser(sub) {
    return this.request(`../admin/users/${sub}`);
  },

  async updateUserStatus(sub, status) {
    return this.request(`../admin/users/${sub}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async grantMembership(sub, plan, duration_days) {
    return this.request(`../admin/users/${sub}/membership`, {
      method: 'POST',
      body: JSON.stringify({ plan, duration_days }),
    });
  },

  async getInvitations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`../admin/invitations?${query}`);
  },

  async createInvitations(data) {
    return this.request('../admin/invitations/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Auth guard
  async ensureAuth() {
    const token = this.getRefreshToken();
    if (!token) {
      window.location.href = '401.html';
      return false;
    }

    if (!this.getAccessToken()) {
      try {
        await this.refreshAccessToken();
      } catch (e) {
        this.clearTokens();
        window.location.href = '401.html';
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
      window.location.href = 'profile.html';
      return false;
    }

    return true;
  },
};

// Export for ES modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
