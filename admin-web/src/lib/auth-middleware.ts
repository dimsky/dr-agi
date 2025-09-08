import { NextRequest, NextResponse } from 'next/server';
import { 
  authenticateRequest, 
  checkPermission,
  createAuthError,
  createPermissionError,
  isAdmin
} from '@/lib/auth-utils';
import { AuthOptions, AuthenticatedUser } from '@/types/auth';

/**
 * API 路由的认证和权限验证中间件
 */
export function withAuth(options: AuthOptions = {}) {
  return function middleware(
    handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>
  ) {
    return async function(request: NextRequest): Promise<NextResponse> {
      try {
        // 1. 认证用户
        const user = authenticateRequest(request);
        
        if (!user) {
          return NextResponse.json(
            createAuthError('未提供有效的认证信息'),
            { status: 401 }
          );
        }

        // 2. 权限验证
        const permissionCheck = checkPermission(user, options);
        
        if (!permissionCheck.hasPermission) {
          return NextResponse.json(
            createPermissionError(permissionCheck.reason),
            { status: 403 }
          );
        }

        // 3. 执行原始处理程序
        return await handler(request, user);
        
      } catch (error) {
        console.error('认证中间件错误:', error);
        return NextResponse.json(
          createAuthError('认证处理异常'),
          { status: 500 }
        );
      }
    };
  };
}

/**
 * 需要管理员权限的中间件
 */
export function withAdminAuth() {
  return withAuth({ requiredRole: 'admin' });
}

/**
 * 需要用户权限的中间件（允许操作自己的资源）
 */
export function withUserAuth(resourceOwnerId?: string) {
  return withAuth({
    allowSelf: true,
    resourceOwnerId,
  });
}

/**
 * 资源所有者或管理员权限的中间件
 * 用于需要用户操作自己资源或管理员操作的场景
 */
export function withResourceOwnerAuth(getResourceOwnerId: (request: NextRequest) => Promise<string | null>) {
  return function middleware(
    handler: (request: NextRequest, user: AuthenticatedUser, resourceOwnerId?: string) => Promise<NextResponse>
  ) {
    return async function(request: NextRequest): Promise<NextResponse> {
      try {
        // 1. 认证用户
        const user = authenticateRequest(request);
        
        if (!user) {
          return NextResponse.json(
            createAuthError('未提供有效的认证信息'),
            { status: 401 }
          );
        }

        // 2. 获取资源所有者ID
        const resourceOwnerId = await getResourceOwnerId(request);
        
        // 3. 权限验证 - 管理员或资源所有者
        if (!isAdmin(user) && resourceOwnerId && user.id !== resourceOwnerId) {
          return NextResponse.json(
            createPermissionError('只能操作自己的资源'),
            { status: 403 }
          );
        }

        // 4. 执行原始处理程序
        return await handler(request, user, resourceOwnerId || undefined);
        
      } catch (error) {
        console.error('资源权限验证失败:', error);
        return NextResponse.json(
          createAuthError('权限验证异常'),
          { status: 500 }
        );
      }
    };
  };
}

/**
 * 从URL参数中获取用户ID的辅助函数
 */
export function getUserIdFromPath(request: NextRequest): string | null {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  // 假设URL格式为 /api/users/{userId} 或类似
  const userIndex = pathSegments.findIndex(segment => segment === 'users');
  if (userIndex !== -1 && pathSegments[userIndex + 1]) {
    return pathSegments[userIndex + 1];
  }
  return null;
}

/**
 * 从URL参数中获取订单ID，然后查询订单所有者的辅助函数
 * 这需要根据实际的数据库查询来实现
 */
export async function getOrderOwnerIdFromPath(request: NextRequest): Promise<string | null> {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const orderIndex = pathSegments.findIndex(segment => segment === 'orders');
  
  if (orderIndex !== -1 && pathSegments[orderIndex + 1]) {
    const orderId = pathSegments[orderIndex + 1];
    
    // TODO: 这里需要实际的数据库查询来获取订单所有者
    // 示例：
    // const order = await db.query.orders.findFirst({
    //   where: eq(orders.id, orderId),
    //   columns: { userId: true }
    // });
    // return order?.userId || null;
    
    console.warn('getOrderOwnerIdFromPath 需要实现数据库查询');
    return null;
  }
  
  return null;
}

/**
 * 预定义的用户资源权限中间件
 */
export const withUserResourceAuth = withResourceOwnerAuth(async (request) => {
  return getUserIdFromPath(request);
});

/**
 * 预定义的订单资源权限中间件
 */
export const withOrderResourceAuth = withResourceOwnerAuth(getOrderOwnerIdFromPath);