import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { aiService } from '@/db/schema/ai_service';
import { JWTPayload } from '@/types/auth';
import jwt from 'jsonwebtoken';

/**
 * 支付订单状态查询API
 * 允许小程序端查询订单的支付状态
 */

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

    return payload.userId;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token无效或已过期');
    }
    throw error;
  }
}

/**
 * GET /api/payment/status?orderId=xxx
 * 查询订单支付状态
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证请求头中的认证Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: '缺少认证信息' },
        { status: 401 }
      );
    }

    // 2. 获取查询参数
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '缺少订单ID参数' },
        { status: 400 }
      );
    }

    // 3. 验证用户Token
    const userId = await verifyTokenAndGetUser(authHeader);

    // 4. 查询订单信息
    const orderList = await db
      .select({
        id: orders.id,
        status: orders.status,
        amount: orders.amount,
        paymentMethod: orders.paymentMethod,
        transactionId: orders.transactionId,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        completedAt: orders.completedAt,
        // 关联服务信息
        serviceName: aiService.displayName,
        // 用户ID用于权限验证
        userId: orders.userId
      })
      .from(orders)
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderList.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    const order = orderList[0];

    // 5. 验证订单归属权
    if (order.userId !== userId) {
      return NextResponse.json(
        { success: false, error: '无权查看该订单' },
        { status: 403 }
      );
    }

    // 6. 返回订单状态信息
    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        statusText: getStatusText(order.status),
        amount: order.amount,
        paymentMethod: order.paymentMethod,
        transactionId: order.transactionId,
        serviceName: order.serviceName,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        completedAt: order.completedAt,
        isPaid: order.status === 'paid' || order.status === 'processing' || order.status === 'completed',
        isCompleted: order.status === 'completed',
        isCancelled: order.status === 'cancelled',
        isRefunded: order.status === 'refunded'
      }
    });

  } catch (error) {
    // 错误日志记录
    console.error('[Payment Status] 订单状态查询失败:', error);

    // 返回友好的错误信息
    const errorMessage = error instanceof Error ? error.message : '订单状态查询失败';
    
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
 * 获取订单状态的中文描述
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    processing: '处理中',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款'
  };

  return statusMap[status] || '未知状态';
}

/**
 * POST /api/payment/status
 * 不支持POST请求
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: '该接口不支持POST请求' },
    { status: 405 }
  );
}