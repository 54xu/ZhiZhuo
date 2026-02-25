<script setup lang="ts">
/**
 * 结账页
 * 消费明细 + 金额汇总 + 支付方式选择
 * 含 PluginSlot: checkout-discounts, checkout-payment-types
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import PluginSlot from '@/components/PluginSlot.vue'
import { useOrderStore } from '@/store/modules/order'
import { orderApi } from '@/api/order'

const orderStore = useOrderStore()
const order = ref<any>(null)
const paymentType = ref('cash')
const submitting = ref(false)

const paymentTypes = [
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信支付' },
  { value: 'member_balance', label: '会员余额' },
]

const totalAmount = computed(() => order.value?.totalAmount || '0')
const actualAmount = computed(() => order.value?.actualAmount || order.value?.totalAmount || '0')

onLoad(async (options: any) => {
  const orderId = Number(options?.orderId || 0)
  if (orderId) {
    const { data } = await orderApi.detail(orderId)
    order.value = data
  }
})

async function handleCheckout() {
  if (!order.value) return
  submitting.value = true
  try {
    await orderStore.checkout(order.value.id, paymentType.value)
    uni.showToast({ title: '结账成功', icon: 'success' })
    setTimeout(() => { uni.navigateBack({ delta: 2 }) }, 800)
  } catch (e: any) {
    uni.showToast({ title: e.message || '结账失败', icon: 'none' })
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="checkout-page">
    <view v-if="order" class="content">
      <view class="section">
        <text class="section-title">消费明细</text>
        <view v-for="item in order.orderItems" :key="item.id" class="detail-item">
          <text class="detail-name">{{ item.service?.name }}</text>
          <text class="detail-tech">{{ item.technician?.name }}</text>
          <text class="detail-price">¥{{ item.subtotal }}</text>
        </view>
      </view>

      <PluginSlot name="checkout-discounts" :context="{ order }" />

      <view class="section amount-section">
        <view class="amount-row">
          <text>原价</text><text>¥{{ totalAmount }}</text>
        </view>
        <view class="amount-row total-row">
          <text>应收</text><text class="actual">¥{{ actualAmount }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">支付方式</text>
        <view v-for="pt in paymentTypes" :key="pt.value" class="payment-option"
          :class="{ active: paymentType === pt.value }" @tap="paymentType = pt.value">
          <text>{{ pt.label }}</text>
        </view>
        <PluginSlot name="checkout-payment-types" :context="{ order }" />
      </view>

      <view class="bottom-bar">
        <text class="pay-amount">¥{{ actualAmount }}</text>
        <button class="pay-btn" :loading="submitting" @tap="handleCheckout">确认收款</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.checkout-page { padding: 20rpx; padding-bottom: 140rpx; background: #f5f6fa; min-height: 100vh; }
.section { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; }
.section-title { font-size: 28rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; display: block; }
.detail-item { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.detail-name { font-size: 28rpx; color: #333; flex: 1; }
.detail-tech { font-size: 24rpx; color: #999; margin-right: 20rpx; }
.detail-price { font-size: 28rpx; color: #ff9500; }
.amount-section { }
.amount-row { display: flex; justify-content: space-between; padding: 12rpx 0; font-size: 28rpx; color: #666; }
.total-row { border-top: 1rpx solid #eee; padding-top: 16rpx; margin-top: 8rpx; }
.actual { font-size: 36rpx; font-weight: bold; color: #ff3b30; }
.payment-option {
  padding: 20rpx; border: 2rpx solid #eee; border-radius: 12rpx;
  margin-bottom: 12rpx; font-size: 28rpx; color: #333;
}
.payment-option.active { border-color: #4a90d9; background: #f0f5ff; color: #4a90d9; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; padding: 16rpx 24rpx; background: #fff; box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05); }
.pay-amount { flex: 1; font-size: 40rpx; font-weight: bold; color: #ff3b30; }
.pay-btn { width: 280rpx; height: 80rpx; line-height: 80rpx; background: #4a90d9; color: #fff; border-radius: 40rpx; font-size: 30rpx; border: none; }
</style>
