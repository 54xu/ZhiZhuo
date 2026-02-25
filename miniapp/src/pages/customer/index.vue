<script setup lang="ts">
/**
 * 客表页面 - Today's customer list
 * 展示当日到店客户列表，支持日期筛选和状态过滤
 */
import { ref } from 'vue'

const currentDate = ref(new Date().toISOString().slice(0, 10))
const statusFilter = ref<'all' | 'waiting' | 'serving' | 'done'>('all')

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '等待中', value: 'waiting' },
  { label: '服务中', value: 'serving' },
  { label: '已完成', value: 'done' },
]
</script>

<template>
  <view class="customer-page">
    <!-- 日期筛选栏 -->
    <view class="date-bar">
      <picker mode="date" :value="currentDate" @change="(e: any) => currentDate = e.detail.value">
        <view class="date-picker">
          <text class="date-text">{{ currentDate }}</text>
          <text class="icon-arrow">▼</text>
        </view>
      </picker>
    </view>

    <!-- 状态过滤 -->
    <view class="status-filter">
      <view
        v-for="option in statusOptions"
        :key="option.value"
        class="filter-item"
        :class="{ active: statusFilter === option.value }"
        @tap="statusFilter = option.value as any"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>

    <!-- 客户列表 -->
    <view class="customer-list">
      <view class="empty-state">
        <text class="empty-text">暂无客户数据</text>
        <text class="empty-hint">今日到店客户将显示在这里</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.customer-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.date-bar {
  padding: 24rpx 32rpx;
  background-color: #fff;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.date-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.icon-arrow {
  font-size: 20rpx;
  color: #999;
}

.status-filter {
  display: flex;
  padding: 16rpx 32rpx;
  background-color: #fff;
  border-top: 1rpx solid #eee;
  gap: 16rpx;
}

.filter-item {
  padding: 12rpx 28rpx;
  border-radius: 32rpx;
  background-color: #f5f5f5;
  font-size: 26rpx;
  color: #666;
}

.filter-item.active {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.customer-list {
  padding: 32rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}

.empty-text {
  font-size: 30rpx;
  color: #999;
}

.empty-hint {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 12rpx;
}
</style>
