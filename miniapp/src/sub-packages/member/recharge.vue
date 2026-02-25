<script setup lang="ts">
/**
 * 充值
 * 会员余额/次卡充值操作，选择充值方案和支付方式
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { memberApi } from '@/api/member'
import { rechargePlanApi } from '@/api/admin'

const memberId = ref(0)
const member = ref<any>(null)
const loading = ref(true)
const submitting = ref(false)

// Plan type tab: amount / visit_card
const planTab = ref<'amount' | 'visit_card'>('amount')
const amountPlans = ref<any[]>([])
const visitCardPlans = ref<any[]>([])
const selectedPlanId = ref<number | null>(null)

// Payment method
const paymentMethods = [
  { key: 'cash', label: '现金' },
  { key: 'wechat', label: '微信支付' },
]
const selectedPayment = ref('cash')

const currentPlans = computed(() => {
  return planTab.value === 'amount' ? amountPlans.value : visitCardPlans.value
})

const selectedPlan = computed(() => {
  return currentPlans.value.find((p: any) => p.id === selectedPlanId.value) || null
})

onLoad((options) => {
  if (options?.memberId) {
    memberId.value = Number(options.memberId)
    loadData()
  }
})

async function loadData() {
  loading.value = true
  try {
    const [memberRes, amountRes] = await Promise.all([
      memberApi.detail(memberId.value),
      rechargePlanApi.list('amount'),
    ])
    member.value = memberRes.data
    amountPlans.value = amountRes.data || []
  } catch {
    uni.showToast({ title: '加载数据失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function switchPlanTab(tab: 'amount' | 'visit_card') {
  planTab.value = tab
  selectedPlanId.value = null

  if (tab === 'visit_card' && visitCardPlans.value.length === 0) {
    try {
      const { data } = await rechargePlanApi.list('visit_card')
      visitCardPlans.value = data || []
    } catch {
      // silent
    }
  }
}

function selectPlan(planId: number) {
  selectedPlanId.value = planId
}

function selectPayment(method: string) {
  selectedPayment.value = method
}

async function onSubmit() {
  if (!selectedPlanId.value) {
    uni.showToast({ title: '请选择充值方案', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await memberApi.recharge(memberId.value, {
      planId: selectedPlanId.value,
      paymentMethod: selectedPayment.value,
    })
    uni.showToast({ title: '充值成功', icon: 'success' })
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
      <!-- Member Info Card -->
      <view v-if="member" class="member-card">
        <view class="mc-left">
          <view class="mc-avatar">
            <text class="mc-avatar-text">{{ (member.name || '会')[0] }}</text>
          </view>
          <view class="mc-info">
            <text class="mc-name">{{ member.name || '未命名会员' }}</text>
            <text class="mc-phone">{{ member.phone }}</text>
          </view>
        </view>
        <view class="mc-balance">
          <text class="mc-balance-value">¥{{ member.balance ?? '0.00' }}</text>
          <text class="mc-balance-label">当前余额</text>
        </view>
      </view>

      <!-- Plan Type Tabs -->
      <view class="plan-tabs">
        <view
          class="plan-tab"
          :class="{ 'plan-tab--active': planTab === 'amount' }"
          @tap="switchPlanTab('amount')"
        >
          <text class="plan-tab-text">金额充值</text>
        </view>
        <view
          class="plan-tab"
          :class="{ 'plan-tab--active': planTab === 'visit_card' }"
          @tap="switchPlanTab('visit_card')"
        >
          <text class="plan-tab-text">次卡充值</text>
        </view>
      </view>

      <!-- Plan Cards Grid -->
      <view class="plan-section">
        <view v-if="currentPlans.length === 0" class="empty-plans">
          <text class="empty-text">暂无可用方案</text>
        </view>
        <view v-else class="plan-grid">
          <view
            v-for="plan in currentPlans"
            :key="plan.id"
            class="plan-card"
            :class="{ 'plan-card--selected': selectedPlanId === plan.id }"
            @tap="selectPlan(plan.id)"
          >
            <!-- Amount type plan -->
            <template v-if="planTab === 'amount'">
              <text class="plan-pay">¥{{ plan.payAmount ?? plan.amount }}</text>
              <view v-if="plan.giftAmount && Number(plan.giftAmount) > 0" class="plan-gift-badge">
                <text class="plan-gift-text">赠 ¥{{ plan.giftAmount }}</text>
              </view>
              <text class="plan-receive">
                到账 ¥{{ plan.totalAmount ?? (Number(plan.payAmount ?? plan.amount) + Number(plan.giftAmount || 0)) }}
              </text>
            </template>

            <!-- Visit card type plan -->
            <template v-else>
              <text class="plan-name">{{ plan.serviceName || plan.name }}</text>
              <text class="plan-pay">¥{{ plan.payAmount ?? plan.amount }}</text>
              <text class="plan-receive">{{ plan.totalCount ?? plan.count }}次</text>
              <view v-if="plan.giftCount && Number(plan.giftCount) > 0" class="plan-gift-badge">
                <text class="plan-gift-text">赠 {{ plan.giftCount }}次</text>
              </view>
            </template>

            <!-- Selected indicator -->
            <view v-if="selectedPlanId === plan.id" class="selected-check">
              <text class="check-icon">&#10003;</text>
            </view>
          </view>
        </view>
      </view>

      <!-- Payment Method -->
      <view class="payment-section">
        <text class="section-title">支付方式</text>
        <view class="payment-list">
          <view
            v-for="pm in paymentMethods"
            :key="pm.key"
            class="payment-item"
            :class="{ 'payment-item--active': selectedPayment === pm.key }"
            @tap="selectPayment(pm.key)"
          >
            <view class="payment-radio">
              <view v-if="selectedPayment === pm.key" class="radio-inner" />
            </view>
            <text class="payment-label">{{ pm.label }}</text>
          </view>
        </view>
      </view>

      <!-- Summary -->
      <view v-if="selectedPlan" class="summary-card">
        <text class="summary-title">充值信息</text>
        <view class="summary-row">
          <text class="summary-label">充值方案</text>
          <text class="summary-value">
            {{ selectedPlan.name || (planTab === 'amount' ? `充值¥${selectedPlan.payAmount ?? selectedPlan.amount}` : selectedPlan.serviceName) }}
          </text>
        </view>
        <view class="summary-row">
          <text class="summary-label">支付金额</text>
          <text class="summary-value summary-value--price">¥{{ selectedPlan.payAmount ?? selectedPlan.amount }}</text>
        </view>
        <view class="summary-row">
          <text class="summary-label">支付方式</text>
          <text class="summary-value">{{ paymentMethods.find(p => p.key === selectedPayment)?.label }}</text>
        </view>
      </view>

      <!-- Submit Button -->
      <view class="submit-area">
        <view
          class="submit-btn"
          :class="{ 'submit-btn--disabled': !selectedPlanId || submitting }"
          @tap="onSubmit"
        >
          <text class="submit-btn-text">{{ submitting ? '处理中...' : '确认充值' }}</text>
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
  padding-bottom: 48rpx;
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

/* Member Info Card */
.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
}
.mc-left {
  display: flex;
  align-items: center;
}
.mc-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}
.mc-avatar-text {
  font-size: 34rpx;
  color: #fff;
  font-weight: 600;
}
.mc-info {
  display: flex;
  flex-direction: column;
}
.mc-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  display: block;
}
.mc-phone {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
  display: block;
}
.mc-balance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.mc-balance-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  display: block;
}
.mc-balance-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 4rpx;
}

