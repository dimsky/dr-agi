'use client'

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 在生产环境中，5分钟后数据会被认为是过期的
      staleTime: 5 * 60 * 1000, // 5 minutes
      // 数据在缓存中保留30分钟
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
      // 重试机制
      retry: (failureCount, error) => {
        // 不重试客户端错误 (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          return false
        }
        // 最多重试3次
        return failureCount < 3
      },
      // 窗口重新获得焦点时重新获取数据
      refetchOnWindowFocus: false,
      // 网络重新连接时重新获取数据
      refetchOnReconnect: true,
    },
    mutations: {
      // 突变失败时重试1次
      retry: 1,
    },
  },
})

// 用于开发环境的调试
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 在全局对象上暴露queryClient以便调试
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).queryClient = queryClient
}