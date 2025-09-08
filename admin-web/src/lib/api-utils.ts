/**
 * API响应构建工具
 * 
 * 提供标准化的API响应构建函数，确保响应格式一致
 */

import { NextResponse } from 'next/server';

/**
 * 标准成功响应构建器
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  options?: {
    statusCode?: number;
    headers?: HeadersInit;
    requestId?: string;
  }
) {
  return NextResponse.json(
    {
      success: true as const,
      message,
      data,
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    },
    {
      status: options?.statusCode || 200,
      headers: options?.headers,
    }
  );
}

/**
 * 分页响应构建器
 */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string,
  options?: {
    headers?: HeadersInit;
    requestId?: string;
  }
) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  return NextResponse.json(
    {
      success: true as const,
      message: message || '查询成功',
      data: {
        items,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
        },
      },
      timestamp: new Date().toISOString(),
      requestId: options?.requestId,
    },
    {
      status: 200,
      headers: options?.headers,
    }
  );
}

/**
 * 创建响应构建器
 */
export function createApiResponseBuilder(requestId?: string) {
  return {
    /**
     * 成功响应
     */
    success<T>(data?: T, message?: string, statusCode: number = 200) {
      return createSuccessResponse(data, message, { statusCode, requestId });
    },

    /**
     * 创建响应（通常用于POST请求）
     */
    created<T>(data: T, message: string = '创建成功') {
      return createSuccessResponse(data, message, { statusCode: 201, requestId });
    },

    /**
     * 接受响应（通常用于异步操作）
     */
    accepted<T>(message: string = '请求已接受', data?: T) {
      return createSuccessResponse(data, message, { statusCode: 202, requestId });
    },

    /**
     * 无内容响应（通常用于DELETE请求）
     */
    noContent() {
      return new NextResponse(null, { 
        status: 204,
        headers: requestId ? { 'X-Request-ID': requestId } : undefined,
      });
    },

    /**
     * 分页响应
     */
    paginated<T>(
      items: T[],
      pagination: { page: number; limit: number; total: number },
      message?: string
    ) {
      return createPaginatedResponse(items, pagination, message, { requestId });
    },

    /**
     * 批量操作响应
     */
    batch(results: {
      successful: number;
      failed: number;
      errors?: Array<{ id: string; error: string }>;
    }) {
      return createSuccessResponse(
        results,
        `批量操作完成：成功 ${results.successful} 个，失败 ${results.failed} 个`,
        { requestId }
      );
    },
  };
}

/**
 * 请求参数解析工具
 */
export class RequestParser {
  private searchParams: URLSearchParams;
  private body: unknown;

  constructor(private request: Request) {
    const url = new URL(request.url);
    this.searchParams = url.searchParams;
  }

  /**
   * 异步初始化（解析请求体）
   */
  static async create(request: Request): Promise<RequestParser> {
    const parser = new RequestParser(request);
    
    // 只有在有请求体时才解析
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      try {
        parser.body = await request.json();
      } catch {
        parser.body = null;
      }
    }
    
