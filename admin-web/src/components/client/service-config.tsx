'use client'

import React, { useState } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useServiceConfigs,
  useServiceConfig,
  useUpdateConfig,
  useCreateServiceConfig,
  useTestWorkflow
} from '@/hooks/use-service-configs'
import { AiService, UpdateAiServiceInput } from '@/db/schema/ai_service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  Plus,
  Edit,
  Save,
  TestTube,
  Settings,
  Trash2,
  Check,
  X,
  AlertCircle,
  PlayCircle
} from 'lucide-react'

// Zod 验证模式
const pricingTierSchema = z.object({
  minQuantity: z.number().min(1, '最小数量必须大于0'),
  maxQuantity: z.number().optional(),
  price: z.number().min(0, '价格必须大于等于0')
})

const pricingDiscountSchema = z.object({
  type: z.enum(['percentage', 'fixed'], { message: '折扣类型必须是百分比或固定金额' }),
  value: z.number().min(0, '折扣值必须大于等于0'),
  condition: z.string().optional()
})

const pricingSchema = z.object({
  basePrice: z.number().min(0, '基础价格必须大于等于0'),
  currency: z.string().min(1, '货币类型不能为空'),
  priceType: z.enum(['fixed', 'variable', 'tiered'], { message: '定价类型必须是固定、可变或分层' }),
  tiers: z.array(pricingTierSchema).optional(),
  discounts: z.array(pricingDiscountSchema).optional()
})

const serviceConfigSchema = z.object({
  displayName: z.string().min(1, '服务名称不能为空').max(100, '服务名称不能超过100字符'),
  description: z.string().optional(),
  difyApiKey: z.string().optional(),
  difyBaseUrl: z.string().url('Dify基础URL格式不正确').optional().or(z.literal('')),
  pricing: pricingSchema.optional(),
  isActive: z.boolean()
})

type ServiceConfigFormData = z.infer<typeof serviceConfigSchema>

// 状态映射
const statusMap = {
  true: { label: '已启用', color: 'bg-green-100 text-green-800' },
  false: { label: '已禁用', color: 'bg-red-100 text-red-800' }
} as const

// 定价类型映射
const priceTypeMap = {
  fixed: '固定价格',
  variable: '可变价格', 
  tiered: '分层定价'
} as const


interface ServiceConfigClientProps {
  initialData?: AiService[]
  selectedConfigId?: string
  onConfigSelect?: (configId: string | null) => void
}

