import { db } from '@/db';
import { aiService, AiService, AiServiceFilters } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';
import { getDifyService } from './dify';
import { taskQueueService } from './task-queue';
import { withSoftDeleteFilter } from '@/lib/soft-delete';
import type { 
  DifyConfig, 
  ApplicationInputs, 
  ApplicationResult,
  InputValidationResult
} from '@/types/dify';

/**
 * 医疗服务输入验证规则
 */
export interface ServiceValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'file';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  customValidator?: (value: unknown) => { isValid: boolean; message?: string };
}

/**
 * 医疗服务配置
 */
export interface MedicalServiceConfig {
  id: string;
  displayName: string;
  description?: string;
  difyConfig: DifyConfig;
  validationRules: ServiceValidationRule[];
  inputProcessors: Array<(input: Record<string, unknown>) => Record<string, unknown>>;
  outputProcessors: Array<(output: Record<string, unknown>) => Record<string, unknown>>;
  pricing: AiService['pricing'];
  isActive: boolean;
}

/**
 * 服务执行结果
 */
export interface MedicalServiceResult {
  success: boolean;
  serviceId: string;
  serviceName: string;
  taskId?: string;
  result?: ApplicationResult;
  processedOutput?: Record<string, unknown>;
  error?: string;
  executionTime?: number;
  timestamp: string;
}

/**
 * 服务执行选项
 */
export interface ServiceExecutionOptions {
  userId?: string;
  orderId?: string;
  async?: boolean;
  timeout?: number;
  retryOnFailure?: boolean;
  validateInput?: boolean;
}

/**
 * 动态AI服务处理器
 * 提供通用的医疗AI服务处理引擎，支持动态配置和执行
 */
class MedicalServiceProcessor {
  private serviceCache = new Map<string, MedicalServiceConfig>();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
  private cacheTimestamps = new Map<string, number>();

  constructor() {
    this.initializeDefaultValidationRules();
  }

