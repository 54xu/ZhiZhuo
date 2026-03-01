<script setup lang="ts">
/**
 * 客表 - 今日顾客列表
 */
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useOrderStore } from '@/store/modules/order'

const orderStore = useOrderStore()
const activeTab = ref('')

const statusTabs = [
  { label: '全部', value: '' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已退款', value: 'refunded' },
]

onShow(() => { loadData() })

async function loadData() {
  await orderStore.loadTodayCustomers(activeTab.value || undefined)
}

function switchTab(val: string) {
  activeTab.value = val
  loadData()
}

function onOrderTap(order: any) {
  uni.navigateTo({ url: `/sub-packages/cashier/detail?orderId=${order.id}` })
}

function formatTime(t: string) {
  if (!t) return ''
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const statusMap: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', completed: '已完成', cancelled: '已取消', refunded: '已退款',
}
const statusColorMap: Record<string, string> = {
  pending: '#ff9500', in_progress: '#4a90d9', completed: '#4cd964', cancelled: '#c7c7cc', refunded: '#ff3b30',
}
</script>

<template>
  <view class="customer-page">
    <scroll-view scroll-x class="tabs">
      <text v-for="tab in statusTabs" :key="tab.value" class="tab-item"
        :class="{ active: activeTab === tab.value }" @tap="switchTab(tab.value)">{{ tab.label }}</text>
    </scroll-view>

    <view v-if="orderStore.todayCustomers.length > 0" class="order-list">
      <view v-for="order in orderStore.todayCustomers" :key="order.id" class="order-card" @tap="onOrderTap(order)">
        <view class="order-header">
          <text class="order-no">{{ order.orderNo }}</text>
          <text class="order-status" :style="{ color: statusColorMap[order.orderStatus] }">
            {{ statusMap[order.orderStatus] || order.orderStatus }}
          </text>
        </view>
        <view class="order-body">
          <text class="order-info">{{ order.room?.name || '-' }} · {{ order.member?.name || order.customerName || '散客' }}</text>
          <text class="order-time">{{ formatTime(order.createdAt) }}</text>
        </view>
        <view class="order-services">
          <text v-for="(item, idx) in order.orderItems" :key="idx" class="service-tag">
            {{ item.service?.name }} ({{ item.technician?.name }})
          </text>
        </view>
      </view>
    </view>
    <view v-else class="empty">
      <text>今日暂无顾客记录</text>
    </view>
  </view>
</template>

<style scoped>
.customer-page { padding: 20rpx; background: #f5f6fa; min-height: 100vh; }
.tabs { display: flex; gap: 16rpx; margin-bottom: 20rpx; white-space: nowrap; }
.tab-item { padding: 12rpx 28rpx; border-radius: 24rpx; font-size: 26rpx; background: #fff; color: #666; display: inline-block; }
.tab-item.active { background: #4a90d9; color: #fff; }
.order-list { display: flex; flex-direction: column; gap: 16rpx; }
.order-card { background: #fff; border-radius: 12rpx; padding: 24rpx; }
.order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.order-no { font-size: 26rpx; color: #999; }
.order-status { font-size: 26rpx; font-weight: bold; }
.order-body { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.order-info { font-size: 28rpx; color: #333; font-weight: bold; }
.order-time { font-size: 24rpx; color: #999; }
.order-services { display: flex; flex-wrap: wrap; gap: 8rpx; }
.service-tag { font-size: 22rpx; background: #f0f5ff; color: #4a90d9; padding: 4rpx 12rpx; border-radius: 8rpx; }
.empty { padding: 100rpx; text-align: center; color: #999; font-size: 28rpx; }
</style>
