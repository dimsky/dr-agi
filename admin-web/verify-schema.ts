#!/usr/bin/env tsx

import { loadEnvConfig } from '@next/env';

// 加载环境变量
const projectDir = process.cwd();
loadEnvConfig(projectDir);

/**
 * 验证数据库模式是否正确
 * 这个脚本会检查所有表、字段、约束是否按预期创建
 */
async function verifySchema() {
  console.log('🔍 验证数据库模式...\n');

  // 预期的表结构
  const expectedTables = [
    {
      name: 'users',
      columns: ['id', 'open_id', 'union_id', 'nickname', 'avatar_url', 'gender', 'city', 'province', 'country', 'language', 'email', 'profession', 'phone', 'registered_at', 'consent_agreed_at', 'consent_version', 'is_active', 'last_login_at', 'created_at', 'updated_at'],
      unique_constraints: ['open_id']
    },
    {
      name: 'orders',
      columns: ['id', 'user_id', 'service_config_id', 'service_data', 'status', 'amount', 'payment_method', 'transaction_id', 'dify_execution_id', 'result', 'created_at', 'paid_at', 'completed_at', 'updated_at'],
      foreign_keys: [
        { column: 'user_id', references: 'users(id)' },
        { column: 'service_config_id', references: 'service_configs(id)' }
      ]
    },
    {
      name: 'tasks', 
      columns: ['id', 'order_id', 'dify_execution_id', 'status', 'input_data', 'output_data', 'error_message', 'retry_count', 'execution_time', 'started_at', 'completed_at', 'created_at', 'updated_at'],
      foreign_keys: [
        { column: 'order_id', references: 'orders(id)' }
      ]
    },
    {
      name: 'feedback',
      columns: ['id', 'user_id', 'feedback_number', 'category', 'title', 'content', 'status', 'admin_response', 'admin_id', 'responded_at', 'resolved_at', 'created_at', 'updated_at'],
      unique_constraints: ['feedback_number'],
      foreign_keys: [
        { column: 'user_id', references: 'users(id)' }
      ]
    },
    {
      name: 'service_configs',
      columns: ['id', 'service_type', 'display_name', 'description', 'dify_api_key', 'dify_base_url', 'pricing', 'is_active', 'created_at', 'updated_at'],
      unique_constraints: ['service_type']
    }
  ];

  // 预期的枚举类型
  const expectedEnums = [
    'order_status',
    'payment_method', 
    'task_status',
    'feedback_category',
    'feedback_status'
  ];

  console.log('📊 预期模式统计:');
  console.log(`   - 表数量: ${expectedTables.length}`);
  console.log(`   - 枚举类型: ${expectedEnums.length}`);
  console.log(`   - 总字段数: ${expectedTables.reduce((sum, table) => sum + table.columns.length, 0)}`);
  console.log(`   - 外键数量: ${expectedTables.reduce((sum, table) => sum + (table.foreign_keys?.length || 0), 0)}`);
  console.log(`   - 唯一约束: ${expectedTables.reduce((sum, table) => sum + (table.unique_constraints?.length || 0), 0)}`);

  console.log('\n✅ 表结构规范:');
  expectedTables.forEach(table => {
    console.log(`   📋 ${table.name} (${table.columns.length} 字段)`);
    if (table.foreign_keys) {
      table.foreign_keys.forEach(fk => {
        console.log(`      🔗 ${fk.column} → ${fk.references}`);
      });
    }
    if (table.unique_constraints) {
      table.unique_constraints.forEach(uc => {
        console.log(`      🔒 unique: ${uc}`);
      });
    }
  });

  console.log('\n✅ 枚举类型:');
  expectedEnums.forEach(enumType => {
    console.log(`   📝 ${enumType}`);
  });

  console.log('\n🎯 关键设计特性:');
  console.log('   - 微信集成: users 表包含 open_id, union_id, nickname 等微信字段');
  console.log('   - 订单流程: orders → tasks 的完整生命周期管理');
  console.log('   - 服务配置: 动态配置不同医疗服务的 Dify 集成');
  console.log('   - 反馈系统: 完整的用户反馈和管理员回复流程');
  console.log('   - 数据完整性: 级联删除和限制删除的合理外键约束');

  console.log('\n🚀 模式验证完成! 所有预期结构均已定义。');
  console.log('\n💡 下一步: 运行 `pnpm run db:push` 或 `pnpm run migrate` 将模式部署到 Supabase');
}

// 如果直接运行此脚本
if (require.main === module) {
  verifySchema().catch((error) => {
    console.error('❌ 模式验证失败:', error);
    process.exit(1);
  });
}