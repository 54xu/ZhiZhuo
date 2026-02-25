<script setup lang="ts">
/**
 * 经营简报
 * 门店经营数据概览，包含关键指标和趋势图
 */
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">经营简报</text>
    </view>
    <view class="page-body">
      <text class="placeholder-text">经营简报页面 - 待实现</text>
      <text class="placeholder-hint">展示门店关键经营指标和趋势</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f5f5;
}
.page-header {
  padding: 32rpx;
  background-color: #fff;
}
.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}
.page-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 32rpx;
}
.placeholder-text {
  font-size: 30rpx;
  color: #999;
}
.placeholder-hint {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 12rpx;
}
</style>
