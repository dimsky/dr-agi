'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AiService, UpdateAiServiceInput } from '../db/schema/ai_service'

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  timestamp: string
}

// 服务配置列表响应类型
interface ServiceConfigListResponse {
  configs: AiService[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 查询参数类型
interface ServiceConfigQueryParams {
  id?: string
  displayName?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'displayName' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

// Dify工作流测试结果类型
interface DifyWorkflowTestResult {
  success: boolean
  message: string
  data?: {
    workflowId?: string
    testId?: string
    result?: Record<string, unknown>
    executionTime?: number
  }
}

// 服务配置列表查询 hook
export function useServiceConfigs(params?: ServiceConfigQueryParams) {
  return useQuery({
    queryKey: ['service-configs', params],
    queryFn: async (): Promise<ServiceConfigListResponse> => {
      const searchParams = new URLSearchParams()
      
      if (params?.page) searchParams.append('page', params.page.toString())
      if (params?.limit) searchParams.append('limit', params.limit.toString())
      if (params?.id) searchParams.append('id', params.id)
      if (params?.displayName) searchParams.append('displayName', params.displayName)
      if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString())
      if (params?.sortBy) searchParams.append('sortBy', params.sortBy)
      if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder)

      const response = await fetch(`/api/services?${searchParams}`, {
        credentials: 'include', // 确保包含cookies
      })
      
      if (!response.ok) {
        throw new Error(`获取服务配置列表失败: ${response.status}`)
      }

      const result: ApiResponse<ServiceConfigListResponse> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取服务配置列表失败')
      }

      return result.data!
    },
    staleTime: 30 * 1000, // 30秒后数据过期
    refetchInterval: 60 * 1000, // 每分钟自动刷新
  })
}

// 单个服务配置查询 hook
export function useServiceConfig(configId: string | null) {
  return useQuery({
    queryKey: ['service-configs', configId],
    queryFn: async (): Promise<AiService> => {
      if (!configId) throw new Error('服务配置ID不能为空')

      const response = await fetch(`/api/services/${configId}`, {
        credentials: 'include', // 确保包含cookies
      })
      
      if (!response.ok) {
        throw new Error(`获取服务配置详情失败: ${response.status}`)
      }

      const result: ApiResponse<AiService> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取服务配置详情失败')
      }

      return result.data!
    },
    enabled: !!configId,
  })
}

// 更新服务配置 hook
export function useUpdateConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ configId, updates }: { configId: string; updates: UpdateAiServiceInput }) => {
      const response = await fetch(`/api/services/${configId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保包含cookies
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(`更新服务配置失败: ${response.status}`)
      }

      const result: ApiResponse<AiService> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '更新服务配置失败')
      }

      return result.data!
    },
    // 乐观更新策略
    onMutate: async ({ configId, updates }) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['service-configs', configId] })
      await queryClient.cancelQueries({ queryKey: ['service-configs'] })

      // 获取当前数据快照
      const previousConfig = queryClient.getQueryData<AiService>(['service-configs', configId])
      const previousConfigs = queryClient.getQueryData<ServiceConfigListResponse>(['service-configs'])

      // 乐观更新单个配置
      if (previousConfig) {
        const optimisticConfig = { 
          ...previousConfig, 
          ...updates,
          updatedAt: new Date()
        }
        queryClient.setQueryData<AiService>(['service-configs', configId], optimisticConfig)
      }

      // 乐观更新配置列表
      if (previousConfigs) {
        const optimisticConfigs = {
          ...previousConfigs,
          configs: previousConfigs.configs.map(config => 
            config.id === configId 
              ? { 
                  ...config, 
                  ...updates,
                  updatedAt: new Date()
                }
              : config
          )
        }
        queryClient.setQueryData<ServiceConfigListResponse>(['service-configs'], optimisticConfigs)
      }

      // 返回回滚数据
      return { previousConfig, previousConfigs }
    },
    onError: (err, { configId }, context) => {
      // 回滚乐观更新
      if (context?.previousConfig) {
        queryClient.setQueryData(['service-configs', configId], context.previousConfig)
      }
      if (context?.previousConfigs) {
        queryClient.setQueryData(['service-configs'], context.previousConfigs)
      }
    },
    onSuccess: (data) => {
      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: ['service-configs'] })
      queryClient.setQueryData(['service-configs', data.id], data)
    },
  })
}

// 批量更新服务配置状态 hook
export function useBatchUpdateConfigStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ configIds, isActive }: { configIds: string[]; isActive: boolean }) => {
      const response = await fetch('/api/services/batch-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保包含cookies
        body: JSON.stringify({ configIds, updates: { isActive } }),
      })

      if (!response.ok) {
        throw new Error(`批量更新服务配置状态失败: ${response.status}`)
      }

      const result: ApiResponse<{ updatedCount: number }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '批量更新服务配置状态失败')
      }

      return result.data!
    },
    onSuccess: () => {
      // 更新所有服务配置相关缓存
      queryClient.invalidateQueries({ queryKey: ['service-configs'] })
    },
  })
}

// 测试 Dify 工作流 hook
export function useTestWorkflow() {
  return useMutation({
    mutationFn: async ({ 
      configId, 
      testData 
    }: { 
      configId: string; 
      testData?: Record<string, unknown> 
    }): Promise<DifyWorkflowTestResult> => {
      const response = await fetch(`/api/services/${configId}/test-workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保包含cookies
        body: JSON.stringify({ testData }),
      })

      if (!response.ok) {
        throw new Error(`测试工作流失败: ${response.status}`)
      }

      const result: ApiResponse<DifyWorkflowTestResult['data']> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '测试工作流失败')
      }

      return {
        success: true,
        message: result.message,
        data: result.data
      }
    },
  })
}

