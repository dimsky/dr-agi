'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Order, UpdateOrderInput, OrderFilters, OrderStats } from '@/db/schema/orders'

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  timestamp: string
}

// 订单列表响应类型
interface OrderListResponse {
  orders: (Order & {
    user: {
      id: string
      name?: string | null
      email?: string | null
    }
    aiService: {
      id: string
      displayName: string
      description?: string | null
    }
  })[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 查询参数类型
interface OrderQueryParams extends OrderFilters {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'amount' | 'status'
  sortOrder?: 'asc' | 'desc'
}

// 订单查询 hook
export function useOrders(params?: OrderQueryParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: async (): Promise<OrderListResponse> => {
      const searchParams = new URLSearchParams()
      
      if (params?.page) searchParams.append('page', params.page.toString())
      if (params?.limit) searchParams.append('limit', params.limit.toString())
      if (params?.userId) searchParams.append('userId', params.userId)
      if (params?.aiServiceId) searchParams.append('aiServiceId', params.aiServiceId)
      if (params?.status) searchParams.append('status', params.status)
      if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom.toISOString())
      if (params?.dateTo) searchParams.append('dateTo', params.dateTo.toISOString())
      if (params?.sortBy) searchParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder)

      const response = await fetch(`/api/orders?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`获取订单列表失败: ${response.status}`)
      }

      const result: ApiResponse<OrderListResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取订单列表失败')
      }

      return result.data!
    },
    staleTime: 30 * 1000, // 30秒后数据过期
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  })
}

// 单个订单查询 hook
export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: async (): Promise<Order & {
      user: { id: string; name?: string | null; email?: string | null }
      aiService: { id: string; displayName: string; description?: string | null }
    }> => {
      if (!orderId) throw new Error('订单ID不能为空')

      const response = await fetch(`/api/orders/${orderId}`)
      
      if (!response.ok) {
        throw new Error(`获取订单详情失败: ${response.status}`)
      }

      const result: ApiResponse<Order & {
        user: { id: string; name?: string | null; email?: string | null }
        aiService: { id: string; displayName: string; description?: string | null }
      }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取订单详情失败')
      }

      return result.data!
    },
    enabled: !!orderId,
  })
}

// 订单统计查询 hook
export function useOrderStats() {
  return useQuery({
    queryKey: ['orders', 'stats'],
    queryFn: async (): Promise<OrderStats> => {
      const response = await fetch('/api/orders/stats')
      
      if (!response.ok) {
        throw new Error(`获取订单统计失败: ${response.status}`)
      }

      const result: ApiResponse<OrderStats> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取订单统计失败')
      }

      return result.data!
    },
    staleTime: 5 * 60 * 1000, // 5分钟后数据过期
  })
}

// 更新订单状态 mutation hook
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, updates }: { orderId: string; updates: UpdateOrderInput }) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(`更新订单状态失败: ${response.status}`)
      }

      const result: ApiResponse<Order> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '更新订单状态失败')
      }

      return result.data!
    },
    onSuccess: (data) => {
      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', data.id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'stats'] })
    },
  })
}

// 批量更新订单状态 mutation hook
export function useBatchUpdateOrderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderIds, updates }: { orderIds: string[]; updates: UpdateOrderInput }) => {
      const response = await fetch('/api/orders/batch-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds, updates }),
      })

      if (!response.ok) {
        throw new Error(`批量更新订单状态失败: ${response.status}`)
      }

      const result: ApiResponse<{ updatedCount: number }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '批量更新订单状态失败')
      }

      return result.data!
    },
    onSuccess: () => {
      // 更新所有订单相关缓存
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'stats'] })
    },
  })
}

// 导出订单数据 mutation hook
export function useExportOrders() {
  return useMutation({
    mutationFn: async (params: OrderQueryParams & { format: 'csv' | 'excel' }) => {
      const searchParams = new URLSearchParams()
      
      if (params.userId) searchParams.append('userId', params.userId)
      if (params.aiServiceId) searchParams.append('aiServiceId', params.aiServiceId)
      if (params.status) searchParams.append('status', params.status)
      if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom.toISOString())
      if (params.dateTo) searchParams.append('dateTo', params.dateTo.toISOString())
      if (params.format) searchParams.append('format', params.format)

      const response = await fetch(`/api/orders/export?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`导出订单失败: ${response.status}`)
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `orders-${new Date().toISOString().split('T')[0]}.${params.format}`

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

// 删除订单 mutation hook (软删除)
export function useDeleteOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`删除订单失败: ${response.status}`)
      }

      const result: ApiResponse<{ success: boolean }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '删除订单失败')
      }

      return result.data!
    },
    onSuccess: () => {
      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'stats'] })
    },
  })
}