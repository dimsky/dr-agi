import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthError } from '@/lib/auth-utils';
import { USER_ROLES } from '@/types/auth';

export async function GET(request: NextRequest) {
  try {
    // 在构建时减少日志输出
    const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
    
    if (!isBuildTime) {
      console.log(`[Auth API] ${new Date().toISOString()} - 收到认证请求`);
    }
    
    // 使用统一的认证方法
    const user = authenticateRequest(request);
    console.log("-->", user, isBuildTime)
    
    if (!user) {
      if (!isBuildTime) {
        console.log(`[Auth API] 认证失败，返回401`);
      }
      const authError = createAuthError('未提供认证信息或认证信息无效');
      return NextResponse.json(
        {
          success: false,
          message: authError.error,
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    if (user.role !== USER_ROLES.ADMIN) {
      if (!isBuildTime) {
        console.log(`[Auth API] 用户角色无效: role=${user.role}`);
      }
      return NextResponse.json(
        {
          success: false,
          message: '需要管理员权限',
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    const result = {
      success: true,
      message: '管理员身份验证成功',
      authenticated: true,
      data: {
        username: user.id, // 对于管理员，id 就是 username
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    };
    
    if (!isBuildTime) {
      console.log(`[Auth API] 认证成功，返回结果: ${JSON.stringify(result)}`);
    }
    return NextResponse.json(result);
  } catch (error) {
    // 错误处理仍然保持日志，因为这很重要
    console.error(`[Auth API] 身份验证异常:`, error);

    const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
    if (!isBuildTime) {
      console.log(`[Auth API] 认证错误: ${error}`);
    }
    return NextResponse.json(
      {
        success: false,
        message: '身份验证过程中发生错误',
        authenticated: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}