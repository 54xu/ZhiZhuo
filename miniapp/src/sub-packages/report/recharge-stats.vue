<script setup lang="ts">
/**
 * 充值统计
 * 会员充值数据统计，包含方案分布和每日趋势
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { reportApi } from '@/api/report'

interface PlanItem {
  planName: string
  count: number
  totalPaid: number
  totalGift: number
}

interface DailyRecharge {
  date: string
  amount: number
}

interface RechargeStatsData {
  totalIncome: number
  totalGift: number
  rechargeCount: number
  planBreakdown: PlanItem[]
  dailyTrend: DailyRecharge[]
}

type PeriodType = 'month' | 'lastMonth' | 'custom'

const periods: { key: PeriodType; label: string }[] = [
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'custom', label: '自定义' },
]

const activePeriod = ref<PeriodType>('month')
const loading = ref(true)
const customStartDate = ref('')
const customEndDate = ref('')

const data = ref<RechargeStatsData>({
  totalIncome: 0,
  totalGift: 0,
  rechargeCount: 0,
  planBreakdown: [],
  dailyTrend: [],
})

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
  switch (period) {
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: formatDate(firstDay), endDate: formatDate(now) }
    }
    case 'lastMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: formatDate(firstDay), endDate: formatDate(lastDay) }
    }
    case 'custom':
      return { startDate: customStartDate.value, endDate: customEndDate.value }
  }
}

async function fetchData() {
  const range = getDateRange(activePeriod.value)
  if (activePeriod.value === 'custom' && (!range.startDate || !range.endDate)) {
    return
  }
  loading.value = true
  try {
    const res = await reportApi.rechargeStats(range.startDate, range.endDate)
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

    <!-- 自定义日期 -->
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
      <!-- 汇总指标 -->
      <view class="summary-row">
        <view class="summary-card primary-bg">
          <text class="summary-val">{{ formatMoney(data.totalIncome) }}</text>
          <text class="summary-lbl">实收金额 (元)</text>
        </view>
        <view class="summary-card warning-bg">
          <text class="summary-val">{{ formatMoney(data.totalGift) }}</text>
          <text class="summary-lbl">赠送金额 (元)</text>
        </view>
        <view class="summary-card">
          <text class="summary-val dark">{{ data.rechargeCount }}</text>
          <text class="summary-lbl dark-lbl">充值笔数</text>
        </view>
      </view>

      <!-- 方案分布 -->
      <view class="card">
        <text class="card-title">充值方案分布</text>

        <view class="empty-state" v-if="!data.planBreakdown.length">
          <text class="empty-text">暂无数据</text>
        </view>

        <view class="plan-table" v-else>
          <view class="plan-header">
            <text class="plan-th col-name">方案</text>
            <text class="plan-th col-count">笔数</text>
            <text class="plan-th col-paid">实收</text>
            <text class="plan-th col-gift">赠送</text>
          </view>
          <view class="plan-row" v-for="(plan, index) in data.planBreakdown" :key="index">
            <text class="plan-td col-name">{{ plan.planName }}</text>
            <text class="plan-td col-count">{{ plan.count }}</text>
            <text class="plan-td col-paid">{{ formatMoney(plan.totalPaid) }}</text>
            <text class="plan-td col-gift">{{ formatMoney(plan.totalGift) }}</text>
          </view>
        </view>
      </view>

      <!-- 每日趋势 -->
      <view class="card">
        <text class="card-title">每日充值趋势</text>

        <view class="empty-state" v-if="!data.dailyTrend.length">
          <text class="empty-text">暂无数据</text>
        </view>

        <scroll-view scroll-y class="trend-scroll" style="max-height: 600rpx" v-else>
          <view class="trend-header">
            <text class="trend-th col-date">日期</text>
            <text class="trend-th col-amount">充值金额</text>
          </view>
          <view class="trend-row" v-for="item in data.dailyTrend" :key="item.date">
            <text class="trend-td col-date">{{ item.date }}</text>
            <text class="trend-td col-amount">{{ formatMoney(item.amount) }}</text>
          </view>
        </scroll-view>
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

/* 日期选择器 */
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

/* 汇总指标 */
.summary-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.summary-card {
  flex: 1;
  border-radius: 12rpx;
  padding: 24rpx 12rpx;
  text-align: center;
  background-color: #fff;
}
.summary-card.primary-bg {
  background: linear-gradient(135deg, #4a90d9, #357abd);
}
.summary-card.warning-bg {
  background: linear-gradient(135deg, #ff9500, #e68600);
}
.summary-val {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
  display: block;
}
.summary-val.dark {
  color: #333;
}
.summary-lbl {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 6rpx;
  display: block;
}
.summary-lbl.dark-lbl {
  color: #999;
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

/* 方案表格 */
.plan-table {
  border: 1rpx solid #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}
.plan-header {
  display: flex;
  background-color: #fafafa;
  padding: 16rpx 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.plan-th {
  font-size: 24rpx;
  color: #999;
  font-weight: 500;
}
.plan-row {
  display: flex;
  padding: 16rpx 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.plan-row:last-child {
  border-bottom: none;
}
.plan-td {
  font-size: 26rpx;
  color: #333;
}
.col-name {
  flex: 2;
}
.col-count {
  flex: 1;
  text-align: center;
}
.col-paid {
  flex: 1.5;
  text-align: right;
}
.col-gift {
  flex: 1.5;
  text-align: right;
}

/* 趋势表 */
.trend-scroll {
  border: 1rpx solid #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
}
.trend-header {
  display: flex;
  background-color: #fafafa;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.trend-th {
  font-size: 24rpx;
  color: #999;
  font-weight: 500;
}
.trend-row {
  display: flex;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.trend-td {
  font-size: 26rpx;
  color: #333;
}
.col-date {
  flex: 1;
}
.col-amount {
  flex: 1;
  text-align: right;
}

/* 空状态 */
.empty-state {
  padding: 60rpx 0;
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
