<script setup lang="ts">
/**
 * 会员详情
 * 展示会员完整信息，包含余额、次卡、消费/充值记录，以及插件扩展的标签页和操作按钮
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import PluginSlot from '@/components/PluginSlot.vue'

const memberId = ref(0)
const member = ref<any>(null)
const loading = ref(true)

// Tab: 消费记录 / 充值记录
const activeTab = ref<'orders' | 'recharges'>('orders')
const orders = ref<any[]>([])
const recharges = ref<any[]>([])
const ordersPage = ref(1)
const rechargesPage = ref(1)
const ordersFinished = ref(false)
const rechargesFinished = ref(false)
const ordersLoading = ref(false)
const rechargesLoading = ref(false)

onLoad((options) => {
  if (options?.memberId) {
    memberId.value = Number(options.memberId)
    loadDetail()
    loadOrders()
  }
})

async function loadDetail() {
  loading.value = true
  try {
    const { data } = await memberApi.detail(memberId.value)
    member.value = data
  } catch {
    uni.showToast({ title: '加载会员信息失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadOrders() {
  if (ordersLoading.value || ordersFinished.value) return
  ordersLoading.value = true
  try {
    const { data } = await memberApi.orders(memberId.value, ordersPage.value)
    const list = data?.list || data || []
    if (list.length === 0) {
      ordersFinished.value = true
    } else {
      orders.value.push(...list)
      ordersPage.value++
    }
  } catch {
    // silent
  } finally {
    ordersLoading.value = false
  }
}

async function loadRecharges() {
  if (rechargesLoading.value || rechargesFinished.value) return
  rechargesLoading.value = true
  try {
    const { data } = await memberApi.recharges(memberId.value, rechargesPage.value)
    const list = data?.list || data || []
    if (list.length === 0) {
      rechargesFinished.value = true
    } else {
      recharges.value.push(...list)
      rechargesPage.value++
    }
  } catch {
    // silent
  } finally {
    rechargesLoading.value = false
  }
}

function switchTab(tab: 'orders' | 'recharges') {
  activeTab.value = tab
  if (tab === 'recharges' && recharges.value.length === 0 && !rechargesFinished.value) {
    loadRecharges()
  }
}

const visitCards = computed(() => {
  if (!member.value?.visitCards) return []
  return member.value.visitCards.filter((c: any) => c.remaining > 0)
})

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${mi}`
}

function goEdit() {
  uni.navigateTo({ url: `/sub-packages/member/edit?memberId=${memberId.value}` })
}

function goRecharge() {
  uni.navigateTo({ url: `/sub-packages/member/recharge?memberId=${memberId.value}` })
}
</script>

<template>
  <view class="page">
    <!-- Loading -->
    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else-if="member">
      <!-- Member Header Card -->
      <view class="header-card">
        <view class="header-top">
          <view class="avatar">
            <text class="avatar-text">{{ (member.name || '会')[0] }}</text>
          </view>
          <view class="header-info">
            <text class="member-name">{{ member.name || '未命名会员' }}</text>
            <text class="member-phone">{{ member.phone }}</text>
          </view>
        </view>
        <view class="header-meta">
          <view v-if="member.cardNo" class="meta-item">
            <text class="meta-label">卡号</text>
            <text class="meta-value">{{ member.cardNo }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">入会时间</text>
            <text class="meta-value">{{ formatDate(member.createdAt) }}</text>
          </view>
          <view v-if="member.remark" class="meta-item">
            <text class="meta-label">备注</text>
            <text class="meta-value">{{ member.remark }}</text>
          </view>
        </view>
      </view>

      <!-- Balance Section -->
      <view class="balance-card">
        <view class="balance-title-row">
          <text class="section-title">账户余额</text>
        </view>
        <view class="balance-grid">
          <view class="balance-item">
            <text class="balance-amount">{{ member.balance ?? '0.00' }}</text>
            <text class="balance-label">总余额(元)</text>
          </view>
          <view class="balance-divider" />
          <view class="balance-item">
            <text class="balance-amount real">{{ member.realBalance ?? '0.00' }}</text>
            <text class="balance-label">实充余额(元)</text>
          </view>
          <view class="balance-divider" />
          <view class="balance-item">
            <text class="balance-amount gift">{{ member.giftBalance ?? '0.00' }}</text>
            <text class="balance-label">赠送余额(元)</text>
          </view>
        </view>
      </view>

      <!-- Visit Cards Section -->
      <view v-if="visitCards.length > 0" class="section-card">
        <text class="section-title">次卡账户</text>
        <view class="visit-card-list">
          <view v-for="(card, idx) in visitCards" :key="idx" class="visit-card-item">
            <view class="vc-info">
              <text class="vc-name">{{ card.serviceName || card.name }}</text>
            </view>
            <view class="vc-count">
              <text class="vc-remaining">{{ card.remaining }}</text>
              <text class="vc-total">/{{ card.total }}次</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Plugin Slot: detail tabs -->
      <PluginSlot name="member-detail-tabs" :context="{ member }" />

      <!-- Records Tabs -->
      <view class="section-card records-section">
        <view class="tab-bar">
          <view
            class="tab-item"
            :class="{ 'tab-item--active': activeTab === 'orders' }"
            @tap="switchTab('orders')"
          >
            <text class="tab-text">消费记录</text>
          </view>
          <view
            class="tab-item"
            :class="{ 'tab-item--active': activeTab === 'recharges' }"
            @tap="switchTab('recharges')"
          >
            <text class="tab-text">充值记录</text>
          </view>
        </view>

        <!-- Orders List -->
        <view v-if="activeTab === 'orders'" class="record-list">
          <view v-if="orders.length === 0 && !ordersLoading" class="empty-records">
            <text class="empty-text">暂无消费记录</text>
          </view>
          <view v-for="(order, idx) in orders" :key="'o' + idx" class="record-item">
            <view class="record-main">
              <text class="record-title">{{ order.orderNo || '消费订单' }}</text>
              <text class="record-time">{{ formatDateTime(order.createdAt || order.date) }}</text>
            </view>
            <view class="record-detail">
              <text v-if="order.services" class="record-services">
                {{ Array.isArray(order.services) ? order.services.map((s: any) => s.name || s).join('、') : order.services }}
              </text>
              <text v-if="order.items" class="record-services">
                {{ Array.isArray(order.items) ? order.items.map((s: any) => s.name || s.serviceName || s).join('、') : order.items }}
              </text>
            </view>
            <view class="record-amount-row">
              <text class="record-amount">-¥{{ order.totalAmount ?? order.amount ?? '0.00' }}</text>
            </view>
          </view>
          <view v-if="ordersLoading" class="loading-more">
            <text class="loading-more-text">加载中...</text>
          </view>
          <view
            v-else-if="!ordersFinished && orders.length > 0"
            class="load-more"
            @tap="loadOrders"
          >
            <text class="load-more-text">加载更多</text>
          </view>
        </view>

        <!-- Recharges List -->
        <view v-if="activeTab === 'recharges'" class="record-list">
          <view v-if="recharges.length === 0 && !rechargesLoading" class="empty-records">
            <text class="empty-text">暂无充值记录</text>
          </view>
          <view v-for="(rec, idx) in recharges" :key="'r' + idx" class="record-item">
            <view class="record-main">
              <text class="record-title">{{ rec.planName || '充值' }}</text>
              <text class="record-time">{{ formatDateTime(rec.createdAt || rec.date) }}</text>
            </view>
            <view class="record-recharge-info">
              <view class="recharge-tag paid">
                <text class="tag-text">实付 ¥{{ rec.paidAmount ?? rec.amount ?? '0.00' }}</text>
              </view>
              <view v-if="rec.giftAmount && Number(rec.giftAmount) > 0" class="recharge-tag gift">
                <text class="tag-text">赠送 ¥{{ rec.giftAmount }}</text>
              </view>
            </view>
          </view>
          <view v-if="rechargesLoading" class="loading-more">
            <text class="loading-more-text">加载中...</text>
          </view>
          <view
            v-else-if="!rechargesFinished && recharges.length > 0"
            class="load-more"
            @tap="loadRecharges"
          >
            <text class="load-more-text">加载更多</text>
          </view>
        </view>
      </view>

      <!-- Plugin Slot: detail actions -->
      <PluginSlot name="member-detail-actions" :context="{ member }" />

      <!-- Action Buttons -->
      <view class="action-bar">
        <view class="action-btn action-btn--edit" @tap="goEdit">
          <text class="action-btn-text">编辑</text>
        </view>
        <view class="action-btn action-btn--recharge" @tap="goRecharge">
          <text class="action-btn-text">充值</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding-bottom: 160rpx;
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

/* Header Card */
.header-card {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  padding: 40rpx 32rpx 32rpx;
}
.header-top {
  display: flex;
  align-items: center;
  margin-bottom: 28rpx;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 48rpx;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}
