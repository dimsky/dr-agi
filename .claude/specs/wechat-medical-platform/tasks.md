# 实施计划

## 任务概述
基于Next.js 15全栈架构的DR.Agent AI 医学服务平台实施，采用App Router + Server Components模式，集成Dify AI工作流，支持小程序端和管理端。

## 指导文档合规性
遵循structure.md项目组织规范和tech.md技术标准，采用Drizzle ORM + Supabase数据层，TanStack Query v5客户端状态管理。

## 原子任务要求
**每个任务必须满足以下标准以确保最佳代理执行效果：**
- **文件范围**: 涉及1-3个相关文件
- **时间限制**: 15-30分钟内可完成
- **单一目标**: 一个可测试的结果
- **明确文件**: 指定创建/修改的确切文件
- **代理友好**: 清晰的输入输出，最小上下文切换

## 任务格式指南
- 使用复选框格式: `- [ ] 任务编号. 任务描述`
- **指定文件**: 始终包含确切文件路径
- **包含实施细节** 作为项目符号
- 使用需求引用: `_需求: X.Y, Z.A_`
- 使用现有代码引用: `_复用: path/to/file.ts, path/to/component.tsx_`
- 仅关注编码任务(无部署、用户测试等)
- **避免广泛术语**: 任务标题中不使用"系统"、"集成"、"完成"

## 好与坏的任务示例
❌ **不当示例(过于宽泛)**:
- "实施认证系统" (影响多个文件，多个目标)
- "添加用户管理功能" (范围模糊，无文件规范)
- "构建完整仪表板" (过大，多个组件)

✅ **良好示例(原子级)**:
- "在src/db/schema/users.ts中创建User模型及微信字段"
- "在src/app/api/auth/wechat/route.ts中添加微信登录API端点"
- "在src/components/client/order-management.tsx中创建订单管理Client组件"

## 任务

### 阶段1: 项目基础设置

- [x] 1. 初始化Next.js 15项目结构
  - 文件: admin-web/package.json, admin-web/next.config.js, admin-web/tsconfig.json
  - 创建Next.js 15项目与App Router配置
  - 配置TypeScript和基本ESLint规则
  - 设置Tailwind CSS配置文件
  - 目标: 建立项目基础架构
  - _需求: 全部_

- [x] 2. 配置Drizzle ORM与Supabase连接
  - 文件: admin-web/src/db/index.ts, admin-web/drizzle.config.ts
  - 安装drizzle-orm和@supabase/supabase-js依赖
  - 创建数据库连接配置
  - 设置环境变量模板
  - 目标: 建立类型安全的数据访问层
  - _需求: 5.1, 6.1_

- [x] 3. 设置shadcn/ui组件库
  - 文件: admin-web/components.json, admin-web/src/components/ui/
  - 初始化shadcn/ui配置
  - 安装基础UI组件(Button, Table, Form, Dialog)
  - 配置主题颜色和字体
  - 目标: 建立统一的UI设计系统
  - _需求: 全部_

- [x] 4. 配置TanStack React Query v5
  - 文件: admin-web/src/lib/react-query.ts, admin-web/src/app/layout.tsx
  - 安装@tanstack/react-query依赖
  - 创建QueryClient配置
  - 在根布局中设置QueryProvider
  - 目标: 建立客户端数据获取和状态管理
  - _需求: 全部_

### 阶段2: 数据库模型设计

- [x] 5. 创建User数据库模型
  - 文件: admin-web/src/db/schema/users.ts
  - 定义users表结构，包含微信字段(openId, nickname, avatarUrl等)
  - 包含业务字段(email, profession, phone)
  - 添加系统字段(注册时间、同意书版本等)
  - 定义WeChatUserInfo和WeChatSession类型
  - 目标: 支持微信用户信息存储
  - _需求: 5.1, 6.1, 7.1_

