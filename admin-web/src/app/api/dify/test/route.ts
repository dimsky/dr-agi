import { NextRequest, NextResponse } from 'next/server';
import { runAllDifyTests } from '@/lib/dify-test';
import { getDifyConfigFromDB } from '@/lib/get-dify-config';

/**
 * GET /api/dify/test?serviceId=xxx - 测试Dify服务连接和配置
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
    
    // 运行Dify服务测试
    const testResults = await runAllDifyTests(difyConfig);
    
    return NextResponse.json({
      success: true,
      message: 'Dify服务测试完成',
      data: testResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dify test API error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Dify服务测试失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}