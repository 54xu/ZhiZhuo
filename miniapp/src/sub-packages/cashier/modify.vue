<script setup lang="ts">
/**
 * 加单页 (改单)
 * 向已有订单追加服务项目并分配技师
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useOrderStore } from '@/store/modules/order'
import { serviceCategoryApi, serviceApi } from '@/api/service'
import { scheduleApi } from '@/api/schedule'

const orderStore = useOrderStore()

const orderId = ref(0)
const order = ref<any>(null)
const loadingOrder = ref(true)

// --- Categories & services ---
const categories = ref<any[]>([])
const activeCategoryId = ref<number | null>(null)
const services = ref<any[]>([])
const loadingServices = ref(false)

// --- New items ---
interface NewItem {
  serviceId: number
  serviceName: string
  duration: number
  price: number
  technicianId: number
  technicianName: string
}
const newItems = ref<NewItem[]>([])

// --- Technician popup ---
const showTechPopup = ref(false)
const technicianList = ref<any[]>([])
const loadingTechs = ref(false)
const pendingServiceForTech = ref<any>(null)

// --- Submit ---
const submitting = ref(false)

// --- Computed ---
const existingItems = computed(() => order.value?.items || [])
const newTotalAmount = computed(() => {
  return newItems.value.reduce((sum, item) => sum + item.price, 0)
})

// --- Lifecycle ---
onLoad((options: any) => {
  orderId.value = Number(options.orderId) || 0
  if (orderId.value) {
    loadOrder()
    loadCategories()
  }
})

async function loadOrder() {
  loadingOrder.value = true
  try {
    const data = await orderStore.loadOrderDetail(orderId.value)
    order.value = data
  } catch (e: any) {
    uni.showToast({ title: e.message || '加载订单失败', icon: 'none' })
  } finally {
    loadingOrder.value = false
  }
}

// --- Load categories ---
async function loadCategories() {
  try {
    const { data } = await serviceCategoryApi.list()
    categories.value = data || []
    if (categories.value.length > 0) {
      activeCategoryId.value = categories.value[0].id
      loadServiceList(categories.value[0].id)
    }
  } catch {
    uni.showToast({ title: '加载分类失败', icon: 'none' })
  }
}

// --- Load services by category ---
async function loadServiceList(categoryId: number) {
  activeCategoryId.value = categoryId
  loadingServices.value = true
  try {
    const { data } = await serviceApi.list(categoryId)
    services.value = data || []
  } catch {
    services.value = []
    uni.showToast({ title: '加载服务项目失败', icon: 'none' })
  } finally {
    loadingServices.value = false
  }
}

// --- Add service (opens technician popup) ---
async function onSelectService(service: any) {
  pendingServiceForTech.value = service
  showTechPopup.value = true
  loadingTechs.value = true
  try {
    const { data } = await scheduleApi.getRotation(service.id)
    technicianList.value = data || []
  } catch {
    technicianList.value = []
    uni.showToast({ title: '加载技师列表失败', icon: 'none' })
  } finally {
    loadingTechs.value = false
  }
}

// --- Pick technician ---
function onPickTechnician(tech: any) {
  if (!pendingServiceForTech.value) return
  const service = pendingServiceForTech.value
  newItems.value.push({
    serviceId: service.id,
    serviceName: service.name,
    duration: service.duration || 0,
    price: service.price || 0,
    technicianId: tech.id || tech.technicianId,
    technicianName: tech.name || tech.technicianName || '',
  })
  showTechPopup.value = false
  pendingServiceForTech.value = null
}

// --- Remove new item ---
function removeNewItem(index: number) {
  newItems.value.splice(index, 1)
}

// --- Submit ---
async function onSubmit() {
  if (newItems.value.length === 0) {
    uni.showToast({ title: '请至少选择一项新服务', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const items = newItems.value.map((item) => ({
      serviceId: item.serviceId,
      technicianId: item.technicianId,
    }))
    await orderStore.addItems(orderId.value, items)
    uni.showToast({ title: '加单成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1000)
  } catch (e: any) {
    uni.showToast({ title: e.message || '加单失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <scroll-view scroll-y class="page-scroll" :style="{ height: 'calc(100vh - 200rpx)' }">
      <!-- Current order info -->
      <view class="section order-summary">
        <text class="section-title">当前订单</text>
        <view v-if="loadingOrder" class="loading-area">
          <text class="loading-text">加载中...</text>
        </view>
        <template v-else-if="order">
          <view class="order-meta">
            <text class="order-no">{{ order.orderNo || order.id }}</text>
            <text class="order-room">{{ order.roomName || '未知房间' }}</text>
          </view>
          <view class="existing-items">
            <view v-for="(item, idx) in existingItems" :key="idx" class="existing-item">
              <view class="existing-left">
                <text class="existing-name">{{ item.serviceName || item.service?.name }}</text>
                <text class="existing-tech">{{ item.technicianName || item.technician?.name || '未分配' }}</text>
              </view>
              <text class="existing-price">&yen;{{ (item.price || item.amount || 0).toFixed(0) }}</text>
            </view>
          </view>
          <view class="order-total-row">
            <text class="order-total-label">当前合计</text>
            <text class="order-total-value">&yen;{{ (order.totalAmount || 0).toFixed(2) }}</text>
          </view>
        </template>
      </view>

      <!-- Service selection -->
      <view class="section">
        <text class="section-title">选择新服务</text>
        <!-- Category tabs -->
        <scroll-view scroll-x class="category-tabs" :show-scrollbar="false">
          <view
            v-for="cat in categories"
            :key="cat.id"
            :class="['category-tab', { active: activeCategoryId === cat.id }]"
            @tap="loadServiceList(cat.id)"
          >
            <text class="tab-text">{{ cat.name }}</text>
          </view>
        </scroll-view>

        <!-- Services list -->
        <view v-if="loadingServices" class="loading-area">
          <text class="loading-text">加载中...</text>
        </view>
        <view v-else-if="services.length === 0" class="empty-area">
          <text class="empty-text">暂无服务项目</text>
        </view>
        <view v-else class="service-grid">
          <view
            v-for="svc in services"
            :key="svc.id"
            class="service-card"
            @tap="onSelectService(svc)"
          >
            <text class="svc-name">{{ svc.name }}</text>
            <view class="svc-meta">
              <text v-if="svc.duration" class="svc-duration">{{ svc.duration }}分钟</text>
              <text class="svc-price">&yen;{{ (svc.price || 0).toFixed(0) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- New items list -->
      <view class="section" v-if="newItems.length > 0">
        <text class="section-title">新增项目 ({{ newItems.length }})</text>
        <view class="new-items-list">
          <view v-for="(item, idx) in newItems" :key="idx" class="new-item">
            <view class="new-item-info">
              <text class="new-item-name">{{ item.serviceName }}</text>
              <view class="new-item-detail">
                <text class="new-item-tech">{{ item.technicianName || '待分配' }}</text>
                <text class="new-item-price">&yen;{{ item.price.toFixed(0) }}</text>
              </view>
            </view>
            <view class="new-item-remove" @tap="removeNewItem(idx)">
              <text class="remove-icon">&times;</text>
            </view>
          </view>
        </view>
        <view class="new-total-row">
          <text class="new-total-label">新增合计</text>
          <text class="new-total-value">&yen;{{ newTotalAmount.toFixed(2) }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- Bottom bar -->
    <view class="bottom-bar">
      <view class="total-area">
        <text class="total-label">新增</text>
        <text class="total-amount">&yen;{{ newTotalAmount.toFixed(2) }}</text>
      </view>
      <view
        :class="['submit-btn', { disabled: newItems.length === 0 || submitting }]"
        @tap="onSubmit"
      >
        <text class="submit-text">{{ submitting ? '提交中...' : '确认加单' }}</text>
      </view>
    </view>

    <!-- Technician selection popup -->
    <view v-if="showTechPopup" class="popup-mask" @tap.self="showTechPopup = false">
      <view class="popup-content">
        <view class="popup-header">
          <text class="popup-title">选择技师</text>
          <text class="popup-close" @tap="showTechPopup = false">&times;</text>
        </view>
        <view v-if="pendingServiceForTech" class="popup-svc-info">
          <text class="popup-svc-name">{{ pendingServiceForTech.name }}</text>
        </view>
        <scroll-view scroll-y class="tech-list" style="max-height: 600rpx">
          <view v-if="loadingTechs" class="loading-area">
            <text class="loading-text">加载中...</text>
          </view>
          <view v-else-if="technicianList.length === 0" class="empty-area">
            <text class="empty-text">暂无可用技师</text>
          </view>
          <view
            v-for="tech in technicianList"
            :key="tech.id || tech.technicianId"
            class="tech-item"
            @tap="onPickTechnician(tech)"
          >
            <view class="tech-info">
              <text class="tech-name">{{ tech.name || tech.technicianName }}</text>
              <text v-if="tech.status" class="tech-status">{{ tech.status }}</text>
            </view>
            <text v-if="tech.rotationOrder !== undefined" class="tech-order">
              #{{ tech.rotationOrder }}
            </text>
          </view>
        </scroll-view>
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

/* Scroll area */
.page-scroll {
  flex: 1;
  padding: 24rpx 24rpx 0;
}

