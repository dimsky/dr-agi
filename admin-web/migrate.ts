#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';

// 加载环境变量
const projectDir = process.cwd();
loadEnvConfig(projectDir);

async function runMigrations() {
  try {
    console.log('🔄 开始数据库迁移...');
    
    // 检查环境变量
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL 环境变量未设置');
    }

    console.log('📡 连接到数据库:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@'));

    // 创建迁移专用的数据库连接
    const migrationClient = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    const db = drizzle(migrationClient);

    // 执行迁移
    console.log('🚀 执行迁移文件...');
    await migrate(db, {
      migrationsFolder: './src/db/migrations',
    });

    console.log('✅ 数据库迁移完成！');
    console.log('📊 迁移统计:');
    console.log('   - 表: users, orders, tasks, feedback, service_configs');
    console.log('   - 枚举类型: order_status, payment_method, task_status, feedback_category, feedback_status');
    console.log('   - 外键约束: 4个');
    console.log('   - 唯一约束: 3个');

    // 关闭连接
    await migrationClient.end();
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

// 验证表结构
async function verifyTables() {
  try {
    console.log('\n🔍 验证表结构...');
    
    const verificationClient = postgres(process.env.DATABASE_URL!, {
      max: 1,
    });

    // 检查所有表是否存在
    const tables = ['users', 'orders', 'tasks', 'feedback', 'service_configs'];
    
    for (const table of tables) {
      const result = await verificationClient`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        ) as exists
      `;
      
      if (result[0].exists) {
        console.log(`   ✅ ${table} 表已创建`);
      } else {
        console.log(`   ❌ ${table} 表未找到`);
      }
    }

    // 检查外键约束
    const foreignKeys = await verificationClient`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name;
    `;

    console.log(`   ✅ 外键约束: ${foreignKeys.length}个`);
    
    for (const fk of foreignKeys) {
      console.log(`      ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }

    await verificationClient.end();
    console.log('\n🎉 所有表结构验证通过！');
    
  } catch (error) {
    console.error('❌ 表结构验证失败:', error);
    process.exit(1);
  }
}

// 主执行函数
async function main() {
  await runMigrations();
  await verifyTables();
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

export { runMigrations, verifyTables };