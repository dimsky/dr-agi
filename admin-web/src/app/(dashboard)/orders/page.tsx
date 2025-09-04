import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { users } from '@/db/schema/users';
import { aiService } from '@/db/schema/ai_service';
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
import { OrderSearchFilter } from '@/components/client/order-search-filter';
import Link from 'next/link';
import { Suspense } from 'react';

// 订单状态映射
const statusMap = {
  pending: { label: '待支付', variant: 'outline' as const },
  paid: { label: '已支付', variant: 'default' as const },
  processing: { label: '处理中', variant: 'secondary' as const },
  completed: { label: '已完成', variant: 'default' as const },
  cancelled: { label: '已取消', variant: 'destructive' as const },
  refunded: { label: '已退款', variant: 'outline' as const }
};

// 支付方式映射
const paymentMethodMap = {
  wechat_pay: '微信支付',
  alipay: '支付宝',
  credit_card: '信用卡',
  bank_card: '银行卡'
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

// 扩展的订单类型（包含关联数据）
interface OrderWithRelations {
  id: string;
  userId: string;
  aiServiceId: string;
  serviceData: Record<string, unknown> | null;
  status: 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  amount: string;
  paymentMethod: 'wechat_pay' | 'alipay' | 'credit_card' | 'bank_card' | null;
  transactionId: string | null;
  createdAt: Date;
  paidAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  user: {
    id: string;
    nickname: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  aiService: {
    id: string;
    displayName: string;
    description: string | null;
  } | null;
}

// 服务端数据获取函数
async function getOrdersData(searchParams: Promise<SearchParams>) {
  // 等待并解析搜索参数
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(params.limit || '10')));
  const offset = (page - 1) * limit;
  const status = params.status;
  const search = params.search?.trim();
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
  const dateTo = params.dateTo ? new Date(params.dateTo) : null;

  // 构建查询条件
  const conditions = [];

  if (status && status !== 'all') {
    const validStatuses = ['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded'] as const;
    type ValidStatus = typeof validStatuses[number];
    if (validStatuses.includes(status as ValidStatus)) {
      conditions.push(eq(orders.status, status as ValidStatus));
    }
  }

  if (search) {
    // 搜索订单ID、交易ID、用户昵称、邮箱、手机号或服务名称
    const searchConditions = [];
    
    // 订单字段 - UUID需要转换为字符串
    searchConditions.push(like(sql`${orders.id}::text`, `%${search}%`));
    searchConditions.push(like(orders.transactionId, `%${search}%`));
    
    // 用户字段
    searchConditions.push(like(users.nickname, `%${search}%`));
    searchConditions.push(like(users.email, `%${search}%`));
    searchConditions.push(like(users.phone, `%${search}%`));
    
    // 服务字段
    searchConditions.push(like(aiService.displayName, `%${search}%`));
    
    conditions.push(or(...searchConditions));
  }

  if (dateFrom) {
    conditions.push(gte(orders.createdAt, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(orders.createdAt, dateTo));
  }

  // 构建排序
  const orderBy = sortOrder === 'asc' ? asc : desc;
  let sortColumn;
  
  switch (sortBy) {
    case 'amount':
      sortColumn = orders.amount;
      break;
    case 'status':
      sortColumn = orders.status;
      break;
    case 'paidAt':
      sortColumn = orders.paidAt;
      break;
    case 'completedAt':
      sortColumn = orders.completedAt;
      break;
    default:
      sortColumn = orders.createdAt;
  }

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    // 查询订单数据（带关联）
    const ordersData = await db
      .select({
        // 订单字段
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
        // 用户字段
        userNickname: users.nickname,
        userEmail: users.email,
        userPhone: users.phone,
        // AI服务字段
        serviceName: aiService.displayName,
        serviceDescription: aiService.description,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(whereCondition)
      .orderBy(orderBy(sortColumn))
      .limit(limit)
      .offset(offset);

    // 查询总数
    const [totalCountResult] = await db
      .select({ count: count() })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(whereCondition);

    const totalCount = totalCountResult?.count || 0;

    // 转换数据格式
    const formattedOrders: OrderWithRelations[] = ordersData.map(row => ({
      id: row.id,
      userId: row.userId,
      aiServiceId: row.aiServiceId,
      serviceData: row.serviceData,
      status: row.status,
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      transactionId: row.transactionId,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
      user: {
        id: row.userId,
        nickname: row.userNickname,
        email: row.userEmail,
        phone: row.userPhone,
      },
      aiService: {
        id: row.aiServiceId,
        displayName: row.serviceName || '未知服务',
        description: row.serviceDescription,
      },
    }));

    return {
      orders: formattedOrders,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  } catch (error) {
    console.error('获取订单数据失败:', error);
    return {
      orders: [],
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

// 订单表格组件
function OrdersTable({ orders }: { orders: OrderWithRelations[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">订单ID</TableHead>
            <TableHead>用户信息</TableHead>
            <TableHead>服务名称</TableHead>
            <TableHead>金额</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>支付方式</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>支付时间</TableHead>
            <TableHead>完成时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                暂无订单数据
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-sm">
                  {order.id.slice(-8)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {order.user?.nickname || '未知用户'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {order.user?.email || order.user?.phone || '-'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {order.aiService?.displayName || '未知服务'}
                    </div>
                    {order.aiService?.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {order.aiService.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono">
                  {formatAmount(order.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusMap[order.status]?.variant || 'outline'}>
                    {statusMap[order.status]?.label || order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {order.paymentMethod 
                    ? paymentMethodMap[order.paymentMethod] || order.paymentMethod
                    : '-'
                  }
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(order.createdAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(order.paidAt)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(order.completedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/orders/${order.id}`}
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
async function OrderStats() {
  try {
    // 获取统计数据
    const [totalResult] = await db.select({ count: count() }).from(orders);
    const [pendingResult] = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'pending'));
    const [completedResult] = await db.select({ count: count() }).from(orders).where(eq(orders.status, 'completed'));
    
    const totalOrders = totalResult?.count || 0;
    const pendingOrders = pendingResult?.count || 0;
    const completedOrders = completedResult?.count || 0;

    return (
      <div className="admin-grid admin-grid-cols-4">
        <div className="admin-card">
          <div className="stat-label">总订单数</div>
          <div className="stat-number">{totalOrders}</div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">待支付订单</div>
          <div className="stat-number text-warning">{pendingOrders}</div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">已完成订单</div>
          <div className="stat-number text-success">{completedOrders}</div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">完成率</div>
          <div className="stat-number">
            {totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
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
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 获取订单数据
  const { orders, totalCount, currentPage, totalPages } = await getOrdersData(searchParams);
  
  // 解析searchParams用于传递给子组件
  const params = await searchParams;

  return (
    <div className="admin-container admin-page">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">订单管理</h1>
          <p className="text-muted-foreground">
            管理和监控所有医疗服务订单
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
        <OrderStats />
      </Suspense>

      {/* 搜索和筛选 */}
      <OrderSearchFilter />

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
          <CardDescription>
            共 {totalCount} 条订单记录
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <OrdersTable orders={orders} />
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
  title: '订单管理 - AI医疗服务平台',
  description: '管理和监控所有医疗服务订单，查看订单状态、支付信息等。',
};