- [x] 6. 创建Order数据库模型
  - 文件: admin-web/src/db/schema/orders.ts
  - 定义orders表结构，关联用户ID
  - 包含服务类型、数据、状态、金额字段
  - 添加支付和Dify执行相关字段
  - 设置外键关联到users表
  - 目标: 支持订单生命周期管理
  - _需求: 3.1, 3.2, 4.1_

- [x] 7. 创建Task数据库模型
  - 文件: admin-web/src/db/schema/tasks.ts
  - 定义tasks表结构，关联订单ID
  - 包含Dify工作流ID和执行ID字段
  - 添加状态、输入输出数据、错误信息字段
  - 包含执行时间和重试计数
  - 目标: 支持AI任务执行监控
  - _需求: 4.1, 4.2, 4.3_

- [x] 8. 创建Feedback数据库模型
  - 文件: admin-web/src/db/schema/feedback.ts
  - 定义feedback表结构，关联用户ID
  - 包含反馈内容、编号、分类、状态字段
  - 添加管理员回复字段
  - 设置外键关联和索引
  - 目标: 支持用户反馈管理
  - _需求: 8.1, 8.2, 8.3_

- [x] 9. 创建AI服务数据库模型
  - 文件: admin-web/src/db/schema/ai_service.ts
  - 定义ai_service表结构
  - 包含服务类型、Dify工作流ID、显示名称字段
  - 添加输入模式、定价配置的JSON字段
  - 包含激活状态控制
  - 目标: 支持AI服务配置管理
  - _需求: 1.1, 1.2_

- [x] 10. 生成并执行数据库迁移
  - 文件: admin-web/src/db/migrations/, admin-web/migrate.ts
  - 运行drizzle-kit生成迁移文件
  - 创建迁移执行脚本
  - 测试迁移在Supabase中执行
  - 验证所有表和关系正确创建
  - 目标: 部署数据库模式到Supabase
  - _需求: 全部_

### 阶段3: 微信认证系统

- [x] 11. 创建微信认证API路由
  - 文件: admin-web/src/app/api/auth/wechat/route.ts
  - 实现POST方法处理微信code和userInfo
  - 调用微信API换取session(openid, session_key)
  - 创建或更新用户记录
  - 生成JWT token返回给客户端
  - 目标: 处理微信小程序登录流程
  - _需求: 5.1, 5.2, 5.3_

- [x] 12. 创建Token验证API路由
  - 文件: admin-web/src/app/api/auth/verify/route.ts
  - 实现POST方法验证JWT token
  - 查询用户信息并返回
  - 处理token过期和无效情况
  - 返回标准化的用户信息格式
  - 目标: 支持客户端token验证
  - _需求: 5.4_

- [x] 13. 创建微信认证服务类
  - 文件: admin-web/src/services/wechat-auth.ts
  - 实现exchangeCodeForSession方法调用微信API
  - 实现createOrUpdateUser方法处理用户数据
  - 实现JWT token生成和验证方法
  - 包含错误处理和重试逻辑
  - 目标: 封装微信认证业务逻辑
  - _需求: 5.1, 5.2, 5.3_
  - _复用: admin-web/src/db/schema/users.ts_

- [x] 14. 创建认证中间件
  - 文件: admin-web/src/middleware.ts
  - 实现Next.js中间件验证JWT token
  - 保护需要认证的API路由
  - 处理token刷新逻辑
  - 设置正确的CORS头
  - 目标: 提供路由级别的认证保护
  - _需求: 5.4_
  - _复用: admin-web/src/services/wechat-auth.ts_

### 阶段4: 微信小程序前端

- [x] 15. 创建微信小程序项目结构
  - 文件: miniprogram/app.js, miniprogram/app.json, miniprogram/app.wxss
  - 初始化小程序配置文件
  - 设置页面路由和tabBar
  - 配置网络请求域名白名单
  - 添加基础样式和主题色
  - 目标: 建立小程序基础架构
  - _需求: 全部_

