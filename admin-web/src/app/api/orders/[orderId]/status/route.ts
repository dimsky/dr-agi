import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { aiService } from '@/db/schema/ai_service';
import { users } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { withSoftDeleteFilter } from '@/lib/soft-delete';

/**
 * 订单状态更新API
 * PATCH /api/orders/[orderId]/status - 更新订单状态
 * 
 * 功能：
 * 1. 验证用户权限和订单存在性
 * 2. 验证状态转换的合法性
 * 3. 更新订单状态并记录时间戳
 * 4. 记录状态变更日志
 * 5. 触发相关通知（如订单完成、付款成功等）
 * 6. 返回更新后的订单信息
 */

// 订单状态转换规则定义
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['paid', 'cancelled'], // 待支付 -> 已支付或取消
  'paid': ['processing', 'refunded'], // 已支付 -> 处理中或退款
  'processing': ['completed', 'cancelled'], // 处理中 -> 已完成或取消
  'completed': ['refunded'], // 已完成 -> 仅可退款
  'cancelled': [], // 已取消 -> 无法转换
  'refunded': [] // 已退款 -> 无法转换
};

// 状态更新请求体类型
interface StatusUpdateRequest {
  status: 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  reason?: string; // 状态变更原因
  paymentMethod?: 'wechat_pay' | 'alipay' | 'credit_card' | 'bank_card';
  transactionId?: string; // 支付交易ID（付款时需要）
}

// 状态变更日志接口
interface StatusChangeLog {
  orderId: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  operatorId?: string; // 操作人ID（管理员或系统）
  timestamp: Date;
  metadata?: Record<string, unknown>; // 额外元数据
}

/**
 * 验证订单状态转换是否合法
 */
function validateStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions?.includes(newStatus) || false;
}

/**
 * 获取状态更新时的时间戳字段
 */
function getStatusTimestampUpdate(newStatus: string) {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date()
  };

  switch (newStatus) {
    case 'paid':
      updateData.paidAt = new Date();
      break;
    case 'completed':
      updateData.completedAt = new Date();
      break;
  }

  return updateData;
}

/**
 * 记录订单状态变更日志
 * 注: 在实际项目中，这里应该写入专门的日志表
 */
async function logStatusChange(log: StatusChangeLog): Promise<void> {
  console.log('📝 订单状态变更日志:', {
    orderId: log.orderId,
    statusChange: `${log.fromStatus} -> ${log.toStatus}`,
    reason: log.reason,
    timestamp: log.timestamp.toISOString(),
    operatorId: log.operatorId,
    metadata: log.metadata
  });

  // TODO: 在未来版本中，将日志写入专门的订单日志表
  // await db.insert(orderLogs).values({
  //   orderId: log.orderId,
  //   fromStatus: log.fromStatus,
  //   toStatus: log.toStatus,
  //   reason: log.reason,
  //   operatorId: log.operatorId,
  //   createdAt: log.timestamp,
  //   metadata: log.metadata
  // });
}

/**
 * 触发状态变更相关通知
 */
async function triggerStatusChangeNotifications(
  orderId: string, 
  newStatus: string
): Promise<void> {
  console.log('🔔 触发订单状态变更通知:', { orderId, newStatus });

  // TODO: 实现具体的通知逻辑
  switch (newStatus) {
    case 'paid':
      console.log('💰 订单付款成功，准备开始处理...');
      // 通知任务队列开始处理订单
      // await taskQueueService.createTaskFromOrder(order);
      break;
    
    case 'processing':
      console.log('⚙️ 订单开始处理，通知用户...');
      // 发送处理中通知给用户
      // await notificationService.sendProcessingNotification(order.userId, orderId);
      break;
    
    case 'completed':
      console.log('✅ 订单完成，发送完成通知...');
      // 发送完成通知给用户
      // await notificationService.sendCompletionNotification(order.userId, orderId);
      break;
    
    case 'cancelled':
      console.log('❌ 订单取消，处理取消逻辑...');
      // 处理订单取消相关逻辑
      // await handleOrderCancellation(orderId);
      break;
    
    case 'refunded':
      console.log('💸 订单退款，处理退款逻辑...');
      // 处理退款相关逻辑
      // await handleOrderRefund(orderId);
      break;
  }
}

