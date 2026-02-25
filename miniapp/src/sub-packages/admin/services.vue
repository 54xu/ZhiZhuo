<script setup lang="ts">
/**
 * 服务项目管理
 * 左侧分类列表 + 右侧服务项目列表
 */
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { serviceCategoryApi, serviceApi } from '@/api/service'

interface Category {
  id: number
  name: string
  sortOrder?: number
}

interface Service {
  id: number
  name: string
  categoryId: number
  duration: number
  price: number
  memberPrice: number
}

const categories = ref<Category[]>([])
const services = ref<Service[]>([])
const activeCategoryId = ref<number | null>(null)
const loading = ref(false)

// ---- 分类弹窗 ----
const showCategoryModal = ref(false)
const categoryForm = ref({ name: '', sortOrder: 0 })
const editingCategoryId = ref<number | null>(null)

// ---- 服务弹窗 ----
const showServiceModal = ref(false)
const serviceForm = ref({ name: '', duration: 60, price: 0, memberPrice: 0 })
const editingServiceId = ref<number | null>(null)

const filteredServices = computed(() => {
  if (!activeCategoryId.value) return services.value
  return services.value.filter(s => s.categoryId === activeCategoryId.value)
})

onShow(() => {
  loadCategories()
  loadServices()
})

async function loadCategories() {
  try {
    const { data } = await serviceCategoryApi.list()
    categories.value = data
    if (data.length > 0 && !activeCategoryId.value) {
      activeCategoryId.value = data[0].id
    }
  } catch {}
}

async function loadServices(categoryId?: number) {
  loading.value = true
  try {
    const { data } = await serviceApi.list(categoryId)
    services.value = data
  } catch {} finally {
    loading.value = false
  }
}

function selectCategory(id: number) {
  activeCategoryId.value = id
}

// ---- 分类操作 ----
function openAddCategory() {
  editingCategoryId.value = null
  categoryForm.value = { name: '', sortOrder: 0 }
  showCategoryModal.value = true
}

function openEditCategory(cat: Category) {
  editingCategoryId.value = cat.id
  categoryForm.value = { name: cat.name, sortOrder: cat.sortOrder || 0 }
  showCategoryModal.value = true
}

