import {
  DifyConfig,
  DifyApplicationType,
  APPLICATION_TYPE_TO_MODE,
  MODE_TO_API_ENDPOINT,
  MODE_TO_STOP_ENDPOINT,
  ApplicationInfoResponse,
  ApplicationParametersResponse,
  ApplicationInputs,
  ApplicationResult,
  Workflow,
  WorkflowInputs,
  WorkflowResult,
  ChatMessageInputs,
  CompletionMessageInputs,
  ChatMessageResponse,
  CompletionMessageResponse,
  ExecuteWorkflowRequest,
  WorkflowExecutionResponse,
  WorkflowLogsQuery,
  WorkflowLogsResponse,
  InputValidationResult,
  StopTaskResponse,
  DifyApiError,
  DIFY_ERROR_CODES,
  DIFY_ERROR_MESSAGES,
  StreamEvent
} from '@/types/dify';

/**
 * Dify AI应用服务类
 * 负责与Dify API集成，支持多种应用类型（workflow、chatflow、chatbot、agent、textGenerator）
 */
class DifyService {
  private readonly config: DifyConfig;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly timeout: number;
  private applicationInfo: ApplicationInfoResponse | null = null;

  constructor(config: DifyConfig) {
    this.config = {
      timeout: 30000, // 30秒
      maxRetries: 3,
      retryDelay: 1000, // 1秒
      ...config
    };

    this.maxRetries = this.config.maxRetries || 3;
    this.retryDelay = this.config.retryDelay || 1000;
    this.timeout = this.config.timeout || 30000;

    // 验证必要的配置
    if (!this.config.apiKey || !this.config.baseUrl) {
      throw new Error('Dify configuration is required: apiKey and baseUrl must be provided');
    }
  }

  /**
   * 获取应用信息
   * @returns 应用信息（包含应用模式）
   */
  async getApplicationInfo(): Promise<ApplicationInfoResponse> {
    if (this.applicationInfo) {
      return this.applicationInfo;
    }

    try {
      const url = `${this.config.baseUrl}/info`;
      const response = await this.makeRequest(url, { method: 'GET' });
      const result = await this.handleResponse<ApplicationInfoResponse>(response);
      
      this.applicationInfo = result;
      return result;
    } catch (error) {
      console.error('Failed to get application info:', error);
      throw this.createDifyError(
        DIFY_ERROR_CODES.NETWORK_ERROR,
        '获取应用信息失败',
        error
      );
    }
  }

  /**
   * 获取应用类型
   * @returns 应用类型
   */
  async getApplicationType(): Promise<DifyApplicationType> {
    const appInfo = await this.getApplicationInfo();
    const mode = appInfo.mode;
    
    // 根据模式反推应用类型
    for (const [type, typeMode] of Object.entries(APPLICATION_TYPE_TO_MODE)) {
      if (typeMode === mode) {
        return type as DifyApplicationType;
      }
    }
    
    // 默认返回workflow类型
    return 'workflow';
  }

  /**
   * 获取应用参数配置
   * @returns 应用参数配置
   */
  async getApplicationParameters(): Promise<ApplicationParametersResponse> {
    try {
      const url = `${this.config.baseUrl}/parameters`;
      const response = await this.makeRequest(url, { method: 'GET' });
      const result = await this.handleResponse<ApplicationParametersResponse>(response);
      
      return result;
    } catch (error) {
      console.error('Failed to get application parameters:', error);
      throw this.createDifyError(
        DIFY_ERROR_CODES.NETWORK_ERROR,
        '获取应用参数配置失败',
        error
      );
    }
  }

