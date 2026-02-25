<script setup lang="ts">
/**
 * 订单详情
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { orderApi } from '@/api/order'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()
const order = ref<any>(null)

onLoad(async (options: any) => {
  const orderId = Number(options?.orderId || 0)
  if (orderId) {
    const { data } = await orderApi.detail(orderId)
    order.value = data
  }
})

function goCheckout() {
  if (!order.value) return
  uni.navigateTo({ url: `/sub-packages/cashier/checkout?orderId=${order.value.id}` })
}
function goModify() {
  if (!order.value) return
  uni.navigateTo({ url: `/sub-packages/cashier/modify?orderId=${order.value.id}` })
}

const statusMap: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', completed: '已完成', cancelled: '已取消', refunded: '已退款',
}
</script>

<template>
  <view class="detail-page" v-if="order">
    <view class="section">
      <view class="order-header">
        <text class="order-no">{{ order.orderNo }}</text>
        <text class="order-status">{{ statusMap[order.orderStatus] || order.orderStatus }}</text>
      </view>
      <text class="info-line">房台: {{ order.room?.name }}</text>
      <text class="info-line">顾客: {{ order.member?.name || order.customerName || '散客' }}</text>
      <text class="info-line">收银员: {{ order.cashier?.name }}</text>
    </view>

    <view class="section">
      <text class="section-title">消费明细</text>
      <view v-for="item in order.orderItems" :key="item.id" class="detail-item">
        <view class="item-left">
          <text class="item-name">{{ item.service?.name }}</text>
          <text class="item-tech">技师: {{ item.technician?.name }}</text>
        </view>
        <text class="item-price">{{ item.isVisitCard ? '次卡' : `¥${item.subtotal}` }}</text>
      </view>
    </view>

    <view class="section amount-section">
      <view class="amount-row"><text>原价</text><text>¥{{ order.totalAmount }}</text></view>
      <view v-if="Number(order.discountAmount) > 0" class="amount-row"><text>优惠</text><text>-¥{{ order.discountAmount }}</text></view>
      <view class="amount-row total-row"><text>实收</text><text class="actual">¥{{ order.actualAmount }}</text></view>
    </view>

    <view v-if="order.orderStatus === 'in_progress'" class="bottom-actions">
      <button class="btn-outline" @tap="goModify">加单/改单</button>
      <button class="btn-primary" @tap="goCheckout">去结账</button>
    </view>
  </view>
</template>

<style scoped>
.detail-page { padding: 20rpx; padding-bottom: 140rpx; background: #f5f6fa; min-height: 100vh; }
.section { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; }
.section-title { font-size: 28rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; display: block; }
.order-header { display: flex; justify-content: space-between; margin-bottom: 16rpx; }
.order-no { font-size: 26rpx; color: #999; }
.order-status { font-size: 28rpx; font-weight: bold; color: #4a90d9; }
.info-line { font-size: 26rpx; color: #666; display: block; margin-bottom: 8rpx; }
.detail-item { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.item-left { flex: 1; }
.item-name { font-size: 28rpx; color: #333; display: block; }
.item-tech { font-size: 24rpx; color: #999; }
.item-price { font-size: 28rpx; color: #ff9500; }
.amount-row { display: flex; justify-content: space-between; padding: 12rpx 0; font-size: 28rpx; color: #666; }
.total-row { border-top: 1rpx solid #eee; padding-top: 16rpx; }
.actual { font-size: 36rpx; font-weight: bold; color: #ff3b30; }
.bottom-actions { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 20rpx; padding: 16rpx 24rpx; background: #fff; }
.btn-outline { flex: 1; height: 80rpx; line-height: 80rpx; border: 2rpx solid #4a90d9; color: #4a90d9; border-radius: 40rpx; font-size: 30rpx; background: #fff; }
.btn-primary { flex: 1; height: 80rpx; line-height: 80rpx; background: #4a90d9; color: #fff; border-radius: 40rpx; font-size: 30rpx; border: none; }
</style>
