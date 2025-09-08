import { NextResponse } from 'next/server';

/**
 * 全局错误处理中间件
 * 提供统一的错误格式、状态码、日志记录和敏感信息过滤
 */

// 错误类型枚举
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  NETWORK = 'NETWORK_ERROR',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC_ERROR',
  INTERNAL = 'INTERNAL_SERVER_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  FILE_UPLOAD = 'FILE_UPLOAD_ERROR',
}

// 标准错误响应接口
export interface ErrorResponse {
  success: false;
  error: {
    type: ErrorType;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId?: string;
}

// 自定义错误类
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // 设置错误名称
    this.name = type;

    // 确保堆栈跟踪正确
    Error.captureStackTrace(this, this.constructor);
  }
}

// 环境变量
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// 敏感信息字段列表
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'credentials',
  'apiKey',
  'accessToken',
  'refreshToken',
  'wechatSecret',
  'difyToken',
  'supabaseKey',
];

/**
 * 过滤敏感信息
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 记录错误日志
 */
function logError(error: AppError | Error, context?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const sanitizedContext = context ? sanitizeObject(context) : {};

  // 基础日志信息
  const logData = {
    timestamp,
    error: {
      name: error.name,
      message: error.message,
      stack: IS_PRODUCTION ? undefined : error.stack,
      ...(error instanceof AppError && {
        type: error.type,
        statusCode: error.statusCode,
        code: error.code,
        details: error.details ? sanitizeObject(error.details) : undefined,
        isOperational: error.isOperational,
      }),
    },
    context: sanitizedContext,
    environment: NODE_ENV,
  };

  // 根据错误类型选择日志级别
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      console.error('🚨 [ERROR]', JSON.stringify(logData, null, 2));
    } else if (error.statusCode >= 400) {
      console.warn('⚠️ [WARN]', JSON.stringify(logData, null, 2));
    } else {
      console.info('ℹ️ [INFO]', JSON.stringify(logData, null, 2));
    }
  } else {
    console.error('🚨 [ERROR]', JSON.stringify(logData, null, 2));
  }

  // TODO: 在生产环境中，可以将日志发送到外部服务
  // 例如：Sentry, LogRocket, DataDog 等
  if (IS_PRODUCTION) {
    // await sendToExternalLoggingService(logData);
  }
}

/**
 * 根据错误类型确定HTTP状态码
 */
function getStatusCodeForError(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }

  // 特定错误类型的状态码映射
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('not found') || errorMessage.includes('找不到')) {
    return 404;
  }
  
  if (errorMessage.includes('unauthorized') || errorMessage.includes('认证') || errorMessage.includes('登录')) {
    return 401;
  }
  
  if (errorMessage.includes('forbidden') || errorMessage.includes('权限')) {
    return 403;
  }
  
  if (errorMessage.includes('conflict') || errorMessage.includes('已存在') || errorMessage.includes('冲突')) {
    return 409;
  }
  
  if (errorMessage.includes('validation') || errorMessage.includes('验证') || errorMessage.includes('格式')) {
    return 400;
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('限流') || errorMessage.includes('频率')) {
    return 429;
  }

  if (errorMessage.includes('file') || errorMessage.includes('upload') || errorMessage.includes('文件')) {
    return 400;
  }

  // 数据库错误
  if (errorMessage.includes('database') || errorMessage.includes('连接') || errorMessage.includes('查询')) {
    return 503;
  }

  // 外部服务错误
  if (errorMessage.includes('wechat') || errorMessage.includes('dify') || errorMessage.includes('微信')) {
    return 502;
  }

  // 默认为服务器内部错误
  return 500;
}

/**
 * 根据错误确定错误类型
 */
function getErrorType(error: Error): ErrorType {
  if (error instanceof AppError) {
    return error.type;
  }

  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('validation') || errorMessage.includes('验证') || errorMessage.includes('格式')) {
    return ErrorType.VALIDATION;
  }

  if (errorMessage.includes('unauthorized') || errorMessage.includes('认证') || errorMessage.includes('登录')) {
    return ErrorType.AUTHENTICATION;
  }

  if (errorMessage.includes('forbidden') || errorMessage.includes('权限')) {
    return ErrorType.AUTHORIZATION;
  }

  if (errorMessage.includes('not found') || errorMessage.includes('找不到')) {
    return ErrorType.NOT_FOUND;
  }

  if (errorMessage.includes('conflict') || errorMessage.includes('已存在') || errorMessage.includes('冲突')) {
    return ErrorType.CONFLICT;
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('限流') || errorMessage.includes('频率')) {
    return ErrorType.RATE_LIMIT;
  }

  if (errorMessage.includes('file') || errorMessage.includes('upload') || errorMessage.includes('文件')) {
    return ErrorType.FILE_UPLOAD;
  }

  if (errorMessage.includes('database') || errorMessage.includes('连接') || errorMessage.includes('查询')) {
    return ErrorType.DATABASE;
  }

  if (errorMessage.includes('wechat') || errorMessage.includes('dify') || errorMessage.includes('微信')) {
    return ErrorType.EXTERNAL_SERVICE;
  }

  if (errorMessage.includes('network') || errorMessage.includes('网络') || errorMessage.includes('timeout')) {
    return ErrorType.NETWORK;
  }

  return ErrorType.INTERNAL;
}

/**
 * 生成用户友好的错误消息
 */
