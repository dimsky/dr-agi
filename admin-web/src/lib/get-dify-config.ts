import { db } from '@/db';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';
import type { DifyConfig } from '@/types/dify';

/**
 * 从数据库获取指定服务的Dify配置
 * @param serviceId 服务ID
 * @returns Dify配置
 */
export async function getDifyConfigFromDB(serviceId: string): Promise<DifyConfig> {
  try {
    const config = await db
      .select({
        difyApiKey: aiService.difyApiKey,
        difyBaseUrl: aiService.difyBaseUrl,
      })
      .from(aiService)
      .where(eq(aiService.id, serviceId))
      .limit(1);

    if (!config[0]) {
      throw new Error(`Service configuration not found for service ID: ${serviceId}`);
    }

    const { difyApiKey, difyBaseUrl } = config[0];

    if (!difyApiKey || !difyBaseUrl) {
      throw new Error(`Dify configuration incomplete for service ID: ${serviceId}. Missing apiKey or baseUrl.`);
    }

    return {
      apiKey: difyApiKey,
      baseUrl: difyBaseUrl,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
    };
  } catch (error) {
    console.error(`Failed to get Dify config for service ${serviceId}:`, error);
    throw error;
  }
}

/**
 * 从数据库获取所有有效的Dify服务配置
 * @returns 服务ID到配置的映射
 */
export async function getAllDifyConfigs(): Promise<Record<string, DifyConfig>> {
  try {
    const configs = await db
      .select({
        serviceId: aiService.id,
        difyApiKey: aiService.difyApiKey,
        difyBaseUrl: aiService.difyBaseUrl,
      })
      .from(aiService)
      .where(eq(aiService.isActive, true));

    const result: Record<string, DifyConfig> = {};

    for (const config of configs) {
      if (config.difyApiKey && config.difyBaseUrl) {
        result[config.serviceId] = {
          apiKey: config.difyApiKey,
          baseUrl: config.difyBaseUrl,
          timeout: 30000,
          maxRetries: 3,
          retryDelay: 1000,
        };
      }
    }

    return result;
  } catch (error) {
    console.error('Failed to get all Dify configs:', error);
    throw error;
  }
}

/**
 * 检查指定服务是否配置了Dify
 * @param serviceId 服务ID
 * @returns 是否已配置
 */
export async function isDifyConfigured(serviceId: string): Promise<boolean> {
  try {
    const config = await db
      .select({
        difyApiKey: aiService.difyApiKey,
        difyBaseUrl: aiService.difyBaseUrl,
      })
      .from(aiService)
      .where(eq(aiService.id, serviceId))
      .limit(1);

    return !!(config[0]?.difyApiKey && config[0]?.difyBaseUrl);
  } catch (error) {
    console.error(`Failed to check Dify config for service ${serviceId}:`, error);
    return false;
  }
}