/* Section */
.section {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}

/* Loading & empty */
.loading-area,
.empty-area {
  padding: 40rpx 0;
  text-align: center;
}
.loading-text,
.empty-text {
  font-size: 26rpx;
  color: #999;
}

/* Current order summary */
.order-summary {
  border-left: 6rpx solid #4a90d9;
}
.order-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.order-no {
  font-size: 24rpx;
  color: #999;
}
.order-room {
  font-size: 26rpx;
  color: #4a90d9;
  font-weight: 500;
}

/* Existing items */
.existing-items {
  margin-bottom: 12rpx;
}
.existing-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10rpx 0;
}
.existing-left {
  flex: 1;
}
.existing-name {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 4rpx;
}
.existing-tech {
  font-size: 22rpx;
  color: #999;
}
.existing-price {
  font-size: 26rpx;
  color: #666;
}
.order-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12rpx;
  border-top: 1rpx solid #f0f0f0;
}
.order-total-label {
  font-size: 26rpx;
  color: #666;
}
.order-total-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

/* Category tabs */
.category-tabs {
  white-space: nowrap;
  margin-bottom: 20rpx;
}
.category-tab {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  border-radius: 32rpx;
  background-color: #f5f6fa;
}
.category-tab.active {
  background-color: #4a90d9;
}
.category-tab .tab-text {
  font-size: 26rpx;
  color: #666;
}
.category-tab.active .tab-text {
  color: #fff;
}

