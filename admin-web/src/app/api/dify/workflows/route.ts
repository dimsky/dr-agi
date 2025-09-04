import { NextRequest, NextResponse } from 'next/server';
import { getDifyService } from '@/services/dify';
import { getDifyConfigFromDB } from '@/lib/get-dify-config';

/**
 * GET /api/dify/workflows?serviceId=xxx - 获取可用的工作流列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');

    if (!serviceId) {
      return NextResponse.json({
        success: false,
        message: '缺少必需的参数serviceId',
        error: 'MISSING_SERVICE_ID'
      }, { status: 400 });
    }

    // 从数据库获取Dify配置
    const difyConfig = await getDifyConfigFromDB(serviceId);
    const difyService = getDifyService(difyConfig);

    // 检查服务配置
    if (!difyService.isConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'Dify服务未正确配置',
        error: 'SERVICE_NOT_CONFIGURED'
      }, { status: 500 });
    }

    // 获取工作流列表
    const workflows = await difyService.getAvailableWorkflows();

    return NextResponse.json({
      success: true,
      message: '工作流列表获取成功',
      data: {
        workflows,
        total: workflows.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dify workflows API error:', error);
    
    const isDifyError = error instanceof Error && error.message.includes('DIFY_ERROR');
    const statusCode = isDifyError ? 400 : 500;
    
    return NextResponse.json({
      success: false,
      message: '获取工作流列表失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}