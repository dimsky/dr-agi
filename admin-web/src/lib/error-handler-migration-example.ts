/**
 * 使用全局错误处理中间件重构的Token验证路由
 * 
 * 这个文件展示了如何将现有的API路由迁移到新的错误处理系统
 * 对比原始文件：/src/app/api/auth/verify/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt, { VerifyOptions } from 'jsonwebtoken';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { JWTPayload } from '@/types/auth';
import { 
  withErrorHandler, 
  createError
} from '@/lib/error-handler';

// Token验证请求接口
interface TokenVerifyRequest {
  token: string;
}

// Token验证响应接口
interface TokenVerifyResponse {
  success: boolean;
  valid?: boolean;
  user?: {
    id: string;
    nickname: string;
    avatarUrl: string;
    openId: string;
    isActive: boolean;
    lastLoginAt: string | null;
  };
  expired?: boolean;
}

/**
 * 验证JWT token并返回payload
 */
async function verifyJWTToken(token: string): Promise<JWTPayload> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw createError.internal('JWT配置未设置：JWT_SECRET 缺失');
  }

  try {
    const options: VerifyOptions = {
      issuer: 'wechat-medical-platform',
      audience: 'miniprogram',
    };

    const decoded = jwt.verify(token, jwtSecret, options) as JWTPayload;
    return decoded;

  } catch (error) {
    console.error('JWT验证失败:', error);

    if (error instanceof jwt.TokenExpiredError) {
      throw createError.authentication('Token已过期');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw createError.authentication('Token格式无效');
    } else {
      throw createError.authentication('Token验证失败');
    }
  }
}

/**
 * 根据用户ID查询用户信息
 */
async function getUserById(userId: string) {
  console.log('🔄 查询用户信息:', userId);

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw createError.notFound('用户');
    }

    if (!user.isActive) {
      throw createError.authorization('账户已被禁用，请联系管理员');
    }

    console.log('✅ 用户信息查询成功:', { id: user.id, nickname: user.nickname });
    return user;

  } catch (error) {
    // 如果是已知的业务错误，直接抛出
    if (error instanceof Error && error.name.includes('ERROR')) {
      throw error;
    }
    
    // 数据库连接或查询错误
    throw createError.database('用户信息查询失败');
  }
}

/**
 * POST /api/auth/verify
 * 验证JWT token并返回用户信息
 * 
 * 使用新的错误处理中间件重构版本
 */
export const POST = withErrorHandler(async (request: NextRequest): Promise<NextResponse<TokenVerifyResponse>> => {
  console.log('🚀 开始处理Token验证请求...');

  // 解析请求体
  let body: TokenVerifyRequest;
  try {
    body = await request.json();
  } catch {
    throw createError.validation('请求体格式错误');
  }

  // 验证必需字段
  if (!body.token) {
    throw createError.validation('缺少Token参数');
  }

  // 验证token格式（基本检查）
  if (typeof body.token !== 'string' || body.token.trim().length === 0) {
    throw createError.validation('Token格式无效');
  }

  try {
    // 1. 验证JWT token
    const payload = await verifyJWTToken(body.token);

    // 2. 根据角色获取用户ID并查询用户信息
    let userId: string;
    
    if (payload.role === 'user' && payload.userId) {
      userId = payload.userId;
    } else if (payload.role === 'admin' && payload.username) {
      userId = payload.username;
    } else {
      throw createError.authentication('Token中缺少有效的用户标识');
    }
    
    const user = await getUserById(userId);

    console.log('✅ Token验证成功:', { userId: user.id, nickname: user.nickname });

    // 3. 返回成功响应
    return NextResponse.json({
      success: true,
      valid: true,
      user: {
        id: user.id,
        nickname: user.nickname || '',
        avatarUrl: user.avatarUrl || '',
        openId: user.openId,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
      },
    });

  } catch (error) {
    // 特殊处理Token过期的情况
    // 返回特殊响应格式而不是标准错误格式
    if (error instanceof Error && error.message === 'Token已过期') {
      return NextResponse.json({
        success: true, // 请求处理成功
        valid: false,
        expired: true,
      });
    }

    // 其他错误通过中间件统一处理
    throw error;
  }
});

/**
 * GET /api/auth/verify
 * 获取Token验证配置信息（用于调试）
 * 
 * 使用新的错误处理中间件
 */
export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const hasConfig = !!process.env.JWT_SECRET;
  
  if (!hasConfig && process.env.NODE_ENV === 'production') {
    throw createError.internal('JWT配置缺失');
  }
  
  return NextResponse.json({
    configured: hasConfig,
    jwtSecret: process.env.JWT_SECRET ? '已配置' : '未配置',
    timestamp: new Date().toISOString(),
  });
});