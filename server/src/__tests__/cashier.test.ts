/**
 * Cashier service tests
 * Tests for createOrder, checkout, refund
 */

import { CashierService } from '../modules/cashier/cashier.service';
import { Prisma } from '@prisma/client';

// Mock eventBus and hookRegistry
jest.mock('../core/event-bus', () => ({
  eventBus: {
    emit: jest.fn().mockResolvedValue(undefined),
  },
  Events: {
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_CHECKOUT_SUCCESS: 'ORDER_CHECKOUT_SUCCESS',
    ORDER_REFUNDED: 'ORDER_REFUNDED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
    ROOM_STATUS_CHANGED: 'ROOM_STATUS_CHANGED',
  },
}));

jest.mock('../core/hook-registry', () => ({
  hookRegistry: {
    execute: jest.fn().mockResolvedValue(undefined),
  },
  HookPoints: {
    CASHIER_CHECKOUT: 'cashier.checkout',
    CASHIER_CREATE_ORDER: 'cashier.createOrder',
  },
}));

import { eventBus, Events } from '../core/event-bus';
import { hookRegistry, HookPoints } from '../core/hook-registry';

function createMockPrisma() {
  return {
    room: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
    member: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      update: jest.fn(),
    },
    visitCardAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    commissionRecord: {
      updateMany: jest.fn(),
    },
    operationLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
}