- [x] 16. 创建微信登录组件
  - 文件: miniprogram/components/wechat-auth/wechat-auth.js
  - 实现wx.login()获取登录code
  - 实现wx.getUserProfile()获取用户信息
  - 调用后端API完成登录流程
  - 存储token到本地storage
  - 目标: 提供一键微信登录功能
  - _需求: 5.1, 5.2_
  - _复用: admin-web/src/app/api/auth/wechat/route.ts_

- [x] 16.5. 创建小程序首页
  - 文件: miniprogram/pages/index/index.js, miniprogram/pages/index/index.wxml, miniprogram/pages/index/index.wxss, miniprogram/pages/index/index.json
  - 展示平台介绍和核心功能
  - 提供快速进入服务选择的入口
  - 显示用户登录状态
  - 包含最新公告和服务推荐
  - 目标: 提供小程序主入口页面
  - _需求: 1.1, 5.1_

- [x] 17. 创建服务选择页面
  - 文件: miniprogram/pages/services/services.js, miniprogram/pages/services/services.wxml
  - 显示七大医疗服务列表
  - 实现服务项点击导航
  - 添加服务介绍和定价显示
  - 包含加载状态和错误处理
  - 目标: 展示可用医疗服务
  - _需求: 1.1, 1.2_

- [x] 18. 创建动态服务表单组件
  - 文件: miniprogram/components/service-form/service-form.js
  - 根据服务类型动态生成表单
  - 支持文本输入、文件上传、选择器
  - 实现表单验证和错误提示
  - 包含提交按钮状态控制
  - 目标: 收集不同服务的输入数据
  - _需求: 2.1, 2.2, 2.3_

- [x] 19. 创建订单支付组件
  - 文件: miniprogram/components/order-payment/order-payment.js
  - 调用wx.requestPayment()发起微信支付
  - 处理支付成功、失败、取消回调
  - 显示订单信息和金额
  - 支持支付状态跟踪
  - 目标: 处理订单支付流程
  - _需求: 3.1, 3.2, 3.3_

- [x] 20. 创建任务进度页面
  - 文件: miniprogram/pages/task-progress/task-progress.js
  - 显示AI任务执行进度
  - 实现进度条和状态更新
  - 支持轮询获取任务状态
  - 完成后跳转到结果页面
  - 目标: 展示AI服务执行进度
  - _需求: 4.1, 4.2_

- [x] 21. 创建结果查看页面
  - 文件: miniprogram/pages/result/result.js, miniprogram/pages/result/result.wxml
  - 展示AI服务执行结果
  - 支持文本、图片、PDF等格式
  - 包含分享和下载功能
  - 添加满意度评价组件
  - 目标: 展示医疗服务输出结果
  - _需求: 4.3, 4.4_

### 阶段5: Dify AI工作流集成

- [x] 22. 创建Dify服务集成类
  - 文件: admin-web/src/services/dify.ts
  - 实现executeWorkflow方法调用Dify API
  - 实现getWorkflowStatus方法查询执行状态
  - 实现getAvailableWorkflows方法获取工作流列表
  - 包含输入验证和错误处理
  - 目标: 封装Dify API调用逻辑
  - _需求: 1.1, 4.1_

- [x] 23. 创建任务队列服务
  - 文件: admin-web/src/services/task-queue.ts
  - 实现enqueueTask方法创建异步任务
  - 实现getTaskStatus方法查询任务状态
  - 实现retryTask和cancelTask方法
  - 集成Supabase实时通知
  - 目标: 管理长时间运行的AI任务
  - _需求: 4.1, 4.2_
  - _复用: admin-web/src/db/schema/tasks.ts_

- [x] 24. 创建动态AI服务处理器
  - 文件: admin-web/src/services/medical.ts
  - 实现通用AI服务处理逻辑，支持动态服务配置
  - 根据ai_service数据库配置执行相应的Dify工作流
  - 实现服务输入数据验证和格式化
  - 包含通用结果处理和格式化逻辑
  - 支持服务配置的动态加载和缓存
  - 目标: 提供可配置的AI服务处理引擎
  - _需求: 1.1, 1.2, 1.3, 4.1_
  - _复用: admin-web/src/services/dify.ts, admin-web/src/services/task-queue.ts, admin-web/src/db/schema/ai_service.ts_