async function saveCategory() {
  if (!categoryForm.value.name.trim()) {
    uni.showToast({ title: '请输入分类名称', icon: 'none' })
    return
  }
  try {
    if (editingCategoryId.value) {
      await serviceCategoryApi.update(editingCategoryId.value, categoryForm.value)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await serviceCategoryApi.create(categoryForm.value)
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showCategoryModal.value = false
    await loadCategories()
  } catch {}
}

function confirmDeleteCategory(cat: Category) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除分类「${cat.name}」？该分类下的服务也将被删除。`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await serviceCategoryApi.remove(cat.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          if (activeCategoryId.value === cat.id) {
            activeCategoryId.value = null
          }
          await loadCategories()
          await loadServices()
        } catch {}
      }
    },
  })
}

// ---- 服务操作 ----
function openAddService() {
  if (!activeCategoryId.value) {
    uni.showToast({ title: '请先选择或创建分类', icon: 'none' })
    return
  }
  editingServiceId.value = null
  serviceForm.value = { name: '', duration: 60, price: 0, memberPrice: 0 }
  showServiceModal.value = true
}

function openEditService(svc: Service) {
  editingServiceId.value = svc.id
  serviceForm.value = {
    name: svc.name,
    duration: svc.duration,
    price: svc.price,
    memberPrice: svc.memberPrice,
  }
  showServiceModal.value = true
}

async function saveService() {
  if (!serviceForm.value.name.trim()) {
    uni.showToast({ title: '请输入服务名称', icon: 'none' })
    return
  }
  if (serviceForm.value.price <= 0) {
    uni.showToast({ title: '请输入有效价格', icon: 'none' })
    return
  }
  try {
    const payload = { ...serviceForm.value, categoryId: activeCategoryId.value }
    if (editingServiceId.value) {
      await serviceApi.update(editingServiceId.value, payload)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await serviceApi.create(payload)
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showServiceModal.value = false
    await loadServices()
  } catch {}
}

function confirmDeleteService(svc: Service) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除服务「${svc.name}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await serviceApi.remove(svc.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          await loadServices()
        } catch {}
      }
    },
  })
}
</script>

<template>
  <view class="page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">服务项目管理</text>
    </view>

    <view class="main-content">
      <!-- 左侧分类 -->
      <scroll-view scroll-y class="category-sidebar">
        <view class="sidebar-header">
          <text class="sidebar-title">分类</text>
          <text class="add-btn" @tap="openAddCategory">+</text>
        </view>
        <view
          v-for="cat in categories"
          :key="cat.id"
          class="category-item"
          :class="{ active: activeCategoryId === cat.id }"
          @tap="selectCategory(cat.id)"
        >
          <text class="category-name">{{ cat.name }}</text>
          <view class="category-actions">
            <text class="action-icon edit" @tap.stop="openEditCategory(cat)">&#9998;</text>
            <text class="action-icon delete" @tap.stop="confirmDeleteCategory(cat)">&#10005;</text>
          </view>
        </view>
        <view v-if="categories.length === 0" class="empty-tip">
          <text>暂无分类</text>
        </view>
      </scroll-view>

      <!-- 右侧服务列表 -->
      <scroll-view scroll-y class="service-list">
        <view class="list-header">
          <text class="list-title">服务项目</text>
          <view class="add-service-btn" @tap="openAddService">
            <text class="add-service-text">+ 添加服务</text>
          </view>
        </view>

        <view v-if="filteredServices.length > 0" class="services">
          <view v-for="svc in filteredServices" :key="svc.id" class="service-card">
            <view class="service-info">
              <text class="service-name">{{ svc.name }}</text>
              <view class="service-meta">
                <text class="meta-item">{{ svc.duration }}分钟</text>
                <text class="meta-divider">|</text>
                <text class="meta-item price">¥{{ svc.price }}</text>
                <text class="meta-divider">|</text>
                <text class="meta-item member-price">会员¥{{ svc.memberPrice }}</text>
              </view>
            </view>
            <view class="service-actions">
              <text class="btn-edit" @tap="openEditService(svc)">编辑</text>
              <text class="btn-delete" @tap="confirmDeleteService(svc)">删除</text>
            </view>
          </view>
        </view>
        <view v-else class="empty-tip">
          <text>{{ loading ? '加载中...' : '暂无服务项目' }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 分类弹窗 -->
    <view v-if="showCategoryModal" class="modal-mask" @tap="showCategoryModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingCategoryId ? '编辑分类' : '添加分类' }}</text>
        <view class="form-group">
          <text class="form-label">分类名称</text>
          <input v-model="categoryForm.name" class="form-input" placeholder="请输入分类名称" />
        </view>
        <view class="form-group">
          <text class="form-label">排序</text>
          <input v-model.number="categoryForm.sortOrder" class="form-input" type="number" placeholder="数字越小越靠前" />
        </view>
        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showCategoryModal = false">取消</text>
          <text class="modal-btn confirm" @tap="saveCategory">保存</text>
        </view>
      </view>
    </view>

    <!-- 服务弹窗 -->
    <view v-if="showServiceModal" class="modal-mask" @tap="showServiceModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingServiceId ? '编辑服务' : '添加服务' }}</text>
        <view class="form-group">
          <text class="form-label">服务名称</text>
          <input v-model="serviceForm.name" class="form-input" placeholder="请输入服务名称" />
        </view>
        <view class="form-group">
          <text class="form-label">时长(分钟)</text>
          <input v-model.number="serviceForm.duration" class="form-input" type="number" placeholder="请输入服务时长" />
        </view>
        <view class="form-group">
          <text class="form-label">价格(元)</text>
          <input v-model.number="serviceForm.price" class="form-input" type="digit" placeholder="请输入价格" />
        </view>
        <view class="form-group">
          <text class="form-label">会员价(元)</text>
          <input v-model.number="serviceForm.memberPrice" class="form-input" type="digit" placeholder="请输入会员价格" />
        </view>
        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showServiceModal = false">取消</text>
          <text class="modal-btn confirm" @tap="saveService">保存</text>
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

/* 主内容区域 - 左右分栏 */
.main-content {
  flex: 1;
  display: flex;
  padding: 20rpx;
  gap: 20rpx;
  overflow: hidden;
}

/* 左侧分类 */
.category-sidebar {
  width: 240rpx;
  background: #fff;
  border-radius: 12rpx;
  height: calc(100vh - 130rpx);
  flex-shrink: 0;
}
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.sidebar-title {
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
}
.add-btn {
  width: 44rpx;
  height: 44rpx;
  line-height: 42rpx;
  text-align: center;
  background: #4a90d9;
  color: #fff;
  border-radius: 50%;
  font-size: 32rpx;
}
.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 16rpx;
  border-left: 4rpx solid transparent;
  transition: all 0.2s;
}
.category-item.active {
  background: #eef4fd;
  border-left-color: #4a90d9;
}
.category-name {
  font-size: 26rpx;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.category-actions {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
}
.action-icon {
  font-size: 24rpx;
  padding: 4rpx;
}
.action-icon.edit {
  color: #4a90d9;
}
.action-icon.delete {
  color: #ff3b30;
}

/* 右侧服务列表 */
.service-list {
  flex: 1;
  height: calc(100vh - 130rpx);
}
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
  background: #fff;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
}
.list-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}
.add-service-btn {
  padding: 10rpx 24rpx;
  background: #4a90d9;
  border-radius: 24rpx;
}
.add-service-text {
  font-size: 24rpx;
  color: #fff;
}

.services {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.service-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
}
.service-info {
  flex: 1;
}
.service-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}
.service-meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.meta-item {
  font-size: 24rpx;
  color: #999;
}
.meta-divider {
  font-size: 20rpx;
  color: #ddd;
}
.meta-item.price {
  color: #ff9500;
  font-weight: bold;
}
.meta-item.member-price {
  color: #4cd964;
}
.service-actions {
  display: flex;
  gap: 16rpx;
  flex-shrink: 0;
}
.btn-edit {
  font-size: 24rpx;
  color: #4a90d9;
  padding: 8rpx 16rpx;
}
.btn-delete {
  font-size: 24rpx;
  color: #ff3b30;
  padding: 8rpx 16rpx;
}

/* 空状态 */
.empty-tip {
  padding: 60rpx 20rpx;
  text-align: center;
  color: #999;
  font-size: 26rpx;
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