/**
 * PATCH /api/orders/[orderId]/status
 * 更新订单状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
): Promise<NextResponse> {
  try {
    const { orderId } = await params;
    console.log('🔄 开始更新订单状态:', orderId);

    // 验证用户认证
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '用户认证失败',
        message: '请重新登录后再试',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // 验证订单ID参数
    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: '缺少订单ID参数',
        message: '请提供有效的订单ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 解析请求体
    const requestBody: StatusUpdateRequest = await request.json();
    const { status: newStatus, reason, paymentMethod, transactionId } = requestBody;

    // 验证新状态参数
    if (!newStatus) {
      return NextResponse.json({
        success: false,
        error: '缺少状态参数',
        message: '请提供要更新的订单状态',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 验证状态值是否有效
    const validStatuses = ['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({
        success: false,
        error: '无效的订单状态',
        message: `订单状态必须是: ${validStatuses.join(', ')} 中的一个`,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 查询订单信息（包含用户和服务信息）
    const [existingOrder] = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        aiServiceId: orders.aiServiceId,
        serviceData: orders.serviceData,
        status: orders.status,
        amount: orders.amount,
        paymentMethod: orders.paymentMethod,
        transactionId: orders.transactionId,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        completedAt: orders.completedAt,
        updatedAt: orders.updatedAt,
        deletedAt: orders.deletedAt,
        // 用户信息
        userNickname: users.nickname,
        userOpenId: users.openId,
        // 服务信息
        serviceName: aiService.displayName,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(
        withSoftDeleteFilter([eq(orders.id, orderId)], orders.deletedAt)
      );

    if (!existingOrder) {
      return NextResponse.json({
        success: false,
        error: '订单不存在',
        message: `订单ID ${orderId} 不存在或已被删除`,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // 验证用户权限：用户只能更新自己的订单
    if (existingOrder.userId !== userId) {
      return NextResponse.json({
        success: false,
        error: '无权限访问该订单',
        message: '您只能更新自己的订单',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // 检查订单是否已经是目标状态
    if (existingOrder.status === newStatus) {
      return NextResponse.json({
        success: false,
        error: '订单状态无需更新',
        message: `订单已经是 ${newStatus} 状态`,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 验证状态转换的合法性
    if (!validateStatusTransition(existingOrder.status, newStatus)) {
      return NextResponse.json({
        success: false,
        error: '无效的状态转换',
        message: `订单状态不能从 ${existingOrder.status} 直接转换为 ${newStatus}`,
        details: {
          currentStatus: existingOrder.status,
          requestedStatus: newStatus,
          allowedTransitions: ORDER_STATUS_TRANSITIONS[existingOrder.status]
        },
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      status: newStatus,
      ...getStatusTimestampUpdate(newStatus)
    };

    // 如果是付款状态，需要支付信息
    if (newStatus === 'paid') {
      if (paymentMethod) {
        updateData.paymentMethod = paymentMethod;
      }
      if (transactionId) {
        updateData.transactionId = transactionId;
      }
    }

    // 更新订单状态
    const [updatedOrder] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    console.log('✅ 订单状态更新成功:', {
      orderId,
      fromStatus: existingOrder.status,
      toStatus: newStatus,
      userId
    });

    // 记录状态变更日志
    await logStatusChange({
      orderId,
      fromStatus: existingOrder.status,
      toStatus: newStatus,
      reason,
      operatorId: userId,
      timestamp: new Date(),
      metadata: {
        paymentMethod,
        transactionId,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      }
    });

    // 触发相关通知
    await triggerStatusChangeNotifications(orderId, newStatus);

    // 构建响应数据
    const responseData = {
      id: updatedOrder.id,
      userId: updatedOrder.userId,
      aiServiceId: updatedOrder.aiServiceId,
      serviceData: updatedOrder.serviceData,
      status: updatedOrder.status,
      amount: updatedOrder.amount,
      paymentMethod: updatedOrder.paymentMethod,
      transactionId: updatedOrder.transactionId,
      createdAt: updatedOrder.createdAt,
      paidAt: updatedOrder.paidAt,
      completedAt: updatedOrder.completedAt,
      updatedAt: updatedOrder.updatedAt,
      // 包含关联信息
      user: {
        nickname: existingOrder.userNickname,
        openId: existingOrder.userOpenId
      },
      service: {
        name: existingOrder.serviceName
      },
      // 状态变更信息
      statusChange: {
        from: existingOrder.status,
        to: newStatus,
        reason,
        timestamp: updateData.updatedAt
      }
    };

    // 根据状态返回不同的消息
    let message = '';
    switch (newStatus) {
      case 'paid':
        message = '订单付款成功，即将开始处理';
        break;
      case 'processing':
        message = '订单已开始处理';
        break;
      case 'completed':
        message = '订单处理完成';
        break;
      case 'cancelled':
        message = '订单已取消';
        break;
      case 'refunded':
        message = '订单已退款';
        break;
      default:
        message = '订单状态更新成功';
    }

    return NextResponse.json({
      success: true,
      message,
      data: responseData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 更新订单状态失败:', error);

    // 根据错误类型返回不同的错误信息
    let errorMessage = '更新订单状态失败';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('数据库')) {
        errorMessage = '数据库操作失败，请稍后重试';
      } else if (error.message.includes('网络')) {
        errorMessage = '网络连接失败，请检查网络状态';
      } else if (error.message.includes('权限')) {
        errorMessage = '权限验证失败，请重新登录';
        statusCode = 403;
      } else if (error.message.includes('不存在')) {
        errorMessage = '订单不存在或已被删除';
        statusCode = 404;
      } else if (error.message.includes('JSON')) {
        errorMessage = '请求数据格式错误';
        statusCode = 400;
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      message: '请稍后重试，如问题持续请联系技术支持',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}

/**
 * OPTIONS /api/orders/[orderId]/status
 * 处理CORS预检请求
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}