.avatar-text {
  font-size: 40rpx;
  color: #fff;
  font-weight: 600;
}
.header-info {
  flex: 1;
}
.member-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
  display: block;
}
.member-phone {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 6rpx;
  display: block;
}
.header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 32rpx;
}
.meta-item {
  display: flex;
  align-items: center;
}
.meta-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-right: 8rpx;
}
.meta-value {
  font-size: 24rpx;
  color: #fff;
}

/* Balance Card */
.balance-card {
  background: #fff;
  border-radius: 16rpx;
  margin: 24rpx;
  padding: 28rpx 24rpx;
}
.balance-title-row {
  margin-bottom: 20rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}
.balance-grid {
  display: flex;
  align-items: center;
}
.balance-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.balance-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #ff9500;
  display: block;
}
.balance-amount.real {
  color: #4a90d9;
}
.balance-amount.gift {
  color: #4cd964;
}
.balance-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}
.balance-divider {
  width: 1rpx;
  height: 60rpx;
  background: #f0f0f0;
}

/* Section Card */
.section-card {
  background: #fff;
  border-radius: 16rpx;
  margin: 0 24rpx 24rpx;
  padding: 28rpx 24rpx;
}

/* Visit Cards */
.visit-card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.visit-card-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8f9fc;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}
.vc-name {
  font-size: 28rpx;
  color: #333;
}
.vc-count {
  display: flex;
  align-items: baseline;
}
.vc-remaining {
  font-size: 34rpx;
  font-weight: 700;
  color: #4a90d9;
}
.vc-total {
  font-size: 24rpx;
  color: #999;
  margin-left: 4rpx;
}

