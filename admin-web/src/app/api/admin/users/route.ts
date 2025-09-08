import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth-middleware';

/**
 * GET /api/admin/users
 * 获取所有用户列表 - 仅管理员可访问
 */
async function getUsers(request: NextRequest) {
  try {
    // TODO: 实现实际的数据库查询
    // const users = await db.query.users.findMany({
    //   where: eq(users.deletedAt, null),
    //   columns: {
    //     id: true,
    //     nickname: true,
    //     email: true,
    //     role: true,
    //     registeredAt: true,
    //     lastLoginAt: true,
    //   }
    // });

    // 模拟数据
    const users = [
      {
        id: '1',
        nickname: '测试用户',
        email: 'user@example.com',
        role: 'user',
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      {
        id: '2', 
        nickname: '管理员',
        email: 'admin@example.com',
        role: 'admin',
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }
    ];

    return NextResponse.json({
      success: true,
      data: users,
      total: users.length,
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}

// 导出带权限验证的处理函数
export const GET = withAdminAuth()(getUsers);