// 创建新服务配置 hook
export function useCreateServiceConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newConfig: Omit<AiService, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保包含cookies
        body: JSON.stringify(newConfig),
      })

      if (!response.ok) {
        throw new Error(`创建服务配置失败: ${response.status}`)
      }

      const result: ApiResponse<AiService> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '创建服务配置失败')
      }

      return result.data!
    },
    onSuccess: () => {
      // 更新配置列表缓存
      queryClient.invalidateQueries({ queryKey: ['service-configs'] })
    },
  })
}

// 删除服务配置 hook (软删除)
export function useDeleteServiceConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/services?id=${configId}`, {
        method: 'DELETE',
        credentials: 'include', // 确保包含cookies
      })

      if (!response.ok) {
        throw new Error(`删除服务配置失败: ${response.status}`)
      }

      const result: ApiResponse<{ success: boolean }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '删除服务配置失败')
      }

      return result.data!
    },
    // 乐观更新策略
    onMutate: async (configId) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['service-configs'] })

      // 获取当前数据快照
      const previousConfigs = queryClient.getQueryData<ServiceConfigListResponse>(['service-configs'])

      // 乐观删除
      if (previousConfigs) {
        const optimisticConfigs = {
          ...previousConfigs,
          configs: previousConfigs.configs.filter(config => config.id !== configId),
          pagination: {
            ...previousConfigs.pagination,
            total: previousConfigs.pagination.total - 1
          }
        }
        queryClient.setQueryData<ServiceConfigListResponse>(['service-configs'], optimisticConfigs)
      }

      // 删除单个配置缓存
      queryClient.removeQueries({ queryKey: ['service-configs', configId] })

      return { previousConfigs }
    },
    onError: (err, configId, context) => {
      // 回滚乐观更新
      if (context?.previousConfigs) {
        queryClient.setQueryData(['service-configs'], context.previousConfigs)
      }
    },
    onSuccess: () => {
      // 更新相关缓存
      queryClient.invalidateQueries({ queryKey: ['service-configs'] })
    },
  })
}

// 获取服务配置统计信息 hook
export function useServiceConfigStats() {
  return useQuery({
    queryKey: ['service-configs', 'stats'],
    queryFn: async (): Promise<{
      total: number
      active: number
      inactive: number
      withDifyConfig: number
      withoutDifyConfig: number
    }> => {
      const response = await fetch('/api/services/stats', {
        credentials: 'include', // 确保包含cookies
      })
      
      if (!response.ok) {
        throw new Error(`获取服务配置统计失败: ${response.status}`)
      }

      const result: ApiResponse<{
        total: number
        active: number
        inactive: number
        withDifyConfig: number
        withoutDifyConfig: number
      }> = await response.json()
      
      if (!result.success) {
        throw new Error(result.message || '获取服务配置统计失败')
      }

      return result.data!
    },
    staleTime: 5 * 60 * 1000, // 5分钟后数据过期
  })
}

// 导出服务配置数据 hook
export function useExportServiceConfigs() {
  return useMutation({
    mutationFn: async (params: ServiceConfigQueryParams & { format: 'csv' | 'excel' }) => {
      const searchParams = new URLSearchParams()
      
      if (params.displayName) searchParams.append('displayName', params.displayName)
      if (params.isActive !== undefined) searchParams.append('isActive', params.isActive.toString())
      if (params.format) searchParams.append('format', params.format)

      const response = await fetch(`/api/services/export?${searchParams}`, {
        credentials: 'include', // 确保包含cookies
      })
      
      if (!response.ok) {
        throw new Error(`导出服务配置失败: ${response.status}`)
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `service-configs-${new Date().toISOString().split('T')[0]}.${params.format}`

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