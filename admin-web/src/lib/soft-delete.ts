/**
 * 软删除工具函数
 * 提供统一的软删除操作和查询过滤
 */

import { SQL, eq, and, isNull } from 'drizzle-orm'
import { PgColumn } from 'drizzle-orm/pg-core'

/**
 * 软删除条件 - 只查询未删除的记录
 * @param deletedAtColumn 删除时间列
 * @returns SQL条件，用于过滤未删除的记录
 */
export function notDeleted(deletedAtColumn: PgColumn): SQL {
  return isNull(deletedAtColumn)
}

/**
 * 包含软删除记录的条件 - 查询所有记录（包括已删除）
 * @returns 空条件（不过滤）
 */
export function includeDeleted(): SQL | undefined {
  return undefined
}

/**
 * 只查询已删除的记录
 * @param deletedAtColumn 删除时间列
 * @returns SQL条件，用于过滤已删除的记录
 */
export function onlyDeleted(deletedAtColumn: PgColumn): SQL {
  return eq(deletedAtColumn, deletedAtColumn) // 等价于 IS NOT NULL
}

/**
 * 创建带软删除过滤的查询条件
 * @param conditions 其他查询条件
 * @param deletedAtColumn 删除时间列
 * @param includeDeletedRecords 是否包含已删除的记录，默认false
 * @returns 组合后的查询条件
 */
export function withSoftDeleteFilter(
  conditions: SQL[],
  deletedAtColumn: PgColumn,
  includeDeletedRecords: boolean = false
): SQL | undefined {
  const allConditions = [...conditions]
  
  if (!includeDeletedRecords) {
    allConditions.push(notDeleted(deletedAtColumn))
  }
  
  return allConditions.length > 0 ? and(...allConditions) : undefined
}

/**
 * 软删除操作的结果类型
 */
export interface SoftDeleteResult {
  success: boolean
  deletedCount: number
  message: string
}

/**
 * 软删除记录的数据更新
 * @returns 软删除时的更新数据
 */
export function softDeleteUpdate() {
  return {
    deletedAt: new Date(),
    updatedAt: new Date()
  }
}

/**
 * 恢复软删除记录的数据更新
 * @returns 恢复时的更新数据
 */
export function restoreSoftDeleteUpdate() {
  return {
    deletedAt: null,
    updatedAt: new Date()
  }
}

/**
 * 软删除状态枚举
 */
export enum SoftDeleteStatus {
  ACTIVE = 'active',      // 活跃状态（未删除）
  DELETED = 'deleted',    // 已删除
  ALL = 'all'            // 所有状态
}

/**
 * 根据软删除状态获取查询条件
 * @param status 软删除状态
 * @param deletedAtColumn 删除时间列
 * @returns 对应的查询条件
 */
export function getSoftDeleteCondition(
  status: SoftDeleteStatus | string,
  deletedAtColumn: PgColumn
): SQL | undefined {
  switch (status) {
    case SoftDeleteStatus.ACTIVE:
      return notDeleted(deletedAtColumn)
    case SoftDeleteStatus.DELETED:
      return onlyDeleted(deletedAtColumn)
    case SoftDeleteStatus.ALL:
    default:
      return undefined
  }
}

/**
 * 软删除相关的数据库操作接口
 */
export interface SoftDeleteOperations<T> {
  // 软删除单个记录
  softDelete(id: string): Promise<SoftDeleteResult>
  
  // 批量软删除
  bulkSoftDelete(ids: string[]): Promise<SoftDeleteResult>
  
  // 恢复软删除的记录
  restore(id: string): Promise<SoftDeleteResult>
  
  // 批量恢复
  bulkRestore(ids: string[]): Promise<SoftDeleteResult>
  
  // 永久删除（物理删除）
  permanentDelete(id: string): Promise<SoftDeleteResult>
  
  // 查询时是否包含已删除记录
  findWithDeleted(): Promise<T[]>
  
  // 只查询已删除的记录
  findDeleted(): Promise<T[]>
}

/**
 * 常用的软删除错误消息
 */
export const SOFT_DELETE_MESSAGES = {
  SUCCESS: '删除成功',
  RESTORE_SUCCESS: '恢复成功',
  NOT_FOUND: '记录不存在',
  ALREADY_DELETED: '记录已被删除',
  ALREADY_RESTORED: '记录未被删除',
  PERMANENT_DELETE_SUCCESS: '永久删除成功',
  BATCH_SUCCESS: (count: number) => `成功处理 ${count} 条记录`,
  BATCH_PARTIAL: (success: number, total: number) => 
    `成功处理 ${success}/${total} 条记录`,
  OPERATION_FAILED: '操作失败'
} as const

/**
 * 软删除配置选项
 */
export interface SoftDeleteConfig {
  // 是否启用软删除，默认true
  enabled?: boolean
  
  // 删除字段名，默认'deletedAt'
  deletedAtColumn?: string
  
  // 是否在删除时同时更新updatedAt字段，默认true
  updateTimestamp?: boolean
  
  // 默认查询是否排除已删除记录，默认true
  excludeDeleted?: boolean
}

/**
 * 默认软删除配置
 */
export const DEFAULT_SOFT_DELETE_CONFIG: Required<SoftDeleteConfig> = {
  enabled: true,
  deletedAtColumn: 'deletedAt',
  updateTimestamp: true,
  excludeDeleted: true
}