/**
 * 报表服务
 * 经营简报 / 营收统计 / 技师业绩 / 会员统计 / 充值统计 / 收银对账
 */

import { PrismaClient, Prisma } from '@prisma/client';

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  /** 辅助：构建日期范围 where 条件 */
  private dateRange(start: string, end: string) {
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(23, 59, 59, 999);
    return { gte: s, lte: e };
  }

  /**
   * 今日经营简报
   */
  async getDashboard(storeId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const range = { gte: today, lt: tomorrow };

    const [
      todayOrders,
      todayRevenue,
      todayMembers,
      todayRecharges,
      roomStats,
    ] = await Promise.all([
      // 今日订单数
      this.prisma.order.count({
        where: { storeId, orderStatus: 'completed', endTime: range },
      }),
      // 今日营收（实收）
      this.prisma.order.aggregate({
        where: { storeId, orderStatus: 'completed', endTime: range },
        _sum: { actualAmount: true },
      }),
      // 今日新增会员
      this.prisma.member.count({
        where: { storeId, createdAt: range },
      }),
      // 今日充值
      this.prisma.rechargeRecord.aggregate({
        where: { storeId, createdAt: range },
        _sum: { payAmount: true, giftAmount: true },
        _count: true,
      }),
      // 房台状态统计
      this.prisma.room.groupBy({
        by: ['currentStatus'],
        where: { storeId, status: 'active' },
        _count: true,
      }),
    ]);

    const revenue = todayRevenue._sum.actualAmount ?? new Prisma.Decimal(0);
    const avgOrderAmount = todayOrders > 0
      ? revenue.div(todayOrders)
      : new Prisma.Decimal(0);

    // 会员消费占比
    const memberOrders = await this.prisma.order.count({
      where: { storeId, orderStatus: 'completed', endTime: range, memberId: { not: null } },
    });
    const memberRatio = todayOrders > 0 ? (memberOrders / todayOrders * 100).toFixed(1) : '0';

    return {
      revenue: revenue.toString(),
      orderCount: todayOrders,
      avgOrderAmount: avgOrderAmount.toFixed(2),
      memberRatio: `${memberRatio}%`,
      newMembers: todayMembers,
      rechargeAmount: (todayRecharges._sum.payAmount ?? new Prisma.Decimal(0)).toString(),
      rechargeGift: (todayRecharges._sum.giftAmount ?? new Prisma.Decimal(0)).toString(),
      rechargeCount: todayRecharges._count,
      roomStats: roomStats.reduce((acc: Record<string, number>, r) => {
        acc[r.currentStatus] = r._count;
        return acc;
      }, {}),
    };
  }

  /**
   * 营收统计（按日期范围）
   */
  async getRevenue(storeId: number, startDate: string, endDate: string) {
    const range = this.dateRange(startDate, endDate);

    // 总体汇总
    const summary = await this.prisma.order.aggregate({
      where: { storeId, orderStatus: 'completed', endTime: range },
      _sum: { totalAmount: true, discountAmount: true, actualAmount: true },
      _count: true,
    });

    // 按支付方式分组
    const paymentBreakdown = await this.prisma.payment.groupBy({
      by: ['paymentType'],
      where: {
        order: { storeId, orderStatus: 'completed', endTime: range },
        status: 'success',
      },
      _sum: { amount: true },
      _count: true,
    });

    // 按日汇总（用原始SQL或逐日查询）
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dailyData: Array<{ date: string; revenue: string; orderCount: number }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

      const day = await this.prisma.order.aggregate({
        where: { storeId, orderStatus: 'completed', endTime: { gte: dayStart, lte: dayEnd } },
        _sum: { actualAmount: true },
        _count: true,
      });

      dailyData.push({
        date: d.toISOString().split('T')[0],
        revenue: (day._sum.actualAmount ?? new Prisma.Decimal(0)).toString(),
        orderCount: day._count,
      });
    }

    return {
      summary: {
        totalAmount: (summary._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        discountAmount: (summary._sum.discountAmount ?? new Prisma.Decimal(0)).toString(),
        actualAmount: (summary._sum.actualAmount ?? new Prisma.Decimal(0)).toString(),
        orderCount: summary._count,
      },
      paymentBreakdown: paymentBreakdown.map((p) => ({
        paymentType: p.paymentType,
        amount: (p._sum.amount ?? new Prisma.Decimal(0)).toString(),
        count: p._count,
      })),
      dailyData,
    };
  }

  /**
   * 技师业绩报表
   */
  async getStaffPerformance(storeId: number, startDate: string, endDate: string) {
    const range = this.dateRange(startDate, endDate);

    const records = await this.prisma.commissionRecord.findMany({
      where: { storeId, commissionDate: range, status: 'normal' },
      include: {
        technician: { select: { id: true, name: true, employeeNo: true } },
      },
    });

    const techMap = new Map<number, {
      technician: { id: number; name: string; employeeNo: string };
      serviceCount: number;
      serviceAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
      orderIds: Set<number>;
    }>();

    for (const r of records) {
      if (!techMap.has(r.technicianId)) {
        techMap.set(r.technicianId, {
          technician: r.technician,
          serviceCount: 0,
          serviceAmount: new Prisma.Decimal(0),
          commissionAmount: new Prisma.Decimal(0),
          orderIds: new Set(),
        });
      }
      const entry = techMap.get(r.technicianId)!;
      entry.serviceCount += 1;
      entry.serviceAmount = entry.serviceAmount.add(r.serviceAmount);
      entry.commissionAmount = entry.commissionAmount.add(r.commissionAmount);
      entry.orderIds.add(r.orderId);
    }

    return Array.from(techMap.values())
      .map((e) => ({
        ...e.technician,
        serviceCount: e.serviceCount,
        orderCount: e.orderIds.size,
        serviceAmount: e.serviceAmount.toString(),
        commissionAmount: e.commissionAmount.toString(),
      }))
      .sort((a, b) => parseFloat(b.serviceAmount) - parseFloat(a.serviceAmount));
  }

  /**
   * 会员统计
   */
  async getMemberStats(storeId: number, startDate: string, endDate: string) {
    const range = this.dateRange(startDate, endDate);

    const [totalMembers, newMembers, activeMembers, memberConsume] = await Promise.all([
      this.prisma.member.count({ where: { storeId, status: 'active' } }),
      this.prisma.member.count({ where: { storeId, createdAt: range } }),
      this.prisma.member.count({ where: { storeId, lastVisitAt: range } }),
      this.prisma.order.aggregate({
        where: { storeId, memberId: { not: null }, orderStatus: 'completed', endTime: range },
        _sum: { actualAmount: true },
        _count: true,
      }),
    ]);

    return {
      totalMembers,
      newMembers,
      activeMembers,
      memberConsumeAmount: (memberConsume._sum.actualAmount ?? new Prisma.Decimal(0)).toString(),
      memberOrderCount: memberConsume._count,
    };
  }

  /**
   * 充值统计
   */
  async getRechargeStats(storeId: number, startDate: string, endDate: string) {
    const range = this.dateRange(startDate, endDate);

    const summary = await this.prisma.rechargeRecord.aggregate({
      where: { storeId, createdAt: range },
      _sum: { payAmount: true, giftAmount: true, totalAmount: true },
      _count: true,
    });

    // 按方案类型分组
    const byType = await this.prisma.rechargeRecord.groupBy({
      by: ['planType'],
      where: { storeId, createdAt: range },
      _sum: { payAmount: true, giftAmount: true },
      _count: true,
    });

    return {
      summary: {
        payAmount: (summary._sum.payAmount ?? new Prisma.Decimal(0)).toString(),
        giftAmount: (summary._sum.giftAmount ?? new Prisma.Decimal(0)).toString(),
        totalAmount: (summary._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        count: summary._count,
      },
      byType: byType.map((t) => ({
        planType: t.planType,
        payAmount: (t._sum.payAmount ?? new Prisma.Decimal(0)).toString(),
        giftAmount: (t._sum.giftAmount ?? new Prisma.Decimal(0)).toString(),
        count: t._count,
      })),
    };
  }

  /**
   * 收银对账（按收银员统计）
   */
  async getReconciliation(storeId: number, date: string) {
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: { storeId, orderStatus: 'completed', endTime: { gte: dayStart, lte: dayEnd } },
      include: {
        cashier: { select: { id: true, name: true, employeeNo: true } },
        payments: { where: { status: 'success' } },
      },
    });

    const cashierMap = new Map<number, {
      cashier: { id: number; name: string; employeeNo: string };
      orderCount: number;
      totalAmount: Prisma.Decimal;
      paymentBreakdown: Map<string, Prisma.Decimal>;
    }>();

    for (const order of orders) {
      if (!cashierMap.has(order.cashierId)) {
        cashierMap.set(order.cashierId, {
          cashier: order.cashier,
          orderCount: 0,
          totalAmount: new Prisma.Decimal(0),
          paymentBreakdown: new Map(),
        });
      }
      const entry = cashierMap.get(order.cashierId)!;
      entry.orderCount += 1;
      entry.totalAmount = entry.totalAmount.add(order.actualAmount);

      for (const p of order.payments) {
        const current = entry.paymentBreakdown.get(p.paymentType) ?? new Prisma.Decimal(0);
        entry.paymentBreakdown.set(p.paymentType, current.add(p.amount));
      }
    }

    return Array.from(cashierMap.values()).map((e) => ({
      ...e.cashier,
      orderCount: e.orderCount,
      totalAmount: e.totalAmount.toString(),
      paymentBreakdown: Object.fromEntries(
        Array.from(e.paymentBreakdown.entries()).map(([k, v]) => [k, v.toString()]),
      ),
    }));
  }
}
