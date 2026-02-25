<script setup lang="ts">
/**
 * 技师业绩
 * 技师业绩排名，包含服务量、营收贡献和提成数据
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { reportApi } from '@/api/report'

interface StaffItem {
  id: number | string
  name: string
  serviceCount: number
  revenue: number
  commission: number
}

interface StaffPerformanceData {
  staffList: StaffItem[]
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

const data = ref<StaffPerformanceData>({ staffList: [] })

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

function getRankClass(index: number): string {
  if (index === 0) return 'gold'
  if (index === 1) return 'silver'
  if (index === 2) return 'bronze'
  return ''
}

function getRankText(index: number): string {
  return String(index + 1)
}

async function fetchData() {
  const range = getDateRange(activePeriod.value)
  if (activePeriod.value === 'custom' && (!range.startDate || !range.endDate)) {
    return
  }
  loading.value = true
  try {
    const res = await reportApi.staffPerformance(range.startDate, range.endDate)
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
      <!-- 排名列表 -->
      <view class="card">
        <text class="card-title">业绩排名</text>

        <view class="empty-state" v-if="!data.staffList.length">
          <text class="empty-text">暂无业绩数据</text>
        </view>

        <view class="rank-list" v-else>
          <view class="rank-item" v-for="(staff, index) in data.staffList" :key="staff.id">
            <!-- 排名徽章 -->
            <view :class="['rank-badge', getRankClass(index)]">
              <text class="rank-num">{{ getRankText(index) }}</text>
            </view>

            <!-- 信息区域 -->
            <view class="rank-info">
              <text class="rank-name">{{ staff.name }}</text>
              <view class="rank-details">
                <view class="detail-tag">
                  <text class="detail-label">服务</text>
                  <text class="detail-value">{{ staff.serviceCount }} 次</text>
                </view>
                <view class="detail-tag">
                  <text class="detail-label">营收</text>
                  <text class="detail-value">{{ formatMoney(staff.revenue) }}</text>
                </view>
                <view class="detail-tag commission-tag">
                  <text class="detail-label">提成</text>
                  <text class="detail-value commission-value">{{ formatMoney(staff.commission) }}</text>
                </view>
              </view>
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

/* 卡片 */
.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

/* 排名列表 */
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.rank-item {
  display: flex;
  align-items: flex-start;
  padding: 20rpx;
  background-color: #fafbfc;
  border-radius: 12rpx;
}

/* 排名徽章 */
.rank-badge {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e0e0e0;
  margin-right: 20rpx;
  flex-shrink: 0;
}
.rank-badge.gold {
  background: linear-gradient(135deg, #ffd700, #ffb300);
}
.rank-badge.silver {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
}
.rank-badge.bronze {
  background: linear-gradient(135deg, #cd7f32, #b06a28);
}
.rank-num {
  font-size: 26rpx;
  font-weight: 700;
  color: #fff;
}

/* 信息区域 */
.rank-info {
  flex: 1;
}
.rank-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12rpx;
}
.rank-details {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.detail-tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background-color: #fff;
  padding: 6rpx 14rpx;
  border-radius: 6rpx;
}
.detail-label {
  font-size: 22rpx;
  color: #999;
}
.detail-value {
  font-size: 24rpx;
  color: #333;
  font-weight: 500;
}
.commission-tag {
  background-color: #fff8f0;
}
.commission-value {
  color: #ff9500;
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
