import { NextRequest, NextResponse } from 'next/server';
import { medicalServiceProcessor } from '@/services/medical';
import { db } from '@/db';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';
import { withSoftDeleteFilter } from '@/lib/soft-delete';

/**
 * GET /api/services - 获取可用的AI服务列表
 * 
 * 查询参数：
 * - isActive: boolean (可选) - 筛选激活状态的服务
 * - category: string (可选) - 按服务分类筛选
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "services": [
 *       {
 *         "id": "uuid-123",
 *         "displayName": "营养方案制定",
 *         "description": "为患者制定个性化营养方案",
 *         "category": "nutrition",
 *         "pricing": { ... },
 *         "isActive": true,
 *         "estimatedDuration": "5-10分钟"
 *       }
 *     ],
 *     "total": 7
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get('isActive');

    // 构建过滤条件
    const filters: Record<string, unknown> = {};
    
    if (isActiveParam !== null) {
      filters.isActive = isActiveParam === 'true';
    } else {
      // 对于管理界面，默认显示所有服务（包括停用的）
      filters.isActive = undefined;
    }

    // 获取服务列表
    const services = await medicalServiceProcessor.getAvailableServices(filters);

    // 格式化响应数据，只返回前端需要的字段
    const formattedServices = services.map(service => ({
      id: service.id,
      displayName: service.displayName,
      description: service.description || '',
      difyConfig: {
        apiKey: service.difyConfig?.apiKey || '',
        baseUrl: service.difyConfig?.baseUrl || ''
      },
      pricing: {
        basePrice: service.pricing?.basePrice || 0,
        currency: service.pricing?.currency || 'CNY',
        priceType: service.pricing?.priceType || 'fixed'
      },
      isActive: service.isActive,
      estimatedDuration: '3-5分钟'
    }));

    return NextResponse.json({
      success: true,
      message: '获取服务列表成功',
      data: {
        services: formattedServices,
        total: formattedServices.length,
        filters: {
          isActive: isActiveParam ? isActiveParam === 'true' : undefined
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取服务列表失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '获取服务列表失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/services - 创建新的AI服务配置
 * 
 * 请求体：
 * {
 *   "displayName": "服务显示名称",
 *   "description": "服务描述",
 *   "difyApiKey": "Dify API密钥",
 *   "difyBaseUrl": "Dify服务基础URL",
 *   "pricing": {
 *     "basePrice": 10.00,
 *     "currency": "CNY",
 *     "priceType": "fixed"
 *   },
 *   "isActive": true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 开始创建AI服务配置');

    // 验证管理员权限
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '用户认证失败',
        message: '请重新登录后再试',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // 解析请求体
    const requestBody = await request.json();
    const { 
      displayName, 
      description, 
      difyApiKey, 
      difyBaseUrl, 
      pricing, 
      isActive = true 
    } = requestBody;

    // 验证必需字段
    if (!displayName || !displayName.trim()) {
      return NextResponse.json({
        success: false,
        error: '缺少服务显示名称',
        message: '请提供有效的服务显示名称',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (!difyApiKey || !difyApiKey.trim()) {
      return NextResponse.json({
        success: false,
        error: '缺少Dify API密钥',
        message: '请提供有效的Dify API密钥',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (!difyBaseUrl || !difyBaseUrl.trim()) {
      return NextResponse.json({
        success: false,
        error: '缺少Dify服务URL',
        message: '请提供有效的Dify服务基础URL',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 验证定价信息
    if (!pricing || typeof pricing !== 'object') {
      return NextResponse.json({
        success: false,
        error: '无效的定价配置',
        message: '请提供有效的服务定价配置',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const { basePrice, currency = 'CNY', priceType = 'fixed' } = pricing;
    
    if (typeof basePrice !== 'number' || basePrice < 0) {
      return NextResponse.json({
        success: false,
        error: '无效的服务价格',
        message: '服务价格必须是非负数',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 创建服务配置
    const [newService] = await db.insert(aiService).values({
      displayName: displayName.trim(),
      description: description?.trim() || null,
      difyApiKey: difyApiKey.trim(),
      difyBaseUrl: difyBaseUrl.trim(),
      pricing: {
        basePrice,
        currency,
        priceType
      },
      isActive: Boolean(isActive),
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    console.log('✅ AI服务配置创建成功:', {
      serviceId: newService.id,
      displayName: newService.displayName,
      userId
    });

    return NextResponse.json({
      success: true,
      message: 'AI服务配置创建成功',
      data: {
        id: newService.id,
        displayName: newService.displayName,
        description: newService.description,
        pricing: newService.pricing,
        isActive: newService.isActive,
        createdAt: newService.createdAt.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 创建AI服务配置失败:', error);

    return NextResponse.json({
      success: false,
      error: '创建AI服务配置失败',
      message: '请稍后重试，如问题持续请联系技术支持',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * PUT /api/services - 更新AI服务配置
 * 
 * 请求体：
 * {
 *   "id": "服务ID",
 *   "displayName": "更新的服务显示名称",
 *   "description": "更新的服务描述",
 *   "difyApiKey": "更新的Dify API密钥",
 *   "difyBaseUrl": "更新的Dify服务基础URL",
 *   "pricing": {
 *     "basePrice": 15.00,
 *     "currency": "CNY",
 *     "priceType": "fixed"
 *   },
 *   "isActive": false
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('🔧 开始更新AI服务配置');

    // 验证管理员权限
    const userId = request.headers.get('x-user-id');
    console.log("userId", userId)
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '用户认证失败',
        message: '请重新登录后再试',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // 解析请求体
    const requestBody = await request.json();
    const { 
      id,
      displayName, 
      description, 
      difyApiKey, 
      difyBaseUrl, 
      pricing, 
      isActive 
    } = requestBody;

    // 验证服务ID
    if (!id || !id.trim()) {
      return NextResponse.json({
        success: false,
        error: '缺少服务ID',
        message: '请提供要更新的服务ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 查询现有服务
    const whereClause = withSoftDeleteFilter([eq(aiService.id, id.trim())], aiService.deletedAt);
    const [existingService] = await db
      .select()
      .from(aiService)
      .where(whereClause);

    if (!existingService) {
      return NextResponse.json({
        success: false,
        error: '服务不存在',
        message: `服务ID ${id} 不存在或已被删除`,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (displayName !== undefined) {
      if (!displayName.trim()) {
        return NextResponse.json({
          success: false,
          error: '无效的服务显示名称',
          message: '服务显示名称不能为空',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      updateData.displayName = displayName.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (difyApiKey !== undefined) {
      if (!difyApiKey.trim()) {
        return NextResponse.json({
          success: false,
          error: '无效的Dify API密钥',
          message: 'Dify API密钥不能为空',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      updateData.difyApiKey = difyApiKey.trim();
    }

    if (difyBaseUrl !== undefined) {
      if (!difyBaseUrl.trim()) {
        return NextResponse.json({
          success: false,
          error: '无效的Dify服务URL',
          message: 'Dify服务基础URL不能为空',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
      updateData.difyBaseUrl = difyBaseUrl.trim();
    }

    if (pricing !== undefined) {
      if (!pricing || typeof pricing !== 'object') {
        return NextResponse.json({
          success: false,
          error: '无效的定价配置',
          message: '请提供有效的服务定价配置',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }

      const { basePrice, currency, priceType } = pricing;
      
      if (basePrice !== undefined && (typeof basePrice !== 'number' || basePrice < 0)) {
        return NextResponse.json({
          success: false,
          error: '无效的服务价格',
          message: '服务价格必须是非负数',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }

      updateData.pricing = {
        basePrice: basePrice !== undefined ? basePrice : existingService.pricing?.basePrice || 0,
        currency: currency || existingService.pricing?.currency || 'CNY',
        priceType: priceType || existingService.pricing?.priceType || 'fixed'
      };
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    // 更新服务配置
    const [updatedService] = await db
      .update(aiService)
      .set(updateData)
      .where(eq(aiService.id, id.trim()))
      .returning();

    console.log('✅ AI服务配置更新成功:', {
      serviceId: updatedService.id,
      displayName: updatedService.displayName,
      isActive: updatedService.isActive,
      userId
    });

    return NextResponse.json({
      success: true,
      message: 'AI服务配置更新成功',
      data: {
        id: updatedService.id,
        displayName: updatedService.displayName,
        description: updatedService.description,
        pricing: updatedService.pricing,
        isActive: updatedService.isActive,
        updatedAt: updatedService.updatedAt.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 更新AI服务配置失败:', error);

    return NextResponse.json({
      success: false,
      error: '更新AI服务配置失败',
      message: '请稍后重试，如问题持续请联系技术支持',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * DELETE /api/services - 删除AI服务配置（软删除）
 * 
 * 请求体：
 * {
 *   "id": "服务ID"
 * }
 * 
 * 或通过查询参数：
 * DELETE /api/services?id=服务ID
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ 开始删除AI服务配置');

    // 验证管理员权限
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '用户认证失败',
        message: '请重新登录后再试',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    // 获取服务ID（支持查询参数或请求体）
    const { searchParams } = new URL(request.url);
    let serviceId = searchParams.get('id');

    if (!serviceId) {
      try {
        const requestBody = await request.json();
        serviceId = requestBody.id;
      } catch {
        // 忽略JSON解析错误，继续使用查询参数
      }
    }

    // 验证服务ID
    if (!serviceId || !serviceId.trim()) {
      return NextResponse.json({
        success: false,
        error: '缺少服务ID',
        message: '请提供要删除的服务ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // 查询现有服务
    const whereClause = withSoftDeleteFilter([eq(aiService.id, serviceId.trim())], aiService.deletedAt);
    const [existingService] = await db
      .select()
      .from(aiService)
      .where(whereClause);

    if (!existingService) {
      return NextResponse.json({
        success: false,
        error: '服务不存在',
        message: `服务ID ${serviceId} 不存在或已被删除`,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

    // 软删除服务配置
    const [deletedService] = await db
      .update(aiService)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        isActive: false // 同时设置为非激活状态
      })
      .where(eq(aiService.id, serviceId.trim()))
      .returning();

    console.log('✅ AI服务配置删除成功:', {
      serviceId: deletedService.id,
      displayName: deletedService.displayName,
      userId
    });

    return NextResponse.json({
      success: true,
      message: 'AI服务配置删除成功',
      data: {
        id: deletedService.id,
        displayName: deletedService.displayName,
        deletedAt: deletedService.deletedAt?.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 删除AI服务配置失败:', error);

    return NextResponse.json({
      success: false,
      error: '删除AI服务配置失败',
      message: '请稍后重试，如问题持续请联系技术支持',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}