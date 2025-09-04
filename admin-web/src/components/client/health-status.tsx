'use client'

import { useHealthCheck } from '@/hooks/use-health-check'

export function HealthStatus() {
  const { data, isLoading, isError, error } = useHealthCheck()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        检查系统状态...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <div className="h-2 w-2 bg-red-500 rounded-full"></div>
        系统异常: {error?.message || '未知错误'}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {data?.status === 'ok' ? (
        <>
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-600">系统正常运行</span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
          <span className="text-yellow-600">系统状态异常</span>
        </>
      )}
      {data?.timestamp && (
        <span className="text-gray-400 ml-2">
          更新: {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}