- [x] 24.5. 创建订单API路由
  - 文件: admin-web/src/app/api/orders/route.ts
  - 实现POST方法创建AI服务订单
  - 根据serviceId获取AI服务配置
  - 验证服务状态和输入数据
  - 创建待支付订单记录
  - 返回订单信息供支付流程使用
  - 目标: 分离订单创建和任务执行逻辑
  - _需求: 2.4, 3.1_
  - _复用: admin-web/src/services/medical.ts_

- [x] 25. 创建Dify工作流执行API路由
  - 文件: admin-web/src/app/api/dify/execute/route.ts
  - 验证订单状态为"已支付"
  - 创建AI任务记录并启动Dify工作流
  - 在执行过程中更新tasks和orders状态
  - 返回任务ID供客户端跟踪
  - 目标: 支付完成后执行AI服务
  - _需求: 3.3, 4.1, 4.2_
  - _复用: admin-web/src/services/task-queue.ts_

- [x] 26. 创建任务状态查询API路由
  - 文件: admin-web/src/app/api/tasks/[taskId]/route.ts
  - 实现GET方法查询任务执行状态
  - 返回进度、结果、错误信息
  - 支持实时状态更新
  - 包含权限验证
  - 目标: 支持任务状态实时查询
  - _需求: 4.2, 4.3_
  - _复用: admin-web/src/services/task-queue.ts_

### 阶段6: 管理端页面层

- [x] 27. 创建管理端根布局
  - 文件: admin-web/src/app/layout.tsx, admin-web/src/app/globals.css
  - 设置Server Component根布局
  - 配置TanStack Query Provider
  - 添加全局样式和字体
  - 包含导航菜单和用户状态
  - 目标: 建立管理端基础页面结构
  - _需求: 全部_
  - _复用: admin-web/src/lib/react-query.ts_

- [x] 28. 创建仪表板页面(Server Component)
  - 文件: admin-web/src/app/(dashboard)/page.tsx
  - 服务端获取统计数据
  - 显示关键指标卡片
  - 展示最近订单列表
  - 包含系统健康状态监控
  - 目标: 提供管理端首页概览
  - _需求: 全部_
  - _复用: admin-web/src/db/schema/orders.ts, admin-web/src/db/schema/users.ts_

- [x] 29. 创建订单管理页面(Server Component)
  - 文件: admin-web/src/app/(dashboard)/orders/page.tsx
  - 服务端查询订单数据
  - 支持搜索和过滤参数
  - 传递初始数据给客户端组件
  - 包含分页和排序逻辑
  - 目标: 展示订单管理界面
  - _需求: 3.1, 3.2, 3.3_
  - _复用: admin-web/src/db/schema/orders.ts_

- [x] 30. 创建任务监控页面(Server Component)
  - 文件: admin-web/src/app/(dashboard)/tasks/page.tsx
  - 服务端查询任务执行状态
  - 显示正在运行的AI任务
  - 传递数据给实时监控组件
  - 包含任务统计信息
  - 目标: 展示AI任务执行监控
  - _需求: 4.1, 4.2_
  - _复用: admin-web/src/db/schema/tasks.ts_

- [x] 31. 创建服务配置页面(Server Component)
  - 文件: admin-web/src/app/(dashboard)/services/page.tsx
  - 服务端查询服务配置数据
  - 显示Dify工作流配置
  - 传递数据给配置管理组件
  - 包含配置验证逻辑
  - 目标: 展示医疗服务配置界面
  - _需求: 1.1, 1.2_
  - _复用: admin-web/src/db/schema/ai_service.ts_

