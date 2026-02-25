<script setup lang="ts">
/**
 * 新增会员
 * 填写会员基本信息并创建新会员
 */
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">新增会员</text>
    </view>
    <view class="page-body">
      <text class="placeholder-text">新增会员页面 - 待实现</text>
      <text class="placeholder-hint">填写会员姓名、手机号、性别等基本信息</text>
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
