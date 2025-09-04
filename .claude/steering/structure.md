# 项目结构指导文档

## 项目组织原则

### 1. 关注点分离
- **前后端分离**：独立的开发、测试和部署
- **组件分层**：UI组件、业务逻辑、数据访问分层
- **功能模块化**：按功能划分，便于维护和扩展

### 2. 约定优于配置
- **统一命名规范**：降低认知负担
- **标准目录结构**：新团队成员快速上手
- **一致的代码风格**：提升代码可读性

### 3. 可扩展性设计
- **模块化架构**：支持功能独立开发和部署
- **配置驱动**：通过配置文件管理环境差异
- **插件化扩展**：支持第三方服务和功能扩展

## 根目录结构

```
dr-agi/
├── Claude.md                    # 项目文档和开发指南
├── .claude/                     # Claude Code 配置
│   ├── agents/                  # 专用代理配置
│   ├── commands/                # 自定义命令
│   ├── specs/                   # 项目规格文档
│   ├── steering/                # 指导文档 (本文档)
│   └── templates/               # 文档模板
├── admin-web/                   # Next.js 全栈后端应用
└── miniprogram/                 # 微信小程序前端应用
```

## 后端应用结构 (admin-web/)

### 配置文件层
```
admin-web/
├── package.json                 # 依赖管理和脚本配置
├── next.config.ts              # Next.js 配置
├── tsconfig.json               # TypeScript 配置
├── components.json             # shadcn/ui 组件配置
├── drizzle.config.ts           # 数据库 ORM 配置
├── migrate.ts                  # 数据库迁移脚本
├── tailwind.config.js          # Tailwind CSS 配置
└── .env.local                  # 环境变量 (不提交到仓库)
```

### 源代码结构 (src/)
```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API 路由
│   │   ├── auth/               # 认证相关 API
│   │   ├── orders/             # 订单管理 API
│   │   ├── tasks/              # 任务管理 API
│   │   ├── dify/               # Dify 集成 API
│   │   └── health/             # 健康检查 API
│   ├── (dashboard)/            # 管理后台路由组
│   │   ├── orders/             # 订单管理页面
│   │   ├── tasks/              # 任务监控页面
│   │   ├── users/              # 用户管理页面
│   │   └── services/           # 服务配置页面
│   ├── globals.css             # 全局样式
│   ├── layout.tsx              # 根布局组件
│   └── page.tsx                # 首页组件
├── components/                 # React 组件
│   ├── ui/                     # shadcn/ui 基础组件
│   ├── client/                 # 客户端组件
│   ├── server/                 # 服务端组件
│   └── providers/              # Context 提供者
├── db/                         # 数据库相关
│   ├── index.ts                # 数据库连接
│   ├── migrations/             # 数据库迁移文件
│   └── schema/                 # 数据模型定义
│       ├── index.ts            # 模型导出
│       ├── users.ts            # 用户模型
│       ├── orders.ts           # 订单模型
│       ├── tasks.ts            # 任务模型
│       ├── feedback.ts         # 反馈模型
│       └── service_configs.ts  # 服务配置模型
├── services/                   # 业务服务层
│   ├── wechat-auth.ts          # 微信认证服务
│   ├── dify.ts                 # Dify AI 服务集成
│   ├── task-queue.ts           # 任务队列服务
│   └── medical.ts              # 医疗服务处理器
├── lib/                        # 工具函数和配置
│   ├── react-query.ts          # React Query 配置
│   ├── supabase.ts             # Supabase 客户端
│   ├── utils.ts                # 通用工具函数
│   └── validations.ts          # 数据验证模式
├── hooks/                      # React Hooks
│   ├── use-orders.ts           # 订单相关 Hooks
│   ├── use-tasks.ts            # 任务相关 Hooks
│   └── use-health-check.ts     # 健康检查 Hook
├── types/                      # TypeScript 类型定义
│   ├── auth.ts                 # 认证相关类型
│   ├── api.ts                  # API 响应类型
│   └── database.ts             # 数据库类型
└── middleware.ts               # Next.js 中间件
```

## 前端小程序结构 (miniprogram/)

### 小程序配置文件
```
miniprogram/
├── app.js                      # 小程序主入口
├── app.json                    # 小程序配置
├── app.wxss                    # 全局样式
├── sitemap.json                # 搜索配置
├── project.config.json         # 项目配置
└── project.private.config.json # 私有配置 (不提交到仓库)
```

### 小程序源代码结构
```
miniprogram/
├── pages/                      # 页面文件
│   ├── index/                  # 首页
│   ├── services/               # 服务选择页
│   ├── orders/                 # 订单页面
│   ├── profile/                # 个人中心
│   ├── login/                  # 登录页面
│   ├── service-form/           # 服务表单页
│   ├── order-detail/           # 订单详情页
│   ├── task-progress/          # 任务进度页
│   ├── task-result/            # 结果展示页
│   ├── feedback/               # 反馈页面
│   ├── personal-info/          # 个人信息页
│   └── consent/                # 知情同意书页
├── components/                 # 自定义组件
│   ├── wechat-auth/            # 微信登录组件
│   ├── service-form/           # 动态表单组件
│   └── order-payment/          # 订单支付组件
├── utils/                      # 工具函数
│   ├── request.js              # HTTP 请求封装
│   ├── auth.js                 # 认证工具
│   └── storage.js              # 存储工具
├── services/                   # API 服务层
│   ├── auth.js                 # 认证服务
│   ├── order.js                # 订单服务
│   └── medical.js              # 医疗服务
└── images/                     # 静态图片资源
    ├── home.png                # 首页图标
    ├── services.png            # 服务图标
    ├── orders.png              # 订单图标
    └── profile.png             # 个人中心图标
```

