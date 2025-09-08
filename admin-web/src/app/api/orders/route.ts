import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { AuthenticatedUser, USER_ROLES } from '@/types/auth';
import { medicalServiceProcessor } from '@/services/medical';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { aiService } from '@/db/schema/ai_service';
import { users } from '@/db/schema/users';
import { eq, gte, lte, desc, count, and } from 'drizzle-orm';
import { withSoftDeleteFilter } from '@/lib/soft-delete';

/**
 * GET /api/orders - 获取订单列表
 * 
 * 权限控制：
 * - 管理员可以查看所有订单
 * - 普通用户只能查看自己的订单
 * 
 * 查询参数：
 * - page: number (可选，默认1) - 页码
 * - limit: number (可选，默认10) - 每页数量
 * - status: string (可选) - 订单状态过滤
 * - userId: string (可选) - 用户ID过滤 (仅管理员可用)
 * - aiServiceId: string (可选) - 服务ID过滤
 * - dateFrom: string (可选) - 开始日期过滤 (ISO格式)
 * - dateTo: string (可选) - 结束日期过滤 (ISO格式)
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "data": {
 *     "orders": [...],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 10,
 *       "total": 50,
 *       "totalPages": 5
 *     }
 *   }
 * }
 */
async function getOrders(request: NextRequest, user: AuthenticatedUser) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;
    
    const status = searchParams.get('status');
    let userId = searchParams.get('userId'); // 管理员可以指定用户ID
    const aiServiceId = searchParams.get('aiServiceId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // 权限控制：普通用户只能查看自己的订单
    if (user.role !== USER_ROLES.ADMIN) {
      userId = user.id; // 强制设置为当前用户ID
    }
    
    // 构建查询条件
    const conditions = [];
    
    // 如果指定了userId（管理员查询特定用户或普通用户查询自己）
    if (userId) {
      conditions.push(eq(orders.userId, userId));
    }
    
    if (status) {
      // 验证状态值是否有效
      const validStatuses = ['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded'];
      if (validStatuses.includes(status)) {
        conditions.push(eq(orders.status, status as typeof orders.status.enumValues[number]));
      }
    }
    
    if (aiServiceId) {
      conditions.push(eq(orders.aiServiceId, aiServiceId));
    }
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(orders.createdAt, fromDate));
      }
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(orders.createdAt, toDate));
      }
    }
    
    // 构建where条件（包含软删除过滤）
    const whereClause = withSoftDeleteFilter(conditions, orders.deletedAt);
    
    // 获取总数
    const totalResult = await db
      .select({ count: count() })
      .from(orders)
      .where(whereClause);
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    // 获取订单列表（带关联数据）
    const ordersList = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        aiServiceId: orders.aiServiceId,
        serviceData: orders.serviceData,
        status: orders.status,
        amount: orders.amount,
        paymentMethod: orders.paymentMethod,
        transactionId: orders.transactionId,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        completedAt: orders.completedAt,
        updatedAt: orders.updatedAt,
        // 用户信息
        userNickname: users.nickname,
        userAvatar: users.avatarUrl,
        userOpenId: users.openId,
        // 服务信息
        serviceName: aiService.displayName,
        serviceDescription: aiService.description,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
    
    // 格式化响应数据
    const formattedOrders = ordersList.map(order => ({
      id: order.id,
      userId: order.userId,
      aiServiceId: order.aiServiceId,
      serviceData: order.serviceData,
      status: order.status,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      transactionId: order.transactionId,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      updatedAt: order.updatedAt,
      user: {
        nickname: order.userNickname,
        avatar: order.userAvatar,
        openId: order.userOpenId
      },
      service: {
        name: order.serviceName,
        description: order.serviceDescription
      }
    }));
    
    return NextResponse.json({
      success: true,
      message: '获取订单列表成功',
      data: {
        orders: formattedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          status,
          userId,
          aiServiceId,
          dateFrom,
          dateTo
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('获取订单列表失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '获取订单列表失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * POST /api/orders - 创建AI服务订单
 * 
 * 权限控制：所有认证用户都可以创建订单
 * 
 * 业务流程：
 * 1. 根据serviceId获取AI服务配置
 * 2. 验证服务状态和输入数据
 * 3. 创建待支付订单
 * 4. 返回订单信息供支付流程使用
 * 
 * 请求体格式：
 * {
 *   "serviceId": "uuid-123",  // AI服务ID
 *   "serviceData": { ... }    // 服务输入数据
 * }
 */
async function createOrder(request: NextRequest, user: AuthenticatedUser) {
  try {
    // 解析请求参数
    const body = await request.json();
    const { serviceId, serviceData } = body;

    // 参数验证
    if (!serviceId) {
      return NextResponse.json({
        success: false,
        message: '缺少必需的参数serviceId',
        error: 'MISSING_SERVICE_ID'
      }, { status: 400 });
    }

    if (!serviceData || typeof serviceData !== 'object') {
      return NextResponse.json({
        success: false,
        message: '服务数据不能为空',
        error: 'MISSING_SERVICE_DATA'
      }, { status: 400 });
    }

    // 根据serviceId获取AI服务配置
    const service = await db.query.aiService.findFirst({
      where: eq(aiService.id, serviceId)
    });

    if (!service) {
      return NextResponse.json({
        success: false,
        message: `服务ID ${serviceId} 不存在`,
        error: 'SERVICE_NOT_FOUND'
      }, { status: 404 });
    }

    // 验证服务是否激活
    if (!service.isActive) {
      return NextResponse.json({
        success: false,
        message: `服务 ${service.displayName} 已停用`,
        error: 'SERVICE_INACTIVE'
      }, { status: 403 });
    }

    // 获取服务配置进行输入验证
    const serviceConfig = await medicalServiceProcessor.getServiceConfig(serviceId);
    if (!serviceConfig) {
      return NextResponse.json({
        success: false,
        message: '服务配置获取失败',
        error: 'SERVICE_CONFIG_ERROR'
      }, { status: 500 });
    }

    // 验证服务输入数据
    const validationResult = await medicalServiceProcessor.validateServiceInput(serviceConfig, serviceData);
    if (!validationResult.isValid) {
      return NextResponse.json({
        success: false,
        message: '输入数据验证失败',
        error: 'VALIDATION_FAILED',
        details: validationResult.errors
      }, { status: 400 });
    }

    // 创建订单记录（待支付状态）
    const [order] = await db.insert(orders).values({
      userId: user.id, // 使用认证用户的ID
      aiServiceId: serviceId,
      serviceData,
      status: 'pending', // 待支付
      amount: service.pricing?.basePrice?.toString() || '0.00'
    }).returning();

    // 返回订单信息供支付流程使用
    return NextResponse.json({
      success: true,
      message: '订单创建成功，请完成支付',
      data: {
        orderId: order.id,
        serviceId: service.id,
        serviceName: service.displayName,
        amount: order.amount,
        status: 'pending', // 待支付
        description: service.description,
        paymentRequired: true,
        createdAt: order.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('订单创建失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '订单创建失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// 导出带权限验证的处理函数
export const GET = withAuth()(getOrders);
export const POST = withAuth()(createOrder);