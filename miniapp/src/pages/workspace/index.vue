<script setup lang="ts">
/**
 * 工作台 - 房台总览（首页）
 * 按区域分组展示所有房间/房台的当前状态
 * 含 PluginSlot: workspace-toolbar
 */
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import PluginSlot from '@/components/PluginSlot.vue'
import { useRoomStore } from '@/store/modules/room'
import { useUserStore } from '@/store/modules/user'
import { reportApi } from '@/api/report'

const roomStore = useRoomStore()
const userStore = useUserStore()

const activeZone = ref<number | null>(null)
const dashboard = ref<Record<string, any>>({})

const filteredZones = computed(() => {
  if (activeZone.value === null) return roomStore.zones
  return roomStore.zones.filter((z: any) => z.id === activeZone.value)
})

const statusColor: Record<string, string> = {
  idle: '#4cd964', in_use: '#ff9500', pending_clean: '#ff3b30', disabled: '#c7c7cc',
}
const statusText: Record<string, string> = {
  idle: '空闲', in_use: '使用中', pending_clean: '待清理', disabled: '停用',
}

onShow(async () => {
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  await Promise.all([roomStore.loadOverview(), loadDashboard()])
})

async function loadDashboard() {
  try { const { data } = await reportApi.dashboard(); dashboard.value = data } catch { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

function onRoomTap(room: any) {
  if (room.currentStatus === 'idle') {
    uni.navigateTo({ url: `/sub-packages/cashier/create?roomId=${room.id}&roomName=${room.name}` })
  } else if (room.orders?.[0]) {
    uni.navigateTo({ url: `/sub-packages/cashier/detail?orderId=${room.orders[0].id}` })
  } else if (room.currentStatus === 'pending_clean') {
    uni.showModal({
      title: '确认清台',
      content: `将 ${room.name} 设为空闲？`,
      success: async (res) => { if (res.confirm) await roomStore.updateRoomStatus(room.id, 'idle') },
    })
  }
}
</script>

<template>
  <view class="workspace">
    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-value">{{ dashboard.revenue || '0' }}</text>
        <text class="stat-label">今日营收(元)</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{ dashboard.orderCount || 0 }}</text>
        <text class="stat-label">今日单数</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{ roomStore.stats.in_use || 0 }}</text>
        <text class="stat-label">在用房台</text>
      </view>
    </view>

    <PluginSlot name="workspace-toolbar" direction="horizontal" />

    <scroll-view scroll-x class="zone-tabs">
      <text class="zone-tab" :class="{ active: activeZone === null }" @tap="activeZone = null">全部</text>
      <text v-for="zone in roomStore.zones" :key="zone.id" class="zone-tab"
        :class="{ active: activeZone === zone.id }" @tap="activeZone = zone.id">{{ zone.name }}</text>
    </scroll-view>

    <view v-if="filteredZones.length > 0" class="zone-groups">
      <view v-for="zone in filteredZones" :key="zone.id" class="zone-group">
        <text class="zone-title">{{ zone.name }}</text>
        <view class="room-grid">
          <view v-for="room in zone.rooms" :key="room.id" class="room-card"
            :style="{ borderLeftColor: statusColor[room.currentStatus] || '#ccc' }" @tap="onRoomTap(room)">
            <text class="room-name">{{ room.name }}</text>
            <text class="room-status" :style="{ color: statusColor[room.currentStatus] }">
              {{ statusText[room.currentStatus] || room.currentStatus }}
            </text>
            <view v-if="room.orders?.[0]" class="room-info">
              <text class="room-info-text">{{ room.orders[0].member?.name || '散客' }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="room-placeholder">
      <text>暂无房台数据</text>
      <text class="sub-text">请先在系统管理中添加区域和房台</text>
    </view>
  </view>
</template>

<style scoped>
.workspace { padding: 20rpx; background-color: #f5f6fa; min-height: 100vh; }
.stats-bar {
  display: flex; justify-content: space-around;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx; padding: 30rpx 20rpx; margin-bottom: 20rpx;
}
.stat-item { text-align: center; }
.stat-value { font-size: 40rpx; font-weight: bold; color: #fff; display: block; }
.stat-label { font-size: 24rpx; color: rgba(255,255,255,0.8); margin-top: 8rpx; }
.zone-tabs { display: flex; gap: 16rpx; margin-bottom: 20rpx; white-space: nowrap; }
.zone-tab {
  padding: 12rpx 28rpx; border-radius: 24rpx; font-size: 26rpx;
  background: #fff; color: #666; display: inline-block;
}
.zone-tab.active { background: #4a90d9; color: #fff; }
.zone-group { margin-bottom: 24rpx; }
.zone-title { font-size: 28rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; display: block; }
.room-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.room-card {
  width: calc(33.33% - 12rpx); background: #fff; border-radius: 12rpx;
  padding: 20rpx; border-left: 6rpx solid #ccc; box-sizing: border-box;
}
.room-name { font-size: 28rpx; font-weight: bold; color: #333; display: block; }
.room-status { font-size: 24rpx; margin-top: 8rpx; display: block; }
.room-info { margin-top: 8rpx; }
.room-info-text { font-size: 22rpx; color: #999; }
.room-placeholder {
  width: 100%; padding: 100rpx 40rpx; text-align: center;
  background: #fff; border-radius: 16rpx; color: #999; font-size: 28rpx;
}
.sub-text { display: block; font-size: 24rpx; margin-top: 12rpx; color: #ccc; }
</style>
