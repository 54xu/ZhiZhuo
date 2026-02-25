<script setup lang="ts">
/**
 * 收银对账
 * 按日期查看收银员对账数据，包含支付方式明细和汇总
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { reportApi } from '@/api/report'

interface PaymentDetail {
  cash: number
  wechat: number
  member_balance: number
}

interface CashierItem {
  id: number | string
  name: string
  totalCollected: number
  orderCount: number
  paymentDetail: PaymentDetail
}

interface ReconciliationData {
  cashierList: CashierItem[]
}

const loading = ref(true)
const selectedDate = ref('')

const data = ref<ReconciliationData>({ cashierList: [] })

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMoney(val: number): string {
  return val.toFixed(2)
}

const grandTotal = computed(() => {
  const list = data.value.cashierList
  return {
    totalCollected: list.reduce((sum, c) => sum + c.totalCollected, 0),
    orderCount: list.reduce((sum, c) => sum + c.orderCount, 0),
    cash: list.reduce((sum, c) => sum + c.paymentDetail.cash, 0),
    wechat: list.reduce((sum, c) => sum + c.paymentDetail.wechat, 0),
    member_balance: list.reduce((sum, c) => sum + c.paymentDetail.member_balance, 0),
  }
})

async function fetchData() {
  if (!selectedDate.value) return
  loading.value = true
  try {
    const res = await reportApi.reconciliation(selectedDate.value)
    data.value = res.data
  } catch (e) {
    uni.showToast({ title: '数据加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function onDateChange(e: any) {
  selectedDate.value = e.detail.value
  fetchData()
}

onLoad(() => {
  selectedDate.value = formatDate(new Date())
  fetchData()
})
</script>

<template>
  <view class="page">
    <!-- 日期选择 -->
    <view class="date-bar">
      <text class="date-label">对账日期</text>
      <picker mode="date" :value="selectedDate" @change="onDateChange">
        <view class="date-picker-btn">
          <text class="date-picker-text">{{ selectedDate }}</text>
          <text class="date-picker-icon">&#9662;</text>
        </view>
      </picker>
    </view>

    <view class="body" v-if="!loading">
      <view class="empty-state" v-if="!data.cashierList.length">
        <text class="empty-text">当日暂无对账数据</text>
      </view>

      <template v-else>
        <!-- 收银员明细 -->
        <view class="cashier-card" v-for="cashier in data.cashierList" :key="cashier.id">
          <!-- 收银员头部 -->
          <view class="cashier-header">
            <view class="cashier-avatar">
              <text class="avatar-text">{{ cashier.name.charAt(0) }}</text>
            </view>
            <view class="cashier-info">
              <text class="cashier-name">{{ cashier.name }}</text>
              <text class="cashier-orders">{{ cashier.orderCount }} 单</text>
            </view>
            <view class="cashier-total">
              <text class="total-amount">{{ formatMoney(cashier.totalCollected) }}</text>
              <text class="total-label">元</text>
            </view>
          </view>

          <!-- 支付明细 -->
          <view class="payment-breakdown">
            <view class="payment-row">
              <view class="payment-dot cash"></view>
              <text class="payment-name">现金</text>
              <text class="payment-val">{{ formatMoney(cashier.paymentDetail.cash) }} 元</text>
            </view>
            <view class="payment-row">
              <view class="payment-dot wechat"></view>
              <text class="payment-name">微信支付</text>
              <text class="payment-val">{{ formatMoney(cashier.paymentDetail.wechat) }} 元</text>
            </view>
            <view class="payment-row">
              <view class="payment-dot balance"></view>
              <text class="payment-name">会员余额</text>
              <text class="payment-val">{{ formatMoney(cashier.paymentDetail.member_balance) }} 元</text>
            </view>
          </view>
        </view>

        <!-- 汇总 -->
        <view class="grand-total-card">
          <text class="grand-title">当日汇总</text>
          <view class="grand-row main">
            <text class="grand-label">合计收款</text>
            <text class="grand-value primary">{{ formatMoney(grandTotal.totalCollected) }} 元</text>
          </view>
          <view class="grand-row">
            <text class="grand-label">合计订单</text>
            <text class="grand-value">{{ grandTotal.orderCount }} 单</text>
          </view>
          <view class="grand-divider"></view>
          <view class="grand-row">
            <view class="payment-dot cash small"></view>
            <text class="grand-label">现金合计</text>
            <text class="grand-value">{{ formatMoney(grandTotal.cash) }} 元</text>
          </view>
          <view class="grand-row">
            <view class="payment-dot wechat small"></view>
            <text class="grand-label">微信合计</text>
            <text class="grand-value">{{ formatMoney(grandTotal.wechat) }} 元</text>
          </view>
          <view class="grand-row">
            <view class="payment-dot balance small"></view>
            <text class="grand-label">余额合计</text>
            <text class="grand-value">{{ formatMoney(grandTotal.member_balance) }} 元</text>
          </view>
        </view>
      </template>
    </view>

    <view class="loading-wrap" v-else>
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
}

/* 日期栏 */
.date-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  padding: 24rpx 32rpx;
}
.date-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}
.date-picker-btn {
  display: flex;
  align-items: center;
  background-color: #f5f6fa;
  padding: 12rpx 24rpx;
  border-radius: 8rpx;
  gap: 8rpx;
}
.date-picker-text {
  font-size: 28rpx;
  color: #4a90d9;
  font-weight: 500;
}
.date-picker-icon {
  font-size: 22rpx;
  color: #4a90d9;
}

.body {
  padding: 24rpx;
}

/* 收银员卡片 */
.cashier-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.cashier-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}
.cashier-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  flex-shrink: 0;
}
.avatar-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}
.cashier-info {
  flex: 1;
}
.cashier-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
}
.cashier-orders {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}
.cashier-total {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}
.total-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
}
.total-label {
  font-size: 22rpx;
  color: #999;
}

/* 支付明细 */
.payment-breakdown {
  background-color: #fafbfc;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.payment-row {
  display: flex;
  align-items: center;
}
.payment-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.payment-dot.small {
  width: 12rpx;
  height: 12rpx;
  margin-right: 10rpx;
}
.payment-dot.cash {
  background-color: #4cd964;
}
.payment-dot.wechat {
  background-color: #4a90d9;
}
.payment-dot.balance {
  background-color: #ff9500;
}
.payment-name {
  flex: 1;
  font-size: 26rpx;
  color: #666;
}
.payment-val {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

/* 汇总卡片 */
.grand-total-card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  margin-top: 8rpx;
}
.grand-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}
.grand-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}
.grand-row.main {
  padding: 14rpx 0;
}
.grand-label {
  flex: 1;
  font-size: 28rpx;
  color: #666;
}
.grand-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}
.grand-value.primary {
  font-size: 34rpx;
  color: #4a90d9;
  font-weight: 700;
}
.grand-divider {
  height: 1rpx;
  background-color: #f0f0f0;
  margin: 14rpx 0;
}

/* 空状态 */
.empty-state {
  padding: 120rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 28rpx;
  color: #ccc;
}

.loading-wrap {
  display: flex;
  justify-content: center;
  padding-top: 200rpx;
}
.loading-text {
  font-size: 28rpx;
  color: #999;
}
</style>
