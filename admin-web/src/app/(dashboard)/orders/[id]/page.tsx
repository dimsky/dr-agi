import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, CreditCard, User, FileText, Clock, CheckCircle } from 'lucide-react';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { users } from '@/db/schema/users';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// 订单状态映射
const statusMap = {
  pending: { label: '待支付', variant: 'outline' as const, icon: Clock },
  paid: { label: '已支付', variant: 'default' as const, icon: CreditCard },
  processing: { label: '处理中', variant: 'secondary' as const, icon: Clock },
  completed: { label: '已完成', variant: 'default' as const, icon: CheckCircle },
  cancelled: { label: '已取消', variant: 'destructive' as const, icon: ArrowLeft },
  refunded: { label: '已退款', variant: 'outline' as const, icon: ArrowLeft }
};

// 支付方式映射
const paymentMethodMap = {
  wechat_pay: '微信支付',
  alipay: '支付宝',
  credit_card: '信用卡',
  bank_card: '银行卡'
};

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
    openId: string | null;
  } | null;
  aiService: {
    id: string;
    displayName: string;
    description: string | null;
  } | null;
}

// 获取订单详情数据
async function getOrderDetail(orderId: string): Promise<OrderWithRelations | null> {
  try {
    const result = await db
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
        userOpenId: users.openId,
        // AI服务字段
        serviceName: aiService.displayName,
        serviceDescription: aiService.description,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
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
        openId: row.userOpenId,
      },
      aiService: {
        id: row.aiServiceId,
        displayName: row.serviceName || '未知服务',
        description: row.serviceDescription,
      },
    };
  } catch (error) {
    console.error('获取订单详情失败:', error);
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

// 格式化金额
function formatAmount(amount: string): string {
  return `¥${parseFloat(amount).toFixed(2)}`;
}

// 订单状态时间线组件
function OrderTimeline({ order }: { order: OrderWithRelations }) {
  const timelineItems = [
    {
      label: '订单创建',
      time: order.createdAt,
      active: true,
      icon: FileText,
    },
    {
      label: '订单支付',
      time: order.paidAt,
      active: ['paid', 'processing', 'completed'].includes(order.status),
      icon: CreditCard,
    },
    {
      label: '订单完成',
      time: order.completedAt,
      active: order.status === 'completed',
      icon: CheckCircle,
    },
  ];

  return (
    <div className="space-y-4">
      {timelineItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              item.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.active ? 'text-foreground' : 'text-muted-foreground'}`}>
                {item.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(item.time)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 服务数据展示组件
function ServiceDataDisplay({ data }: { data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        暂无服务数据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between items-start">
          <span className="text-sm font-medium text-muted-foreground">{key}:</span>
          <span className="text-sm text-right max-w-[60%] break-all">
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// 主页面组件
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // 获取订单详情
  const order = await getOrderDetail(id);
  
  if (!order) {
    notFound();
  }

  const statusInfo = statusMap[order.status];
  const StatusIcon = statusInfo?.icon || Clock;

  return (
    <div className="admin-container admin-page">
      {/* 页面头部 */}
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/orders">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回订单列表
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">订单详情</h1>
          <p className="text-muted-foreground">
            订单ID: {order.id}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 订单基本信息 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <StatusIcon className="w-5 h-5" />
                  <span>订单状态</span>
                </CardTitle>
                <Badge variant={statusInfo?.variant || 'outline'}>
                  {statusInfo?.label || order.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">订单金额</p>
                  <p className="text-2xl font-bold">{formatAmount(order.amount)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">支付方式</p>
                  <p className="text-lg">
                    {order.paymentMethod 
                      ? paymentMethodMap[order.paymentMethod] || order.paymentMethod
                      : '未选择'
                    }
                  </p>
                </div>
              </div>
              
              {order.transactionId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">交易ID</p>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded">
                    {order.transactionId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 用户信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>用户信息</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">用户昵称</p>
                  <p>{order.user?.nickname || '未设置'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">联系邮箱</p>
                  <p>{order.user?.email || '未设置'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">联系电话</p>
                  <p>{order.user?.phone || '未设置'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">微信ID</p>
                  <p className="font-mono text-sm">
                    {order.user?.openId ? 
                      `${order.user.openId.slice(0, 8)}...` : 
                      '未绑定'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 服务信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>服务信息</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">服务名称</p>
                <p className="text-lg font-medium">{order.aiService?.displayName}</p>
              </div>
              
              {order.aiService?.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">服务描述</p>
                  <p className="text-sm">{order.aiService.description}</p>
                </div>
              )}

              <Separator />
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">服务参数</p>
                <ServiceDataDisplay data={order.serviceData} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧时间线和操作 */}
        <div className="space-y-6">
          {/* 订单时间线 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>订单时间线</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline order={order} />
            </CardContent>
          </Card>

          {/* 订单操作 */}
          <Card>
            <CardHeader>
              <CardTitle>订单操作</CardTitle>
              <CardDescription>
                可执行的订单管理操作
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                导出订单信息
              </Button>
              <Button variant="outline" className="w-full">
                发送通知邮件
              </Button>
              {order.status === 'pending' && (
                <Button variant="destructive" className="w-full">
                  取消订单
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 订单统计信息 */}
          <Card>
            <CardHeader>
              <CardTitle>订单信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">创建时间</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">最后更新</span>
                <span>{formatDate(order.updatedAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">订单ID</span>
                <span className="font-mono text-xs">{order.id.slice(-12)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// 页面元数据
export const metadata = {
  title: '订单详情 - AI医疗服务平台',
  description: '查看订单的详细信息，包括用户信息、服务内容、支付状态等。',
};