- [x] 32. 创建用户管理页面(Server Component)
  - 文件: admin-web/src/app/(dashboard)/users/page.tsx
  - 服务端查询用户数据和活动
  - 显示用户列表和详细信息
  - 支持用户状态管理
  - 包含分页和搜索功能
  - 目标: 展示用户管理界面
  - _需求: 5.1, 7.1_
  - _复用: admin-web/src/db/schema/users.ts_

### 阶段7: 管理端客户端组件

- [x] 33. 创建订单管理Client组件
  - 文件: admin-web/src/components/client/order-management.tsx
  - 使用React Query管理订单数据
  - 实现订单状态更新功能
  - 包含实时数据刷新
  - 添加导出订单功能
  - 目标: 提供订单交互管理功能
  - _需求: 3.1, 3.2, 3.3_
  - _复用: admin-web/src/hooks/use-orders.ts_

- [x] 34. 创建任务监控Client组件
  - 文件: admin-web/src/components/client/task-monitor.tsx
  - 集成Supabase实时订阅
  - 显示任务进度和状态
  - 支持任务重试和取消
  - 包含任务日志查看
  - 目标: 提供实时任务监控功能
  - _需求: 4.1, 4.2, 4.3_
  - _复用: admin-web/src/hooks/use-tasks.ts_

- [x] 35. 创建服务配置Client组件
  - 文件: admin-web/src/components/client/service-config.tsx
  - 使用React Hook Form处理表单
  - 支持Dify工作流测试
  - 包含输入模式编辑器
  - 添加配置保存和验证
  - 目标: 提供服务配置管理功能
  - _需求: 1.1, 1.2_
  - _复用: admin-web/src/hooks/use-service-configs.ts_

- [x] 36. 创建用户管理Client组件
  - 文件: admin-web/src/components/client/user-management.tsx
  - 显示用户详细信息和活动
  - 支持用户状态更新
  - 包含用户搜索和过滤
  - 添加批量操作功能
  - 目标: 提供用户交互管理功能
  - _需求: 5.1, 7.1_
  - _复用: admin-web/src/hooks/use-users.ts_

### 阶段8: React Query Hooks层

- [x] 37. 创建订单相关Hooks
  - 文件: admin-web/src/hooks/use-orders.ts
  - 实现useOrders Hook获取订单列表
  - 实现useUpdateOrder Hook更新订单状态
  - 实现useOrderStats Hook获取统计数据
  - 包含缓存策略和错误处理
  - 目标: 封装订单数据获取逻辑
  - _需求: 3.1, 3.2, 3.3_

- [x] 38. 创建任务相关Hooks
  - 文件: admin-web/src/hooks/use-tasks.ts
  - 实现useTasks Hook获取任务列表
  - 实现useRetryTask Hook重试失败任务
  - 实现useTaskLogs Hook获取任务日志
  - 集成实时数据更新
  - 目标: 封装任务数据获取和操作
  - _需求: 4.1, 4.2, 4.3_

- [x] 39. 创建服务配置相关Hooks
  - 文件: admin-web/src/hooks/use-service-configs.ts
  - 实现useServiceConfigs Hook获取配置列表
  - 实现useUpdateConfig Hook更新配置
  - 实现useTestWorkflow Hook测试Dify工作流
  - 包含乐观更新策略
  - 目标: 封装服务配置管理逻辑
  - _需求: 1.1, 1.2_

- [x] 40. 创建用户相关Hooks
  - 文件: admin-web/src/hooks/use-users.ts
  - 实现useUsers Hook获取用户列表
  - 实现useUserActivity Hook获取用户活动
  - 实现useUpdateUserStatus Hook更新用户状态
  - 支持分页和搜索
  - 目标: 封装用户数据管理逻辑
  - _需求: 5.1, 7.1_

### 阶段9: API路由完善

- [x] 41. 创建订单管理API路由
  - 文件: admin-web/src/app/api/orders/route.ts
  - 实现GET方法获取订单列表
  - 实现POST方法创建新订单
  - 支持查询参数和分页
  - 包含订单状态过滤
  - 目标: 提供订单CRUD API
  - _需求: 3.1, 3.2_
  - _复用: admin-web/src/db/schema/orders.ts_

