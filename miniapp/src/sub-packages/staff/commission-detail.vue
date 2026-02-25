<script setup lang="ts">
/**
 * 提成明细
 * 展示单个员工的提成明细记录
 */
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">提成明细</text>
    </view>
    <view class="page-body">
      <text class="placeholder-text">提成明细页面 - 待实现</text>
      <text class="placeholder-hint">展示员工每笔订单的提成详情</text>
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
