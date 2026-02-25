/**
 * 钩子注册系统 - V2/V3模块同步介入V1核心流程
 *
 * 钩子阶段：validate → before → [核心逻辑] → after
 * 每个钩子带 priority 数值，数值小的先执行
 */

export type HookPhase = 'validate' | 'before' | 'after';

export interface HookContext {
  /** 当前操作的数据（可被钩子修改） */
  data: Record<string, any>;
  /** 元信息（只读） */
  meta: {
    storeId: number;
    operatorId: number;
    [key: string]: any;
  };
  /** 钩子间共享的临时数据 */
  shared: Record<string, any>;
}

interface HookEntry {
  phase: HookPhase;
  priority: number;
  handler: (context: HookContext) => Promise<void>;
  module: string;
}

// V1 预定义钩子点
export const HookPoints = {
  CASHIER_CHECKOUT: 'cashier.checkout',
  CASHIER_CREATE_ORDER: 'cashier.createOrder',
  MEMBER_RECHARGE: 'member.recharge',
  MEMBER_CONSUME: 'member.consume',
} as const;

export type HookPoint = (typeof HookPoints)[keyof typeof HookPoints] | string;

class HookRegistry {
  private hooks: Map<string, HookEntry[]> = new Map();

  /**
   * 注册钩子
   * @param hookPoint 钩子点名称
   * @param phase 执行阶段 validate|before|after
   * @param priority 优先级（数值小先执行）
   * @param handler 处理函数
   * @param module 模块名称
   */
  register(
    hookPoint: HookPoint,
    phase: HookPhase,
    priority: number,
    handler: (context: HookContext) => Promise<void>,
    module: string,
  ): void {
    const key = `${hookPoint}.${phase}`;
    if (!this.hooks.has(key)) {
      this.hooks.set(key, []);
    }
    this.hooks.get(key)!.push({ phase, priority, handler, module });
    // 按 priority 排序
    this.hooks.get(key)!.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除某模块的所有钩子
   */
  unregisterModule(module: string): void {
    for (const [key, entries] of this.hooks) {
      this.hooks.set(
        key,
        entries.filter((e) => e.module !== module),
      );
    }
  }

  /**
   * 执行某钩子点的某阶段的所有钩子
   * validate 阶段：任何钩子抛异常则中止整个流程
   * before 阶段：顺序执行，可修改 context.data
   * after 阶段：顺序执行，用于后置处理
   */
  async execute(
    hookPoint: HookPoint,
    phase: HookPhase,
    context: HookContext,
  ): Promise<void> {
    const key = `${hookPoint}.${phase}`;
    const entries = this.hooks.get(key);
    if (!entries || entries.length === 0) return;

    for (const entry of entries) {
      try {
        await entry.handler(context);
      } catch (error) {
        if (phase === 'validate') {
          // validate 阶段的错误直接向上抛出，中止流程
          throw error;
        }
        // before/after 阶段的错误记录日志但不中止
        console.error(
          `[HookRegistry] Hook failed at ${key} (module: ${entry.module}, priority: ${entry.priority}):`,
          error,
        );
        if (phase === 'before') {
          // before 阶段的错误也向上抛出，因为会影响核心逻辑的输入
          throw error;
        }
        // after 阶段的错误只记录，不中止
      }
    }
  }

  /**
   * 便捷方法：执行完整的钩子链 validate → before → [caller执行核心逻辑] → after
   */
  async executeFullChain(
    hookPoint: HookPoint,
    context: HookContext,
    coreLogic: (context: HookContext) => Promise<void>,
  ): Promise<void> {
    await this.execute(hookPoint, 'validate', context);
    await this.execute(hookPoint, 'before', context);
    await coreLogic(context);
    await this.execute(hookPoint, 'after', context);
  }

  /**
   * 获取某钩子点的注册信息（调试用）
   */
  getHookInfo(hookPoint: HookPoint): Record<HookPhase, { module: string; priority: number }[]> {
    const result: Record<string, { module: string; priority: number }[]> = {};
    for (const phase of ['validate', 'before', 'after'] as HookPhase[]) {
      const key = `${hookPoint}.${phase}`;
      const entries = this.hooks.get(key) || [];
      result[phase] = entries.map((e) => ({ module: e.module, priority: e.priority }));
    }
    return result as Record<HookPhase, { module: string; priority: number }[]>;
  }

  /**
   * 清除所有钩子（测试用）
   */
  clear(): void {
    this.hooks.clear();
  }
}

// 单例导出
export const hookRegistry = new HookRegistry();
