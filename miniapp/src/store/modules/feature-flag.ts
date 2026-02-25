/**
 * 功能开关 Store
 *
 * 启动时从后端拉取当前门店的功能开关配置
 * 前端所有模块通过此 Store 判断是否显示
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface FeatureFlagData {
  enabled: boolean
  config: Record<string, any> | null
}

export const useFeatureFlagStore = defineStore('featureFlag', () => {
  // 状态
  const flags = ref<Record<string, FeatureFlagData>>({})
  const loaded = ref(false)
  const loading = ref(false)

  /**
   * 从后端加载功能开关
   */
  async function loadFlags(storeId: number): Promise<void> {
    if (loading.value) return
    loading.value = true

    try {
      const res = await uni.request({
        url: `${import.meta.env.VITE_API_BASE_URL}/api/v1/feature-flags?storeId=${storeId}`,
        method: 'GET',
      })

      const data = (res as any).data
      if (data.code === 0) {
        flags.value = data.data
        loaded.value = true
      }
    } catch (error) {
      console.error('[FeatureFlagStore] Failed to load flags:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 检查某功能是否启用
   */
  function isEnabled(flagKey: string): boolean {
    return flags.value[flagKey]?.enabled ?? false
  }

  /**
   * 获取某功能的配置
   */
  function getConfig<T = Record<string, any>>(flagKey: string): T | null {
    return (flags.value[flagKey]?.config as T) ?? null
  }

  /**
   * 获取所有已启用的模块 key 列表
   */
  const enabledModules = computed<string[]>(() => {
    return Object.entries(flags.value)
      .filter(([_, v]) => v.enabled)
      .map(([k]) => k)
  })

  /**
   * 刷新功能开关（手动触发）
   */
  async function refresh(storeId: number): Promise<void> {
    loaded.value = false
    await loadFlags(storeId)
  }

  return {
    flags,
    loaded,
    loading,
    enabledModules,
    loadFlags,
    isEnabled,
    getConfig,
    refresh,
  }
})
