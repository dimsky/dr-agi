import { 
  pgTable, 
  text, 
  timestamp, 
  boolean, 
  varchar,
  uuid,
  json
} from 'drizzle-orm/pg-core';

// 注意：不再使用固定的服务类型枚举，服务类型将根据后台动态添加的AI服务确定

// AI服务表定义
export const aiService = pgTable('ai_service', {
  // 主键
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 显示信息
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Dify集成配置
  difyApiKey: varchar('dify_api_key', { length: 256 }), // Dify API密钥
  difyBaseUrl: varchar('dify_base_url', { length: 512 }), // Dify服务基础URL
  
  // 本地配置数据（非AI相关的业务配置）
  pricing: json('pricing').$type<{
    basePrice: number;
    currency: string;
    priceType: 'fixed' | 'variable' | 'tiered';
    tiers?: Array<{
      minQuantity: number;
      maxQuantity?: number;
      price: number;
    }>;
    discounts?: Array<{
      type: 'percentage' | 'fixed';
      value: number;
      condition?: string;
    }>;
  }>(), // 定价配置
  
  // 状态控制
  isActive: boolean('is_active').notNull().default(true),
  
  // 时间戳字段
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // 软删除标记
});

// AI服务类型定义
export type AiService = typeof aiService.$inferSelect;
export type InsertAiService = typeof aiService.$inferInsert;

// AI服务创建输入类型
export interface CreateAiServiceInput {
  displayName: string;
  description?: string;
  difyApiKey?: string;
  difyBaseUrl?: string;
  pricing?: {
    basePrice: number;
    currency: string;
    priceType: 'fixed' | 'variable' | 'tiered';
    tiers?: Array<{
      minQuantity: number;
      maxQuantity?: number;
      price: number;
    }>;
    discounts?: Array<{
      type: 'percentage' | 'fixed';
      value: number;
      condition?: string;
    }>;
  };
  isActive?: boolean;
}

// AI服务更新输入类型
export interface UpdateAiServiceInput {
  displayName?: string;
  description?: string;
  difyApiKey?: string;
  difyBaseUrl?: string;
  pricing?: {
    basePrice: number;
    currency: string;
    priceType: 'fixed' | 'variable' | 'tiered';
    tiers?: Array<{
      minQuantity: number;
      maxQuantity?: number;
      price: number;
    }>;
    discounts?: Array<{
      type: 'percentage' | 'fixed';
      value: number;
      condition?: string;
    }>;
  };
  isActive?: boolean;
}

// AI服务查询过滤器类型
export interface AiServiceFilters {
  id?: string;
  displayName?: string;
  isActive?: boolean;
}

// 预定义的AI服务常量（不包含AI相关的schema，这些将通过API动态获取）
export const DEFAULT_AI_SERVICES: Record<string, CreateAiServiceInput> = {
  nutrition_plan: {
    displayName: '营养方案制定',
    description: '根据患者情况制定个性化营养方案，包含营养评估、膳食指导和营养补充建议',
    pricing: {
      basePrice: 199,
      currency: 'CNY',
      priceType: 'fixed'
    }
  },
  health_management_plan: {
    displayName: '健康管理方案制定',
    description: '制定综合健康管理方案，包含生活方式指导、健康监测计划和预防措施',
    pricing: {
      basePrice: 299,
      currency: 'CNY',
      priceType: 'fixed'
    }
  },
  wellness_plan: {
    displayName: '养生方案制定',
    description: '基于中医理论和现代医学，制定个性化养生保健方案',
    pricing: {
      basePrice: 149,
      currency: 'CNY',
      priceType: 'fixed'
    }
  },
  clinical_research_match: {
    displayName: '临床研究匹配查询',
    description: '根据患者条件匹配合适的临床研究项目，提供参与机会',
    pricing: {
      basePrice: 99,
      currency: 'CNY',
      priceType: 'fixed'
    }
  },
  literature_analysis: {
    displayName: '文献解读工具',
    description: '深度解读医学文献，提供专业分析和临床意义解释',
    pricing: {
      basePrice: 79,
      currency: 'CNY',
      priceType: 'variable'
    }
  },
  clinical_research_design: {
    displayName: '临床研究方案撰写',
    description: '协助撰写标准的临床研究方案，包含研究设计、统计分析计划等',
    pricing: {
      basePrice: 499,
      currency: 'CNY',
      priceType: 'tiered',
      tiers: [
        { minQuantity: 1, maxQuantity: 1, price: 499 },
        { minQuantity: 2, maxQuantity: 5, price: 399 },
        { minQuantity: 6, price: 299 }
      ]
    }
  },
  data_statistical_analysis: {
    displayName: '数据统计分析',
    description: '提供专业的医学数据统计分析服务，包含描述性统计和推断性统计',
    pricing: {
      basePrice: 299,
      currency: 'CNY',
      priceType: 'variable'
    }
  }
};