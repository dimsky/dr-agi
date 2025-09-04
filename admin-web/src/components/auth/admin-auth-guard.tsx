'use client';

import { useIsAdminAuthenticated } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminAuthGuard({ children, fallback }: AdminAuthGuardProps) {
  const { isAuthenticated, isLoading } = useIsAdminAuthenticated();

  const router = useRouter();

  useEffect(() => {
    // 只有在非加载状态且确实未认证时才跳转
    // 避免在登录成功后立即跳转的问题
    if (!isLoading && !isAuthenticated) {
      console.log(`[AuthGuard] ${new Date().toISOString()} - 未认证，准备跳转到登录页`);
      console.log(`[AuthGuard] isLoading: ${isLoading}, isAuthenticated: ${isAuthenticated}`);
      
      // 给更多时间让认证状态更新，特别是在登录后
      const timer = setTimeout(() => {
        // 再次检查，确保状态真的没有变化
        if (!isAuthenticated && !isLoading) {
          console.log(`[AuthGuard] 最终确认未认证，执行跳转到登录页`);
          router.push('/admin/login');
        } else {
          console.log(`[AuthGuard] 状态已更新，取消跳转 - isAuthenticated: ${isAuthenticated}, isLoading: ${isLoading}`);
        }
      }, 2000); // 增加延迟到2秒，给认证查询足够时间

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      fallback ?? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">验证登录状态...</p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return (
      fallback ?? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">验证登录状态...</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}