'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EditServiceButton } from '@/components/client/edit-service-button';
import { AddServiceButton } from '@/components/client/add-service-button';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Edit,
  Trash2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// 从medical service导入完整的服务配置类型
import { type MedicalServiceConfig } from '@/services/medical';

// 导出类型给其他组件使用
export type { MedicalServiceConfig };

interface ServiceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 验证单个服务配置
function validateServiceConfig(service: MedicalServiceConfig): ServiceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查基本配置
  if (!service.displayName?.trim()) {
    errors.push('服务显示名称不能为空');
  }

  if (!service.description?.trim()) {
    warnings.push('建议添加服务描述');
  }

  // 检查Dify配置
  if (!service.difyConfig?.apiKey) {
    errors.push('Dify API密钥未配置');
  } else {
    // 简单的API密钥格式验证
    if (service.difyConfig.apiKey.length < 10) {
      warnings.push('Dify API密钥长度可能不正确');
    }
  }

  if (!service.difyConfig?.baseUrl) {
    errors.push('Dify服务URL未配置');
  } else {
    try {
      new URL(service.difyConfig.baseUrl);
    } catch {
      errors.push('Dify服务URL格式不正确');
    }
  }

  // 检查定价配置
  if (!service.pricing?.basePrice || service.pricing.basePrice <= 0) {
    warnings.push('建议设置合理的基础价格');
  }

  if (!service.pricing?.currency) {
    warnings.push('建议设置货币单位');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// 服务配置状态组件
function ServiceConfigStatus({ validation }: { validation: ServiceValidationResult }) {
  if (validation.isValid && validation.warnings.length === 0) {
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
        <CheckCircle className="w-3 h-3 mr-1" />
        配置正常
      </Badge>
    );
  }

  if (validation.isValid && validation.warnings.length > 0) {
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100">
        <AlertTriangle className="w-3 h-3 mr-1" />
        有警告
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
      <XCircle className="w-3 h-3 mr-1" />
      配置错误
    </Badge>
  );
}

// 空的服务状态组件
function EmptyServiceState() {
  return (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Settings className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium">暂无服务配置</h3>
            <p className="text-sm text-muted-foreground mt-1">
              还没有配置任何AI医疗服务，点击下方按钮开始配置
            </p>
          </div>
          <AddServiceButton className="mt-4">
            添加服务配置
          </AddServiceButton>
        </div>
      </CardContent>
    </Card>
  );
}

// API响应类型
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

interface ServicesApiResponse {
  services: MedicalServiceConfig[];
  total: number;
  filters?: {
    isActive?: boolean;
  };
}

// 获取服务列表的API函数
async function fetchServices(): Promise<ServicesApiResponse> {
  const response = await fetch('/api/services', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: 获取服务列表失败`);
  }

  const result: ApiResponse<ServicesApiResponse> = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || '获取服务列表失败');
  }

  return result.data!;
}

// 删除服务的API函数
async function deleteService(id: string): Promise<void> {
  const response = await fetch('/api/services', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ id }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: 删除服务失败`);
  }

  const result: ApiResponse<{ id: string; displayName: string; deletedAt: string }> = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || '删除服务失败');
  }
}

