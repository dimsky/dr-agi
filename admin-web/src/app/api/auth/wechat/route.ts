import { NextRequest, NextResponse } from 'next/server';
import { getWeChatAuthService } from '@/services/wechat-auth';

// 请求体接口
interface WeChatLoginRequest {
  code: string;
}

// 响应接口
interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    nickname: string;
    avatarUrl: string;
    openId: string;
  };
  error?: string;
}


/**
 * POST /api/auth/wechat
 * 处理微信小程序登录
 */
export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    console.log('🚀 开始处理微信登录请求...');
    
    // 解析请求体
    const body: WeChatLoginRequest = await request.json();
    
    // 验证必需字段
    if (!body.code) {
      return NextResponse.json(
        { success: false, error: '缺少微信授权码' },
        { status: 400 }
      );
    }

    // 使用 WeChatAuthService 处理登录
    const authService = getWeChatAuthService();
    
    // 直接使用授权码登录，不传递用户信息
    const result = await authService.login(body.code);

    console.log('✅ 微信登录成功:', { userId: result.user.id, nickname: result.user.nickname });

    // 返回成功响应
    return NextResponse.json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        nickname: result.user.nickname || '',
        avatarUrl: result.user.avatarUrl || '',
        openId: result.user.openId,
        role: result.user.role, // 添加用户角色信息
      },
    });

  } catch (error) {
    console.error('❌ 微信登录失败:', error);

    // 根据错误类型返回不同的错误信息
    let errorMessage = '登录失败，请稍后重试';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('微信') || error.message.includes('WeChat')) {
        errorMessage = '微信授权失败，请重新授权';
        statusCode = 400;
      } else if (error.message.includes('配置') || error.message.includes('config')) {
        errorMessage = '服务配置错误，请联系管理员';
        statusCode = 500;
      } else if (error.message.includes('数据库') || error.message.includes('database')) {
        errorMessage = '用户信息保存失败，请重试';
        statusCode = 500;
      } else if (error.message.includes('Token') || error.message.includes('token')) {
        errorMessage = 'Token生成失败，请重试';
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
 * GET /api/auth/wechat
 * 获取微信登录配置信息（用于调试）
 */
export async function GET(): Promise<NextResponse> {
  try {
    const authService = getWeChatAuthService();
    const isConfigured = authService.isConfigured();
    
    return NextResponse.json({
      configured: isConfigured,
      appId: process.env.WECHAT_APPID ? '已配置' : '未配置',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      configured: false,
      error: '配置检查失败',
      timestamp: new Date().toISOString(),
    });
  }
}