/* Service grid */
.service-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.service-card {
  width: calc(50% - 8rpx);
  background-color: #f5f6fa;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
}
.svc-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.svc-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.svc-duration {
  font-size: 22rpx;
  color: #999;
}
.svc-price {
  font-size: 28rpx;
  color: #4a90d9;
  font-weight: 600;
}

/* New items */
.new-items-list {
  margin-top: 4rpx;
}
.new-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
.new-item:last-child {
  border-bottom: none;
}
.new-item-info {
  flex: 1;
}
.new-item-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  display: block;
  margin-bottom: 6rpx;
}
.new-item-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.new-item-tech {
  font-size: 24rpx;
  color: #666;
}
.new-item-price {
  font-size: 28rpx;
  color: #4a90d9;
  font-weight: 600;
}
.new-item-remove {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12rpx;
}
.remove-icon {
  font-size: 36rpx;
  color: #ff3b30;
  font-weight: 300;
}
.new-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  margin-top: 8rpx;
  border-top: 1rpx solid #f0f0f0;
}
.new-total-label {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}
.new-total-value {
  font-size: 32rpx;
  color: #ff3b30;
  font-weight: 700;
}

/* Bottom bar */
.bottom-bar {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.total-area {
  flex: 1;
  display: flex;
  align-items: baseline;
}
.total-label {
  font-size: 28rpx;
  color: #666;
  margin-right: 8rpx;
}
.total-amount {
  font-size: 38rpx;
  color: #ff3b30;
  font-weight: 700;
}
.submit-btn {
  background-color: #4a90d9;
  border-radius: 44rpx;
  padding: 0 48rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.submit-btn.disabled {
  opacity: 0.5;
}
.submit-text {
  font-size: 30rpx;
  color: #fff;
  font-weight: 600;
}

/* Popup */
.popup-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}
.popup-content {
  width: 100%;
  background-color: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 24rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.popup-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}
.popup-close {
  font-size: 44rpx;
  color: #999;
  line-height: 1;
}
.popup-svc-info {
  margin-bottom: 20rpx;
  padding: 12rpx 16rpx;
  background-color: #f5f6fa;
  border-radius: 8rpx;
}
.popup-svc-name {
  font-size: 26rpx;
  color: #666;
}

/* Technician list */
.tech-list {
  margin-top: 8rpx;
}
.tech-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.tech-item:last-child {
  border-bottom: none;
}
.tech-item:active {
  background-color: #f5f6fa;
}
.tech-info {
  display: flex;
  align-items: center;
  flex: 1;
}
.tech-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}
.tech-status {
  font-size: 22rpx;
  color: #999;
  margin-left: 12rpx;
}
.tech-order {
  font-size: 24rpx;
  color: #4a90d9;
  font-weight: 500;
}
</style>
