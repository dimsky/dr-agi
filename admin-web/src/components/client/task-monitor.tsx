'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  useTasks, 
  useTaskStats, 
  useRetryTask, 
  useStopTask,
  useBatchUpdateTaskStatus,
  useExportTasks,
  useTaskLogs,
  useTaskRealTimeUpdates
} from '@/hooks/use-tasks'
import { TaskFilters } from '@/db/schema/tasks'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
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
  Pause,
  RotateCcw,
  BarChart,
  Activity,
  Zap,
  Timer,
  Terminal
} from 'lucide-react'

// 任务状态映射
const taskStatusMap = {
  pending: { 
    label: '等待执行', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: Clock,
    progress: 0
  },
  running: { 
    label: '执行中', 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: Activity,
    progress: 50
  },
  completed: { 
    label: '已完成', 
    color: 'bg-green-100 text-green-800 border-green-200', 
    icon: CheckCircle,
    progress: 100
  },
  failed: { 
    label: '执行失败', 
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: XCircle,
    progress: 0
  },
  cancelled: { 
    label: '已取消', 
    color: 'bg-gray-100 text-gray-800 border-gray-200', 
    icon: Pause,
    progress: 0
  },
} as const

// 任务优先级颜色
const getPriorityColor = (retryCount: number) => {
  if (retryCount >= 3) return 'text-red-500'
  if (retryCount >= 1) return 'text-yellow-500'
  return 'text-green-500'
}

interface TaskMonitorClientProps {
  initialFilters?: Partial<TaskFilters>
  autoRefresh?: boolean
  refreshInterval?: number
}

