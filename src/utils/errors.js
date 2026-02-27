/**
 * Error handling utilities
 */

/**
 * Application error codes
 */
const ErrorCodes = {
  // 400
  INVALID_PARAMS: { code: 'INVALID_PARAMS', message: '参数校验失败', status: 400 },
  SMS_CODE_INCORRECT: { code: 'SMS_CODE_INCORRECT', message: '验证码错误', status: 400 },
  SMS_CODE_EXPIRED: { code: 'SMS_CODE_EXPIRED', message: '验证码过期或未发送', status: 400 },
  SMS_CODE_MAX_ATTEMPTS: { code: 'SMS_CODE_MAX_ATTEMPTS', message: '验证码错误次数超限', status: 400 },
  LIFETIME_CANNOT_CANCEL: { code: 'LIFETIME_CANNOT_CANCEL', message: '终身会员不可取消', status: 400 },
  INVALID_SCENE: { code: 'INVALID_SCENE', message: '场景参数缺失或非法', status: 400 },

  // 401
  PHONE_NOT_REGISTERED: { code: 'PHONE_NOT_REGISTERED', message: '手机号未注册', status: 401 },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', message: 'Access Token 过期', status: 401 },
  TOKEN_REVOKED: { code: 'TOKEN_REVOKED', message: 'Refresh Token 已撤销', status: 401 },
  TOKEN_INVALID: { code: 'TOKEN_INVALID', message: 'Token 无效', status: 401 },

  // 403
  INSUFFICIENT_ROLE: { code: 'INSUFFICIENT_ROLE', message: '权限不足', status: 403 },
  MEMBERSHIP_REQUIRED: { code: 'MEMBERSHIP_REQUIRED', message: '需要会员权限', status: 403 },

  // 404
  NOT_FOUND: { code: 'NOT_FOUND', message: '资源不存在', status: 404 },

  // 409
  PHONE_EXISTS: { code: 'PHONE_EXISTS', message: '手机号已注册', status: 409 },
  ACTIVE_MEMBERSHIP_EXISTS: { code: 'ACTIVE_MEMBERSHIP_EXISTS', message: '已有活跃会员', status: 409 },

  // 422
  INVITE_CODE_INVALID: { code: 'INVITE_CODE_INVALID', message: '邀请码不存在', status: 422 },
  INVITE_CODE_USED: { code: 'INVITE_CODE_USED', message: '邀请码已使用', status: 422 },
  INVITE_CODE_EXPIRED: { code: 'INVITE_CODE_EXPIRED', message: '邀请码已过期', status: 422 },

  // 423
  ACCOUNT_SUSPENDED: { code: 'ACCOUNT_SUSPENDED', message: '账号已暂停', status: 423 },

  // 429
  SMS_COOLDOWN: { code: 'SMS_COOLDOWN', message: '60 秒冷却中', status: 429 },
  SMS_DAILY_LIMIT: { code: 'SMS_DAILY_LIMIT', message: '今日发送上限', status: 429 },
  SMS_IP_LIMIT: { code: 'SMS_IP_LIMIT', message: 'IP 发送频率超限', status: 429 },
  RATE_LIMITED: { code: 'RATE_LIMITED', message: '请求过于频繁', status: 429 },

  // Invite token errors
  INVITE_TOKEN_INVALID: { code: 'INVITE_TOKEN_INVALID', message: '邀请凭证无效或已过期', status: 400 },
};

/**
 * Application error class
 */
class AppError extends Error {
  constructor(errorCode, details = null) {
    super(errorCode.message);
    this.name = 'AppError';
    this.code = errorCode.code;
    this.status = errorCode.status;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Create application error
 */
function createError(code, details = null) {
  return new AppError(code, details);
}

/**
 * Error handler for Fastify
 */
function errorHandler(error, request, reply) {
  // Log error
  request.log.error({
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
  });

  // Handle AppError
  if (error instanceof AppError) {
    return reply.status(error.status).send(error.toJSON());
  }

  // Handle validation errors from Fastify
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'INVALID_PARAMS',
        message: '参数校验失败',
        details: error.validation,
      },
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return reply.status(401).send({
      error: {
        code: 'TOKEN_INVALID',
        message: 'Token 无效',
      },
    });
  }

  if (error.name === 'TokenExpiredError') {
    return reply.status(401).send({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Access Token 过期',
      },
    });
  }

  // Generic error
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
  });
}

module.exports = {
  ErrorCodes,
  AppError,
  createError,
  errorHandler,
};