describe('CashierService', () => {
  let cashierService: CashierService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    cashierService = new CashierService(mockPrisma);
    (eventBus.emit as jest.Mock).mockClear();
    (hookRegistry.execute as jest.Mock).mockClear();
  });

  // ============================================================
  // createOrder
  // ============================================================
  describe('createOrder', () => {
    const baseOrderData = {
      roomId: 1,
      cashierId: 1,
      items: [
        { serviceId: 1, technicianId: 1, quantity: 1 },
      ],
    };

    it('should create an order successfully', async () => {
      // Room is available
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 1,
        storeId: 1,
        currentStatus: 'available',
        status: 'active',
      });

      // Service exists with price
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 1, name: 'Foot Massage', price: new Prisma.Decimal(198), memberPrice: new Prisma.Decimal(168), storeId: 1 },
      ]);

      const mockOrder = {
        id: 1,
        orderNo: 'ZZ202601010000001234',
        storeId: 1,
        roomId: 1,
        orderStatus: 'in_progress',
        totalAmount: new Prisma.Decimal(198),
        actualAmount: new Prisma.Decimal(198),
        orderItems: [
          { id: 1, serviceId: 1, technicianId: 1, quantity: 1, unitPrice: new Prisma.Decimal(198), subtotal: new Prisma.Decimal(198) },
        ],
      };

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
          },
          room: {
            update: jest.fn().mockResolvedValue({}),
          },
          visitCardAccount: {
            findFirst: jest.fn(),
            update: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await cashierService.createOrder(1, baseOrderData);

      expect(result.id).toBe(1);
      expect(result.orderStatus).toBe('in_progress');

      // Verify hook execution
      expect(hookRegistry.execute).toHaveBeenCalledWith(
        HookPoints.CASHIER_CREATE_ORDER, 'validate', expect.any(Object)
      );
      expect(hookRegistry.execute).toHaveBeenCalledWith(
        HookPoints.CASHIER_CREATE_ORDER, 'before', expect.any(Object)
      );

      // Verify events
      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.ORDER_CREATED,
        expect.objectContaining({ storeId: 1, orderId: 1, roomId: 1 })
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.ROOM_STATUS_CHANGED,
        expect.objectContaining({
          roomId: 1,
          previousStatus: 'available',
          newStatus: 'in_use',
        })
      );
    });

    it('should throw error when room does not exist', async () => {
      mockPrisma.room.findFirst.mockResolvedValue(null);

      await expect(
        cashierService.createOrder(1, baseOrderData)
      ).rejects.toThrow('房台不存在');
    });

    it('should throw error when room is already in use', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 1,
        storeId: 1,
        currentStatus: 'in_use',
        status: 'active',
      });

      await expect(
        cashierService.createOrder(1, baseOrderData)
      ).rejects.toThrow('该房台已被占用');
    });

    it('should update room status to in_use after order creation', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 1,
        storeId: 1,
        currentStatus: 'available',
        status: 'active',
      });
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 1, name: 'Foot Massage', price: new Prisma.Decimal(198), memberPrice: null, storeId: 1 },
      ]);

      const txRoomUpdate = jest.fn().mockResolvedValue({});
      const txOrderCreate = jest.fn().mockResolvedValue({
        id: 1,
        orderNo: 'ZZ20260101000001234',
        orderItems: [],
      });

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: { create: txOrderCreate },
          room: { update: txRoomUpdate },
          visitCardAccount: { findFirst: jest.fn(), update: jest.fn() },
        };
        return callback(tx);
      });

      await cashierService.createOrder(1, baseOrderData);

      expect(txRoomUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { currentStatus: 'in_use' },
      });
    });

    it('should throw error when a member does not exist', async () => {
      mockPrisma.room.findFirst.mockResolvedValue({
        id: 1,
        storeId: 1,
        currentStatus: 'available',
        status: 'active',
      });
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 1, name: 'Foot Massage', price: new Prisma.Decimal(198), memberPrice: null, storeId: 1 },
      ]);
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(
        cashierService.createOrder(1, {
          ...baseOrderData,
          memberId: 999,
        })
      ).rejects.toThrow('会员不存在');
    });
  });

  // ============================================================
  // checkout
  // ============================================================
  describe('checkout', () => {
    it('should checkout order with cash payment successfully', async () => {
      const mockOrder = {
        id: 1,
        storeId: 1,
        orderNo: 'ZZ20260101000001234',
        roomId: 1,
        memberId: null,
        orderStatus: 'in_progress',
        totalAmount: new Prisma.Decimal(198),
        actualAmount: new Prisma.Decimal(198),
        orderItems: [
          {
            id: 1,
            serviceId: 1,
            technicianId: 1,
            unitPrice: new Prisma.Decimal(198),
            subtotal: new Prisma.Decimal(198),
            isVisitCard: false,
            service: { id: 1, name: 'Foot Massage' },
            technician: { id: 1, name: 'Tech A' },
          },
        ],
        member: null,
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const updatedOrder = { ...mockOrder, orderStatus: 'completed' };

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: { findUnique: jest.fn(), update: jest.fn() },
          payment: { create: jest.fn().mockResolvedValue({}) },
          order: { update: jest.fn().mockResolvedValue(updatedOrder) },
          room: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const result = await cashierService.checkout(1, 1, {
        paymentType: 'cash',
        operatorId: 1,
      });

      expect(result.orderStatus).toBe('completed');

      // Verify hooks were executed
      expect(hookRegistry.execute).toHaveBeenCalledWith(
        HookPoints.CASHIER_CHECKOUT, 'validate', expect.any(Object)
      );
      expect(hookRegistry.execute).toHaveBeenCalledWith(
        HookPoints.CASHIER_CHECKOUT, 'before', expect.any(Object)
      );
      expect(hookRegistry.execute).toHaveBeenCalledWith(
        HookPoints.CASHIER_CHECKOUT, 'after', expect.any(Object)
      );

      // Verify events
      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.ORDER_CHECKOUT_SUCCESS,
        expect.objectContaining({ storeId: 1, orderId: 1 })
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.ROOM_STATUS_CHANGED,
        expect.objectContaining({
          roomId: 1,
          previousStatus: 'in_use',
          newStatus: 'pending_clean',
        })
      );
    });

    it('should deduct member balance when paying with member_balance', async () => {
      const mockOrder = {
        id: 2,
        storeId: 1,
        orderNo: 'ZZ20260101000002222',
        roomId: 2,
        memberId: 10,
        orderStatus: 'in_progress',
        totalAmount: new Prisma.Decimal(100),
        actualAmount: new Prisma.Decimal(100),
        orderItems: [
          {
            id: 1,
            serviceId: 1,
            technicianId: 1,
            unitPrice: new Prisma.Decimal(100),
            subtotal: new Prisma.Decimal(100),
            isVisitCard: false,
            service: { id: 1, name: 'Foot Massage' },
            technician: { id: 1, name: 'Tech A' },
          },
        ],
        member: { id: 10, balance: new Prisma.Decimal(500) },
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const txMemberFindUnique = jest.fn().mockResolvedValue({
        id: 10,
        balance: new Prisma.Decimal(500),
        realBalance: new Prisma.Decimal(300),
        giftBalance: new Prisma.Decimal(200),
      });
      const txMemberUpdate = jest.fn().mockResolvedValue({});
      const txPaymentCreate = jest.fn().mockResolvedValue({});
      const txOrderUpdate = jest.fn().mockResolvedValue({ ...mockOrder, orderStatus: 'completed' });
      const txRoomUpdate = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: { findUnique: txMemberFindUnique, update: txMemberUpdate },
          payment: { create: txPaymentCreate },
          order: { update: txOrderUpdate },
          room: { update: txRoomUpdate },
        };
        return callback(tx);
      });

      await cashierService.checkout(1, 2, {
        paymentType: 'member_balance',
        operatorId: 1,
      });

      // Verify member balance was deducted
      expect(txMemberUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({
            balance: { decrement: expect.any(Prisma.Decimal) },
            lastVisitAt: expect.any(Date),
          }),
        })
      );
    });

    it('should throw error when order does not exist or is already completed', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        cashierService.checkout(1, 999, { paymentType: 'cash', operatorId: 1 })
      ).rejects.toThrow('订单不存在或已结账');
    });

    it('should throw error when member balance is insufficient', async () => {
      const mockOrder = {
        id: 3,
        storeId: 1,
        orderNo: 'ZZ20260101000003333',
        roomId: 3,
        memberId: 20,
        orderStatus: 'in_progress',
        totalAmount: new Prisma.Decimal(1000),
        actualAmount: new Prisma.Decimal(1000),
        orderItems: [{
          id: 1, serviceId: 1, technicianId: 1,
          unitPrice: new Prisma.Decimal(1000), subtotal: new Prisma.Decimal(1000),
          isVisitCard: false,
          service: { id: 1, name: 'VIP Service' },
          technician: { id: 1, name: 'Tech A' },
        }],
        member: { id: 20, balance: new Prisma.Decimal(50) },
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue({
              id: 20,
              balance: new Prisma.Decimal(50),
              realBalance: new Prisma.Decimal(30),
              giftBalance: new Prisma.Decimal(20),
            }),
            update: jest.fn(),
          },
          payment: { create: jest.fn() },
          order: { update: jest.fn() },
          room: { update: jest.fn() },
        };
        return callback(tx);
      });

      await expect(
        cashierService.checkout(1, 3, { paymentType: 'member_balance', operatorId: 1 })
      ).rejects.toThrow('会员余额不足');
    });

    it('should create payment record for the order', async () => {
      const mockOrder = {
        id: 4,
        storeId: 1,
        orderNo: 'ZZ20260101000004444',
        roomId: 4,
        memberId: null,
        orderStatus: 'in_progress',
        totalAmount: new Prisma.Decimal(300),
        actualAmount: new Prisma.Decimal(300),
        orderItems: [{
          id: 1, serviceId: 1, technicianId: 1,
          unitPrice: new Prisma.Decimal(300), subtotal: new Prisma.Decimal(300),
          isVisitCard: false,
          service: { id: 1, name: 'Body Massage' },
          technician: { id: 1, name: 'Tech B' },
        }],
        member: null,
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const txPaymentCreate = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: { findUnique: jest.fn(), update: jest.fn() },
          payment: { create: txPaymentCreate },
          order: { update: jest.fn().mockResolvedValue({ ...mockOrder, orderStatus: 'completed' }) },
          room: { update: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      await cashierService.checkout(1, 4, { paymentType: 'wechat', operatorId: 2 });

      expect(txPaymentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 4,
          paymentType: 'wechat',
          amount: expect.any(Prisma.Decimal),
          status: 'success',
          operatorId: 2,
        }),
      });
    });

    it('should update room status to pending_clean after checkout', async () => {
      const mockOrder = {
        id: 5,
        storeId: 1,
        orderNo: 'ZZ20260101000005555',
        roomId: 5,
        memberId: null,
        orderStatus: 'in_progress',
        totalAmount: new Prisma.Decimal(150),
        actualAmount: new Prisma.Decimal(150),
        orderItems: [{
          id: 1, serviceId: 1, technicianId: 1,
          unitPrice: new Prisma.Decimal(150), subtotal: new Prisma.Decimal(150),
          isVisitCard: false,
          service: { id: 1, name: 'Neck Massage' },
          technician: { id: 1, name: 'Tech C' },
        }],
        member: null,
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const txRoomUpdate = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: { findUnique: jest.fn(), update: jest.fn() },
          payment: { create: jest.fn().mockResolvedValue({}) },
          order: { update: jest.fn().mockResolvedValue({ ...mockOrder, orderStatus: 'completed' }) },
          room: { update: txRoomUpdate },
        };
        return callback(tx);
      });

      await cashierService.checkout(1, 5, { paymentType: 'cash', operatorId: 1 });

      expect(txRoomUpdate).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { currentStatus: 'pending_clean' },
      });
    });
  });

  // ============================================================
  // refund
  // ============================================================
  describe('refund', () => {
    it('should refund a completed order successfully', async () => {
      const mockOrder = {
        id: 1,
        storeId: 1,
        orderNo: 'ZZ20260101000001234',
        memberId: null,
        orderStatus: 'completed',
        actualAmount: new Prisma.Decimal(198),
        orderItems: [
          { id: 1, isVisitCard: false, visitCardId: null, quantity: 1 },
        ],
        payments: [
          { id: 1, paymentType: 'cash', amount: new Prisma.Decimal(198), status: 'success' },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: { update: jest.fn().mockResolvedValue({}) },
          payment: { update: jest.fn().mockResolvedValue({}) },
          member: { update: jest.fn().mockResolvedValue({}) },
          visitCardAccount: { update: jest.fn().mockResolvedValue({}) },
          commissionRecord: { updateMany: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });
      mockPrisma.operationLog.create.mockResolvedValue({});

      await cashierService.refund(1, 1, 1);

      // Verify event emitted
      expect(eventBus.emit).toHaveBeenCalledWith(
        Events.ORDER_REFUNDED,
        expect.objectContaining({
          storeId: 1,
          orderId: 1,
          orderNo: 'ZZ20260101000001234',
        })
      );
    });

    it('should restore member balance for member_balance payments on refund', async () => {
      const mockOrder = {
        id: 2,
        storeId: 1,
        orderNo: 'ZZ20260101000002222',
        memberId: 10,
        orderStatus: 'completed',
        actualAmount: new Prisma.Decimal(200),
        orderItems: [
          { id: 1, isVisitCard: false, visitCardId: null, quantity: 1 },
        ],
        payments: [
          { id: 1, paymentType: 'member_balance', amount: new Prisma.Decimal(200), status: 'success' },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const txMemberUpdate = jest.fn().mockResolvedValue({});
      const txOrderUpdate = jest.fn().mockResolvedValue({});
      const txPaymentUpdate = jest.fn().mockResolvedValue({});
      const txCommissionUpdateMany = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: { update: txOrderUpdate },
          payment: { update: txPaymentUpdate },
          member: { update: txMemberUpdate },
          visitCardAccount: { update: jest.fn() },
          commissionRecord: { updateMany: txCommissionUpdateMany },
        };
        return callback(tx);
      });
      mockPrisma.operationLog.create.mockResolvedValue({});

      await cashierService.refund(1, 2, 1);

      // Verify member balance was restored
      expect(txMemberUpdate).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          balance: { increment: new Prisma.Decimal(200) },
          realBalance: { increment: new Prisma.Decimal(200) },
        },
      });

      // Verify order status updated to refunded
      expect(txOrderUpdate).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { orderStatus: 'refunded' },
      });

      // Verify payment status updated to refunded
      expect(txPaymentUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'refunded' },
      });
    });

    it('should restore visit card counts on refund', async () => {
      const mockOrder = {
        id: 3,
        storeId: 1,
        orderNo: 'ZZ20260101000003333',
        memberId: 10,
        orderStatus: 'completed',
        actualAmount: new Prisma.Decimal(0),
        orderItems: [
          { id: 1, isVisitCard: true, visitCardId: 5, quantity: 2 },
          { id: 2, isVisitCard: false, visitCardId: null, quantity: 1 },
        ],
        payments: [
          { id: 1, paymentType: 'cash', amount: new Prisma.Decimal(0), status: 'success' },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const txVisitCardUpdate = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: { update: jest.fn().mockResolvedValue({}) },
          payment: { update: jest.fn().mockResolvedValue({}) },
          member: { update: jest.fn().mockResolvedValue({}) },
          visitCardAccount: { update: txVisitCardUpdate },
          commissionRecord: { updateMany: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });
      mockPrisma.operationLog.create.mockResolvedValue({});

      await cashierService.refund(1, 3, 1);

      // Verify visit card restored for the item that used visit card
      expect(txVisitCardUpdate).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          usedCount: { decrement: 2 },
          remainingCount: { increment: 2 },
        },
      });

      // Only the visit card item should trigger visit card update
      expect(txVisitCardUpdate).toHaveBeenCalledTimes(1);
    });

    it('should throw error when order does not exist or is not completed', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        cashierService.refund(1, 999, 1)
      ).rejects.toThrow('订单不存在或未结账');
    });

    it('should reverse commission records on refund', async () => {
      const mockOrder = {
        id: 4,
        storeId: 1,
        orderNo: 'ZZ20260101000004444',
        memberId: null,
        orderStatus: 'completed',
        actualAmount: new Prisma.Decimal(300),
        orderItems: [
          { id: 1, isVisitCard: false, visitCardId: null, quantity: 1 },
        ],
        payments: [
          { id: 1, paymentType: 'cash', amount: new Prisma.Decimal(300), status: 'success' },
        ],
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const txCommissionUpdateMany = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: { update: jest.fn().mockResolvedValue({}) },
          payment: { update: jest.fn().mockResolvedValue({}) },
          member: { update: jest.fn().mockResolvedValue({}) },
          visitCardAccount: { update: jest.fn() },
          commissionRecord: { updateMany: txCommissionUpdateMany },
        };
        return callback(tx);
      });
      mockPrisma.operationLog.create.mockResolvedValue({});

      await cashierService.refund(1, 4, 1);

      expect(txCommissionUpdateMany).toHaveBeenCalledWith({
        where: { orderId: 4, status: 'normal' },
        data: { status: 'reversed' },
      });
    });

    it('should create an operation log entry on refund', async () => {
      const mockOrder = {
        id: 5,
        storeId: 1,
        orderNo: 'ZZ20260101000005555',
        memberId: null,
        orderStatus: 'completed',
        actualAmount: new Prisma.Decimal(150),
        orderItems: [],
        payments: [],
      };

      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          order: { update: jest.fn().mockResolvedValue({}) },
          payment: { update: jest.fn() },
          member: { update: jest.fn() },
          visitCardAccount: { update: jest.fn() },
          commissionRecord: { updateMany: jest.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });
      mockPrisma.operationLog.create.mockResolvedValue({});

      await cashierService.refund(1, 5, 7);

      expect(mockPrisma.operationLog.create).toHaveBeenCalledWith({
        data: {
          storeId: 1,
          operatorId: 7,
          action: 'refund',
          targetType: 'order',
          targetId: 5,
          detail: expect.stringContaining('ZZ20260101000005555'),
        },
      });
    });
  });
});
