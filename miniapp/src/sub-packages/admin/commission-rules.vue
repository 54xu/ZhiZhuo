<script setup lang="ts">
/**
 * 提成规则配置
 * 管理服务项目的技师提成规则
 */
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { commissionRuleApi } from '@/api/admin'
import { serviceApi } from '@/api/service'
import { employeeApi } from '@/api/employee'

interface CommissionRule {
  id: number
  serviceId: number
  serviceName?: string
  technicianId?: number
  technicianName?: string
  type: string
  value: number
}

interface Service {
  id: number
  name: string
}

interface Technician {
  id: number
  name: string
}

const rules = ref<CommissionRule[]>([])
const services = ref<Service[]>([])
const technicians = ref<Technician[]>([])
const loading = ref(false)

// ---- 弹窗 ----
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  serviceId: 0,
  technicianId: 0,
  type: 'fixed',
  value: 0,
})

const servicePickerIndex = ref(0)
const technicianPickerIndex = ref(0)
const typeIndex = ref(0)

const typeOptions = [
  { label: '固定金额', value: 'fixed' },
  { label: '比例', value: 'percentage' },
]

// 技师选项中包含"通用"选项
const technicianOptions = ref<{ id: number; name: string }[]>([])

onShow(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [rulesRes, servicesRes, techRes] = await Promise.all([
      commissionRuleApi.list(),
      serviceApi.list(),
      employeeApi.technicians(),
    ])
    rules.value = rulesRes.data
    services.value = servicesRes.data
    technicians.value = techRes.data
    technicianOptions.value = [{ id: 0, name: '通用(所有技师)' }, ...techRes.data]
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) } finally {
    loading.value = false
  }
}

function openAddRule() {
  if (services.value.length === 0) {
    uni.showToast({ title: '请先添加服务项目', icon: 'none' })
    return
  }
  editingId.value = null
  form.value = {
    serviceId: services.value[0]?.id || 0,
    technicianId: 0,
    type: 'fixed',
    value: 0,
  }
  servicePickerIndex.value = 0
  technicianPickerIndex.value = 0
  typeIndex.value = 0
  showModal.value = true
}

function openEditRule(rule: CommissionRule) {
  editingId.value = rule.id
  form.value = {
    serviceId: rule.serviceId,
    technicianId: rule.technicianId || 0,
    type: rule.type,
    value: rule.value,
  }
  const svcIdx = services.value.findIndex(s => s.id === rule.serviceId)
  servicePickerIndex.value = svcIdx >= 0 ? svcIdx : 0
  const techIdx = technicianOptions.value.findIndex(t => t.id === (rule.technicianId || 0))
  technicianPickerIndex.value = techIdx >= 0 ? techIdx : 0
  typeIndex.value = typeOptions.findIndex(t => t.value === rule.type)
  if (typeIndex.value < 0) typeIndex.value = 0
  showModal.value = true
}

function onServiceChange(e: any) {
  const idx = Number(e.detail.value)
  servicePickerIndex.value = idx
  form.value.serviceId = services.value[idx]?.id || 0
}

function onTechnicianChange(e: any) {
  const idx = Number(e.detail.value)
  technicianPickerIndex.value = idx
  form.value.technicianId = technicianOptions.value[idx]?.id || 0
}

function onTypeChange(e: any) {
  const idx = Number(e.detail.value)
  typeIndex.value = idx
  form.value.type = typeOptions[idx].value
}

