'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface AdminAuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminAuthGuard({ children, fallback }: AdminAuthGuardProps) {
  const { isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 如果未认证或不是管理员，跳转到登录页
    if (!isAuthenticated || !isAdmin) {
      console.log(`[AuthGuard] ${new Date().toISOString()} - 未认证或非管理员，准备跳转到登录页`);
      console.log(`[AuthGuard] isAuthenticated: ${isAuthenticated}, isAdmin: ${isAdmin}`);
      
      const timer = setTimeout(() => {
        router.push('/admin/login');
      }, 100); // 减少延迟，因为新系统不需要异步查询

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isAdmin, router]);

  if (!isAuthenticated || !isAdmin) {
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