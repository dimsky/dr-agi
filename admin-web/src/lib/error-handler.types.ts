/**
 * 错误处理类型声明文件
 * 
 * 为错误处理中间件提供完整的TypeScript类型支持
 */

import { NextRequest, NextResponse } from 'next/server';
import { ErrorType, AppError } from './error-handler';

/**
 * API响应的基础结构
 */
export interface BaseApiResponse {
  success: boolean;
  timestamp: string;
  requestId?: string;
}

/**
 * 成功响应结构
 */
export interface SuccessResponse<T = unknown> extends BaseApiResponse {
  success: true;
  data?: T;
  message?: string;
}

/**
 * 错误响应结构
 */
export interface ErrorResponse extends BaseApiResponse {
  success: false;
  error: {
    type: ErrorType;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 统一的API响应类型
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * API路由处理函数类型
 */
export type RouteHandler<T = unknown> = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse<T>>;

/**
 * 错误处理上下文
 */
export interface ErrorContext {
  endpoint?: string;
  method?: string;
  url?: string;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * 扩展Next.js请求对象
 */
declare module 'next/server' {
  interface NextRequest {
    // 用户上下文（通过认证中间件注入）
    user?: {
      id: string;
      role: string;
      permissions: string[];
    };
    
    // 请求ID（用于追踪）
    requestId?: string;
    
    // 设备信息
    device?: {
      type: string;
      os: string;
      browser: string;
    };
  }
}

/**
 * 错误处理钩子类型
 */
export type ErrorHandlerHook = (error: AppError, context: ErrorContext) => void | Promise<void>;

/**
 * 日志服务接口
 */
export interface LoggingService {
  log(entry: {
    timestamp: string;
    level: string;
    error: Record<string, unknown>;
    context: ErrorContext;
    environment: string;
  }): void | Promise<void>;
  flush?(): void | Promise<void>;
}

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  hooks?: {
    beforeLog?: ErrorHandlerHook;
    afterLog?: ErrorHandlerHook;
    beforeResponse?: ErrorHandlerHook;
  };
  loggingService?: LoggingService;
}

/**
 * 通用API响应工具类型
 */
export type ApiResponseBuilder = {
  success: <T>(data?: T, message?: string) => SuccessResponse<T>;
  error: (type: ErrorType, message: string, code?: string, details?: unknown) => ErrorResponse;
  paginated: <T>(data: T[], pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }) => SuccessResponse<{
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
};

export {};