import { NextRequest, NextResponse } from 'next/server';
import { taskQueueService } from '@/services/task-queue';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';

/**
 * 任务状态查询API
 * GET /api/tasks/[taskId] - 查询指定任务的执行状态
 * 
 * 功能：
 * 1. 验证用户权限（用户只能查询自己的任务）
 * 2. 查询任务执行状态、进度、结果、错误信息
 * 3. 支持实时状态查询
 * 4. 返回完整的任务信息用于前端展示
 */

interface TaskStatusResponse {
  success: boolean;
  data?: {
    id: string;
    orderId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: number; // 0-100 的进度百分比
    result?: Record<string, unknown>; // 任务执行结果
    error?: string; // 错误信息
    difyTaskId?: string | null; // Dify任务ID
    executionTime?: number | null; // 执行时间（秒）
    retryCount: number; // 重试次数
    startedAt?: string | null; // 开始执行时间
    completedAt?: string | null; // 完成时间
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
    // 关联的订单和服务信息
    order?: {
      id: string;
      amount: string;
      status: string;
      createdAt: string;
    };
    aiService?: {
      id: string;
      displayName: string;
      description?: string | null;
    };
  };
  message?: string;
  error?: string;
  timestamp: string;
}

/**
 * 计算任务进度百分比
 * 根据任务状态和执行时间估算进度
 */
function calculateTaskProgress(
  status: string, 
  startedAt?: Date | null, 
  executionTime?: number | null
): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'running':
      if (startedAt) {
        // 根据已运行时间估算进度（假设最大执行时间为5分钟）
        const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        const maxEstimatedTime = 300; // 5分钟
        const progress = Math.min((elapsedSeconds / maxEstimatedTime) * 80, 80); // 最多到80%
        return Math.round(progress);
      }
      return 10; // 刚开始执行
    case 'completed':
      return 100;
    case 'failed':
    case 'cancelled':
      return executionTime ? 100 : 0; // 如果有执行时间说明至少开始了
    default:
      return 0;
  }
}

/**
 * GET /api/tasks/[taskId]
 * 查询任务状态和详细信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
): Promise<NextResponse<TaskStatusResponse>> {
  try {
    const { taskId } = await params;
    console.log('🔍 开始查询任务状态:', taskId);

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

    // 验证taskId参数
    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少任务ID参数',
        message: '请提供有效的任务ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log('👤 用户查询任务:', { userId, taskId });

    // 使用任务队列服务查询任务状态
    const task = await taskQueueService.getTaskStatus(taskId);

    if (!task) {
      console.log('❌ 任务不存在:', taskId);
      return NextResponse.json({
        success: false,
        error: '任务不存在',
        message: `任务ID ${taskId} 不存在或已被删除`,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // 验证用户权限：用户只能查询自己的任务
    // 通过任务关联的订单来验证用户权限
    const taskOrder = await db.query.orders.findFirst({
      where: eq(orders.id, task.orderId)
    });

    if (!taskOrder || taskOrder.userId !== userId) {
      console.log('❌ 权限验证失败:', { 
        taskId, 
        taskUserId: taskOrder?.userId, 
        requestUserId: userId 
      });
      return NextResponse.json({
        success: false,
        error: '无权限访问该任务',
        message: '您只能查询自己创建的任务',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }

    // 获取关联的AI服务信息
    const taskService = await db.query.aiService.findFirst({
      where: eq(aiService.id, task.aiServiceId)
    });

    // 计算任务进度
    const progress = calculateTaskProgress(
      task.status, 
      task.startedAt, 
      task.executionTime
    );

    // 构建响应数据
    const responseData = {
      id: task.id,
      orderId: task.orderId,
      status: task.status,
      progress,
      result: task.outputData || undefined,
      error: task.errorMessage || undefined,
      difyTaskId: task.difyTaskId,
      executionTime: task.executionTime,
      retryCount: task.retryCount,
      startedAt: task.startedAt?.toISOString() || null,
      completedAt: task.completedAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      // 包含关联的订单信息  
      order: taskOrder ? {
        id: taskOrder.id,
        amount: taskOrder.amount,
        status: taskOrder.status,
        createdAt: taskOrder.createdAt.toISOString()
      } : undefined,
      // 包含关联的AI服务信息
      aiService: taskService ? {
        id: taskService.id,
        displayName: taskService.displayName,
        description: taskService.description
      } : undefined
    };

    console.log('✅ 任务状态查询成功:', { 
      taskId, 
      status: task.status, 
      progress,
      userId 
    });

    // 根据任务状态返回不同的消息
    let message = '';
    switch (task.status) {
      case 'pending':
        message = '任务已创建，等待执行中...';
        break;
      case 'running':
        message = '任务正在执行中，请稍候...';
        break;
      case 'completed':
        message = '任务执行完成';
        break;
      case 'failed':
        message = '任务执行失败';
        break;
      case 'cancelled':
        message = '任务已取消';
        break;
      default:
        message = '任务状态未知';
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 查询任务状态失败:', error);

    // 根据错误类型返回不同的错误信息
    let errorMessage = '查询任务状态失败';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('数据库')) {
        errorMessage = '数据库查询失败，请稍后重试';
      } else if (error.message.includes('网络')) {
        errorMessage = '网络连接失败，请检查网络状态';
      } else if (error.message.includes('权限')) {
        errorMessage = '权限验证失败，请重新登录';
        statusCode = 403;
      } else if (error.message.includes('不存在')) {
        errorMessage = '任务不存在或已被删除';
        statusCode = 404;
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      message: '请稍后重试，如问题持续请联系技术支持',
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}

/**
 * OPTIONS /api/tasks/[taskId]
 * 处理CORS预检请求
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    }
  });
}