import { NextRequest, NextResponse } from 'next/server';
import { withUserResourceAuth } from '@/lib/auth-middleware';
import { AuthenticatedUser } from '@/types/auth';

/**
 * GET /api/users/[userId]
 * 获取用户信息 - 用户只能查看自己的信息，管理员可查看所有用户信息
 */
async function getUser(request: NextRequest, user: AuthenticatedUser, resourceOwnerId?: string) {
  try {
    const userId = resourceOwnerId;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '用户ID无效' },
        { status: 400 }
      );
    }

    // TODO: 实现实际的数据库查询
    // const userData = await db.query.users.findFirst({
    //   where: and(eq(users.id, userId), eq(users.deletedAt, null)),
    //   columns: {
    //     id: true,
    //     nickname: true,
    //     avatarUrl: true,
    //     email: true,
    //     profession: true,
    //     phone: true,
    //     role: true,
    //     registeredAt: true,
    //     lastLoginAt: true,
    //   }
    // });

    // 模拟数据
    const userData = {
      id: userId,
      nickname: '测试用户',
      avatarUrl: 'https://example.com/avatar.jpg',
      email: 'user@example.com',
      profession: '软件工程师',
      phone: '13800138000',
      role: 'user',
      registeredAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[userId] 
 * 更新用户信息 - 用户只能修改自己的信息，管理员可修改所有用户信息
 */
async function updateUser(request: NextRequest, user: AuthenticatedUser, resourceOwnerId?: string) {
  try {
    const userId = resourceOwnerId;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '用户ID无效' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nickname, email, profession, phone, role } = body;

    // 只有管理员可以修改角色
    if (role && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '无权限修改用户角色' },
        { status: 403 }
      );
    }

    // TODO: 实现实际的数据库更新
    // const updatedUser = await db.update(users)
    //   .set({
    //     nickname,
    //     email,
    //     profession,
    //     phone,
    //     ...(user.role === 'admin' && { role }),
    //     updatedAt: new Date(),
    //   })
    //   .where(and(eq(users.id, userId), eq(users.deletedAt, null)))
    //   .returning();

    // 模拟更新结果
    const updatedUser = {
      id: userId,
      nickname: nickname || '测试用户',
      email: email || 'user@example.com',
      profession: profession || '软件工程师',
      phone: phone || '13800138000',
      role: user.role === 'admin' ? (role || 'user') : 'user',
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: '用户信息更新成功',
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json(
      { success: false, error: '更新用户信息失败' },
      { status: 500 }
    );
  }
}

// 导出带权限验证的处理函数
export const GET = withUserResourceAuth(getUser);
export const PUT = withUserResourceAuth(updateUser);