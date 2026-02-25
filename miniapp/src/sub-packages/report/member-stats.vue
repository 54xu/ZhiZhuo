<script setup lang="ts">
/**
 * 会员统计
 * 会员增长、活跃度、消费数据统计及消费排行
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { reportApi } from '@/api/report'

interface TopMember {
  id: number | string
  name: string
  phone: string
  totalSpend: number
}

interface MemberStatsData {
  newMembers: number
  activeMembers: number
  totalMembers: number
  memberSpendTotal: number
  memberAvgSpend: number
  topMembers: TopMember[]
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

const data = ref<MemberStatsData>({
  newMembers: 0,
  activeMembers: 0,
  totalMembers: 0,
  memberSpendTotal: 0,
  memberAvgSpend: 0,
  topMembers: [],
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

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
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
    const res = await reportApi.memberStats(range.startDate, range.endDate)
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
      <!-- 关键指标 -->
      <view class="metrics-row">
        <view class="metric-card">
          <text class="metric-value success">{{ data.newMembers }}</text>
          <text class="metric-label">新增会员</text>
        </view>
        <view class="metric-card">
          <text class="metric-value primary">{{ data.activeMembers }}</text>
          <text class="metric-label">活跃会员</text>
        </view>
        <view class="metric-card">
          <text class="metric-value">{{ data.totalMembers }}</text>
          <text class="metric-label">累计会员</text>
        </view>
      </view>

      <!-- 消费统计 -->
      <view class="card">
        <text class="card-title">消费统计</text>
        <view class="spend-row">
          <view class="spend-item">
            <text class="spend-value">{{ formatMoney(data.memberSpendTotal) }}</text>
            <text class="spend-label">会员消费总额 (元)</text>
          </view>
          <view class="spend-divider"></view>
          <view class="spend-item">
            <text class="spend-value">{{ formatMoney(data.memberAvgSpend) }}</text>
            <text class="spend-label">会员平均消费 (元)</text>
          </view>
        </view>
      </view>

      <!-- 消费排行 -->
      <view class="card">
        <text class="card-title">消费排行</text>

        <view class="empty-state" v-if="!data.topMembers.length">
          <text class="empty-text">暂无数据</text>
        </view>

        <view class="member-list" v-else>
          <view class="member-item" v-for="(member, index) in data.topMembers" :key="member.id">
            <view class="member-rank">
              <text :class="['rank-text', index < 3 ? 'top' : '']">{{ index + 1 }}</text>
            </view>
            <view class="member-info">
              <text class="member-name">{{ member.name }}</text>
              <text class="member-phone">{{ maskPhone(member.phone) }}</text>
            </view>
            <view class="member-spend">
              <text class="member-amount">{{ formatMoney(member.totalSpend) }}</text>
              <text class="member-unit">元</text>
            </view>
          </view>
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

/* 关键指标 */
.metrics-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.metric-card {
  flex: 1;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 24rpx 16rpx;
  text-align: center;
}
.metric-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
  display: block;
}
.metric-value.success {
  color: #4cd964;
}
.metric-value.primary {
  color: #4a90d9;
}
.metric-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
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

/* 消费统计 */
.spend-row {
  display: flex;
  align-items: center;
}
.spend-item {
  flex: 1;
  text-align: center;
}
.spend-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #4a90d9;
  display: block;
}
.spend-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}
.spend-divider {
  width: 1rpx;
  height: 60rpx;
  background-color: #f0f0f0;
  margin: 0 16rpx;
}

/* 消费排行 */
.member-list {
  display: flex;
  flex-direction: column;
}
.member-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.member-item:last-child {
  border-bottom: none;
}
.member-rank {
  width: 48rpx;
  text-align: center;
  margin-right: 16rpx;
}
.rank-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #ccc;
}
.rank-text.top {
  color: #ff9500;
}
.member-info {
  flex: 1;
}
.member-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
}
.member-phone {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}
.member-spend {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}
.member-amount {
  font-size: 30rpx;
  font-weight: 700;
  color: #333;
}
.member-unit {
  font-size: 22rpx;
  color: #999;
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