async function saveRule() {
  if (!form.value.serviceId) {
    uni.showToast({ title: '请选择服务项目', icon: 'none' })
    return
  }
  if (form.value.value <= 0) {
    uni.showToast({ title: '请输入有效的提成值', icon: 'none' })
    return
  }
  if (form.value.type === 'percentage' && form.value.value > 100) {
    uni.showToast({ title: '比例不能超过100%', icon: 'none' })
    return
  }

  try {
    const payload: Record<string, any> = {
      serviceId: form.value.serviceId,
      type: form.value.type,
      value: form.value.value,
    }
    if (form.value.technicianId) {
      payload.technicianId = form.value.technicianId
    }

    if (editingId.value) {
      await commissionRuleApi.update(editingId.value, payload)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await commissionRuleApi.create(payload)
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showModal.value = false
    await loadData()
  } catch { uni.showToast({ title: '保存失败', icon: 'none' }) }
}

function confirmDeleteRule(rule: CommissionRule) {
  const svcName = rule.serviceName || '服务项目'
  const techName = rule.technicianName || '通用'
  uni.showModal({
    title: '确认删除',
    content: `确定删除「${svcName} - ${techName}」的提成规则？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await commissionRuleApi.remove(rule.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          await loadData()
        } catch { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    },
  })
}

function formatValue(rule: CommissionRule) {
  if (rule.type === 'percentage') {
    return `${rule.value}%`
  }
  return `¥${rule.value}`
}
</script>

<template>
  <view class="page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">提成规则</text>
    </view>

    <!-- 操作栏 -->
    <view class="action-bar">
      <view class="add-rule-btn" @tap="openAddRule">
        <text class="add-rule-text">+ 添加规则</text>
      </view>
      <text class="action-bar-hint">为服务项目配置技师提成计算方式</text>
    </view>

    <!-- 规则列表 -->
    <scroll-view scroll-y class="rule-area">
      <view v-if="rules.length > 0" class="rule-list">
        <view v-for="rule in rules" :key="rule.id" class="rule-card">
          <view class="rule-info">
            <view class="rule-header">
              <text class="rule-service">{{ rule.serviceName || '服务项目' }}</text>
              <text class="rule-type-tag" :class="rule.type">
                {{ rule.type === 'fixed' ? '固定金额' : '比例' }}
              </text>
            </view>
            <view class="rule-detail">
              <text class="rule-technician">
                技师: {{ rule.technicianName || '通用' }}
              </text>
              <text class="rule-value">提成: {{ formatValue(rule) }}</text>
            </view>
          </view>
          <view class="rule-actions">
            <text class="action-btn edit" @tap="openEditRule(rule)">编辑</text>
            <text class="action-btn delete" @tap="confirmDeleteRule(rule)">删除</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-tip">
        <text>{{ loading ? '加载中...' : '暂无提成规则' }}</text>
        <text v-if="!loading" class="empty-sub">点击上方按钮添加提成规则</text>
      </view>
    </scroll-view>

    <!-- 弹窗 -->
    <view v-if="showModal" class="modal-mask" @tap="showModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingId ? '编辑规则' : '添加规则' }}</text>

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
          <text class="form-label">指定技师 (不选则为通用规则)</text>
          <picker :value="technicianPickerIndex" :range="technicianOptions" range-key="name" @change="onTechnicianChange">
            <view class="picker-display">
              <text class="picker-text">{{ technicianOptions[technicianPickerIndex]?.name || '通用' }}</text>
              <text class="picker-arrow">&#9662;</text>
            </view>
          </picker>
        </view>

        <view class="form-group">
          <text class="form-label">提成类型</text>
          <picker :value="typeIndex" :range="typeOptions" range-key="label" @change="onTypeChange">
            <view class="picker-display">
              <text class="picker-text">{{ typeOptions[typeIndex]?.label || '请选择' }}</text>
              <text class="picker-arrow">&#9662;</text>
            </view>
          </picker>
        </view>

        <view class="form-group">
          <text class="form-label">
            {{ form.type === 'fixed' ? '提成金额(元)' : '提成比例(%)' }}
          </text>
          <input v-model.number="form.value" class="form-input" type="digit"
            :placeholder="form.type === 'fixed' ? '请输入金额' : '请输入比例(1-100)'" />
        </view>

        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showModal = false">取消</text>
          <text class="modal-btn confirm" @tap="saveRule">保存</text>
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

/* 操作栏 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
}
.add-rule-btn {
  display: inline-flex;
  padding: 12rpx 28rpx;
  background: #4a90d9;
  border-radius: 24rpx;
  flex-shrink: 0;
}
.add-rule-text {
  font-size: 26rpx;
  color: #fff;
}
.action-bar-hint {
  font-size: 22rpx;
  color: #bbb;
}

/* 规则列表 */
.rule-area {
  flex: 1;
  padding: 0 20rpx 20rpx;
}
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.rule-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rule-info {
  flex: 1;
}
.rule-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.rule-service {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}
.rule-type-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}
.rule-type-tag.fixed {
  background: #eef4fd;
  color: #4a90d9;
}
.rule-type-tag.percentage {
  background: #e8f8e8;
  color: #4cd964;
}
.rule-detail {
  display: flex;
  gap: 24rpx;
}
.rule-technician {
  font-size: 24rpx;
  color: #999;
}
.rule-value {
  font-size: 24rpx;
  color: #ff9500;
  font-weight: bold;
}

.rule-actions {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}
.empty-sub {
  font-size: 24rpx;
  color: #ccc;
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
  width: 620rpx;
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
