<script setup lang="ts">
/**
 * 订单详情
 * 展示订单的完整信息：客户、技师、服务项目、金额、状态等
 */
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">订单详情</text>
    </view>
    <view class="page-body">
      <text class="placeholder-text">订单详情页面 - 待实现</text>
      <text class="placeholder-hint">展示订单完整信息</text>
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
