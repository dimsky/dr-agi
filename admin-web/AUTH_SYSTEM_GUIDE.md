# 权限控制系统 - 使用指南

## 🎯 系统概览

管理员登录和权限控制系统已成功集成到微信医疗平台中。系统现在支持基于JWT的身份认证和角色权限控制。

## 🔐 认证流程

### 1. 管理员登录
1. 访问 `/admin/login` 页面
2. 输入管理员凭据（默认：用户名 `root`，密码 `123`）
3. 系统验证凭据并生成JWT token
4. Token自动保存到localStorage
5. 登录成功后跳转到主仪表板

### 2. Token管理
- **存储位置**: localStorage
- **Token名称**: `admin_token`
- **用户信息**: `admin_user`
- **自动附加**: 所有API请求自动包含 Authorization header

### 3. 权限验证
- **管理员**: 可访问所有功能
- **自动跳转**: 未认证用户自动跳转到登录页
- **实时验证**: 页面级和API级双重权限验证

## 🔧 技术实现

### JWT Token结构
```typescript
{
  userId?: string,      // 普通用户ID
  username?: string,    // 管理员用户名
  role: 'admin' | 'user',  // 用户角色
  openId?: string,      // 微信用户openId (仅user)
  iat: number,         // 签发时间
  exp: number          // 过期时间
}
```

### API权限控制
```typescript
// 管理员专用API
export const GET = withAdminAuth()(handler);

// 用户资源API
export const GET = withUserResourceAuth(handler);

// 基本认证API
export const GET = withAuth()(handler);
```

### 前端认证Hook
```typescript
const { user, token, isAuthenticated, isAdmin, login, logout } = useAuth();
```

## 📋 测试功能

主页面包含认证测试组件，可以：
- ✅ 查看当前认证状态
- ✅ 显示用户信息和角色
- ✅ 测试认证API调用
- ✅ 验证token有效性

## 🔄 使用流程

### 开发环境测试
1. 启动开发服务器：`npm run dev`
2. 访问：`http://localhost:3000`
3. 系统自动跳转到登录页面
4. 输入管理员凭据登录
5. 登录成功后查看主仪表板
6. 使用认证测试组件验证功能

### 环境变量配置
```bash
# .env.local
ADMIN_USERNAME=root          # 管理员用户名
ADMIN_PASSWORD=123          # 管理员密码
JWT_SECRET=your-secret-key  # JWT签名密钥
```

## 🚀 功能特性

### ✅ 已实现
- [x] 管理员登录/登出
- [x] JWT token生成和验证
- [x] 基于角色的权限控制
- [x] 前端认证状态管理
- [x] API请求自动认证
- [x] 页面级权限保护
- [x] 导航栏用户状态显示
- [x] 认证测试组件

### 🔄 权限规则
- **Admin**: 所有权限
- **User**: 只能操作自己的资源
- **未认证**: 自动跳转登录页

### 🛡️ 安全特性
- JWT token过期时间控制
- 自动token附加到API请求
- 前后端双重权限验证
- 敏感信息不暴露到前端

## 📱 用户界面

### 登录页面
- 管理员登录表单
- 输入验证和错误提示
- 登录状态反馈
- 自动保存认证信息

### 主仪表板
- 系统统计概览
- 认证状态显示
- 用户信息和角色标识
- 认证功能测试工具

### 导航栏
- 用户头像和用户名
- 角色标识
- 退出登录功能
- 响应式设计

## 🐛 调试工具

### 浏览器控制台
查看详细的认证日志和调试信息

### localStorage检查
```javascript
// 查看保存的token
localStorage.getItem('admin_token')

// 查看用户信息
JSON.parse(localStorage.getItem('admin_user'))
```

### API测试
使用认证测试组件验证API调用和权限

---

**认证系统现已完全集成并可正常使用！** 🎉