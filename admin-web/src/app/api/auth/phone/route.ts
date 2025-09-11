import { NextRequest, NextResponse } from 'next/server';
import { WeChatPhoneNumberResponse } from '@/types/auth';

interface PhoneNumberRequest {
  phoneCode: string;
}

interface PhoneNumberApiResponse {
  success: boolean;
  phoneNumber?: string;
  error?: string;
}

/**
 * POST /api/auth/phone
 * 获取用户手机号（无需认证）
 */
export async function POST(request: NextRequest): Promise<NextResponse<PhoneNumberApiResponse>> {
  try {
    console.log('🚀 开始获取用户手机号...');

    // 解析请求体
    const body: PhoneNumberRequest = await request.json();
    
    // 验证必需字段
    if (!body.phoneCode) {
      return NextResponse.json(
        { success: false, error: '缺少手机号授权码' },
        { status: 400 }
      );
    }

    // 获取微信访问令牌
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: '获取访问令牌失败' },
        { status: 500 }
      );
    }

    // 调用微信API获取手机号
    const phoneInfo = await getPhoneNumber(accessToken, body.phoneCode);
    
    if (!phoneInfo) {
      return NextResponse.json(
        { success: false, error: '获取手机号信息失败' },
        { status: 500 }
      );
    }
    
    console.log('✅ 成功获取用户手机号');

    return NextResponse.json({
      success: true,
      phoneNumber: phoneInfo.purePhoneNumber, // 返回不带区号的纯手机号
    });

  } catch (error) {
    console.error('❌ 获取手机号失败:', error);

    let errorMessage = '获取手机号失败，请稍后重试';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('40001')) {
        errorMessage = 'access_token无效或已过期';
        statusCode = 401;
      } else if (error.message.includes('40029')) {
        errorMessage = '授权码无效';
        statusCode = 400;
      } else if (error.message.includes('40125')) {
        errorMessage = '应用密钥无效';
        statusCode = 500;
      } else if (error.message.includes('code已使用') || error.message.includes('40163')) {
        errorMessage = '授权码已过期或已使用';
        statusCode = 400;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

/**
 * 获取微信访问令牌
 */
async function getAccessToken(): Promise<string | null> {
  const appId = process.env.WECHAT_APPID;
  const appSecret = process.env.WECHAT_SECRET;

  if (!appId || !appSecret) {
    console.error('❌ 微信配置不完整');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
      { method: 'GET' }
    );

    const data = await response.json();
    
    if (data.errcode) {
      console.error('❌ 获取访问令牌失败:', data);
      throw new Error(`获取访问令牌失败: ${data.errmsg}`);
    }

    return data.access_token;
  } catch (error) {
    console.error('❌ 访问令牌请求失败:', error);
    throw error;
  }
}

/**
 * 获取用户手机号信息
 */
async function getPhoneNumber(accessToken: string, code: string): Promise<WeChatPhoneNumberResponse['phone_info'] | null> {
  try {
    const response = await fetch(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      }
    );

    const data: WeChatPhoneNumberResponse = await response.json();
    
    if (data.errcode !== 0) {
      console.error('❌ 获取手机号失败:', data);
      throw new Error(`获取手机号失败: ${data.errmsg} (${data.errcode})`);
    }

    return data.phone_info || null;
  } catch (error) {
    console.error('❌ 手机号请求失败:', error);
    throw error;
  }
}