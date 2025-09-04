import { db } from '@/db';
import { tasks, Task, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskStats, DEFAULT_TASK_CONFIG, isValidTaskStatusTransition } from '@/db/schema/tasks';
import { orders } from '@/db/schema/orders';
import { aiService } from '@/db/schema/ai_service';
import { eq, and, desc, count, avg, sql } from 'drizzle-orm';
import { getDifyService } from './dify';
import { createServerClient } from '@/lib/supabase';
import type { DifyConfig, ApplicationInputs, ApplicationResult } from '@/types/dify';

/**
 * 任务队列服务
 * 管理长时间运行的AI任务，支持任务入队、状态查询、重试和取消功能
 * 集成Supabase实时通知，支持任务状态变更的实时推送
 */
class TaskQueueService {
  private supabase = createServerClient();
  
  constructor() {
    // 初始化时设置实时订阅清理机制
    this.setupCleanupHandlers();
  }

  /**
   * 创建异步任务并加入队列
   * @param taskInput 任务创建输入
   * @returns 创建的任务信息
   */
  async enqueueTask(taskInput: CreateTaskInput): Promise<Task> {
    try {
      // 验证订单存在
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, taskInput.orderId)
      });

      if (!order) {
        throw new Error(`订单不存在: ${taskInput.orderId}`);
      }

      // 验证AI服务配置存在
      const service = await db.query.aiService.findFirst({
        where: eq(aiService.id, taskInput.aiServiceId)
      });

      if (!service) {
        throw new Error(`AI服务配置不存在: ${taskInput.aiServiceId}`);
      }

      if (!service.isActive) {
        throw new Error(`AI服务已停用: ${service.displayName}`);
      }

      // 创建任务记录
      const [newTask] = await db.insert(tasks).values({
        orderId: taskInput.orderId,
        aiServiceId: taskInput.aiServiceId,
        inputData: taskInput.inputData || {},
        status: 'pending',
        retryCount: 0
      }).returning();

      // 发送实时通知
      await this.sendRealtimeNotification('task_created', {
        taskId: newTask.id,
        orderId: newTask.orderId,
        status: newTask.status,
        createdAt: newTask.createdAt
      });

      // 异步开始执行任务
      this.executeTaskAsync(newTask.id).catch(error => {
        console.error(`异步执行任务失败 ${newTask.id}:`, error);
      });

      return newTask;
    } catch (error) {
      console.error('创建任务失败:', error);
      throw new Error(`创建任务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 查询任务状态
   * @param taskId 任务ID
   * @returns 任务信息
   */
  async getTaskStatus(taskId: string): Promise<Task | null> {
    try {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        with: {
          order: {
            with: {
              user: true
            }
          },
          aiService: true
        }
      });

      return task || null;
    } catch (error) {
      console.error(`查询任务状态失败 ${taskId}:`, error);
      throw new Error(`查询任务状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 重试失败的任务
   * @param taskId 任务ID
   * @returns 是否重试成功
   */
  async retryTask(taskId: string): Promise<boolean> {
    try {
      const task = await this.getTaskStatus(taskId);
      
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      // 检查任务状态是否允许重试
      if (!isValidTaskStatusTransition(task.status, 'pending')) {
        throw new Error(`任务状态 ${task.status} 不允许重试`);
      }

      // 检查重试次数限制
      if (task.retryCount >= DEFAULT_TASK_CONFIG.maxRetries) {
        throw new Error(`任务已达到最大重试次数: ${DEFAULT_TASK_CONFIG.maxRetries}`);
      }

      // 更新任务状态为pending，增加重试次数
      await this.updateTaskStatus(taskId, {
        status: 'pending',
        retryCount: task.retryCount + 1,
        errorMessage: undefined,
        startedAt: undefined,
        completedAt: undefined
      });

      // 发送实时通知
      await this.sendRealtimeNotification('task_retried', {
        taskId,
        retryCount: task.retryCount + 1,
        status: 'pending'
      });

      // 异步重新执行任务
      this.executeTaskAsync(taskId).catch(error => {
        console.error(`异步重试任务失败 ${taskId}:`, error);
      });

      return true;
    } catch (error) {
      console.error(`重试任务失败 ${taskId}:`, error);
      throw new Error(`重试任务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 取消任务执行
   * @param taskId 任务ID
   * @returns 是否取消成功
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const task = await this.getTaskStatus(taskId);
      
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      // 检查任务状态是否允许取消
      if (!isValidTaskStatusTransition(task.status, 'cancelled')) {
        throw new Error(`任务状态 ${task.status} 不允许取消`);
      }

      // 如果任务正在运行且有Dify任务ID，尝试停止Dify任务
      if (task.status === 'running' && task.difyTaskId) {
        try {
          const aiServiceConfig = await db.query.aiService.findFirst({
            where: eq(aiService.id, task.aiServiceId)
          });

          if (aiServiceConfig && aiServiceConfig.difyApiKey && aiServiceConfig.difyBaseUrl) {
            const difyConfig: DifyConfig = {
              apiKey: aiServiceConfig.difyApiKey,
              baseUrl: aiServiceConfig.difyBaseUrl
            };

            const difyService = getDifyService(difyConfig);
            await difyService.stopTask(task.difyTaskId);
          }
        } catch (difyError) {
          console.warn(`停止Dify任务失败 ${task.difyTaskId}:`, difyError);
          // 即使停止Dify任务失败，也继续标记本地任务为已取消
        }
      }

      // 更新任务状态为cancelled
      await this.updateTaskStatus(taskId, {
        status: 'cancelled',
        completedAt: new Date()
      });

      // 发送实时通知
      await this.sendRealtimeNotification('task_cancelled', {
        taskId,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error(`取消任务失败 ${taskId}:`, error);
      throw new Error(`取消任务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取任务列表
   * @param filters 过滤条件
   * @param page 页码
   * @param limit 每页数量
   * @returns 任务列表和总数
   */
  async getTaskList(
    filters?: TaskFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ tasks: Task[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      const whereConditions = [];

      if (filters?.orderId) {
        whereConditions.push(eq(tasks.orderId, filters.orderId));
      }

      if (filters?.aiServiceId) {  
        whereConditions.push(eq(tasks.aiServiceId, filters.aiServiceId));
      }

      if (filters?.status) {
        whereConditions.push(eq(tasks.status, filters.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'));
      }

      if (filters?.dateFrom) {
        whereConditions.push(sql`${tasks.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters?.dateTo) {
        whereConditions.push(sql`${tasks.createdAt} <= ${filters.dateTo}`);
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // 查询任务列表
      const taskList = await db.query.tasks.findMany({
        where: whereClause,
        with: {
          order: {
            with: {
              user: true
            }
          },
          aiService: true
        },
        orderBy: [desc(tasks.createdAt)],
        limit,
        offset
      });

      // 查询总数
      const [{ count: total }] = await db
        .select({ count: count() })
        .from(tasks)
        .where(whereClause);

      return { tasks: taskList, total };
    } catch (error) {
      console.error('获取任务列表失败:', error);
      throw new Error(`获取任务列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取任务统计信息
   * @param filters 过滤条件
   * @returns 任务统计
   */
  async getTaskStats(filters?: TaskFilters): Promise<TaskStats> {
    try {
      const whereConditions = [];

      if (filters?.orderId) {
        whereConditions.push(eq(tasks.orderId, filters.orderId));
      }

      if (filters?.aiServiceId) {
        whereConditions.push(eq(tasks.aiServiceId, filters.aiServiceId));
      }

      if (filters?.dateFrom) {
        whereConditions.push(sql`${tasks.createdAt} >= ${filters.dateFrom}`);
      }

      if (filters?.dateTo) {
        whereConditions.push(sql`${tasks.createdAt} <= ${filters.dateTo}`);
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // 查询统计数据
      const [stats] = await db
        .select({
          totalTasks: count(),
          pendingTasks: count(sql`CASE WHEN ${tasks.status} = 'pending' THEN 1 END`),
          runningTasks: count(sql`CASE WHEN ${tasks.status} = 'running' THEN 1 END`),
          completedTasks: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
          failedTasks: count(sql`CASE WHEN ${tasks.status} = 'failed' THEN 1 END`),
          averageExecutionTime: avg(tasks.executionTime)
        })
        .from(tasks)
        .where(whereClause);

      const successRate = stats.totalTasks > 0 
        ? (stats.completedTasks / stats.totalTasks) * 100 
        : 0;

      return {
        totalTasks: stats.totalTasks,
        pendingTasks: stats.pendingTasks,
        runningTasks: stats.runningTasks,
        completedTasks: stats.completedTasks,
        failedTasks: stats.failedTasks,
        averageExecutionTime: Number(stats.averageExecutionTime) || 0,
        successRate: Number(successRate.toFixed(2))
      };
    } catch (error) {
      console.error('获取任务统计失败:', error);
      throw new Error(`获取任务统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 异步执行任务
   * @param taskId 任务ID
   */
  private async executeTaskAsync(taskId: string): Promise<void> {
    try {
      const task = await this.getTaskStatus(taskId);
      
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      if (task.status !== 'pending') {
        console.warn(`任务状态不是pending，跳过执行: ${taskId}, 当前状态: ${task.status}`);
        return;
      }

      // 更新任务状态为running
      await this.updateTaskStatus(taskId, {
        status: 'running',
        startedAt: new Date()
      });

      // 发送实时通知
      await this.sendRealtimeNotification('task_started', {
        taskId,
        status: 'running',
        startedAt: new Date().toISOString()
      });

      const startTime = Date.now();

      // 执行Dify应用
      const result = await this.executeDifyApplication(task);

      const executionTime = Math.floor((Date.now() - startTime) / 1000);

      // 更新任务状态为completed
      await this.updateTaskStatus(taskId, {
        status: 'completed',
        difyTaskId: result.id,
        outputData: result.outputs || { answer: result.answer, text: result.text },
        executionTime,
        completedAt: new Date()
      });

      // 发送实时通知
      await this.sendRealtimeNotification('task_completed', {
        taskId,
        status: 'completed',
        executionTime,
        completedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`执行任务失败 ${taskId}:`, error);

      // 更新任务状态为failed
      await this.updateTaskStatus(taskId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '未知错误',
        completedAt: new Date()
      });

      // 发送实时通知
      await this.sendRealtimeNotification('task_failed', {
        taskId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '未知错误',
        failedAt: new Date().toISOString()
      });
    }
  }

  /**
   * 执行Dify应用
   * @param task 任务信息
   * @returns 应用执行结果
   */
  private async executeDifyApplication(task: Task): Promise<ApplicationResult> {
    const aiServiceConfig = await db.query.aiService.findFirst({
      where: eq(aiService.id, task.aiServiceId)
    });

    if (!aiServiceConfig) {
      throw new Error(`AI服务配置不存在: ${task.aiServiceId}`);
    }

    if (!aiServiceConfig.difyApiKey || !aiServiceConfig.difyBaseUrl) {
      throw new Error(`AI服务Dify配置不完整: ${aiServiceConfig.displayName}`);
    }

    const difyConfig: DifyConfig = {
      apiKey: aiServiceConfig.difyApiKey,
      baseUrl: aiServiceConfig.difyBaseUrl
    };

    const difyService = getDifyService(difyConfig);
    
    // 使用统一的应用执行入口
    const result = await difyService.executeApplication(
      task.inputData as ApplicationInputs,
      {
        user: `task-${task.id}`,
        responseMode: 'blocking'
      }
    );

    return result;
  }

  /**
   * 更新任务状态
   * @param taskId 任务ID
   * @param updates 更新数据
   */
  private async updateTaskStatus(taskId: string, updates: UpdateTaskInput): Promise<void> {
    await db
      .update(tasks)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));
  }

  /**
   * 发送Supabase实时通知
   * @param eventType 事件类型
   * @param payload 事件数据
   */
  private async sendRealtimeNotification(eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      // 向Supabase实时频道发送消息
      await this.supabase.channel('task-updates').send({
        type: 'broadcast',
        event: eventType,
        payload
      });
    } catch (error) {
      console.warn('发送实时通知失败:', error);
      // 实时通知失败不应该影响主要业务逻辑
    }
  }

  /**
   * 设置清理处理程序
   */
  private setupCleanupHandlers(): void {
    // 进程退出时清理资源
    const cleanup = () => {
      this.supabase.removeAllChannels();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  /**
   * 订阅任务状态变更
   * @param callback 回调函数
   * @returns 取消订阅函数
   */
  subscribeToTaskUpdates(callback: (payload: Record<string, unknown>) => void): () => void {
    const channel = this.supabase
      .channel('task-updates')
      .on('broadcast', { event: '*' }, callback)
      .subscribe();

    return () => {
      this.supabase.removeChannel(channel);
    };
  }

  /**
   * 健康检查
   * @returns 服务健康状态
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    database: boolean;
    supabase: boolean;
    pendingTasks: number;
  }> {
    try {
      // 检查数据库连接
      const [{ count: pendingTasks }] = await db
        .select({ count: count() })
        .from(tasks)
        .where(eq(tasks.status, 'pending'));

      // 检查Supabase连接（简单检查实例是否存在）
      const supabaseHealthy = !!this.supabase;

      const isHealthy = supabaseHealthy;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        database: true, // 如果能查询到pending任务数量，说明数据库连接正常
        supabase: supabaseHealthy,
        pendingTasks
      };
    } catch (error) {
      console.error('健康检查失败:', error);
      return {
        status: 'unhealthy',
        database: false,
        supabase: false,
        pendingTasks: 0
      };
    }
  }
}

// 导出单例实例
export const taskQueueService = new TaskQueueService();

// 导出类型
export type { TaskQueueService };