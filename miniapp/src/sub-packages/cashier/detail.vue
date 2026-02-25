<script setup lang="ts">
/**
 * 订单详情
 * 展示订单完整信息：状态、客户、服务项目、金额、支付、操作
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useOrderStore } from '@/store/modules/order'
import { orderApi } from '@/api/order'
import PluginSlot from '@/components/PluginSlot.vue'

const orderStore = useOrderStore()

const orderId = ref(0)
const order = ref<any>(null)
const loading = ref(true)
const showRefundModal = ref(false)
const refunding = ref(false)

// --- Status display config ---
const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: '进行中', color: '#ff9500', bg: '#fff8ed' },
  completed: { label: '已完成', color: '#4cd964', bg: '#edfbf0' },
  refunded: { label: '已退款', color: '#ff3b30', bg: '#fff0ef' },
  cancelled: { label: '已取消', color: '#999', bg: '#f5f5f5' },
}

const statusInfo = computed(() => {
  const s = order.value?.status || ''
  return statusMap[s] || { label: s, color: '#999', bg: '#f5f5f5' }
})

// --- Amount display ---
const originalAmount = computed(() => order.value?.totalAmount ?? 0)
const discountAmount = computed(() => order.value?.discountAmount ?? 0)
const actualAmount = computed(() => order.value?.actualAmount ?? order.value?.totalAmount ?? 0)

// --- Items ---
const orderItems = computed(() => order.value?.items || [])

// --- Lifecycle ---
onLoad((options: any) => {
  orderId.value = Number(options.orderId) || 0
})

onShow(() => {
  if (orderId.value) {
    loadOrder()
  }
})

async function loadOrder() {
  loading.value = true
  try {
    const data = await orderStore.loadOrderDetail(orderId.value)
    order.value = data
  } catch (e: any) {
    uni.showToast({ title: e.message || '加载订单失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// --- Actions ---
function goModify() {
  uni.navigateTo({
    url: `/sub-packages/cashier/modify?orderId=${orderId.value}`,
  })
}

function goCheckout() {
  uni.navigateTo({
    url: `/sub-packages/cashier/checkout?orderId=${orderId.value}`,
  })
}

function confirmRefund() {
  showRefundModal.value = true
}

async function doRefund() {
  refunding.value = true
  try {
    await orderApi.refund(orderId.value)
    uni.showToast({ title: '退款成功', icon: 'success' })
    showRefundModal.value = false
    loadOrder()
  } catch (e: any) {
    uni.showToast({ title: e.message || '退款失败', icon: 'none' })
  } finally {
    refunding.value = false
  }
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const paymentTypeMap: Record<string, string> = {
  cash: '现金',
  wechat: '微信支付',
  member_balance: '会员余额',
  mixed: '混合支付',
}
</script>

<template>
  <view class="page">
    <!-- Loading -->
    <view v-if="loading" class="loading-page">
      <text class="loading-text">加载中...</text>
    </view>

    <template v-else-if="order">
      <scroll-view scroll-y class="page-scroll">
        <!-- Order header -->
        <view class="order-header">
          <view class="header-top">
            <text class="order-no">订单号: {{ order.orderNo || order.id }}</text>
            <view class="status-badge" :style="{ color: statusInfo.color, backgroundColor: statusInfo.bg }">
              <text class="status-text">{{ statusInfo.label }}</text>
            </view>
          </view>
          <view class="header-info">
            <text class="room-name">{{ order.roomName || '未知房间' }}</text>
            <text class="create-time">{{ formatTime(order.createdAt) }}</text>
          </view>
        </view>

        <!-- Customer info -->
        <view class="section">
          <text class="section-title">客户信息</text>
          <view class="info-rows">
            <view class="info-row">
              <text class="info-label">客户</text>
              <text class="info-value">
                {{ order.memberName || order.customerName || '散客' }}
              </text>
            </view>
            <view v-if="order.memberPhone || order.customerPhone" class="info-row">
              <text class="info-label">电话</text>
              <text class="info-value">{{ order.memberPhone || order.customerPhone }}</text>
            </view>
            <view v-if="order.memberId" class="info-row">
              <text class="info-label">类型</text>
              <view class="member-tag">
                <text class="member-tag-text">会员</text>
              </view>
            </view>
          </view>
        </view>

        <!-- Service items -->
        <view class="section">
          <text class="section-title">服务项目</text>
          <view class="item-list">
            <view v-for="(item, idx) in orderItems" :key="idx" class="order-item">
              <view class="item-left">
                <view class="item-name-row">
                  <text class="item-name">{{ item.serviceName || item.service?.name }}</text>
                  <view v-if="item.isVisitCard" class="visit-card-tag">
                    <text class="visit-tag-text">点钟</text>
                  </view>
                </view>
                <text class="item-tech">{{ item.technicianName || item.technician?.name || '未分配' }}</text>
              </view>
              <text class="item-price">&yen;{{ (item.price || item.amount || 0).toFixed(2) }}</text>
            </view>
          </view>
        </view>

        <!-- Amounts -->
        <view class="section">
          <text class="section-title">金额信息</text>
          <view class="amount-rows">
            <view class="amount-row">
              <text class="amount-label">合计金额</text>
              <text class="amount-value">&yen;{{ originalAmount.toFixed(2) }}</text>
            </view>
            <view v-if="discountAmount > 0" class="amount-row">
              <text class="amount-label">优惠金额</text>
              <text class="amount-value discount">-&yen;{{ discountAmount.toFixed(2) }}</text>
            </view>
            <view class="amount-row actual">
              <text class="amount-label-actual">实收金额</text>
              <text class="amount-value-actual">&yen;{{ actualAmount.toFixed(2) }}</text>
            </view>
          </view>
        </view>

        <!-- Payment info -->
        <view v-if="order.status === 'completed' || order.status === 'refunded'" class="section">
          <text class="section-title">支付信息</text>
          <view class="info-rows">
            <view class="info-row">
              <text class="info-label">支付方式</text>
              <text class="info-value">{{ paymentTypeMap[order.paymentType] || order.paymentType || '未知' }}</text>
            </view>
            <view v-if="order.paidAt" class="info-row">
              <text class="info-label">支付时间</text>
              <text class="info-value">{{ formatTime(order.paidAt) }}</text>
            </view>
            <view v-if="order.payments && order.payments.length > 0" class="info-row">
              <text class="info-label">支付明细</text>
              <view class="payment-details">
                <text v-for="(p, pi) in order.payments" :key="pi" class="payment-item">
                  {{ paymentTypeMap[p.type] || p.type }}: &yen;{{ p.amount.toFixed(2) }}
                </text>
              </view>
            </view>
          </view>
        </view>

        <!-- Plugin slot -->
        <view class="section plugin-section">
          <PluginSlot name="order-detail-extra" :context="{ order }" />
        </view>
      </scroll-view>

      <!-- Action buttons -->
      <view class="action-bar" v-if="order.status === 'in_progress' || order.status === 'completed'">
        <template v-if="order.status === 'in_progress'">
          <view class="action-btn secondary" @tap="goModify">
            <text class="action-btn-text secondary-text">加单</text>
          </view>
          <view class="action-btn primary" @tap="goCheckout">
            <text class="action-btn-text primary-text">结账</text>
          </view>
        </template>
        <template v-else-if="order.status === 'completed'">
          <view class="action-btn danger" @tap="confirmRefund">
            <text class="action-btn-text danger-text">退款</text>
          </view>
        </template>
      </view>
    </template>

    <!-- Error state -->
    <view v-else class="error-page">
      <text class="error-text">订单加载失败</text>
      <view class="retry-btn" @tap="loadOrder">
        <text class="retry-text">重试</text>
      </view>
    </view>

    <!-- Refund confirm modal -->
    <view v-if="showRefundModal" class="modal-mask" @tap.self="showRefundModal = false">
      <view class="modal-content">
        <text class="modal-title">确认退款</text>
        <text class="modal-desc">确认对该订单进行退款操作？退款后不可撤销。</text>
        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="showRefundModal = false">
            <text class="modal-btn-text cancel-text">取消</text>
          </view>
          <view class="modal-btn confirm" @tap="doRefund">
            <text class="modal-btn-text confirm-text">{{ refunding ? '处理中...' : '确认退款' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  display: flex;
  flex-direction: column;
}

/* Loading & error */
.loading-page,
.error-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
}
.loading-text,
.error-text {
  font-size: 28rpx;
  color: #999;
}
.retry-btn {
  margin-top: 24rpx;
  padding: 12rpx 40rpx;
  background-color: #4a90d9;
  border-radius: 32rpx;
}
.retry-text {
  font-size: 26rpx;
  color: #fff;
}

