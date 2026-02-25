<script setup lang="ts">
/**
 * 提成汇总
 * 按日期范围查看全店技师提成排行
 * 可点击技师查看提成明细
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { commissionApi } from '@/api/admin'

const loading = ref(false)
const startDate = ref('')
const endDate = ref('')
const summaryData = ref<any>(null)
const techList = ref<any[]>([])

const totalCommission = computed(() => {
  if (summaryData.value?.totalCommission !== undefined) return summaryData.value.totalCommission
  return techList.value.reduce((sum: number, t: any) => sum + (t.commission || 0), 0)
})

const totalServiceCount = computed(() => {
  if (summaryData.value?.totalServiceCount !== undefined) return summaryData.value.totalServiceCount
  return techList.value.reduce((sum: number, t: any) => sum + (t.serviceCount || 0), 0)
})

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMoney(val: number): string {
  return (val || 0).toFixed(2)
}

function initDateRange() {
  const now = new Date()
  endDate.value = formatDate(now)
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  startDate.value = formatDate(firstDay)
}

function onStartDateChange(e: any) {
  startDate.value = e.detail.value
  loadData()
}

function onEndDateChange(e: any) {
  endDate.value = e.detail.value
  loadData()
}

async function loadData() {
  if (!startDate.value || !endDate.value) return
  loading.value = true
  try {
    const { data } = await commissionApi.summary(startDate.value, endDate.value)
    summaryData.value = data
    techList.value = data?.items || data?.technicians || []
    // 按提成金额降序排列
    techList.value.sort((a: any, b: any) => (b.commission || 0) - (a.commission || 0))
  } catch {
    techList.value = []
    summaryData.value = null
  } finally {
    loading.value = false
  }
}

function getRankStyle(index: number): string {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return ''
}

function getRankBg(index: number): string {
  if (index === 0) return '#ff9500'
  if (index === 1) return '#c7c7cc'
  if (index === 2) return '#cd7f32'
  return '#f0f0f0'
}

function getRankColor(index: number): string {
  if (index < 3) return '#fff'
  return '#999'
}

function goDetail(tech: any) {
  uni.navigateTo({
    url: `/sub-packages/staff/commission-detail?techId=${tech.technicianId || tech.id}&techName=${encodeURIComponent(tech.technicianName || tech.name)}&startDate=${startDate.value}&endDate=${endDate.value}`,
  })
}

onLoad(() => {
  initDateRange()
  loadData()
})
</script>

<template>
  <view class="page">
    <!-- 日期范围选择 -->
    <view class="date-range-bar">
      <view class="date-range-item">
        <text class="date-range-label">起始日期</text>
        <picker mode="date" :value="startDate" @change="onStartDateChange">
          <view class="date-picker-box">
            <text class="date-picker-text">{{ startDate }}</text>
          </view>
        </picker>
      </view>
      <view class="date-range-sep">
        <text class="sep-text">至</text>
      </view>
      <view class="date-range-item">
        <text class="date-range-label">结束日期</text>
        <picker mode="date" :value="endDate" @change="onEndDateChange">
          <view class="date-picker-box">
            <text class="date-picker-text">{{ endDate }}</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 汇总卡片 -->
    <view class="summary-cards">
      <view class="summary-card">
        <text class="summary-card-value">{{ formatMoney(totalCommission) }}</text>
        <text class="summary-card-label">总提成(元)</text>
      </view>
      <view class="summary-card">
        <text class="summary-card-value count">{{ totalServiceCount }}</text>
        <text class="summary-card-label">总服务次数</text>
      </view>
    </view>

    <!-- 排行标题 -->
    <view class="section-header">
      <text class="section-title">技师提成排行</text>
      <text class="section-hint">点击查看明细</text>
    </view>

    <!-- 加载 -->
    <view v-if="loading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="techList.length === 0" class="empty-box">
      <text class="empty-text">暂无提成数据</text>
      <text class="empty-hint">请选择其他日期范围</text>
    </view>

    <!-- 排行列表 -->
    <view v-else class="rank-list">
      <view
        v-for="(tech, index) in techList"
        :key="tech.technicianId || tech.id"
        class="rank-item"
        @tap="goDetail(tech)"
      >
        <view
          class="rank-number"
          :style="{ backgroundColor: getRankBg(index), color: getRankColor(index) }"
        >
          <text class="rank-num-text">{{ index + 1 }}</text>
        </view>
        <view class="rank-info">
          <text class="rank-name">{{ tech.technicianName || tech.name }}</text>
          <text class="rank-count">服务 {{ tech.serviceCount || 0 }} 次</text>
        </view>
        <view class="rank-amount">
          <text class="amount-text">{{ formatMoney(tech.commission) }}</text>
          <text class="amount-unit">元</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
}

/* 日期范围 */
.date-range-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 24rpx 32rpx;
}
.date-range-item {
  flex: 1;
}
.date-range-label {
  font-size: 22rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}
.date-picker-box {
  background: #f5f6fa;
  border-radius: 10rpx;
  padding: 14rpx 20rpx;
  text-align: center;
}
.date-picker-text {
  font-size: 28rpx;
  color: #333;
}
.date-range-sep {
  padding: 0 16rpx;
  padding-top: 24rpx;
}
.sep-text {
  font-size: 26rpx;
  color: #999;
}

/* 汇总卡片 */
.summary-cards {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
}
.summary-card {
  flex: 1;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  text-align: center;
}
.summary-card-value {
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}
.summary-card-value.count {
  color: #fff;
}
.summary-card-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

/* 排行标题 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx 16rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}
.section-hint {
  font-size: 22rpx;
  color: #999;
}

/* 加载 & 空 */
.loading-box, .empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 32rpx;
}
.loading-text, .empty-text {
  font-size: 28rpx;
  color: #999;
}
.empty-hint {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 12rpx;
}

/* 排行列表 */
.rank-list {
  padding: 0 24rpx 24rpx;
}
.rank-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.rank-number {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.rank-num-text {
  font-size: 26rpx;
  font-weight: bold;
}
.rank-info {
  flex: 1;
  margin-left: 20rpx;
}
.rank-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
}
.rank-count {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}
.rank-amount {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  flex-shrink: 0;
}
.amount-text {
  font-size: 34rpx;
  font-weight: bold;
  color: #ff9500;
}
.amount-unit {
  font-size: 22rpx;
  color: #999;
}
</style>