## 命名约定

### 文件和目录命名
- **目录名**：使用 kebab-case（小写字母和连字符）
  - ✅ `service-form`, `order-detail`, `wechat-auth`
  - ❌ `serviceForm`, `OrderDetail`, `WeChatAuth`

- **React组件文件**：使用 kebab-case + 组件类型后缀
  - ✅ `user-profile.tsx`, `order-list.tsx`
  - ❌ `UserProfile.tsx`, `orderList.tsx`

- **API路由文件**：使用 `route.ts` 固定命名
  - ✅ `app/api/auth/route.ts`
  - ❌ `app/api/auth/index.ts`

### 代码命名
- **组件名**：使用 PascalCase
  ```tsx
  export function UserProfile() { }
  export const OrderList = () => { }
  ```

- **函数名**：使用 camelCase
  ```tsx
  const getUserById = (id: string) => { }
  const createOrder = async (data: OrderData) => { }
  ```

- **变量名**：使用 camelCase
  ```tsx
  const userName = 'John Doe'
  const orderStatus = 'pending'
  ```

- **常量名**：使用 SCREAMING_SNAKE_CASE
  ```tsx
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ```

### 数据库命名
- **表名**：使用 snake_case 复数形式
  - ✅ `users`, `service_configs`, `order_items`
  - ❌ `User`, `serviceConfig`, `orderItem`

- **字段名**：使用 snake_case
  - ✅ `user_id`, `created_at`, `service_type`
  - ❌ `userId`, `createdAt`, `serviceType`

## 代码组织模式

### 组件组织
```tsx
// 组件文件结构
components/
├── ui/                         # 基础 UI 组件
│   ├── button.tsx              # 按钮组件
│   ├── input.tsx               # 输入框组件
│   └── index.ts                # 统一导出
├── client/                     # 客户端组件
│   ├── order-management.tsx    # 订单管理组件
│   └── task-monitor.tsx        # 任务监控组件
└── server/                     # 服务端组件
    ├── user-list.tsx           # 用户列表组件
    └── stats-cards.tsx         # 统计卡片组件
```

### API路由组织
```tsx
// API 路由结构
app/api/
├── auth/                       # 认证相关
│   ├── wechat/route.ts         # 微信登录
│   └── verify/route.ts         # Token 验证
├── orders/                     # 订单相关
│   ├── route.ts                # 订单 CRUD
│   └── [id]/route.ts           # 单个订单操作
└── health/route.ts             # 健康检查
```

### 数据库模型组织
```tsx
// 数据库模型结构
db/schema/
├── index.ts                    # 导出所有模型
├── users.ts                    # 用户模型
├── orders.ts                   # 订单模型
├── tasks.ts                    # 任务模型
├── feedback.ts                 # 反馈模型
└── service_configs.ts          # 服务配置模型
```

## 导入导出规范

### 导入顺序
```tsx
// 1. React 和第三方库
import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { useQuery } from '@tanstack/react-query'

// 2. 内部工具和配置
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'

// 3. 内部组件和服务
import { Button } from '@/components/ui/button'
import { weChatAuthService } from '@/services/wechat-auth'

// 4. 类型定义
import type { User } from '@/types/auth'
```

### 导出规范
```tsx
// 优先使用命名导出
export function UserProfile() { }
export const API_CONFIG = { }

// 默认导出用于页面组件
export default function HomePage() { }

// 统一导出文件
export { Button } from './button'
export { Input } from './input'
export type { ButtonProps } from './button'
```

## 测试文件组织

### 测试文件位置
```
src/
├── components/
│   ├── user-profile.tsx
│   └── user-profile.test.tsx   # 组件测试
├── services/
│   ├── auth.ts
│   └── auth.test.ts            # 服务测试
└── __tests__/                  # 集成测试
    ├── api/
    └── pages/
```

### 测试命名规范
- **单元测试**：`*.test.ts` 或 `*.test.tsx`
- **集成测试**：`*.integration.test.ts`
- **端到端测试**：`*.e2e.test.ts`

## 环境配置管理

### 环境变量文件
```
.env.local                      # 本地开发环境
.env.development               # 开发环境
.env.staging                   # 测试环境
.env.production                # 生产环境
```

### 环境变量命名
```env
# 数据库配置
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=

# 微信配置
WECHAT_APPID=
WECHAT_SECRET=

# JWT 配置
JWT_SECRET=

# Dify 配置
DIFY_API_URL=
DIFY_API_KEY=
```

## 代码质量保证

### ESLint 配置
- 使用 Next.js 推荐配置
- 启用 TypeScript 严格检查
- 配置自定义规则和格式化

### TypeScript 配置
- 启用严格模式
- 配置路径映射（@/ 别名）
- 确保类型安全

### Git 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建或工具变化
```

## 性能优化指导

### 组件优化
- 使用 Server Components 优先
- 合理使用 memo 和 useMemo
- 避免不必要的重新渲染

### 数据获取优化
- 使用 React Query 缓存
- 实现数据预取和后台更新
- 合理设置缓存时间

### 构建优化
- 启用 Turbopack 加速构建
- 配置代码分割和懒加载
- 优化图片和静态资源