import { db } from '@/db';
import { users } from '@/db/schema/users';
import { orders } from '@/db/schema/orders';
import { and, asc, desc, eq, like, gte, lte, count, or, sql } from 'drizzle-orm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { UserSearchFilter } from '@/components/client/user-search-filter';

// 用户状态映射
const statusMap = {
  true: { label: '活跃', variant: 'default' as const },
  false: { label: '已禁用', variant: 'destructive' as const }
};

// 性别映射
const genderMap = {
  '0': '未知',
  '1': '男性',
  '2': '女性'
};

// 搜索参数类型
interface SearchParams {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
}

// 扩展的用户类型（包含统计数据）
interface UserWithStats {
  id: string;
  openId: string;
  nickname: string | null;
  avatarUrl: string | null;
  gender: string | null;
  email: string | null;
  profession: string | null;
  phone: string | null;
  registeredAt: Date;
  consentAgreedAt: Date | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalOrders: number;
  completedOrders: number;
  totalSpent: string;
}

// 服务端数据获取函数
async function getUsersData(searchParams: Promise<SearchParams>) {
  // 等待并解析搜索参数
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit || '10')));
  const offset = (page - 1) * limit;
  const status = params.status;
  const search = params.search?.trim();
  const sortBy = params.sortBy || 'registeredAt';
  const sortOrder = params.sortOrder || 'desc';
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;

  // 构建查询条件
  const conditions = [];

  if (status && status !== 'all') {
    if (status === 'active') {
      conditions.push(eq(users.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(users.isActive, false));
    }
  }

  if (search) {
    // 搜索用户ID、昵称、邮箱、手机号、职业
    const searchConditions = [];
    
    // 用户字段
    searchConditions.push(like(sql`${users.id}::text`, `%${search}%`));
    searchConditions.push(like(users.nickname, `%${search}%`));
    searchConditions.push(like(users.email, `%${search}%`));
    searchConditions.push(like(users.phone, `%${search}%`));
    searchConditions.push(like(users.profession, `%${search}%`));
    
    conditions.push(or(...searchConditions));
  }

  if (dateFrom) {
    conditions.push(gte(users.registeredAt, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(users.registeredAt, dateTo));
  }

  // 构建排序
  const orderBy = sortOrder === 'asc' ? asc : desc;
  let sortColumn;
  
  switch (sortBy) {
    case 'nickname':
      sortColumn = users.nickname;
      break;
    case 'email':
      sortColumn = users.email;
      break;
    case 'lastLoginAt':
      sortColumn = users.lastLoginAt;
      break;
    case 'isActive':
      sortColumn = users.isActive;
      break;
    default:
      sortColumn = users.registeredAt;
  }

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    // 查询用户数据
    const usersData = await db
      .select({
        // 用户基本信息
        id: users.id,
        openId: users.openId,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
        gender: users.gender,
        email: users.email,
        profession: users.profession,
        phone: users.phone,
        registeredAt: users.registeredAt,
        consentAgreedAt: users.consentAgreedAt,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(orderBy(sortColumn))
      .limit(limit)
      .offset(offset);

    // 查询总数
    const [totalCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(whereCondition);

    const totalCount = totalCountResult?.count || 0;

    // 为每个用户查询订单统计
    const usersWithStats: UserWithStats[] = await Promise.all(
      usersData.map(async (user) => {
        // 查询用户的订单统计
        const [orderStatsResult] = await db
          .select({
            totalOrders: count(),
            totalSpent: sql<string>`COALESCE(SUM(${orders.amount}::numeric), 0)::text`,
          })
          .from(orders)
          .where(eq(orders.userId, user.id));

        const [completedOrdersResult] = await db
          .select({ count: count() })
          .from(orders)
          .where(
            and(
              eq(orders.userId, user.id),
              eq(orders.status, 'completed')
            )
          );

        return {
          ...user,
          totalOrders: orderStatsResult?.totalOrders || 0,
          completedOrders: completedOrdersResult?.count || 0,
          totalSpent: orderStatsResult?.totalSpent || '0',
        };
      })
    );

    return {
      users: usersWithStats,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  } catch (error) {
    console.error('获取用户数据失败:', error);
    return {
      users: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 0,
      limit,
    };
  }
}

// 格式化日期
function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// 格式化金额
function formatAmount(amount: string): string {
  return `¥${parseFloat(amount).toFixed(2)}`;
}

// 用户表格组件
function UsersTable({ users }: { users: UserWithStats[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">用户ID</TableHead>
            <TableHead>用户信息</TableHead>
            <TableHead>联系方式</TableHead>
            <TableHead>职业</TableHead>
            <TableHead>订单统计</TableHead>
            <TableHead>消费金额</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>注册时间</TableHead>
            <TableHead>最后登录</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                暂无用户数据
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-sm">
                  {user.id.slice(-8)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    {user.avatarUrl && (
                      <Image
                        src={user.avatarUrl}
                        alt={user.nickname || '用户头像'}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="font-medium">
                        {user.nickname || '未设置昵称'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {user.gender ? genderMap[user.gender as keyof typeof genderMap] : '-'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">
                      {user.email || '-'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {user.phone || '-'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {user.profession || '-'}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">
                      总订单: {user.totalOrders}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      已完成: {user.completedOrders}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono">
                  {formatAmount(user.totalSpent)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusMap[user.isActive ? 'true' : 'false']?.variant || 'outline'}>
                    {statusMap[user.isActive ? 'true' : 'false']?.label || '未知'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(user.registeredAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(user.lastLoginAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/users/${user.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    查看详情
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// 分页组件
function Pagination({ 
  currentPage, 
  totalPages, 
  searchParams 
}: { 
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== 'page') {
        params.set(key, value);
      }
    });
    params.set('page', page.toString());
    return `?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-sm text-muted-foreground">
        第 {currentPage} 页，共 {totalPages} 页
      </div>
      <div className="flex items-center space-x-2">
        {currentPage > 1 && (
          <>
            <Link
              href={createPageUrl(1)}
              className="px-3 py-2 text-sm border rounded-md hover:bg-accent"
            >
              首页
            </Link>
            <Link
              href={createPageUrl(currentPage - 1)}
              className="px-3 py-2 text-sm border rounded-md hover:bg-accent"
            >
              上一页
            </Link>
          </>
        )}
        
        <span className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md">
          {currentPage}
        </span>
        
        {currentPage < totalPages && (
          <>
            <Link
              href={createPageUrl(currentPage + 1)}
              className="px-3 py-2 text-sm border rounded-md hover:bg-accent"
            >
              下一页
            </Link>
            <Link
              href={createPageUrl(totalPages)}
              className="px-3 py-2 text-sm border rounded-md hover:bg-accent"
            >
              末页
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// 统计卡片组件
async function UserStats() {
  try {
    // 获取统计数据
    const [totalResult] = await db.select({ count: count() }).from(users);
    const [activeResult] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
    const [newUsersResult] = await db.select({ count: count() })
      .from(users)
      .where(gte(users.registeredAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))); // 最近7天
    
    const totalUsers = totalResult?.count || 0;
    const activeUsers = activeResult?.count || 0;
    const newUsers = newUsersResult?.count || 0;

    return (
      <div className="admin-grid admin-grid-cols-4">
        <div className="admin-card">
          <div className="stat-label">总用户数</div>
          <div className="stat-number">{totalUsers}</div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">活跃用户</div>
          <div className="stat-number text-success">{activeUsers}</div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">新用户（7天）</div>
          <div className="stat-number text-info">{newUsers}</div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">活跃率</div>
          <div className="stat-number">
            {totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}%
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return (
      <div className="admin-grid admin-grid-cols-4">
        <div className="admin-card">
          <div className="text-sm text-muted-foreground">统计数据加载失败</div>
        </div>
      </div>
    );
  }
}


// 主页面组件
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 获取用户数据
  const { users: usersData, totalCount, currentPage, totalPages } = await getUsersData(searchParams);
  
  // 解析searchParams用于传递给子组件
  const params = await searchParams;

  return (
    <div className="admin-container admin-page">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">
            管理和监控平台用户信息
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <Suspense fallback={
        <div className="admin-grid admin-grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-card">
              <div className="h-4 bg-muted animate-pulse rounded"></div>
              <div className="h-8 bg-muted animate-pulse rounded mt-2"></div>
            </div>
          ))}
        </div>
      }>
        <UserStats />
      </Suspense>

      {/* 搜索和筛选 */}
      <UserSearchFilter />

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            共 {totalCount} 位用户
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsersTable users={usersData} />
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            searchParams={params}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// 页面元数据
export const metadata = {
  title: '用户管理 - AI医疗服务平台',
  description: '管理和监控平台用户信息，查看用户状态、订单统计等。',
};