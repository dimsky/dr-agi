import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jwt from 'jsonwebtoken';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'admin-session-secret';

// 重新编译触发器

// 管理员 API 路由（需要验证）
const adminApiPaths = [
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

interface AdminTokenPayload {
  username: string;
  role: string;  
  type: string;
  iat?: number;
  exp?: number;
}

function isAdminApiPath(pathname: string): boolean {
  return adminApiPaths.some(path => pathname.startsWith(path));
}

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(path => pathname.startsWith(path));
}

function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    console.log(`[Middleware] 开始验证token: ${token.substring(0, 50)}...`);
    const decoded = jwt.verify(token, ADMIN_SESSION_SECRET) as AdminTokenPayload;
    console.log(`[Middleware] Token解码成功:`, decoded);
    
    // 验证 token 类型和角色
    if (decoded.type === 'admin-session' && decoded.role === 'admin') {
      console.log(`[Middleware] Token验证通过`);
      return decoded;
    }
    
    console.log(`[Middleware] Token类型或角色不匹配:`, { type: decoded.type, role: decoded.role });
    return null;
  } catch (error) {
    console.log(`[Middleware] Token验证失败:`, error);
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('admin-token')?.value;
  
  // 强制输出日志，确认中间件被执行
  console.log(`[Middleware] ${new Date().toISOString()} - 路径: ${pathname}`);
  console.log(`[Middleware] Token存在: ${!!token}`);
  console.log(`[Middleware] 请求方法: ${request.method}`);
  console.log(`[Middleware] 所有cookies:`, request.cookies.getAll().map(c => c.name));
  console.log(`[Middleware] ADMIN_SESSION_SECRET:`, ADMIN_SESSION_SECRET);
  console.log(`[Middleware] process.env.ADMIN_SESSION_SECRET:`, process.env.ADMIN_SESSION_SECRET);
  
  // 公开路径直接通过
  if (isPublicPath(pathname)) {
    console.log(`[Middleware] 公开路径，直接通过: ${pathname}`);
    return NextResponse.next();
  }

  // 只保护管理员 API 路径，页面路由完全由客户端组件处理
  if (isAdminApiPath(pathname)) {
    console.log(`[Middleware] API路径，需要验证: ${pathname}`);
    
    if (!token) {
      console.log(`[Middleware] API路径未找到token，返回401`);
      return NextResponse.json(
        { success: false, message: '未找到管理员会话', authenticated: false },
        { status: 401 }
      );
    }

    const adminPayload = verifyAdminToken(token);

    console.log("adminpayload", adminPayload)
    
    if (!adminPayload) {
      console.log(`[Middleware] API路径token无效，返回401`);
      return NextResponse.json(
        { success: false, message: '无效的管理员会话111', authenticated: false },
        { status: 401 }
      );
    }

    console.log(`[Middleware] API路径验证通过: ${pathname}`);
    
    // 创建新的请求，添加用户信息到headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', adminPayload.username);
    requestHeaders.set('x-user-role', adminPayload.role);
    
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    
    return response;
  }

  // 所有页面路由都直接通过，让 AdminAuthGuard 组件处理认证
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