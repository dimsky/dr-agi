'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UpdateTaskInput } from '../db/schema/tasks'
import type { TaskStats } from '../db/schema/tasks'
import { useCallback, useEffect } from 'react'

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  error?: string
  timestamp: string
}

// 任务详情响应类型（基于现有API结构）
interface TaskDetailResponse {
  id: string
  orderId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  result?: Record<string, unknown>
  error?: string
  difyTaskId?: string | null
  executionTime?: number | null
  retryCount: number
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  order?: {
    id: string
    amount: string
    status: string
    createdAt: string
  }
  aiService?: {
    id: string
    displayName: string
    description?: string | null
  }
}

// 任务列表响应类型
interface TaskListResponse {
  tasks: TaskDetailResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 任务日志条目类型
interface TaskLogEntry {
  id: string
  taskId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  metadata?: Record<string, unknown>
}

// 任务日志响应类型
interface TaskLogsResponse {
  logs: TaskLogEntry[]
  hasMore: boolean
  nextCursor?: string
}

// 查询参数类型
interface TaskQueryParams {
  // 继承TaskFilters的属性
  orderId?: string
  aiServiceId?: string
  status?: string
  dateFrom?: Date
  dateTo?: Date
  // 分页和排序
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'executionTime'
  sortOrder?: 'asc' | 'desc'
}

// 重试任务请求参数
interface RetryTaskParams {
  taskId: string
  resetRetryCount?: boolean
}

// 停止任务请求参数  
interface StopTaskParams {
  taskId: string
  serviceType: string
}

/**
 * 任务列表查询 Hook
 * 支持分页、筛选、排序和自动刷新
 */
export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async (): Promise<TaskListResponse> => {
      const searchParams = new URLSearchParams()
      
      if (params?.page) searchParams.append('page', params.page.toString())
      if (params?.limit) searchParams.append('limit', params.limit.toString())
      if (params?.orderId) searchParams.append('orderId', params.orderId)
      if (params?.aiServiceId) searchParams.append('aiServiceId', params.aiServiceId)
      if (params?.status) searchParams.append('status', params.status)
      if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom.toISOString())
      if (params?.dateTo) searchParams.append('dateTo', params.dateTo.toISOString())
      if (params?.sortBy) searchParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder)

      const response = await fetch(`/api/tasks?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`获取任务列表失败: ${response.status}`)
      }

      const result: ApiResponse<TaskListResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取任务列表失败')
      }

      return result.data!
    },
    staleTime: 30 * 1000, // 30秒后数据过期
    refetchInterval: 5 * 1000, // 每5秒自动刷新 (满足实时要求)
  })
}

/**
 * 单个任务详情查询 Hook  
 * 基于现有的 /api/tasks/[taskId] API
 */
export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['tasks', taskId],
    queryFn: async (): Promise<TaskDetailResponse> => {
      if (!taskId) throw new Error('任务ID不能为空')

      const response = await fetch(`/api/tasks/${taskId}`)
      
      if (!response.ok) {
        throw new Error(`获取任务详情失败: ${response.status}`)
      }

      const result: ApiResponse<TaskDetailResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取任务详情失败')
      }

      return result.data!
    },
    enabled: !!taskId,
    staleTime: 10 * 1000, // 10秒后数据过期
    refetchInterval: (query) => {
      // 运行中的任务每2秒刷新，其他状态每30秒刷新
      const data = query.state.data as TaskDetailResponse | undefined
      if (!data) return 30 * 1000
      return data.status === 'running' ? 2 * 1000 : 30 * 1000
    },
  })
}

/**
 * 任务统计查询 Hook
 */
export function useTaskStats() {
  return useQuery({
    queryKey: ['tasks', 'stats'],
    queryFn: async (): Promise<TaskStats> => {
      const response = await fetch('/api/tasks/stats')
      
      if (!response.ok) {
        throw new Error(`获取任务统计失败: ${response.status}`)
      }

      const result: ApiResponse<TaskStats> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取任务统计失败')
      }

      return result.data!
    },
    staleTime: 5 * 60 * 1000, // 5分钟后数据过期
  })
}

/**
 * 任务日志查询 Hook
 * 支持实时日志流和分页加载
 */
export function useTaskLogs(taskId: string | null, options?: {
  limit?: number
  cursor?: string
  autoRefresh?: boolean
}) {
  const { limit = 100, cursor, autoRefresh = true } = options || {}

  return useQuery({
    queryKey: ['tasks', taskId, 'logs', cursor],
    queryFn: async (): Promise<TaskLogsResponse> => {
      if (!taskId) throw new Error('任务ID不能为空')

      const searchParams = new URLSearchParams()
      if (limit) searchParams.append('limit', limit.toString())
      if (cursor) searchParams.append('cursor', cursor)

      const response = await fetch(`/api/tasks/${taskId}/logs?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`获取任务日志失败: ${response.status}`)
      }

      const result: ApiResponse<TaskLogsResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取任务日志失败')
      }

      return result.data!
    },
    enabled: !!taskId,
    staleTime: 5 * 1000, // 5秒后数据过期
    refetchInterval: autoRefresh ? 3 * 1000 : false, // 每3秒自动刷新日志
  })
}

