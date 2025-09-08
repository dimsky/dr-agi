import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { 
  JWTPayload, 
  AuthenticatedUser, 
  PermissionCheck, 
  AuthOptions,
  USER_ROLES,
  UserRole
} from '@/types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'wechat-medical-platform',
      audience: 'miniprogram'
    }) as JWTPayload;
    return payload;
  } catch (error) {
    console.error('Token 验证失败:', error);
    return null;
  }
}

/**
 * 从请求中提取并验证用户信息 - 专门用于 middleware
 * 这个版本包含更多的调试信息，适合在 middleware 中使用
 */
export function authenticateMiddlewareRequest(request: NextRequest): {
  user: AuthenticatedUser | null;
  token: string | null;
  error?: string;
} {
  try {
    // 从 Authorization header 获取 token
    const authorization = request.headers.get('authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return {
        user: null,
        token: null,
        error: '未提供认证信息或格式错误'
      };
    }

    const token = authorization.substring(7); // 移除 "Bearer " 前缀
    const payload = verifyToken(token);
    
    if (!payload) {
      return {
        user: null,
        token,
        error: '无效的认证信息'
      };
    }

    // 验证角色是否有效
    if (payload.role !== USER_ROLES.ADMIN && payload.role !== USER_ROLES.USER) {
      return {
        user: null,
        token,
        error: `无效的用户角色: ${payload.role}`
      };
    }

    let user: AuthenticatedUser;

    // 根据角色构建用户信息
    if (payload.role === USER_ROLES.ADMIN) {
      user = {
        id: payload.username || '',
        role: payload.role,
      };
    } else if (payload.role === USER_ROLES.USER) {
      user = {
        id: payload.userId || '',
        role: payload.role,
        openId: payload.openId,
      };
    } else {
      return {
        user: null,
        token,
        error: '角色类型不匹配'
      };
    }

    return {
      user,
      token,
    };
  } catch (error) {
    console.error('中间件请求认证失败:', error);
    return {
      user: null,
      token: null,
      error: error instanceof Error ? error.message : '认证过程中发生未知错误'
    };
  }
}

/**
 * 从请求中提取并验证用户信息
 */
export function authenticateRequest(request: NextRequest): AuthenticatedUser | null {
  try {
    console.log("headers: ", request.headers)
    // 从 Authorization header 获取 token
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.substring(7); // 移除 "Bearer " 前缀
    const payload = verifyToken(token);
    
    if (!payload) {
      return null;
    }

    // 根据角色构建用户信息
    if (payload.role === USER_ROLES.ADMIN) {
      return {
        id: payload.username || '',
        role: payload.role,
      };
    } else if (payload.role === USER_ROLES.USER) {
      return {
        id: payload.userId || '',
        role: payload.role,
        openId: payload.openId,
      };
    }

    return null;
  } catch (error) {
    console.error('请求认证失败:', error);
    return null;
  }
}

/**
 * 检查用户是否具有指定角色
 */
export function hasRole(user: AuthenticatedUser, role: UserRole): boolean {
  return user.role === role;
}

/**
 * 检查用户是否为管理员
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return hasRole(user, USER_ROLES.ADMIN);
}

/**
 * 检查用户是否为普通用户
 */
export function isUser(user: AuthenticatedUser): boolean {
  return hasRole(user, USER_ROLES.USER);
}

/**
 * 检查用户是否可以访问资源
 */
export function checkPermission(
  user: AuthenticatedUser, 
  options: AuthOptions = {}
): PermissionCheck {
  const { requiredRole, allowSelf, resourceOwnerId } = options;

  // 管理员拥有所有权限
  if (isAdmin(user)) {
    return { hasPermission: true };
  }

  // 如果需要特定角色
  if (requiredRole && !hasRole(user, requiredRole)) {
    return {
      hasPermission: false,
      reason: `需要 ${requiredRole} 角色权限`,
    };
  }

  // 如果允许用户操作自己的资源
  if (allowSelf && resourceOwnerId) {
    if (user.id === resourceOwnerId) {
      return { hasPermission: true };
    }
    return {
      hasPermission: false,
      reason: '只能操作自己的资源',
    };
  }

  return { hasPermission: true };
}

/**
 * 检查用户是否可以修改用户信息
 */
export function canModifyUser(
  currentUser: AuthenticatedUser,
  targetUserId: string
): PermissionCheck {
  return checkPermission(currentUser, {
    allowSelf: true,
    resourceOwnerId: targetUserId,
  });
}

/**
 * 检查用户是否可以查看订单
 */
export function canViewOrder(
  currentUser: AuthenticatedUser,
  orderOwnerId: string
): PermissionCheck {
  return checkPermission(currentUser, {
    allowSelf: true,
    resourceOwnerId: orderOwnerId,
  });
}

/**
 * 检查用户是否可以创建订单
 */
export function canCreateOrder(_user: AuthenticatedUser): PermissionCheck {
  // 所有认证用户都可以创建订单
  return { hasPermission: true };
}

/**
 * 检查用户是否可以管理系统
 */
export function canManageSystem(user: AuthenticatedUser): PermissionCheck {
  return checkPermission(user, {
    requiredRole: USER_ROLES.ADMIN,
  });
}

/**
 * 检查用户是否可以查看所有用户
 */
export function canViewAllUsers(user: AuthenticatedUser): PermissionCheck {
  return checkPermission(user, {
    requiredRole: USER_ROLES.ADMIN,
  });
}

/**
 * 检查用户是否可以查看所有订单
 */
export function canViewAllOrders(user: AuthenticatedUser): PermissionCheck {
  return checkPermission(user, {
    requiredRole: USER_ROLES.ADMIN,
  });
}

/**
 * 生成权限错误响应
 */
export function createPermissionError(reason?: string) {
  return {
    success: false,
    error: reason || '权限不足',
    code: 'PERMISSION_DENIED',
  };
}

/**
 * 生成认证错误响应
 */
export function createAuthError(message?: string) {
  return {
    success: false,
    error: message || '认证失败',
    code: 'AUTHENTICATION_FAILED',
  };
}