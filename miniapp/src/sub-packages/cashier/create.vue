<script setup lang="ts">
/**
 * 开单页
 * 新建服务订单：选择客户、服务项目、分配技师
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useOrderStore } from '@/store/modules/order'
import { serviceCategoryApi, serviceApi } from '@/api/service'
import { scheduleApi } from '@/api/schedule'
import { memberApi } from '@/api/member'

const orderStore = useOrderStore()

// --- URL params ---
const roomId = ref(0)
const roomName = ref('')

// --- Member search ---
const phoneKeyword = ref('')
const memberInfo = ref<any>(null)
const memberSearching = ref(false)
const memberMode = ref<'guest' | 'member'>('guest') // 散客 or 会员

// --- Categories & services ---
const categories = ref<any[]>([])
const activeCategoryId = ref<number | null>(null)
const services = ref<any[]>([])
const loadingServices = ref(false)

// --- Cart (selected items) ---
interface CartItem {
  serviceId: number
  serviceName: string
  duration: number
  price: number
  technicianId: number
  technicianName: string
}
const cartItems = ref<CartItem[]>([])

// --- Technician popup ---
const showTechPopup = ref(false)
const technicianList = ref<any[]>([])
const loadingTechs = ref(false)
const pendingServiceForTech = ref<any>(null)

// --- Submit ---
const submitting = ref(false)

// --- Computed ---
const totalAmount = computed(() => {
  return cartItems.value.reduce((sum, item) => sum + item.price, 0)
})

// --- Lifecycle ---
onLoad((options: any) => {
  roomId.value = Number(options.roomId) || 0
  roomName.value = decodeURIComponent(options.roomName || '')
  loadCategories()
})

// --- Member search ---
let searchTimer: any = null
function onPhoneInput() {
  clearTimeout(searchTimer)
  if (!phoneKeyword.value || phoneKeyword.value.length < 3) {
    memberInfo.value = null
    memberMode.value = 'guest'
    return
  }
  searchTimer = setTimeout(() => {
    searchMember()
  }, 500)
}

async function searchMember() {
  if (!phoneKeyword.value) return
  memberSearching.value = true
  try {
    const { data } = await memberApi.search(phoneKeyword.value)
    const list = data?.list || data || []
    if (list.length > 0) {
      memberInfo.value = list[0]
      memberMode.value = 'member'
    } else {
      memberInfo.value = null
      memberMode.value = 'guest'
    }
  } catch {
    memberInfo.value = null
    memberMode.value = 'guest'
  } finally {
    memberSearching.value = false
  }
}

function clearMember() {
  phoneKeyword.value = ''
  memberInfo.value = null
  memberMode.value = 'guest'
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

// --- Add service to cart (opens technician popup) ---
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
  cartItems.value.push({
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

// --- Remove cart item ---
function removeCartItem(index: number) {
  cartItems.value.splice(index, 1)
}

// --- Submit order ---
async function onSubmit() {
  if (cartItems.value.length === 0) {
    uni.showToast({ title: '请至少选择一项服务', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const items = cartItems.value.map((item) => ({
      serviceId: item.serviceId,
      technicianId: item.technicianId,
    }))
    const payload: any = {
      roomId: roomId.value,
      items,
    }
    if (memberMode.value === 'member' && memberInfo.value) {
      payload.memberId = memberInfo.value.id
    } else {
      if (phoneKeyword.value) {
        payload.customerPhone = phoneKeyword.value
      }
    }
    const order = await orderStore.createOrder(payload)
    uni.showToast({ title: '开单成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({
        url: `/sub-packages/cashier/detail?orderId=${order.id}`,
      })
    }, 1000)
  } catch (e: any) {
    uni.showToast({ title: e.message || '开单失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <!-- Top bar: room name -->
    <view class="top-bar">
      <view class="room-badge">
        <text class="room-icon">&#xe68e;</text>
        <text class="room-name">{{ roomName || '未知房间' }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="page-scroll" :style="{ height: 'calc(100vh - 220rpx)' }">
      <!-- Member identification -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">客户信息</text>
          <text v-if="memberInfo" class="clear-btn" @tap="clearMember">清除</text>
        </view>
        <view class="member-search">
          <input
            class="search-input"
            type="number"
            v-model="phoneKeyword"
            placeholder="输入手机号搜索会员"
            @input="onPhoneInput"
          />
          <view v-if="memberSearching" class="searching-hint">
            <text class="hint-text">搜索中...</text>
          </view>
        </view>
        <view v-if="memberInfo" class="member-card">
          <view class="member-row">
            <text class="member-label">会员</text>
            <text class="member-name">{{ memberInfo.name || memberInfo.phone }}</text>
          </view>
          <view class="member-row">
            <text class="member-phone">{{ memberInfo.phone }}</text>
            <text v-if="memberInfo.balance !== undefined" class="member-balance">
              余额: {{ memberInfo.balance.toFixed(2) }}
            </text>
          </view>
        </view>
        <view v-else class="guest-tag">
          <text class="guest-text">散客模式</text>
        </view>
      </view>

      <!-- Service selection: categories tabs + services grid -->
      <view class="section">
        <text class="section-title">选择服务</text>
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

      <!-- Selected items -->
      <view class="section" v-if="cartItems.length > 0">
        <text class="section-title">已选服务 ({{ cartItems.length }})</text>
        <view class="cart-list">
          <view v-for="(item, idx) in cartItems" :key="idx" class="cart-item">
            <view class="cart-info">
              <text class="cart-svc-name">{{ item.serviceName }}</text>
              <view class="cart-detail-row">
                <text class="cart-tech">{{ item.technicianName || '待分配' }}</text>
                <text class="cart-price">&yen;{{ item.price.toFixed(0) }}</text>
              </view>
            </view>
            <view class="cart-remove" @tap="removeCartItem(idx)">
              <text class="remove-icon">&times;</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- Bottom bar -->
    <view class="bottom-bar">
      <view class="total-area">
        <text class="total-label">合计</text>
        <text class="total-amount">&yen;{{ totalAmount.toFixed(2) }}</text>
      </view>
      <view
        :class="['submit-btn', { disabled: cartItems.length === 0 || submitting }]"
        @tap="onSubmit"
      >
        <text class="submit-text">{{ submitting ? '提交中...' : '确认开单' }}</text>
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

/* Top bar */
.top-bar {
  padding: 24rpx 32rpx;
  background-color: #4a90d9;
}
.room-badge {
  display: flex;
  align-items: center;
}
.room-icon {
  font-size: 36rpx;
  color: #fff;
  margin-right: 12rpx;
}
.room-name {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16rpx;
}
.section-header .section-title {
  margin-bottom: 0;
}
.clear-btn {
  font-size: 24rpx;
  color: #ff3b30;
}

