<script setup lang="ts">
/**
 * 会员详情
 * 展示会员完整信息，包含插件扩展的标签页和操作按钮
 */
import PluginSlot from '@/components/PluginSlot.vue'
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">会员详情</text>
    </view>
    <view class="page-body">
      <view class="section">
        <text class="section-title">基本信息</text>
        <text class="placeholder-text">会员详情页面 - 待实现</text>
      </view>

      <!-- 插件扩展：详情标签页 -->
      <view class="section">
        <text class="section-title">更多信息</text>
        <PluginSlot name="member-detail-tabs" />
      </view>

      <!-- 插件扩展：操作按钮 -->
      <view class="section">
        <text class="section-title">操作</text>
        <PluginSlot name="member-detail-actions" />
      </view>
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
  padding: 24rpx 32rpx;
}
.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
  display: block;
}
.placeholder-text {
  font-size: 26rpx;
  color: #999;
}
</style>
