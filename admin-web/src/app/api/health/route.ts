import { NextResponse } from 'next/server';
import { testDatabaseConnection } from '@/lib/db-test';
import { testDifyConnection } from '@/lib/dify-test';
import { getAllDifyConfigs } from '@/lib/get-dify-config';

interface DifyTestResult {
  success: boolean;
  message: string;
  error?: string;
  applicationType?: string;
  applicationMode?: string;
}

export async function GET() {
  try {
    // 测试数据库连接
    const dbResult = await testDatabaseConnection();
    // const supabaseResult = await testSupabaseConnection();
    
    // 获取所有Dify配置并测试连接
    const difyConfigs = await getAllDifyConfigs();
    const difyResults: Record<string, DifyTestResult> = {};
    
    for (const [serviceType, config] of Object.entries(difyConfigs)) {
      try {
        difyResults[serviceType] = await testDifyConnection(config);
      } catch (error) {
        difyResults[serviceType] = {
          success: false,
          message: `Dify服务连接失败: ${serviceType}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    const difyHealthy = Object.values(difyResults).every((result: DifyTestResult) => result.success);
    const isHealthy = dbResult.success && difyHealthy; // && supabaseResult.success;
    
    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbResult,
          dify: difyResults,
          // supabase: supabaseResult,
        },
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}