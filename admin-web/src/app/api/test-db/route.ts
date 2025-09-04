import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema/orders';
import { users } from '@/db/schema/users';
import { aiService } from '@/db/schema/ai_service';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    // 测试基本的表查询
    console.log('测试数据库连接...');

    // 查询orders表
    const ordersCount = await db.select().from(orders).limit(1);
    console.log('Orders查询结果:', ordersCount);

    // 查询users表
    const usersCount = await db.select().from(users).limit(1);
    console.log('Users查询结果:', usersCount);

    // 查询aiService表
    const servicesCount = await db.select().from(aiService).limit(1);
    console.log('AI Service查询结果:', servicesCount);

    // 测试关联查询
    const joinQuery = await db
      .select({
        orderId: orders.id,
        orderStatus: orders.status,
        orderAmount: orders.amount,
        userName: users.nickname,
        serviceName: aiService.displayName,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(aiService, eq(orders.aiServiceId, aiService.id))
      .limit(5);

    console.log('关联查询结果:', joinQuery);

    return NextResponse.json({
      success: true,
      message: '数据库连接测试成功',
      data: {
        ordersCount: ordersCount.length,
        usersCount: usersCount.length,
        servicesCount: servicesCount.length,
        sampleJoinQuery: joinQuery
      }
    });

  } catch (error) {
    console.error('数据库测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}