- [x] 42. 创建订单状态更新API路由
  - 文件: admin-web/src/app/api/orders/[orderId]/status/route.ts
  - 实现PATCH方法更新订单状态
  - 验证状态转换的合法性
  - 记录状态变更日志
  - 触发相关通知
  - 目标: 支持订单状态管理
  - _需求: 3.3, 4.1_
  - _复用: admin-web/src/db/schema/orders.ts_

- [x] 43. 创建用户管理API路由
  - 文件: admin-web/src/app/api/users/route.ts
  - 实现GET方法获取用户列表
  - 支持搜索和过滤参数
  - 包含用户统计信息
  - 添加分页和排序
  - 目标: 提供用户查询API
  - _需求: 5.1, 7.1_
  - _复用: admin-web/src/db/schema/users.ts_

- [x] 44. 创建反馈管理API路由
  - 文件: admin-web/src/app/api/feedback/route.ts
  - 实现GET方法获取反馈列表
  - 实现POST方法创建反馈
  - 支持反馈状态更新
  - 包含管理员回复功能
  - 目标: 支持用户反馈管理
  - _需求: 8.1, 8.2, 8.3_
  - _复用: admin-web/src/db/schema/feedback.ts_

- [x] 44.5. 扩展AI服务管理API路由
  - 文件: admin-web/src/app/api/services/route.ts
  - 在现有GET基础上添加POST、PUT、DELETE方法
  - 实现AI服务配置的完整CRUD操作
  - 支持服务状态管理（激活/停用）
  - 包含Dify工作流配置验证
  - 添加批量操作和权限控制
  - 目标: 完善AI服务配置管理功能
  - _需求: 1.1, 1.2_
  - _复用: admin-web/src/db/schema/ai_service.ts_

### 阶段10: 微信支付集成

- [x] 45. 创建微信支付服务类
  - 文件: admin-web/src/services/wechat-pay.ts
  - 实现统一下单API调用
  - 实现支付结果通知处理
  - 包含签名验证逻辑
  - 添加退款功能
  - 目标: 封装微信支付API调用
  - _需求: 3.2, 3.3_

- [x] 46. 创建支付相关API路由
  - 文件: admin-web/src/app/api/payment/create/route.ts
  - 实现POST方法创建支付订单
  - 调用微信支付统一下单
  - 返回支付参数给小程序
  - 记录支付请求日志
  - 目标: 提供支付订单创建API
  - _需求: 3.2_
  - _复用: admin-web/src/services/wechat-pay.ts_

- [x] 47. 创建支付回调API路由
  - 文件: admin-web/src/app/api/payment/notify/route.ts
  - 实现POST方法处理微信支付通知
  - 验证通知签名和数据
  - 更新订单支付状态
  - 触发后续业务流程
  - 目标: 处理支付结果通知
  - _需求: 3.3, 4.1_
  - _复用: admin-web/src/services/wechat-pay.ts_

### 阶段11: 小程序功能完善

- [x] 48. 创建个人信息管理页面
  - 文件: miniprogram/pages/profile/profile.js, miniprogram/pages/profile/profile.wxml
  - 显示用户微信信息和业务信息
  - 支持职业、邮箱等信息编辑
  - 包含信息验证和保存
  - 添加头像和昵称更新
  - 目标: 提供个人信息管理功能
  - _需求: 7.1, 7.2, 7.3_

- [x] 49. 创建反馈建议页面
  - 文件: miniprogram/pages/feedback/feedback.js, miniprogram/pages/feedback.wxml
  - 提供反馈内容输入表单
  - 支持分类选择和附件上传
  - 生成反馈编号供跟踪
  - 显示提交成功确认
  - 目标: 收集用户反馈建议
  - _需求: 8.1, 8.2, 8.3_

