/**
 * 插件槽位注册系统
 *
 * V1 核心页面预留槽位，V2/V3 模块将自己的 UI 组件注册到槽位中
 * 通过 featureFlag 控制组件的显示/隐藏
 */

import { markRaw, type Component } from 'vue'

export interface PluginSlotEntry {
  /** 组件 */
  component: Component
  /** 优先级（数值小先渲染） */
  priority: number
  /** 模块名称 */
  module: string
  /** 对应的功能开关 key（自动检查是否启用） */
  featureFlag?: string
  /** 组件 props 默认值 */
  defaultProps?: Record<string, any>
}

// 预定义槽位名称常量
export const SlotNames = {
  // 结账页
  CHECKOUT_DISCOUNTS: 'checkout-discounts',
  CHECKOUT_PAYMENT_TYPES: 'checkout-payment-types',
  // 会员详情页
  MEMBER_DETAIL_TABS: 'member-detail-tabs',
  MEMBER_DETAIL_ACTIONS: 'member-detail-actions',
  // 工作台
  WORKSPACE_TOOLBAR: 'workspace-toolbar',
  // 订单详情
  ORDER_DETAIL_EXTRA: 'order-detail-extra',
  // 我的页面
  MINE_MENU_ITEMS: 'mine-menu-items',
} as const

export type SlotName = (typeof SlotNames)[keyof typeof SlotNames] | string

class PluginSlotRegistry {
  private slots: Map<string, PluginSlotEntry[]> = new Map()

  /**
   * 注册组件到槽位
   */
  register(
    slotName: SlotName,
    component: Component,
    options: {
      priority?: number
      module: string
      featureFlag?: string
      defaultProps?: Record<string, any>
    }
  ): void {
    if (!this.slots.has(slotName)) {
      this.slots.set(slotName, [])
    }

    this.slots.get(slotName)!.push({
      component: markRaw(component),
      priority: options.priority ?? 50,
      module: options.module,
      featureFlag: options.featureFlag,
      defaultProps: options.defaultProps,
    })

    // 按 priority 排序
    this.slots.get(slotName)!.sort((a, b) => a.priority - b.priority)
  }

  /**
   * 获取某槽位的所有注册组件
   */
  getSlotEntries(slotName: SlotName): PluginSlotEntry[] {
    return this.slots.get(slotName) || []
  }

  /**
   * 移除某模块的所有注册
   */
  unregisterModule(module: string): void {
    for (const [name, entries] of this.slots) {
      this.slots.set(
        name,
        entries.filter((e) => e.module !== module)
      )
    }
  }

  /**
   * 获取所有已注册槽位信息（调试用）
   */
  getAllSlots(): Record<string, { module: string; priority: number; featureFlag?: string }[]> {
    const result: Record<string, any[]> = {}
    for (const [name, entries] of this.slots) {
      result[name] = entries.map((e) => ({
        module: e.module,
        priority: e.priority,
        featureFlag: e.featureFlag,
      }))
    }
    return result
  }

  /**
   * 清除所有注册（测试用）
   */
  clear(): void {
    this.slots.clear()
  }
}

// 单例导出
export const pluginSlotRegistry = new PluginSlotRegistry()
