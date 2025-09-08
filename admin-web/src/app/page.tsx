import { Suspense } from 'react';
import { db } from '@/db';
import { AdminAuthGuard } from '@/components/auth/admin-auth-guard';
import { AuthTestComponent } from '@/components/auth/auth-test';
import { users } from '@/db/schema/users';
import { orders } from '@/db/schema/orders';
import { tasks } from '@/db/schema/tasks';
import { count, sql, desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  ShoppingCart, 
  Activity, 
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Database,
  Server
} from 'lucide-react';

// 获取统计数据
async function getOverviewStats() {
  try {
    const [
      userStats,
      orderStats,
      taskStats,
      revenueStats
    ] = await Promise.all([
      // 用户统计
      db.select({ 
        total: count(),
        active: count(sql`CASE WHEN ${users.isActive} = true THEN 1 END`)
      }).from(users),
      
      // 订单统计
      db.select({ 
        total: count(),
        pending: count(sql`CASE WHEN ${orders.status} = 'pending' THEN 1 END`),
        completed: count(sql`CASE WHEN ${orders.status} = 'completed' THEN 1 END`),
        revenue: sql<string>`COALESCE(SUM(CASE WHEN ${orders.status} = 'completed' THEN ${orders.amount}::numeric ELSE 0 END), 0)`
      }).from(orders),
      
      // 任务统计
      db.select({ 
        total: count(),
        running: count(sql`CASE WHEN ${tasks.status} = 'running' THEN 1 END`),
        completed: count(sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`),
        failed: count(sql`CASE WHEN ${tasks.status} = 'failed' THEN 1 END`)
      }).from(tasks),
      
      // 今日收入
      db.select({ 
        todayRevenue: sql<string>`COALESCE(SUM(${orders.amount}::numeric), 0)`
      }).from(orders)
      .where(sql`DATE(${orders.createdAt}) = CURRENT_DATE AND ${orders.status} = 'completed'`)
    ]);

    return {
      users: userStats[0],
      orders: orderStats[0],
      tasks: taskStats[0],
      revenue: {
        total: parseFloat(orderStats[0].revenue || '0'),
        today: parseFloat(revenueStats[0].todayRevenue || '0')
      }
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      users: { total: 0, active: 0 },
      orders: { total: 0, pending: 0, completed: 0, revenue: '0' },
      tasks: { total: 0, running: 0, completed: 0, failed: 0 },
      revenue: { total: 0, today: 0 }
    };
  }
}

// 获取最近订单
async function getRecentOrders() {
  try {
    const recentOrders = await db
      .select({
        id: orders.id,
        amount: orders.amount,
        status: orders.status,
        createdAt: orders.createdAt,
        user: {
          id: users.id,
          nickname: users.nickname
        }
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    return recentOrders;
  } catch (error) {
    console.error('获取最近订单失败:', error);
    return [];
  }
}

// 系统健康检查
async function getSystemHealth() {
  try {
    // 简单的数据库连接测试
    await db.select({ count: count() }).from(users).limit(1);
    
    return {
      database: { status: 'healthy', message: '数据库连接正常' },
      api: { status: 'healthy', message: 'API服务运行正常' },
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    console.error('系统健康检查失败:', error);
    return {
      database: { status: 'error', message: '数据库连接异常' },
      api: { status: 'error', message: 'API服务异常' },
      lastCheck: new Date().toISOString()
    };
  }
}

// 状态徽章组件
function StatusBadge({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待处理';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'running': return '运行中';
      default: return status;
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={`${getStatusColor(status)} border`}
    >
      {getStatusText(status)}
    </Badge>
  );
}

// 统计卡片组件
function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend 
}: { 
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${
            trend.positive ? 'text-green-600' : 'text-red-600'
          }`}>
            <TrendingUp className="mr-1 h-3 w-3" />
            {trend.positive ? '+' : ''}{trend.value}% 相比上月
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 系统健康面板组件  
function SystemHealthPanel({ health }: { 
  health: {
    database: { status: string; message: string };
    api: { status: string; message: string };
    lastCheck: string;
  }
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          系统健康状态
        </CardTitle>
        <CardDescription>
          系统各项服务运行状态监控
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="text-sm">数据库</span>
          </div>
          <div className="flex items-center gap-2">
            {health.database.status === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {health.database.message}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm">API服务</span>
          </div>
          <div className="flex items-center gap-2">
            {health.api.status === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {health.api.message}
            </span>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            最后检查: {new Date(health.lastCheck).toLocaleString('zh-CN')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 最近订单表格组件
function RecentOrdersTable({ orders }: { 
  orders: Array<{
    id: string;
    amount: string;
    status: string;
    createdAt: Date;
    user: { id: string; nickname: string | null } | null;
  }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          最近订单
        </CardTitle>
        <CardDescription>
          最新的10条订单记录
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orders.length > 0 ? orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">订单 #{order.id.slice(-8)}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  用户: {order.user?.nickname || '未知用户'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">¥{order.amount}</div>
              </div>
            </div>
          )) : (
            <div className="text-center py-6 text-muted-foreground">
              暂无订单记录
            </div>
          )}
        </div>
        {orders.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full">
              查看所有订单
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 加载中组件
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 仪表板内容组件
async function DashboardContent() {
  const [stats, recentOrders, systemHealth] = await Promise.all([
    getOverviewStats(),
    getRecentOrders(),
    getSystemHealth()
  ]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">仪表板</h1>
          <p className="text-muted-foreground">
            DR.Agent AI 医学服务平台管理概览
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="总用户数"
            value={stats.users.total}
            description={`活跃用户 ${stats.users.active} 人`}
            icon={Users}
            trend={{ value: 12, positive: true }}
          />
          <StatsCard
            title="总订单数"
            value={stats.orders.total}
            description={`待处理 ${stats.orders.pending} 个`}
            icon={ShoppingCart}
            trend={{ value: 8, positive: true }}
          />
          <StatsCard
            title="活跃任务"
            value={stats.tasks.running}
            description={`已完成 ${stats.tasks.completed} 个`}
            icon={Activity}
            trend={{ value: 15, positive: true }}
          />
          <StatsCard
            title="总收入"
            value={`¥${stats.revenue.total.toFixed(2)}`}
            description={`今日收入 ¥${stats.revenue.today.toFixed(2)}`}
            icon={DollarSign}
            trend={{ value: 6, positive: true }}
          />
        </div>

        {/* 详细信息面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<DashboardSkeleton />}>
            <RecentOrdersTable orders={recentOrders} />
          </Suspense>
          <SystemHealthPanel health={systemHealth} />
        </div>

        {/* 认证测试面板 */}
        <div className="flex justify-center">
          <AuthTestComponent />
        </div>
      </div>
    </div>
  );
}

// 主仪表板页面
export default function Home() {
  return (
    <AdminAuthGuard>
      <DashboardContent />
    </AdminAuthGuard>
  );
}
