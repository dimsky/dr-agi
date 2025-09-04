import { NextRequest, NextResponse } from 'next/server';
import { getDifyService } from '@/services/dify';
import { getDifyConfigFromDB } from '@/lib/get-dify-config';

/**
 * GET /api/dify/parameters?serviceId=xxx - 获取Dify应用参数配置
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

    // 获取应用参数配置
    const parameters = await difyService.getApplicationParameters();

    return NextResponse.json({
      success: true,
      message: '应用参数配置获取成功',
      data: parameters,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dify parameters API error:', error);
    
    const isDifyError = error instanceof Error && error.message.includes('DIFY_ERROR');
    const statusCode = isDifyError ? 400 : 500;
    
    return NextResponse.json({
      success: false,
      message: '获取应用参数配置失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}