  /**
   * 通用应用执行方法
   * @param inputs 输入参数
   * @param options 执行选项
   * @returns 应用执行结果
   */
  async executeApplication(
    inputs: ApplicationInputs | ChatMessageInputs | CompletionMessageInputs,
    options?: {
      responseMode?: 'blocking' | 'streaming';
      user?: string;
      conversationId?: string;
      files?: Array<{
        type: 'image' | 'document' | 'audio' | 'video';
        transfer_method: 'remote_url' | 'local_file';
        url?: string;
        upload_file_id?: string;
      }>;
    }
  ): Promise<ApplicationResult> {
    const appInfo = await this.getApplicationInfo();
    const mode = appInfo.mode;

    if (mode === 'workflow') {
      // 处理工作流 - 直接使用工作流API
      const url = `${this.config.baseUrl}/workflows/run`;
      const requestData = {
        inputs: inputs as WorkflowInputs,
        response_mode: options?.responseMode || 'blocking',
        user: options?.user || 'default-user',
        conversation_id: options?.conversationId,
        files: options?.files?.map(f => ({
          type: f.type,
          transfer_method: f.transfer_method,
          url: f.url,
          upload_file_id: f.upload_file_id
        })) || []
      };

      const response = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      const result = await this.handleResponse<WorkflowExecutionResponse>(response);

      return {
        id: result.workflowRunId,
        mode,
        status: result.data?.status || 'running',
        outputs: result.data?.outputs,
        error: result.data?.error,
        totalTokens: result.data?.totalTokens,
        totalPrice: result.data?.totalPrice,
        currency: result.data?.currency,
        latency: result.data?.elapsedTime,
        createdAt: result.data?.createdAt ? new Date(result.data.createdAt * 1000).toISOString() : new Date().toISOString(),
        finishedAt: result.data?.finishedAt ? new Date(result.data.finishedAt * 1000).toISOString() : undefined
      };
    } else if (mode === 'advanced-chat' || mode === 'chat' || mode === 'agent-chat') {
      // 处理聊天应用
      return this.executeChatApplication(inputs as ChatMessageInputs, options);
    } else if (mode === 'completion') {
      // 处理完成应用
      return this.executeCompletionApplication(inputs as CompletionMessageInputs, options);
    } else {
      throw this.createDifyError(
        DIFY_ERROR_CODES.INVALID_PARAMETERS,
        `不支持的应用模式: ${mode}`
      );
    }
  }

  /**
   * 执行聊天应用
   * @param inputs 聊天输入
   * @param options 执行选项
   * @returns 应用执行结果
   */
  private async executeChatApplication(
    inputs: ChatMessageInputs,
    options?: {
      responseMode?: 'blocking' | 'streaming';
      user?: string;
      conversationId?: string;
      files?: Array<{
        type: 'image' | 'document' | 'audio' | 'video';
        transfer_method: 'remote_url' | 'local_file';
        url?: string;
        upload_file_id?: string;
      }>;
    }
  ): Promise<ApplicationResult> {
    const appInfo = await this.getApplicationInfo();
    const endpoint = MODE_TO_API_ENDPOINT[appInfo.mode];
    
    const requestData = {
      query: inputs.query,
      inputs: inputs.inputs || {},
      response_mode: options?.responseMode || 'blocking',
      user: options?.user || 'default-user',
      conversation_id: options?.conversationId || inputs.conversation_id,
      files: options?.files || inputs.files || [],
      auto_generate_name: inputs.auto_generate_name || false
    };

    const url = `${this.config.baseUrl}${endpoint}`;
    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    const result = await this.handleResponse<ChatMessageResponse>(response);

    return {
      id: result.message_id,
      mode: appInfo.mode,
      status: 'succeeded',
      answer: result.answer,
      totalTokens: result.metadata?.usage?.total_tokens,
      totalPrice: result.metadata?.usage?.total_price,
      currency: result.metadata?.usage?.currency,
      latency: result.metadata?.usage?.latency,
      createdAt: new Date(result.created_at * 1000).toISOString(),
      finishedAt: new Date().toISOString(),
      conversationId: result.conversation_id,
      messageId: result.message_id
    };
  }

  /**
   * 执行完成应用
   * @param inputs 完成输入
   * @param options 执行选项
   * @returns 应用执行结果
   */
  private async executeCompletionApplication(
    inputs: CompletionMessageInputs,
    options?: {
      responseMode?: 'blocking' | 'streaming';
      user?: string;
      files?: Array<{
        type: 'image' | 'document' | 'audio' | 'video';
        transfer_method: 'remote_url' | 'local_file';
        url?: string;
        upload_file_id?: string;
      }>;
    }
  ): Promise<ApplicationResult> {
    const appInfo = await this.getApplicationInfo();
    const endpoint = MODE_TO_API_ENDPOINT[appInfo.mode];
    
    const requestData = {
      inputs: inputs.inputs,
      response_mode: options?.responseMode || 'blocking',
      user: options?.user || 'default-user',
      files: options?.files || inputs.files || []
    };

    const url = `${this.config.baseUrl}${endpoint}`;
    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    const result = await this.handleResponse<CompletionMessageResponse>(response);

    return {
      id: result.message_id,
      mode: appInfo.mode,
      status: 'succeeded',
      text: result.text,
      totalTokens: result.metadata?.usage?.total_tokens,
      totalPrice: result.metadata?.usage?.total_price,
      currency: result.metadata?.usage?.currency,
      latency: result.metadata?.usage?.latency,
      createdAt: new Date(result.created_at * 1000).toISOString(),
      finishedAt: new Date().toISOString(),
      messageId: result.message_id
    };
  }

