<script setup lang="ts">
/**
 * 我的页面
 * 用户信息卡片 + 菜单列表 + PluginSlot 动态菜单扩展
 */
import PluginSlot from '@/components/PluginSlot.vue'

interface MenuItem {
  label: string
  icon: string
  path: string
}

const menuItems: MenuItem[] = [
  { label: '门店设置', icon: '⚙', path: '/sub-packages/admin/store-settings' },
  { label: '服务项目管理', icon: '📋', path: '/sub-packages/admin/services' },
  { label: '员工管理', icon: '👥', path: '/sub-packages/admin/employees' },
  { label: '房间管理', icon: '🏠', path: '/sub-packages/admin/rooms' },
  { label: '充值方案', icon: '💰', path: '/sub-packages/admin/recharge-plans' },
  { label: '提成规则', icon: '📊', path: '/sub-packages/admin/commission-rules' },
]

function navigateTo(path: string) {
  uni.navigateTo({ url: path })
}
</script>

<template>
  <view class="mine-page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="avatar">
        <text class="avatar-text">店</text>
      </view>
      <view class="user-info">
        <text class="user-name">门店名称</text>
        <text class="user-role">管理员</text>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-section">
      <view class="menu-title">
        <text>管理功能</text>
      </view>
      <view
        v-for="item in menuItems"
        :key="item.path"
        class="menu-item"
        @tap="navigateTo(item.path)"
      >
        <text class="menu-icon">{{ item.icon }}</text>
        <text class="menu-label">{{ item.label }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 插件扩展菜单 -->
    <view class="menu-section">
      <view class="menu-title">
        <text>更多功能</text>
      </view>
      <PluginSlot name="mine-menu-items" />
    </view>
  </view>
</template>

<style scoped>
.mine-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.user-card {
  display: flex;
  align-items: center;
  padding: 48rpx 32rpx;
  background: linear-gradient(135deg, #1a73e8, #4a9af5);
  gap: 24rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 48rpx;
  background-color: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: 40rpx;
  color: #fff;
  font-weight: 600;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.user-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
}

.user-role {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.menu-section {
  margin-top: 24rpx;
  background-color: #fff;
}

.menu-title {
  padding: 24rpx 32rpx 12rpx;
  font-size: 26rpx;
  color: #999;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.menu-label {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.menu-arrow {
  font-size: 32rpx;
  color: #ccc;
}
</style>
