/**
 * 错误处理中间件使用示例
 * 
 * 这个文件展示了如何在API路由中使用全局错误处理中间件
 * 以及不同错误类型的最佳实践
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  handleError, 
  withErrorHandler, 
  createError, 
  AppError, 
  ErrorType 
} from './error-handler';

/**
 * 示例1: 使用 withErrorHandler 包装器（推荐方式）
 * 自动捕获所有异常并统一处理
 */
export const exampleApiRoute = withErrorHandler(async (request: NextRequest) => {
  // 验证请求参数
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    throw createError.validation('用户ID不能为空', { field: 'userId' });
  }

  // 模拟数据库查询
  const user = await findUserById(userId);
  
  if (!user) {
    throw createError.notFound('用户');
  }

  // 权限检查
  if (!user.isActive) {
    throw createError.authorization('用户账号已被禁用');
  }

  return NextResponse.json({
    success: true,
    data: user,
    timestamp: new Date().toISOString(),
  });
});

/**
 * 示例2: 手动错误处理（当需要更细粒度控制时）
 */
export async function manualErrorHandling(request: NextRequest) {
  try {
    // 业务逻辑
    const result = await someBusinessLogic();
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error) {
    // 手动调用错误处理
    return handleError(error, {
      endpoint: '/api/manual-example',
      method: request.method,
      url: request.url,
    });
  }
}

/**
 * 示例3: 特定业务错误处理
 */
export const orderProcessingRoute = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  
  // 输入验证
  if (!body.orderId) {
    throw createError.validation('订单ID不能为空');
  }

  // 业务逻辑验证
  const order = await getOrder(body.orderId);
  
  if (order.status === 'completed') {
    throw createError.businessLogic('订单已完成，无法修改');
  }

  if (order.status === 'cancelled') {
    throw createError.conflict('订单已取消，无法处理');
  }

  // 外部服务调用
  try {
    await processPayment(order.paymentInfo);
  } catch {
    throw createError.externalService('支付服务', '支付处理失败，请稍后重试');
  }

  // 更新订单状态
  try {
    await updateOrderStatus(order.id, 'paid');
  } catch {
    throw createError.database('订单状态更新失败');
  }

  return NextResponse.json({
    success: true,
    message: '订单处理成功',
    data: { orderId: order.id, status: 'paid' },
  });
});

/**
 * 示例4: 文件上传错误处理
 */
export const fileUploadRoute = withErrorHandler(async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    throw createError.validation('请选择要上传的文件');
  }

  // 文件大小检查
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw createError.fileUpload('文件大小不能超过50MB');
  }

  // 文件类型检查
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw createError.fileUpload('不支持的文件类型，请上传JPEG、PNG或PDF文件');
  }

  // 文件上传逻辑
  const uploadResult = await uploadFile(file);
  
  return NextResponse.json({
    success: true,
    data: uploadResult,
  });
});

/**
 * 示例5: 外部API调用错误处理
 */
export const wechatApiRoute = withErrorHandler(async (request: NextRequest) => {
  const { code } = await request.json();
  
  if (!code) {
    throw createError.validation('微信登录代码不能为空');
  }
  
  try {
    // 调用微信API
    const wechatResponse = await fetch('https://api.weixin.qq.com/sns/jscode2session', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!wechatResponse.ok) {
      throw createError.externalService('微信API', `HTTP ${wechatResponse.status}: 微信服务暂时不可用`);
    }

    const data = await wechatResponse.json();
    
    if (data.errcode) {
      // 微信API返回错误
      throw createError.externalService('微信API', `微信错误码 ${data.errcode}: ${data.errmsg}`);
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    // 网络错误或其他异常
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createError.externalService('微信API', '网络连接失败，请检查网络后重试');
    }
    
    // 重新抛出已知错误
    if (error instanceof AppError) {
      throw error;
    }
    
    // 其他未知错误
    throw createError.externalService('微信API', '微信服务调用失败');
  }
});

/**
 * 示例6: 数据库操作错误处理
 */
export const databaseRoute = withErrorHandler(async (request: NextRequest) => {
  try {
    const users = await db.query.users.findMany();
    
    return NextResponse.json({
      success: true,
      data: users,
    });
    
  } catch (error: unknown) {
    // 根据数据库错误类型处理
    const dbError = error as { code?: string };
    
    if (dbError.code === 'ECONNREFUSED') {
      throw createError.database('数据库连接失败');
    }
    
    if (dbError.code === '23505') { // PostgreSQL唯一约束违反
      throw createError.conflict('数据已存在');
    }
    
    if (dbError.code === '23503') { // PostgreSQL外键约束违反
      throw createError.validation('关联数据不存在');
    }
    
    // 其他数据库错误
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    throw createError.database(`数据库操作失败: ${errorMsg}`);
  }
});

/**
 * 示例7: 自定义错误类型
 */
class CustomBusinessError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorType.BUSINESS_LOGIC, message, 422, 'CUSTOM_BUSINESS_ERROR', details);
  }
}

export const customErrorRoute = withErrorHandler(async (request: NextRequest) => {
  const { amount } = await request.json();
  
  if (amount < 0) {
    throw new CustomBusinessError('金额不能为负数', { amount, minimum: 0 });
  }
  
  if (amount > 10000) {
    throw new CustomBusinessError('单次支付金额不能超过10000元', { amount, maximum: 10000 });
  }

  return NextResponse.json({
    success: true,
    message: '验证通过',
  });
});

// 模拟辅助函数
async function findUserById(id: string) {
  // 模拟数据库查询
  return { id, name: 'Test User', isActive: true };
}

async function someBusinessLogic() {
  // 模拟业务逻辑
  return { result: 'success' };
}

async function getOrder(orderId: string) {
  // 模拟获取订单
  return { 
    id: orderId, 
    status: 'pending', 
    paymentInfo: { method: 'wechat' } 
  };
}

async function processPayment(_paymentInfo: { method: string }) {
  // 模拟支付处理
  return true;
}

async function updateOrderStatus(_orderId: string, _status: string) {
  // 模拟更新订单状态
  return true;
}

async function uploadFile(_file: File) {
  // 模拟文件上传
  return { url: 'https://example.com/file.jpg', id: 'file123' };
}

// 模拟数据库查询
const db = {
  query: {
    users: {
      findMany: async () => [{ id: '1', name: 'User 1' }]
    }
  }
};