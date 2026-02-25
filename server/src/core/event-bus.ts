/**
 * 事件总线 - 模块间异步通信核心
 * V1核心流程在关键节点发布事件，V2/V3模块注册监听即可介入
 */

type EventHandler = (data: any) => Promise<void> | void;

interface EventSubscription {
  handler: EventHandler;
  module?: string; // 注册模块名，用于调试和卸载
}

// V1 预定义事件常量
export const Events = {
  // 订单相关
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_CHECKOUT_SUCCESS: 'ORDER_CHECKOUT_SUCCESS',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',

  // 会员相关
  MEMBER_REGISTERED: 'MEMBER_REGISTERED',
  MEMBER_RECHARGED: 'MEMBER_RECHARGED',
  MEMBER_UPDATED: 'MEMBER_UPDATED',

  // 排班相关
  SCHEDULE_UPDATED: 'SCHEDULE_UPDATED',

  // 房台相关
  ROOM_STATUS_CHANGED: 'ROOM_STATUS_CHANGED',
} as const;

export type EventName = (typeof Events)[keyof typeof Events] | string;

class EventBus {
  private listeners: Map<string, EventSubscription[]> = new Map();

  /**
   * 注册事件监听
   * @param event 事件名称
   * @param handler 处理函数
   * @param module 模块名称（可选，用于调试和批量卸载）
   */
  on(event: EventName, handler: EventHandler, module?: string): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ handler, module });
  }

  /**
   * 移除事件监听
   */
  off(event: EventName, handler: EventHandler): void {
    const subs = this.listeners.get(event);
    if (!subs) return;
    const idx = subs.findIndex((s) => s.handler === handler);
    if (idx !== -1) subs.splice(idx, 1);
  }

  /**
   * 移除某个模块的所有监听（模块卸载时使用）
   */
  offModule(module: string): void {
    for (const [event, subs] of this.listeners) {
      this.listeners.set(
        event,
        subs.filter((s) => s.module !== module),
      );
    }
  }

  /**
   * 发布事件（异步，所有监听器并发执行，不阻塞主流程）
   */
  async emit(event: EventName, data: any): Promise<void> {
    const subs = this.listeners.get(event);
    if (!subs || subs.length === 0) return;

    const results = await Promise.allSettled(subs.map((s) => s.handler(data)));

    // 记录失败的监听器（不影响其他监听器）
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `[EventBus] Handler failed for event "${event}" (module: ${subs[index].module || 'unknown'}):`,
          result.reason,
        );
      }
    });
  }

  /**
   * 获取某事件的监听器数量（调试用）
   */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * 清除所有监听器（测试用）
   */
  clear(): void {
    this.listeners.clear();
  }
}

// 单例导出
export const eventBus = new EventBus();
