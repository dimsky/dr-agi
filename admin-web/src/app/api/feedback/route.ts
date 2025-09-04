import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { feedback } from '@/db/schema/feedback';
import { users } from '@/db/schema/users';
import { eq, gte, lte, desc, asc, count, or, like, and, isNull } from 'drizzle-orm';
import { withSoftDeleteFilter } from '@/lib/soft-delete';
import { generateFeedbackNumber, FEEDBACK_STATUS_LABELS } from '@/db/schema/feedback';

/**
 * GET /api/feedback - 获取反馈列表
 * 
 * 查询参数：
 * - page: number (可选，默认1) - 页码
 * - limit: number (可选，默认10) - 每页数量，最大100
 * - search: string (可选) - 搜索关键词（反馈内容、标题、反馈编号）
 * - status: 'pending'|'reviewing'|'responded'|'resolved'|'closed'|'all' (可选，默认all) - 反馈状态过滤
 * - category: string (可选) - 反馈分类过滤
 * - userId: string (可选) - 用户ID过滤（管理员功能）
 * - dateFrom: string (可选) - 创建开始日期过滤 (ISO格式)
 * - dateTo: string (可选) - 创建结束日期过滤 (ISO格式)
 * - sortBy: string (可选，默认createdAt) - 排序字段
 * - sortOrder: 'asc'|'desc' (可选，默认desc) - 排序方向
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "message": "获取反馈列表成功",
 *   "data": {
 *     "feedback": [...],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 10,
 *       "total": 100,
 *       "totalPages": 10,
 *       "hasNext": true,
 *       "hasPrev": false
 *     },
 *     "stats": {
 *       "totalFeedback": 100,
 *       "pendingFeedback": 25,
 *       "resolvedFeedback": 60,
 *       "newFeedbackThisMonth": 15
 *     },
 *     "filters": {
 *       "search": "",
 *       "status": "all",
 *       "category": "",
 *       "userId": "",
 *       "dateFrom": null,
 *       "dateTo": null,
 *       "sortBy": "createdAt",
 *       "sortOrder": "desc"
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析查询参数
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;
    
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const category = searchParams.get('category') || '';
    const userId = searchParams.get('userId') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    console.log(`获取反馈列表请求 - 页码: ${page}, 限制: ${limit}, 搜索: "${search}", 状态: ${status}, 分类: ${category}`);
    
    // 构建查询条件
    const conditions = [];
    
    // 搜索条件（反馈内容、标题、反馈编号）
    if (search.trim()) {
      conditions.push(
        or(
          like(feedback.content, `%${search.trim()}%`),
          like(feedback.title, `%${search.trim()}%`),
          like(feedback.feedbackNumber, `%${search.trim()}%`)
        )
      );
    }
    
    // 反馈状态过滤
    if (status && status !== 'all') {
      const validStatuses = ['pending', 'reviewing', 'responded', 'resolved', 'closed'];
      if (validStatuses.includes(status)) {
        conditions.push(eq(feedback.status, status as 'pending' | 'reviewing' | 'responded' | 'resolved' | 'closed'));
      }
    }
    
    // 反馈分类过滤
    if (category.trim()) {
      const validCategories = ['bug_report', 'feature_request', 'improvement', 'user_experience', 'performance', 'content_quality', 'service_quality', 'other'];
      if (validCategories.includes(category.trim())) {
        conditions.push(eq(feedback.category, category.trim() as 'bug_report' | 'feature_request' | 'improvement' | 'user_experience' | 'performance' | 'content_quality' | 'service_quality' | 'other'));
      }
    }
    
    // 用户ID过滤（管理员功能）
    if (userId.trim()) {
      conditions.push(eq(feedback.userId, userId.trim()));
    }
    
    // 创建时间范围过滤
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(feedback.createdAt, fromDate));
      }
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate.getTime())) {
        // 设置为当天结束时间 23:59:59.999
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(feedback.createdAt, toDate));
      }
    }
    
    // 软删除处理：根据status参数决定是否包含已删除记录
    const includeDeletedRecords = false; // 反馈管理暂时不显示已删除记录
    
    // 构建where条件（包含软删除过滤）
    const whereClause = withSoftDeleteFilter(
      conditions.filter(c => c !== undefined), 
      feedback.deletedAt, 
      includeDeletedRecords
    );
    
    // 构建排序条件
    const validSortFields = ['createdAt', 'updatedAt', 'status', 'category', 'feedbackNumber'] as const;
    const actualSortBy = validSortFields.includes(sortBy as typeof validSortFields[number]) ? sortBy : 'createdAt';
    
    let orderClause;
    switch (actualSortBy) {
      case 'updatedAt':
        orderClause = sortOrder === 'asc' ? asc(feedback.updatedAt) : desc(feedback.updatedAt);
        break;
      case 'status':
        orderClause = sortOrder === 'asc' ? asc(feedback.status) : desc(feedback.status);
        break;
      case 'category':
        orderClause = sortOrder === 'asc' ? asc(feedback.category) : desc(feedback.category);
        break;
      case 'feedbackNumber':
        orderClause = sortOrder === 'asc' ? asc(feedback.feedbackNumber) : desc(feedback.feedbackNumber);
        break;
      case 'createdAt':
      default:
        orderClause = sortOrder === 'asc' ? asc(feedback.createdAt) : desc(feedback.createdAt);
        break;
    }
    
    // 获取反馈总数（当前条件下）
    const totalResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(whereClause);
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    // 获取反馈列表（关联用户信息）
    const feedbackList = await db
      .select({
        // 反馈字段
        id: feedback.id,
        feedbackNumber: feedback.feedbackNumber,
        category: feedback.category,
        title: feedback.title,
        content: feedback.content,
        status: feedback.status,
        adminResponse: feedback.adminResponse,
        adminId: feedback.adminId,
        respondedAt: feedback.respondedAt,
        resolvedAt: feedback.resolvedAt,
        createdAt: feedback.createdAt,
        updatedAt: feedback.updatedAt,
        deletedAt: feedback.deletedAt,
        // 用户字段
        userId: feedback.userId,
        userNickname: users.nickname,
        userEmail: users.email,
        userPhone: users.phone,
        userProfession: users.profession,
        userAvatarUrl: users.avatarUrl,
      })
      .from(feedback)
      .leftJoin(users, eq(feedback.userId, users.id))
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);
    
    // 获取反馈统计信息
    // 总反馈数（未删除）
    const totalFeedbackResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(isNull(feedback.deletedAt));
    
    // 待处理反馈数
    const pendingFeedbackResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(and(
        isNull(feedback.deletedAt),
        eq(feedback.status, 'pending')
      ));
    
    // 已解决反馈数  
    const resolvedFeedbackResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(and(
        isNull(feedback.deletedAt),
        eq(feedback.status, 'resolved')
      ));
    
    // 本月新反馈数
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const newFeedbackThisMonthResult = await db
      .select({ count: count() })
      .from(feedback)
      .where(and(
        isNull(feedback.deletedAt),
        gte(feedback.createdAt, thisMonthStart)
      ));
    
    const stats = {
      totalFeedback: totalFeedbackResult[0]?.count || 0,
      pendingFeedback: pendingFeedbackResult[0]?.count || 0,
      resolvedFeedback: resolvedFeedbackResult[0]?.count || 0,
      newFeedbackThisMonth: newFeedbackThisMonthResult[0]?.count || 0,
    };
    
    // 格式化响应数据
    const formattedFeedback = feedbackList.map(item => ({
      id: item.id,
      feedbackNumber: item.feedbackNumber,
      category: {
        key: item.category,
        label: item.category,
      },
      title: item.title,
      content: item.content,
      status: {
        key: item.status,
        label: FEEDBACK_STATUS_LABELS[item.status] || item.status,
      },
      user: {
        id: item.userId,
        nickname: item.userNickname || '未知用户',
        email: item.userEmail || '',
        phone: item.userPhone || '',
        profession: item.userProfession || '',
        avatarUrl: item.userAvatarUrl || '',
      },
      adminResponse: item.adminResponse,
      adminId: item.adminId,
      respondedAt: item.respondedAt,
      resolvedAt: item.resolvedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
      // 计算状态
      isNewFeedback: item.createdAt > thisMonthStart,
      hasResponse: !!item.adminResponse,
    }));
    
    console.log(`获取反馈列表成功 - 总数: ${total}, 当前页: ${page}, 返回数量: ${formattedFeedback.length}`);
    
    return NextResponse.json({
      success: true,
      message: '获取反馈列表成功',
      data: {
        feedback: formattedFeedback,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        stats,
        filters: {
          search,
          status,
          category,
          userId,
          dateFrom,
          dateTo,
          sortBy: actualSortBy,
          sortOrder,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '获取反馈列表失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * POST /api/feedback - 创建反馈
 * 
 * 请求体：
 * {
 *   "category": "bug_report" | "feature_request" | "improvement" | "user_experience" | 
 *              "performance" | "content_quality" | "service_quality" | "other",
 *   "title": "反馈标题",
 *   "content": "反馈详细内容"
 * }
 * 
 * 请求头：
 * - user-id: string (必需) - 用户ID，用于身份验证
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "message": "反馈提交成功",
 *   "data": {
 *     "feedbackNumber": "FBXXXXXXXX",
 *     "id": "uuid",
 *     "status": "pending"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证用户身份（从header获取user-id）
    const userId = request.headers.get('user-id');
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '用户身份验证失败，请提供有效的用户ID',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }
    
    // 验证用户是否存在
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    
    if (userExists.length === 0) {
      return NextResponse.json({
        success: false,
        message: '用户不存在或已被删除',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }
    
    // 输入验证
    const { category, title, content } = body;
    
    if (!title || !title.trim()) {
      return NextResponse.json({
        success: false,
        message: '反馈标题不能为空',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }
    
    if (!content || !content.trim()) {
      return NextResponse.json({
        success: false,
        message: '反馈内容不能为空',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }
    
    if (!category) {
      return NextResponse.json({
        success: false,
        message: '反馈分类不能为空',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }
    
    // 验证反馈分类是否有效
    const validCategories = [
      'bug_report', 'feature_request', 'improvement', 'user_experience',
      'performance', 'content_quality', 'service_quality', 'other'
    ];
    
    if (!validCategories.includes(category)) {
      return NextResponse.json({
        success: false,
        message: '无效的反馈分类',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }
    
    // 生成唯一的反馈编号
    const feedbackNumber = generateFeedbackNumber();
    
    console.log(`创建反馈 - 用户ID: ${userId}, 分类: ${category}, 反馈编号: ${feedbackNumber}`);
    
    // 创建反馈记录
    const newFeedbackResult = await db
      .insert(feedback)
      .values({
        userId,
        feedbackNumber,
        category: category as 'bug_report' | 'feature_request' | 'improvement' | 'user_experience' | 'performance' | 'content_quality' | 'service_quality' | 'other',
        title: title.trim(),
        content: content.trim(),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: feedback.id,
        feedbackNumber: feedback.feedbackNumber,
        status: feedback.status,
      });
    
    const newFeedback = newFeedbackResult[0];
    
    if (!newFeedback) {
      throw new Error('反馈创建失败');
    }
    
    console.log(`反馈创建成功 - ID: ${newFeedback.id}, 编号: ${newFeedback.feedbackNumber}`);
    
    return NextResponse.json({
      success: true,
      message: '反馈提交成功',
      data: {
        feedbackNumber: newFeedback.feedbackNumber,
        id: newFeedback.id,
        status: newFeedback.status,
      },
      timestamp: new Date().toISOString(),
    }, { status: 201 });
    
  } catch (error) {
    console.error('创建反馈失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '反馈提交失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}