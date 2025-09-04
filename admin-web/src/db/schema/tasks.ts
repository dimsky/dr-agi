import { 
  pgTable, 
  text, 
  timestamp, 
  varchar,
  uuid,
  json,
  integer,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orders } from './orders';
import { aiService } from './ai_service';

// 任务状态枚举
export const taskStatusEnum = pgEnum('task_status', [
  'pending',    // 等待执行
  'running',    // 执行中
  'completed',  // 已完成
  'failed',     // 执行失败
  'cancelled'   // 已取消
]);

// 任务表定义
export const tasks = pgTable('tasks', {
  // 主键
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 关联订单
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  
  // 关联AI服务
  aiServiceId: uuid('ai_service_id').notNull().references(() => aiService.id, { onDelete: 'restrict' }),
  
  // Dify相关字段
  difyTaskId: varchar('dify_task_id', { length: 128 }), // Dify任务ID (如workflow_run_id, message_id等)
  difyExecutionId: varchar('dify_execution_id', { length: 128 }), // Dify执行ID (已废弃，保留兼容性)
  
  // 任务状态和数据
  status: taskStatusEnum('status').notNull().default('pending'),
  inputData: json('input_data').$type<Record<string, unknown>>(), // 任务输入数据
  outputData: json('output_data').$type<Record<string, unknown>>(), // 任务输出结果
  
  // 错误处理
  errorMessage: text('error_message'), // 错误消息
  retryCount: integer('retry_count').notNull().default(0), // 重试次数
  
  // 执行监控
  executionTime: integer('execution_time'), // 执行时间（秒）
  startedAt: timestamp('started_at'), // 开始执行时间
  completedAt: timestamp('completed_at'), // 完成时间
  
  // 时间戳字段
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // 软删除标记
});

// 定义任务表的关系
export const tasksRelations = relations(tasks, ({ one }) => ({
  order: one(orders, {
    fields: [tasks.orderId],
    references: [orders.id],
  }),
  aiService: one(aiService, {
    fields: [tasks.aiServiceId],
    references: [aiService.id],
  }),
}));

// 任务类型定义
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// 任务创建输入类型
export interface CreateTaskInput {
  orderId: string;
  aiServiceId: string;
  inputData?: Record<string, unknown>;
}

// 任务更新输入类型
export interface UpdateTaskInput {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  difyTaskId?: string;
  difyExecutionId?: string; // 保留兼容性
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
  retryCount?: number;
  executionTime?: number;
  startedAt?: Date;
  completedAt?: Date;
}

// 任务查询过滤器类型
export interface TaskFilters {
  orderId?: string;
  aiServiceId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// 任务统计类型
export interface TaskStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number; // 平均执行时间（秒）
  successRate: number; // 成功率（百分比）
}

// 任务执行配置接口
export interface TaskExecutionConfig {
  maxRetries: number;
  timeoutDuration: number; // 超时时间（秒）
  retryDelay: number; // 重试延迟（秒）
}

// 默认任务执行配置
export const DEFAULT_TASK_CONFIG: TaskExecutionConfig = {
  maxRetries: 3,
  timeoutDuration: 3600, // 1小时
  retryDelay: 60 // 1分钟
};

// 任务状态转换规则
export const TASK_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [], // 完成状态不能转换
  failed: ['pending', 'running'], // 失败可以重试
  cancelled: [] // 取消状态不能转换
};

// 验证任务状态转换是否有效
export function isValidTaskStatusTransition(from: string, to: string): boolean {
  return TASK_STATUS_TRANSITIONS[from]?.includes(to) || false;
}