'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Search, Filter, X } from 'lucide-react'

interface OrderSearchFilterProps {
  className?: string
}

// 订单状态选项
const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'processing', label: '处理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
  { value: 'refunded', label: '已退款' }
]

// 排序选项
const sortOptions = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'amount', label: '订单金额' },
  { value: 'status', label: '订单状态' },
  { value: 'paidAt', label: '支付时间' },
  { value: 'completedAt', label: '完成时间' }
]

export function OrderSearchFilter({ className }: OrderSearchFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // 表单状态
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [status, setStatus] = useState(searchParams.get('status') || 'all')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt')
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const param = searchParams.get('dateFrom')
    return param ? new Date(param) : undefined
  })
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const param = searchParams.get('dateTo')
    return param ? new Date(param) : undefined
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = search || status !== 'all' || dateFrom || dateTo || 
    sortBy !== 'createdAt' || sortOrder !== 'desc'

  // 应用筛选
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams)
    
    // 设置搜索参数
    if (search.trim()) {
      params.set('search', search.trim())
    } else {
      params.delete('search')
    }
    
    if (status !== 'all') {
      params.set('status', status)
    } else {
      params.delete('status')
    }
    
    if (dateFrom) {
      // 使用本地时区的日期字符串，避免时区转换问题
      const year = dateFrom.getFullYear()
      const month = String(dateFrom.getMonth() + 1).padStart(2, '0')
      const day = String(dateFrom.getDate()).padStart(2, '0')
      params.set('dateFrom', `${year}-${month}-${day}`)
    } else {
      params.delete('dateFrom')
    }
    
    if (dateTo) {
      // 使用本地时区的日期字符串，避免时区转换问题
      const year = dateTo.getFullYear()
      const month = String(dateTo.getMonth() + 1).padStart(2, '0')
      const day = String(dateTo.getDate()).padStart(2, '0')
      params.set('dateTo', `${year}-${month}-${day}`)
    } else {
      params.delete('dateTo')
    }
    
    if (sortBy !== 'createdAt') {
      params.set('sortBy', sortBy)
    } else {
      params.delete('sortBy')
    }
    
    if (sortOrder !== 'desc') {
      params.set('sortOrder', sortOrder)
    } else {
      params.delete('sortOrder')
    }
    
    // 重置页码
    params.delete('page')
    
    router.push(`${pathname}?${params.toString()}`)
  }

  // 清除所有筛选
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setSortBy('createdAt')
    setSortOrder('desc')
    setDateFrom(undefined)
    setDateTo(undefined)
    router.push(pathname)
  }

  // 监听搜索参数变化同步表单状态
  useEffect(() => {
    setSearch(searchParams.get('search') || '')
    setStatus(searchParams.get('status') || 'all')
    setSortBy(searchParams.get('sortBy') || 'createdAt')
    setSortOrder(searchParams.get('sortOrder') || 'desc')
    
    const dateFromParam = searchParams.get('dateFrom')
    setDateFrom(dateFromParam ? new Date(dateFromParam) : undefined)
    
    const dateToParam = searchParams.get('dateTo')
    setDateTo(dateToParam ? new Date(dateToParam) : undefined)
  }, [searchParams])

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* 基础搜索行 */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索订单ID、交易ID、用户信息或服务名称..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      applyFilters()
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={applyFilters} size="default">
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowAdvanced(!showAdvanced)}
                size="default"
              >
                <Filter className="h-4 w-4 mr-2" />
                高级筛选
              </Button>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  size="default"
                >
                  <X className="h-4 w-4 mr-2" />
                  清除
                </Button>
              )}
            </div>
          </div>

          {/* 高级筛选面板 */}
          {showAdvanced && (
            <div className="border-t pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 订单状态 */}
                <div className="space-y-2">
                  <Label htmlFor="status">订单状态</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择订单状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 排序字段 */}
                <div className="space-y-2">
                  <Label htmlFor="sortBy">排序字段</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择排序字段" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 排序顺序 */}
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">排序顺序</Label>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择排序顺序" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">降序</SelectItem>
                      <SelectItem value="asc">升序</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 占位符保持对齐 */}
                <div></div>
              </div>

              {/* 日期范围筛选 */}
              <div className="space-y-2">
                <Label>日期范围</Label>
                <DateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onRangeChange={({ from, to }) => {
                    setDateFrom(from)
                    setDateTo(to)
                  }}
                  placeholder="点击选择日期范围"
                />
              </div>

              {/* 高级筛选按钮 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAdvanced(false)}
                >
                  收起
                </Button>
                <Button onClick={applyFilters}>
                  应用筛选
                </Button>
              </div>
            </div>
          )}

          {/* 活跃筛选条件显示 */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">当前筛选条件：</span>
              
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                  搜索: {search}
                </span>
              )}
              
              {status !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                  状态: {statusOptions.find(s => s.value === status)?.label}
                </span>
              )}
              
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                  开始: {`${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, '0')}-${String(dateFrom.getDate()).padStart(2, '0')}`}
                </span>
              )}
              
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                  结束: {`${dateTo.getFullYear()}-${String(dateTo.getMonth() + 1).padStart(2, '0')}-${String(dateTo.getDate()).padStart(2, '0')}`}
                </span>
              )}
              
              {(sortBy !== 'createdAt' || sortOrder !== 'desc') && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                  排序: {sortOptions.find(s => s.value === sortBy)?.label} ({sortOrder === 'desc' ? '降序' : '升序'})
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}