<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const loading = ref(false)
const showBind = ref(false)
const openid = ref('')
const employeeNo = ref('')
const phone = ref('')
const bindLoading = ref(false)
const devRole = ref('admin')

const devAccounts: Record<string, { no: string; phone: string; label: string }> = {
  admin: { no: 'E001', phone: '13800000001', label: '张店长(管理员)' },
  cashier: { no: 'E002', phone: '13800000002', label: '李收银(收银员)' },
  technician: { no: 'E003', phone: '13800000003', label: '王师傅(技师)' },
}

onLoad((options) => {
  if (userStore.isLoggedIn) {
    uni.switchTab({ url: '/pages/workspace/index' })
    return
  }

  if (typeof options?.openid === 'string' && options.openid) {
    openid.value = options.openid
    showBind.value = true
  }
})

async function handleLogin() {
  loading.value = true
  try {
    const result = await userStore.wxLogin()
    if (result?.needBind) {
      openid.value = result.openid || ''
      showBind.value = true
      return
    }

    uni.switchTab({ url: '/pages/workspace/index' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleDevLogin() {
  loading.value = true
  try {
    const acc = devAccounts[devRole.value]
    await userStore.devLogin(acc.no, acc.phone)
    uni.switchTab({ url: '/pages/workspace/index' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '快速登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

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
  <view class="auth-page">
    <view class="auth-card">
      <view class="logo-section">
        <image class="logo" src="/static/zz-operations-trademark.jpg" mode="widthFix" />
        <text class="app-name">致卓网络</text>
        <text class="app-desc">企业登录入口</text>
      </view>

      <view v-if="showBind" class="bind-form">
        <text class="bind-title">首次登录，请绑定员工账号</text>
        <input v-model="employeeNo" class="input" placeholder="请输入工号" />
        <input v-model="phone" class="input" type="number" placeholder="请输入手机号" />
        <button class="btn-primary" :loading="bindLoading" @tap="handleBind">
          确认绑定
        </button>
      </view>

      <view v-else class="login-section">
        <button class="btn-primary" :loading="loading" @tap="handleLogin">
          微信一键登录
        </button>
        <text class="login-tip">使用门店管理员分配的员工账号登录</text>

        <view class="dev-login">
          <text class="dev-title">开发测试快速登录</text>
          <view class="dev-roles">
            <text
              v-for="(acc, key) in devAccounts"
              :key="key"
              :class="['dev-role-tag', devRole === key && 'active']"
              @tap="devRole = key as string"
            >{{ acc.label }}</text>
          </view>
          <button class="btn-dev" :loading="loading" @tap="handleDevLogin">
            快速登录
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  background:
    radial-gradient(circle at top right, rgba(74, 144, 217, 0.16), transparent 32%),
    linear-gradient(180deg, #f4f7fb 0%, #e8edf6 100%);
  box-sizing: border-box;
}

.auth-card {
  width: 100%;
  max-width: 680rpx;
  padding: 48rpx 40rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24rpx 72rpx rgba(41, 82, 145, 0.12);
  box-sizing: border-box;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 64rpx;
}

.logo {
  width: 320rpx;
  margin-bottom: 28rpx;
}

.app-name {
  font-size: 44rpx;
  font-weight: bold;
  color: #1f3e73;
}

.app-desc {
  font-size: 26rpx;
  color: #7b8ba4;
  margin-top: 12rpx;
}

.login-section,
.bind-form {
  width: 100%;
}

.btn-primary {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #16469f 0%, #0f5fcf 100%);
  color: #fff;
  font-size: 32rpx;
  border-radius: 44rpx;
  border: none;
}

.login-tip {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #7b8ba4;
  margin-top: 24rpx;
}

.bind-title {
  display: block;
  text-align: center;
  font-size: 30rpx;
  color: #4b5c79;
  margin-bottom: 40rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  background: #f8fbff;
  border-radius: 16rpx;
  padding: 0 28rpx;
  font-size: 30rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
  border: 1px solid rgba(22, 70, 159, 0.08);
}

.dev-login {
  margin-top: 56rpx;
  padding-top: 36rpx;
  border-top: 1px dashed rgba(22, 70, 159, 0.16);
}

.dev-title {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #7b8ba4;
  margin-bottom: 24rpx;
}

.dev-roles {
  display: flex;
  gap: 12rpx;
  justify-content: center;
  margin-bottom: 24rpx;
  flex-wrap: wrap;
}

.dev-role-tag {
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
  background: #eef4ff;
  color: #51657f;
}

.dev-role-tag.active {
  background: #16469f;
  color: #fff;
}

.btn-dev {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: #0ea74a;
  color: #fff;
  font-size: 28rpx;
  border-radius: 40rpx;
  border: none;
}
</style>
