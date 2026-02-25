<script setup lang="ts">
/**
 * 编辑会员
 * 修改会员基本信息
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'

const memberId = ref(0)
const loading = ref(true)
const submitting = ref(false)

const form = ref({
  phone: '',
  name: '',
  gender: '',
  birthday: '',
  remark: '',
})

const genderOptions = ['男', '女', '未知']
const genderIndex = ref(-1)

onLoad((options) => {
  if (options?.memberId) {
    memberId.value = Number(options.memberId)
    loadDetail()
  }
})

async function loadDetail() {
  loading.value = true
  try {
    const { data } = await memberApi.detail(memberId.value)
    form.value.phone = data.phone || ''
    form.value.name = data.name || ''
    form.value.gender = data.gender || ''
    form.value.birthday = data.birthday ? data.birthday.substring(0, 10) : ''
    form.value.remark = data.remark || ''

    // Set gender picker index
    const idx = genderOptions.indexOf(form.value.gender)
    genderIndex.value = idx >= 0 ? idx : -1
  } catch {
    uni.showToast({ title: '加载会员信息失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function onGenderChange(e: any) {
  genderIndex.value = Number(e.detail.value)
  form.value.gender = genderOptions[genderIndex.value]
}

function onBirthdayChange(e: any) {
  form.value.birthday = e.detail.value
}

function validatePhone(phone: string): boolean {
  return /^\d{11}$/.test(phone)
}

async function onSubmit() {
  const { phone, name, gender, birthday, remark } = form.value

  if (!phone.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  if (!validatePhone(phone.trim())) {
    uni.showToast({ title: '手机号必须为11位数字', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const updateData: Record<string, any> = {
      phone: phone.trim(),
    }
    if (name.trim()) updateData.name = name.trim()
    else updateData.name = ''
    updateData.gender = gender || ''
    updateData.birthday = birthday || ''
    updateData.remark = remark.trim()

    await memberApi.update(memberId.value, updateData)
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch {
    // request.ts already handles error toast
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <!-- Loading -->
    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else>
      <!-- Form -->
      <view class="form-card">
        <!-- Phone -->
        <view class="form-item">
          <view class="form-label">
            <text class="label-text">手机号</text>
            <text class="required">*</text>
          </view>
          <input
            v-model="form.phone"
            class="form-input"
            type="number"
            maxlength="11"
            placeholder="请输入11位手机号"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-divider" />

        <!-- Name -->
        <view class="form-item">
          <view class="form-label">
            <text class="label-text">姓名</text>
          </view>
          <input
            v-model="form.name"
            class="form-input"
            type="text"
            placeholder="请输入会员姓名"
            placeholder-class="input-placeholder"
          />
        </view>

        <view class="form-divider" />

        <!-- Gender -->
        <view class="form-item">
          <view class="form-label">
            <text class="label-text">性别</text>
          </view>
          <picker :range="genderOptions" :value="genderIndex" @change="onGenderChange">
            <view class="picker-value">
              <text :class="form.gender ? 'picker-text' : 'picker-placeholder'">
                {{ form.gender || '请选择性别' }}
              </text>
              <text class="picker-arrow">></text>
            </view>
          </picker>
        </view>

        <view class="form-divider" />

        <!-- Birthday -->
        <view class="form-item">
          <view class="form-label">
            <text class="label-text">生日</text>
          </view>
          <picker mode="date" :value="form.birthday" @change="onBirthdayChange">
            <view class="picker-value">
              <text :class="form.birthday ? 'picker-text' : 'picker-placeholder'">
                {{ form.birthday || '请选择生日' }}
              </text>
              <text class="picker-arrow">></text>
            </view>
          </picker>
        </view>

        <view class="form-divider" />

        <!-- Remark -->
        <view class="form-item form-item-textarea">
          <view class="form-label">
            <text class="label-text">备注</text>
          </view>
          <textarea
            v-model="form.remark"
            class="form-textarea"
            placeholder="请输入备注信息"
            placeholder-class="input-placeholder"
            maxlength="200"
            :auto-height="true"
          />
        </view>
      </view>

      <!-- Submit -->
      <view class="submit-area">
        <view
          class="submit-btn"
          :class="{ 'submit-btn--disabled': submitting }"
          @tap="onSubmit"
        >
          <text class="submit-btn-text">{{ submitting ? '保存中...' : '保存修改' }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding: 24rpx;
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 200rpx 0;
}
.loading-text {
  font-size: 28rpx;
  color: #999;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 0 32rpx;
  overflow: hidden;
}

.form-item {
  display: flex;
  align-items: center;
  min-height: 96rpx;
  padding: 24rpx 0;
}

.form-item-textarea {
  flex-direction: column;
  align-items: flex-start;
}

.form-label {
  display: flex;
  align-items: center;
  width: 160rpx;
  flex-shrink: 0;
}

.label-text {
  font-size: 28rpx;
  color: #333;
}

.required {
  font-size: 28rpx;
  color: #ff3b30;
  margin-left: 4rpx;
}

.form-input {
  flex: 1;
  height: 48rpx;
  font-size: 28rpx;
  color: #333;
  text-align: right;
}

.input-placeholder {
  color: #c8c8c8;
  font-size: 28rpx;
}

.picker-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.picker-text {
  font-size: 28rpx;
  color: #333;
}

.picker-placeholder {
  font-size: 28rpx;
  color: #c8c8c8;
}

.picker-arrow {
  font-size: 24rpx;
  color: #c8c8c8;
  margin-left: 8rpx;
}

.form-divider {
  height: 1rpx;
  background: #f0f0f0;
}

.form-textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 28rpx;
  color: #333;
  margin-top: 12rpx;
  line-height: 1.6;
}

.submit-area {
  padding: 48rpx 0 32rpx;
}

.submit-btn {
  height: 88rpx;
  background: #4a90d9;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.submit-btn--disabled {
  opacity: 0.6;
}

.submit-btn-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: 600;
}
</style>