/* Tabs */
.records-section {
  padding-top: 0;
}
.tab-bar {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
}
.tab-item {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 24rpx 0;
  position: relative;
}
.tab-item--active .tab-text {
  color: #4a90d9;
  font-weight: 600;
}
.tab-item--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48rpx;
  height: 4rpx;
  background: #4a90d9;
  border-radius: 2rpx;
}
.tab-text {
  font-size: 28rpx;
  color: #666;
}

/* Record List */
.record-list {
  padding-top: 16rpx;
}
.record-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.record-item:last-child {
  border-bottom: none;
}
.record-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.record-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}
.record-time {
  font-size: 22rpx;
  color: #999;
}
.record-detail {
  margin-bottom: 8rpx;
}
.record-services {
  font-size: 24rpx;
  color: #666;
  display: block;
}
.record-amount-row {
  display: flex;
  justify-content: flex-end;
}
.record-amount {
  font-size: 28rpx;
  font-weight: 600;
  color: #ff3b30;
}
.record-recharge-info {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
}
.recharge-tag {
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.recharge-tag.paid {
  background: #e8f4fd;
}
.recharge-tag.gift {
  background: #e8f8ea;
}
.tag-text {
  font-size: 24rpx;
  color: #333;
}
.empty-records {
  padding: 60rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 26rpx;
  color: #999;
}
.loading-more,
.load-more {
  padding: 24rpx 0;
  text-align: center;
}
.loading-more-text,
.load-more-text {
  font-size: 24rpx;
  color: #4a90d9;
}

/* Action Bar */
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 24rpx;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.action-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn--edit {
  background: #fff;
  border: 2rpx solid #4a90d9;
}
.action-btn--edit .action-btn-text {
  color: #4a90d9;
}
.action-btn--recharge {
  background: #4a90d9;
}
.action-btn--recharge .action-btn-text {
  color: #fff;
}
.action-btn-text {
  font-size: 30rpx;
  font-weight: 600;
}
</style>