  /**
   * 获取可用的医疗服务列表
   * @param filters 过滤条件
   * @returns 服务配置列表
   */
  async getAvailableServices(filters?: AiServiceFilters): Promise<MedicalServiceConfig[]> {
    try {
      const whereConditions = [];

      if (filters?.id) {
        whereConditions.push(eq(aiService.id, filters.id));
      }

      if (filters?.displayName) {
        whereConditions.push(eq(aiService.displayName, filters.displayName));
      }

      if (filters?.isActive !== undefined) {
        whereConditions.push(eq(aiService.isActive, filters.isActive));
      }
      // 注意：如果没有指定 isActive 筛选条件，则返回所有活跃服务（不论激活状态）
      // 但仍然会过滤掉已删除的服务

      // 使用软删除过滤器，只获取未删除的服务
      const whereClause = withSoftDeleteFilter(whereConditions, aiService.deletedAt);

      const services = await db.query.aiService.findMany({
        where: whereClause,
        orderBy: aiService.displayName
      });

      const configs = await Promise.all(
        services.map(service => this.buildServiceConfig(service))
      );

      return configs.filter(config => config !== null) as MedicalServiceConfig[];
    } catch (error) {
      console.error('获取可用服务失败:', error);
      throw new Error(`获取可用服务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取特定服务配置
   * @param serviceId 服务ID
   * @param useCache 是否使用缓存
   * @returns 服务配置
   */
  async getServiceConfig(serviceId: string, useCache: boolean = true): Promise<MedicalServiceConfig | null> {
    try {
      // 检查缓存
      if (useCache && this.isCacheValid(serviceId)) {
        const cached = this.serviceCache.get(serviceId);
        if (cached) {
          return cached;
        }
      }

      // 使用软删除过滤器，只获取未删除的服务
      const whereConditions = [eq(aiService.id, serviceId)];
      const whereClause = withSoftDeleteFilter(whereConditions, aiService.deletedAt);

      const service = await db.query.aiService.findFirst({
        where: whereClause
      });

      if (!service) {
        return null;
      }

      const config = await this.buildServiceConfig(service);
      
      // 更新缓存
      if (config) {
        this.serviceCache.set(serviceId, config);
        this.cacheTimestamps.set(serviceId, Date.now());
      }

      return config;
    } catch (error) {
      console.error(`获取服务配置失败 ${serviceId}:`, error);
      throw new Error(`获取服务配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行医疗服务
   * @param serviceId 服务ID
   * @param inputData 输入数据
   * @param options 执行选项
   * @returns 服务执行结果
   */
  async executeService(
    serviceId: string,
    inputData: Record<string, unknown>,
    options: ServiceExecutionOptions = {}
  ): Promise<MedicalServiceResult> {
    const startTime = Date.now();

    try {
      // 获取服务配置
      const serviceConfig = await this.getServiceConfig(serviceId);
      
      if (!serviceConfig) {
        throw new Error(`服务不存在或不可用: ${serviceId}`);
      }

      if (!serviceConfig.isActive) {
        throw new Error(`服务已停用: ${serviceConfig.displayName}`);
      }

      // 验证输入数据
      if (options.validateInput !== false) {
        const validationResult = await this.validateServiceInput(serviceConfig, inputData);
        if (!validationResult.isValid) {
          const errors = validationResult.errors.map(e => `${e.field}: ${e.message}`).join('; ');
          throw new Error(`输入数据验证失败: ${errors}`);
        }
      }

      // 处理输入数据
      const processedInput = await this.processServiceInput(serviceConfig, inputData);

      // 决定执行方式
      if (options.async && options.orderId) {
        // 异步执行，创建任务
        const task = await taskQueueService.enqueueTask({
          orderId: options.orderId,
          aiServiceId: serviceId,
          inputData: processedInput
        });

        return {
          success: true,
          serviceId,
          serviceName: serviceConfig.displayName,
          taskId: task.id,
          timestamp: new Date().toISOString()
        };
      } else {
        // 同步执行
        const result = await this.executeDifyService(serviceConfig, processedInput, options);
        const processedOutput = await this.processServiceOutput(serviceConfig, result);

        return {
          success: true,
          serviceId,
          serviceName: serviceConfig.displayName,
          result,
          processedOutput,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error(`执行服务失败 ${serviceId}:`, error);
      
      return {
        success: false,
        serviceId,
        serviceName: serviceId, // 如果无法获取配置，使用ID作为名称
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 批量执行医疗服务
   * @param requests 服务请求列表
   * @returns 批量执行结果
   */
  async batchExecuteServices(
    requests: Array<{
      serviceId: string;
      inputData: Record<string, unknown>;
      options?: ServiceExecutionOptions;
    }>
  ): Promise<MedicalServiceResult[]> {
    const results = await Promise.allSettled(
      requests.map(request => 
        this.executeService(request.serviceId, request.inputData, request.options)
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          serviceId: requests[index].serviceId,
          serviceName: requests[index].serviceId,
          error: result.reason instanceof Error ? result.reason.message : '批量执行失败',
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  /**
   * 验证服务输入数据
   * @param serviceConfig 服务配置
   * @param inputData 输入数据
   * @returns 验证结果
   */
  async validateServiceInput(
    serviceConfig: MedicalServiceConfig,
    inputData: Record<string, unknown>
  ): Promise<InputValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];

    try {
      for (const rule of serviceConfig.validationRules) {
        const value = inputData[rule.field];

        // 检查必填字段
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({ field: rule.field, message: '此字段为必填项' });
          continue;
        }

        // 如果字段为空且非必填，跳过后续验证
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // 类型验证
        if (!this.validateFieldType(value, rule.type)) {
          errors.push({ field: rule.field, message: `字段类型必须为${rule.type}` });
          continue;
        }

        // 字符串长度验证
        if (rule.type === 'string' && typeof value === 'string') {
          if (rule.minLength !== undefined && value.length < rule.minLength) {
            errors.push({ field: rule.field, message: `长度不能少于${rule.minLength}个字符` });
          }
          if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            errors.push({ field: rule.field, message: `长度不能超过${rule.maxLength}个字符` });
          }
        }

        // 数值范围验证
        if (rule.type === 'number' && typeof value === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            errors.push({ field: rule.field, message: `数值不能小于${rule.min}` });
          }
          if (rule.max !== undefined && value > rule.max) {
            errors.push({ field: rule.field, message: `数值不能大于${rule.max}` });
          }
        }

        // 正则表达式验证
        if (rule.pattern && typeof value === 'string') {
          if (!rule.pattern.test(value)) {
            errors.push({ field: rule.field, message: '字段格式不正确' });
          }
        }

        // 允许值验证
        if (rule.allowedValues && rule.allowedValues.length > 0) {
          if (!rule.allowedValues.includes(String(value))) {
            errors.push({ 
              field: rule.field, 
              message: `值必须为以下之一: ${rule.allowedValues.join(', ')}` 
            });
          }
        }

        // 自定义验证器
        if (rule.customValidator) {
          const customResult = rule.customValidator(value);
          if (!customResult.isValid) {
            errors.push({ 
              field: rule.field, 
              message: customResult.message || '自定义验证失败' 
            });
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('输入验证失败:', error);
      return {
        isValid: false,
        errors: [{ field: 'general', message: '输入验证过程中发生错误' }]
      };
    }
  }

  /**
   * 处理服务输入数据
   * @param serviceConfig 服务配置
   * @param inputData 原始输入数据
   * @returns 处理后的输入数据
   */
  private async processServiceInput(
    serviceConfig: MedicalServiceConfig,
    inputData: Record<string, unknown>
  ): Promise<ApplicationInputs> {
    let processedData = { ...inputData };

    try {
      // 依次应用所有输入处理器
      for (const processor of serviceConfig.inputProcessors) {
        processedData = processor(processedData);
      }

      return processedData as ApplicationInputs;
    } catch (error) {
      console.error('输入数据处理失败:', error);
      throw new Error(`输入数据处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 处理服务输出数据
   * @param serviceConfig 服务配置
   * @param result Dify执行结果
   * @returns 处理后的输出数据
   */
  private async processServiceOutput(
    serviceConfig: MedicalServiceConfig,
    result: ApplicationResult
  ): Promise<Record<string, unknown>> {
    let processedData: Record<string, unknown> = {
      ...result.outputs,
      answer: result.answer,
      text: result.text
    };

    try {
      // 依次应用所有输出处理器
      for (const processor of serviceConfig.outputProcessors) {
        processedData = processor(processedData);
      }

      return processedData;
    } catch (error) {
      console.error('输出数据处理失败:', error);
      // 输出处理失败不应该影响核心功能，返回原始数据
      return {
        ...result.outputs,
        answer: result.answer,
        text: result.text
      };
    }
  }

  /**
   * 执行Dify服务
   * @param serviceConfig 服务配置
   * @param inputData 输入数据
   * @param options 执行选项
   * @returns 执行结果
   */
  private async executeDifyService(
    serviceConfig: MedicalServiceConfig,
    inputData: ApplicationInputs,
    options: ServiceExecutionOptions
  ): Promise<ApplicationResult> {
    try {
      const difyService = getDifyService(serviceConfig.difyConfig);

      // 检查Dify服务配置
      if (!difyService.isConfigured()) {
        throw new Error(`Dify服务配置不完整: ${serviceConfig.displayName}`);
      }

      // 执行应用
      const result = await difyService.executeApplication(inputData, {
        user: options.userId || 'medical-service-user',
        responseMode: 'blocking'
      });

      return result;
    } catch (error) {
      console.error(`Dify服务执行失败 ${serviceConfig.id}:`, error);
      throw new Error(`AI服务执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 构建服务配置
   * @param service 数据库服务记录
   * @returns 服务配置
   */
  private async buildServiceConfig(service: AiService): Promise<MedicalServiceConfig | null> {
    try {
      // 注意：对于管理界面，我们不过滤掉没有Dify配置的服务
      // 这样管理员可以看到所有服务并进行编辑配置
      const difyConfig: DifyConfig = {
        apiKey: service.difyApiKey || '',
        baseUrl: service.difyBaseUrl || ''
      };

      // 根据服务显示名称获取验证规则和处理器
      const validationRules = this.getValidationRulesForService(service.displayName);
      const inputProcessors = this.getInputProcessorsForService(service.displayName);
      const outputProcessors = this.getOutputProcessorsForService(service.displayName);

      return {
        id: service.id,
        displayName: service.displayName,
        description: service.description || undefined,
        difyConfig,
        validationRules,
        inputProcessors,
        outputProcessors,
        pricing: service.pricing,
        isActive: service.isActive
      };
    } catch (error) {
      console.error(`构建服务配置失败 ${service.id}:`, error);
      return null;
    }
  }

  /**
   * 检查缓存是否有效
   * @param serviceId 服务ID
   * @returns 是否有效
   */
  private isCacheValid(serviceId: string): boolean {
    const timestamp = this.cacheTimestamps.get(serviceId);
    if (!timestamp) return false;
    
    return Date.now() - timestamp < this.cacheExpiry;
  }

  /**
   * 验证字段类型
   * @param value 字段值
   * @param expectedType 预期类型
   * @returns 是否匹配
   */
  private validateFieldType(value: unknown, expectedType: ServiceValidationRule['type']): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'file':
        // 假设文件以特定格式传递（如文件ID或文件对象）
        return typeof value === 'string' || (typeof value === 'object' && value !== null);
      default:
        return false;
    }
  }

  /**
   * 初始化默认验证规则
   */
  private initializeDefaultValidationRules(): void {
    // 预设的验证规则将在具体的get方法中定义
  }

  /**
   * 获取服务的验证规则
   * @param serviceName 服务名称
   * @returns 验证规则数组
   */
  private getValidationRulesForService(serviceName: string): ServiceValidationRule[] {
    const commonRules: ServiceValidationRule[] = [
      {
        field: 'patientInfo',
        required: false,
        type: 'object'
      }
    ];

    switch (serviceName) {
      case '营养方案制定':
        return [
          ...commonRules,
          {
            field: 'age',
            required: true,
            type: 'number',
            min: 0,
            max: 150
          },
          {
            field: 'weight',
            required: true,
            type: 'number',
            min: 1,
            max: 500
          },
          {
            field: 'height',
            required: true,
            type: 'number',
            min: 30,
            max: 300
          },
          {
            field: 'activityLevel',
            required: true,
            type: 'string',
            allowedValues: ['sedentary', 'light', 'moderate', 'active', 'very_active']
          }
        ];

      case '健康管理方案制定':
        return [
          ...commonRules,
          {
            field: 'healthGoals',
            required: true,
            type: 'array'
          },
          {
            field: 'currentConditions',
            required: false,
            type: 'array'
          }
        ];

      case '临床研究匹配查询':
        return [
          ...commonRules,
          {
            field: 'diagnosis',
            required: true,
            type: 'string',
            minLength: 2,
            maxLength: 200
          },
          {
            field: 'inclusionCriteria',
            required: false,
            type: 'array'
          }
        ];

      case '文献解读工具':
        return [
          {
            field: 'literature',
            required: true,
            type: 'string',
            minLength: 10
          },
          {
            field: 'analysisType',
            required: false,
            type: 'string',
            allowedValues: ['summary', 'detailed', 'clinical_significance']
          }
        ];

      case '临床研究方案撰写':
        return [
          {
            field: 'researchQuestion',
            required: true,
            type: 'string',
            minLength: 10,
            maxLength: 1000
          },
          {
            field: 'studyType',
            required: true,
            type: 'string',
            allowedValues: ['observational', 'experimental', 'meta_analysis']
          }
        ];

      case '数据统计分析':
        return [
          {
            field: 'data',
            required: true,
            type: 'file'
          },
          {
            field: 'analysisType',
            required: true,
            type: 'string',
            allowedValues: ['descriptive', 'inferential', 'regression', 'survival']
          }
        ];

      default:
        return commonRules;
    }
  }

  /**
   * 获取服务的输入处理器
   * @param serviceName 服务名称
   * @returns 输入处理器数组
   */
  private getInputProcessorsForService(serviceName: string): Array<(input: Record<string, unknown>) => Record<string, unknown>> {
    const commonProcessors = [
      // 通用数据清理处理器
      (input: Record<string, unknown>) => {
        const cleaned = { ...input };
        // 移除空字符串和null值
        Object.keys(cleaned).forEach(key => {
          if (cleaned[key] === '' || cleaned[key] === null) {
            delete cleaned[key];
          }
        });
        return cleaned;
      }
    ];

    switch (serviceName) {
      case '营养方案制定':
        return [
          ...commonProcessors,
          // 计算BMI
          (input: Record<string, unknown>) => {
            const weight = Number(input.weight);
            const height = Number(input.height) / 100; // 转换为米
            if (weight && height) {
              return {
                ...input,
                bmi: Math.round((weight / (height * height)) * 100) / 100
              };
            }
            return input;
          }
        ];

      case '数据统计分析':
        return [
          ...commonProcessors,
          // 数据格式预处理
          (input: Record<string, unknown>) => {
            if (input.data && typeof input.data === 'string') {
              // 如果是文件路径或ID，保持原样
              return input;
            }
            return input;
          }
        ];

      default:
        return commonProcessors;
    }
  }

  /**
   * 获取服务的输出处理器
   * @param serviceName 服务名称
   * @returns 输出处理器数组
   */
  private getOutputProcessorsForService(serviceName: string): Array<(output: Record<string, unknown>) => Record<string, unknown>> {
    const commonProcessors = [
      // 通用格式化处理器
      (output: Record<string, unknown>) => {
        return {
          ...output,
          processedAt: new Date().toISOString(),
          serviceName
        };
      }
    ];

    switch (serviceName) {
      case '营养方案制定':
        return [
          ...commonProcessors,
          // 营养方案格式化
          (output: Record<string, unknown>) => {
            return {
              ...output,
              type: 'nutrition_plan',
              recommendations: output.recommendations || output.answer || output.text
            };
          }
        ];

      case '文献解读工具':
        return [
          ...commonProcessors,
          // 文献解读格式化
          (output: Record<string, unknown>) => {
            return {
              ...output,
              type: 'literature_analysis',
              analysis: output.analysis || output.answer || output.text
            };
          }
        ];

      default:
        return commonProcessors;
    }
  }

  /**
   * 清理缓存
   * @param serviceId 可选的特定服务ID，不提供则清理所有缓存
   */
  clearCache(serviceId?: string): void {
    if (serviceId) {
      this.serviceCache.delete(serviceId);
      this.cacheTimestamps.delete(serviceId);
    } else {
      this.serviceCache.clear();
      this.cacheTimestamps.clear();
    }
  }

  /**
   * 获取缓存统计
   * @returns 缓存统计信息
   */
  getCacheStats(): {
    size: number;
    services: string[];
    oldestCache?: string;
    newestCache?: string;
  } {
    const services = Array.from(this.serviceCache.keys());
    const timestamps = Array.from(this.cacheTimestamps.entries());
    
    let oldestCache: string | undefined;
    let newestCache: string | undefined;

    if (timestamps.length > 0) {
      timestamps.sort((a, b) => a[1] - b[1]);
      oldestCache = timestamps[0][0];
      newestCache = timestamps[timestamps.length - 1][0];
    }

    return {
      size: this.serviceCache.size,
      services,
      oldestCache,
      newestCache
    };
  }

  /**
   * 健康检查
   * @returns 服务健康状态
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    cache: boolean;
    database: boolean;
    services: number;
    errors?: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // 检查缓存
      const cacheHealthy = this.serviceCache instanceof Map;

      // 检查数据库连接
      let dbHealthy = false;
      let serviceCount = 0;
      
      try {
        // 使用软删除过滤器，只统计活跃且未删除的服务
        const whereConditions = [eq(aiService.isActive, true)];
        const whereClause = withSoftDeleteFilter(whereConditions, aiService.deletedAt);
        
        const services = await db.query.aiService.findMany({
          where: whereClause
        });
        dbHealthy = true;
        serviceCount = services.length;
      } catch (error) {
        errors.push(`数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      // 评估整体状态
      if (!dbHealthy) {
        status = 'unhealthy';
      } else if (!cacheHealthy || serviceCount === 0) {
        status = 'degraded';
      }

      return {
        status,
        cache: cacheHealthy,
        database: dbHealthy,
        services: serviceCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        cache: false,
        database: false,
        services: 0,
        errors: [`健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`]
      };
    }
  }
}

// 导出单例实例
export const medicalServiceProcessor = new MedicalServiceProcessor();