<script setup lang="ts">
/**
 * 营收统计
 * 按时间段统计营收数据，支持支付方式分布和每日明细
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { reportApi } from '@/api/report'

interface PaymentBreakdown {
  type: string
  label: string
  amount: number
}

interface DailyItem {
  date: string
  revenue: number
  orderCount: number
}

interface RevenueData {
  totalRevenue: number
  previousPeriodRevenue: number
  paymentBreakdown: PaymentBreakdown[]
  dailyData: DailyItem[]
}

type PeriodType = 'today' | 'week' | 'month' | 'custom'

const periods: { key: PeriodType; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'custom', label: '自定义' },
]

const activePeriod = ref<PeriodType>('today')
const loading = ref(true)
const customStartDate = ref('')
const customEndDate = ref('')

const data = ref<RevenueData>({
  totalRevenue: 0,
  previousPeriodRevenue: 0,
  paymentBreakdown: [],
  dailyData: [],
})

const paymentTypeLabels: Record<string, string> = {
  cash: '现金',
  wechat: '微信支付',
  member_balance: '会员余额',
  visit_card: '次卡',
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMoney(val: number): string {
  return val.toFixed(2)
}

function getDateRange(period: PeriodType): { startDate: string; endDate: string } {
  const now = new Date()
  const today = formatDate(now)

  switch (period) {
    case 'today':
      return { startDate: today, endDate: today }
    case 'week': {
      const dayOfWeek = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + 1)
      return { startDate: formatDate(monday), endDate: today }
    }
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: formatDate(firstDay), endDate: today }
    }
    case 'custom':
      return { startDate: customStartDate.value, endDate: customEndDate.value }
  }
}

const revenueChange = computed(() => {
  const prev = data.value.previousPeriodRevenue
  if (!prev) return null
  const diff = data.value.totalRevenue - prev
  const percent = ((diff / prev) * 100).toFixed(1)
  return { diff, percent, isUp: diff >= 0 }
})

const maxPayment = computed(() => {
  if (!data.value.paymentBreakdown.length) return 1
  return Math.max(...data.value.paymentBreakdown.map((p) => p.amount), 1)
})

async function fetchData() {
  const range = getDateRange(activePeriod.value)
  if (activePeriod.value === 'custom' && (!range.startDate || !range.endDate)) {
    return
  }
  loading.value = true
  try {
    const res = await reportApi.revenue(range.startDate, range.endDate)
    data.value = res.data
  } catch (e) {
    uni.showToast({ title: '数据加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchPeriod(period: PeriodType) {
  activePeriod.value = period
  if (period !== 'custom') {
    fetchData()
  }
}

function onStartDateChange(e: any) {
  customStartDate.value = e.detail.value
  if (customEndDate.value) fetchData()
}

function onEndDateChange(e: any) {
  customEndDate.value = e.detail.value
  if (customStartDate.value) fetchData()
}

function getPaymentLabel(type: string): string {
  return paymentTypeLabels[type] || type
}

function getBarWidth(amount: number): string {
  return ((amount / maxPayment.value) * 100).toFixed(1) + '%'
}

onLoad(() => {
  const now = new Date()
  customStartDate.value = formatDate(new Date(now.getFullYear(), now.getMonth(), 1))
  customEndDate.value = formatDate(now)
  fetchData()
})
</script>

<template>
  <view class="page">
    <!-- 期间选择 -->
    <view class="period-bar">
      <view
        v-for="p in periods"
        :key="p.key"
        :class="['period-tab', activePeriod === p.key ? 'active' : '']"
        @tap="switchPeriod(p.key)"
      >
        <text class="period-text">{{ p.label }}</text>
      </view>
    </view>

    <!-- 自定义日期选择 -->
    <view class="date-picker-row" v-if="activePeriod === 'custom'">
      <picker mode="date" :value="customStartDate" @change="onStartDateChange">
        <view class="date-input">
          <text class="date-input-text">{{ customStartDate || '开始日期' }}</text>
        </view>
      </picker>
      <text class="date-sep">至</text>
      <picker mode="date" :value="customEndDate" @change="onEndDateChange">
        <view class="date-input">
          <text class="date-input-text">{{ customEndDate || '结束日期' }}</text>
        </view>
      </picker>
    </view>

    <view class="body" v-if="!loading">
      <!-- 汇总卡片 -->
      <view class="summary-card">
        <text class="summary-label">总营收</text>
        <text class="summary-value">{{ formatMoney(data.totalRevenue) }}</text>
        <view class="summary-change" v-if="revenueChange">
          <text :class="['change-text', revenueChange.isUp ? 'up' : 'down']">
            {{ revenueChange.isUp ? '+' : '' }}{{ revenueChange.percent }}%
          </text>
          <text class="change-hint">较上一周期</text>
        </view>
      </view>

      <!-- 支付方式分布 -->
      <view class="card">
        <text class="card-title">支付方式分布</text>
        <view class="payment-list">
          <view class="payment-item" v-for="item in data.paymentBreakdown" :key="item.type">
            <view class="payment-header">
              <text class="payment-label">{{ getPaymentLabel(item.type) }}</text>
              <text class="payment-amount">{{ formatMoney(item.amount) }} 元</text>
            </view>
            <view class="payment-bar-bg">
              <view class="payment-bar-fill" :style="{ width: getBarWidth(item.amount) }"></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 每日明细 -->
      <view class="card">
        <text class="card-title">每日明细</text>
        <view class="table">
          <view class="table-header">
            <text class="table-th col-date">日期</text>
            <text class="table-th col-revenue">营收</text>
            <text class="table-th col-count">订单数</text>
          </view>
          <scroll-view scroll-y class="table-body" style="max-height: 600rpx">
            <view class="table-row" v-for="item in data.dailyData" :key="item.date">
              <text class="table-td col-date">{{ item.date }}</text>
              <text class="table-td col-revenue">{{ formatMoney(item.revenue) }}</text>
              <text class="table-td col-count">{{ item.orderCount }}</text>
            </view>
            <view class="empty-row" v-if="!data.dailyData.length">
              <text class="empty-text">暂无数据</text>
            </view>
          </scroll-view>
        </view>
      </view>
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

/* 期间选择 */
.period-bar {
  display: flex;
  background-color: #fff;
  padding: 16rpx 24rpx;
  gap: 12rpx;
}
.period-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 8rpx;
  background-color: #f5f6fa;
}
.period-tab.active {
  background-color: #4a90d9;
}
.period-text {
  font-size: 26rpx;
  color: #666;
}
.period-tab.active .period-text {
  color: #fff;
  font-weight: 600;
}