/* Plan Type Tabs */
.plan-tabs {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 24rpx;
}
.plan-tab {
  flex: 1;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}
.plan-tab--active {
  background: #4a90d9;
}
.plan-tab-text {
  font-size: 28rpx;
  color: #666;
}
.plan-tab--active .plan-tab-text {
  color: #fff;
  font-weight: 600;
}

/* Plan Cards Grid */
.plan-section {
  margin-bottom: 24rpx;
}
.plan-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}
.plan-card {
  width: calc(50% - 10rpx);
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  border: 2rpx solid transparent;
  box-sizing: border-box;
}
.plan-card--selected {
  border-color: #4a90d9;
  background: #f0f7ff;
}
.plan-pay {
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}
.plan-name {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
  text-align: center;
}
.plan-receive {
  font-size: 24rpx;
  color: #999;
  display: block;
}
.plan-gift-badge {
  background: #fff3e0;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
  margin-bottom: 6rpx;
}
.plan-gift-text {
  font-size: 22rpx;
  color: #ff9500;
  font-weight: 500;
}
.selected-check {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  background: #4a90d9;
  display: flex;
  align-items: center;
  justify-content: center;
}
.check-icon {
  font-size: 22rpx;
  color: #fff;
}

.empty-plans {
  padding: 80rpx 0;
  text-align: center;
}
.empty-text {
  font-size: 26rpx;
  color: #999;
}

/* Payment Method */
.payment-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}
.payment-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.payment-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}
.payment-radio {
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  border: 2rpx solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}
.payment-item--active .payment-radio {
  border-color: #4a90d9;
}
.radio-inner {
  width: 20rpx;
  height: 20rpx;
  border-radius: 10rpx;
  background: #4a90d9;
}
.payment-label {
  font-size: 28rpx;
  color: #333;
}

/* Summary Card */
.summary-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 24rpx;
}
.summary-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}
.summary-label {
  font-size: 26rpx;
  color: #999;
}
.summary-value {
  font-size: 26rpx;
  color: #333;
}
.summary-value--price {
  font-size: 30rpx;
  font-weight: 700;
  color: #ff9500;
}

/* Submit */
.submit-area {
  padding: 16rpx 0 32rpx;
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
