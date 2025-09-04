import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'admin-session-secret';

interface AdminTokenPayload {
  username: string;
  role: string;
  type: string;
  iat?: number;
  exp?: number;
}

export async function GET(request: NextRequest) {
  try {
    // 在构建时减少日志输出
    const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
    
    if (!isBuildTime) {
      console.log(`[Auth API] ${new Date().toISOString()} - 收到认证请求`);
    }
    
    // 从 cookie 中获取 token
    const token = request.cookies.get('admin-token')?.value;
    if (!isBuildTime) {
      console.log(`[Auth API] Token存在: ${!!token}`);
      console.log(`[Auth API] Token内容: ${token ? token.slice(0, 50) + '...' : 'null'}`);
    }

    if (!token) {
      if (!isBuildTime) {
        console.log(`[Auth API] 未找到token，返回401`);
      }
      return NextResponse.json(
        {
          success: false,
          message: '未找到管理员会话',
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // 验证 token
    if (!isBuildTime) {
      console.log(`[Auth API] 开始验证token`);
    }
    const decoded = jwt.verify(token, ADMIN_SESSION_SECRET) as AdminTokenPayload;
    if (!isBuildTime) {
      console.log(`[Auth API] Token解码成功: ${JSON.stringify(decoded)}`);
    }

    // 检查 token 类型
    if (decoded.type !== 'admin-session' || decoded.role !== 'admin') {
      if (!isBuildTime) {
        console.log(`[Auth API] Token类型或角色无效: type=${decoded.type}, role=${decoded.role}`);
      }
      return NextResponse.json(
        {
          success: false,
          message: '无效的管理员会话',
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const result = {
      success: true,
      message: '管理员身份验证成功',
      authenticated: true,
      data: {
        username: decoded.username,
        role: decoded.role,
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

    // JWT 错误处理
    if (error instanceof jwt.JsonWebTokenError) {
      const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
      if (!isBuildTime) {
        console.log(`[Auth API] JWT格式错误: ${error.message}`);
      }
      return NextResponse.json(
        {
          success: false,
          message: '无效的管理员会话',
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    if (error instanceof jwt.TokenExpiredError) {
      const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
      if (!isBuildTime) {
        console.log(`[Auth API] Token已过期: ${error.message}`);
      }
      return NextResponse.json(
        {
          success: false,
          message: '管理员会话已过期',
          authenticated: false,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
    if (!isBuildTime) {
      console.log(`[Auth API] 其他验证错误: ${error}`);
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