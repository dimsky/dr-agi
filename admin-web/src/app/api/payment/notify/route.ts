import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { tasks } from '@/db/schema/tasks';
import { aiService } from '@/db/schema/ai_service';
import { getWeChatPayService } from '@/services/wechat-pay';

/**
 * 微信支付结果通知API
 * 接收微信支付平台的支付结果通知并触发后续业务流程
 */

/**
 * 触发AI任务执行
 * 当支付成功后，创建对应的AI任务
 */
async function triggerAITaskExecution(orderId: string): Promise<void> {
  try {
    // 1. 查询订单详细信息
    const orderList = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        aiServiceId: orders.aiServiceId,
        serviceData: orders.serviceData,
        // AI服务信息
        serviceName: aiService.displayName,
        difyApiKey: aiService.difyApiKey,
        difyBaseUrl: aiService.difyBaseUrl
      })
      .from(orders)
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderList.length === 0) {
      console.error(`[Payment Notify] 订单不存在: ${orderId}`);
      return;
    }

    const order = orderList[0];

    if (!order.difyApiKey || !order.difyBaseUrl) {
      console.error(`[Payment Notify] AI服务Dify配置不完整: ${order.aiServiceId}`);
      return;
    }

    // 2. 创建AI任务记录
    const taskResult = await db
      .insert(tasks)
      .values({
        orderId: order.id,
        aiServiceId: order.aiServiceId,
        status: 'pending',
        inputData: order.serviceData || {},
        retryCount: 0
      })
      .returning({ id: tasks.id });

    if (taskResult.length === 0) {
      throw new Error('AI任务创建失败');
    }

    const taskId = taskResult[0].id;

    // 3. 更新订单状态为处理中
    await db
      .update(orders)
      .set({
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));

    console.log(`[Payment Notify] AI任务创建成功`, {
      orderId,
      taskId,
      serviceName: order.serviceName,
      difyApiKey: order.difyApiKey ? '***配置' : '未配置',
      timestamp: new Date().toISOString()
    });

    // TODO: 这里可以进一步集成任务队列服务来实际执行Dify工作流
    // 实际实现中需要：
    // 1. 将任务加入队列：await taskQueueService.enqueueTask(taskId)
    // 2. 异步调用Dify API执行工作流
    // 3. 监控任务执行状态并更新数据库

  } catch (error) {
    console.error(`[Payment Notify] AI任务触发失败:`, {
      orderId,
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date().toISOString()
    });

    // 将订单状态设置为已付款但任务创建失败
    await db
      .update(orders)
      .set({
        status: 'paid', // 保持已付款状态，但不进入处理中
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .catch(console.error);
  }
}

/**
 * POST /api/payment/notify
 * 微信支付结果通知回调
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 获取微信支付通知的XML数据
    const xmlData = await request.text();
    
    if (!xmlData) {
      console.error('[Payment Notify] 未收到通知数据');
      return new Response('FAIL', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 2. 使用微信支付服务处理通知
    const wechatPay = getWeChatPayService();
    const result = await wechatPay.handlePaymentNotification(xmlData);

    // 3. 记录通知处理结果
    console.log('[Payment Notify] 支付通知处理结果', {
      success: result.success,
      orderId: result.outTradeNo,
      transactionId: result.transactionId,
      totalFee: result.totalFee,
      timestamp: new Date().toISOString()
    });

    // 4. 根据处理结果返回响应给微信
    if (result.success) {
      // 支付成功，触发后续业务流程
      try {
        await triggerAITaskExecution(result.outTradeNo);
      } catch (error) {
        // 即使后续流程失败，也要向微信返回SUCCESS，避免重复通知
        console.error('[Payment Notify] 后续业务流程执行失败:', error);
      }

      // 返回SUCCESS给微信
      return new Response('SUCCESS', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      // 支付失败，返回FAIL给微信
      console.error('[Payment Notify] 支付失败:', result.error);
      return new Response('FAIL', {
        status: 200, // 微信要求返回200状态码
        headers: { 'Content-Type': 'text/plain' }
      });
    }

  } catch (error) {
    // 错误日志记录
    console.error('[Payment Notify] 支付通知处理异常:', error);

    // 返回FAIL给微信，微信会重试
    return new Response('FAIL', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * GET /api/payment/notify
 * 不支持GET请求
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: '该接口不支持GET请求' },
    { status: 405 }
  );
}