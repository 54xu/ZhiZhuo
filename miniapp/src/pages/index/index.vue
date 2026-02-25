<script setup lang="ts">
/**
 * 登录/绑定页面
 * 微信登录 → 检查绑定 → 未绑定则输入工号+手机验证 → 跳转工作台
 */
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()
const loading = ref(false)
const showBind = ref(false)
const openid = ref('')
const employeeNo = ref('')
const phone = ref('')
const bindLoading = ref(false)

onMounted(() => {
  // 如果已登录，直接跳转
  if (userStore.isLoggedIn) {
    uni.switchTab({ url: '/pages/workspace/index' })
    return
  }
  // 检查 URL 参数（从登录回调带回 openid）
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  if (page?.$page?.options?.openid) {
    openid.value = page.$page.options.openid
    showBind.value = true
  }
})

/** 微信一键登录 */
async function handleLogin() {
  loading.value = true
  try {
    const result = await userStore.wxLogin()
    if (result?.needBind) {
      showBind.value = true
    } else {
      uni.switchTab({ url: '/pages/workspace/index' })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

/** 绑定员工 */
async function handleBind() {
  if (!employeeNo.value || !phone.value) {
    uni.showToast({ title: '请输入工号和手机号', icon: 'none' })
    return
  }
  bindLoading.value = true
  try {
    await userStore.bindEmployee(openid.value, employeeNo.value, phone.value)
    uni.switchTab({ url: '/pages/workspace/index' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '绑定失败', icon: 'none' })
  } finally {
    bindLoading.value = false
  }
}
</script>

<template>
  <view class="login-page">
    <view class="logo-section">
      <image class="logo" src="/static/logo.png" mode="aspectFit" />
      <text class="app-name">致卓收银</text>
      <text class="app-desc">足浴/SPA门店收银管理系统</text>
    </view>

    <!-- 绑定表单 -->
    <view v-if="showBind" class="bind-form">
      <text class="bind-title">首次登录，请绑定员工账号</text>
      <input v-model="employeeNo" class="input" placeholder="请输入工号" />
      <input v-model="phone" class="input" type="number" placeholder="请输入手机号" />
      <button class="btn-primary" :loading="bindLoading" @tap="handleBind">
        确认绑定
      </button>
    </view>

    <!-- 登录按钮 -->
    <view v-else class="login-section">
      <button class="btn-primary" :loading="loading" @tap="handleLogin">
        微信一键登录
      </button>
      <text class="login-tip">使用门店管理员分配的员工账号登录</text>
    </view>
  </view>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f5f6fa 0%, #e8ecf3 100%);
  padding: 40rpx;
}
.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}
.logo {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 24rpx;
}
.app-name {
  font-size: 44rpx;
  font-weight: bold;
  color: #333;
}
.app-desc {
  font-size: 26rpx;
  color: #999;
  margin-top: 12rpx;
}
.login-section, .bind-form {
  width: 100%;
  max-width: 600rpx;
}
.btn-primary {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  color: #fff;
  font-size: 32rpx;
  border-radius: 44rpx;
  border: none;
}
.login-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-top: 24rpx;
}
.bind-title {
  display: block;
  text-align: center;
  font-size: 30rpx;
  color: #666;
  margin-bottom: 40rpx;
}
.input {
  width: 100%;
  height: 88rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 28rpx;
  font-size: 30rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
}
</style>
