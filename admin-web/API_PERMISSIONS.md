# API 权限控制系统使用指南

## 概述

本系统实现了基于角色的访问控制 (RBAC)，支持两种用户角色：
- `admin`: 管理员，拥有所有权限
- `user`: 普通用户，只能操作自己的资源

## 权限控制组件

### 1. 用户角色定义

```typescript
// src/types/auth.ts
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
```

### 2. 认证工具函数

```typescript
// src/lib/auth-utils.ts
import { authenticateRequest, checkPermission, isAdmin } from '@/lib/auth-utils';

// 从请求中验证用户
const user = authenticateRequest(request);

// 检查用户权限
const permission = checkPermission(user, {
  requiredRole: 'admin',
  allowSelf: true,
  resourceOwnerId: 'user-123'
});
```

### 3. 权限验证中间件

```typescript
// src/lib/auth-middleware.ts
import { withAuth, withAdminAuth, withUserResourceAuth } from '@/lib/auth-middleware';

// 基本认证中间件
export const GET = withAuth()(handler);

// 管理员权限中间件
export const GET = withAdminAuth()(handler);

// 用户资源权限中间件
export const GET = withUserResourceAuth(handler);
```

## API 权限规则

### 管理员权限 (admin)
- ✅ 查看所有用户信息
- ✅ 修改任何用户信息（包括角色）
- ✅ 查看所有订单
- ✅ 管理系统配置
- ✅ 操作所有资源

### 普通用户权限 (user)
- ✅ 查看/修改自己的用户信息
- ❌ 修改自己的角色
- ✅ 查看自己的订单列表
- ✅ 创建新订单
- ❌ 查看其他用户信息
- ❌ 管理系统配置

## 使用示例

### 1. 管理员专用API

```typescript
// src/app/api/admin/users/route.ts
import { withAdminAuth } from '@/lib/auth-middleware';

async function getUsers(request: NextRequest, user: AuthenticatedUser) {
  // 仅管理员可以访问此API
  // 获取所有用户列表逻辑...
}

export const GET = withAdminAuth()(getUsers);
```

### 2. 用户资源API

```typescript
// src/app/api/users/[userId]/route.ts
import { withUserResourceAuth } from '@/lib/auth-middleware';

async function getUser(request: NextRequest, user: AuthenticatedUser, resourceOwnerId?: string) {
  // 用户只能查看自己的信息，管理员可查看所有用户信息
  const userId = resourceOwnerId;
  // 获取用户信息逻辑...
}

export const GET = withUserResourceAuth(getUser);
```

### 3. 混合权限API

```typescript
// src/app/api/orders/route.ts
import { withAuth } from '@/lib/auth-middleware';
import { USER_ROLES } from '@/types/auth';

async function getOrders(request: NextRequest, user: AuthenticatedUser) {
  // 根据用户角色返回不同数据
  if (user.role === USER_ROLES.ADMIN) {
    // 管理员可以查看所有订单
    return getAllOrders();
  } else {
    // 普通用户只能查看自己的订单
    return getUserOrders(user.id);
  }
}

export const GET = withAuth()(getOrders);
```

## JWT Token 格式

```typescript
interface JWTPayload {
  userId: string;        // 用户ID
  role: UserRole;        // 用户角色
  openId?: string;       // 微信用户的openId
  iat?: number;          // 签发时间
  exp?: number;          // 过期时间
}
```

## 权限验证流程

1. **提取Token**: 从 `Authorization: Bearer <token>` header 中提取JWT
2. **验证Token**: 验证JWT签名和过期时间
3. **获取用户信息**: 从payload中提取用户ID和角色
4. **权限检查**: 根据API要求检查用户权限
5. **执行业务逻辑**: 权限验证通过后执行实际业务逻辑

## API 请求示例

### 用户登录获取Token
```bash
POST /api/auth/wechat
{
  "code": "wechat_auth_code"
}

# 响应
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "role": "user",
    "openId": "wx_openid"
  }
}
```

### 访问受保护的API
```bash
GET /api/orders
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# 普通用户响应（只显示自己的订单）
{
  "success": true,
  "data": [
    {
      "id": "order-1",
      "userId": "user-123",
      "status": "completed"
    }
  ]
}

# 管理员响应（显示所有订单）
{
  "success": true,
  "data": [
    {
      "id": "order-1", 
      "userId": "user-123",
      "status": "completed"
    },
    {
      "id": "order-2",
      "userId": "user-456", 
      "status": "pending"
    }
  ]
}
```

### 权限不足的响应
```bash
GET /api/admin/users
Authorization: Bearer <user_token>

# 响应
{
  "success": false,
  "error": "需要 admin 角色权限",
  "code": "PERMISSION_DENIED"
}
```

## 错误码说明

- `AUTHENTICATION_FAILED`: 认证失败（token无效、过期等）
- `PERMISSION_DENIED`: 权限不足
- `MISSING_USER_ID`: 缺少用户ID
- `INVALID_ROLE`: 无效的用户角色

## 数据库迁移

添加角色字段到用户表：

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';
```

## 注意事项

1. **JWT密钥安全**: 确保 `JWT_SECRET` 环境变量设置为强随机字符串
2. **Token过期**: 建议设置合理的token过期时间（如24小时）
3. **角色升级**: 普通用户升级为管理员需要通过管理员操作
4. **审计日志**: 重要操作建议记录审计日志
5. **输入验证**: 所有API输入都应进行严格验证