/* Member search */
.member-search {
  margin-bottom: 16rpx;
}
.search-input {
  height: 72rpx;
  background-color: #f5f6fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
}
.searching-hint {
  margin-top: 8rpx;
}
.hint-text {
  font-size: 24rpx;
  color: #999;
}

/* Member card */
.member-card {
  background-color: #eef4fb;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}
.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}
.member-row:last-child {
  margin-bottom: 0;
}
.member-label {
  font-size: 22rpx;
  color: #fff;
  background-color: #4a90d9;
  border-radius: 6rpx;
  padding: 2rpx 12rpx;
  margin-right: 12rpx;
}
.member-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  flex: 1;
}
.member-phone {
  font-size: 24rpx;
  color: #666;
}
.member-balance {
  font-size: 24rpx;
  color: #4a90d9;
  font-weight: 500;
}

/* Guest */
.guest-tag {
  padding: 12rpx 0;
}
.guest-text {
  font-size: 26rpx;
  color: #999;
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

/* Cart */
.cart-list {
  margin-top: 4rpx;
}
.cart-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
.cart-item:last-child {
  border-bottom: none;
}
.cart-info {
  flex: 1;
}
.cart-svc-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  display: block;
  margin-bottom: 6rpx;
}
.cart-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cart-tech {
  font-size: 24rpx;
  color: #666;
}
.cart-price {
  font-size: 28rpx;
  color: #4a90d9;
  font-weight: 600;
}
.cart-remove {
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