  /**
   * 执行工作流
   * @param inputs 输入参数
   * @param options 执行选项
   * @returns 工作流执行结果
   */
  async executeWorkflow(
    inputs: WorkflowInputs,
    options?: {
      responseMode?: 'blocking' | 'streaming';
      user?: string;
      conversationId?: string;
      files?: ExecuteWorkflowRequest['files'];
    }
  ): Promise<WorkflowResult> {
    // 验证输入参数
    const validationResult = await this.validateWorkflowInputs(inputs);
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors.map(e => `${e.field}: ${e.message}`).join('; ');
      throw this.createDifyError(
        DIFY_ERROR_CODES.INVALID_PARAMETERS,
        `输入参数验证失败: ${errorMessages}`
      );
    }

    const requestData = {
      inputs,
      response_mode: options?.responseMode || 'blocking',
      user: options?.user || 'default-user',
      conversation_id: options?.conversationId,
      files: options?.files?.map(f => ({
        type: f.type,
        transfer_method: f.transferMethod,
        url: f.url,
        upload_file_id: f.uploadFileId
      })) || []
    };

    let lastError: Error | null = null;

    // 重试机制
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const url = `${this.config.baseUrl}/workflows/run`;
        const response = await this.makeRequest(url, {
          method: 'POST',
          body: JSON.stringify(requestData)
        });

        const result = await this.handleResponse<WorkflowExecutionResponse>(response);

