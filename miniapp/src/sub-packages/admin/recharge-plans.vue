<script setup lang="ts">
/**
 * 充值方案管理
 * 金额充值方案 / 次卡充值方案 两种类型
 */
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { rechargePlanApi } from '@/api/admin'
import { serviceApi } from '@/api/service'

interface RechargePlan {
  id: number
  planType: string
  payAmount?: number
  giftAmount?: number
  totalAmount?: number
  serviceId?: number
  serviceName?: string
  buyCount?: number
  giftCount?: number
  totalCount?: number
}

interface Service {
  id: number
  name: string
}

const plans = ref<RechargePlan[]>([])
const services = ref<Service[]>([])
const activePlanType = ref('amount')
const loading = ref(false)

// ---- 弹窗 ----
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  planType: 'amount',
  payAmount: 0,
  giftAmount: 0,
  serviceId: 0,
  buyCount: 0,
  giftCount: 0,
})

const servicePickerIndex = ref(0)

const filteredPlans = computed(() => {
  return plans.value.filter(p => p.planType === activePlanType.value)
})

const planTypeTabs = [
  { label: '金额充值方案', value: 'amount' },
  { label: '次卡充值方案', value: 'visit_card' },
]

onShow(() => {
  loadPlans()
  loadServices()
})

async function loadPlans() {
  loading.value = true
  try {
    const { data } = await rechargePlanApi.list()
    plans.value = data
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) } finally {
    loading.value = false
  }
}

