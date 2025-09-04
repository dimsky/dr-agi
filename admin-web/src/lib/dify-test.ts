/**
 * Dify服务测试工具
 * 用于测试Dify API连接和基本功能
 */

import { getDifyService } from '@/services/dify';
import type { ApplicationInputs, WorkflowInputs, ChatMessageInputs, CompletionMessageInputs, DifyApplicationType, DifyConfig, ApplicationParametersResponse } from '@/types/dify';

/**
 * 测试Dify服务连接
 */
export async function testDifyConnection(config: DifyConfig): Promise<{
  success: boolean;
  message: string;
  error?: string;
  applicationType?: DifyApplicationType;
  applicationMode?: string;
}> {
  try {
    const difyService = getDifyService(config);
    
    if (!difyService.isConfigured()) {
      return {
        success: false,
        message: 'Dify服务未正确配置，请检查配置中的apiKey和baseUrl'
      };
    }

    // 获取应用信息
    const applicationInfo = await difyService.getApplicationInfo();
    const applicationType = await difyService.getApplicationType();
    
    let additionalMessage = '';
    if (applicationType === 'workflow') {
      try {
        await difyService.getAvailableWorkflows();
        additionalMessage = `，工作流应用信息已加载`;
      } catch {
        additionalMessage = '，但无法获取工作流信息';
      }
    }
    
    return {
      success: true,
      message: `Dify服务连接成功，应用类型: ${applicationType}，模式: ${applicationInfo.mode}${additionalMessage}`,
      applicationType,
      applicationMode: applicationInfo.mode
    };
  } catch (error) {
    console.error('Dify connection test failed:', error);
    return {
      success: false,
      message: 'Dify服务连接失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 测试工作流执行
 * @param config Dify配置
 * @param testInputs 测试输入
 */
export async function testWorkflowExecution(
  config: DifyConfig,
  testInputs: WorkflowInputs
): Promise<{
  success: boolean;
  message: string;
  workflowRunId?: string;
  error?: string;
}> {
  try {
    const difyService = getDifyService(config);
    
    // 验证输入
    const validation = await difyService.validateWorkflowInputs(testInputs);
    if (!validation.isValid) {
      return {
        success: false,
        message: '输入参数验证失败',
        error: validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      };
    }

    // 执行工作流
    const result = await difyService.executeWorkflow(testInputs);
    
    return {
      success: true,
      message: `工作流执行成功，状态: ${result.status}`,
      workflowRunId: result.workflowRunId
    };
  } catch (error) {
    console.error('Workflow execution test failed:', error);
    return {
      success: false,
      message: '工作流执行测试失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 测试停止任务
 * @param config Dify配置
 * @param taskId 任务ID
 */
export async function testStopTask(
  config: DifyConfig,
  taskId: string
): Promise<{
  success: boolean;
  message: string;
  result?: string;
  error?: string;
}> {
  try {
    const difyService = getDifyService(config);
    
    const result = await difyService.stopTask(taskId);
    
    return {
      success: true,
      message: `任务停止成功`,
      result: result.result
    };
  } catch (error) {
    console.error('Stop task test failed:', error);
    return {
      success: false,
      message: '停止任务测试失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 测试通用应用执行
 * @param config Dify配置
 * @param inputs 应用输入
 * @param applicationType 应用类型
 */
export async function testApplicationExecution(
  config: DifyConfig,
  inputs: ApplicationInputs | ChatMessageInputs | CompletionMessageInputs,
  applicationType?: DifyApplicationType
): Promise<{
  success: boolean;
  message: string;
  resultId?: string;
  error?: string;
}> {
  try {
    const difyService = getDifyService(config);
    
    // 如果没有提供应用类型，自动检测
    const detectedType = applicationType || await difyService.getApplicationType();
    
    // 执行应用
    const result = await difyService.executeApplication(inputs);
    
    return {
      success: true,
      message: `${detectedType}应用执行成功，状态: ${result.status}`,
      resultId: result.id
    };
  } catch (error) {
    console.error('Application execution test failed:', error);
    return {
      success: false,
      message: '应用执行测试失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 测试聊天应用
 * @param config Dify配置
 * @param query 聊天查询
 * @param inputs 可选输入参数
 */
export async function testChatApplication(
  config: DifyConfig,
  query: string,
  inputs?: ApplicationInputs
): Promise<{
  success: boolean;
  message: string;
  answer?: string;
  messageId?: string;
  error?: string;
}> {
  try {
    const chatInputs: ChatMessageInputs = {
      query,
      inputs: inputs || {},
      user: 'test-user'
    };

    const result = await testApplicationExecution(config, chatInputs, 'chatbot');
    
    if (!result.success) {
      return result;
    }

    const difyService = getDifyService(config);
    const executionResult = await difyService.executeApplication(chatInputs);

    return {
      success: true,
      message: '聊天应用测试成功',
      answer: executionResult.answer,
      messageId: executionResult.messageId
    };
  } catch (error) {
    console.error('Chat application test failed:', error);
    return {
      success: false,
      message: '聊天应用测试失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 测试完成应用
 * @param config Dify配置
 * @param inputs 输入参数
 */
export async function testCompletionApplication(
  config: DifyConfig,
  inputs: ApplicationInputs
): Promise<{
  success: boolean;
  message: string;
  text?: string;
  messageId?: string;
  error?: string;
}> {
  try {
    const completionInputs: CompletionMessageInputs = {
      inputs,
      user: 'test-user'
    };

    const result = await testApplicationExecution(config, completionInputs, 'textGenerator');
    
    if (!result.success) {
      return result;
    }

    const difyService = getDifyService(config);
    const executionResult = await difyService.executeApplication(completionInputs);

    return {
      success: true,
      message: '完成应用测试成功',
      text: executionResult.text,
      messageId: executionResult.messageId
    };
  } catch (error) {
    console.error('Completion application test failed:', error);
    return {
      success: false,
      message: '完成应用测试失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 测试获取应用参数配置
 * @param config Dify配置
 */
export async function testGetApplicationParameters(config: DifyConfig): Promise<{
  success: boolean;
  message: string;
  parameters?: ApplicationParametersResponse;
  error?: string;
}> {
  try {
    const difyService = getDifyService(config);
    
    const parameters = await difyService.getApplicationParameters();
    
    return {
      success: true,
      message: '应用参数配置获取成功',
      parameters
    };
  } catch (error) {
    console.error('Get application parameters test failed:', error);
    return {
      success: false,
      message: '应用参数配置获取失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 运行所有Dify服务测试
 */
export async function runAllDifyTests(config: DifyConfig): Promise<{
  connectionTest: Awaited<ReturnType<typeof testDifyConnection>>;
  configInfo: ReturnType<ReturnType<typeof getDifyService>['getConfigInfo']>;
  parametersTest: Awaited<ReturnType<typeof testGetApplicationParameters>>;
  applicationType?: DifyApplicationType;
  applicationMode?: string;
}> {
  console.log('🧪 开始运行Dify服务测试...');
  
  const difyService = getDifyService(config);
  const configInfo = difyService.getConfigInfo();
  
  console.log('📋 配置信息:', configInfo);
  
  const connectionTest = await testDifyConnection(config);
  console.log('🔗 连接测试:', connectionTest);
  
  const parametersTest = await testGetApplicationParameters(config);
  console.log('📝 参数配置测试:', parametersTest);
  
  return {
    connectionTest,
    configInfo,
    parametersTest,
    applicationType: connectionTest.applicationType,
    applicationMode: connectionTest.applicationMode
  };
}