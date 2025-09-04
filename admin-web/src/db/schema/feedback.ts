import { 
  pgTable, 
  text, 
  timestamp, 
  varchar,
  uuid,
  pgEnum
} from 'drizzle-orm/pg-core';
import { users } from './users';

// 反馈状态枚举
export const feedbackStatusEnum = pgEnum('feedback_status', [
  'pending',    // 待处理
  'reviewing',  // 审查中
  'responded',  // 已回复
  'resolved',   // 已解决
  'closed'      // 已关闭
]);

// 反馈分类枚举
export const feedbackCategoryEnum = pgEnum('feedback_category', [
  'bug_report',        // 错误报告
  'feature_request',   // 功能建议
  'improvement',       // 改进建议
  'user_experience',   // 用户体验
  'performance',       // 性能问题
  'content_quality',   // 内容质量
  'service_quality',   // 服务质量
  'other'             // 其他
]);

// 反馈表定义
export const feedback = pgTable('feedback', {
  // 主键
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 用户关联
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 反馈基础信息
  feedbackNumber: varchar('feedback_number', { length: 20 }).notNull().unique(), // 反馈编号，用于用户跟踪
  category: feedbackCategoryEnum('category').notNull(), // 反馈分类
  title: varchar('title', { length: 200 }).notNull(), // 反馈标题
  content: text('content').notNull(), // 反馈详细内容
  
  // 状态管理
  status: feedbackStatusEnum('status').notNull().default('pending'),
  
  // 管理员处理
  adminResponse: text('admin_response'), // 管理员回复内容
  adminId: uuid('admin_id'), // 处理的管理员ID（暂时不关联，预留字段）
  respondedAt: timestamp('responded_at'), // 回复时间
  resolvedAt: timestamp('resolved_at'), // 解决时间
  
  // 时间戳字段
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // 软删除标记
});

// 反馈表类型定义
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// 反馈创建输入类型
export interface CreateFeedbackInput {
  userId: string;
  category: 'bug_report' | 'feature_request' | 'improvement' | 'user_experience' | 
           'performance' | 'content_quality' | 'service_quality' | 'other';
  title: string;
  content: string;
  feedbackNumber?: string; // 如果不提供，系统自动生成
}

// 反馈更新输入类型
export interface UpdateFeedbackInput {
  status?: 'pending' | 'reviewing' | 'responded' | 'resolved' | 'closed';
  adminResponse?: string;
  adminId?: string;
  respondedAt?: Date;
  resolvedAt?: Date;
}

// 反馈查询过滤器类型
export interface FeedbackFilters {
  userId?: string;
  category?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  adminId?: string;
}

// 反馈统计类型
export interface FeedbackStats {
  totalFeedback: number;
  pendingFeedback: number;
  resolvedFeedback: number;
  averageResponseTime: number; // 平均响应时间（小时）
  categoryDistribution: Record<string, number>; // 各分类的数量分布
}

// 反馈分类配置接口
export interface FeedbackCategoryConfig {
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expectedResponseTime: string; // 预期回复时间
}

// 反馈分类配置映射
export const FEEDBACK_CATEGORY_CONFIGS: Record<string, FeedbackCategoryConfig> = {
  bug_report: {
    name: '错误报告',
    description: '报告系统错误或故障',
    priority: 'high',
    expectedResponseTime: '24小时内'
  },
  feature_request: {
    name: '功能建议',
    description: '建议新功能或改进现有功能',
    priority: 'medium',
    expectedResponseTime: '3-5个工作日'
  },
  improvement: {
    name: '改进建议',
    description: '对现有功能的改进建议',
    priority: 'medium',
    expectedResponseTime: '3-5个工作日'
  },
  user_experience: {
    name: '用户体验',
    description: '关于用户界面和交互体验的反馈',
    priority: 'medium',
    expectedResponseTime: '2-3个工作日'
  },
  performance: {
    name: '性能问题',
    description: '系统性能相关问题',
    priority: 'high',
    expectedResponseTime: '48小时内'
  },
  content_quality: {
    name: '内容质量',
    description: '对内容准确性和质量的反馈',
    priority: 'high',
    expectedResponseTime: '24小时内'
  },
  service_quality: {
    name: '服务质量',
    description: '对医疗服务质量的反馈',
    priority: 'urgent',
    expectedResponseTime: '12小时内'
  },
  other: {
    name: '其他',
    description: '其他类型的反馈和建议',
    priority: 'low',
    expectedResponseTime: '5-7个工作日'
  }
};

// 反馈编号生成函数（工具函数）
export function generateFeedbackNumber(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `FB${timestamp}${random}`.toUpperCase();
}

// 反馈状态中文映射
export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  reviewing: '审查中',
  responded: '已回复',
  resolved: '已解决',
  closed: '已关闭'
};

// 反馈优先级排序（用于管理后台显示）
export const FEEDBACK_PRIORITY_ORDER = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4
};