/* Scroll */
.page-scroll {
  flex: 1;
}

/* Order header */
.order-header {
  background-color: #fff;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.order-no {
  font-size: 26rpx;
  color: #666;
}
.status-badge {
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.status-text {
  font-size: 24rpx;
  font-weight: 500;
}
.header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.room-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}
.create-time {
  font-size: 24rpx;
  color: #999;
}

/* Section */
.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 0 24rpx 24rpx;
}
.plugin-section {
  padding: 0;
  background-color: transparent;
}
.plugin-section:empty {
  display: none;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

/* Info rows */
.info-rows {
  margin-top: 4rpx;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}
.info-label {
  font-size: 26rpx;
  color: #999;
}
.info-value {
  font-size: 26rpx;
  color: #333;
}
.member-tag {
  background-color: #4a90d9;
  border-radius: 6rpx;
  padding: 2rpx 12rpx;
}
.member-tag-text {
  font-size: 22rpx;
  color: #fff;
}

/* Payment details */
.payment-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.payment-item {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 4rpx;
}

/* Order items */
.item-list {
  margin-top: 4rpx;
}
.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
.order-item:last-child {
  border-bottom: none;
}
.item-left {
  flex: 1;
}
.item-name-row {
  display: flex;
  align-items: center;
  margin-bottom: 6rpx;
}
.item-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}
.visit-card-tag {
  background-color: #ff9500;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  margin-left: 10rpx;
}
.visit-tag-text {
  font-size: 20rpx;
  color: #fff;
}
.item-tech {
  font-size: 24rpx;
  color: #999;
}
.item-price {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

/* Amounts */
.amount-rows {
  margin-top: 4rpx;
}
.amount-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}
.amount-label {
  font-size: 26rpx;
  color: #666;
}
.amount-value {
  font-size: 26rpx;
  color: #333;
}
.amount-value.discount {
  color: #4cd964;
}
.amount-row.actual {
  margin-top: 8rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}
.amount-label-actual {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}
.amount-value-actual {
  font-size: 34rpx;
  color: #ff3b30;
  font-weight: 700;
}

/* Action bar */
.action-bar {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.action-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.action-btn.primary {
  background-color: #4a90d9;
}
.action-btn.secondary {
  background-color: #fff;
  border: 2rpx solid #4a90d9;
}
.action-btn.danger {
  background-color: #fff;
  border: 2rpx solid #ff3b30;
}
.action-btn-text {
  font-size: 30rpx;
  font-weight: 600;
}
.primary-text {
  color: #fff;
}
.secondary-text {
  color: #4a90d9;
}
.danger-text {
  color: #ff3b30;
}

/* Modal */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-content {
  width: 560rpx;
  background-color: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx 40rpx;
  text-align: center;
}
.modal-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}
.modal-desc {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 40rpx;
  line-height: 1.5;
}
.modal-actions {
  display: flex;
  gap: 20rpx;
}
.modal-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-btn.cancel {
  background-color: #f5f6fa;
}
.modal-btn.confirm {
  background-color: #ff3b30;
}
.modal-btn-text {
  font-size: 28rpx;
  font-weight: 600;
}
.cancel-text {
  color: #666;
}
.confirm-text {
  color: #fff;
}
</style>
