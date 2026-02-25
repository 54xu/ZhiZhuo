/**
 * 功能开关服务 - 门店级模块启停控制
 *
 * 每个门店可独立启用/禁用功能模块，无需修改代码
 * 使用 Redis 缓存减少数据库查询
 */

import { PrismaClient } from '@prisma/client';

export interface FeatureFlagConfig {
  [key: string]: any;
}

export interface FeatureFlagEntry {
  storeId: number;
  flagKey: string;
  enabled: boolean;
  config: FeatureFlagConfig | null;
}

// 所有功能开关 key 定义（集中管理，永不复用）
export const FeatureFlags = {
  // V2 模块
  COUPON: 'module.coupon',
  POINTS: 'module.points',
  GIFT_EXCHANGE: 'module.gift_exchange',
  SUB_CARD: 'module.sub_card',
  NOTIFICATION: 'module.notification',
  QR_MEMBER: 'module.qr_member',
  BILL_SPLIT: 'module.bill_split',
  SALES_ANALYSIS: 'module.sales_analysis',

  // V3 模块
  MEMBER_LEVEL: 'module.member_level',
  BALANCE_TRANSFER: 'module.balance_transfer',
  ACCOUNT_SECURITY: 'module.account_security',
  APPOINTMENT: 'module.appointment',
  INSTALLMENT: 'module.installment',
  RETURN_ORDER: 'module.return_order',
  CUSTOMER_SERVICE: 'module.customer_service',
  SMS_VOICE: 'module.sms_voice',
  CHAIN_STORE: 'module.chain_store',
} as const;

class FeatureFlagService {
  private prisma: PrismaClient | null = null;
  // 内存缓存：storeId -> { flagKey -> FeatureFlagEntry }
  private cache: Map<number, Map<string, FeatureFlagEntry>> = new Map();
  private cacheExpiry: Map<number, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 初始化（传入 Prisma 实例）
   */
  init(prisma: PrismaClient): void {
    this.prisma = prisma;
  }

  /**
   * 检查某门店是否启用了某功能
   */
  async isEnabled(storeId: number, flagKey: string): Promise<boolean> {
    const flags = await this.getStoreFlags(storeId);
    const flag = flags.get(flagKey);
    return flag?.enabled ?? false;
  }

  /**
   * 获取某门店某功能的配置
   */
  async getConfig(storeId: number, flagKey: string): Promise<FeatureFlagConfig | null> {
    const flags = await this.getStoreFlags(storeId);
    const flag = flags.get(flagKey);
    return flag?.config ?? null;
  }

  /**
   * 获取某门店所有功能开关（供前端拉取）
   */
  async getAllFlags(storeId: number): Promise<Record<string, { enabled: boolean; config: any }>> {
    const flags = await this.getStoreFlags(storeId);
    const result: Record<string, { enabled: boolean; config: any }> = {};
    for (const [key, entry] of flags) {
      result[key] = { enabled: entry.enabled, config: entry.config };
    }
    return result;
  }

  /**
   * 设置功能开关（管理后台使用）
   */
  async setFlag(storeId: number, flagKey: string, enabled: boolean, config?: FeatureFlagConfig): Promise<void> {
    if (!this.prisma) throw new Error('FeatureFlagService not initialized');

    await this.prisma.featureFlag.upsert({
      where: {
        storeId_flagKey: { storeId, flagKey },
      },
      update: {
        enabled,
        config: config ? JSON.stringify(config) : undefined,
      },
      create: {
        storeId,
        flagKey,
        enabled,
        config: config ? JSON.stringify(config) : null,
      },
    });

    // 清除缓存
    this.invalidateCache(storeId);
  }

  /**
   * 获取门店的所有 flag（带缓存）
   */
  private async getStoreFlags(storeId: number): Promise<Map<string, FeatureFlagEntry>> {
    // 检查缓存
    const expiry = this.cacheExpiry.get(storeId);
    if (expiry && Date.now() < expiry && this.cache.has(storeId)) {
      return this.cache.get(storeId)!;
    }

    // 从数据库加载
    if (!this.prisma) throw new Error('FeatureFlagService not initialized');

    const rows = await this.prisma.featureFlag.findMany({
      where: { storeId },
    });

    const flagMap = new Map<string, FeatureFlagEntry>();
    for (const row of rows) {
      flagMap.set(row.flagKey, {
        storeId: row.storeId,
        flagKey: row.flagKey,
        enabled: row.enabled,
        config: row.config ? JSON.parse(row.config as string) : null,
      });
    }

    // 更新缓存
    this.cache.set(storeId, flagMap);
    this.cacheExpiry.set(storeId, Date.now() + this.CACHE_TTL);

    return flagMap;
  }

  /**
   * 清除某门店的缓存
   */
  invalidateCache(storeId: number): void {
    this.cache.delete(storeId);
    this.cacheExpiry.delete(storeId);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

// 单例导出
export const featureFlagService = new FeatureFlagService();
