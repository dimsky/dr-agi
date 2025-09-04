import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// 创建数据库连接
const connectionString = process.env.DATABASE_URL;

// 创建postgres客户端
const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

// 创建Drizzle数据库实例
export const db = drizzle(client, { schema });

// 导出schema
export { schema };

// 导出类型
export type Database = typeof db;