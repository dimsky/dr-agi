import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateMiddlewareRequest } from '@/lib/auth-utils';

// 需要身份验证的 API 路由
const authApiPaths = [
  '/api/users',
  '/api/orders', 
  '/api/tasks',
  '/api/services',
  '/api/feedback',
];

// 公开路径（无需身份验证）
const publicPaths = [
  '/admin/login',
  '/api/admin/login',
  '/api/admin/auth',
  '/api/health',
  '/api/test-db',
  '/api/auth/wechat',
  '/api/auth/verify',
];

function isAuthApiPath(pathname: string): boolean {
  return authApiPaths.some(path => pathname.startsWith(path));
}

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(path => pathname.startsWith(path));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 强制输出日志，确认中间件被执行
  console.log(`[Middleware] ${new Date().toISOString()} - 路径: ${pathname}`);
  console.log(`[Middleware] 请求方法: ${request.method}`);
  
  // 公开路径直接通过
  if (isPublicPath(pathname)) {
    console.log(`[Middleware] 公开路径，直接通过: ${pathname}`);
    return NextResponse.next();
  }

  // 只保护需要身份验证的 API 路径，页面路由完全由客户端组件处理
  if (isAuthApiPath(pathname)) {
    console.log(`[Middleware] API路径，需要验证: ${pathname}`);
    
    // 使用 auth-utils 进行认证
    const authResult = authenticateMiddlewareRequest(request);
    
    if (!authResult.user) {
      console.log(`[Middleware] 认证失败: ${authResult.error}`);
      return NextResponse.json(
        { 
          success: false, 
          message: authResult.error || '未提供认证信息', 
          authenticated: false 
        },
        { status: 401 }
      );
    }

    const { user } = authResult;
    console.log(`[Middleware] 认证成功:`, { 
      id: user.id, 
      role: user.role, 
      openId: user.openId 
    });

    console.log(`[Middleware] API路径验证通过: ${pathname}`);
    
    // 创建新的请求，添加用户信息到headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-role', user.role);
    
    if (user.openId) {
      requestHeaders.set('x-user-openid', user.openId);
    }
    
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    
    return response;
  }

  // 所有页面路由都直接通过，让客户端组件处理认证
  console.log(`[Middleware] 页面路由，直接通过: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，包括 API 路由
     * 但排除静态资源
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
  runtime: 'nodejs'
};