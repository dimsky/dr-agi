import { NextRequest, NextResponse } from 'next/server';
import { getWeChatAuthService } from '@/services/wechat-auth';

// 定义需要保护的路由
const PROTECTED_ROUTES = [
  '/api/users',
  '/api/orders',
  '/api/tasks',
  '/api/feedback',
  '/api/services',
  '/api/profile',
  '/api/upload',
  '/api/dify/execute',
];

// 定义需要管理员权限的路由
const ADMIN_ROUTES = [
  '/api/admin',
  '/api/users/admin',
  '/api/orders/admin',
  '/api/tasks/admin',
];

// 定义公开路由（不需要认证）
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/auth/wechat',
  '/api/auth/verify',
];

/**
 * 检查路由是否需要认证
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * 检查路由是否需要管理员权限
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * 检查路由是否为公开路由
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * 设置CORS头
 */
function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24小时

  // 在生产环境中，应该根据请求的Origin设置具体的允许来源
  // 允许的来源：微信小程序(https://servicewechat.com)、开发环境等
  response.headers.set('Access-Control-Allow-Origin', '*');

  return response;
}

/**
 * Next.js 认证中间件
 * 保护需要认证的API路由，验证JWT token
 */
export async function middleware(request: NextRequest) {

  console.log("-------------------------------------src------------hahah")
  const { pathname } = request.nextUrl;

  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    return setCorsHeaders(response);
  }

  // 公开路由直接通过
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    return setCorsHeaders(response);
  }

  // 检查是否为需要保护的路由
  if (!isProtectedRoute(pathname) && !isAdminRoute(pathname)) {
    const response = NextResponse.next();
    return setCorsHeaders(response);
  }

  try {
    // 获取认证token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : request.cookies.get('auth_token')?.value;

    if (!token) {
      console.log('❌ 认证中间件: 缺少认证token', { pathname });
      const response = NextResponse.json(
        { error: '未授权访问，请先登录' },
        { status: 401 }
      );
      return setCorsHeaders(response);
    }

    // 验证token
    const authService = getWeChatAuthService();
    const payload = authService.verifyToken(token);

    if (!payload || !payload.userId) {
      console.log('❌ 认证中间件: Token验证失败', { pathname });
      const response = NextResponse.json(
        { error: 'Token无效，请重新登录' },
        { status: 401 }
      );
      return setCorsHeaders(response);
    }

    // 根据userId获取用户信息
    const user = await authService.getUserById(payload.userId);
    
    console.log("user, ", user)
    if (!user) {
      console.log('❌ 认证中间件: 用户不存在', { pathname, userId: payload.userId });
      const response = NextResponse.json(
        { error: '用户不存在，请重新登录' },
        { status: 401 }
      );
      return setCorsHeaders(response);
    }

    // 检查管理员权限
    if (isAdminRoute(pathname)) {
      // 这里可以添加管理员权限检查逻辑
      // 目前假设所有认证用户都有管理员权限（根据实际需求调整）
      console.log('🔐 管理员路由访问:', { pathname, userId: user.id });
    }

    // 将用户信息传递给API路由
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id);
    requestHeaders.set('x-user-openid', user.openId);
    requestHeaders.set('x-user-nickname', user.nickname || '');

    console.log('✅ 认证中间件: 验证通过', { 
      pathname, 
      userId: user.id, 
      nickname: user.nickname 
    });

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    return setCorsHeaders(response);

  } catch (error) {
    console.error('❌ 认证中间件错误:', error);

    // 检查是否为token过期错误
    if (error instanceof Error && error.message.includes('过期')) {
      try {
        // 尝试刷新token
        const authService = getWeChatAuthService();
        const authHeader = request.headers.get('authorization');
        const oldToken = authHeader?.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : request.cookies.get('auth_token')?.value;

        if (oldToken) {
          const newToken = await authService.refreshToken(oldToken);
          
          if (newToken) {
            console.log('🔄 Token刷新成功');
            
            // 设置新token到响应头
            const response = NextResponse.next();
            response.headers.set('x-new-token', newToken);
            return setCorsHeaders(response);
          }
        }
      } catch (refreshError) {
        console.error('❌ Token刷新失败:', refreshError);
      }

      const response = NextResponse.json(
        { error: 'Token已过期，请重新登录', expired: true },
        { status: 401 }
      );
      return setCorsHeaders(response);
    }

    // 其他认证错误
    const response = NextResponse.json(
      { error: '认证失败，请重新登录' },
      { status: 401 }
    );
    return setCorsHeaders(response);
  }
}

/**
 * 配置中间件匹配的路径
 * 只对API路由生效，静态资源和页面路由不处理
 */
export const config = {
  matcher: [
    /*
     * 匹配所有API路由:
     * - /api/* (所有API路由)
     * 排除:
     * - /_next/* (Next.js内部路由)
     * - /favicon.ico (favicon)
     * - /static/* (静态资源)
     */
    '/api/(.*)',
  ],
};