import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-middleware';
import { AuthenticatedUser, USER_ROLES } from '@/types/auth';

/**
 * PUT /api/admin/users/[userId]/role
 * 修改用户角色 - 仅管理员可访问
 */
async function updateUserRole(request: NextRequest, user: AuthenticatedUser) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const userId = pathSegments[pathSegments.length - 2]; // 从URL获取userId

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '用户ID无效' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role } = body;

    // 验证角色值
    if (!role || !Object.values(USER_ROLES).includes(role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '无效的角色值',
          validRoles: Object.values(USER_ROLES)
        },
        { status: 400 }
      );
    }

    // 防止管理员把自己降级
    if (userId === user.id && role !== USER_ROLES.ADMIN) {
      return NextResponse.json(
        { success: false, error: '不能修改自己的管理员角色' },
        { status: 403 }
      );
    }

    // TODO: 实现实际的数据库更新
    // const updatedUser = await db.update(users)
    //   .set({ 
    //     role,
    //     updatedAt: new Date()
    //   })
    //   .where(and(eq(users.id, userId), eq(users.deletedAt, null)))
    //   .returning({
    //     id: users.id,
    //     nickname: users.nickname,
    //     email: users.email,
    //     role: users.role,
    //   });

    // 模拟更新结果
    const updatedUser = {
      id: userId,
      nickname: '测试用户',
      email: 'user@example.com',
      role: role,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: `用户角色已更新为 ${role}`,
    });

  } catch (error) {
    console.error('更新用户角色失败:', error);
    return NextResponse.json(
      { success: false, error: '更新用户角色失败' },
      { status: 500 }
    );
  }
}

// 导出带管理员权限验证的处理函数
export const PUT = withAdminAuth()(updateUserRole);