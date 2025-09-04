import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { orders } from '@/db/schema/orders';
import { users } from '@/db/schema/users';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, User, Activity, CheckCircle, XCircle, Pause } from 'lucide-react';

// 任务状态映射
const statusMap = {
  pending: { 
    label: '等待执行', 
    variant: 'outline' as const, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    icon: Pause
  },
  running: { 
    label: '执行中', 
    variant: 'secondary' as const, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: Activity
  },
  completed: { 
    label: '已完成', 
    variant: 'default' as const, 
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: CheckCircle
  },
  failed: { 
    label: '执行失败', 
    variant: 'destructive' as const, 
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: XCircle
  },
  cancelled: { 
    label: '已取消', 
    variant: 'outline' as const, 
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    icon: XCircle
  }
};

// 扩展的任务详情类型
interface TaskDetailType {
  id: string;
  orderId: string;
  aiServiceId: string;
  difyTaskId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  errorMessage: string | null;
  executionTime: number | null;
  retryCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
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
    avatarUrl: string | null;
  } | null;
  aiService: {
    id: string;
    displayName: string;
    description: string | null;
    difyApiKey: string | null;
  } | null;
}

// 获取任务详情数据
async function getTaskDetail(taskId: string): Promise<TaskDetailType | null> {
  try {
    const taskData = await db
      .select({
        // 任务字段
        id: tasks.id,
        orderId: tasks.orderId,
        aiServiceId: tasks.aiServiceId,
        difyTaskId: tasks.difyTaskId,
        status: tasks.status,
        inputData: tasks.inputData,
        outputData: tasks.outputData,
        errorMessage: tasks.errorMessage,
        executionTime: tasks.executionTime,
        retryCount: tasks.retryCount,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
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
        userAvatarUrl: users.avatarUrl,
        // AI服务字段
        serviceName: aiService.displayName,
        serviceDescription: aiService.description,
        serviceDifyApiKey: aiService.difyApiKey,
      })
      .from(tasks)
      .leftJoin(orders, eq(tasks.orderId, orders.id))
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(tasks.aiServiceId, aiService.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!taskData.length) {
      return null;
    }

    const row = taskData[0];

    return {
      id: row.id,
      orderId: row.orderId,
      aiServiceId: row.aiServiceId,
      difyTaskId: row.difyTaskId,
      status: row.status,
      inputData: row.inputData,
      outputData: row.outputData,
      errorMessage: row.errorMessage,
      executionTime: row.executionTime,
      retryCount: row.retryCount,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
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
        avatarUrl: row.userAvatarUrl,
      },
      aiService: {
        id: row.aiServiceId,
        displayName: row.serviceName || '未知服务',
        description: row.serviceDescription,
        difyApiKey: row.serviceDifyApiKey,
      },
    };
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return null;
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
    second: '2-digit',
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

// JSON数据展示组件
function JsonViewer({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  if (!data) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <div className="text-sm text-muted-foreground">无数据</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{title}</h4>
      <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-96 font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// 主页面组件
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await getTaskDetail(id);

  if (!task) {
    notFound();
  }

  const statusInfo = statusMap[task.status];
  const StatusIcon = statusInfo.icon;
  const progress = calculateProgress(task.status, task.startedAt);

  return (
    <div className="admin-container admin-page">
      {/* 页面头部 */}
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/tasks">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回任务列表
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">任务详情</h1>
          <p className="text-muted-foreground">
            查看AI任务的完整执行信息和结果数据
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 任务基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                <span>任务概要</span>
              </CardTitle>
              <CardDescription>
                任务ID: {task.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">任务状态</label>
                  <div className="mt-1">
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">执行进度</label>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            task.status === 'completed' ? 'bg-green-500' :
                            task.status === 'failed' ? 'bg-red-500' :
                            task.status === 'running' ? 'bg-blue-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">创建时间</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(task.createdAt)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">开始时间</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(task.startedAt)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">完成时间</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(task.completedAt)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">执行时长</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatExecutionTime(task.executionTime)}
                  </p>
                </div>
              </div>

              {task.difyTaskId && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium">Dify任务ID</label>
                    <p className="text-sm text-muted-foreground mt-1 font-mono">
                      {task.difyTaskId}
                    </p>
                  </div>
                </>
              )}

              {task.errorMessage && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-red-600">错误信息</label>
                    <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{task.errorMessage}</p>
                    </div>
                  </div>
                </>
              )}

              {task.retryCount > 0 && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium">重试次数</label>
                    <p className="text-sm text-yellow-600 mt-1">
                      {task.retryCount} 次
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 输入输出数据 */}
          <Card>
            <CardHeader>
              <CardTitle>任务数据</CardTitle>
              <CardDescription>
                AI任务的输入参数和输出结果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <JsonViewer title="输入数据" data={task.inputData} />
              <Separator />
              <JsonViewer title="输出数据" data={task.outputData} />
            </CardContent>
          </Card>
        </div>

        {/* 右侧关联信息 */}
        <div className="space-y-6">
          {/* 用户信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>用户信息</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.user?.avatarUrl && (
                <div className="flex justify-center">
                  <Image 
                    src={task.user.avatarUrl} 
                    alt="用户头像" 
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full border-2 border-border"
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium">昵称</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.user?.nickname || '未设置'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">邮箱</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.user?.email || '未设置'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">手机号</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.user?.phone || '未设置'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">用户ID</label>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                  {task.user?.id}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 服务信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>AI服务</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium">服务名称</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.aiService?.displayName}
                </p>
              </div>
              {task.aiService?.description && (
                <div>
                  <label className="text-sm font-medium">服务描述</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.aiService.description}
                  </p>
                </div>
              )}
              {task.aiService?.difyApiKey && (
                <div>
                  <label className="text-sm font-medium">Dify API配置</label>
                  <p className="text-xs text-muted-foreground mt-1">
                    已配置
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">服务ID</label>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                  {task.aiService?.id}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 订单信息 */}
          {task.order && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>关联订单</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium">订单ID</label>
                  <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                    {task.order.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">订单金额</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    ¥{task.order.amount}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">订单状态</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {task.order.status}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">订单创建时间</label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(task.order.createdAt)}
                  </p>
                </div>
                <div className="pt-2">
                  <Link 
                    href={`/orders/${task.order.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    查看订单详情 →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          <Card>
            <CardHeader>
              <CardTitle>操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {task.status === 'failed' && (
                <Button variant="outline" className="w-full" disabled>
                  重试任务
                </Button>
              )}
              {task.status === 'running' && (
                <Button variant="outline" className="w-full" disabled>
                  取消任务
                </Button>
              )}
              <Button variant="outline" className="w-full" disabled>
                导出任务日志
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// 页面元数据
export const metadata = {
  title: '任务详情 - AI医疗服务平台',
  description: '查看AI医疗服务任务的详细执行信息、输入输出数据和相关用户订单信息。',
};