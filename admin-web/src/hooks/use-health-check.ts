'use client'

import { useQuery } from '@tanstack/react-query'

// 健康检查API接口类型
interface HealthCheckResponse {
  status: 'ok' | 'error'
  message: string
  timestamp: string
}

// 获取健康检查数据的函数
async function fetchHealthCheck(): Promise<HealthCheckResponse> {
  const response = await fetch('/api/health')
  
  if (!response.ok) {
    throw new Error('健康检查失败')
  }
  
  return response.json()
}

// 使用React Query的健康检查Hook
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health-check'],
    queryFn: fetchHealthCheck,
    // 每30秒自动重新获取数据
    refetchInterval: 30 * 1000,
    // 错误时不自动重试太多次
    retry: 2,
    // 数据保持新鲜5秒
    staleTime: 5 * 1000,
  })
}