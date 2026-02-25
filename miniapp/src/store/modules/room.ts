import { defineStore } from 'pinia'
import { ref } from 'vue'
import { roomApi } from '@/api/room'

export const useRoomStore = defineStore('room', () => {
  const zones = ref<any[]>([])
  const stats = ref<Record<string, number>>({})
  const loading = ref(false)

  /** 加载房台总览 */
  async function loadOverview() {
    loading.value = true
    try {
      const { data } = await roomApi.overview()
      zones.value = data.zones
      stats.value = data.stats
    } finally {
      loading.value = false
    }
  }

  /** 更新房台状态 */
  async function updateRoomStatus(roomId: number, status: string) {
    await roomApi.updateStatus(roomId, status)
    await loadOverview()
  }

  return { zones, stats, loading, loadOverview, updateRoomStatus }
})
