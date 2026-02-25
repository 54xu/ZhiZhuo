<script setup lang="ts">
/**
 * 经营简报
 * 门店经营数据概览，包含关键指标、会员数据和房间利用率
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { reportApi } from '@/api/report'

interface DashboardData {
  revenue: number
  orderCount: number
  avgAmount: number
  memberRatio: number
  newMembers: number
  rechargeIncome: number
  giftAmount: number
  roomUtilization: {
    in_use: number
    idle: number
    pending_clean: number
  }
}

const loading = ref(true)
const data = ref<DashboardData>({
  revenue: 0,
  orderCount: 0,
  avgAmount: 0,
  memberRatio: 0,
  newMembers: 0,
  rechargeIncome: 0,
  giftAmount: 0,
  roomUtilization: { in_use: 0, idle: 0, pending_clean: 0 },
})

function formatMoney(val: number): string {
  return val.toFixed(2)
}

function formatPercent(val: number): string {
  return (val * 100).toFixed(1) + '%'
}

async function fetchData() {
  loading.value = true
  try {
    const res = await reportApi.dashboard()
    data.value = res.data
  } catch (e) {
    uni.showToast({ title: '数据加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function onRefresh() {
  fetchData()
}

onLoad(() => {
  fetchData()
})
</script>

<template>
  <view class="page">
    <!-- 头部 -->
    <view class="header">
      <text class="header-title">经营简报</text>
      <text class="header-date">今日概览</text>
    </view>

    <view class="body" v-if="!loading">
      <!-- 核心指标 2x2 网格 -->
      <view class="metrics-grid">
        <view class="metric-card">
          <text class="metric-value primary">{{ formatMoney(data.revenue) }}</text>
          <text class="metric-label">今日营收 (元)</text>
        </view>
        <view class="metric-card">
          <text class="metric-value primary">{{ data.orderCount }}</text>
          <text class="metric-label">订单数</text>
        </view>
        <view class="metric-card">
          <text class="metric-value">{{ formatMoney(data.avgAmount) }}</text>
          <text class="metric-label">客单价 (元)</text>
        </view>
        <view class="metric-card">
          <text class="metric-value">{{ formatPercent(data.memberRatio) }}</text>
          <text class="metric-label">会员占比</text>
        </view>
      </view>

      <!-- 附加统计 -->
      <view class="card">
        <text class="card-title">会员与充值</text>
        <view class="stat-row">
          <view class="stat-item">
            <text class="stat-value success">{{ data.newMembers }}</text>
            <text class="stat-label">新增会员</text>
          </view>
          <view class="stat-item">
            <text class="stat-value warning">{{ formatMoney(data.rechargeIncome) }}</text>
            <text class="stat-label">充值收入 (元)</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ formatMoney(data.giftAmount) }}</text>
            <text class="stat-label">赠送金额 (元)</text>
          </view>
        </view>
      </view>

      <!-- 房间利用率 -->
      <view class="card">
        <text class="card-title">房间状态</text>
        <view class="room-list">
          <view class="room-item">
            <view class="room-dot in-use"></view>
            <text class="room-label">在用</text>
            <text class="room-count">{{ data.roomUtilization.in_use }}</text>
          </view>
          <view class="room-item">
            <view class="room-dot idle"></view>
            <text class="room-label">空闲</text>
            <text class="room-count">{{ data.roomUtilization.idle }}</text>
          </view>
          <view class="room-item">
            <view class="room-dot pending-clean"></view>
            <text class="room-label">待清理</text>
            <text class="room-count">{{ data.roomUtilization.pending_clean }}</text>
          </view>
        </view>
        <view class="room-bar">
          <view
            class="room-bar-seg in-use"
            :style="{
              flex: data.roomUtilization.in_use || 0,
            }"
          ></view>
          <view
            class="room-bar-seg idle"
            :style="{
              flex: data.roomUtilization.idle || 0,
            }"
          ></view>
          <view
            class="room-bar-seg pending-clean"
            :style="{
              flex: data.roomUtilization.pending_clean || 0,
            }"
          ></view>
        </view>
      </view>

      <!-- 刷新按钮 -->
      <view class="refresh-btn" @tap="onRefresh">
        <text class="refresh-text">刷新数据</text>
      </view>
    </view>

    <!-- 加载状态 -->
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

.header {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  padding: 48rpx 32rpx 40rpx;
}
.header-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  display: block;
}
.header-date {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
  display: block;
}

.body {
  padding: 24rpx 24rpx 48rpx;
  margin-top: -16rpx;
}

/* 核心指标网格 */
.metrics-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.metric-card {
  width: calc(50% - 8rpx);
  background-color: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  box-sizing: border-box;
}
.metric-value {
  font-size: 40rpx;
  font-weight: 700;
  color: #333;
  display: block;
}
.metric-value.primary {
  color: #4a90d9;
}
.metric-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

/* 卡片 */
.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  margin-top: 16rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

/* 附加统计行 */
.stat-row {
  display: flex;
  justify-content: space-between;
}
.stat-item {
  flex: 1;
  text-align: center;
}
.stat-value {
  font-size: 34rpx;
  font-weight: 700;
  color: #333;
  display: block;
}
.stat-value.success {
  color: #4cd964;
}
.stat-value.warning {
  color: #ff9500;
}
.stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
}

/* 房间利用率 */
.room-list {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.room-item {
  display: flex;
  align-items: center;
}
.room-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}
.room-dot.in-use {
  background-color: #4a90d9;
}
.room-dot.idle {
  background-color: #4cd964;
}
.room-dot.pending-clean {
  background-color: #ff9500;
}
.room-label {
  font-size: 26rpx;
  color: #666;
  margin-right: 8rpx;
}
.room-count {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.room-bar {
  display: flex;
  height: 16rpx;
  border-radius: 8rpx;
  overflow: hidden;
  background-color: #f0f0f0;
}
.room-bar-seg {
  height: 100%;
  transition: flex 0.3s;
}
.room-bar-seg.in-use {
  background-color: #4a90d9;
}
.room-bar-seg.idle {
  background-color: #4cd964;
}
.room-bar-seg.pending-clean {
  background-color: #ff9500;
}

/* 刷新按钮 */
.refresh-btn {
  margin-top: 32rpx;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 20rpx 0;
  text-align: center;
}
.refresh-text {
  font-size: 28rpx;
  color: #4a90d9;
  font-weight: 500;
}

/* 加载 */
.loading-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 200rpx;
}
.loading-text {
  font-size: 28rpx;
  color: #999;
}
</style>
