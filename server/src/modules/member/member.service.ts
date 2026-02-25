/**
 * 会员服务
 * 注册、查询、充值、余额/次卡扣减
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { eventBus, Events } from '../../core/event-bus';

export class MemberService {
  constructor(private prisma: PrismaClient) {}

  /** 生成会员卡号：M + 8位数字 */
  private async generateCardNo(storeId: number): Promise<string> {
    const last = await this.prisma.member.findFirst({
      where: { storeId },
      orderBy: { id: 'desc' },
      select: { cardNo: true },
    });
    const nextNum = last ? parseInt(last.cardNo.substring(1), 10) + 1 : 10000001;
    return `M${nextNum}`;
  }

  /** 会员注册 */
  async register(storeId: number, data: {
    phone: string;
    name?: string;
    gender?: string;
    birthday?: string;
    remark?: string;
  }) {
    // 检查手机号唯一
    const exists = await this.prisma.member.findFirst({
      where: { storeId, phone: data.phone },
    });
    if (exists) {
      throw new Error('该手机号已注册');
    }

    const cardNo = await this.generateCardNo(storeId);

    const member = await this.prisma.member.create({
      data: {
        storeId,
        cardNo,
        phone: data.phone,
        name: data.name ?? null,
        gender: data.gender ?? null,
        birthday: data.birthday ? new Date(data.birthday) : null,
        remark: data.remark ?? null,
      },
    });

    await eventBus.emit(Events.MEMBER_REGISTERED, { storeId, memberId: member.id });

    return member;
  }

  /** 会员搜索（手机号/姓名/卡号模糊匹配） */
  async search(storeId: number, keyword: string, page = 1, pageSize = 20) {
    const where: Prisma.MemberWhereInput = {
      storeId,
      status: 'active',
      OR: [
        { phone: { contains: keyword } },
        { name: { contains: keyword } },
        { cardNo: { contains: keyword } },
      ],
    };

    const [list, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        orderBy: { lastVisitAt: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, cardNo: true, phone: true, name: true, gender: true,
          balance: true, realBalance: true, giftBalance: true,
          status: true, lastVisitAt: true, remark: true,
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  /** 会员详情 */
  async getDetail(storeId: number, memberId: number) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, storeId },
      include: {
        visitCardAccounts: {
          where: { remainingCount: { gt: 0 } },
          include: { service: { select: { id: true, name: true } } },
        },
      },
    });
    if (!member) throw new Error('会员不存在');
    return member;
  }

  /** 更新会员信息 */
  async update(storeId: number, memberId: number, data: {
    name?: string;
    gender?: string;
    birthday?: string;
    remark?: string;
    phone?: string;
  }) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, storeId },
    });
    if (!member) throw new Error('会员不存在');

    // 手机号变更时检查唯一性
    if (data.phone && data.phone !== member.phone) {
      const phoneExists = await this.prisma.member.findFirst({
        where: { storeId, phone: data.phone, id: { not: memberId } },
      });
      if (phoneExists) throw new Error('该手机号已被其他会员使用');
    }

    return this.prisma.member.update({
      where: { id: memberId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.birthday !== undefined && { birthday: data.birthday ? new Date(data.birthday) : null }),
        ...(data.remark !== undefined && { remark: data.remark }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });
  }

  /**
   * 金额充值
   * 实付 payAmount + 赠送 giftAmount = 总到账
   */
  async rechargeAmount(storeId: number, data: {
    memberId: number;
    planId: number;
    paymentMethod: string;
    operatorId: number;
    remark?: string;
  }) {
    const plan = await this.prisma.rechargePlan.findFirst({
      where: { id: data.planId, storeId, planType: 'amount', status: 'active' },
    });
    if (!plan) throw new Error('充值方案不存在');

    const payAmount = plan.payAmount;
    const giftAmount = plan.giftAmount;
    const totalAmount = new Prisma.Decimal(payAmount.toString()).add(new Prisma.Decimal(giftAmount.toString()));

    // 事务：创建充值记录 + 更新会员余额 + 创建支付记录
    const result = await this.prisma.$transaction(async (tx) => {
      // 更新会员余额
      const member = await tx.member.update({
        where: { id: data.memberId },
        data: {
          balance: { increment: totalAmount },
          realBalance: { increment: payAmount },
          giftBalance: { increment: giftAmount },
        },
      });

      // 创建充值记录
      const record = await tx.rechargeRecord.create({
        data: {
          storeId,
          memberId: data.memberId,
          planId: data.planId,
          planType: 'amount',
          payAmount,
          giftAmount,
          totalAmount,
          paymentMethod: data.paymentMethod,
          operatorId: data.operatorId,
          remark: data.remark ?? null,
        },
      });

      // 创建支付记录
      await tx.payment.create({
        data: {
          rechargeId: record.id,
          paymentType: data.paymentMethod,
          amount: payAmount,
          status: 'success',
          operatorId: data.operatorId,
        },
      });

      return { record, member };
    });

    await eventBus.emit(Events.MEMBER_RECHARGED, {
      storeId,
      memberId: data.memberId,
      planId: data.planId,
      planType: 'amount',
      payAmount: payAmount.toString(),
      giftAmount: giftAmount.toString(),
    });

    return result;
  }

  /**
   * 次卡充值
   * 购买次数 buyCount + 赠送次数 giftCount
   */
  async rechargeVisitCard(storeId: number, data: {
    memberId: number;
    planId: number;
    paymentMethod: string;
    operatorId: number;
    remark?: string;
  }) {
    const plan = await this.prisma.rechargePlan.findFirst({
      where: { id: data.planId, storeId, planType: 'visit', status: 'active' },
    });
    if (!plan || !plan.serviceId || !plan.buyCount) {
      throw new Error('次卡充值方案不存在或配置不完整');
    }

    const totalCount = plan.buyCount + (plan.giftCount ?? 0);

    const result = await this.prisma.$transaction(async (tx) => {
      // 查找或创建次卡账户
      let account = await tx.visitCardAccount.findFirst({
        where: { memberId: data.memberId, serviceId: plan.serviceId! },
      });

      if (account) {
        account = await tx.visitCardAccount.update({
          where: { id: account.id },
          data: {
            totalCount: { increment: totalCount },
            remainingCount: { increment: totalCount },
          },
        });
      } else {
        account = await tx.visitCardAccount.create({
          data: {
            memberId: data.memberId,
            serviceId: plan.serviceId!,
            totalCount,
            remainingCount: totalCount,
            sourcePlanId: data.planId,
          },
        });
      }

      // 充值记录
      const record = await tx.rechargeRecord.create({
        data: {
          storeId,
          memberId: data.memberId,
          planId: data.planId,
          planType: 'visit',
          payAmount: plan.payAmount,
          giftAmount: plan.giftAmount,
          totalAmount: plan.payAmount,
          paymentMethod: data.paymentMethod,
          operatorId: data.operatorId,
          remark: data.remark ?? null,
        },
      });

      // 支付记录
      await tx.payment.create({
        data: {
          rechargeId: record.id,
          paymentType: data.paymentMethod,
          amount: plan.payAmount,
          status: 'success',
          operatorId: data.operatorId,
        },
      });

      return { record, account };
    });

    await eventBus.emit(Events.MEMBER_RECHARGED, {
      storeId,
      memberId: data.memberId,
      planId: data.planId,
      planType: 'visit',
      payAmount: plan.payAmount.toString(),
    });

    return result;
  }

  /** 获取会员消费记录 */
  async getConsumeRecords(storeId: number, memberId: number, page = 1, pageSize = 20) {
    const where = { storeId, memberId };
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, orderNo: true, orderStatus: true,
          totalAmount: true, discountAmount: true, actualAmount: true,
          startTime: true, endTime: true, createdAt: true,
          room: { select: { name: true } },
          orderItems: {
            select: {
              service: { select: { name: true } },
              technician: { select: { name: true } },
              unitPrice: true, quantity: true, isVisitCard: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /** 获取会员充值记录 */
  async getRechargeRecords(storeId: number, memberId: number, page = 1, pageSize = 20) {
    const where = { storeId, memberId };
    const [list, total] = await Promise.all([
      this.prisma.rechargeRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.rechargeRecord.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /** 最近到访会员列表（首页使用） */
  async getRecentMembers(storeId: number, limit = 10) {
    return this.prisma.member.findMany({
      where: { storeId, status: 'active', lastVisitAt: { not: null } },
      orderBy: { lastVisitAt: 'desc' },
      take: limit,
      select: {
        id: true, cardNo: true, phone: true, name: true,
        balance: true, lastVisitAt: true,
      },
    });
  }
}
