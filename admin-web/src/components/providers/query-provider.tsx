'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  // 每个用户/会话创建一个新的QueryClient实例
  const [queryClient] = useState(
    () => new QueryClient({
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
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 只在开发环境显示开发工具 */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}