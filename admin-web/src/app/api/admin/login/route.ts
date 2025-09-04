import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'root';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'admin-session-secret';

interface LoginRequest {
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    // 验证输入
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          message: '用户名和密码不能为空',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // 验证管理员凭据
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        {
          success: false,
          message: '用户名或密码错误',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // 生成管理员 token
    const token = jwt.sign(
      {
        username: ADMIN_USERNAME,
        role: 'admin',
        type: 'admin-session',
      },
      ADMIN_SESSION_SECRET,
      { expiresIn: '24h' }
    );

    // 创建响应并设置 cookie
    const response = NextResponse.json({
      success: true,
      message: '登录成功',
      data: {
        username: ADMIN_USERNAME,
        role: 'admin',
      },
      timestamp: new Date().toISOString(),
    });

    // 设置 httpOnly cookie
    response.cookies.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('管理员登录失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '登录过程中发生错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// 管理员退出登录
export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '退出登录成功',
      timestamp: new Date().toISOString(),
    });

    // 清除 cookie
    response.cookies.set('admin-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('管理员退出登录失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '退出登录过程中发生错误',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}