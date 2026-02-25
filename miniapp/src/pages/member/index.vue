<script setup lang="ts">
/**
 * 会员管理首页
 * 会员搜索、快捷操作（新增会员/充值）、最近会员列表
 */
import { ref } from 'vue'

const searchKeyword = ref('')

function onSearch() {
  // TODO: 搜索会员
}

function navigateToAdd() {
  uni.navigateTo({ url: '/sub-packages/member/add' })
}

function navigateToRecharge() {
  uni.navigateTo({ url: '/sub-packages/member/recharge' })
}
</script>

<template>
  <view class="member-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        v-model="searchKeyword"
        class="search-input"
        type="text"
        placeholder="搜索会员姓名/手机号"
        confirm-type="search"
        @confirm="onSearch"
      />
    </view>

    <!-- 快捷操作 -->
    <view class="quick-actions">
      <view class="action-btn primary" @tap="navigateToAdd">
        <text class="action-icon">+</text>
        <text class="action-label">新增会员</text>
      </view>
      <view class="action-btn secondary" @tap="navigateToRecharge">
        <text class="action-icon">¥</text>
        <text class="action-label">充值</text>
      </view>
    </view>

    <!-- 最近会员列表 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">最近会员</text>
      </view>
      <view class="member-list">
        <view class="empty-state">
          <text class="empty-text">暂无会员数据</text>
          <text class="empty-hint">点击上方"新增会员"添加第一位会员</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.member-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.search-bar {
  padding: 24rpx 32rpx;
  background-color: #fff;
}

.search-input {
  width: 100%;
  height: 72rpx;
  background-color: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.quick-actions {
  display: flex;
  padding: 24rpx 32rpx;
  gap: 24rpx;
  background-color: #fff;
  margin-top: 2rpx;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx 0;
  border-radius: 16rpx;
}

.action-btn.primary {
  background-color: #1a73e8;
  color: #fff;
}

.action-btn.secondary {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.action-icon {
  font-size: 36rpx;
  font-weight: 600;
}

.action-label {
  font-size: 28rpx;
  font-weight: 500;
}

.section {
  margin-top: 24rpx;
  background-color: #fff;
}

.section-header {
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #eee;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.member-list {
  padding: 32rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
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
