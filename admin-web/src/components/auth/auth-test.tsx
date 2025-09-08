'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useAuthenticatedFetch } from '@/hooks/use-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, User, Shield } from 'lucide-react';

interface AuthTestResponse {
  success: boolean;
  valid: boolean;
  user?: {
    id: string;
    role: string;
    username?: string;
  };
  error?: string;
  message?: string;
}

export function AuthTestComponent() {
  const { user, isAuthenticated, token } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();
  const [testResult, setTestResult] = useState<AuthTestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testAuth = async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch('/api/admin/auth');
      const result = await response.json();
      setTestResult(result);
      console.log('认证测试结果:', result);
    } catch (error) {
      console.error('认证测试失败:', error);
      setTestResult({
        success: false,
        valid: false,
        error: error instanceof Error ? error.message : '请求失败',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          认证状态测试
        </CardTitle>
        <CardDescription>
          测试当前用户的认证状态和权限
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 当前认证状态 */}
        <div className="space-y-2">
          <h3 className="font-medium">当前认证状态</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span>认证状态: {isAuthenticated ? '已认证' : '未认证'}</span>
            </div>
            {user && (
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role === 'admin' ? '管理员' : '普通用户'}
              </Badge>
            )}
          </div>
          {user && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4" />
                <span className="font-medium">用户信息:</span>
              </div>
              <pre className="text-xs text-muted-foreground">
                {JSON.stringify(
                  {
                    username: user.username,
                    role: user.role,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Token信息 */}
        <div className="space-y-2">
          <h3 className="font-medium">Token 信息</h3>
          <div className="bg-muted p-3 rounded-md text-sm">
            {token ? (
              <div>
                <p className="mb-2">Token 存在: ✓</p>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {token.substring(0, 50)}...
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">无 Token</p>
            )}
          </div>
        </div>

        {/* 认证测试按钮 */}
        <Button 
          onClick={testAuth} 
          disabled={isLoading || !isAuthenticated}
          className="w-full"
        >
          {isLoading ? '测试中...' : '测试认证API'}
        </Button>

        {/* 测试结果 */}
        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'}>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="font-medium">
                    {testResult.success ? 'API调用成功' : 'API调用失败'}
                  </span>
                </div>
                {testResult.user && (
                  <div className="text-sm">
                    <p>验证结果: {testResult.valid ? '有效' : '无效'}</p>
                    <pre className="bg-muted p-2 rounded mt-2 text-xs">
                      {JSON.stringify(testResult.user, null, 2)}
                    </pre>
                  </div>
                )}
                {testResult.error && (
                  <p className="text-sm text-destructive">
                    错误: {testResult.error}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!isAuthenticated && (
          <Alert>
            <AlertDescription>
              请先登录以测试认证功能。
              <a href="/admin/login" className="ml-2 text-primary hover:underline">
                前往登录
              </a>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}