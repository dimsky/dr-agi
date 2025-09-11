import { NextRequest, NextResponse } from 'next/server';
import { getWeChatAuthService } from '@/services/wechat-auth';

// 请求体接口
interface WeChatLoginRequest {
  code: string;
  phoneNumber?: string; // 可选的手机号参数
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
    
    // 基础登录
    const result = await authService.login(body.code);

    // 构建响应用户对象
    const responseUser = {
      id: result.user.id,
      nickname: result.user.nickname || '',
      avatarUrl: result.user.avatarUrl || '',
      openId: result.user.openId,
      phoneNumber: undefined as string | undefined,
    };

    // 如果提供了手机号，更新用户手机号
    if (body.phoneNumber) {
      try {
        await authService.updateUserPhoneNumber(result.user.id, body.phoneNumber);
        console.log('✅ 成功更新用户手机号:', body.phoneNumber);
        
        // 更新响应用户信息中的手机号
        responseUser.phoneNumber = body.phoneNumber;
      } catch (error) {
        console.error('⚠️ 更新手机号失败，但登录成功:', error);
      }
    }

    console.log('✅ 微信登录成功:', { 
      userId: result.user.id, 
      nickname: result.user.nickname,
      hasPhoneNumber: !!body.phoneNumber 
    });

    // 返回成功响应
    return NextResponse.json({
      success: true,
      token: result.token,
      user: responseUser,
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