import { NextRequest, NextResponse } from 'next/server';
import jwt, { VerifyOptions } from 'jsonwebtoken';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { JWTPayload } from '@/types/auth';

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
  error?: string;
  expired?: boolean;
}

/**
 * 验证JWT token并返回用户信息
 */
async function verifyJWTToken(token: string): Promise<{ 
  valid: boolean; 
  payload?: JWTPayload; 
  expired?: boolean; 
  error?: string; 
}> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT配置未设置：JWT_SECRET 缺失');
  }

  try {
    const options: VerifyOptions = {
      issuer: 'wechat-medical-platform',
      audience: 'miniprogram',
    };

    const decoded = jwt.verify(token, jwtSecret, options) as JWTPayload;

    return {
      valid: true,
      payload: decoded,
    };
  } catch (error) {
    console.error('JWT验证失败:', error);

    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        expired: true,
        error: 'Token已过期',
      };
    } else if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        expired: false,
        error: 'Token格式无效',
      };
    } else {
      return {
        valid: false,
        expired: false,
        error: 'Token验证失败',
      };
    }
  }
}

/**
 * 根据用户ID查询用户信息
 */
async function getUserById(userId: string) {
  console.log('🔄 查询用户信息:', userId);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('用户不存在');
  }

  if (!user.isActive) {
    throw new Error('用户已被禁用');
  }

  console.log('✅ 用户信息查询成功:', { id: user.id, nickname: user.nickname });

  return user;
}

/**
 * POST /api/auth/verify
 * 验证JWT token并返回用户信息
 */
export async function POST(request: NextRequest): Promise<NextResponse<TokenVerifyResponse>> {
  try {
    console.log('🚀 开始处理Token验证请求...');

    // 解析请求体
    const body: TokenVerifyRequest = await request.json();

    // 验证必需字段
    if (!body.token) {
      return NextResponse.json(
        { success: false, error: '缺少Token参数' },
        { status: 400 }
      );
    }

    // 1. 验证JWT token
    const tokenResult = await verifyJWTToken(body.token);

    if (!tokenResult.valid) {
      console.log('❌ Token验证失败:', tokenResult.error);
      
      return NextResponse.json({
        success: true, // 请求成功处理，但token无效
        valid: false,
        expired: tokenResult.expired,
        error: tokenResult.error,
      });
    }

    // 2. 根据角色处理用户信息
    const payload = tokenResult.payload!;
    
    if (payload.role === 'admin' && payload.username) {
      // 对于管理员，直接返回管理员信息，无需查询数据库
      console.log('✅ 管理员Token验证成功:', { username: payload.username, role: payload.role });
      
      return NextResponse.json({
        success: true,
        valid: true,
        user: {
          id: payload.username,
          nickname: '系统管理员',
          avatarUrl: '',
          openId: '',
          isActive: true,
          lastLoginAt: null,
        },
      });
    } else if (payload.role === 'user' && payload.userId) {
      // 对于普通用户，查询数据库获取用户信息
      const user = await getUserById(payload.userId);
      
      console.log('✅ 用户Token验证成功:', { userId: user.id, nickname: user.nickname });

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
    } else {
      return NextResponse.json({
        success: true,
        valid: false,
        error: 'Token中缺少有效的用户标识',
      });
    }

  } catch (error) {
    console.error('❌ Token验证处理失败:', error);

    // 根据错误类型返回不同的错误信息
    let errorMessage = 'Token验证失败，请重新登录';
    let statusCode = 401;

    if (error instanceof Error) {
      if (error.message.includes('配置未设置')) {
        errorMessage = '服务配置错误，请联系管理员';
        statusCode = 500;
      } else if (error.message.includes('用户不存在')) {
        errorMessage = '用户不存在，请重新注册';
        statusCode = 404;
      } else if (error.message.includes('用户已被禁用')) {
        errorMessage = '账户已被禁用，请联系管理员';
        statusCode = 403;
      } else if (error.message.includes('数据库')) {
        errorMessage = '用户信息查询失败，请重试';
        statusCode = 500;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/auth/verify
 * 获取Token验证配置信息（用于调试）
 */
export async function GET(): Promise<NextResponse> {
  const hasConfig = !!process.env.JWT_SECRET;
  
  return NextResponse.json({
    configured: hasConfig,
    jwtSecret: process.env.JWT_SECRET ? '已配置' : '未配置',
    timestamp: new Date().toISOString(),
  });
}