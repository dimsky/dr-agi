import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
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
import Link from 'next/link';
import { Suspense } from 'react';

// 任务状态映射
const statusMap = {
  pending: { label: '等待执行', variant: 'outline' as const, color: 'text-warning' },
  running: { label: '执行中', variant: 'secondary' as const, color: 'text-info' },
  completed: { label: '已完成', variant: 'default' as const, color: 'text-success' },
  failed: { label: '执行失败', variant: 'destructive' as const, color: 'text-destructive' },
  cancelled: { label: '已取消', variant: 'outline' as const, color: 'text-muted-foreground' }
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

// 扩展的任务类型（包含关联数据）
interface TaskWithRelations {
  id: string;
  orderId: string;
  aiServiceId: string;
  difyTaskId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  executionTime: number | null;
  retryCount: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    userId: string;
    amount: string;
    status: string;
    createdAt: Date;
  } | null;
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
async function getTasksData(searchParams: Promise<SearchParams>) {
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
    const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
    type ValidStatus = typeof validStatuses[number];
    if (validStatuses.includes(status as ValidStatus)) {
      conditions.push(eq(tasks.status, status as ValidStatus));
    }
  }

  if (search) {
    // 搜索任务ID、Dify任务ID、用户昵称、邮箱、手机号或服务名称
    const searchConditions = [];
    
    // 任务字段 - UUID需要转换为字符串
    searchConditions.push(like(sql`${tasks.id}::text`, `%${search}%`));
    searchConditions.push(like(tasks.difyTaskId, `%${search}%`));
    
    // 订单字段
    searchConditions.push(like(sql`${orders.id}::text`, `%${search}%`));
    
    // 用户字段
    searchConditions.push(like(users.nickname, `%${search}%`));
    searchConditions.push(like(users.email, `%${search}%`));
    searchConditions.push(like(users.phone, `%${search}%`));
    
    // 服务字段
    searchConditions.push(like(aiService.displayName, `%${search}%`));
    
    conditions.push(or(...searchConditions));
  }

  if (dateFrom) {
    conditions.push(gte(tasks.createdAt, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(tasks.createdAt, dateTo));
  }

  // 构建排序
  const orderBy = sortOrder === 'asc' ? asc : desc;
  let sortColumn;
  
  switch (sortBy) {
    case 'status':
      sortColumn = tasks.status;
      break;
    case 'executionTime':
      sortColumn = tasks.executionTime;
      break;
    case 'startedAt':
      sortColumn = tasks.startedAt;
      break;
    case 'completedAt':
      sortColumn = tasks.completedAt;
      break;
    case 'retryCount':
      sortColumn = tasks.retryCount;
      break;
    default:
      sortColumn = tasks.createdAt;
  }

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    // 查询任务数据（带关联）
    const tasksData = await db
      .select({
        // 任务字段
        id: tasks.id,
        orderId: tasks.orderId,
        aiServiceId: tasks.aiServiceId,
        difyTaskId: tasks.difyTaskId,
        status: tasks.status,
        executionTime: tasks.executionTime,
        retryCount: tasks.retryCount,
        errorMessage: tasks.errorMessage,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        // 订单字段
        orderAmount: orders.amount,
        orderStatus: orders.status,
        orderCreatedAt: orders.createdAt,
        orderUserId: orders.userId,
        // 用户字段
        userNickname: users.nickname,
        userEmail: users.email,
        userPhone: users.phone,
        // AI服务字段
        serviceName: aiService.displayName,
        serviceDescription: aiService.description,
      })
      .from(tasks)
      .leftJoin(orders, eq(tasks.orderId, orders.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(tasks.aiServiceId, aiService.id))
      .where(whereCondition)
      .orderBy(orderBy(sortColumn))
      .limit(limit)
      .offset(offset);

    // 查询总数
    const [totalCountResult] = await db
      .select({ count: count() })
      .from(tasks)
      .leftJoin(orders, eq(tasks.orderId, orders.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(tasks.aiServiceId, aiService.id))
      .where(whereCondition);

    const totalCount = totalCountResult?.count || 0;

    // 转换数据格式
    const formattedTasks: TaskWithRelations[] = tasksData.map(row => ({
      id: row.id,
      orderId: row.orderId,
      aiServiceId: row.aiServiceId,
      difyTaskId: row.difyTaskId,
      status: row.status,
      executionTime: row.executionTime,
      retryCount: row.retryCount,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      order: row.orderAmount ? {
        id: row.orderId,
        userId: row.orderUserId || '',
        amount: row.orderAmount,
        status: row.orderStatus || '',
        createdAt: row.orderCreatedAt || new Date(),
      } : null,
      user: {
        id: row.orderUserId || '',
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
      tasks: formattedTasks,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit,
    };
  } catch (error) {
    console.error('获取任务数据失败:', error);
    return {
      tasks: [],
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

// 格式化执行时长
function formatExecutionTime(seconds: number | null): string {
  if (!seconds) return '-';
  
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }
}

// 计算任务进度百分比
function calculateProgress(
  status: string,
  startedAt: Date | null
): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'running':
      if (startedAt) {
        // 根据运行时间估算进度（假设最长5分钟）
        const elapsedMs = Date.now() - startedAt.getTime();
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const maxEstimatedTime = 300; // 5分钟
        const progress = Math.min((elapsedSeconds / maxEstimatedTime) * 80, 80);
        return Math.round(progress);
      }
      return 10;
    case 'completed':
      return 100;
    case 'failed':
    case 'cancelled':
      return startedAt ? 100 : 0;
    default:
      return 0;
  }
}

// 任务表格组件
function TasksTable({ tasks }: { tasks: TaskWithRelations[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">任务ID</TableHead>
            <TableHead>用户信息</TableHead>
            <TableHead>服务名称</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>进度</TableHead>
            <TableHead>执行时长</TableHead>
            <TableHead>重试次数</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>开始时间</TableHead>
            <TableHead>完成时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                暂无任务数据
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => {
              const progress = calculateProgress(task.status, task.startedAt);
              
              return (
                <TableRow key={task.id}>
                  <TableCell className="font-mono text-sm">
                    {task.id.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {task.user?.nickname || '未知用户'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {task.user?.email || task.user?.phone || '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {task.aiService?.displayName || '未知服务'}
                      </div>
                      {task.aiService?.description && (
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {task.aiService.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusMap[task.status]?.variant || 'outline'}>
                      {statusMap[task.status]?.label || task.status}
                    </Badge>
                    {task.errorMessage && (
                      <div className="text-xs text-destructive mt-1 truncate max-w-[150px]" 
                           title={task.errorMessage}>
                        {task.errorMessage}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${
                              task.status === 'completed' ? 'bg-success' :
                              task.status === 'failed' ? 'bg-destructive' :
                              task.status === 'running' ? 'bg-info' : 'bg-warning'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8">
                          {progress}%
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatExecutionTime(task.executionTime)}
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm ${task.retryCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {task.retryCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(task.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(task.startedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(task.completedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      查看详情
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
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
async function TaskStats() {
  try {
    // 获取统计数据
    const [totalResult] = await db.select({ count: count() }).from(tasks);
    const [pendingResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'pending'));
    const [runningResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'running'));
    const [completedResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'completed'));
    const [failedResult] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, 'failed'));
    
    // 计算平均执行时间
    const [avgTimeResult] = await db
      .select({ 
        avg: sql<string>`AVG(${tasks.executionTime})::integer`
      })
      .from(tasks)
      .where(eq(tasks.status, 'completed'));

    const totalTasks = totalResult?.count || 0;
    const pendingTasks = pendingResult?.count || 0;
    const runningTasks = runningResult?.count || 0;
    const completedTasks = completedResult?.count || 0;
    const failedTasks = failedResult?.count || 0;
    const avgExecutionTime = parseInt(avgTimeResult?.avg || '0');

    // 计算成功率
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
      <div className="admin-grid admin-grid-cols-4">
        <div className="admin-card">
          <div className="stat-label">总任务数</div>
          <div className="stat-number">{totalTasks}</div>
          <div className="text-xs text-muted-foreground mt-1">
            运行中: {runningTasks} | 等待: {pendingTasks}
          </div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">已完成任务</div>
          <div className="stat-number text-success">{completedTasks}</div>
          <div className="text-xs text-success mt-1">
            成功率: {successRate}%
          </div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">失败任务</div>
          <div className="stat-number text-destructive">{failedTasks}</div>
          <div className="text-xs text-muted-foreground mt-1">
            需要重试或调试
          </div>
        </div>
        
        <div className="admin-card">
          <div className="stat-label">平均执行时间</div>
          <div className="stat-number">
            {formatExecutionTime(avgExecutionTime)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            已完成任务平均时长
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('获取任务统计数据失败:', error);
    return (
      <div className="admin-grid admin-grid-cols-4">
        <div className="admin-card">
          <div className="text-sm text-muted-foreground">统计数据加载失败</div>
        </div>
      </div>
    );
  }
}

// 实时状态指示器组件
function LiveStatusIndicator() {
  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
        <span className="text-muted-foreground">实时监控中</span>
      </div>
      <div className="h-4 w-px bg-border"></div>
      <span className="text-xs text-muted-foreground">
        {new Date().toLocaleTimeString('zh-CN')} 更新
      </span>
    </div>
  );
}

// 主页面组件
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // 获取任务数据
  const { tasks, totalCount, currentPage, totalPages } = await getTasksData(searchParams);
  
  // 解析searchParams用于传递给子组件
  const params = await searchParams;

  return (
    <div className="admin-container admin-page">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">任务监控</h1>
          <p className="text-muted-foreground">
            实时监控AI任务执行状态和性能指标
          </p>
        </div>
        <LiveStatusIndicator />
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
        <TaskStats />
      </Suspense>

      {/* 快速状态过滤 */}
      <div className="flex flex-wrap gap-2">
        <Link 
          href="/tasks" 
          className={`px-3 py-1 text-sm border rounded-md hover:bg-accent transition-colors ${
            !params.status || params.status === 'all' ? 'bg-primary text-primary-foreground' : ''
          }`}
        >
          全部
        </Link>
        <Link 
          href="/tasks?status=running" 
          className={`px-3 py-1 text-sm border rounded-md hover:bg-accent transition-colors ${
            params.status === 'running' ? 'bg-info text-info-foreground' : ''
          }`}
        >
          执行中
        </Link>
        <Link 
          href="/tasks?status=pending" 
          className={`px-3 py-1 text-sm border rounded-md hover:bg-accent transition-colors ${
            params.status === 'pending' ? 'bg-warning text-warning-foreground' : ''
          }`}
        >
          等待执行
        </Link>
        <Link 
          href="/tasks?status=completed" 
          className={`px-3 py-1 text-sm border rounded-md hover:bg-accent transition-colors ${
            params.status === 'completed' ? 'bg-success text-success-foreground' : ''
          }`}
        >
          已完成
        </Link>
        <Link 
          href="/tasks?status=failed" 
          className={`px-3 py-1 text-sm border rounded-md hover:bg-accent transition-colors ${
            params.status === 'failed' ? 'bg-destructive text-destructive-foreground' : ''
          }`}
        >
          失败
        </Link>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>任务执行列表</span>
            <div className="text-sm text-muted-foreground">
              共 {totalCount} 个任务
            </div>
          </CardTitle>
          <CardDescription>
            监控所有AI医疗服务任务的实时执行状态和性能数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TasksTable tasks={tasks} />
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
  title: '任务监控 - AI医疗服务平台',
  description: '实时监控AI任务执行状态、性能指标和错误诊断，确保医疗服务高效运行。',
};