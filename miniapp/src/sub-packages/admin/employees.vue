<script setup lang="ts">
/**
 * 员工管理
 * 角色筛选标签 + 员工列表 + 添加/编辑弹窗
 */
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { employeeApi } from '@/api/employee'

interface Employee {
  id: number
  name: string
  employeeNo: string
  phone: string
  role: string
  status: string
  wxBound?: boolean
}

const employees = ref<Employee[]>([])
const activeRole = ref('')
const loading = ref(false)

// ---- 弹窗 ----
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  name: '',
  employeeNo: '',
  phone: '',
  role: 'technician',
})

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '收银员', value: 'cashier' },
  { label: '技师', value: 'technician' },
]

const roleTabs = [
  { label: '全部', value: '' },
  { label: '管理员', value: 'admin' },
  { label: '收银员', value: 'cashier' },
  { label: '技师', value: 'technician' },
]

const roleLabel: Record<string, string> = {
  admin: '管理员',
  cashier: '收银员',
  technician: '技师',
}

const roleColor: Record<string, string> = {
  admin: '#ff3b30',
  cashier: '#4a90d9',
  technician: '#4cd964',
}

const filteredEmployees = computed(() => {
  if (!activeRole.value) return employees.value
  return employees.value.filter(e => e.role === activeRole.value)
})

// 角色picker索引
const rolePickerIndex = ref(2)

onShow(() => {
  loadEmployees()
})

async function loadEmployees() {
  loading.value = true
  try {
    const params = activeRole.value ? { role: activeRole.value } : undefined
    const { data } = await employeeApi.list(params)
    employees.value = data
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) } finally {
    loading.value = false
  }
}

function selectRole(role: string) {
  activeRole.value = role
}

function openAddEmployee() {
  editingId.value = null
  form.value = { name: '', employeeNo: '', phone: '', role: 'technician' }
  rolePickerIndex.value = 2
  showModal.value = true
}

function openEditEmployee(emp: Employee) {
  editingId.value = emp.id
  form.value = {
    name: emp.name,
    employeeNo: emp.employeeNo,
    phone: emp.phone,
    role: emp.role,
  }
  rolePickerIndex.value = roleOptions.findIndex(r => r.value === emp.role)
  if (rolePickerIndex.value < 0) rolePickerIndex.value = 0
  showModal.value = true
}

function onRoleChange(e: any) {
  const idx = Number(e.detail.value)
  rolePickerIndex.value = idx
  form.value.role = roleOptions[idx].value
}

async function saveEmployee() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入员工姓名', icon: 'none' })
    return
  }
  if (!form.value.employeeNo.trim()) {
    uni.showToast({ title: '请输入工号', icon: 'none' })
    return
  }
  if (!form.value.phone.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  try {
    if (editingId.value) {
      await employeeApi.update(editingId.value, form.value)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await employeeApi.create(form.value)
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showModal.value = false
    await loadEmployees()
  } catch { uni.showToast({ title: '保存失败', icon: 'none' }) }
}

function confirmDeleteEmployee(emp: Employee) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除员工「${emp.name}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await employeeApi.remove(emp.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          await loadEmployees()
        } catch { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    },
  })
}

