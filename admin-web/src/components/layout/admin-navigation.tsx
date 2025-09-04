'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsAdminAuthenticated, useAdminLogout } from '@/hooks/use-admin-auth'
import { LogOut, Shield } from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  icon?: string
  description?: string
}

const navigationItems: NavigationItem[] = [
  {
    name: '仪表板',
    href: '/',
    description: '系统概览和统计'
  },
  {
    name: '订单管理',
    href: '/orders',
    description: '查看和管理所有服务订单'
  },
  {
    name: '任务监控',
    href: '/tasks',
    description: 'AI任务执行状态监控'
  },
  {
    name: '用户管理',
    href: '/users',
    description: '用户信息和权限管理'
  },
  {
    name: '服务配置',
    href: '/services',
    description: '医疗服务参数配置'
  },
  {
    name: '数据分析',
    href: '/analytics',
    description: '业务数据统计分析'
  },
  {
    name: '反馈管理',
    href: '/feedback',
    description: '用户反馈处理'
  },
]

export function AdminNavigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const { isAuthenticated, adminInfo, isLoading } = useIsAdminAuthenticated()
  const logoutMutation = useAdminLogout()

  // 确保只在客户端渲染认证相关的UI
  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  // 如果在登录页面，不显示管理员信息
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname === '/admin/login'

  return (
    <nav className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and main navigation */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">医</span>
              </div>
              <span className="text-xl font-semibold text-foreground">
                DR.Agent
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:ml-8 md:space-x-1">
              {navigationItems.slice(0, 5).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              
              {/* More menu for additional items */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    更多
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>管理功能</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    {navigationItems.slice(5).map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="group block p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="font-medium text-foreground group-hover:text-accent-foreground">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Right side - User status and mobile menu */}
          <div className="flex items-center space-x-4">
            {/* System Status */}
            <div className="hidden sm:flex sm:items-center sm:space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-muted-foreground">系统正常</span>
              </div>
            </div>

            {/* Admin User Menu */}
            {!isLoginPage && isClient && (
              <div className="hidden sm:block">
                {isLoading ? (
                  <div className="h-8 px-3 flex items-center">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">加载中...</span>
                    </div>
                  </div>
                ) : isAuthenticated && adminInfo ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-3">
                        <div className="flex items-center space-x-2">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-medium">{adminInfo.username}</span>
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">管理员账户</p>
                          <p className="text-xs text-muted-foreground">
                            {adminInfo.username}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>{logoutMutation.isPending ? '退出中...' : '退出登录'}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="h-8 px-3 flex items-center">
                    <span className="text-sm text-muted-foreground">未登录</span>
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="打开菜单"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 border-t border-border">
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div>{item.name}</div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.description}
                    </div>
                  )}
                </Link>
              ))}
            </div>
            
            {/* Mobile user status and logout */}
            {!isLoginPage && (
              <div className="px-2 py-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-muted-foreground">系统正常</span>
                  </div>
                  {isClient && (
                    <>
                      {isLoading ? (
                        <span className="text-xs text-muted-foreground">加载中...</span>
                      ) : isAuthenticated && adminInfo ? (
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <Shield className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{adminInfo.username}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            disabled={logoutMutation.isPending}
                            className="h-6 px-2 text-xs"
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            {logoutMutation.isPending ? '退出中' : '退出'}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">未登录</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}