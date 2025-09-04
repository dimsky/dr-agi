import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="admin-container admin-page">
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/tasks">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回任务列表
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">任务未找到</h1>
          <p className="text-muted-foreground">
            指定的任务不存在或已被删除
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileX className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle>任务不存在</CardTitle>
            <CardDescription>
              您要查看的任务可能已被删除或ID不正确
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              请检查任务ID是否正确，或从任务列表中选择有效的任务。
            </p>
            <div className="flex flex-col space-y-2">
              <Link href="/tasks">
                <Button className="w-full">
                  返回任务列表
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">
                  返回首页
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}