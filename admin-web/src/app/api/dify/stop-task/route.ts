import { NextRequest, NextResponse } from 'next/server';
import { getDifyService } from '@/services/dify';
import { getDifyConfigFromDB } from '@/lib/get-dify-config';

/**
 * POST /api/dify/stop-task - 停止任务执行
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();
    const { serviceType, taskId } = body;

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

    if (!taskId) {
      return NextResponse.json({
        success: false,
        message: '缺少必需的参数taskId',
        error: 'MISSING_REQUIRED_PARAMETERS'
      }, { status: 400 });
    }

    // 获取应用类型信息
    const applicationType = await difyService.getApplicationType();
    const applicationInfo = await difyService.getApplicationInfo();

    // 停止任务
    const result = await difyService.stopTask(taskId);

    return NextResponse.json({
      success: true,
      message: `${applicationType}应用任务停止成功`,
      data: {
        result,
        taskId,
        applicationInfo: {
          type: applicationType,
          mode: applicationInfo.mode
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dify stop task API error:', error);
    
    const isDifyError = error instanceof Error && error.message.includes('DIFY_ERROR');
    const statusCode = isDifyError ? 400 : 500;
    
    return NextResponse.json({
      success: false,
      message: '停止任务失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}