- [x] 50. 创建订单历史页面
  - 文件: miniprogram/pages/orders/orders.js, miniprogram/pages/orders/orders.wxml
  - 显示用户历史订单列表
  - 支持订单状态筛选
  - 包含订单详情查看
  - 添加重新购买功能
  - 目标: 展示用户订单历史
  - _需求: 3.1, 4.4_

- [x] 51. 创建知情同意书组件
  - 文件: miniprogram/components/consent-form/consent-form.js
  - 显示知情同意书内容
  - 记录用户同意时间和IP
  - 支持同意书版本管理
  - 包含必须同意验证
  - 目标: 处理法规合规要求
  - _需求: 6.1, 6.2, 6.3_

### 阶段12: 错误处理和安全

- [x] 52. 创建全局错误处理中间件
  - 文件: admin-web/src/lib/error-handler.ts
  - 统一API错误格式和状态码
  - 记录错误日志到文件或服务
  - 过滤敏感信息
  - 支持不同环境的错误展示
  - 目标: 提供统一错误处理机制
  - _需求: 全部_

- [x] 53. 实现文件上传安全验证
  - 文件: admin-web/src/app/api/upload/route.ts
  - 验证文件类型和大小限制
  - 基于aws s3 sdk 标准协议来实现
  - 返回文件访问URL
  - 目标: 提供安全的文件上传功能
  - _需求: 2.2, 安全要求_

- [ ] 54. 创建数据验证工具函数
  - 文件: admin-web/src/lib/validators.ts
  - 实现用户输入数据验证
  - 包含邮箱、手机号格式验证
  - 添加XSS和SQL注入防护
  - 支持自定义验证规则
  - 目标: 确保数据输入安全性
  - _需求: 2.4, 7.2, 安全要求_

### 阶段13: 性能优化和测试

- [ ] 55. 实现数据库查询优化
  - 文件: admin-web/src/lib/db-optimized.ts
  - 添加数据库索引定义
  - 实现查询结果缓存
  - 优化分页查询性能
  - 包含慢查询监控
  - 目标: 提升数据库访问性能
  - _需求: 性能要求_
  - _复用: admin-web/src/db/schema/中的所有模型_

- [ ] 56. 创建API集成测试
  - 文件: admin-web/__tests__/api/auth.test.ts
  - 测试微信登录API流程
  - 验证token生成和验证
  - 测试错误处理场景
  - 包含并发访问测试
  - 目标: 确保认证API可靠性
  - _需求: 5.1, 5.2, 5.3_
  - _复用: admin-web/src/app/api/auth/中的所有路由_

- [ ] 57. 创建组件单元测试
  - 文件: admin-web/__tests__/components/order-management.test.tsx
  - 测试React Query集成
  - 验证组件状态管理
  - 测试用户交互行为
  - 包含错误边界测试
  - 目标: 确保前端组件稳定性
  - _需求: 3.1, 3.2, 3.3_
  - _复用: admin-web/src/components/client/order-management.tsx_

- [ ] 58. 实现小程序端到端测试
  - 文件: miniprogram/__tests__/e2e/login-flow.test.js
  - 测试完整登录到服务购买流程
  - 验证支付和任务执行流程
  - 测试错误恢复机制
  - 包含性能指标验证
  - 目标: 验证完整业务流程
  - _需求: 全部_

### 阶段14: 部署和监控

- [ ] 59. 配置生产环境部署
  - 文件: admin-web/next.config.js, admin-web/Dockerfile
  - 配置Next.js生产构建优化
  - 设置环境变量和secrets管理
  - 配置CDN和静态资源优化
  - 包含健康检查端点
  - 目标: 准备生产环境部署
  - _需求: 可靠性要求_

- [ ] 60. 实现系统监控和日志
  - 文件: admin-web/src/lib/monitoring.ts
  - 集成应用性能监控(APM)
  - 实现自定义指标收集
  - 配置错误报告和告警
  - 包含用户行为分析
  - 目标: 提供系统运行监控
  - _需求: 可靠性要求, 性能要求_