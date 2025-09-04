'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { User } from '@/db/schema/users'

// 用户列表查询参数
export interface UserListParams {
  page?: number
  limit?: number
  search?: string
  status?: 'all' | 'active' | 'inactive'
  deletedStatus?: 'active' | 'deleted' | 'all' // 软删除状态
  orderBy?: 'registeredAt' | 'lastLoginAt' | 'nickname'
  orderDirection?: 'asc' | 'desc'
}

// 用户列表响应
export interface UserListResponse {
  users: User[]
  totalCount: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

// 用户活动记录
export interface UserActivity {
  id: string
  userId: string
  action: string
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// 用户活动响应
export interface UserActivityResponse {
  activities: UserActivity[]
  totalCount: number
  currentPage: number
  totalPages: number
}

// 用户状态更新参数
export interface UpdateUserStatusParams {
  userId: string
  isActive: boolean
}

// 获取用户列表的API函数
async function fetchUsers(params: UserListParams = {}): Promise<UserListResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.search) searchParams.set('search', params.search)
  if (params.status && params.status !== 'all') searchParams.set('status', params.status)
  if (params.orderBy) searchParams.set('orderBy', params.orderBy)
  if (params.orderDirection) searchParams.set('orderDirection', params.orderDirection)

  const response = await fetch(`/api/users?${searchParams.toString()}`)
  
  if (!response.ok) {
    throw new Error(`获取用户列表失败: ${response.statusText}`)
  }
  
  return response.json()
}

// 获取用户活动的API函数
async function fetchUserActivity(
  userId: string, 
  params: { page?: number; limit?: number } = {}
): Promise<UserActivityResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())

  const response = await fetch(`/api/users/${userId}/activity?${searchParams.toString()}`)
  
  if (!response.ok) {
    throw new Error(`获取用户活动失败: ${response.statusText}`)
  }
  
  return response.json()
}

// 更新用户状态的API函数
async function updateUserStatus(params: UpdateUserStatusParams): Promise<User> {
  const response = await fetch(`/api/users/${params.userId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      isActive: params.isActive,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`更新用户状态失败: ${response.statusText}`)
  }
  
  return response.json()
}

// 获取用户列表的Hook
export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => fetchUsers(params),
    // 数据保持新鲜2分钟
    staleTime: 2 * 60 * 1000,
    // 启用后台重新获取
    refetchOnWindowFocus: true,
    // 启用分页时减少重试次数
    retry: params.page ? 1 : 2,
    // 保持上一页数据直到新数据加载完成
    placeholderData: (previousData) => previousData,
  })
}

// 获取用户活动的Hook
export function useUserActivity(
  userId: string, 
  params: { page?: number; limit?: number } = {}
) {
  return useQuery({
    queryKey: ['user-activity', userId, params],
    queryFn: () => fetchUserActivity(userId, params),
    // 只有在userId存在时才启用查询
    enabled: !!userId,
    // 数据保持新鲜1分钟
    staleTime: 1 * 60 * 1000,
    // 重试1次
    retry: 1,
    // 保持上一页数据
    placeholderData: (previousData) => previousData,
  })
}

// 更新用户状态的Hook
export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateUserStatus,
    // 乐观更新策略
    onMutate: async (variables) => {
      // 取消正在进行的用户查询
      await queryClient.cancelQueries({ queryKey: ['users'] })
      
      // 获取当前缓存数据的快照
      const previousUsers = queryClient.getQueriesData({ queryKey: ['users'] })
      
      // 乐观地更新缓存
      queryClient.setQueriesData<UserListResponse>(
        { queryKey: ['users'] },
        (old) => {
          if (!old) return old
          
          return {
            ...old,
            users: old.users.map(user =>
              user.id === variables.userId
                ? { ...user, isActive: variables.isActive }
                : user
            ),
          }
        }
      )
      
      return { previousUsers }
    },
    // 发生错误时回滚
    onError: (_, __, context) => {
      if (context?.previousUsers) {
        context.previousUsers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    // 成功或失败后都重新获取数据
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// 导出查询键工厂函数，方便手动操作缓存
export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userQueryKeys.lists(), params] as const,
  activities: () => [...userQueryKeys.all, 'activity'] as const,
  activity: (userId: string, params?: { page?: number; limit?: number }) =>
    [...userQueryKeys.activities(), userId, params] as const,
}

// 预加载用户数据的工具函数
export function prefetchUsers(
  queryClient: ReturnType<typeof useQueryClient>,
  params: UserListParams = {}
) {
  return queryClient.prefetchQuery({
    queryKey: userQueryKeys.list(params),
    queryFn: () => fetchUsers(params),
    staleTime: 2 * 60 * 1000,
  })
}

// 软删除用户 Hook
export function useSoftDeleteUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}/soft-delete`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error(`软删除用户失败: ${response.status}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 重新获取用户列表数据
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// 恢复软删除用户 Hook
export function useRestoreUser() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}/restore`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`恢复用户失败: ${response.status}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 重新获取用户列表数据
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// 批量软删除用户 Hook
export function useBulkSoftDeleteUsers() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const response = await fetch('/api/users/bulk-soft-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds }),
      })
      
      if (!response.ok) {
        throw new Error(`批量软删除用户失败: ${response.status}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 重新获取用户列表数据
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// 批量恢复用户 Hook
export function useBulkRestoreUsers() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const response = await fetch('/api/users/bulk-restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds }),
      })
      
      if (!response.ok) {
        throw new Error(`批量恢复用户失败: ${response.status}`)
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 重新获取用户列表数据
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// 预加载用户活动数据的工具函数
export function prefetchUserActivity(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  params: { page?: number; limit?: number } = {}
) {
  return queryClient.prefetchQuery({
    queryKey: userQueryKeys.activity(userId, params),
    queryFn: () => fetchUserActivity(userId, params),
    staleTime: 1 * 60 * 1000,
  })
}