/* 自定义日期 */
.date-picker-row {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background-color: #fff;
  border-top: 1rpx solid #f0f0f0;
}
.date-input {
  flex: 1;
  background-color: #f5f6fa;
  border-radius: 8rpx;
  padding: 14rpx 20rpx;
}
.date-input-text {
  font-size: 26rpx;
  color: #333;
}
.date-sep {
  font-size: 26rpx;
  color: #999;
  margin: 0 16rpx;
}

.body {
  padding: 24rpx;
}

/* 汇总卡片 */
.summary-card {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx;
  padding: 36rpx 28rpx;
  margin-bottom: 16rpx;
}
.summary-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  display: block;
}
.summary-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #fff;
  display: block;
  margin-top: 8rpx;
}
.summary-change {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
  gap: 8rpx;
}
.change-text {
  font-size: 26rpx;
  font-weight: 600;
}
.change-text.up {
  color: #4cd964;
}
.change-text.down {
  color: #ff3b30;
}
.change-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.6);
}

/* 卡片 */
.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

/* 支付方式 */
.payment-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.payment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}
.payment-label {
  font-size: 26rpx;
  color: #666;
}
.payment-amount {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}
.payment-bar-bg {
  height: 16rpx;
  background-color: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}
.payment-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #6ab0f3);
  border-radius: 8rpx;
  transition: width 0.3s;
}

/* 表格 */
.table {
  border: 1rpx solid #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}
.table-header {
  display: flex;
  background-color: #fafafa;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.table-th {
  font-size: 24rpx;
  color: #999;
  font-weight: 500;
}
.table-row {
  display: flex;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.table-td {
  font-size: 26rpx;
  color: #333;
}
.col-date {
  flex: 2;
}
.col-revenue {
  flex: 2;
  text-align: right;
}
.col-count {
  flex: 1;
  text-align: right;
}

.empty-row {
  padding: 40rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 26rpx;
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
