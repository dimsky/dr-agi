import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { eq, gte, lte, desc, asc, count, or, like, and, isNull, isNotNull } from 'drizzle-orm';
import { withSoftDeleteFilter } from '@/lib/soft-delete';

/**
 * GET /api/users - 获取用户列表
 * 
 * 查询参数：
 * - page: number (可选，默认1) - 页码
 * - limit: number (可选，默认10) - 每页数量，最大100
 * - search: string (可选) - 搜索关键词（昵称、邮箱、手机号）
 * - status: 'active'|'inactive'|'deleted'|'all' (可选，默认active) - 用户状态过滤
 * - profession: string (可选) - 职业过滤
 * - dateFrom: string (可选) - 注册开始日期过滤 (ISO格式)
 * - dateTo: string (可选) - 注册结束日期过滤 (ISO格式)
 * - sortBy: string (可选，默认createdAt) - 排序字段
 * - sortOrder: 'asc'|'desc' (可选，默认desc) - 排序方向
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "message": "获取用户列表成功",
 *   "data": {
 *     "users": [...],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 10,
 *       "total": 100,
 *       "totalPages": 10,
 *       "hasNext": true,
 *       "hasPrev": false
 *     },
 *     "stats": {
 *       "totalUsers": 100,
 *       "activeUsers": 85,
 *       "inactiveUsers": 10,
 *       "deletedUsers": 5,
 *       "newUsersThisMonth": 15
 *     },
 *     "filters": {
 *       "search": "",
 *       "status": "active",
 *       "profession": "",
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
    const status = searchParams.get('status') || 'active';
    const profession = searchParams.get('profession') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // 构建查询条件
    const conditions = [];
    
    // 搜索条件（昵称、邮箱、手机号）
    if (search.trim()) {
      conditions.push(
        or(
          like(users.nickname, `%${search.trim()}%`),
          like(users.email, `%${search.trim()}%`),
          like(users.phone, `%${search.trim()}%`)
        )
      );
    }
    
    // 用户状态过滤（业务逻辑）
    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }
    
    // 职业过滤  
    if (profession.trim()) {
      conditions.push(eq(users.profession, profession.trim()));
    }
    
    // 注册时间范围过滤
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(users.registeredAt, fromDate));
      }
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate.getTime())) {
        // 设置为当天结束时间 23:59:59.999
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(users.registeredAt, toDate));
      }
    }
    
    // 软删除处理：根据status参数决定是否包含已删除记录
    const includeDeletedRecords = status === 'deleted' || status === 'all';
    
    // 如果只要查询已删除用户
    if (status === 'deleted') {
      conditions.push(isNotNull(users.deletedAt));
    }
    
    // 构建where条件（包含软删除过滤）
    const whereClause = withSoftDeleteFilter(
      conditions.filter(c => c !== undefined), 
      users.deletedAt, 
      includeDeletedRecords
    );
    
    // 构建排序条件
    const validSortFields = ['createdAt', 'registeredAt', 'lastLoginAt', 'nickname', 'email', 'profession'] as const;
    const actualSortBy = validSortFields.includes(sortBy as typeof validSortFields[number]) ? sortBy : 'createdAt';
    
    let orderClause;
    switch (actualSortBy) {
      case 'registeredAt':
        orderClause = sortOrder === 'asc' ? asc(users.registeredAt) : desc(users.registeredAt);
        break;
      case 'lastLoginAt':
        orderClause = sortOrder === 'asc' ? asc(users.lastLoginAt) : desc(users.lastLoginAt);
        break;
      case 'nickname':
        orderClause = sortOrder === 'asc' ? asc(users.nickname) : desc(users.nickname);
        break;
      case 'email':
        orderClause = sortOrder === 'asc' ? asc(users.email) : desc(users.email);
        break;
      case 'profession':
        orderClause = sortOrder === 'asc' ? asc(users.profession) : desc(users.profession);
        break;
      case 'createdAt':
      default:
        orderClause = sortOrder === 'asc' ? asc(users.createdAt) : desc(users.createdAt);
        break;
    }
    
    // 获取用户总数（当前条件下）
    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);
    
    const total = totalResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);
    
    // 获取用户列表
    const usersList = await db
      .select({
        id: users.id,
        openId: users.openId,
        unionId: users.unionId,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
        gender: users.gender,
        city: users.city,
        province: users.province,
        country: users.country,
        language: users.language,
        email: users.email,
        profession: users.profession,
        phone: users.phone,
        registeredAt: users.registeredAt,
        consentAgreedAt: users.consentAgreedAt,
        consentVersion: users.consentVersion,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);
    
    // 获取用户统计信息
    // 总用户数（活跃状态）
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.isActive, true)));
    
    // 活跃用户数（有登录记录且状态为活跃）
    const activeUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        isNull(users.deletedAt),
        eq(users.isActive, true),
        isNotNull(users.lastLoginAt)
      ));
    
    // 非活跃用户数
    const inactiveUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.isActive, false)));
    
    // 已删除用户数
    const deletedUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(isNotNull(users.deletedAt));
    
    // 本月新用户数
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const newUsersThisMonthResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        isNull(users.deletedAt),
        gte(users.registeredAt, thisMonthStart)
      ));
    
    const stats = {
      totalUsers: totalUsersResult[0]?.count || 0,
      activeUsers: activeUsersResult[0]?.count || 0,
      inactiveUsers: inactiveUsersResult[0]?.count || 0,
      deletedUsers: deletedUsersResult[0]?.count || 0,
      newUsersThisMonth: newUsersThisMonthResult[0]?.count || 0,
    };
    
    // 格式化响应数据
    const formattedUsers = usersList.map(user => ({
      id: user.id,
      openId: user.openId,
      unionId: user.unionId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      location: {
        city: user.city,
        province: user.province,
        country: user.country,
      },
      language: user.language,
      contact: {
        email: user.email,
        phone: user.phone,
      },
      profession: user.profession,
      registeredAt: user.registeredAt,
      consent: {
        agreedAt: user.consentAgreedAt,
        version: user.consentVersion,
      },
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
      // 计算状态
      status: user.deletedAt ? 'deleted' : (user.isActive ? 'active' : 'inactive'),
      // 计算用户活跃度
      isNewUser: user.registeredAt > thisMonthStart,
      hasLoggedIn: !!user.lastLoginAt,
    }));
    
    return NextResponse.json({
      success: true,
      message: '获取用户列表成功',
      data: {
        users: formattedUsers,
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
          profession,
          dateFrom,
          dateTo,
          sortBy: actualSortBy,
          sortOrder,
        },
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('获取用户列表失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '获取用户列表失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}