/**
 * 模块基类 - 所有业务模块的标准接口
 *
 * V2/V3 的每个模块都需要实现此基类
 * 标准化模块的注册、路由、事件、钩子等行为
 */

import { Router } from 'express';
import { eventBus, EventName } from './event-bus';
import { hookRegistry, HookPoint, HookPhase, HookContext } from './hook-registry';

export abstract class BaseModule {
  /** 模块名称（唯一标识） */
  abstract readonly name: string;

  /** 对应的功能开关 key */
  abstract readonly featureFlag: string;

  /** 依赖的其他模块（功能开关 key 列表） */
  readonly dependencies: string[] = [];

  /**
   * 注册路由
   * 子类实现此方法注册自己的 API 路由
   */
  abstract registerRoutes(router: Router): void;

  /**
   * 注册事件监听
   * 子类实现此方法监听其他模块发布的事件
   */
  registerEvents(): void {
    // 默认不注册任何事件，子类按需覆写
  }

  /**
   * 注册钩子
   * 子类实现此方法向核心流程注册钩子
   */
  registerHooks(): void {
    // 默认不注册任何钩子，子类按需覆写
  }

  /**
   * 模块初始化（所有注册完成后调用）
   */
  async onInit(): Promise<void> {
    // 默认空实现，子类按需覆写
  }

  /**
   * 模块卸载（清理资源）
   */
  async onDestroy(): Promise<void> {
    eventBus.offModule(this.name);
    hookRegistry.unregisterModule(this.name);
  }

  // ---- 便捷方法 ----

  /** 监听事件 */
  protected onEvent(event: EventName, handler: (data: any) => Promise<void>): void {
    eventBus.on(event, handler, this.name);
  }

  /** 注册钩子 */
  protected addHook(
    hookPoint: HookPoint,
    phase: HookPhase,
    priority: number,
    handler: (context: HookContext) => Promise<void>,
  ): void {
    hookRegistry.register(hookPoint, phase, priority, handler, this.name);
  }
}