function getUserFriendlyMessage(error: Error, type: ErrorType): string {
  if (error instanceof AppError) {
    return error.message;
  }

  // 生产环境下提供用户友好的消息
  if (IS_PRODUCTION) {
    switch (type) {
      case ErrorType.VALIDATION:
        return '输入数据格式不正确，请检查后重试';
      case ErrorType.AUTHENTICATION:
        return '登录已过期，请重新登录';
      case ErrorType.AUTHORIZATION:
        return '您没有权限执行此操作';
      case ErrorType.NOT_FOUND:
        return '请求的资源不存在';
      case ErrorType.CONFLICT:
        return '操作冲突，请刷新页面后重试';
      case ErrorType.RATE_LIMIT:
        return '请求过于频繁，请稍后再试';
      case ErrorType.FILE_UPLOAD:
        return '文件上传失败，请检查文件格式和大小';
      case ErrorType.DATABASE:
        return '数据库服务暂时不可用，请稍后重试';
      case ErrorType.EXTERNAL_SERVICE:
        return '外部服务暂时不可用，请稍后重试';
      case ErrorType.NETWORK:
        return '网络连接异常，请检查网络后重试';
      case ErrorType.BUSINESS_LOGIC:
        return '业务逻辑错误，请联系管理员';
      case ErrorType.INTERNAL:
      default:
        return '服务器内部错误，请稍后重试';
    }
  }

  // 开发环境返回原始错误消息
  return error.message;
}

/**
 * 生成请求ID（用于错误追踪）
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 主要的错误处理函数
 * @param error - 捕获的错误
 * @param context - 额外的上下文信息
 * @returns NextResponse 错误响应
 */
export function handleError(error: unknown, context?: Record<string, unknown>): NextResponse<ErrorResponse> {
  let appError: AppError;

  // 转换为 AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    const type = getErrorType(error);
    const statusCode = getStatusCodeForError(error);
    appError = new AppError(type, error.message, statusCode);
  } else {
    // 处理非Error对象
    appError = new AppError(
      ErrorType.INTERNAL,
      typeof error === 'string' ? error : '未知错误',
      500
    );
  }

  // 记录错误日志
  logError(appError, context);

  // 生成请求ID
  const requestId = generateRequestId();

  // 构建错误响应
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      type: appError.type,
      message: getUserFriendlyMessage(appError, appError.type),
      code: appError.code,
      details: IS_PRODUCTION ? undefined : sanitizeObject(appError.details) as Record<string, unknown> | undefined,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  return NextResponse.json(errorResponse, { 
    status: appError.statusCode,
    headers: {
      'X-Request-ID': requestId,
    },
  });
}

/**
 * 异步错误处理包装器
 * 用于包装API路由处理函数，自动捕获和处理错误
 * 
 * @example
 * export const POST = withErrorHandler(async (request: NextRequest) => {
 *   // 你的API逻辑
 *   return NextResponse.json({ success: true });
 * });
 */
export function withErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<NextResponse<R> | Response>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const result = await handler(...args);
      return result as NextResponse;
    } catch (error) {
      return handleError(error, {
        handler: handler.name,
        args: sanitizeObject(args),
      });
    }
  };
}

/**
 * 创建特定类型的错误
 */
export const createError = {
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorType.VALIDATION, message, 400, 'VALIDATION_FAILED', details),

  authentication: (message: string = '认证失败') =>
    new AppError(ErrorType.AUTHENTICATION, message, 401, 'AUTH_FAILED'),

  authorization: (message: string = '权限不足') =>
    new AppError(ErrorType.AUTHORIZATION, message, 403, 'ACCESS_DENIED'),

  notFound: (resource: string = '资源') =>
    new AppError(ErrorType.NOT_FOUND, `${resource}不存在`, 404, 'NOT_FOUND'),

  conflict: (message: string) =>
    new AppError(ErrorType.CONFLICT, message, 409, 'CONFLICT'),

  rateLimit: (message: string = '请求过于频繁') =>
    new AppError(ErrorType.RATE_LIMIT, message, 429, 'RATE_LIMITED'),

  externalService: (service: string, message?: string) =>
    new AppError(
      ErrorType.EXTERNAL_SERVICE,
      message || `${service}服务不可用`,
      502,
      'EXTERNAL_SERVICE_ERROR'
    ),

  database: (message: string = '数据库操作失败') =>
    new AppError(ErrorType.DATABASE, message, 503, 'DATABASE_ERROR'),

  fileUpload: (message: string = '文件上传失败') =>
    new AppError(ErrorType.FILE_UPLOAD, message, 400, 'FILE_UPLOAD_ERROR'),

  businessLogic: (message: string) =>
    new AppError(ErrorType.BUSINESS_LOGIC, message, 400, 'BUSINESS_ERROR'),

  internal: (message: string = '服务器内部错误') =>
    new AppError(ErrorType.INTERNAL, message, 500, 'INTERNAL_ERROR'),
};

/**
 * 错误状态检查工具
 */
export const isError = {
  operational: (error: unknown): error is AppError =>
    error instanceof AppError && error.isOperational,

  client: (error: unknown): boolean =>
    error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500,

  server: (error: unknown): boolean =>
    error instanceof AppError && error.statusCode >= 500,

  type: (error: unknown, type: ErrorType): error is AppError =>
    error instanceof AppError && error.type === type,
};

// 导出常用工具
export { ErrorType as ERROR_TYPE };