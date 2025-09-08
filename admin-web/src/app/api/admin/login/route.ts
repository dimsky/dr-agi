import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'root';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
      },
      JWT_SECRET,
      { 
        expiresIn: '24h',
        issuer: 'wechat-medical-platform',
        audience: 'miniprogram'
      }
    );

    // 返回 token 供客户端使用
    return NextResponse.json({
      success: true,
      message: '登录成功',
      data: {
        username: ADMIN_USERNAME,
        role: 'admin',
        token: token, // 直接返回 token
      },
      timestamp: new Date().toISOString(),
    });
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
    // 由于不再使用 cookie，退出登录只需要返回成功响应
    // 客户端需要自行清除存储的 token
    return NextResponse.json({
      success: true,
      message: '退出登录成功',
      timestamp: new Date().toISOString(),
    });
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