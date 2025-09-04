// Dify AI应用相关类型定义

/**
 * Dify应用类型
 */
export type DifyApplicationType = 'workflow' | 'chatflow' | 'chatbot' | 'agent' | 'textGenerator';

/**
 * Dify应用模式
 */
export type DifyApplicationMode = 'workflow' | 'advanced-chat' | 'chat' | 'agent-chat' | 'completion';

/**
 * 应用类型到模式的映射
 */
export const APPLICATION_TYPE_TO_MODE: Record<DifyApplicationType, DifyApplicationMode> = {
  workflow: 'workflow',
  chatflow: 'advanced-chat',
  chatbot: 'chat',
  agent: 'agent-chat',
  textGenerator: 'completion'
};

/**
 * 应用模式到API端点的映射
 */
export const MODE_TO_API_ENDPOINT: Record<DifyApplicationMode, string> = {
  workflow: '/workflows/run',
  'advanced-chat': '/chat-messages',
  chat: '/chat-messages',
  'agent-chat': '/chat-messages',
  completion: '/completion-messages'
};

/**
 * 应用模式到停止任务API端点的映射
 */
export const MODE_TO_STOP_ENDPOINT: Record<DifyApplicationMode, string> = {
  workflow: '/workflows/tasks',
  'advanced-chat': '/chat-messages',
  chat: '/chat-messages',
  'agent-chat': '/chat-messages',
  completion: '/completion-messages'
};

/**
 * 应用信息响应
 */
export interface ApplicationInfoResponse {
  name: string;
  description: string;
  tags: string[];
  mode: DifyApplicationMode;
  author_name: string;
}

/**
 * 应用参数定义
 */
export interface ApplicationParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file';
  required: boolean;
  label: string;
  human_description?: string;
  form?: 'text-input' | 'paragraph' | 'select' | 'number-input' | 'file-upload';
  default?: string | number | boolean;
  options?: Array<{
    label: string;
    value: string | number;
  }>;
  max_length?: number;
  min_length?: number;
  max?: number;
  min?: number;
}

/**
 * 应用参数响应
 */
export interface ApplicationParametersResponse {
  user_input_form: ApplicationParameter[];
}

// 通用应用输入类型
export interface ApplicationInputs {
  [key: string]: string | number | boolean | object | null;
}

// 工作流执行输入类型（向后兼容）
export type WorkflowInputs = ApplicationInputs;

// 聊天消息输入类型
export interface ChatMessageInputs {
  query: string;
  inputs?: ApplicationInputs;
  response_mode?: 'blocking' | 'streaming';
  user: string;
  conversation_id?: string;
  files?: Array<{
    type: 'image' | 'document' | 'audio' | 'video';
    transfer_method: 'remote_url' | 'local_file';
    url?: string;
    upload_file_id?: string;
  }>;
  auto_generate_name?: boolean;
}

// 完成消息输入类型
export interface CompletionMessageInputs {
  inputs: ApplicationInputs;
  response_mode?: 'blocking' | 'streaming';
  user: string;
  files?: Array<{
    type: 'image' | 'document' | 'audio' | 'video';
    transfer_method: 'remote_url' | 'local_file';
    url?: string;
    upload_file_id?: string;
  }>;
}

// 工作流元数据
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// 应用执行状态
export type ApplicationStatus = 'running' | 'succeeded' | 'failed' | 'stopped';

// 工作流执行状态（向后兼容）
export type WorkflowStatus = ApplicationStatus;

// 聊天消息响应
export interface ChatMessageResponse {
  message_id: string;
  conversation_id: string;
  mode: DifyApplicationMode;
  answer: string;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      prompt_unit_price: string;
      prompt_price: string;
      completion_tokens: number;
      completion_unit_price: string;
      completion_price: string;
      total_tokens: number;
      total_price: string;
      currency: string;
      latency: number;
    };
    retriever_resources?: Array<{
      position: number;
      dataset_id: string;
      dataset_name: string;
      document_id: string;
      document_name: string;
      segment_id: string;
      score: number;
      content: string;
    }>;
  };
  created_at: number;
}

// 完成消息响应
export interface CompletionMessageResponse {
  message_id: string;
  mode: DifyApplicationMode; 
  text: string;
  metadata?: {
    usage?: {
      prompt_tokens: number;
      prompt_unit_price: string;
      prompt_price: string;
      completion_tokens: number;
      completion_unit_price: string;
      completion_price: string;
      total_tokens: number;
      total_price: string;
      currency: string;
      latency: number;
    };
  };
  created_at: number;
}

