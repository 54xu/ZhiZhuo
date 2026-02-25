<script setup lang="ts">
/**
 * 提成明细
 * 展示单个技师在指定日期范围内的提成记录
 * 包含每笔订单的服务名称、金额、提成额
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { commissionApi } from '@/api/admin'

const techId = ref(0)
const techName = ref('')
const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const detailData = ref<any>(null)
const records = ref<any[]>([])

const totalCommission = computed(() => {
  if (detailData.value?.totalCommission !== undefined) return detailData.value.totalCommission
  return records.value.reduce((sum: number, r: any) => {
    if (r.status === 'reversed') return sum
    return sum + (r.commission || 0)
  }, 0)
})

const totalServiceCount = computed(() => {
  if (detailData.value?.totalServiceCount !== undefined) return detailData.value.totalServiceCount
  return records.value.filter((r: any) => r.status !== 'reversed').length
})

const totalAmount = computed(() => {
  if (detailData.value?.totalAmount !== undefined) return detailData.value.totalAmount
  return records.value.reduce((sum: number, r: any) => {
    if (r.status === 'reversed') return sum
    return sum + (r.serviceAmount || r.amount || 0)
  }, 0)
})

const dateRangeText = computed(() => {
  if (!startDate.value || !endDate.value) return ''
  return `${startDate.value} 至 ${endDate.value}`
})

function formatMoney(val: number): string {
  return (val || 0).toFixed(2)
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length >= 3) return `${parts[1]}-${parts[2]}`
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadData() {
  if (!techId.value || !startDate.value || !endDate.value) return
  loading.value = true
  try {
    const { data } = await commissionApi.detail(techId.value, startDate.value, endDate.value)
    detailData.value = data
    records.value = data?.records || data?.items || []
  } catch {
    records.value = []
    detailData.value = null
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  techId.value = Number(options?.techId) || 0
  techName.value = decodeURIComponent(options?.techName || '')
  startDate.value = options?.startDate || ''
  endDate.value = options?.endDate || ''

  if (techName.value) {
    uni.setNavigationBarTitle({ title: `${techName.value}的提成` })
  }

  loadData()
})
</script>

<template>
  <view class="page">
    <!-- 头部信息 -->
    <view class="detail-header">
      <view class="header-avatar">
        <text class="avatar-letter">{{ techName ? techName.charAt(0) : '?' }}</text>
      </view>
      <view class="header-info">
        <text class="header-name">{{ techName }}</text>
        <text class="header-date">{{ dateRangeText }}</text>
      </view>
      <view class="header-commission">
        <text class="commission-value">{{ formatMoney(totalCommission) }}</text>
        <text class="commission-label">总提成(元)</text>
      </view>
    </view>

    <!-- 统计条 -->
    <view class="stats-row">
      <view class="stat-block">
        <text class="stat-num">{{ totalServiceCount }}</text>
        <text class="stat-desc">服务次数</text>
      </view>
      <view class="stat-divider" />
      <view class="stat-block">
        <text class="stat-num">{{ formatMoney(totalAmount) }}</text>
        <text class="stat-desc">服务总额(元)</text>
      </view>
      <view class="stat-divider" />
      <view class="stat-block">
        <text class="stat-num">{{ formatMoney(totalCommission) }}</text>
        <text class="stat-desc">提成总额(元)</text>
      </view>
    </view>

    <!-- 明细标题 -->
    <view class="section-header">
      <text class="section-title">提成记录</text>
      <text class="section-count">共 {{ records.length }} 条</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <view v-else-if="records.length === 0" class="empty-box">
      <text class="empty-text">暂无提成记录</text>
    </view>

    <!-- 记录列表 -->
    <view v-else class="record-list">
      <view
        v-for="(record, index) in records"
        :key="record.id || index"
        class="record-card"
        :class="{ reversed: record.status === 'reversed' }"
      >
        <view class="record-top">
          <view class="record-date-box">
            <text class="record-date">{{ formatDateShort(record.date || record.orderDate) }}</text>
          </view>
          <view class="record-service">
            <text class="service-name">{{ record.serviceName || record.service }}</text>
            <text class="order-no">{{ record.orderNo || record.orderNumber || '' }}</text>
          </view>
          <view v-if="record.status === 'reversed'" class="reversed-badge">
            <text class="reversed-text">已冲正</text>
          </view>
          <view v-else class="normal-badge">
            <text class="normal-text">正常</text>
          </view>
        </view>
        <view class="record-bottom">
          <view class="record-amount-item">
            <text class="amount-label">服务金额</text>
            <text class="amount-val">{{ formatMoney(record.serviceAmount || record.amount) }}</text>
          </view>
          <view class="record-amount-item commission-item">
            <text class="amount-label">提成金额</text>
            <text class="amount-val highlight" :class="{ 'reversed-val': record.status === 'reversed' }">
              {{ record.status === 'reversed' ? '-' : '+' }}{{ formatMoney(record.commission) }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部汇总 -->
    <view v-if="records.length > 0" class="bottom-summary">
      <view class="bottom-summary-row">
        <text class="bottom-label">总服务次数</text>
        <text class="bottom-value">{{ totalServiceCount }} 次</text>
      </view>
      <view class="bottom-summary-row">
        <text class="bottom-label">服务总金额</text>
        <text class="bottom-value">{{ formatMoney(totalAmount) }} 元</text>
      </view>
      <view class="bottom-summary-row highlight-row">
        <text class="bottom-label bold">提成合计</text>
        <text class="bottom-value bold orange">{{ formatMoney(totalCommission) }} 元</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding-bottom: 40rpx;
}

/* 头部 */
.detail-header {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  padding: 32rpx;
}
.header-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-letter {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}
.header-info {
  flex: 1;
  margin-left: 20rpx;
}
.header-name {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}
.header-date {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 6rpx;
}
.header-commission {
  text-align: right;
  flex-shrink: 0;
}
.commission-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}
.commission-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 4rpx;
}

