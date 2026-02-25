<script setup lang="ts">
/**
 * 改单页
 * 修改已有订单的服务项目、技师、金额等信息
 */
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">改单</text>
    </view>
    <view class="page-body">
      <text class="placeholder-text">改单页面 - 待实现</text>
      <text class="placeholder-hint">修改订单服务项目、技师、金额等</text>
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
