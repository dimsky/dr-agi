import { 
  pgTable, 
  timestamp, 
  varchar,
  uuid,
  decimal,
  json,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { aiService } from './ai_service';

// 订单状态枚举
export const orderStatusEnum = pgEnum('order_status', [
  'pending',    // 待支付
  'paid',       // 已支付
  'processing', // 处理中
  'completed',  // 已完成
  'cancelled',  // 已取消
  'refunded'    // 已退款
]);


// 支付方式枚举
export const paymentMethodEnum = pgEnum('payment_method', [
  'wechat_pay',  // 微信支付
  'alipay',      // 支付宝
  'credit_card', // 信用卡
  'bank_card'    // 银行卡
]);

// 订单表定义
export const orders = pgTable('orders', {
  // 主键
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 用户关联
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // AI服务关联
  aiServiceId: uuid('ai_service_id').notNull().references(() => aiService.id, { onDelete: 'restrict' }),
  serviceData: json('service_data').$type<Record<string, unknown>>(), // 服务相关的数据（如表单数据）
  
  // 订单状态和金额
  status: orderStatusEnum('status').notNull().default('pending'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // 订单金额
  
  // 支付相关字段
  paymentMethod: paymentMethodEnum('payment_method'),
  transactionId: varchar('transaction_id', { length: 128 }), // 支付平台交易ID
  
  // 时间戳字段
  createdAt: timestamp('created_at').notNull().defaultNow(),
  paidAt: timestamp('paid_at'), // 支付完成时间
  completedAt: timestamp('completed_at'), // 订单完成时间
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // 软删除标记
});

// 定义订单表的关系
export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  aiService: one(aiService, {
    fields: [orders.aiServiceId],
    references: [aiService.id],
  }),
}));

// 订单类型定义
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// 订单创建输入类型
export interface CreateOrderInput {
  userId: string;
  aiServiceId: string;
  serviceData?: Record<string, unknown>;
  amount: string; // 使用字符串传入，避免精度问题
  paymentMethod?: 'wechat_pay' | 'alipay' | 'credit_card' | 'bank_card';
}

// 订单更新输入类型
export interface UpdateOrderInput {
  status?: 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  paymentMethod?: 'wechat_pay' | 'alipay' | 'credit_card' | 'bank_card';
  transactionId?: string;
  paidAt?: Date;
  completedAt?: Date;
}

// 订单查询过滤器类型
export interface OrderFilters {
  userId?: string;
  aiServiceId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// 订单统计类型
export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: string;
  averageOrderValue: string;
}

