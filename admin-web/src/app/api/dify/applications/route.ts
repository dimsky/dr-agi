import { NextRequest, NextResponse } from 'next/server';
import { getDifyService } from '@/services/dify';
import { getDifyConfigFromDB } from '@/lib/get-dify-config';

/**
 * GET /api/dify/applications?serviceType=xxx - 获取应用信息
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType');

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

    // 获取应用信息
    const applicationInfo = await difyService.getApplicationInfo();
    const applicationType = await difyService.getApplicationType();

    return NextResponse.json({
      success: true,
      message: '应用信息获取成功',
      data: {
        application: {
          type: applicationType,
          name: applicationInfo.name,
          description: applicationInfo.description,
          tags: applicationInfo.tags,
          mode: applicationInfo.mode,
          author_name: applicationInfo.author_name
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dify application info API error:', error);
    
    const isDifyError = error instanceof Error && error.message.includes('DIFY_ERROR');
    const statusCode = isDifyError ? 400 : 500;
    
    return NextResponse.json({
      success: false,
      message: '获取应用信息失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}