<script setup lang="ts">
/**
 * 会员 - 搜索/管理
 */
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { memberApi } from '@/api/member'

const keyword = ref('')
const members = ref<any[]>([])
const loading = ref(false)

onShow(() => { loadRecent() })

async function loadRecent() {
  loading.value = true
  try {
    const { data } = await memberApi.recent(20)
    members.value = data
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) } finally { loading.value = false }
}

async function onSearch() {
  if (!keyword.value.trim()) { loadRecent(); return }
  loading.value = true
  try {
    const { data } = await memberApi.search(keyword.value.trim())
    members.value = data.list
  } catch { uni.showToast({ title: '搜索失败', icon: 'none' }) } finally { loading.value = false }
}

function goAdd() { uni.navigateTo({ url: '/sub-packages/member/add' }) }
function goRecharge(id: number) { uni.navigateTo({ url: `/sub-packages/member/recharge?memberId=${id}` }) }
function goDetail(id: number) { uni.navigateTo({ url: `/sub-packages/member/detail?memberId=${id}` }) }
</script>

<template>
  <view class="member-page">
    <view class="search-bar">
      <input v-model="keyword" class="search-input" placeholder="手机号/姓名/卡号搜索" confirm-type="search" @confirm="onSearch" />
      <text class="search-btn" @tap="onSearch">搜索</text>
    </view>

    <view class="quick-actions">
      <view class="action-btn" @tap="goAdd">
        <text class="action-icon">+</text>
        <text class="action-text">新增会员</text>
      </view>
    </view>

    <view v-if="members.length > 0" class="member-list">
      <view v-for="m in members" :key="m.id" class="member-card" @tap="goDetail(m.id)">
        <view class="member-info">
          <text class="member-name">{{ m.name || '未命名' }}</text>
          <text class="member-phone">{{ m.phone }}</text>
        </view>
        <view class="member-balance">
          <text class="balance-value">¥{{ m.balance }}</text>
          <text class="balance-label">余额</text>
        </view>
        <view class="member-action" @tap.stop="goRecharge(m.id)">
          <text class="recharge-btn">充值</text>
        </view>
      </view>
    </view>
    <view v-else class="empty">
      <text>{{ loading ? '加载中...' : '暂无会员数据' }}</text>
    </view>
  </view>
</template>

<style scoped>
.member-page { padding: 20rpx; background: #f5f6fa; min-height: 100vh; }
.search-bar { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.search-input { flex: 1; height: 72rpx; background: #fff; border-radius: 36rpx; padding: 0 28rpx; font-size: 28rpx; }
.search-btn { height: 72rpx; line-height: 72rpx; padding: 0 28rpx; background: #4a90d9; color: #fff; border-radius: 36rpx; font-size: 28rpx; }
.quick-actions { display: flex; gap: 16rpx; margin-bottom: 20rpx; }
.action-btn { display: flex; align-items: center; gap: 8rpx; padding: 16rpx 28rpx; background: #fff; border-radius: 12rpx; }
.action-icon { font-size: 36rpx; color: #4a90d9; font-weight: bold; }
.action-text { font-size: 28rpx; color: #333; }
.member-list { display: flex; flex-direction: column; gap: 16rpx; }
.member-card { display: flex; align-items: center; background: #fff; border-radius: 12rpx; padding: 24rpx; }
.member-info { flex: 1; }
.member-name { font-size: 30rpx; font-weight: bold; color: #333; display: block; }
.member-phone { font-size: 24rpx; color: #999; margin-top: 4rpx; }
.member-balance { text-align: center; margin-right: 24rpx; }
.balance-value { font-size: 30rpx; font-weight: bold; color: #ff9500; display: block; }
.balance-label { font-size: 22rpx; color: #999; }
.recharge-btn { padding: 8rpx 24rpx; background: #4a90d9; color: #fff; border-radius: 20rpx; font-size: 24rpx; }
.empty { padding: 100rpx; text-align: center; color: #999; font-size: 28rpx; }
</style>