/**
 * 重试失败任务 Mutation Hook
 */
export function useRetryTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskId, resetRetryCount = false }: RetryTaskParams) => {
      const response = await fetch(`/api/tasks/${taskId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resetRetryCount }),
      })

      if (!response.ok) {
        throw new Error(`重试任务失败: ${response.status}`)
      }

      const result: ApiResponse<TaskDetailResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '重试任务失败')
      }

      return result.data!
    },
    onSuccess: (data) => {
      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks', data.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] })
    },
  })
}

/**
 * 停止任务执行 Mutation Hook
 * 基于现有的 /api/dify/stop-task API
 */
export function useStopTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskId, serviceType }: StopTaskParams) => {
      const response = await fetch('/api/dify/stop-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId, serviceType }),
      })

      if (!response.ok) {
        throw new Error(`停止任务失败: ${response.status}`)
      }

      const result: ApiResponse<{ result: unknown; taskId: string }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '停止任务失败')
      }

      return result.data!
    },
    onSuccess: (data) => {
      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks', data.taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] })
    },
  })
}

/**
 * 批量更新任务状态 Mutation Hook
 */
export function useBatchUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ taskIds, updates }: { taskIds: string[]; updates: UpdateTaskInput }) => {
      const response = await fetch('/api/tasks/batch-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskIds, updates }),
      })

      if (!response.ok) {
        throw new Error(`批量更新任务状态失败: ${response.status}`)
      }

      const result: ApiResponse<{ updatedCount: number }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '批量更新任务状态失败')
      }

      return result.data!
    },
    onSuccess: () => {
      // 更新所有任务相关缓存
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] })
    },
  })
}

/**
 * 导出任务数据 Mutation Hook
 */
export function useExportTasks() {
  return useMutation({
    mutationFn: async (params: TaskQueryParams & { format: 'csv' | 'excel' }) => {
      const searchParams = new URLSearchParams()
      
      if (params.orderId) searchParams.append('orderId', params.orderId)
      if (params.aiServiceId) searchParams.append('aiServiceId', params.aiServiceId)
      if (params.status) searchParams.append('status', params.status)
      if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom.toISOString())
      if (params.dateTo) searchParams.append('dateTo', params.dateTo.toISOString())
      if (params.format) searchParams.append('format', params.format)

      const response = await fetch(`/api/tasks/export?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`导出任务数据失败: ${response.status}`)
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `tasks-${new Date().toISOString().split('T')[0]}.${params.format}`

      // 下载文件
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return { success: true, filename }
    },
  })
}

/**
 * 实时任务状态更新 Hook
 * 使用 Supabase 实时订阅或轮询机制
 */
export function useTaskRealTimeUpdates(options?: {
  enabled?: boolean
  taskIds?: string[]
  onTaskUpdate?: (task: TaskDetailResponse) => void
}) {
  const { enabled = true, taskIds, onTaskUpdate } = options || {}
  const queryClient = useQueryClient()

  const handleTaskUpdate = useCallback((updatedTask: TaskDetailResponse) => {
    // 更新单个任务缓存
    queryClient.setQueryData(['tasks', updatedTask.id], updatedTask)
    
    // 更新任务列表缓存
    queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false })
    
    // 调用自定义回调
    onTaskUpdate?.(updatedTask)
  }, [queryClient, onTaskUpdate])

  useEffect(() => {
    if (!enabled) return

    // 这里可以实现 Supabase 实时订阅
    // 暂时使用轮询方式作为备选方案
    const pollInterval = setInterval(() => {
      // 轮询指定任务或所有运行中的任务
      if (taskIds && taskIds.length > 0) {
        taskIds.forEach(taskId => {
          queryClient.invalidateQueries({ queryKey: ['tasks', taskId] })
        })
      } else {
        // 只刷新运行中的任务
        queryClient.invalidateQueries({ 
          queryKey: ['tasks'], 
          predicate: (query) => {
            const data = query.state.data as TaskListResponse | TaskDetailResponse | undefined
            if ('tasks' in (data || {})) {
              // 任务列表数据
              const listData = data as TaskListResponse
              return listData.tasks.some(task => task.status === 'running' || task.status === 'pending')
            } else if ('status' in (data || {})) {
              // 单个任务数据
              const taskData = data as TaskDetailResponse
              return taskData.status === 'running' || taskData.status === 'pending'
            }
            return false
          }
        })
      }
    }, 3000) // 每3秒轮询一次

    return () => clearInterval(pollInterval)
  }, [enabled, taskIds, queryClient])

  return { handleTaskUpdate }
}

/**
 * 任务状态变化监听 Hook
 * 监听特定任务的状态变化
 */
export function useTaskStatusListener(taskId: string | null, callback: (status: string, task: TaskDetailResponse) => void) {
  const { data: task } = useTask(taskId)
  
  useEffect(() => {
    if (task) {
      callback(task.status, task)
    }
  }, [task?.status, task, callback])

  return task
}