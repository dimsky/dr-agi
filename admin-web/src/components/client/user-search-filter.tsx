'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, Filter, X, Calendar as CalendarIcon, SortAsc, SortDesc } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface UserSearchFilterProps {
  className?: string;
}

export function UserSearchFilter({ className }: UserSearchFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 从URL获取当前参数
  const currentSearch = searchParams.get('search') || '';
  const currentStatus = searchParams.get('status') || 'all';
  const currentSortBy = searchParams.get('sortBy') || 'registeredAt';
  const currentSortOrder = searchParams.get('sortOrder') || 'desc';
  const currentDateFrom = searchParams.get('dateFrom') || '';
  const currentDateTo = searchParams.get('dateTo') || '';
  
  // 本地状态
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  const [sortBy, setSortBy] = useState(currentSortBy);
  const [sortOrder, setSortOrder] = useState(currentSortOrder);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    currentDateFrom ? new Date(currentDateFrom) : undefined
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    currentDateTo ? new Date(currentDateTo) : undefined
  );

  // 更新URL参数
  const updateSearchParams = useCallback((params: Record<string, string>) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    
    // 设置新参数
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') {
        newSearchParams.set(key, value);
      } else {
        newSearchParams.delete(key);
      }
    });
    
    // 重置页码到第一页
    newSearchParams.delete('page');
    
    // 导航到新URL
    router.push(`?${newSearchParams.toString()}`);
  }, [router, searchParams]);

  // 应用搜索筛选
  const handleApplyFilters = () => {
    updateSearchParams({
      search,
      status,
      sortBy,
      sortOrder,
      dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '',
      dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : '',
    });
  };

  // 清除所有筛选
  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setSortBy('registeredAt');
    setSortOrder('desc');
    setDateFrom(undefined);
    setDateTo(undefined);
    
    // 清除URL参数
    router.push(window.location.pathname);
  };

  // 快速应用状态筛选
  const handleQuickStatusFilter = (newStatus: string) => {
    setStatus(newStatus);
    updateSearchParams({
      search,
      status: newStatus,
      sortBy,
      sortOrder,
      dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '',
      dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : '',
    });
  };

  // 计算活跃筛选数量
  const activeFiltersCount = [
    search && search !== '',
    status && status !== 'all',
    dateFrom,
    dateTo,
  ].filter(Boolean).length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Filter className="w-4 h-4" />
          <span>搜索筛选</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFiltersCount} 个筛选条件
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 搜索框 */}
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户ID、昵称、邮箱、手机号或职业..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApplyFilters();
                }
              }}
            />
          </div>
          <Button onClick={handleApplyFilters}>
            搜索
          </Button>
        </div>

        {/* 快速状态筛选 */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">状态:</span>
          {[
            { value: 'all', label: '全部' },
            { value: 'active', label: '活跃' },
            { value: 'inactive', label: '已禁用' },
          ].map((item) => (
            <Button
              key={item.value}
              variant={status === item.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleQuickStatusFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* 高级筛选 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 排序字段 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">排序字段</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registeredAt">注册时间</SelectItem>
                <SelectItem value="lastLoginAt">最后登录</SelectItem>
                <SelectItem value="nickname">昵称</SelectItem>
                <SelectItem value="email">邮箱</SelectItem>
                <SelectItem value="isActive">状态</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 排序方向 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">排序方向</label>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">
                  <div className="flex items-center space-x-2">
                    <SortDesc className="w-4 h-4" />
                    <span>降序</span>
                  </div>
                </SelectItem>
                <SelectItem value="asc">
                  <div className="flex items-center space-x-2">
                    <SortAsc className="w-4 h-4" />
                    <span>升序</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 注册开始日期 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">注册开始日期</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? (
                    format(dateFrom, "yyyy年MM月dd日", { locale: zhCN })
                  ) : (
                    "选择开始日期"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto min-w-[17rem] p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  locale={zhCN}
                  className='rounded-md border'
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 注册结束日期 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">注册结束日期</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? (
                    format(dateTo, "yyyy年MM月dd日", { locale: zhCN })
                  ) : (
                    "选择结束日期"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto min-w-[17rem] p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  locale={zhCN}
                  className='rounded-md border'
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleClearFilters}
            disabled={activeFiltersCount === 0}
            className="flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>清除筛选</span>
          </Button>
          
          <Button onClick={handleApplyFilters}>
            应用筛选
          </Button>
        </div>

        {/* 当前筛选条件显示 */}
        {activeFiltersCount > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">当前筛选条件:</div>
            <div className="flex flex-wrap gap-2">
              {search && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <span>搜索: {search}</span>
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                    onClick={() => {
                      setSearch('');
                      handleApplyFilters();
                    }}
                  />
                </Badge>
              )}
              {status && status !== 'all' && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <span>状态: {status === 'active' ? '活跃' : status === 'inactive' ? '已禁用' : status}</span>
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                    onClick={() => {
                      setStatus('all');
                      handleApplyFilters();
                    }}
                  />
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <span>开始: {format(dateFrom, "yyyy-MM-dd")}</span>
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                    onClick={() => {
                      setDateFrom(undefined);
                      handleApplyFilters();
                    }}
                  />
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <span>结束: {format(dateTo, "yyyy-MM-dd")}</span>
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                    onClick={() => {
                      setDateTo(undefined);
                      handleApplyFilters();
                    }}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}