import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, type CreateOrderInput } from '@/db/schema/orders';
import { users } from '@/db/schema/users';
import { aiService } from '@/db/schema/ai_service';
import { getWeChatPayService } from '@/services/wechat-pay';
import { JWTPayload } from '@/types/auth';
import jwt from 'jsonwebtoken';

/**
 * 支付订单创建API
 * 处理小程序端的支付请求，创建订单并返回微信支付参数
 */

/**
 * 从请求头中获取客户端IP地址
 */
function getClientIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  
  if (xForwardedFor) {
    // x-forwarded-for 可能包含多个IP，取第一个
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  // 开发环境默认IP
  return '127.0.0.1';
}

/**
 * 验证JWT Token并获取用户信息
 */
async function verifyTokenAndGetUser(authToken: string) {
  if (!authToken || !authToken.startsWith('Bearer ')) {
    throw new Error('缺少有效的认证Token');
  }

  const token = authToken.substring(7); // 移除 "Bearer " 前缀

  try {
    // 验证JWT Token
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    if (!payload.userId || !payload.role) {
      throw new Error('Token无效');
    }

    // 查询用户信息
    const userList = await db
      .select({
        id: users.id,
        openId: users.openId,
        nickname: users.nickname,
        isActive: users.isActive
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (userList.length === 0) {
      throw new Error('用户不存在');
    }

    const user = userList[0];
    
    if (!user.isActive) {
      throw new Error('用户账户已被禁用');
    }

    if (!user.openId) {
      throw new Error('用户微信信息不完整');
    }

    return user;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token无效或已过期');
    }
    throw error;
  }
}

/**
 * 验证AI服务是否存在且激活
 */
async function validateAIService(aiServiceId: string) {
  const serviceList = await db
    .select({
      id: aiService.id,
      displayName: aiService.displayName,
      isActive: aiService.isActive,
      pricing: aiService.pricing
    })
    .from(aiService)
    .where(eq(aiService.id, aiServiceId))
    .limit(1);

  if (serviceList.length === 0) {
    throw new Error('AI服务不存在');
  }

  const service = serviceList[0];
  
  if (!service.isActive) {
    throw new Error('AI服务暂时不可用');
  }

  return service;
}

/**
 * 创建订单记录
 */
async function createOrderRecord(orderData: CreateOrderInput): Promise<string> {
  const result = await db
    .insert(orders)
    .values({
      ...orderData,
      paymentMethod: 'wechat_pay', // 默认使用微信支付
      status: 'pending',
    })
    .returning({ id: orders.id });

  if (result.length === 0) {
    throw new Error('订单创建失败');
  }

  return result[0].id;
}

/**
 * POST /api/payment/create
 * 创建支付订单
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证请求头中的认证Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: '缺少认证信息' },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }

    const { aiServiceId, serviceData, amount } = body;

    // 3. 验证必要参数
    if (!aiServiceId || typeof aiServiceId !== 'string') {
      return NextResponse.json(
        { success: false, error: '缺少AI服务ID' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: '订单金额无效' },
        { status: 400 }
      );
    }

    // 4. 验证用户Token并获取用户信息
    const user = await verifyTokenAndGetUser(authHeader);

    // 5. 验证AI服务
    const service = await validateAIService(aiServiceId);

    // 6. 创建订单记录
    const orderId = await createOrderRecord({
      userId: user.id,
      aiServiceId,
      serviceData: serviceData || {},
      amount: amount.toString()
    });

    // 7. 调用微信支付统一下单
    const wechatPay = getWeChatPayService();
    const clientIP = getClientIP(request);

    const paymentParams = await wechatPay.unifyOrder({
      body: `${service.displayName}服务`,
      outTradeNo: orderId,
      totalFee: Math.round(amount * 100), // 转换为分
      clientIp: clientIP,
      openId: user.openId,
      attach: JSON.stringify({
        orderId,
        userId: user.id,
        serviceId: aiServiceId
      })
    });

    // 8. 记录支付请求日志
    console.log('[Payment Create] 支付订单创建成功', {
      orderId,
      userId: user.id,
      serviceId: aiServiceId,
      amount,
      clientIP,
      timestamp: new Date().toISOString()
    });

    // 9. 返回支付参数给小程序
    return NextResponse.json({
      success: true,
      data: {
        orderId,
        paymentParams: {
          timeStamp: paymentParams.timeStamp,
          nonceStr: paymentParams.nonceStr,
          package: `prepay_id=${paymentParams.prepayId}`,
          signType: 'MD5',
          paySign: paymentParams.paySign
        },
        orderInfo: {
          orderId,
          serviceName: service.displayName,
          amount: amount.toString()
        }
      }
    });

  } catch (error) {
    // 错误日志记录
    console.error('[Payment Create] 支付订单创建失败:', error);

    // 返回友好的错误信息
    const errorMessage = error instanceof Error ? error.message : '支付订单创建失败';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payment/create
 * 不支持GET请求
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: '该接口不支持GET请求' },
    { status: 405 }
  );
}