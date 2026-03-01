<script setup lang="ts">
/**
 * 门店设置
 * 门店基本信息和营业参数配置
 */
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { storeApi } from '@/api/admin'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const loading = ref(false)
const saving = ref(false)

const form = ref({
  name: '',
  address: '',
  phone: '',
  openTime: '09:00',
  closeTime: '22:00',
})

onShow(() => {
  loadStoreDetail()
})

async function loadStoreDetail() {
  if (!userStore.storeId) {
    uni.showToast({ title: '未获取到门店信息', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const { data } = await storeApi.detail(userStore.storeId)
    form.value = {
      name: data.name || '',
      address: data.address || '',
      phone: data.phone || '',
      openTime: data.openTime || '09:00',
      closeTime: data.closeTime || '22:00',
    }
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) } finally {
    loading.value = false
  }
}

function onOpenTimeChange(e: any) {
  form.value.openTime = e.detail.value
}

function onCloseTimeChange(e: any) {
  form.value.closeTime = e.detail.value
}

async function saveSettings() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入门店名称', icon: 'none' })
    return
  }
  if (!form.value.phone.trim()) {
    uni.showToast({ title: '请输入联系电话', icon: 'none' })
    return
  }

  saving.value = true
  try {
    await storeApi.update(userStore.storeId, {
      name: form.value.name,
      address: form.value.address,
      phone: form.value.phone,
      openTime: form.value.openTime,
      closeTime: form.value.closeTime,
    })
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch { uni.showToast({ title: '保存失败', icon: 'none' }) } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">门店设置</text>
    </view>

    <view v-if="loading" class="loading-tip">
      <text>加载中...</text>
    </view>

    <view v-else class="form-area">
      <!-- 门店名称 -->
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">门店名称</text>
          <input v-model="form.name" class="form-input" placeholder="请输入门店名称" />
        </view>

        <view class="form-group">
          <text class="form-label">门店地址</text>
          <input v-model="form.address" class="form-input" placeholder="请输入门店地址" />
        </view>

        <view class="form-group">
          <text class="form-label">联系电话</text>
          <input v-model="form.phone" class="form-input" type="number" placeholder="请输入联系电话" />
        </view>
      </view>

      <!-- 营业时间 -->
      <view class="form-card">
        <view class="card-title-row">
          <text class="card-title">营业时间</text>
        </view>

        <view class="time-row">
          <view class="time-item">
            <text class="time-label">开始时间</text>
            <picker mode="time" :value="form.openTime" @change="onOpenTimeChange">
              <view class="time-display">
                <text class="time-value">{{ form.openTime }}</text>
                <text class="time-arrow">&#9662;</text>
              </view>
            </picker>
          </view>

          <view class="time-divider">
            <text class="divider-text">至</text>
          </view>

          <view class="time-item">
            <text class="time-label">结束时间</text>
            <picker mode="time" :value="form.closeTime" @change="onCloseTimeChange">
              <view class="time-display">
                <text class="time-value">{{ form.closeTime }}</text>
                <text class="time-arrow">&#9662;</text>
              </view>
            </picker>
          </view>
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="save-area">
        <view class="save-btn" :class="{ disabled: saving }" @tap="saveSettings">
          <text class="save-text">{{ saving ? '保存中...' : '保存设置' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
}
.page-header {
  padding: 24rpx 32rpx;
  background-color: #fff;
}
.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

/* 加载中 */
.loading-tip {
  padding: 100rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}

/* 表单区域 */
.form-area {
  padding: 20rpx;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
}

.card-title-row {
  margin-bottom: 20rpx;
}
.card-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.form-group {
  margin-bottom: 24rpx;
}
.form-group:last-child {
  margin-bottom: 0;
}
.form-label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 12rpx;
}
.form-input {
  height: 80rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
  background: #fafafa;
}

/* 营业时间 */
.time-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.time-item {
  flex: 1;
}
.time-label {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 8rpx;
}
.time-display {
  height: 80rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
}
.time-value {
  font-size: 32rpx;
  font-weight: bold;
  color: #4a90d9;
}
.time-arrow {
  font-size: 24rpx;
  color: #999;
}
.time-divider {
  padding-top: 32rpx;
}
.divider-text {
  font-size: 28rpx;
  color: #999;
}

/* 保存按钮 */
.save-area {
  padding: 40rpx 0;
}
.save-btn {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 44rpx;
}
.save-btn.disabled {
  opacity: 0.6;
}
.save-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}
</style>