// 停止任务响应
export interface StopTaskResponse {
  result: 'success';
}

// 通用应用执行结果
export interface ApplicationResult {
  id: string;
  mode: DifyApplicationMode;
  status: ApplicationStatus;
  outputs?: Record<string, unknown>;
  answer?: string;
  text?: string;
  error?: string;
  totalTokens?: number;
  totalPrice?: string;
  currency?: string;
  latency?: number;
  createdAt: string;
  finishedAt?: string;
  conversationId?: string;
  messageId?: string;
}

// 工作流执行结果（向后兼容）
export interface WorkflowResult {
  workflowRunId: string;
  taskId?: string;
  status: WorkflowStatus;
  outputs?: Record<string, unknown>;
  error?: string;
  totalTokens?: number;
  totalPrice?: string;
  currency?: string;
  latency?: number;
  createdAt: string;
  finishedAt?: string;
}

// 执行工作流的请求参数
export interface ExecuteWorkflowRequest {
  workflowId: string;
  inputs: WorkflowInputs;
  responseMode?: 'blocking' | 'streaming';
  user?: string;
  conversationId?: string;
  files?: Array<{
    type: 'image' | 'document' | 'audio' | 'video';
    transferMethod: 'remote_url' | 'local_file';
    url?: string;
    uploadFileId?: string;
  }>;
}

// 工作流执行响应
export interface WorkflowExecutionResponse {
  workflowRunId: string;
  taskId: string;
  data?: {
    id: string;
    workflowId: string;
    status: WorkflowStatus;
    outputs?: Record<string, unknown>;
    error?: string;
    elapsedTime: number;
    totalTokens: number;
    totalPrice: string;
    currency: string;
    createdAt: number;
    finishedAt?: number;
  };
}

// 流式响应事件类型
export type StreamEventType = 
  | 'workflow_started'
  | 'workflow_finished' 
  | 'node_started'
  | 'node_finished'
  | 'error';

// 流式响应数据
export interface StreamEvent {
  event: StreamEventType;
  taskId: string;
  workflowRunId: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

// 工作流日志查询参数
export interface WorkflowLogsQuery {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: WorkflowStatus[];
  startTime?: string;
  endTime?: string;
}

// 工作流日志项
export interface WorkflowLogItem {
  id: string;
  workflowId: string;
  workflowRunId: string;
  status: WorkflowStatus;
  inputs: WorkflowInputs;
  outputs?: Record<string, unknown>;
  error?: string;
  totalTokens: number;
  totalPrice: string;
  currency: string;
  latency: number;
  createdAt: string;
  finishedAt?: string;
}

// 工作流日志响应
export interface WorkflowLogsResponse {
  data: WorkflowLogItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Dify API错误响应
export interface DifyApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

// Dify配置
export interface DifyConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// 输入验证规则
export interface InputValidationRule {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: Array<string | number>;
}

// 输入验证结果
export interface InputValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// Dify API错误码常量
export const DIFY_ERROR_CODES = {
  INVALID_API_KEY: 'invalid_api_key',
  WORKFLOW_NOT_FOUND: 'workflow_not_found', 
  INVALID_PARAMETERS: 'invalid_parameters',
  EXECUTION_FAILED: 'execution_failed',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  INTERNAL_ERROR: 'internal_error',
} as const;

// Dify API错误消息映射
export const DIFY_ERROR_MESSAGES: Record<string, string> = {
  [DIFY_ERROR_CODES.INVALID_API_KEY]: 'API密钥无效',
  [DIFY_ERROR_CODES.WORKFLOW_NOT_FOUND]: '工作流不存在',
  [DIFY_ERROR_CODES.INVALID_PARAMETERS]: '参数无效',
  [DIFY_ERROR_CODES.EXECUTION_FAILED]: '工作流执行失败',
  [DIFY_ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'API调用频率超限',
  [DIFY_ERROR_CODES.NETWORK_ERROR]: '网络连接错误',
  [DIFY_ERROR_CODES.TIMEOUT]: '请求超时',
  [DIFY_ERROR_CODES.INTERNAL_ERROR]: '内部服务错误',
};