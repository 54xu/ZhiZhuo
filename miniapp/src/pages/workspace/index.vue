<script setup lang="ts">
/**
 * 工作台 - 房台总览（首页）
 * 按区域分组展示所有房间/房台的当前状态
 * 含 PluginSlot: workspace-toolbar
 */
import PluginSlot from '@/components/PluginSlot.vue'
</script>

<template>
  <view class="workspace">
    <!-- 顶部统计 -->
    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-value">0</text>
        <text class="stat-label">今日营收(元)</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">0</text>
        <text class="stat-label">今日单数</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">0</text>
        <text class="stat-label">在用房台</text>
      </view>
    </view>

    <!-- V2/V3 工具栏插件槽位 -->
    <PluginSlot name="workspace-toolbar" direction="horizontal" />

    <!-- 区域Tab -->
    <view class="zone-tabs">
      <text class="zone-tab active">全部</text>
    </view>

    <!-- 房台卡片网格 -->
    <view class="room-grid">
      <view class="room-placeholder">
        <text>暂无房台数据</text>
        <text class="sub-text">请先在系统管理中添加区域和房台</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.workspace {
  padding: 20rpx;
  background-color: #f5f6fa;
  min-height: 100vh;
}

.stats-bar {
  display: flex;
  justify-content: space-around;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx;
  padding: 30rpx 20rpx;
  margin-bottom: 20rpx;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #ffffff;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.zone-tabs {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.zone-tab {
  padding: 12rpx 28rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  background: #fff;
  color: #666;
}

.zone-tab.active {
  background: #4a90d9;
  color: #fff;
}

.room-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.room-placeholder {
  width: 100%;
  padding: 100rpx 40rpx;
  text-align: center;
  background: #fff;
  border-radius: 16rpx;
  color: #999;
  font-size: 28rpx;
}

.sub-text {
  display: block;
  font-size: 24rpx;
  margin-top: 12rpx;
  color: #ccc;
}
</style>
