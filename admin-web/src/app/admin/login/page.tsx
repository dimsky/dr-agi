'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface LoginFormData {
  username: string;
  password: string;
}

export default function AdminLoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('登录成功', {
          description: '正在跳转到管理后台...',
        });
        
        // 延迟跳转以显示成功消息
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1000);
      } else {
        setError(result.message || '登录失败');
        toast.error('登录失败', {
          description: result.message || '请检查用户名和密码',
        });
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      setError('网络错误，请稍后重试');
      toast.error('登录失败', {
        description: '网络错误，请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (error) setError(''); // 清除错误消息
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {/* 页面标题 */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">管理后台登录</h1>
          <p className="text-sm text-muted-foreground">
            请输入管理员凭据以访问系统
          </p>
        </div>

        {/* 登录表单 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">管理员登录</CardTitle>
            <CardDescription>
              使用管理员账户登录到 DR.Agent 医疗平台后台
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 错误提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 用户名输入 */}
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                    disabled={isLoading}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* 密码输入 */}
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={handleInputChange('password')}
                    disabled={isLoading}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* 登录按钮 */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !formData.username || !formData.password}
              >
                {isLoading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* 页面底部信息 */}
        <div className="text-center text-xs text-muted-foreground">
          <p>DR.Agent 医疗平台管理系统</p>
          <p className="mt-1">© 2025 版权所有</p>
        </div>
      </div>
    </div>
  );
}