export function TaskMonitorClient({ 
  initialFilters = {}, 
  autoRefresh = true
}: TaskMonitorClientProps) {
  const queryClient = useQueryClient()

  // 状态管理
  const [filters, setFilters] = useState<TaskFilters & {
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'executionTime'
    sortOrder?: 'asc' | 'desc'
  }>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    ...initialFilters
  })

  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [showLogsDialog, setShowLogsDialog] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // React Query hooks
  const { 
    data: taskData, 
    isLoading: tasksLoading, 
    error: tasksError, 
    refetch: refetchTasks,
    isFetching: tasksFetching 
  } = useTasks(filters)

  const { 
    data: statsData, 
    isLoading: statsLoading 
  } = useTaskStats()

  const { 
    data: logsData,
    isLoading: logsLoading 
  } = useTaskLogs(selectedTaskId, {
    autoRefresh: showLogsDialog
  })

  const retryTaskMutation = useRetryTask()
  const stopTaskMutation = useStopTask()
  const batchUpdateMutation = useBatchUpdateTaskStatus()
  const exportTasksMutation = useExportTasks()

  // 实时更新
  useTaskRealTimeUpdates({
    enabled: autoRefresh,
    onTaskUpdate: useCallback((task: { id: string; status: string }) => {
      // 可以在这里添加通知逻辑
      console.log('任务状态更新:', task.id, task.status)
    }, [])
  })

  // Supabase实时订阅
  useEffect(() => {
    if (!autoRefresh) return

    const subscription = supabase
      .channel('tasks_monitor')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks' 
      }, (payload) => {
        console.log('Supabase实时更新:', payload)
        // 刷新相关查询
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] })
        
        // 如果正在查看日志，也要刷新日志
        if (showLogsDialog && selectedTaskId) {
          queryClient.invalidateQueries({ queryKey: ['tasks', selectedTaskId, 'logs'] })
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [autoRefresh, queryClient, showLogsDialog, selectedTaskId])

  // 计算数据
  const pagination = taskData?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }

  // 搜索过滤
  const filteredTasks = useMemo(() => {
    const tasksData = taskData?.tasks || []
    if (!searchQuery.trim()) return tasksData
    
    return tasksData.filter(task => 
      task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.order?.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.aiService?.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.difyTaskId?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [taskData?.tasks, searchQuery])

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

  const handleSelectTask = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleSelectAllTasks = (checked: boolean) => {
    setSelectedTasks(checked ? filteredTasks.map(task => task.id) : [])
  }

  const handleRetryTask = async (taskId: string) => {
    try {
      await retryTaskMutation.mutateAsync({ taskId, resetRetryCount: false })
    } catch (error) {
      console.error('重试任务失败:', error)
    }
  }

  const handleStopTask = async (taskId: string, serviceType: string) => {
    try {
      await stopTaskMutation.mutateAsync({ taskId, serviceType })
    } catch (error) {
      console.error('停止任务失败:', error)
    }
  }

  const handleBatchUpdate = async () => {
    if (!updateStatus || selectedTasks.length === 0) return

    try {
      await batchUpdateMutation.mutateAsync({
        taskIds: selectedTasks,
        updates: { 
          status: updateStatus as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
          ...(updateStatus === 'running' && { startedAt: new Date() }),
          ...(updateStatus === 'completed' && { completedAt: new Date() }),
          ...(updateStatus === 'cancelled' && { completedAt: new Date() })
        }
      })
      setSelectedTasks([])
      setShowUpdateDialog(false)
      setUpdateStatus('')
    } catch (error) {
      console.error('批量更新任务状态失败:', error)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      await exportTasksMutation.mutateAsync({
        ...filters,
        format
      })
    } catch (error) {
      console.error('导出任务失败:', error)
    }
  }

  const handleViewLogs = (taskId: string) => {
    setSelectedTaskId(taskId)
    setShowLogsDialog(true)
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '-'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('zh-CN')
  }

  const getTaskProgress = (task: { status: string; startedAt?: string | Date | null }) => {
    const statusInfo = taskStatusMap[task.status as keyof typeof taskStatusMap]
    
    // 如果任务正在运行，可以根据执行时间计算进度
    if (task.status === 'running' && task.startedAt) {
      const elapsed = (new Date().getTime() - new Date(task.startedAt).getTime()) / 1000
      const estimatedTotal = 300 // 假设平均5分钟完成
      const progress = Math.min((elapsed / estimatedTotal) * 100, 95) // 最多95%，等待完成
      return Math.round(progress)
    }
    
    return statusInfo?.progress || 0
  }

  if (tasksError) {
    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          加载任务数据失败: {tasksError instanceof Error ? tasksError.message : '未知错误'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* 统计面板 */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总任务数</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalTasks}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">等待执行</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{statsData.pendingTasks}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">执行中</CardTitle>
              <Activity className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{statsData.runningTasks}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statsData.completedTasks}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">执行失败</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statsData.failedTasks}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均执行时间</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(statsData.averageExecutionTime)}</div>
              <div className="text-xs text-muted-foreground">
                成功率: {statsData.successRate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 任务监控主面板 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                任务监控
                {autoRefresh && (
                  <Badge variant="outline" className="ml-2">
                    <Zap className="h-3 w-3 mr-1" />
                    实时监控
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                实时监控和管理所有AI服务任务执行状态
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refetchTasks()}
                disabled={tasksFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${tasksFetching ? 'animate-spin' : ''}`} />
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
              
              {selectedTasks.length > 0 && (
                <Button
                  variant="default"
                  onClick={() => setShowUpdateDialog(true)}
                >
                  批量操作 ({selectedTasks.length})
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
              placeholder="搜索任务ID、订单ID或服务名称..."
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
                    {Object.entries(taskStatusMap).map(([key, value]) => (
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
                    <SelectItem value="updatedAt-desc">更新时间 (新到旧)</SelectItem>
                    <SelectItem value="executionTime-desc">执行时间 (长到短)</SelectItem>
                    <SelectItem value="status-asc">状态 (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 任务表格 */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                      onChange={(e) => handleSelectAllTasks(e.target.checked)}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>任务信息</TableHead>
                  <TableHead>关联服务</TableHead>
                  <TableHead>执行状态</TableHead>
                  <TableHead>执行进度</TableHead>
                  <TableHead>执行时间</TableHead>
                  <TableHead>重试次数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-40">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasksLoading || statsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>加载中...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无任务数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => {
                    const statusInfo = taskStatusMap[task.status as keyof typeof taskStatusMap]
                    const StatusIcon = statusInfo?.icon || Activity
                    const progress = getTaskProgress(task)
                    
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedTasks.includes(task.id)}
                            onChange={() => handleSelectTask(task.id)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-medium">
                              {task.id.slice(0, 8)}...
                            </div>
                            <div className="text-xs text-muted-foreground">
                              订单: {task.orderId?.slice(0, 8)}...
                            </div>
                            {task.difyTaskId && (
                              <div className="text-xs text-muted-foreground">
                                Dify: {task.difyTaskId.slice(0, 12)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{task.aiService?.displayName || '未知服务'}</div>
                            {task.aiService?.description && (
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {task.aiService.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo?.label}
                          </Badge>
                          {task.error && (
                            <div className="text-xs text-red-500 mt-1 line-clamp-1" title={task.error}>
                              {task.error}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  task.status === 'completed' ? 'bg-green-500' :
                                  task.status === 'running' ? 'bg-blue-500 animate-pulse' :
                                  task.status === 'failed' ? 'bg-red-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {task.executionTime ? formatDuration(task.executionTime) : 
                             task.status === 'running' && task.startedAt ? 
                               formatDuration(Math.floor((new Date().getTime() - new Date(task.startedAt).getTime()) / 1000)) :
                               '-'
                            }
                          </div>
                          {task.startedAt && task.completedAt && (
                            <div className="text-xs text-muted-foreground">
                              {formatDate(task.startedAt)} - {formatDate(task.completedAt)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={`text-sm font-medium ${getPriorityColor(task.retryCount)}`}>
                            {task.retryCount}/3
                          </div>
                          {task.retryCount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              已重试 {task.retryCount} 次
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(task.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {task.status === 'failed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetryTask(task.id)}
                                disabled={retryTaskMutation.isPending}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                            
                            {task.status === 'running' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStopTask(task.id, task.aiService?.displayName || 'unknown')}
                                disabled={stopTaskMutation.isPending}
                              >
                                <Pause className="h-3 w-3" />
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewLogs(task.id)}
                            >
                              <Terminal className="h-3 w-3" />
                            </Button>
                          </div>
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
            <DialogTitle>批量更新任务状态</DialogTitle>
            <DialogDescription>
              您选择了 {selectedTasks.length} 个任务，请选择要更新的状态。
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
                  {Object.entries(taskStatusMap).map(([key, value]) => (
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

      {/* 任务日志对话框 */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              任务执行日志
              {selectedTaskId && (
                <Badge variant="outline">
                  {selectedTaskId.slice(0, 8)}...
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              实时查看任务执行过程的详细日志信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border rounded-lg bg-black text-green-400 font-mono text-sm max-h-96 overflow-y-auto p-4">
              {logsLoading ? (
                <div className="flex items-center space-x-2 text-gray-400">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>加载日志中...</span>
                </div>
              ) : logsData?.logs && logsData.logs.length > 0 ? (
                logsData.logs.map((log, index) => (
                  <div key={log.id || index} className="mb-2">
                    <span className="text-gray-400">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`ml-2 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400' :
                      log.level === 'info' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="ml-2">{log.message}</span>
                    {log.metadata && (
                      <pre className="ml-8 text-gray-300 text-xs">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-gray-400">
                  暂无日志数据
                </div>
              )}
            </div>
            
            {logsData?.hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  // 加载更多日志的逻辑
                  console.log('加载更多日志...')
                }}
              >
                加载更多日志
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogsDialog(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}