/* 统计条 */
.stats-row {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 24rpx 0;
  margin-bottom: 16rpx;
}
.stat-block {
  flex: 1;
  text-align: center;
}
.stat-num {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
}
.stat-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}
.stat-divider {
  width: 2rpx;
  height: 48rpx;
  background: #eee;
}

/* 明细标题 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 32rpx 12rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}
.section-count {
  font-size: 24rpx;
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

/* 记录列表 */
.record-list {
  padding: 0 24rpx;
}
.record-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.record-card.reversed {
  opacity: 0.7;
}

.record-top {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.record-date-box {
  background: #f5f6fa;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}
.record-date {
  font-size: 24rpx;
  color: #666;
  font-weight: 500;
}
.record-service {
  flex: 1;
  margin-left: 16rpx;
}
.service-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
}
.order-no {
  font-size: 22rpx;
  color: #bbb;
  margin-top: 4rpx;
}
.reversed-badge {
  padding: 6rpx 16rpx;
  background: rgba(255, 59, 48, 0.1);
  border-radius: 8rpx;
  flex-shrink: 0;
}
.reversed-text {
  font-size: 22rpx;
  color: #ff3b30;
  font-weight: 500;
}
.normal-badge {
  padding: 6rpx 16rpx;
  background: rgba(76, 217, 100, 0.1);
  border-radius: 8rpx;
  flex-shrink: 0;
}
.normal-text {
  font-size: 22rpx;
  color: #4cd964;
  font-weight: 500;
}

.record-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 2rpx solid #f5f6fa;
}
.record-amount-item {
  display: flex;
  flex-direction: column;
}
.commission-item {
  align-items: flex-end;
}
.amount-label {
  font-size: 22rpx;
  color: #999;
}
.amount-val {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-top: 4rpx;
}
.amount-val.highlight {
  color: #ff9500;
  font-weight: bold;
  font-size: 30rpx;
}
.amount-val.reversed-val {
  color: #ff3b30;
}

/* 底部汇总 */
.bottom-summary {
  margin: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}
.bottom-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}
.highlight-row {
  padding-top: 16rpx;
  margin-top: 8rpx;
  border-top: 2rpx solid #f5f6fa;
}
.bottom-label {
  font-size: 28rpx;
  color: #666;
}
.bottom-value {
  font-size: 28rpx;
  color: #333;
}
.bottom-label.bold, .bottom-value.bold {
  font-weight: bold;
}
.bottom-value.orange {
  color: #ff9500;
  font-size: 32rpx;
}
</style>
