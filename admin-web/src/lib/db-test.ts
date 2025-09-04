import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * 测试数据库连接
 */
export async function testDatabaseConnection() {
  try {
    // 执行简单的查询来测试连接
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful:', result);
    return { success: true, message: 'Database connected successfully' };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return { 
      success: false, 
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * 测试Supabase连接
 */
export async function testSupabaseConnection() {
  try {
    const { supabase } = await import('@/lib/supabase');
    
    // 测试Supabase连接
    const { error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
      
    if (error) {
      throw error;
    }
    
    console.log('✅ Supabase connection successful');
    return { success: true, message: 'Supabase connected successfully' };
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return { 
      success: false, 
      message: `Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}