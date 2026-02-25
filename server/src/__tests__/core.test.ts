/**
 * Core infrastructure tests
 * Tests for EventBus, HookRegistry, and FeatureFlagService
 */

import { eventBus, Events, EventName } from '../core/event-bus';
import { hookRegistry, HookPoints, HookContext, HookPhase } from '../core/hook-registry';
import { featureFlagService, FeatureFlags } from '../core/feature-flag.service';

// ============================================================
// EventBus Tests
// ============================================================
describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clear();
  });

  describe('on / emit', () => {
    it('should call registered handler when event is emitted', async () => {
      const handler = jest.fn();
      eventBus.on(Events.ORDER_CREATED, handler);

      await eventBus.emit(Events.ORDER_CREATED, { orderId: 1 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ orderId: 1 });
    });

    it('should call multiple listeners for the same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.on(Events.ORDER_CREATED, handler1);
      eventBus.on(Events.ORDER_CREATED, handler2);
      eventBus.on(Events.ORDER_CREATED, handler3);

      await eventBus.emit(Events.ORDER_CREATED, { orderId: 42 });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should pass event data correctly to all handlers', async () => {
      const receivedData: any[] = [];
      eventBus.on(Events.MEMBER_REGISTERED, (data) => {
        receivedData.push(data);
      });
      eventBus.on(Events.MEMBER_REGISTERED, (data) => {
        receivedData.push(data);
      });

      const payload = { storeId: 1, memberId: 100, phone: '13800138000' };
      await eventBus.emit(Events.MEMBER_REGISTERED, payload);

      expect(receivedData).toHaveLength(2);
      expect(receivedData[0]).toEqual(payload);
      expect(receivedData[1]).toEqual(payload);
    });

    it('should not trigger handlers for different events', async () => {
      const handler = jest.fn();
      eventBus.on(Events.ORDER_CREATED, handler);

      await eventBus.emit(Events.ORDER_REFUNDED, { orderId: 1 });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support custom string event names', async () => {
      const handler = jest.fn();
      eventBus.on('custom.event' as EventName, handler);

      await eventBus.emit('custom.event' as EventName, { custom: true });

      expect(handler).toHaveBeenCalledWith({ custom: true });
    });

    it('should handle emitting an event with no listeners gracefully', async () => {
      // Should not throw
      await expect(
        eventBus.emit(Events.SCHEDULE_UPDATED, { data: 'test' })
      ).resolves.toBeUndefined();
    });
  });

  describe('off', () => {
    it('should remove a specific handler', async () => {
      const handler = jest.fn();
      eventBus.on(Events.ORDER_CREATED, handler);
      eventBus.off(Events.ORDER_CREATED, handler);

      await eventBus.emit(Events.ORDER_CREATED, {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only remove the specified handler, keeping others', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      eventBus.on(Events.ORDER_CREATED, handler1);
      eventBus.on(Events.ORDER_CREATED, handler2);

      eventBus.off(Events.ORDER_CREATED, handler1);

      await eventBus.emit(Events.ORDER_CREATED, {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle removing a non-existent handler gracefully', () => {
      const handler = jest.fn();
      // Should not throw
      expect(() => eventBus.off(Events.ORDER_CREATED, handler)).not.toThrow();
    });
  });

  describe('offModule', () => {
    it('should remove all handlers registered by a specific module', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.on(Events.ORDER_CREATED, handler1, 'moduleA');
      eventBus.on(Events.ORDER_CREATED, handler2, 'moduleA');
      eventBus.on(Events.ORDER_CREATED, handler3, 'moduleB');

      eventBus.offModule('moduleA');

      await eventBus.emit(Events.ORDER_CREATED, {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should remove handlers across different events for the same module', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on(Events.ORDER_CREATED, handler1, 'moduleA');
      eventBus.on(Events.MEMBER_REGISTERED, handler2, 'moduleA');

      eventBus.offModule('moduleA');

      await eventBus.emit(Events.ORDER_CREATED, {});
      await eventBus.emit(Events.MEMBER_REGISTERED, {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return 0 for events with no listeners', () => {
      expect(eventBus.listenerCount(Events.ORDER_CREATED)).toBe(0);
    });

    it('should return the correct count of listeners', () => {
      eventBus.on(Events.ORDER_CREATED, jest.fn());
      eventBus.on(Events.ORDER_CREATED, jest.fn());
      eventBus.on(Events.ORDER_CREATED, jest.fn());

      expect(eventBus.listenerCount(Events.ORDER_CREATED)).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should not throw if one handler fails, and still call other handlers', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const handler1 = jest.fn().mockRejectedValue(new Error('handler1 failed'));
      const handler2 = jest.fn();

      eventBus.on(Events.ORDER_CREATED, handler1, 'failModule');
      eventBus.on(Events.ORDER_CREATED, handler2, 'successModule');

      await eventBus.emit(Events.ORDER_CREATED, { orderId: 1 });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should remove all listeners', async () => {
      eventBus.on(Events.ORDER_CREATED, jest.fn());
      eventBus.on(Events.MEMBER_REGISTERED, jest.fn());

      eventBus.clear();

      expect(eventBus.listenerCount(Events.ORDER_CREATED)).toBe(0);
      expect(eventBus.listenerCount(Events.MEMBER_REGISTERED)).toBe(0);
    });
  });
});

// ============================================================
// HookRegistry Tests
// ============================================================
describe('HookRegistry', () => {
  beforeEach(() => {
    hookRegistry.clear();
  });

  describe('register / execute', () => {
    it('should execute a registered hook handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      hookRegistry.register(HookPoints.CASHIER_CHECKOUT, 'validate', 10, handler, 'testModule');

      const context: HookContext = {
        data: { orderId: 1 },
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'validate', context);

      expect(handler).toHaveBeenCalledWith(context);
    });

    it('should execute hooks in priority order (lower number first)', async () => {
      const executionOrder: number[] = [];

      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'before', 30,
        async () => { executionOrder.push(30); },
        'moduleC'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'before', 10,
        async () => { executionOrder.push(10); },
        'moduleA'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'before', 20,
        async () => { executionOrder.push(20); },
        'moduleB'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'before', context);

      expect(executionOrder).toEqual([10, 20, 30]);
    });

    it('should do nothing if no hooks are registered for a phase', async () => {
      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };
      // Should not throw
      await expect(
        hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'validate', context)
      ).resolves.toBeUndefined();
    });
  });

  describe('validate phase', () => {
    it('should throw error and abort when a validate hook fails', async () => {
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'validate', 10,
        async () => { throw new Error('Validation failed: coupon expired'); },
        'couponModule'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await expect(
        hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'validate', context)
      ).rejects.toThrow('Validation failed: coupon expired');
    });

    it('should stop executing subsequent validate hooks after first failure', async () => {
      const handler2 = jest.fn().mockResolvedValue(undefined);

      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'validate', 10,
        async () => { throw new Error('First validate fails'); },
        'moduleA'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'validate', 20,
        handler2,
        'moduleB'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await expect(
        hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'validate', context)
      ).rejects.toThrow();

      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('before phase', () => {
    it('should allow hooks to modify context.data', async () => {
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'before', 10,
        async (ctx) => {
          ctx.data.discountAmount = '10';
        },
        'couponModule'
      );

      const context: HookContext = {
        data: { discountAmount: '0' },
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'before', context);

      expect(context.data.discountAmount).toBe('10');
    });

    it('should throw when a before hook fails', async () => {
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'before', 10,
        async () => { throw new Error('Before hook failed'); },
        'moduleA'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await expect(
        hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'before', context)
      ).rejects.toThrow('Before hook failed');
    });
  });

  describe('after phase', () => {
    it('should execute after hooks without throwing on error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'after', 10,
        async () => { throw new Error('After hook error'); },
        'pointsModule'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      // after phase errors should be swallowed (only logged)
      await expect(
        hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'after', context)
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should continue executing other after hooks when one fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const handler2 = jest.fn().mockResolvedValue(undefined);

      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'after', 10,
        async () => { throw new Error('First after fails'); },
        'moduleA'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'after', 20,
        handler2,
        'moduleB'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'after', context);

      expect(handler2).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('executeFullChain', () => {
    it('should execute validate -> before -> coreLogic -> after in order', async () => {
      const order: string[] = [];

      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'validate', 10,
        async () => { order.push('validate'); },
        'test'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'before', 10,
        async () => { order.push('before'); },
        'test'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'after', 10,
        async () => { order.push('after'); },
        'test'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await hookRegistry.executeFullChain(
        HookPoints.CASHIER_CHECKOUT,
        context,
        async () => { order.push('core'); }
      );

      expect(order).toEqual(['validate', 'before', 'core', 'after']);
    });

    it('should abort the chain if validate throws', async () => {
      const coreLogic = jest.fn();
      const afterHandler = jest.fn().mockResolvedValue(undefined);

      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'validate', 10,
        async () => { throw new Error('validate failed'); },
        'test'
      );
      hookRegistry.register(
        HookPoints.CASHIER_CHECKOUT, 'after', 10,
        afterHandler,
        'test'
      );

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await expect(
        hookRegistry.executeFullChain(HookPoints.CASHIER_CHECKOUT, context, coreLogic)
      ).rejects.toThrow('validate failed');

      expect(coreLogic).not.toHaveBeenCalled();
      expect(afterHandler).not.toHaveBeenCalled();
    });
  });

  describe('unregisterModule', () => {
    it('should remove all hooks from a specific module', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      hookRegistry.register(HookPoints.CASHIER_CHECKOUT, 'before', 10, handler1, 'moduleA');
      hookRegistry.register(HookPoints.CASHIER_CHECKOUT, 'before', 20, handler2, 'moduleB');

      hookRegistry.unregisterModule('moduleA');

      const context: HookContext = {
        data: {},
        meta: { storeId: 1, operatorId: 1 },
        shared: {},
      };

      await hookRegistry.execute(HookPoints.CASHIER_CHECKOUT, 'before', context);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('getHookInfo', () => {
    it('should return information about registered hooks for a hook point', () => {
      hookRegistry.register(HookPoints.CASHIER_CHECKOUT, 'validate', 10, jest.fn(), 'moduleA');
      hookRegistry.register(HookPoints.CASHIER_CHECKOUT, 'before', 20, jest.fn(), 'moduleB');
      hookRegistry.register(HookPoints.CASHIER_CHECKOUT, 'after', 30, jest.fn(), 'moduleC');

      const info = hookRegistry.getHookInfo(HookPoints.CASHIER_CHECKOUT);

      expect(info.validate).toEqual([{ module: 'moduleA', priority: 10 }]);
      expect(info.before).toEqual([{ module: 'moduleB', priority: 20 }]);
      expect(info.after).toEqual([{ module: 'moduleC', priority: 30 }]);
    });

    it('should return empty arrays for hook points with no hooks', () => {
      const info = hookRegistry.getHookInfo(HookPoints.MEMBER_RECHARGE);

      expect(info.validate).toEqual([]);
      expect(info.before).toEqual([]);
      expect(info.after).toEqual([]);
    });
  });
});

// ============================================================
// FeatureFlagService Tests
// ============================================================
describe('FeatureFlagService', () => {
  // Create a mock PrismaClient
  const mockFindMany = jest.fn();
  const mockUpsert = jest.fn();
  const mockPrisma = {
    featureFlag: {
      findMany: mockFindMany,
      upsert: mockUpsert,
    },
  } as any;

  beforeEach(() => {
    featureFlagService.clearAllCache();
    featureFlagService.init(mockPrisma);
    mockFindMany.mockReset();
    mockUpsert.mockReset();
  });

  describe('getAllFlags', () => {
    it('should return all feature flags for a store', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: true, config: null },
        { storeId: 1, flagKey: FeatureFlags.POINTS, enabled: false, config: '{"ratio": 10}' },
      ]);

      const flags = await featureFlagService.getAllFlags(1);

      expect(flags[FeatureFlags.COUPON]).toEqual({ enabled: true, config: null });
      expect(flags[FeatureFlags.POINTS]).toEqual({ enabled: false, config: { ratio: 10 } });
    });

    it('should return empty object when store has no flags', async () => {
      mockFindMany.mockResolvedValue([]);

      const flags = await featureFlagService.getAllFlags(99);

      expect(flags).toEqual({});
    });

    it('should use cache for subsequent calls within TTL', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: true, config: null },
      ]);

      await featureFlagService.getAllFlags(1);
      await featureFlagService.getAllFlags(1);

      // Should only call DB once due to caching
      expect(mockFindMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('isEnabled', () => {
    it('should return true for an enabled flag', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: true, config: null },
      ]);

      const result = await featureFlagService.isEnabled(1, FeatureFlags.COUPON);

      expect(result).toBe(true);
    });

    it('should return false for a disabled flag', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: false, config: null },
      ]);

      const result = await featureFlagService.isEnabled(1, FeatureFlags.COUPON);

      expect(result).toBe(false);
    });

    it('should return false for a non-existent flag', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await featureFlagService.isEnabled(1, FeatureFlags.COUPON);

      expect(result).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return parsed config for a flag with config', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.POINTS, enabled: true, config: '{"ratio": 10, "max": 500}' },
      ]);

      const config = await featureFlagService.getConfig(1, FeatureFlags.POINTS);

      expect(config).toEqual({ ratio: 10, max: 500 });
    });

    it('should return null for a flag with no config', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: true, config: null },
      ]);

      const config = await featureFlagService.getConfig(1, FeatureFlags.COUPON);

      expect(config).toBeNull();
    });

    it('should return null for a non-existent flag', async () => {
      mockFindMany.mockResolvedValue([]);

      const config = await featureFlagService.getConfig(1, 'nonexistent.flag');

      expect(config).toBeNull();
    });
  });

  describe('setFlag', () => {
    it('should upsert the flag and invalidate cache', async () => {
      mockUpsert.mockResolvedValue({});
      // Pre-populate cache
      mockFindMany.mockResolvedValue([]);
      await featureFlagService.getAllFlags(1);

      await featureFlagService.setFlag(1, FeatureFlags.COUPON, true, { maxDiscount: 50 });

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { storeId_flagKey: { storeId: 1, flagKey: FeatureFlags.COUPON } },
        update: { enabled: true, config: '{"maxDiscount":50}' },
        create: { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: true, config: '{"maxDiscount":50}' },
      });

      // Cache should be invalidated, so next call should hit DB
      mockFindMany.mockResolvedValue([]);
      await featureFlagService.getAllFlags(1);
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });

    it('should throw if service is not initialized', async () => {
      // Create a fresh service instance for this test
      const { featureFlagService: freshService } = await import('../core/feature-flag.service');
      // Clear cache and reset prisma by re-initializing with null-like
      freshService.clearAllCache();
      // Access the private prisma to set it to null
      (freshService as any).prisma = null;

      await expect(
        freshService.setFlag(1, FeatureFlags.COUPON, true)
      ).rejects.toThrow('FeatureFlagService not initialized');
    });
  });

  describe('invalidateCache', () => {
    it('should cause next call to fetch from DB', async () => {
      mockFindMany.mockResolvedValue([
        { storeId: 1, flagKey: FeatureFlags.COUPON, enabled: true, config: null },
      ]);

      await featureFlagService.getAllFlags(1);
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      featureFlagService.invalidateCache(1);

      await featureFlagService.getAllFlags(1);
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });
  });
});