        return {
          workflowRunId: result.workflowRunId,
          taskId: result.taskId,
          status: result.data?.status || 'running',
          outputs: result.data?.outputs,
          error: result.data?.error,
          totalTokens: result.data?.totalTokens,
          totalPrice: result.data?.totalPrice,
          currency: result.data?.currency,
          latency: result.data?.elapsedTime,
          createdAt: result.data?.createdAt ? new Date(result.data.createdAt * 1000).toISOString() : new Date().toISOString(),
          finishedAt: result.data?.finishedAt ? new Date(result.data.finishedAt * 1000).toISOString() : undefined
        };

      } catch (error) {
        lastError = error as Error;
        
        // 对于某些错误类型不进行重试
        if (this.shouldNotRetry(error as Error)) {
          throw error;
        }
        
        if (attempt < this.maxRetries) {
          console.warn(`Dify API call attempt ${attempt} failed:`, error);
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw this.createDifyError(
      DIFY_ERROR_CODES.NETWORK_ERROR,
      `网络请求失败，已重试${this.maxRetries}次`,
      lastError
    );
  }

  /**
   * 停止任务执行
   * @param taskId 任务ID
   * @returns 停止结果
   */
  async stopTask(taskId: string): Promise<StopTaskResponse> {
    if (!taskId) {
      throw this.createDifyError(
        DIFY_ERROR_CODES.INVALID_PARAMETERS,
        '任务ID不能为空'
      );
    }

    try {
      const appInfo = await this.getApplicationInfo();
      const mode = appInfo.mode;
      const stopEndpoint = MODE_TO_STOP_ENDPOINT[mode];

      let url: string;
      if (mode === 'workflow') {
        // workflow: /workflows/tasks/{task_id}/stop
        url = `${this.config.baseUrl}${stopEndpoint}/${taskId}/stop`;
      } else {
        // chat-messages 和 completion-messages: /{endpoint}/{task_id}/stop
        url = `${this.config.baseUrl}${stopEndpoint}/${taskId}/stop`;
      }

      const response = await this.makeRequest(url, { method: 'POST' });
      const result = await this.handleResponse<StopTaskResponse>(response);

      return result;
    } catch (error) {
      console.error(`Failed to stop task ${taskId}:`, error);
      throw this.createDifyError(
        DIFY_ERROR_CODES.EXECUTION_FAILED,
        '停止任务失败',
        error
      );
    }
  }

  /**
   * 获取应用信息（替代工作流列表，因为每个应用都有独立API key）
   * @returns 当前应用的工作流信息
   */
  async getAvailableWorkflows(): Promise<Workflow[]> {
    try {
      const appInfo = await this.getApplicationInfo();
      const appType = await this.getApplicationType();
      
      // 只有workflow类型的应用才返回工作流信息
      if (appType !== 'workflow') {
        return [];
      }

      // 基于应用信息构造工作流对象
      return [{
        id: 'current-workflow',
        name: appInfo.name,
        description: appInfo.description,
        version: '1.0.0',
        enabled: true,
        inputSchema: {}, // Dify不提供具体的输入模式信息
        outputSchema: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }];
    } catch (error) {
      console.error('Failed to get workflow info:', error);
      throw this.createDifyError(
        DIFY_ERROR_CODES.NETWORK_ERROR,
        '获取工作流信息失败',
        error
      );
    }
  }

  /**
   * 验证工作流输入参数
   * @param inputs 输入参数
   * @returns 验证结果
   */
  async validateWorkflowInputs(
    inputs: WorkflowInputs
  ): Promise<InputValidationResult> {
    try {
      // 由于Dify不提供输入模式信息，这里进行基本的验证
      const errors: Array<{ field: string; message: string }> = [];

      // 检查inputs是否为有效对象
      if (!inputs || typeof inputs !== 'object') {
        errors.push({ field: 'inputs', message: '输入参数必须为对象' });
        return {
          isValid: false,
          errors
        };
      }

      // 检查是否有空值的必填字段（这里做基本检查）
      for (const [fieldName, value] of Object.entries(inputs)) {
        if (value === undefined || value === null) {
          errors.push({ field: fieldName, message: '字段值不能为空' });
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Input validation failed:', error);
      return {
        isValid: false,
        errors: [{ field: 'general', message: '输入验证失败' }]
      };
    }
  }

  /**
   * 获取工作流执行日志（注意：Dify不提供此API，此方法仅为向后兼容保留）
   * @param query 查询参数
   * @returns 空的日志响应
   */
  async getWorkflowLogs(query?: WorkflowLogsQuery): Promise<WorkflowLogsResponse> {
    console.warn('getWorkflowLogs: Dify不提供工作流日志查询API，返回空结果');
    
    return {
      data: [],
      total: 0,
      page: query?.page || 1,
      limit: query?.limit || 20,
      hasMore: false
    };
  }

  /**
   * 流式执行工作流
   * @param inputs 输入参数
   * @param onEvent 事件回调
   * @param options 执行选项
   * @returns 最终执行结果
   */
  async executeWorkflowStream(
    inputs: WorkflowInputs,
    onEvent: (event: StreamEvent) => void,
    options?: {
      user?: string;
      conversationId?: string;
      files?: ExecuteWorkflowRequest['files'];
    }
  ): Promise<WorkflowResult> {
    const requestData = {
      inputs,
      response_mode: 'streaming',
      user: options?.user || 'default-user',
      conversation_id: options?.conversationId,
      files: options?.files?.map(f => ({
        type: f.type,
        transfer_method: f.transferMethod,
        url: f.url,
        upload_file_id: f.uploadFileId
      })) || []
    };

    const url = `${this.config.baseUrl}/workflows/run`;
    const response = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    if (!response.body) {
      throw this.createDifyError(
        DIFY_ERROR_CODES.INTERNAL_ERROR,
        '响应体为空'
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalResult: WorkflowResult | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              const streamEvent: StreamEvent = {
                event: eventData.event,
                taskId: eventData.task_id,
                workflowRunId: eventData.workflow_run_id,
                data: eventData.data,
                createdAt: eventData.created_at
              };

              onEvent(streamEvent);

              // 如果是结束事件，保存最终结果
              if (eventData.event === 'workflow_finished') {
                finalResult = {
                  workflowRunId: eventData.workflow_run_id,
                  taskId: eventData.task_id,
                  status: 'succeeded',
                  outputs: eventData.data?.outputs,
                  totalTokens: eventData.data?.metadata?.usage?.total_tokens,
                  totalPrice: eventData.data?.metadata?.usage?.total_price,
                  currency: eventData.data?.metadata?.usage?.currency,
                  latency: eventData.data?.elapsed_time,
                  createdAt: new Date(eventData.created_at * 1000).toISOString(),
                  finishedAt: new Date().toISOString()
                };
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming event:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalResult) {
      throw this.createDifyError(
        DIFY_ERROR_CODES.EXECUTION_FAILED,
        '工作流执行未正常完成'
      );
    }

    return finalResult;
  }

  /**
   * 发起HTTP请求
   * @param url 请求URL
   * @param options 请求选项
   * @returns Response对象
   */
  private async makeRequest(
    url: string, 
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...options.headers
        }
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createDifyError(DIFY_ERROR_CODES.TIMEOUT, '请求超时');
      }
      
      throw this.createDifyError(
        DIFY_ERROR_CODES.NETWORK_ERROR,
        '网络请求失败',
        error
      );
    }
  }

  /**
   * 处理响应
   * @param response Response对象
   * @returns 解析后的数据
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let responseData: unknown;
    try {
      responseData = isJson ? await response.json() : await response.text();
    } catch (error) {
      throw this.createDifyError(
        DIFY_ERROR_CODES.INTERNAL_ERROR,
        '响应解析失败',
        error
      );
    }

    if (!response.ok) {
      const errorData = responseData as Record<string, unknown>;
      const errorMessage = (errorData?.message as string) || 
                          (errorData?.error as string) || 
                          DIFY_ERROR_MESSAGES[errorData?.code as string] ||
                          `HTTP ${response.status}: ${response.statusText}`;
      
      const errorCode = this.mapHttpStatusToErrorCode(response.status, errorData?.code as string);
      
      throw this.createDifyError(errorCode, errorMessage, {
        status: response.status,
        response: responseData
      });
    }

    return responseData as T;
  }


  /**
   * 映射HTTP状态码到错误码
   * @param status HTTP状态码
   * @param apiErrorCode API返回的错误码
   * @returns Dify错误码
   */
  private mapHttpStatusToErrorCode(status: number, apiErrorCode?: string): string {
    if (apiErrorCode && Object.values(DIFY_ERROR_CODES).includes(apiErrorCode as (typeof DIFY_ERROR_CODES)[keyof typeof DIFY_ERROR_CODES])) {
      return apiErrorCode;
    }

    switch (status) {
      case 401:
        return DIFY_ERROR_CODES.INVALID_API_KEY;
      case 404:
        return DIFY_ERROR_CODES.WORKFLOW_NOT_FOUND;
      case 400:
        return DIFY_ERROR_CODES.INVALID_PARAMETERS;
      case 429:
        return DIFY_ERROR_CODES.RATE_LIMIT_EXCEEDED;
      case 500:
      case 502:
      case 503:
      case 504:
        return DIFY_ERROR_CODES.INTERNAL_ERROR;
      default:
        return DIFY_ERROR_CODES.INTERNAL_ERROR;
    }
  }

  /**
   * 判断是否不应该重试
   * @param error 错误对象
   * @returns 是否不应该重试
   */
  private shouldNotRetry(error: Error): boolean {
    const difyError = error as Error & DifyApiError;
    
    // 这些错误类型不应该重试
    const noRetryErrors = [
      DIFY_ERROR_CODES.INVALID_API_KEY,
      DIFY_ERROR_CODES.WORKFLOW_NOT_FOUND,
      DIFY_ERROR_CODES.INVALID_PARAMETERS
    ];
    
    return noRetryErrors.some(code => code === difyError.code);
  }

  /**
   * 创建Dify错误
   * @param code 错误码
   * @param message 错误消息
   * @param details 错误详情
   * @returns Error with DifyApiError properties
   */
  private createDifyError(code: string, message: string, details?: unknown): Error {
    const difyError = new Error(`DIFY_ERROR: ${message}`) as Error & DifyApiError;
    difyError.code = code;
    difyError.message = message;
    difyError.details = details;
    
    return difyError;
  }

  /**
   * 延迟执行
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查Dify服务配置是否完整
   * @returns 配置是否完整
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.baseUrl);
  }

  /**
   * 获取服务配置信息（去除敏感信息）
   * @returns 配置信息
   */
  getConfigInfo() {
    return {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      hasApiKey: !!this.config.apiKey
    };
  }
}

/**
 * 获取Dify服务实例
 * @param config 必需的Dify配置
 * @returns DifyService实例
 */
export function getDifyService(config: DifyConfig): DifyService {
  return new DifyService(config);
}

// 导出类型
export type { DifyService };
export * from '@/types/dify';