// 服务配置卡片组件
function ServiceConfigCard({ 
  service, 
  validateServiceConfig,
  ServiceConfigStatus,
  onDelete 
}: { 
  service: MedicalServiceConfig;
  validateServiceConfig: (service: MedicalServiceConfig) => ServiceValidationResult;
  ServiceConfigStatus: ({ validation }: { validation: ServiceValidationResult }) => React.JSX.Element;
  onDelete: (id: string) => void;
}) {
  const validation = validateServiceConfig(service);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">
              {service.displayName}
            </CardTitle>
            <CardDescription className="mt-1">
              {service.description || '暂无描述'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ServiceConfigStatus validation={validation} />
            <Badge variant={service.isActive ? 'default' : 'secondary'}>
              {service.isActive ? '已启用' : '已停用'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Dify配置信息 */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <Settings className="w-4 h-4 mr-1" />
            Dify工作流配置
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API密钥:</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded border">
                {service.difyConfig?.apiKey ? 
                  `${service.difyConfig.apiKey.slice(0, 8)}...${service.difyConfig.apiKey.slice(-4)}` : 
                  '未配置'
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">服务URL:</span>
              <span className="text-xs text-primary truncate max-w-48">
                {service.difyConfig?.baseUrl || '未配置'}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* 定价配置 */}
        <div>
          <h4 className="text-sm font-medium mb-2">定价配置</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">基础价格:</span>
              <span className="font-semibold">
                ¥{service.pricing?.basePrice || 0} {service.pricing?.currency || 'CNY'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">定价类型:</span>
              <Badge variant="secondary" className="text-xs">
                {service.pricing?.priceType === 'fixed' ? '固定价格' : 
                 service.pricing?.priceType === 'variable' ? '变动价格' : 
                 service.pricing?.priceType === 'tiered' ? '阶梯价格' : '未设置'}
              </Badge>
            </div>
          </div>
        </div>

        {/* 配置问题提醒 */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-2">
            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>配置错误</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>配置建议</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs space-y-1">
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <Separator />
        <div className="flex justify-end gap-2">
          <EditServiceButton service={service}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-1" />
              编辑
            </Button>
          </EditServiceButton>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除服务</AlertDialogTitle>
                <AlertDialogDescription>
                  您确定要删除服务 &ldquo;<strong>{service.displayName}</strong>&rdquo; 吗？
                  这个操作不可撤销，服务将被软删除并停用。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(service.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

// 统计卡片组件
function StatsCards({ services, validateServiceConfig }: {
  services: MedicalServiceConfig[];
  validateServiceConfig: (service: MedicalServiceConfig) => ServiceValidationResult;
}) {
  const activeServices = services.filter(s => s.isActive);
  const validServices = services.filter(s => validateServiceConfig(s).isValid);
  const servicesWithWarnings = services.filter(s => {
    const validation = validateServiceConfig(s);
    return validation.isValid && validation.warnings.length > 0;
  });
  const servicesWithErrors = services.filter(s => !validateServiceConfig(s).isValid);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">总服务数</p>
              <p className="text-2xl font-bold">{services.length}</p>
            </div>
            <Settings className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">已启用</p>
              <p className="text-2xl font-bold text-green-600">{activeServices.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">配置正常</p>
              <p className="text-2xl font-bold text-blue-600">{validServices.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">需要关注</p>
              <p className="text-2xl font-bold text-yellow-600">
                {servicesWithWarnings.length + servicesWithErrors.length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 加载状态组件
function ServiceListSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片骨架屏 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 服务列表骨架屏 */}
      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// 主服务列表组件
export function ServiceList() {
  const queryClient = useQueryClient();
  
  // 获取服务列表
  const { data, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  // 删除服务的mutation
  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      toast.success('服务删除成功');
      // 刷新服务列表
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error) => {
      console.error('删除服务失败:', error);
      toast.error('删除服务失败', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return <ServiceListSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription>
          无法加载服务配置数据，请检查网络连接或联系管理员。
          错误信息: {error instanceof Error ? error.message : '未知错误'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.services.length === 0) {
    return <EmptyServiceState />;
  }

  return (
    <div className="space-y-6">
      {/* 配置概览统计 */}
      <StatsCards 
        services={data.services} 
        validateServiceConfig={validateServiceConfig}
      />

      {/* 服务配置列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.services.map((service) => (
          <ServiceConfigCard 
            key={service.id} 
            service={service}
            validateServiceConfig={validateServiceConfig}
            ServiceConfigStatus={ServiceConfigStatus}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* 删除加载状态 */}
      {deleteMutation.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>正在删除服务...</span>
          </div>
        </div>
      )}
    </div>
  );
}