async function loadServices() {
  try {
    const { data } = await serviceApi.list()
    services.value = data
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

function switchPlanType(type: string) {
  activePlanType.value = type
}

function openAddPlan() {
  editingId.value = null
  form.value = {
    planType: activePlanType.value,
    payAmount: 0,
    giftAmount: 0,
    serviceId: services.value.length > 0 ? services.value[0].id : 0,
    buyCount: 0,
    giftCount: 0,
  }
  servicePickerIndex.value = 0
  showModal.value = true
}

function openEditPlan(plan: RechargePlan) {
  editingId.value = plan.id
  form.value = {
    planType: plan.planType,
    payAmount: plan.payAmount || 0,
    giftAmount: plan.giftAmount || 0,
    serviceId: plan.serviceId || (services.value.length > 0 ? services.value[0].id : 0),
    buyCount: plan.buyCount || 0,
    giftCount: plan.giftCount || 0,
  }
  const svcIdx = services.value.findIndex(s => s.id === plan.serviceId)
  servicePickerIndex.value = svcIdx >= 0 ? svcIdx : 0
  showModal.value = true
}

function onServiceChange(e: any) {
  const idx = Number(e.detail.value)
  servicePickerIndex.value = idx
  form.value.serviceId = services.value[idx]?.id || 0
}

async function savePlan() {
  if (form.value.planType === 'amount') {
    if (form.value.payAmount <= 0) {
      uni.showToast({ title: '请输入充值金额', icon: 'none' })
      return
    }
  } else {
    if (!form.value.serviceId) {
      uni.showToast({ title: '请选择服务项目', icon: 'none' })
      return
    }
    if (form.value.buyCount <= 0) {
      uni.showToast({ title: '请输入购买次数', icon: 'none' })
      return
    }
  }

  try {
    const payload: Record<string, any> = { planType: form.value.planType }
    if (form.value.planType === 'amount') {
      payload.payAmount = form.value.payAmount
      payload.giftAmount = form.value.giftAmount
    } else {
      payload.serviceId = form.value.serviceId
      payload.buyCount = form.value.buyCount
      payload.giftCount = form.value.giftCount
    }

    if (editingId.value) {
      await rechargePlanApi.update(editingId.value, payload)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await rechargePlanApi.create(payload)
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showModal.value = false
    await loadPlans()
  } catch { uni.showToast({ title: '保存失败', icon: 'none' }) }
}

function confirmDeletePlan(plan: RechargePlan) {
  const desc = plan.planType === 'amount'
    ? `充值${plan.payAmount}元方案`
    : `${plan.serviceName || '服务'}${plan.buyCount}次方案`
  uni.showModal({
    title: '确认删除',
    content: `确定删除「${desc}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await rechargePlanApi.remove(plan.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          await loadPlans()
        } catch { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">充值方案</text>
    </view>

    <!-- 类型切换 -->
    <view class="type-tabs">
      <view
        v-for="tab in planTypeTabs"
        :key="tab.value"
        class="type-tab"
        :class="{ active: activePlanType === tab.value }"
        @tap="switchPlanType(tab.value)"
      >
        <text class="type-tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <!-- 方案列表 -->
    <scroll-view scroll-y class="plan-area">
      <view class="plan-actions-bar">
        <view class="add-plan-btn" @tap="openAddPlan">
          <text class="add-plan-text">+ 添加方案</text>
        </view>
      </view>

      <view v-if="filteredPlans.length > 0" class="plan-list">
        <!-- 金额充值方案 -->
        <template v-if="activePlanType === 'amount'">
          <view v-for="plan in filteredPlans" :key="plan.id" class="plan-card amount-card">
            <view class="plan-info">
              <view class="amount-row">
                <text class="pay-amount">充¥{{ plan.payAmount }}</text>
                <text class="arrow-icon">&#10132;</text>
                <text class="total-amount">得¥{{ plan.totalAmount || ((plan.payAmount || 0) + (plan.giftAmount || 0)) }}</text>
              </view>
              <view v-if="plan.giftAmount && plan.giftAmount > 0" class="gift-tag">
                <text class="gift-text">赠送¥{{ plan.giftAmount }}</text>
              </view>
            </view>
            <view class="plan-actions">
              <text class="action-btn edit" @tap="openEditPlan(plan)">编辑</text>
              <text class="action-btn delete" @tap="confirmDeletePlan(plan)">删除</text>
            </view>
          </view>
        </template>

        <!-- 次卡充值方案 -->
        <template v-else>
          <view v-for="plan in filteredPlans" :key="plan.id" class="plan-card visit-card">
            <view class="plan-info">
              <text class="plan-service-name">{{ plan.serviceName || '服务项目' }}</text>
              <view class="count-row">
                <text class="buy-count">买{{ plan.buyCount }}次</text>
                <text class="arrow-icon">&#10132;</text>
                <text class="total-count">得{{ plan.totalCount || ((plan.buyCount || 0) + (plan.giftCount || 0)) }}次</text>
              </view>
              <view v-if="plan.giftCount && plan.giftCount > 0" class="gift-tag">
                <text class="gift-text">赠送{{ plan.giftCount }}次</text>
              </view>
            </view>
            <view class="plan-actions">
              <text class="action-btn edit" @tap="openEditPlan(plan)">编辑</text>
              <text class="action-btn delete" @tap="confirmDeletePlan(plan)">删除</text>
            </view>
          </view>
        </template>
      </view>
      <view v-else class="empty-tip">
        <text>{{ loading ? '加载中...' : '暂无方案' }}</text>
      </view>
    </scroll-view>

    <!-- 弹窗 -->
    <view v-if="showModal" class="modal-mask" @tap="showModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingId ? '编辑方案' : '添加方案' }}</text>

        <!-- 金额方案表单 -->
        <template v-if="form.planType === 'amount'">
          <view class="form-group">
            <text class="form-label">充值金额(元)</text>
            <input v-model.number="form.payAmount" class="form-input" type="digit" placeholder="请输入充值金额" />
          </view>
          <view class="form-group">
            <text class="form-label">赠送金额(元)</text>
            <input v-model.number="form.giftAmount" class="form-input" type="digit" placeholder="请输入赠送金额" />
          </view>
          <view class="form-preview">
            <text class="preview-text">
              充值¥{{ form.payAmount || 0 }}，到账¥{{ (form.payAmount || 0) + (form.giftAmount || 0) }}
            </text>
          </view>
        </template>

        <!-- 次卡方案表单 -->
        <template v-else>
          <view class="form-group">
            <text class="form-label">服务项目</text>
            <picker :value="servicePickerIndex" :range="services" range-key="name" @change="onServiceChange">
              <view class="picker-display">
                <text class="picker-text">{{ services[servicePickerIndex]?.name || '请选择服务' }}</text>
                <text class="picker-arrow">&#9662;</text>
              </view>
            </picker>
          </view>
          <view class="form-group">
            <text class="form-label">购买次数</text>
            <input v-model.number="form.buyCount" class="form-input" type="number" placeholder="请输入购买次数" />
          </view>
          <view class="form-group">
            <text class="form-label">赠送次数</text>
            <input v-model.number="form.giftCount" class="form-input" type="number" placeholder="请输入赠送次数" />
          </view>
          <view class="form-preview">
            <text class="preview-text">
              买{{ form.buyCount || 0 }}次，共得{{ (form.buyCount || 0) + (form.giftCount || 0) }}次
            </text>
          </view>
        </template>

        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showModal = false">取消</text>
          <text class="modal-btn confirm" @tap="savePlan">保存</text>
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
.page-header {
  padding: 24rpx 32rpx;
  background-color: #fff;
}
.page-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

/* 类型切换 */
.type-tabs {
  display: flex;
  background: #fff;
  margin-top: 2rpx;
}
.type-tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  position: relative;
}
.type-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 4rpx;
  background: #4a90d9;
  border-radius: 2rpx;
}
.type-tab-text {
  font-size: 28rpx;
  color: #666;
}
.type-tab.active .type-tab-text {
  color: #4a90d9;
  font-weight: bold;
}

/* 方案列表 */
.plan-area {
  flex: 1;
  padding: 20rpx;
}
.plan-actions-bar {
  margin-bottom: 20rpx;
}
.add-plan-btn {
  display: inline-flex;
  padding: 12rpx 28rpx;
  background: #4a90d9;
  border-radius: 24rpx;
}
.add-plan-text {
  font-size: 26rpx;
  color: #fff;
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.plan-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.plan-info {
  flex: 1;
}

/* 金额方案 */
.amount-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.pay-amount {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}
.arrow-icon {
  font-size: 28rpx;
  color: #999;
}
.total-amount {
  font-size: 30rpx;
  font-weight: bold;
  color: #ff9500;
}
.gift-tag {
  display: inline-flex;
  padding: 4rpx 12rpx;
  background: #fff5e6;
  border-radius: 8rpx;
}
.gift-text {
  font-size: 22rpx;
  color: #ff9500;
}

/* 次卡方案 */
.plan-service-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}
.count-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.buy-count {
  font-size: 28rpx;
  color: #333;
}
.total-count {
  font-size: 28rpx;
  font-weight: bold;
  color: #4cd964;
}

.plan-actions {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}
.action-btn {
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 16rpx;
}
.action-btn.edit {
  color: #4a90d9;
  background: #eef4fd;
}
.action-btn.delete {
  color: #ff3b30;
  background: #ffebea;
}

/* 空状态 */
.empty-tip {
  padding: 100rpx 20rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-content {
  width: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
}
.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  text-align: center;
  margin-bottom: 32rpx;
}
.form-group {
  margin-bottom: 24rpx;
}
.form-label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}
.form-input {
  height: 72rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}
.picker-display {
  height: 72rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.picker-text {
  font-size: 28rpx;
  color: #333;
}
.picker-arrow {
  font-size: 24rpx;
  color: #999;
}
.form-preview {
  padding: 16rpx 20rpx;
  background: #f5f6fa;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}
.preview-text {
  font-size: 26rpx;
  color: #4a90d9;
}
.modal-footer {
  display: flex;
  gap: 24rpx;
  margin-top: 32rpx;
}
.modal-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 36rpx;
  font-size: 28rpx;
}
.modal-btn.cancel {
  background: #f5f5f5;
  color: #666;
}
.modal-btn.confirm {
  background: #4a90d9;
  color: #fff;
}
</style>
