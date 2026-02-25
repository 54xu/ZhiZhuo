/**
 * Member service tests
 * Tests for register, search, rechargeAmount, getDetail
 */

import { MemberService } from '../modules/member/member.service';
import { eventBus, Events } from '../core/event-bus';
import { Prisma } from '@prisma/client';

// Mock eventBus to avoid side effects
jest.mock('../core/event-bus', () => ({
  eventBus: {
    emit: jest.fn().mockResolvedValue(undefined),
  },
  Events: {
    MEMBER_REGISTERED: 'MEMBER_REGISTERED',
    MEMBER_RECHARGED: 'MEMBER_RECHARGED',
    MEMBER_UPDATED: 'MEMBER_UPDATED',
  },
}));

function createMockPrisma() {
  return {
    member: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    rechargePlan: {
      findFirst: jest.fn(),
    },
    rechargeRecord: {
      create: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;
}

describe('MemberService', () => {
  let memberService: MemberService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    memberService = new MemberService(mockPrisma);
    (eventBus.emit as jest.Mock).mockClear();
  });

  // ============================================================
  // register
  // ============================================================
  describe('register', () => {
    it('should register a new member successfully', async () => {
      // No existing member with this phone
      mockPrisma.member.findFirst.mockResolvedValue(null);

      const createdMember = {
        id: 1,
        storeId: 1,
        cardNo: 'M10000001',
        phone: '13800138000',
        name: 'Test User',
        gender: 'male',
        birthday: null,
        remark: null,
        balance: new Prisma.Decimal(0),
        realBalance: new Prisma.Decimal(0),
        giftBalance: new Prisma.Decimal(0),
        status: 'active',
      };
      mockPrisma.member.create.mockResolvedValue(createdMember);

      const result = await memberService.register(1, {
        phone: '13800138000',
        name: 'Test User',
        gender: 'male',
      });

      expect(result).toEqual(createdMember);
      expect(mockPrisma.member.create).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith(Events.MEMBER_REGISTERED, {
        storeId: 1,
        memberId: 1,
      });
    });

    it('should throw error when phone number already exists', async () => {
      // Existing member with this phone
      mockPrisma.member.findFirst
        .mockResolvedValueOnce({ id: 99, phone: '13800138000' })  // duplicate check
        ;

      await expect(
        memberService.register(1, { phone: '13800138000', name: 'Duplicate' })
      ).rejects.toThrow('该手机号已注册');

      expect(mockPrisma.member.create).not.toHaveBeenCalled();
    });

    it('should generate card number based on the last member', async () => {
      // First call: check duplicate phone (null = not found)
      // Second call: find last member for card number generation
      mockPrisma.member.findFirst
        .mockResolvedValueOnce(null)                              // duplicate phone check
        .mockResolvedValueOnce({ cardNo: 'M10000005' });          // last member for card gen

      mockPrisma.member.create.mockResolvedValue({
        id: 6,
        cardNo: 'M10000006',
        phone: '13900139001',
      });

      await memberService.register(1, { phone: '13900139001' });

      expect(mockPrisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cardNo: 'M10000006',
            phone: '13900139001',
          }),
        })
      );
    });

    it('should use default card number M10000001 when no members exist', async () => {
      mockPrisma.member.findFirst
        .mockResolvedValueOnce(null)    // duplicate phone check
        .mockResolvedValueOnce(null);   // no last member

      mockPrisma.member.create.mockResolvedValue({
        id: 1,
        cardNo: 'M10000001',
        phone: '13800138001',
      });

      await memberService.register(1, { phone: '13800138001' });

      expect(mockPrisma.member.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cardNo: 'M10000001',
          }),
        })
      );
    });
  });

  // ============================================================
  // search
  // ============================================================
  describe('search', () => {
    it('should search members by name', async () => {
      const members = [
        { id: 1, cardNo: 'M10000001', phone: '13800138000', name: 'Zhang San', balance: new Prisma.Decimal(100) },
      ];
      mockPrisma.member.findMany.mockResolvedValue(members);
      mockPrisma.member.count.mockResolvedValue(1);

      const result = await memberService.search(1, 'Zhang');

      expect(result.list).toEqual(members);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);

      // Verify search conditions include OR clause
      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: 1,
            status: 'active',
            OR: [
              { phone: { contains: 'Zhang' } },
              { name: { contains: 'Zhang' } },
              { cardNo: { contains: 'Zhang' } },
            ],
          }),
        })
      );
    });

    it('should search members by phone number', async () => {
      const members = [
        { id: 1, cardNo: 'M10000001', phone: '13800138000', name: 'Zhang San' },
      ];
      mockPrisma.member.findMany.mockResolvedValue(members);
      mockPrisma.member.count.mockResolvedValue(1);

      const result = await memberService.search(1, '138');

      expect(result.list).toHaveLength(1);
    });

    it('should support pagination', async () => {
      mockPrisma.member.findMany.mockResolvedValue([]);
      mockPrisma.member.count.mockResolvedValue(50);

      const result = await memberService.search(1, 'test', 3, 10);

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(mockPrisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,  // (3-1) * 10
          take: 10,
        })
      );
    });

    it('should return empty list when no members match', async () => {
      mockPrisma.member.findMany.mockResolvedValue([]);
      mockPrisma.member.count.mockResolvedValue(0);

      const result = await memberService.search(1, 'nonexistent');

      expect(result.list).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // getDetail
  // ============================================================
  describe('getDetail', () => {
    it('should return member detail with visit card accounts', async () => {
      const mockMember = {
        id: 1,
        storeId: 1,
        cardNo: 'M10000001',
        phone: '13800138000',
        name: 'Zhang San',
        balance: new Prisma.Decimal(500),
        realBalance: new Prisma.Decimal(300),
        giftBalance: new Prisma.Decimal(200),
        visitCardAccounts: [
          {
            id: 1,
            remainingCount: 5,
            service: { id: 1, name: 'Foot Massage' },
          },
        ],
      };

      mockPrisma.member.findFirst.mockResolvedValue(mockMember);

      const result = await memberService.getDetail(1, 1);

      expect(result).toEqual(mockMember);
      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
        where: { id: 1, storeId: 1 },
        include: {
          visitCardAccounts: {
            where: { remainingCount: { gt: 0 } },
            include: { service: { select: { id: true, name: true } } },
          },
        },
      });
    });

    it('should throw error when member does not exist', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(memberService.getDetail(1, 999)).rejects.toThrow('会员不存在');
    });

    it('should throw when member belongs to a different store', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(memberService.getDetail(2, 1)).rejects.toThrow('会员不存在');
    });
  });

  // ============================================================
  // rechargeAmount
  // ============================================================
  describe('rechargeAmount', () => {
    it('should recharge member balance successfully', async () => {
      const mockPlan = {
        id: 1,
        storeId: 1,
        planType: 'amount',
        payAmount: new Prisma.Decimal(100),
        giftAmount: new Prisma.Decimal(20),
        status: 'active',
      };
      mockPrisma.rechargePlan.findFirst.mockResolvedValue(mockPlan);

      const mockMember = {
        id: 1,
        balance: new Prisma.Decimal(120),
        realBalance: new Prisma.Decimal(100),
        giftBalance: new Prisma.Decimal(20),
      };
      const mockRecord = { id: 10 };

      // Mock $transaction to execute the callback
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: {
            update: jest.fn().mockResolvedValue(mockMember),
          },
          rechargeRecord: {
            create: jest.fn().mockResolvedValue(mockRecord),
          },
          payment: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await memberService.rechargeAmount(1, {
        memberId: 1,
        planId: 1,
        paymentMethod: 'cash',
        operatorId: 1,
      });

      expect(result.record).toEqual(mockRecord);
      expect(result.member).toEqual(mockMember);

      // Verify event emission
      expect(eventBus.emit).toHaveBeenCalledWith(Events.MEMBER_RECHARGED, {
        storeId: 1,
        memberId: 1,
        planId: 1,
        planType: 'amount',
        payAmount: '100',
        giftAmount: '20',
      });
    });

    it('should throw error when recharge plan does not exist', async () => {
      mockPrisma.rechargePlan.findFirst.mockResolvedValue(null);

      await expect(
        memberService.rechargeAmount(1, {
          memberId: 1,
          planId: 999,
          paymentMethod: 'cash',
          operatorId: 1,
        })
      ).rejects.toThrow('充值方案不存在');
    });

    it('should create correct recharge record and payment inside transaction', async () => {
      const mockPlan = {
        id: 2,
        storeId: 1,
        planType: 'amount',
        payAmount: new Prisma.Decimal(200),
        giftAmount: new Prisma.Decimal(50),
        status: 'active',
      };
      mockPrisma.rechargePlan.findFirst.mockResolvedValue(mockPlan);

      const txMemberUpdate = jest.fn().mockResolvedValue({ id: 1, balance: new Prisma.Decimal(250) });
      const txRechargeCreate = jest.fn().mockResolvedValue({ id: 20 });
      const txPaymentCreate = jest.fn().mockResolvedValue({});

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          member: { update: txMemberUpdate },
          rechargeRecord: { create: txRechargeCreate },
          payment: { create: txPaymentCreate },
        };
        return callback(tx);
      });

      await memberService.rechargeAmount(1, {
        memberId: 5,
        planId: 2,
        paymentMethod: 'wechat',
        operatorId: 3,
        remark: 'Test recharge',
      });

      // Verify member balance update
      expect(txMemberUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            balance: { increment: expect.any(Prisma.Decimal) },
            realBalance: { increment: new Prisma.Decimal(200) },
            giftBalance: { increment: new Prisma.Decimal(50) },
          }),
        })
      );

      // Verify recharge record creation
      expect(txRechargeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 1,
            memberId: 5,
            planId: 2,
            planType: 'amount',
            payAmount: new Prisma.Decimal(200),
            giftAmount: new Prisma.Decimal(50),
            paymentMethod: 'wechat',
            operatorId: 3,
            remark: 'Test recharge',
          }),
        })
      );

      // Verify payment record creation
      expect(txPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentType: 'wechat',
            amount: new Prisma.Decimal(200),
            status: 'success',
            operatorId: 3,
          }),
        })
      );
    });
  });
});
