<script setup lang="ts">
/**
 * 结账页
 * 订单结算，包含优惠折扣和支付方式的插件扩展点
 */
import PluginSlot from '@/components/PluginSlot.vue'
</script>

<template>
  <view class="page">
    <view class="page-header">
      <text class="page-title">结账</text>
    </view>
    <view class="page-body">
      <view class="section">
        <text class="section-title">订单金额</text>
        <text class="placeholder-text">结账页面 - 待实现</text>
      </view>

      <!-- 插件扩展：优惠折扣 -->
      <view class="section">
        <text class="section-title">优惠折扣</text>
        <PluginSlot name="checkout-discounts" />
      </view>

      <!-- 插件扩展：支付方式 -->
      <view class="section">
        <text class="section-title">支付方式</text>
        <PluginSlot name="checkout-payment-types" />
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
