<script setup lang="ts">
/**
 * 服务项目管理
 * 管理门店提供的服务项目列表
 */
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">服务项目管理</text>
    </view>
    <view class="page-body">
      <text class="placeholder-text">服务项目管理页面 - 待实现</text>
      <text class="placeholder-hint">添加、编辑、删除服务项目</text>
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
