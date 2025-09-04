'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// 管理员信息类型
interface AdminInfo {
  username: string;
  role: string;
}

// API 响应类型
interface AdminAuthResponse {
  success: boolean;
  message: string;
  authenticated: boolean;
  data?: AdminInfo;
  timestamp: string;
}

// 管理员身份验证状态查询
export function useAdminAuth() {
  const [isClient, setIsClient] = useState(false);

  // 在构建时减少日志输出
  const isBuildTime = typeof process !== 'undefined' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

  useEffect(() => {
    if (!isBuildTime) {
      console.log(`[Auth Hook] useEffect - 设置 isClient = true`);
    }
    setIsClient(true);
  }, []);

  // 额外检查：如果 window 对象存在，说明在客户端
  const actuallyIsClient = isClient || (typeof window !== 'undefined');
  
  if (!isBuildTime) {
    console.log(`[Auth Hook] useAdminAuth 调用 - isClient: ${isClient}, actuallyIsClient: ${actuallyIsClient}`);
  }

  const queryResult = useQuery<AdminAuthResponse>({
    queryKey: ['admin-auth'],
    queryFn: async (): Promise<AdminAuthResponse> => {
      if (!isBuildTime) {
        console.log(`[Auth Hook] ${new Date().toISOString()} - 开始认证查询`);
        console.log(`[Auth Hook] isClient: ${isClient}, actuallyIsClient: ${actuallyIsClient}`);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      try {
        const response = await fetch('/api/admin/auth', {
          method: 'GET',
          credentials: 'include', // 确保包含cookies
          signal: controller.signal,
        });
        if (!isBuildTime) {
          console.log("response", response);
        }

        clearTimeout(timeoutId);
        
        if (!isBuildTime) {
          console.log(`[Auth Hook] 响应状态: ${response.status}`);
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (!isBuildTime) {
            console.log(`[Auth Hook] 认证失败: ${JSON.stringify(errorData)}`);
          }
          throw new Error(errorData.message || '身份验证失败');
        }

        const result = await response.json();
        if (!isBuildTime) {
          console.log(`[Auth Hook] 认证成功: ${JSON.stringify(result)}`);
        }
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        if (!isBuildTime) {
          console.log(`[Auth Hook] 认证异常: ${error}`);
        }
        throw error;
      }
    },
    staleTime: 0, // 2分钟内认为数据是新鲜的
    gcTime: 0, // 5分钟后清理缓存
    retry: false, // 不重试，直接显示未认证状态
    refetchOnWindowFocus: false, // 防止窗口聚焦时重新请求
    refetchOnMount: true, // 组件挂载时重新获取
    networkMode: 'always', // 始终执行查询
    enabled: actuallyIsClient, // 只在客户端hydration后执行
  });

  if (!isBuildTime) {
    console.log(`[Auth Hook] Query状态 - enabled: ${actuallyIsClient}, status: ${queryResult.status}, fetchStatus: ${queryResult.fetchStatus}`);
  }
  
  return queryResult;
}

// 管理员登录
export function useAdminLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保包含cookies
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '登录失败');
      }

      return result;
    },
    onSuccess: (data) => {
      // 在构建时减少日志输出
      const isBuildTime = typeof process !== 'undefined' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
      
      if (!isBuildTime) {
        console.log(`[Login Hook] ${new Date().toISOString()} - 登录成功回调`);
        console.log(`[Login Hook] 登录响应数据: ${JSON.stringify(data)}`);
      }
      
      toast.success('登录成功', {
        description: '正在跳转到管理后台...',
      });

      // 更新认证状态
      const newAuthData = {
        success: true,
        authenticated: true,
        data: data.data,
        message: '已登录',
        timestamp: new Date().toISOString(),
      };
      
      if (!isBuildTime) {
        console.log(`[Login Hook] 设置缓存数据: ${JSON.stringify(newAuthData)}`);
      }
      queryClient.setQueryData(['admin-auth'], newAuthData);

      // 等待cookie设置完成后再跳转
      setTimeout(() => {
        if (!isBuildTime) {
          console.log(`[Login Hook] ${new Date().toISOString()} - 准备跳转`);
          
          // 立即强制刷新认证状态，获取最新数据
          console.log(`[Login Hook] 立即刷新认证查询`);
        }
        queryClient.invalidateQueries({ queryKey: ['admin-auth'] });
        
        // 稍微延迟跳转，确保查询有时间执行
        setTimeout(() => {
          if (!isBuildTime) {
            console.log(`[Login Hook] 跳转到首页`);
          }
          router.push('/');
        }, 200);
      }, 300);
    },
    onError: (error) => {
      console.error('管理员登录失败:', error);
      toast.error('登录失败', {
        description: error instanceof Error ? error.message : '请检查用户名和密码',
      });
    },
  });
}

// 管理员退出登录
export function useAdminLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/login', {
        method: 'DELETE',
        credentials: 'include', // 确保包含cookies
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '退出登录失败');
      }

      return result;
    },
    onSuccess: () => {
      toast.success('退出登录成功');

      // 清除所有查询缓存
      queryClient.clear();

      // 设置退出登录状态
      queryClient.setQueryData(['admin-auth'], {
        success: false,
        authenticated: false,
        data: null,
        message: '未登录',
        timestamp: new Date().toISOString(),
      });

      // 跳转到登录页面
      router.push('/admin/login');
      router.refresh();
    },
    onError: (error) => {
      console.error('管理员退出登录失败:', error);
      toast.error('退出登录失败', {
        description: error instanceof Error ? error.message : '请稍后重试',
      });
    },
  });
}

// 检查管理员是否已登录的辅助函数
export function useIsAdminAuthenticated() {
  const { data, isLoading, error } = useAdminAuth();
  
  // 在构建时减少日志输出
  const isBuildTime = typeof process !== 'undefined' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
  
  if (!isBuildTime) {
    console.log(`[IsAuthenticated] ${new Date().toISOString()} - 状态检查`);
    console.log(`[IsAuthenticated] data:`, data);
    console.log(`[IsAuthenticated] isLoading:`, isLoading);
    console.log(`[IsAuthenticated] error:`, error);
  }
  
  const result = {
    isAuthenticated: data?.authenticated === true,
    isLoading: isLoading && !error, // 如果有错误就不显示loading
    adminInfo: data?.data,
  };
  
  if (!isBuildTime) {
    console.log(`[IsAuthenticated] 返回结果:`, result);
  }
  
  return result;
}