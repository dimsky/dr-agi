import { 
  pgTable, 
  text, 
  timestamp, 
  boolean, 
  varchar,
  uuid
} from 'drizzle-orm/pg-core';

// 用户表定义
export const users = pgTable('users', {
  // 主键
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 微信相关字段
  openId: varchar('open_id', { length: 128 }).notNull().unique(),
  unionId: varchar('union_id', { length: 128 }),
  nickname: varchar('nickname', { length: 100 }),
  avatarUrl: text('avatar_url'),
  gender: varchar('gender', { length: 10 }),
  city: varchar('city', { length: 50 }),
  province: varchar('province', { length: 50 }),
  country: varchar('country', { length: 50 }),
  language: varchar('language', { length: 20 }),
  
  // 业务相关字段
  email: varchar('email', { length: 255 }),
  profession: varchar('profession', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  
  // 系统字段
  role: varchar('role', { length: 20 }).notNull().default('user'), // 用户角色: user | admin
  registeredAt: timestamp('registered_at').notNull().defaultNow(),
  consentAgreedAt: timestamp('consent_agreed_at'),
  consentVersion: varchar('consent_version', { length: 20 }),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // 软删除标记
});

// 微信用户信息类型定义
export interface WeChatUserInfo {
  openId: string;
  unionId?: string;
  nickname?: string;
  avatarUrl?: string;
  gender?: 0 | 1 | 2; // 0: 未知, 1: 男性, 2: 女性
  city?: string;
  province?: string;
  country?: string;
  language?: string;
}

// 微信会话信息类型定义
export interface WeChatSession {
  openId: string;
  sessionKey: string;
  unionId?: string;
}

// 用户表类型
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 用户创建输入类型
export interface CreateUserInput {
  openId: string;
  unionId?: string;
  nickname?: string;
  avatarUrl?: string;
  gender?: string;
  city?: string;
  province?: string;
  country?: string;
  language?: string;
  email?: string;
  profession?: string;
  phone?: string;
  consentAgreedAt?: Date;
  consentVersion?: string;
}

// 用户角色枚举
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// 用户更新输入类型
export interface UpdateUserInput {
  nickname?: string;
  avatarUrl?: string;
  email?: string;
  profession?: string;
  phone?: string;
  role?: UserRole;
  lastLoginAt?: Date;
  isActive?: boolean;
}