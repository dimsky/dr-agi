import { NextRequest, NextResponse } from 'next/server';
import { taskQueueService } from '@/services/task-queue';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { tasks } from '@/db/schema/tasks';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';

/**
 * POST /api/dify/execute - 执行已支付订单的AI服务
 * 
 * 业务流程：
 * 1. 验证订单状态为"已支付"
 * 2. 创建AI任务记录
 * 3. 启动Dify工作流执行
 * 4. 更新订单和任务状态
 * 
 * 请求体格式：
 * {
 *   "orderId": "uuid-123"  // 已支付的订单ID
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 用户ID从中间件传递过来
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '用户认证失败',
        error: 'MISSING_USER_ID'
      }, { status: 401 });
    }

    // 解析请求参数
    const body = await request.json();
    const { orderId } = body;

    // 参数验证
    if (!orderId) {
      return NextResponse.json({
        success: false,
        message: '缺少必需的参数orderId',
        error: 'MISSING_ORDER_ID'
      }, { status: 400 });
    }

    // 1. 验证订单存在且状态为"已支付"
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId)
    });

    if (!order) {
      return NextResponse.json({
        success: false,
        message: '订单不存在',
        error: 'ORDER_NOT_FOUND'
      }, { status: 404 });
    }

    // 验证订单属于当前用户
    if (order.userId !== userId) {
      return NextResponse.json({
        success: false,
        message: '无权限访问此订单',
        error: 'ORDER_ACCESS_DENIED'
      }, { status: 403 });
    }

    // 验证订单状态为已支付
    if (order.status !== 'paid') {
      return NextResponse.json({
        success: false,
        message: `订单状态错误，当前状态: ${order.status}，需要状态: paid`,
        error: 'ORDER_NOT_PAID'
      }, { status: 400 });
    }

    // 检查是否已经有正在执行的任务
    const existingTask = await db.query.tasks.findFirst({
      where: eq(tasks.orderId, orderId)
    });

    if (existingTask) {
      return NextResponse.json({
        success: false,
        message: '该订单已有任务在执行中',
        error: 'TASK_ALREADY_EXISTS',
        data: {
          taskId: existingTask.id,
          status: existingTask.status
        }
      }, { status: 409 });
    }

    // 2. 更新订单状态为"处理中"
    await db.update(orders)
      .set({ 
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));

    // 获取AI服务信息
    const service = await db.query.aiService.findFirst({
      where: eq(aiService.id, order.aiServiceId)
    });

    // 3. 创建AI任务记录并启动执行
    const task = await taskQueueService.enqueueTask({
      orderId,
      aiServiceId: order.aiServiceId,
      inputData: order.serviceData || {}
    });

    // 4. 返回任务ID供客户端跟踪
    return NextResponse.json({
      success: true,
      message: 'AI任务已启动，正在处理中',
      data: {
        orderId: order.id,
        taskId: task.id,
        status: 'running',
        serviceId: service?.id || order.aiServiceId,
        serviceName: service?.displayName || 'AI服务',
        estimatedDuration: '3-5分钟',
        createdAt: task.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI任务启动失败:', error);
    
    return NextResponse.json({
      success: false,
      message: 'AI任务启动失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

