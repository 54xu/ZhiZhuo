<script setup lang="ts">
/**
 * 我的 - 个人中心/功能入口
 * 含 PluginSlot: mine-menu-items
 */
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import PluginSlot from '@/components/PluginSlot.vue'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const menuItems = ref([
  { label: '排班表', icon: '📅', url: '/sub-packages/staff/schedule-view', roles: ['admin', 'technician'] },
  { label: '提成统计', icon: '💰', url: '/sub-packages/staff/commission-list', roles: ['admin', 'technician'] },
  { label: '经营简报', icon: '📊', url: '/sub-packages/report/dashboard', roles: ['admin', 'cashier'] },
  { label: '营收统计', icon: '📈', url: '/sub-packages/report/revenue', roles: ['admin'] },
  { label: '技师业绩', icon: '🏆', url: '/sub-packages/report/staff-performance', roles: ['admin'] },
  { label: '会员统计', icon: '👥', url: '/sub-packages/report/member-stats', roles: ['admin'] },
  { label: '充值统计', icon: '💳', url: '/sub-packages/report/recharge-stats', roles: ['admin'] },
  { label: '收银对账', icon: '🧾', url: '/sub-packages/report/reconciliation', roles: ['admin'] },
  { label: '服务项目管理', icon: '🔧', url: '/sub-packages/admin/services', roles: ['admin'] },
  { label: '房间管理', icon: '🏠', url: '/sub-packages/admin/rooms', roles: ['admin'] },
  { label: '员工管理', icon: '👤', url: '/sub-packages/admin/employees', roles: ['admin'] },
  { label: '充值方案', icon: '📋', url: '/sub-packages/admin/recharge-plans', roles: ['admin'] },
  { label: '提成规则', icon: '⚙️', url: '/sub-packages/admin/commission-rules', roles: ['admin'] },
  { label: '门店设置', icon: '🏪', url: '/sub-packages/admin/store-settings', roles: ['admin'] },
])

const visibleMenus = ref<any[]>([])

onShow(() => {
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  visibleMenus.value = menuItems.value.filter(item => item.roles.includes(userStore.role))
})

function goTo(url: string) { uni.navigateTo({ url }) }
function handleLogout() {
  uni.showModal({
    title: '确认退出',
    content: '确定要退出登录吗？',
    success: (res) => { if (res.confirm) userStore.logout() },
  })
}

const roleLabel: Record<string, string> = { admin: '管理员', cashier: '收银员', technician: '技师' }
</script>

<template>
  <view class="mine-page">
    <view class="user-card">
      <view class="avatar">{{ (userStore.userInfo?.name || '?')[0] }}</view>
      <view class="user-info">
        <text class="user-name">{{ userStore.userInfo?.name || '未登录' }}</text>
        <text class="user-role">{{ roleLabel[userStore.role] || userStore.role }} · {{ userStore.storeName }}</text>
      </view>
    </view>

    <PluginSlot name="mine-menu-items" />

    <view class="menu-section">
      <view v-for="item in visibleMenus" :key="item.url" class="menu-item" @tap="goTo(item.url)">
        <text class="menu-icon">{{ item.icon }}</text>
        <text class="menu-label">{{ item.label }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="logout-section">
      <button class="logout-btn" @tap="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<style scoped>
.mine-page { background: #f5f6fa; min-height: 100vh; }
.user-card {
  display: flex; align-items: center; gap: 24rpx; padding: 40rpx 30rpx;
  background: linear-gradient(135deg, #4a90d9, #357abd);
}
.avatar {
  width: 100rpx; height: 100rpx; border-radius: 50%; background: rgba(255,255,255,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; color: #fff; font-weight: bold;
}
.user-info { flex: 1; }
.user-name { font-size: 34rpx; font-weight: bold; color: #fff; display: block; }
.user-role { font-size: 24rpx; color: rgba(255,255,255,0.8); margin-top: 8rpx; }
.menu-section { margin: 20rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item {
  display: flex; align-items: center; padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.menu-icon { font-size: 36rpx; margin-right: 20rpx; }
.menu-label { flex: 1; font-size: 28rpx; color: #333; }
.menu-arrow { font-size: 32rpx; color: #ccc; }
.logout-section { padding: 40rpx 20rpx; }
.logout-btn {
  width: 100%; height: 88rpx; line-height: 88rpx; background: #fff;
  color: #ff3b30; font-size: 30rpx; border-radius: 16rpx; border: none;
}
</style>
