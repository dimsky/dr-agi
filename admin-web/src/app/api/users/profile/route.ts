import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, UpdateUserInput } from '@/db/schema/users';
import { eq } from 'drizzle-orm';
import { authenticateRequest, createAuthError } from '@/lib/auth-utils';

/**
 * POST /api/users/profile - 更新用户信息
 * 
 * 请求体：
 * {
 *   "nickname": string (必填),
 *   "avatarUrl": string (可选),
 *   "profession": string (可选), 
 *   "email": string (可选),
 *   "phone": string (可选)
 * }
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "message": "用户信息更新成功",
 *   "data": {
 *     "user": { ... }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 使用 auth-utils 验证用户认证
    const user = authenticateRequest(request);
    if (!user) {
      const authError = createAuthError('未提供认证信息或认证信息无效');
      return NextResponse.json({
        success: false,
        message: authError.error,
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    // 确保是微信用户才能更新个人资料
    if (!user.openId) {
      return NextResponse.json({
        success: false,
        message: '只有微信用户可以更新个人资料',
        timestamp: new Date().toISOString(),
      }, { status: 403 });
    }

    // 解析请求体
    const body = await request.json();
    const { nickname, avatarUrl, profession, email, phone } = body;

    // 验证必填字段
    if (!nickname || nickname.trim() === '') {
      return NextResponse.json({
        success: false,
        message: '昵称不能为空',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // 验证邮箱格式（如果提供）
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({
          success: false,
          message: '邮箱格式不正确',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }
    }

    // 验证手机号格式（如果提供）
    if (phone && phone.trim()) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone.trim())) {
        return NextResponse.json({
          success: false,
          message: '手机号格式不正确',
          timestamp: new Date().toISOString(),
        }, { status: 400 });
      }
    }

    // 构建更新数据
    const updateData: UpdateUserInput = {
      nickname: nickname.trim(),
      lastLoginAt: new Date(), // 更新最后登录时间
    };

    if (avatarUrl && avatarUrl.trim()) {
      updateData.avatarUrl = avatarUrl.trim();
    }

    if (profession && profession.trim()) {
      updateData.profession = profession.trim();
    }

    if (email && email.trim()) {
      updateData.email = email.trim();
    }

    if (phone && phone.trim()) {
      updateData.phone = phone.trim();
    }

    // 更新用户信息
    const updatedUsers = await db
      .update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.openId, user.openId!)) // 使用认证用户的 openId
      .returning();

    if (updatedUsers.length === 0) {
      return NextResponse.json({
        success: false,
        message: '用户不存在',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    const updatedUser = updatedUsers[0];

    // 格式化返回数据（不包含敏感信息）
    const userResponse = {
      id: updatedUser.id,
      openId: updatedUser.openId,
      nickname: updatedUser.nickname,
      avatarUrl: updatedUser.avatarUrl,
      profession: updatedUser.profession,
      email: updatedUser.email,
      phone: updatedUser.phone,
      gender: updatedUser.gender,
      city: updatedUser.city,
      province: updatedUser.province,
      country: updatedUser.country,
      language: updatedUser.language,
      isActive: updatedUser.isActive,
      registeredAt: updatedUser.registeredAt,
      lastLoginAt: updatedUser.lastLoginAt,
      updatedAt: updatedUser.updatedAt,
    };

    return NextResponse.json({
      success: true,
      message: '用户信息更新成功',
      data: {
        user: userResponse,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('用户信息更新失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '用户信息更新失败',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}