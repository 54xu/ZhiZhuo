/**
 * 提成服务
 * - 监听结账事件自动计算提成
 * - 提成查询（按技师/时间段）
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { eventBus, Events } from '../../core/event-bus';

export class CommissionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 初始化：注册事件监听
   */
  registerEvents(): void {
    eventBus.on(Events.ORDER_CHECKOUT_SUCCESS, async (data) => {
      await this.calculateCommission(data);
    }, 'commission');
  }

  /**
   * 计算并记录提成（结账事件处理器）
   */
  private async calculateCommission(eventData: {
    storeId: number;
    orderId: number;
    orderItems: Array<{
      id: number;
      serviceId: number;
      technicianId: number;
      unitPrice: string;
      subtotal: string;
      isVisitCard: boolean;
    }>;
  }) {
    const { storeId, orderId, orderItems } = eventData;

    // 加载该门店所有有效提成规则
    const rules = await this.prisma.commissionRule.findMany({
      where: { storeId, status: 'active' },
    });

    const records: Array<{
      storeId: number;
      technicianId: number;
      orderId: number;
      orderItemId: number;
      serviceId: number;
      serviceAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
      commissionDate: Date;
    }> = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const item of orderItems) {
      const serviceAmount = new Prisma.Decimal(item.subtotal);
      if (serviceAmount.isZero()) continue; // 次卡抵扣不计提成

      // 查找匹配的规则：先找特定技师规则，再找通用规则
      const specificRule = rules.find(
        (r: typeof rules[number]) => r.serviceId === item.serviceId && r.technicianId === item.technicianId,
      );
      const generalRule = rules.find(
        (r: typeof rules[number]) => r.serviceId === item.serviceId && r.technicianId === null,
      );
      const rule = specificRule || generalRule;

      if (!rule) continue; // 无规则则不计提成

      let commissionAmount: Prisma.Decimal;
      if (rule.commissionType === 'fixed') {
        commissionAmount = rule.commissionValue;
      } else {
        // percentage: commissionValue 代表百分比，如 30 表示 30%
        commissionAmount = serviceAmount.mul(rule.commissionValue).div(100);
      }

      records.push({
        storeId,
        technicianId: item.technicianId,
        orderId,
        orderItemId: item.id,
        serviceId: item.serviceId,
        serviceAmount,
        commissionAmount,
        commissionDate: today,
      });
    }

    if (records.length > 0) {
      await this.prisma.commissionRecord.createMany({ data: records });
    }
  }

  /**
   * 查询提成汇总（按技师分组）
   */
  async getSummary(storeId: number, startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const records = await this.prisma.commissionRecord.findMany({
      where: {
        storeId,
        commissionDate: { gte: start, lte: end },
        status: 'normal',
      },
      include: {
        technician: { select: { id: true, name: true, employeeNo: true } },
      },
    });

    // 按技师分组
    const techMap = new Map<number, {
      technician: { id: number; name: string; employeeNo: string };
      totalServiceAmount: Prisma.Decimal;
      totalCommission: Prisma.Decimal;
      orderCount: number;
    }>();

    const orderSets = new Map<number, Set<number>>();

    for (const r of records) {
      if (!techMap.has(r.technicianId)) {
        techMap.set(r.technicianId, {
          technician: r.technician,
          totalServiceAmount: new Prisma.Decimal(0),
          totalCommission: new Prisma.Decimal(0),
          orderCount: 0,
        });
        orderSets.set(r.technicianId, new Set());
      }
      const entry = techMap.get(r.technicianId)!;
      entry.totalServiceAmount = entry.totalServiceAmount.add(r.serviceAmount);
      entry.totalCommission = entry.totalCommission.add(r.commissionAmount);
      orderSets.get(r.technicianId)!.add(r.orderId);
    }

    // 计算订单数
    for (const [techId, entry] of techMap) {
      entry.orderCount = orderSets.get(techId)!.size;
    }

    return Array.from(techMap.values()).sort(
      (a, b) => b.totalCommission.toNumber() - a.totalCommission.toNumber(),
    );
  }

  /**
   * 查询某技师提成明细
   */
  async getTechnicianDetail(storeId: number, technicianId: number, startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.prisma.commissionRecord.findMany({
      where: {
        storeId,
        technicianId,
        commissionDate: { gte: start, lte: end },
        status: 'normal',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNo: true, actualAmount: true, createdAt: true } },
      },
    });
  }
}
