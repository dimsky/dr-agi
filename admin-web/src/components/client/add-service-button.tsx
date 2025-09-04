'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface AddServiceButtonProps {
  className?: string;
  children?: React.ReactNode;
}

// 表单验证模式
const addServiceSchema = z.object({
  displayName: z.string().min(1, '服务名称不能为空').max(100, '服务名称不能超过100个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  difyApiKey: z.string().min(1, 'Dify API密钥不能为空'),
  difyBaseUrl: z.string().url('请输入有效的URL地址'),
  basePrice: z.number().min(0, '价格不能为负数'),
  currency: z.string().min(1),
  priceType: z.enum(['fixed', 'variable', 'tiered']),
  isActive: z.boolean(),
});

type AddServiceFormData = z.infer<typeof addServiceSchema>;

// API响应类型
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

interface ServiceData {
  id: string;
  displayName: string;
  description?: string;
  pricing: {
    basePrice: number;
    currency: string;
    priceType: string;
  };
  isActive: boolean;
  createdAt: string;
}

export function AddServiceButton({ className, children }: AddServiceButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const form = useForm<AddServiceFormData>({
    resolver: zodResolver(addServiceSchema),
    defaultValues: {
      displayName: '',
      description: '',
      difyApiKey: '',
      difyBaseUrl: '',
      basePrice: 0,
      currency: 'CNY',
      priceType: 'fixed',
      isActive: true,
    },
  });

  // 创建服务的mutation
  const createServiceMutation = useMutation({
    mutationFn: async (data: AddServiceFormData): Promise<ServiceData> => {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 确保包含cookies
        body: JSON.stringify({
          displayName: data.displayName,
          description: data.description || null,
          difyApiKey: data.difyApiKey,
          difyBaseUrl: data.difyBaseUrl,
          pricing: {
            basePrice: data.basePrice,
            currency: data.currency,
            priceType: data.priceType,
          },
          isActive: data.isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: 创建服务失败`);
      }

      const result: ApiResponse<ServiceData> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '创建服务失败');
      }

      return result.data!;
    },
    onSuccess: (data) => {
      toast.success('服务创建成功', {
        description: `${data.displayName} 已成功创建`,
      });
      
      // 刷新服务列表
      queryClient.invalidateQueries({ queryKey: ['services'] });
      
      // 重置表单和关闭对话框
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      console.error('创建服务失败:', error);
      toast.error('创建服务失败', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    },
  });

  const onSubmit = (data: AddServiceFormData) => {
    createServiceMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && !createServiceMutation.isPending) {
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className={className}>
          <Plus className="w-4 h-4 mr-2" />
          {children || '添加新服务'}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold">添加AI服务</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            配置新的AI医疗服务，包括Dify工作流集成和定价策略
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground border-l-2 border-primary pl-3">基本信息</h3>
              
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>服务名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：营养方案制定" {...field} />
                    </FormControl>
                    <FormDescription>
                      用户看到的服务显示名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>服务描述</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="详细描述服务功能和用途..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      服务的详细说明，帮助用户了解服务内容
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dify配置 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground border-l-2 border-primary pl-3">Dify工作流配置</h3>
              
              <FormField
                control={form.control}
                name="difyApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API密钥 *</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="app-..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Dify应用的API密钥，用于调用工作流
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="difyBaseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>服务URL *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://api.dify.ai/v1"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Dify服务的基础URL地址
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 定价配置 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground border-l-2 border-primary pl-3">定价配置</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="basePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>基础价格 *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>货币单位</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择货币" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                          <SelectItem value="USD">美元 (USD)</SelectItem>
                          <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="priceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>定价类型</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择定价类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">固定价格</SelectItem>
                        <SelectItem value="variable">变动价格</SelectItem>
                        <SelectItem value="tiered">阶梯价格</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      固定价格：统一收费；变动价格：根据使用量收费；阶梯价格：按使用量分层收费
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 状态设置 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground border-l-2 border-primary pl-3">服务状态</h3>
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border bg-card p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">立即启用服务</FormLabel>
                      <FormDescription>
                        启用后用户可以立即使用此服务
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="border-t pt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createServiceMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createServiceMutation.isPending}
                className="flex-1 sm:flex-none"
              >
                {createServiceMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                创建服务
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}