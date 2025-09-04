'use client'

import React, { useState, useMemo } from 'react'
import { 
  useUsers, 
  useUserActivity, 
  useUpdateUserStatus,
  UserListParams
} from '@/hooks/use-users'
import { User } from '@/db/schema/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  RefreshCw, 
  Search, 
  Users, 
  UserCheck, 
  UserX,
  Eye,
  CheckSquare,
  Square,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Activity
} from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// 用户状态映射
const userStatusMap = {
  active: { 
    label: '活跃', 
    color: 'bg-green-100 text-green-800 border-green-200', 
    icon: UserCheck 
  },
  inactive: { 
    label: '已禁用', 
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: UserX 
  },
} as const

// 性别映射
const genderMap = {
  '0': '未知',
  '1': '男性', 
  '2': '女性'
} as const

interface UserManagementProps {
  className?: string
  initialFilters?: Partial<UserListParams>
}

export function UserManagement({ className, initialFilters = {} }: UserManagementProps) {
  // 状态管理
  const [filters, setFilters] = useState<UserListParams>({
    page: 1,
    limit: 20,
    orderBy: 'registeredAt',
    orderDirection: 'desc',
    status: 'all',
    ...initialFilters
  })

  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showUserDetail, setShowUserDetail] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showBatchActions, setShowBatchActions] = useState(false)

  // React Query hooks
  const { 
    data: userData, 
    isLoading: usersLoading, 
    error: usersError, 
    refetch: refetchUsers,
    isFetching: usersFetching 
  } = useUsers(filters)

  const { 
    data: userActivityData, 
    isLoading: activityLoading 
  } = useUserActivity(
    selectedUser?.id || '', 
    { page: 1, limit: 10 }
  )

  const updateUserStatusMutation = useUpdateUserStatus()

  // 计算数据
  const users = useMemo(() => userData?.users || [], [userData?.users])
  const totalUsers = userData?.totalCount || 0
  const currentPage = userData?.currentPage || 1
  const totalPages = userData?.totalPages || 0
  const activities = userActivityData?.activities || []

  // 搜索过滤
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    
    const query = searchQuery.toLowerCase()
    return users.filter(user => 
      user.nickname?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phone?.toLowerCase().includes(query) ||
      user.profession?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id))
    }
  }

  // 单选用户
  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // 查看用户详情
  const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setShowUserDetail(true)
  }

  // 更新用户状态
  const handleUpdateUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await updateUserStatusMutation.mutateAsync({ userId, isActive })
    } catch (error) {
      console.error('更新用户状态失败:', error)
    }
  }

  // 批量更新用户状态
  const handleBatchUpdateStatus = async (isActive: boolean) => {
    try {
      for (const userId of selectedUsers) {
        await updateUserStatusMutation.mutateAsync({ userId, isActive })
      }
      setSelectedUsers([])
      setShowBatchActions(false)
    } catch (error) {
      console.error('批量更新用户状态失败:', error)
    }
  }

  // 更新筛选条件
  const updateFilters = (newFilters: Partial<UserListParams>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  // 格式化日期
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '未设置'
    try {
      return format(new Date(date), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return '无效日期'
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 头部统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.isActive).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已禁用用户</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => !u.isActive).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已选择</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {selectedUsers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选控制栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            {/* 搜索框 */}
            <div className="flex flex-1 items-center space-x-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户ID、昵称、邮箱等..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 筛选和操作按钮 */}
            <div className="flex items-center space-x-2">
              {/* 状态筛选 */}
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => updateFilters({ status: value as 'all' | 'active' | 'inactive' })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">已禁用</SelectItem>
                </SelectContent>
              </Select>

              {/* 排序 */}
              <Select
                value={filters.orderBy || 'registeredAt'}
                onValueChange={(value) => updateFilters({ orderBy: value as 'registeredAt' | 'lastLoginAt' | 'nickname' })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registeredAt">注册时间</SelectItem>
                  <SelectItem value="lastLoginAt">最后登录</SelectItem>
                  <SelectItem value="nickname">昵称</SelectItem>
                </SelectContent>
              </Select>

              {/* 批量操作 */}
              {selectedUsers.length > 0 && (
                <Dialog open={showBatchActions} onOpenChange={setShowBatchActions}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      批量操作 ({selectedUsers.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>批量操作用户</DialogTitle>
                      <DialogDescription>
                        您已选择 {selectedUsers.length} 个用户，请选择要执行的操作。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col space-y-2">
                      <Button
                        variant="outline"
                        onClick={() => handleBatchUpdateStatus(true)}
                        disabled={updateUserStatusMutation.isPending}
                        className="justify-start"
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        激活选中用户
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleBatchUpdateStatus(false)}
                        disabled={updateUserStatusMutation.isPending}
                        className="justify-start"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        禁用选中用户
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowBatchActions(false)}>
                        取消
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

              {/* 刷新按钮 */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetchUsers()}
                disabled={usersFetching}
              >
                <RefreshCw className={cn(
                  "h-4 w-4",
                  usersFetching && "animate-spin"
                )} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {usersError && (
        <Alert variant="destructive">
          <AlertDescription>
            加载用户数据失败: {usersError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* 用户列表表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>用户列表</span>
            <Badge variant="secondary">
              共 {totalUsers} 个用户
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="p-0"
                  >
                    {selectedUsers.length === filteredUsers.length && filteredUsers.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>用户信息</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>职业信息</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    暂无用户数据
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectUser(user.id)}
                        className="p-0"
                      >
                        {selectedUsers.includes(user.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {user.avatarUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatarUrl}
                            alt={user.nickname || '用户头像'}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium">
                            {user.nickname || '未设置昵称'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {user.id}
                          </div>
                          {user.gender && (
                            <div className="text-xs text-muted-foreground">
                              {genderMap[user.gender as keyof typeof genderMap] || user.gender}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {user.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="mr-1 h-3 w-3" />
                            {user.email}
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center text-sm">
                            <Phone className="mr-1 h-3 w-3" />
                            {user.phone}
                          </div>
                        )}
                        {(user.city || user.province) && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-1 h-3 w-3" />
                            {[user.city, user.province].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.profession && (
                        <div className="flex items-center text-sm">
                          <Briefcase className="mr-1 h-3 w-3" />
                          {user.profession}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={userStatusMap[user.isActive ? 'active' : 'inactive'].color}
                      >
                        {userStatusMap[user.isActive ? 'active' : 'inactive'].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm">
                        <Calendar className="mr-1 h-3 w-3" />
                        {formatDate(user.registeredAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? (
                        <div className="flex items-center text-sm">
                          <Calendar className="mr-1 h-3 w-3" />
                          {formatDate(user.lastLoginAt)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">未登录</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewUser(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateUserStatus(user.id, !user.isActive)}
                          disabled={updateUserStatusMutation.isPending}
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                第 {currentPage} 页，共 {totalPages} 页
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ page: Math.max(1, currentPage - 1) })}
                  disabled={currentPage <= 1 || usersFetching}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ page: Math.min(totalPages, currentPage + 1) })}
                  disabled={currentPage >= totalPages || usersFetching}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 用户详情对话框 */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>用户详情</span>
            </DialogTitle>
            {selectedUser && (
              <DialogDescription>
                {selectedUser.nickname || '未设置昵称'} 的详细信息和活动历史
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* 基本信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">用户ID</Label>
                      <div className="mt-1">{selectedUser.id}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">微信OpenID</Label>
                      <div className="mt-1 font-mono text-sm">{selectedUser.openId}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">昵称</Label>
                      <div className="mt-1">{selectedUser.nickname || '未设置'}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">性别</Label>
                      <div className="mt-1">
                        {selectedUser.gender ? 
                          genderMap[selectedUser.gender as keyof typeof genderMap] || selectedUser.gender 
                          : '未设置'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">邮箱</Label>
                      <div className="mt-1">{selectedUser.email || '未设置'}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">手机号</Label>
                      <div className="mt-1">{selectedUser.phone || '未设置'}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">职业</Label>
                      <div className="mt-1">{selectedUser.profession || '未设置'}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">地区</Label>
                      <div className="mt-1">
                        {[selectedUser.city, selectedUser.province, selectedUser.country]
                          .filter(Boolean)
                          .join(', ') || '未设置'
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 系统信息 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">系统信息</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">账户状态</Label>
                      <div className="mt-1">
                        <Badge 
                          variant="secondary"
                          className={userStatusMap[selectedUser.isActive ? 'active' : 'inactive'].color}
                        >
                          {userStatusMap[selectedUser.isActive ? 'active' : 'inactive'].label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">注册时间</Label>
                      <div className="mt-1">{formatDate(selectedUser.registeredAt)}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">最后登录</Label>
                      <div className="mt-1">{formatDate(selectedUser.lastLoginAt)}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">知情同意</Label>
                      <div className="mt-1">
                        {selectedUser.consentAgreedAt ? (
                          <div>
                            <div>✅ 已同意</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(selectedUser.consentAgreedAt)}
                            </div>
                            {selectedUser.consentVersion && (
                              <div className="text-xs text-muted-foreground">
                                版本: {selectedUser.consentVersion}
                              </div>
                            )}
                          </div>
                        ) : (
                          '❌ 未同意'
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">创建时间</Label>
                      <div className="mt-1">{formatDate(selectedUser.createdAt)}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">更新时间</Label>
                      <div className="mt-1">{formatDate(selectedUser.updatedAt)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 活动历史 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>活动历史</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无活动记录
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3 border-l-2 border-muted pl-4">
                          <div className="flex-1">
                            <div className="font-medium">{activity.action}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {activity.description}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                              {formatDate(activity.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDetail(false)}>
              关闭
            </Button>
            {selectedUser && (
              <Button
                onClick={() => handleUpdateUserStatus(selectedUser.id, !selectedUser.isActive)}
                disabled={updateUserStatusMutation.isPending}
              >
                {selectedUser.isActive ? '禁用用户' : '激活用户'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}