    return parser;
  }

  /**
   * 获取分页参数
   */
  getPagination(defaultLimit: number = 10, maxLimit: number = 100) {
    const page = Math.max(1, parseInt(this.searchParams.get('page') || '1', 10));
    const limit = Math.min(
      maxLimit,
      Math.max(1, parseInt(this.searchParams.get('limit') || defaultLimit.toString(), 10))
    );
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * 获取排序参数
   */
  getSort(allowedFields: string[], defaultSort?: string) {
    const sortBy = this.searchParams.get('sortBy') || defaultSort;
    const sortOrder = this.searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    // 验证排序字段
    if (sortBy && !allowedFields.includes(sortBy)) {
      throw new Error(`无效的排序字段: ${sortBy}`);
    }

    return { sortBy, sortOrder };
  }

  /**
   * 获取过滤参数
   */
  getFilters(allowedFilters: string[]) {
    const filters: Record<string, string> = {};

    for (const field of allowedFilters) {
      const value = this.searchParams.get(field);
      if (value !== null) {
        filters[field] = value;
      }
    }

    return filters;
  }

  /**
   * 获取搜索参数
   */
  getSearch() {
    return {
      query: this.searchParams.get('q') || this.searchParams.get('query') || undefined,
      searchFields: this.searchParams.get('searchFields')?.split(',') || undefined,
    };
  }

  /**
   * 获取日期范围参数
   */
  getDateRange(startParam: string = 'startDate', endParam: string = 'endDate') {
    const start = this.searchParams.get(startParam);
    const end = this.searchParams.get(endParam);

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (start) {
      startDate = new Date(start);
      if (isNaN(startDate.getTime())) {
        throw new Error(`无效的开始日期: ${start}`);
      }
    }

    if (end) {
      endDate = new Date(end);
      if (isNaN(endDate.getTime())) {
        throw new Error(`无效的结束日期: ${end}`);
      }
    }

    return { startDate, endDate };
  }

  /**
   * 获取请求体数据
   */
  getBody<T = unknown>(): T | null {
    return this.body as T | null;
  }

  /**
   * 获取单个查询参数
   */
  getParam(name: string): string | null {
    return this.searchParams.get(name);
  }

  /**
   * 获取必需的查询参数
   */
  getRequiredParam(name: string): string {
    const value = this.searchParams.get(name);
    if (!value) {
      throw new Error(`缺少必需的参数: ${name}`);
    }
    return value;
  }

  /**
   * 获取数字参数
   */
  getNumberParam(name: string, defaultValue?: number): number | undefined {
    const value = this.searchParams.get(name);
    if (!value) return defaultValue;

    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`参数 ${name} 必须是数字: ${value}`);
    }

    return num;
  }

  /**
   * 获取布尔参数
   */
  getBooleanParam(name: string, defaultValue?: boolean): boolean | undefined {
    const value = this.searchParams.get(name);
    if (!value) return defaultValue;

    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;

    throw new Error(`参数 ${name} 必须是布尔值: ${value}`);
  }

  /**
   * 获取数组参数
   */
  getArrayParam(name: string, separator: string = ','): string[] | undefined {
    const value = this.searchParams.get(name);
    if (!value) return undefined;

    return value.split(separator).map(item => item.trim()).filter(Boolean);
  }

  /**
   * 获取枚举参数
   */
  getEnumParam<T extends string>(
    name: string, 
    allowedValues: readonly T[], 
    defaultValue?: T
  ): T | undefined {
    const value = this.searchParams.get(name) as T;
    if (!value) return defaultValue;

    if (!allowedValues.includes(value)) {
      throw new Error(`参数 ${name} 的值必须是以下之一: ${allowedValues.join(', ')}`);
    }

    return value;
  }
}

/**
 * 响应头工具
 */
export const ResponseHeaders = {
  /**
   * 创建缓存头
   */
  cache(maxAge: number, staleWhileRevalidate?: number): HeadersInit {
    const cacheControl = [`max-age=${maxAge}`];
    
    if (staleWhileRevalidate) {
      cacheControl.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    return {
      'Cache-Control': cacheControl.join(', '),
    };
  },

  /**
   * 创建CORS头
   */
  cors(origin?: string): HeadersInit {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    };
  },

  /**
   * 创建安全头
   */
  security(): HeadersInit {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  },

  /**
   * 创建分页头
   */
  pagination(pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }): HeadersInit {
    return {
      'X-Pagination-Page': pagination.page.toString(),
      'X-Pagination-Limit': pagination.limit.toString(),
      'X-Pagination-Total': pagination.total.toString(),
      'X-Pagination-Total-Pages': pagination.totalPages.toString(),
    };
  },

  /**
   * 合并多个头部配置
   */
  merge(...headers: HeadersInit[]): HeadersInit {
    const result: Record<string, string> = {};
    
    for (const header of headers) {
      if (header instanceof Headers) {
        header.forEach((value, key) => {
          result[key] = value;
        });
      } else if (Array.isArray(header)) {
        for (const [key, value] of header) {
          result[key] = value;
        }
      } else {
        Object.assign(result, header);
      }
    }

    return result;
  },
};

/**
 * API版本控制工具
 */
export function withApiVersion(version: string) {
  return {
    success: <T>(data?: T, message?: string) => {
      return NextResponse.json(
        {
          success: true,
          message,
          data,
          timestamp: new Date().toISOString(),
          version,
        },
        {
          headers: {
            'API-Version': version,
          },
        }
      );
    },
  };
}