export function ServiceConfigClient({ 
  initialData, 
  selectedConfigId, 
  onConfigSelect 
}: ServiceConfigClientProps) {
  // 状态管理
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AiService | null>(null)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testConfigId, setTestConfigId] = useState<string | null>(null)
  const [testData, setTestData] = useState<string>('{}')
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    data?: unknown
    error?: string
  } | null>(null)

  // React Query hooks
  const {
    data: configsData,
    isLoading: configsLoading,
    error: configsError,
    refetch: refetchConfigs
  } = useServiceConfigs()

  useServiceConfig(selectedConfigId || null)

  const updateConfigMutation = useUpdateConfig()
  const createConfigMutation = useCreateServiceConfig()
  const testWorkflowMutation = useTestWorkflow()

  // 表单配置
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    watch
  } = useForm<ServiceConfigFormData>({
    resolver: zodResolver(serviceConfigSchema),
    defaultValues: {
      displayName: '',
      description: '',
      difyApiKey: '',
      difyBaseUrl: '',
      pricing: {
        basePrice: 0,
        currency: 'CNY',
        priceType: 'fixed',
        tiers: [],
        discounts: []
      },
      isActive: true
    }
  })

  // 定价层级字段数组
  const {
    fields: tierFields,
    append: appendTier,
    remove: removeTier
  } = useFieldArray({
    control,
    name: 'pricing.tiers'
  })

  // 折扣字段数组
  const {
    fields: discountFields,
    append: appendDiscount,
    remove: removeDiscount
  } = useFieldArray({
    control,
    name: 'pricing.discounts'
  })

  // 监听定价类型变化
  const priceType = watch('pricing.priceType')

  // 使用初始数据或查询数据
  const configs = configsData?.configs || initialData || []

  // 重置表单数据
  const resetForm = () => {
    reset({
      displayName: '',
      description: '',
      difyApiKey: '',
      difyBaseUrl: '',
      pricing: {
        basePrice: 0,
        currency: 'CNY',
        priceType: 'fixed',
        tiers: [],
        discounts: []
      },
      isActive: true
    })
  }

  // 加载编辑数据到表单
  const loadConfigToForm = (config: AiService) => {
    reset({
      displayName: config.displayName,
      description: config.description || '',
      difyApiKey: config.difyApiKey || '',
      difyBaseUrl: config.difyBaseUrl || '',
      pricing: config.pricing || {
        basePrice: 0,
        currency: 'CNY',
        priceType: 'fixed',
        tiers: [],
        discounts: []
      },
      isActive: config.isActive
    })
  }

  // 处理创建服务配置
  const handleCreate = (data: ServiceConfigFormData) => {
    const createData = {
      displayName: data.displayName,
      description: data.description || null,
      difyApiKey: data.difyApiKey || null,
      difyBaseUrl: data.difyBaseUrl || null,
      pricing: data.pricing || null,
      isActive: data.isActive
    }

    createConfigMutation.mutate(createData, {
      onSuccess: () => {
        setShowCreateDialog(false)
        resetForm()
      }
    })
  }

  // 处理更新服务配置
  const handleUpdate = (data: ServiceConfigFormData) => {
    if (!editingConfig) return

    const updateData: UpdateAiServiceInput = {
      displayName: data.displayName,
      description: data.description || undefined,
      difyApiKey: data.difyApiKey || undefined,
      difyBaseUrl: data.difyBaseUrl || undefined,
      pricing: data.pricing,
      isActive: data.isActive
    }

    updateConfigMutation.mutate(
      { configId: editingConfig.id, updates: updateData },
      {
        onSuccess: () => {
          setShowEditDialog(false)
          setEditingConfig(null)
          resetForm()
        }
      }
    )
  }

  // 处理编辑按钮点击
  const handleEditClick = (config: AiService) => {
    setEditingConfig(config)
    loadConfigToForm(config)
    setShowEditDialog(true)
  }

  // 处理测试工作流
  const handleTestWorkflow = () => {
    if (!testConfigId) return

    let parsedTestData: Record<string, unknown> = {}
    try {
      parsedTestData = JSON.parse(testData)
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: '测试数据JSON格式错误', 
        error: (error as Error).message 
      })
      return
    }

    testWorkflowMutation.mutate(
      { configId: testConfigId, testData: parsedTestData },
      {
        onSuccess: (result) => {
          setTestResult(result)
        },
        onError: (error) => {
          setTestResult({ 
            success: false, 
            message: '工作流测试失败', 
            error: (error as Error).message 
          })
        }
      }
    )
  }

  // 处理测试对话框开启
  const handleTestClick = (configId: string) => {
    setTestConfigId(configId)
    setTestData('{}')
    setTestResult(null)
    setShowTestDialog(true)
  }

  // 添加定价层级
  const handleAddTier = () => {
    appendTier({ minQuantity: 1, price: 0 })
  }

  // 添加折扣
  const handleAddDiscount = () => {
    appendDiscount({ type: 'percentage', value: 0 })
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">服务配置管理</h2>
          <p className="text-muted-foreground">
            管理AI医疗服务配置，包括Dify工作流集成和定价设置
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetchConfigs()}
            disabled={configsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${configsLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新建配置
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {configsError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {(configsError as Error).message || '加载服务配置失败'}
          </AlertDescription>
        </Alert>
      )}

      {/* 配置列表 */}
      <Card>
        <CardHeader>
          <CardTitle>服务配置列表</CardTitle>
          <CardDescription>
            当前共有 {configs.length} 个服务配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无服务配置，点击&ldquo;新建配置&rdquo;开始创建
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>服务名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>定价类型</TableHead>
                  <TableHead>基础价格</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>Dify配置</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow 
                    key={config.id}
                    className={selectedConfigId === config.id ? 'bg-muted/50' : ''}
                  >
                    <TableCell className="font-medium">
                      {config.displayName}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {config.description || '-'}
                    </TableCell>
                    <TableCell>
                      {config.pricing ? priceTypeMap[config.pricing.priceType] : '-'}
                    </TableCell>
                    <TableCell>
                      {config.pricing ? `¥${config.pricing.basePrice}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusMap[config.isActive.toString() as 'true' | 'false'].color}>
                        {statusMap[config.isActive.toString() as 'true' | 'false'].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {config.difyApiKey && config.difyBaseUrl ? (
                        <Badge className="bg-blue-100 text-blue-800">已配置</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">未配置</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(config.updatedAt).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {config.difyApiKey && config.difyBaseUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestClick(config.id)}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onConfigSelect?.(config.id)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建配置对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建服务配置</DialogTitle>
            <DialogDescription>
              创建新的AI医疗服务配置，包括基本信息、Dify集成和定价设置
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleCreate)} className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">服务名称 *</Label>
                    <Controller
                      name="displayName"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="请输入服务名称"
                          className={errors.displayName ? 'border-red-500' : ''}
                        />
                      )}
                    />
                    {errors.displayName && (
                      <p className="text-sm text-red-500">{errors.displayName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="isActive">状态</Label>
                    <Controller
                      name="isActive"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ? 'true' : 'false'}
                          onValueChange={(value) => field.onChange(value === 'true')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">启用</SelectItem>
                            <SelectItem value="false">禁用</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">服务描述</Label>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="请输入服务描述"
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dify集成配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dify集成配置</CardTitle>
                <CardDescription>
                  配置Dify AI工作流集成参数
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difyApiKey">Dify API Key</Label>
                    <Controller
                      name="difyApiKey"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="password"
                          placeholder="请输入Dify API Key"
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="difyBaseUrl">Dify基础URL</Label>
                    <Controller
                      name="difyBaseUrl"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="请输入Dify基础URL"
                          className={errors.difyBaseUrl ? 'border-red-500' : ''}
                        />
                      )}
                    />
                    {errors.difyBaseUrl && (
                      <p className="text-sm text-red-500">{errors.difyBaseUrl.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 定价配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">定价配置</CardTitle>
                <CardDescription>
                  设置服务的定价策略和折扣规则
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricing.basePrice">基础价格 *</Label>
                    <Controller
                      name="pricing.basePrice"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className={errors.pricing?.basePrice ? 'border-red-500' : ''}
                        />
                      )}
                    />
                    {errors.pricing?.basePrice && (
                      <p className="text-sm text-red-500">{errors.pricing.basePrice.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricing.currency">货币类型</Label>
                    <Controller
                      name="pricing.currency"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CNY">人民币 (¥)</SelectItem>
                            <SelectItem value="USD">美元 ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricing.priceType">定价类型</Label>
                    <Controller
                      name="pricing.priceType"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">固定价格</SelectItem>
                            <SelectItem value="variable">可变价格</SelectItem>
                            <SelectItem value="tiered">分层定价</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* 分层定价配置 */}
                {priceType === 'tiered' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>定价层级</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddTier}>
                        <Plus className="h-4 w-4 mr-2" />
                        添加层级
                      </Button>
                    </div>
                    {tierFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>最小数量</Label>
                          <Controller
                            name={`pricing.tiers.${index}.minQuantity`}
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                min="1"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>最大数量</Label>
                          <Controller
                            name={`pricing.tiers.${index}.maxQuantity`}
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                min="1"
                                placeholder="无限制"
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>价格</Label>
                          <Controller
                            name={`pricing.tiers.${index}.price`}
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeTier(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 折扣配置 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>折扣规则</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddDiscount}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加折扣
                    </Button>
                  </div>
                  {discountFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-4 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>折扣类型</Label>
                        <Controller
                          name={`pricing.discounts.${index}.type`}
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">百分比</SelectItem>
                                <SelectItem value="fixed">固定金额</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>折扣值</Label>
                        <Controller
                          name={`pricing.discounts.${index}.value`}
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              type="number"
                              min="0"
                              step="0.01"
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>使用条件</Label>
                        <Controller
                          name={`pricing.discounts.${index}.condition`}
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="如：满100元"
                            />
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeDiscount(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCreateDialog(false)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={!isValid || createConfigMutation.isPending}
              >
                {createConfigMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                创建配置
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 编辑配置对话框 - 复用创建对话框的表单 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑服务配置</DialogTitle>
            <DialogDescription>
              修改现有的AI医疗服务配置
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleUpdate)} className="space-y-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">服务名称 *</Label>
                    <Controller
                      name="displayName"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="请输入服务名称"
                          className={errors.displayName ? 'border-red-500' : ''}
                        />
                      )}
                    />
                    {errors.displayName && (
                      <p className="text-sm text-red-500">{errors.displayName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="isActive">状态</Label>
                    <Controller
                      name="isActive"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value ? 'true' : 'false'}
                          onValueChange={(value) => field.onChange(value === 'true')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">启用</SelectItem>
                            <SelectItem value="false">禁用</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">服务描述</Label>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="请输入服务描述"
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dify集成配置 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dify集成配置</CardTitle>
                <CardDescription>
                  配置Dify AI工作流集成参数
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difyApiKey">Dify API Key</Label>
                    <Controller
                      name="difyApiKey"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="password"
                          placeholder="请输入Dify API Key"
                        />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="difyBaseUrl">Dify基础URL</Label>
                    <Controller
                      name="difyBaseUrl"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="请输入Dify基础URL"
                          className={errors.difyBaseUrl ? 'border-red-500' : ''}
                        />
                      )}
                    />
                    {errors.difyBaseUrl && (
                      <p className="text-sm text-red-500">{errors.difyBaseUrl.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 定价配置 - 与创建对话框相同 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">定价配置</CardTitle>
                <CardDescription>
                  设置服务的定价策略和折扣规则
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricing.basePrice">基础价格 *</Label>
                    <Controller
                      name="pricing.basePrice"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className={errors.pricing?.basePrice ? 'border-red-500' : ''}
                        />
                      )}
                    />
                    {errors.pricing?.basePrice && (
                      <p className="text-sm text-red-500">{errors.pricing.basePrice.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricing.currency">货币类型</Label>
                    <Controller
                      name="pricing.currency"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CNY">人民币 (¥)</SelectItem>
                            <SelectItem value="USD">美元 ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricing.priceType">定价类型</Label>
                    <Controller
                      name="pricing.priceType"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">固定价格</SelectItem>
                            <SelectItem value="variable">可变价格</SelectItem>
                            <SelectItem value="tiered">分层定价</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* 分层定价配置 */}
                {priceType === 'tiered' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>定价层级</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddTier}>
                        <Plus className="h-4 w-4 mr-2" />
                        添加层级
                      </Button>
                    </div>
                    {tierFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>最小数量</Label>
                          <Controller
                            name={`pricing.tiers.${index}.minQuantity`}
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                min="1"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>最大数量</Label>
                          <Controller
                            name={`pricing.tiers.${index}.maxQuantity`}
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                min="1"
                                placeholder="无限制"
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>价格</Label>
                          <Controller
                            name={`pricing.tiers.${index}.price`}
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                min="0"
                                step="0.01"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeTier(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 折扣配置 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>折扣规则</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddDiscount}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加折扣
                    </Button>
                  </div>
                  {discountFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-4 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>折扣类型</Label>
                        <Controller
                          name={`pricing.discounts.${index}.type`}
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">百分比</SelectItem>
                                <SelectItem value="fixed">固定金额</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>折扣值</Label>
                        <Controller
                          name={`pricing.discounts.${index}.value`}
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              type="number"
                              min="0"
                              step="0.01"
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>使用条件</Label>
                        <Controller
                          name={`pricing.discounts.${index}.condition`}
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="如：满100元"
                            />
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeDiscount(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowEditDialog(false)
                  setEditingConfig(null)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={!isValid || updateConfigMutation.isPending}
              >
                {updateConfigMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                更新配置
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dify工作流测试对话框 */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>测试Dify工作流</DialogTitle>
            <DialogDescription>
              输入测试数据来验证Dify工作流配置是否正常
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testData">测试数据 (JSON格式)</Label>
              <textarea
                id="testData"
                className="w-full h-32 px-3 py-2 text-sm border rounded-md resize-none font-mono"
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder='{"input": "测试数据"}'
              />
            </div>

            {testResult && (
              <div className="space-y-2">
                <Label>测试结果</Label>
                <div className={`p-4 rounded-md border ${
                  testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <p className="font-medium">
                        {testResult.success ? '测试成功' : '测试失败'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {testResult.message}
                      </p>
                      {testResult.data ? (
                        <pre className="text-xs bg-white/50 p-2 rounded border overflow-x-auto">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      ) : null}
                      {testResult.error && (
                        <p className="text-sm text-red-600">
                          错误详情: {testResult.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTestDialog(false)
                setTestResult(null)
                setTestData('{}')
              }}
            >
              关闭
            </Button>
            <Button 
              onClick={handleTestWorkflow}
              disabled={testWorkflowMutation.isPending || !testConfigId}
            >
              {testWorkflowMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              运行测试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}