function confirmUnbindWx(emp: Employee) {
  uni.showModal({
    title: '解绑微信',
    content: `确定解绑「${emp.name}」的微信？解绑后该员工需要重新扫码绑定。`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await employeeApi.unbindWx(emp.id)
          uni.showToast({ title: '解绑成功', icon: 'success' })
          await loadEmployees()
        } catch { uni.showToast({ title: '解绑失败', icon: 'none' }) }
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">员工管理</text>
    </view>

    <!-- 角色筛选 -->
    <view class="filter-bar">
      <scroll-view scroll-x class="filter-scroll">
        <view class="filter-tabs">
          <view
            v-for="tab in roleTabs"
            :key="tab.value"
            class="filter-tab"
            :class="{ active: activeRole === tab.value }"
            @tap="selectRole(tab.value)"
          >
            <text class="filter-tab-text">{{ tab.label }}</text>
          </view>
        </view>
      </scroll-view>
      <view class="add-emp-btn" @tap="openAddEmployee">
        <text class="add-emp-text">+ 添加</text>
      </view>
    </view>

    <!-- 员工列表 -->
    <scroll-view scroll-y class="employee-area">
      <view v-if="filteredEmployees.length > 0" class="employee-list">
        <view v-for="emp in filteredEmployees" :key="emp.id" class="employee-card">
          <view class="emp-main">
            <view class="emp-info">
              <view class="emp-name-row">
                <text class="emp-name">{{ emp.name }}</text>
                <text class="role-badge" :style="{ background: roleColor[emp.role] || '#999' }">
                  {{ roleLabel[emp.role] || emp.role }}
                </text>
                <text v-if="emp.status === 'inactive'" class="status-badge inactive">停用</text>
              </view>
              <view class="emp-detail-row">
                <text class="emp-detail">工号: {{ emp.employeeNo }}</text>
                <text class="emp-detail">手机: {{ emp.phone }}</text>
              </view>
            </view>
          </view>
          <view class="emp-actions">
            <text class="action-btn edit" @tap="openEditEmployee(emp)">编辑</text>
            <text
              v-if="emp.wxBound"
              class="action-btn unbind"
              @tap="confirmUnbindWx(emp)"
            >解绑微信</text>
            <text class="action-btn delete" @tap="confirmDeleteEmployee(emp)">删除</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-tip">
        <text>{{ loading ? '加载中...' : '暂无员工数据' }}</text>
      </view>
    </scroll-view>

    <!-- 弹窗 -->
    <view v-if="showModal" class="modal-mask" @tap="showModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingId ? '编辑员工' : '添加员工' }}</text>
        <view class="form-group">
          <text class="form-label">姓名</text>
          <input v-model="form.name" class="form-input" placeholder="请输入员工姓名" />
        </view>
        <view class="form-group">
          <text class="form-label">工号</text>
          <input v-model="form.employeeNo" class="form-input" placeholder="请输入员工工号" />
        </view>
        <view class="form-group">
          <text class="form-label">手机号</text>
          <input v-model="form.phone" class="form-input" type="number" placeholder="请输入手机号" />
        </view>
        <view class="form-group">
          <text class="form-label">角色</text>
          <picker :value="rolePickerIndex" :range="roleOptions" range-key="label" @change="onRoleChange">
            <view class="picker-display">
              <text class="picker-text">{{ roleOptions[rolePickerIndex]?.label || '请选择' }}</text>
              <text class="picker-arrow">&#9662;</text>
            </view>
          </picker>
        </view>
        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showModal = false">取消</text>
          <text class="modal-btn confirm" @tap="saveEmployee">保存</text>
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

/* 筛选栏 */
.filter-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 20rpx;
  gap: 16rpx;
  margin-top: 2rpx;
}
.filter-scroll {
  flex: 1;
  white-space: nowrap;
}
.filter-tabs {
  display: flex;
  gap: 16rpx;
}
.filter-tab {
  display: inline-flex;
  padding: 10rpx 28rpx;
  border-radius: 24rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}
.filter-tab.active {
  background: #4a90d9;
}
.filter-tab-text {
  font-size: 26rpx;
  color: #666;
}
.filter-tab.active .filter-tab-text {
  color: #fff;
}
.add-emp-btn {
  padding: 10rpx 24rpx;
  background: #4a90d9;
  border-radius: 24rpx;
  flex-shrink: 0;
}
.add-emp-text {
  font-size: 26rpx;
  color: #fff;
}

/* 员工列表 */
.employee-area {
  flex: 1;
  padding: 20rpx;
}
.employee-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.employee-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
}
.emp-main {
  display: flex;
  align-items: center;
}
.emp-info {
  flex: 1;
}
.emp-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.emp-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}
.role-badge {
  font-size: 20rpx;
  color: #fff;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}
.status-badge {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}
.status-badge.inactive {
  background: #f0f0f0;
  color: #999;
}
.emp-detail-row {
  display: flex;
  gap: 24rpx;
}
.emp-detail {
  font-size: 24rpx;
  color: #999;
}
.emp-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
  justify-content: flex-end;
}
.action-btn {
  font-size: 24rpx;
  padding: 6rpx 20rpx;
  border-radius: 16rpx;
}
.action-btn.edit {
  color: #4a90d9;
  background: #eef4fd;
}
.action-btn.unbind {
  color: #ff9500;
  background: #fff5e6;
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
