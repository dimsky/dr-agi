'use client'

import React, { useState, useMemo } from 'react'
import { 
  useOrders, 
  useOrderStats, 
  useUpdateOrderStatus, 
  useBatchUpdateOrderStatus,
  useExportOrders 
} from '@/hooks/use-orders'
import { OrderFilters } from '@/db/schema/orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  RefreshCw, 
  Download, 
  Filter, 
  Search, 
  CheckCircle, 
  Clock, 
  XCircle,
  CreditCard,
  Package
} from 'lucide-react'

// 订单状态映射
const orderStatusMap = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  paid: { label: '已支付', color: 'bg-blue-100 text-blue-800', icon: CreditCard },
  processing: { label: '处理中', color: 'bg-purple-100 text-purple-800', icon: Package },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  refunded: { label: '已退款', color: 'bg-red-100 text-red-800', icon: XCircle },
} as const

// 支付方式映射
const paymentMethodMap = {
  wechat_pay: '微信支付',
  alipay: '支付宝',
  credit_card: '信用卡',
  bank_card: '银行卡',
} as const

interface OrderManagementProps {
  initialFilters?: Partial<OrderFilters>
}

export function OrderManagement({ initialFilters = {} }: OrderManagementProps) {
  // 状态管理
  const [filters, setFilters] = useState<OrderFilters & {
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'amount' | 'status'
    sortOrder?: 'asc' | 'desc'
  }>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...initialFilters
  })

  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // React Query hooks
  const { 
    data: orderData, 
    isLoading: ordersLoading, 
    error: ordersError, 
    refetch: refetchOrders,
    isFetching: ordersFetching 
  } = useOrders(filters)

  const { 
    data: statsData, 
    isLoading: statsLoading 
  } = useOrderStats()

  const updateOrderMutation = useUpdateOrderStatus()
  const batchUpdateMutation = useBatchUpdateOrderStatus()
  const exportOrdersMutation = useExportOrders()

  // 计算数据
  const pagination = orderData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }

  // 搜索过滤
  const filteredOrders = useMemo(() => {
    const ordersData = orderData?.orders || []
    if (!searchQuery.trim()) return ordersData
    
    return ordersData.filter(order => 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.aiService.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [orderData?.orders, searchQuery])

  // 事件处理函数
  const handleFilterChange = (key: string, value: string | Date | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // 重置到第一页
    }))
  }

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const handleSelectAllOrders = (checked: boolean) => {
    setSelectedOrders(checked ? filteredOrders.map(order => order.id) : [])
  }

  const handleSingleOrderUpdate = async (orderId: string, status: string) => {
    try {
      await updateOrderMutation.mutateAsync({
        orderId,
        updates: { 
          status: status as 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'refunded',
          ...(status === 'paid' && { paidAt: new Date() }),
          ...(status === 'completed' && { completedAt: new Date() })
        }
      })
    } catch (error) {
      console.error('更新订单状态失败:', error)
    }
  }

  const handleBatchUpdate = async () => {
    if (!updateStatus || selectedOrders.length === 0) return

    try {
      await batchUpdateMutation.mutateAsync({
        orderIds: selectedOrders,
        updates: { 
          status: updateStatus as 'pending' | 'paid' | 'processing' | 'completed' | 'cancelled' | 'refunded',
          ...(updateStatus === 'paid' && { paidAt: new Date() }),
          ...(updateStatus === 'completed' && { completedAt: new Date() })
        }
      })
      setSelectedOrders([])
      setShowUpdateDialog(false)
      setUpdateStatus('')
    } catch (error) {
      console.error('批量更新订单状态失败:', error)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      await exportOrdersMutation.mutateAsync({
        ...filters,
        format
      })
    } catch (error) {
      console.error('导出订单失败:', error)
    }
  }

  const formatCurrency = (amount: string) => {
    return `¥${parseFloat(amount).toFixed(2)}`
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('zh-CN')
  }

  if (ordersError) {
    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          加载订单数据失败: {ordersError instanceof Error ? ordersError.message : '未知错误'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总订单数</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalOrders}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待处理</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.pendingOrders}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.completedOrders}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总收入</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(statsData.totalRevenue)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均订单价值</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(statsData.averageOrderValue)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 工具栏 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <CardTitle>订单管理</CardTitle>
              <CardDescription>
                管理和监控所有医疗服务订单
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refetchOrders()}
                disabled={ordersFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${ordersFetching ? 'animate-spin' : ''}`} />
                刷新
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                筛选
              </Button>
              
              <Select onValueChange={(format) => handleExport(format as 'csv' | 'excel')}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-2" />
                      导出
                    </div>
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV格式</SelectItem>
                  <SelectItem value="excel">Excel格式</SelectItem>
                </SelectContent>
              </Select>
              
              {selectedOrders.length > 0 && (
                <Button
                  variant="default"
                  onClick={() => setShowUpdateDialog(true)}
                >
                  批量操作 ({selectedOrders.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 搜索框 */}
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索订单ID、用户名或服务名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* 高级筛选 */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg">
              <div>
                <Label>状态</Label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) => handleFilterChange('status', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部状态</SelectItem>
                    {Object.entries(orderStatusMap).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>开始日期</Label>
                <DatePicker
                  value={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                />
              </div>
              
              <div>
                <Label>结束日期</Label>
                <DatePicker
                  value={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                />
              </div>
              
              <div>
                <Label>排序方式</Label>
                <Select
                  value={`${filters.sortBy}-${filters.sortOrder}`}
                  onValueChange={(value) => {
                    const [sortBy, sortOrder] = value.split('-')
                    handleFilterChange('sortBy', sortBy)
                    handleFilterChange('sortOrder', sortOrder)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt-desc">创建时间 (新到旧)</SelectItem>
                    <SelectItem value="createdAt-asc">创建时间 (旧到新)</SelectItem>
                    <SelectItem value="amount-desc">金额 (高到低)</SelectItem>
                    <SelectItem value="amount-asc">金额 (低到高)</SelectItem>
                    <SelectItem value="status-asc">状态 (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 订单表格 */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={(e) => handleSelectAllOrders(e.target.checked)}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>订单ID</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>服务</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>支付方式</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading || statsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>加载中...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无订单数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const statusInfo = orderStatusMap[order.status as keyof typeof orderStatusMap]
                    const StatusIcon = statusInfo?.icon || Package
                    
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => handleSelectOrder(order.id)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {order.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{order.user.name || '未知用户'}</div>
                            {order.user.email && (
                              <div className="text-sm text-muted-foreground">{order.user.email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{order.aiService.displayName}</div>
                            {order.aiService.description && (
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {order.aiService.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(order.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.paymentMethod ? paymentMethodMap[order.paymentMethod as keyof typeof paymentMethodMap] || order.paymentMethod : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Select onValueChange={(status) => handleSingleOrderUpdate(order.id, status)}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="更新状态" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(orderStatusMap).map(([key, value]) => (
                                <SelectItem key={key} value={key} disabled={key === order.status}>
                                  {value.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                显示 {((pagination.page - 1) * pagination.limit) + 1} 到 {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  上一页
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const page = pagination.page <= 3 ? i + 1 : pagination.page - 2 + i
                    if (page > pagination.totalPages) return null
                    
                    return (
                      <Button
                        key={page}
                        variant={page === pagination.page ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量更新对话框 */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量更新订单状态</DialogTitle>
            <DialogDescription>
              您选择了 {selectedOrders.length} 个订单，请选择要更新的状态。
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>新状态</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(orderStatusMap).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUpdateDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleBatchUpdate}
              disabled={!updateStatus || batchUpdateMutation.isPending}
            >
              {batchUpdateMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}