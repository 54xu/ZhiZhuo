/**
 * 收银服务 - 开单 / 加单 / 结账
 *
 * 结账流程使用 HookRegistry 完整钩子链：
 *   validate → before → [核心结账逻辑] → after
 * 关键事件通过 EventBus 发布，供提成等模块监听
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { eventBus, Events } from '../../core/event-bus';
import { hookRegistry, HookPoints, HookContext } from '../../core/hook-registry';

export class CashierService {
  constructor(private prisma: PrismaClient) {}

  /** 生成订单号：ZZ + 年月日时分秒 + 4位随机 */
  private generateOrderNo(): string {
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `ZZ${ts}${rand}`;
  }

  /**
   * 开单
   */
  async createOrder(storeId: number, data: {
    roomId: number;
    memberId?: number;
    customerName?: string;
    customerPhone?: string;
    cashierId: number;
    items: Array<{
      serviceId: number;
      technicianId: number;
      quantity?: number;
      isVisitCard?: boolean;
    }>;
  }) {
    // 验证房台状态
    const room = await this.prisma.room.findFirst({
      where: { id: data.roomId, storeId, status: 'active' },
    });
    if (!room) throw new Error('房台不存在');
    if (room.currentStatus === 'in_use') {
      throw new Error('该房台已被占用');
    }

    // 构建钩子上下文
    const context: HookContext = {
      data: { ...data, storeId },
      meta: { storeId, operatorId: data.cashierId },
      shared: {},
    };

    // 执行开单钩子链
    await hookRegistry.execute(HookPoints.CASHIER_CREATE_ORDER, 'validate', context);
    await hookRegistry.execute(HookPoints.CASHIER_CREATE_ORDER, 'before', context);

    // 获取服务价格
    const serviceIds = data.items.map((i) => i.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, storeId },
    });
    const serviceMap = new Map(services.map((s: typeof services[number]) => [s.id, s]));

    // 查询会员（如有）
    let isMember = false;
    if (data.memberId) {
      const member = await this.prisma.member.findFirst({
        where: { id: data.memberId, storeId },
      });
      if (!member) throw new Error('会员不存在');
      isMember = true;
    }

    const orderNo = this.generateOrderNo();

    const result = await this.prisma.$transaction(async (tx) => {
      // 计算每个项目的价格
      const orderItems: Array<{
        serviceId: number;
        technicianId: number;
        quantity: number;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
        isVisitCard: boolean;
        visitCardId: number | null;
      }> = [];

      for (const item of data.items) {
        const service = serviceMap.get(item.serviceId);
        if (!service) throw new Error(`服务项目 ${item.serviceId} 不存在`);

        const qty = item.quantity ?? 1;
        let unitPrice: Prisma.Decimal;
        let isVisitCard = false;
        let visitCardId: number | null = null;

        if (item.isVisitCard && data.memberId) {
          // 次卡抵扣
          const account = await tx.visitCardAccount.findFirst({
            where: {
              memberId: data.memberId,
              serviceId: item.serviceId,
              remainingCount: { gt: 0 },
            },
          });
          if (!account || account.remainingCount < qty) {
            throw new Error(`服务「${service.name}」次卡余额不足`);
          }
          // 扣减次卡
          await tx.visitCardAccount.update({
            where: { id: account.id },
            data: {
              usedCount: { increment: qty },
              remainingCount: { decrement: qty },
            },
          });
          unitPrice = new Prisma.Decimal(0);
          isVisitCard = true;
          visitCardId = account.id;
        } else {
          // 会员价或原价
          unitPrice = (isMember && service.memberPrice) ? service.memberPrice : service.price;
        }

        const subtotal = unitPrice.mul(qty);
        orderItems.push({
          serviceId: item.serviceId,
          technicianId: item.technicianId,
          quantity: qty,
          unitPrice,
          subtotal,
          isVisitCard,
          visitCardId,
        });
      }

      const totalAmount = orderItems.reduce(
        (sum, i) => sum.add(i.subtotal), new Prisma.Decimal(0),
      );

      // 创建订单
      const order = await tx.order.create({
        data: {
          storeId,
          orderNo,
          roomId: data.roomId,
          memberId: data.memberId ?? null,
          customerName: data.customerName ?? null,
          customerPhone: data.customerPhone ?? null,
          orderStatus: 'in_progress',
          totalAmount,
          actualAmount: totalAmount,
          cashierId: data.cashierId,
          startTime: new Date(),
          orderItems: {
            create: orderItems.map((oi) => ({
              serviceId: oi.serviceId,
              technicianId: oi.technicianId,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              subtotal: oi.subtotal,
              isVisitCard: oi.isVisitCard,
              visitCardId: oi.visitCardId,
            })),
          },
        },
        include: { orderItems: true },
      });

      // 更新房台状态
      await tx.room.update({
        where: { id: data.roomId },
        data: { currentStatus: 'in_use' },
      });

      return order;
    });

    // 发布事件
    await eventBus.emit(Events.ORDER_CREATED, {
      storeId,
      orderId: result.id,
      orderNo: result.orderNo,
      roomId: data.roomId,
      memberId: data.memberId,
    });

    await eventBus.emit(Events.ROOM_STATUS_CHANGED, {
      roomId: data.roomId,
      storeId,
      previousStatus: room.currentStatus,
      newStatus: 'in_use',
    });

    await hookRegistry.execute(HookPoints.CASHIER_CREATE_ORDER, 'after', context);

    return result;
  }

  /**
   * 加单 / 改单 - 给已有订单添加服务项目
   */
  async addOrderItems(storeId: number, orderId: number, items: Array<{
    serviceId: number;
    technicianId: number;
    quantity?: number;
    isVisitCard?: boolean;
  }>) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId, orderStatus: { in: ['pending', 'in_progress'] } },
    });
    if (!order) throw new Error('订单不存在或已结账');

    const serviceIds = items.map((i) => i.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, storeId },
    });
    const serviceMap = new Map(services.map((s: typeof services[number]) => [s.id, s]));
    const isMember = !!order.memberId;

    return this.prisma.$transaction(async (tx) => {
      let addedTotal = new Prisma.Decimal(0);

      for (const item of items) {
        const service = serviceMap.get(item.serviceId);
        if (!service) throw new Error(`服务项目 ${item.serviceId} 不存在`);
        const qty = item.quantity ?? 1;
        const unitPrice = (isMember && service.memberPrice) ? service.memberPrice : service.price;
        const subtotal = unitPrice.mul(qty);

        await tx.orderItem.create({
          data: {
            orderId,
            serviceId: item.serviceId,
            technicianId: item.technicianId,
            quantity: qty,
            unitPrice,
            subtotal,
            isVisitCard: item.isVisitCard ?? false,
          },
        });
        addedTotal = addedTotal.add(subtotal);
      }

      // 更新订单总额
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          totalAmount: { increment: addedTotal },
          actualAmount: { increment: addedTotal },
        },
        include: { orderItems: true },
      });

      return updated;
    });
  }

  /**
   * 结账 - 完整钩子链
   *
   * validate → before（V2优惠券/积分修改context.data中的折扣字段）
   *          → 核心逻辑（计算实收、扣减余额、创建支付记录）
   *          → after（V2积分计算获得积分、标记券已用等）
   */
  async checkout(storeId: number, orderId: number, data: {
    paymentType: string; // cash / wechat / member_balance / combined
    operatorId: number;
    payments?: Array<{ type: string; amount: number }>; // 组合支付明细
  }) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId, orderStatus: { in: ['pending', 'in_progress'] } },
      include: {
        orderItems: {
          include: {
            service: true,
            technician: { select: { id: true, name: true } },
          },
        },
        member: true,
      },
    });
    if (!order) throw new Error('订单不存在或已结账');

    // 构建钩子上下文
    const context: HookContext = {
      data: {
        orderId,
        order,
        paymentType: data.paymentType,
        totalAmount: order.totalAmount.toString(),
        discountAmount: '0',        // V2钩子可修改（优惠券折扣）
        couponDiscount: '0',         // V2
        pointsDiscount: '0',         // V2
        levelDiscount: '0',          // V3
        actualAmount: order.totalAmount.toString(),
      },
      meta: { storeId, operatorId: data.operatorId },
      shared: {},
    };

    // validate → before（V2/V3模块在此阶段修改 context.data 中的折扣）
    await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'validate', context);
    await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'before', context);

    // 核心结账逻辑
    const totalAmount = new Prisma.Decimal(context.data.totalAmount);
    const discountAmount = new Prisma.Decimal(context.data.discountAmount)
      .add(new Prisma.Decimal(context.data.couponDiscount))
      .add(new Prisma.Decimal(context.data.pointsDiscount))
      .add(new Prisma.Decimal(context.data.levelDiscount));
    const actualAmount = totalAmount.sub(discountAmount);

    const result = await this.prisma.$transaction(async (tx) => {
      // 处理支付
      if (data.paymentType === 'member_balance' && order.memberId) {
        // 会员余额支付
        const member = await tx.member.findUnique({ where: { id: order.memberId } });
        if (!member || member.balance.lessThan(actualAmount)) {
          throw new Error('会员余额不足');
        }
        // 优先扣赠送余额，再扣实充余额
        let remaining = actualAmount;
        let giftDeduct = Prisma.Decimal.min(member.giftBalance, remaining);
        remaining = remaining.sub(giftDeduct);
        let realDeduct = remaining;

        await tx.member.update({
          where: { id: order.memberId },
          data: {
            balance: { decrement: actualAmount },
            realBalance: { decrement: realDeduct },
            giftBalance: { decrement: giftDeduct },
            lastVisitAt: new Date(),
          },
        });
      } else if (order.memberId) {
        // 非余额支付的会员也更新最后到店
        await tx.member.update({
          where: { id: order.memberId },
          data: { lastVisitAt: new Date() },
        });
      }

      // 创建支付记录
      if (data.paymentType === 'combined' && data.payments) {
        for (const p of data.payments) {
          await tx.payment.create({
            data: {
              orderId,
              paymentType: p.type,
              amount: p.amount,
              status: 'success',
              operatorId: data.operatorId,
            },
          });
        }
      } else {
        await tx.payment.create({
          data: {
            orderId,
            paymentType: data.paymentType,
            amount: actualAmount,
            status: 'success',
            operatorId: data.operatorId,
          },
        });
      }

      // 更新订单状态
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: 'completed',
          discountAmount,
          actualAmount,
          endTime: new Date(),
          // V2预留字段
          couponDiscount: context.data.couponDiscount !== '0'
            ? new Prisma.Decimal(context.data.couponDiscount) : null,
          pointsUsed: context.data.pointsUsed ?? null,
          pointsDiscount: context.data.pointsDiscount !== '0'
            ? new Prisma.Decimal(context.data.pointsDiscount) : null,
          levelDiscount: context.data.levelDiscount !== '0'
            ? new Prisma.Decimal(context.data.levelDiscount) : null,
        },
      });

      // 释放房台
      await tx.room.update({
        where: { id: order.roomId },
        data: { currentStatus: 'pending_clean' },
      });

      return updated;
    });

    // 发布结账成功事件（提成模块监听此事件计算提成）
    await eventBus.emit(Events.ORDER_CHECKOUT_SUCCESS, {
      storeId,
      orderId,
      orderNo: order.orderNo,
      memberId: order.memberId,
      totalAmount: totalAmount.toString(),
      actualAmount: actualAmount.toString(),
      paymentType: data.paymentType,
      orderItems: order.orderItems.map((oi: typeof order.orderItems[number]) => ({
        id: oi.id,
        serviceId: oi.serviceId,
        technicianId: oi.technicianId,
        unitPrice: oi.unitPrice.toString(),
        subtotal: oi.subtotal.toString(),
        isVisitCard: oi.isVisitCard,
      })),
    });

    await eventBus.emit(Events.ROOM_STATUS_CHANGED, {
      roomId: order.roomId,
      storeId,
      previousStatus: 'in_use',
      newStatus: 'pending_clean',
    });

    // after 钩子（V2积分计算等）
    context.data.result = result;
    await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'after', context);

    return result;
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail(storeId: number, orderId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        room: { select: { id: true, name: true } },
        member: { select: { id: true, cardNo: true, name: true, phone: true } },
        cashier: { select: { id: true, name: true } },
        orderItems: {
          include: {
            service: { select: { id: true, name: true, duration: true } },
            technician: { select: { id: true, name: true } },
          },
        },
        payments: true,
      },
    });
    if (!order) throw new Error('订单不存在');
    return order;
  }

  /**
   * 今日客表
   */
  async getTodayCustomers(storeId: number, status?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      storeId,
      createdAt: { gte: today, lt: tomorrow },
    };
    if (status) where.orderStatus = status;

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        room: { select: { name: true } },
        member: { select: { id: true, name: true, phone: true } },
        orderItems: {
          include: {
            service: { select: { name: true } },
            technician: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * 退款 / 反结账
   */
  async refund(storeId: number, orderId: number, operatorId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId, orderStatus: 'completed' },
      include: {
        orderItems: true,
        payments: { where: { status: 'success' } },
      },
    });
    if (!order) throw new Error('订单不存在或未结账');

    await this.prisma.$transaction(async (tx) => {
      // 标记订单退款
      await tx.order.update({
        where: { id: orderId },
        data: { orderStatus: 'refunded' },
      });

      // 退还支付
      for (const payment of order.payments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded' },
        });

        // 如果是会员余额支付，退还余额
        if (payment.paymentType === 'member_balance' && order.memberId) {
          await tx.member.update({
            where: { id: order.memberId },
            data: {
              balance: { increment: payment.amount },
              realBalance: { increment: payment.amount },
            },
          });
        }
      }

      // 退还次卡
      for (const item of order.orderItems) {
        if (item.isVisitCard && item.visitCardId) {
          await tx.visitCardAccount.update({
            where: { id: item.visitCardId },
            data: {
              usedCount: { decrement: item.quantity },
              remainingCount: { increment: item.quantity },
            },
          });
        }
      }

      // 冲正提成
      await tx.commissionRecord.updateMany({
        where: { orderId, status: 'normal' },
        data: { status: 'reversed' },
      });
    });

    // 发布退款事件
    await eventBus.emit(Events.ORDER_REFUNDED, {
      storeId,
      orderId,
      orderNo: order.orderNo,
      memberId: order.memberId,
    });

    // 记录操作日志
    await this.prisma.operationLog.create({
      data: {
        storeId,
        operatorId,
        action: 'refund',
        targetType: 'order',
        targetId: orderId,
        detail: JSON.stringify({ orderNo: order.orderNo, amount: order.actualAmount.toString() }),
      },
    });
  }
}
