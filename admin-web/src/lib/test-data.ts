// 测试数据创建脚本
import { db } from '@/db';
import { users } from '@/db/schema/users';
import { aiService } from '@/db/schema/ai_service';
import { orders } from '@/db/schema/orders';
import { eq } from 'drizzle-orm';

export async function createTestData() {
  try {
    console.log('开始创建测试数据...');

    // 1. 创建测试用户
    const testUser = await db.insert(users).values({
      openId: 'test_openid_001',
      nickname: '测试医生',
      email: 'test@example.com',
      phone: '13800138000',
      profession: '内科医生'
    }).returning();

    console.log('创建测试用户:', testUser[0]);

    // 2. 创建测试AI服务
    const testAiService = await db.insert(aiService).values({
      displayName: '营养方案制定',
      description: '根据患者情况制定个性化营养方案',
      pricing: {
        basePrice: 199,
        currency: 'CNY',
        priceType: 'fixed'
      }
    }).returning();

    console.log('创建测试AI服务:', testAiService[0]);

    // 3. 创建测试订单
    const testOrder = await db.insert(orders).values({
      userId: testUser[0].id,
      aiServiceId: testAiService[0].id,
      amount: '199.00',
      status: 'paid',
      paymentMethod: 'wechat_pay',
      transactionId: 'wx_test_001',
      serviceData: {
        patientAge: 30,
        patientGender: '男',
        symptoms: '需要营养调理'
      }
    }).returning();

    console.log('创建测试订单:', testOrder[0]);

    return {
      user: testUser[0],
      aiService: testAiService[0],
      order: testOrder[0]
    };

  } catch (error) {
    console.error('创建测试数据失败:', error);
    throw error;
  }
}

export async function cleanTestData() {
  try {
    console.log('清理测试数据...');
    
    // 清理测试数据（注意顺序，先删除依赖的表）
    await db.delete(orders).where(eq(orders.transactionId, 'wx_test_001'));
    await db.delete(users).where(eq(users.openId, 'test_openid_001'));
    await db.delete(aiService).where(eq(aiService.displayName, '营养方案制定'));
    
    console.log('测试数据清理完成');
  } catch (error) {
    console.error('清理测试数据失败:', error);
  }
}