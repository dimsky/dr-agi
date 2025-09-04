import { NextRequest, NextResponse } from 'next/server';
import { getDifyService } from '@/services/dify';
import { getDifyConfigFromDB } from '@/lib/get-dify-config';
import type { ApplicationInputs, ChatMessageInputs, CompletionMessageInputs } from '@/types/dify';

/**
 * POST /api/dify/execute-application - 通用应用执行接口
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { serviceType, inputs, options } = body;

    if (!serviceType) {
      return NextResponse.json({
        success: false,
        message: '缺少必需的参数serviceType',
        error: 'MISSING_SERVICE_TYPE'
      }, { status: 400 });
    }

    // 从数据库获取Dify配置
    const difyConfig = await getDifyConfigFromDB(serviceType);
    const difyService = getDifyService(difyConfig);

    // 检查服务配置
    if (!difyService.isConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'Dify服务未正确配置',
        error: 'SERVICE_NOT_CONFIGURED'
      }, { status: 500 });
    }

    if (!inputs) {
      return NextResponse.json({
        success: false,
        message: '缺少必需的参数inputs',
        error: 'MISSING_REQUIRED_PARAMETERS'
      }, { status: 400 });
    }

    // 获取应用类型信息
    const applicationType = await difyService.getApplicationType();
    const applicationInfo = await difyService.getApplicationInfo();

    // 根据应用类型调整输入参数
    let processedInputs: ApplicationInputs | ChatMessageInputs | CompletionMessageInputs;
    
    if (applicationInfo.mode === 'workflow') {
      processedInputs = inputs as ApplicationInputs;
    } else if (applicationInfo.mode === 'advanced-chat' || applicationInfo.mode === 'chat' || applicationInfo.mode === 'agent-chat') {
      // 聊天应用需要query字段
      if (typeof inputs.query !== 'string') {
        return NextResponse.json({
          success: false,
          message: '聊天应用需要query字段',
          error: 'MISSING_QUERY_PARAMETER'
        }, { status: 400 });
      }
      processedInputs = inputs as ChatMessageInputs;
    } else if (applicationInfo.mode === 'completion') {
      // 完成应用需要inputs对象
      if (!inputs.inputs || typeof inputs.inputs !== 'object') {
        return NextResponse.json({
          success: false,
          message: '完成应用需要inputs对象',
          error: 'MISSING_INPUTS_PARAMETER'  
        }, { status: 400 });
      }
      processedInputs = inputs as CompletionMessageInputs;
    } else {
      return NextResponse.json({
        success: false,
        message: `不支持的应用模式: ${applicationInfo.mode}`,
        error: 'UNSUPPORTED_APPLICATION_MODE'
      }, { status: 400 });
    }

    // 执行应用
    const result = await difyService.executeApplication(processedInputs, {
      responseMode: options?.responseMode || 'blocking',
      user: options?.user || 'default-user',
      conversationId: options?.conversationId,
      files: options?.files
    });

    return NextResponse.json({
      success: true,
      message: `${applicationType}应用执行成功`,
      data: {
        result,
        applicationInfo: {
          type: applicationType,
          mode: applicationInfo.mode
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dify execute application API error:', error);
    
    const isDifyError = error instanceof Error && error.message.includes('DIFY_ERROR');
    const statusCode = isDifyError ? 400 : 500;
    
    return NextResponse.json({
      success: false,
      message: '应用执行失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}