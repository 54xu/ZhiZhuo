<script setup lang="ts">
/**
 * PluginSlot 通用组件
 *
 * 在核心页面中使用：<PluginSlot name="checkout-discounts" :context="{ order, member }" />
 * V2/V3 模块注册的组件会自动渲染在此处
 * 如果没有任何模块注册，槽位不占用空间
 */
import { computed } from 'vue'
import { pluginSlotRegistry, type SlotName, type PluginSlotEntry } from '@/core/plugin-slot'
import { useFeatureFlagStore } from '@/store/modules/feature-flag'

const props = defineProps<{
  /** 槽位名称 */
  name: SlotName
  /** 传递给插件组件的上下文数据 */
  context?: Record<string, any>
  /** 布局方向 */
  direction?: 'vertical' | 'horizontal'
}>()

const featureFlagStore = useFeatureFlagStore()

/** 过滤后的可见插件列表（检查功能开关） */
const visibleEntries = computed<PluginSlotEntry[]>(() => {
  const entries = pluginSlotRegistry.getSlotEntries(props.name)
  return entries.filter((entry) => {
    // 没有绑定功能开关的组件始终显示
    if (!entry.featureFlag) return true
    // 检查功能开关是否启用
    return featureFlagStore.isEnabled(entry.featureFlag)
  })
})
</script>

<template>
  <view
    v-if="visibleEntries.length > 0"
    :class="['plugin-slot', `plugin-slot--${direction || 'vertical'}`]"
  >
    <component
      v-for="(entry, index) in visibleEntries"
      :key="`${name}-${entry.module}-${index}`"
      :is="entry.component"
      v-bind="{ ...entry.defaultProps, ...context }"
    />
  </view>
</template>

<style scoped>
.plugin-slot--vertical {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.plugin-slot--horizontal {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  flex-wrap: wrap;
}
</style>
