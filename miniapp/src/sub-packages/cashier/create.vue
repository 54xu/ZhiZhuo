<script setup lang="ts">
/**
 * 开单页
 * 选房台 → 识别会员 → 选服务 → 分配技师 → 确认开单
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useOrderStore } from '@/store/modules/order'
import { serviceApi } from '@/api/service'
import { scheduleApi } from '@/api/schedule'
import { memberApi } from '@/api/member'

const orderStore = useOrderStore()

const roomId = ref(0)
const roomName = ref('')
const memberPhone = ref('')
const currentMember = ref<any>(null)
const services = ref<any[]>([])
const selectedItems = ref<Array<{ serviceId: number; serviceName: string; technicianId: number; technicianName: string; price: string }>>([])
const technicians = ref<any[]>([])
const showTechPicker = ref(false)
const pendingServiceIdx = ref(-1)
const submitting = ref(false)

onLoad((options: any) => {
  roomId.value = Number(options?.roomId || 0)
  roomName.value = options?.roomName || ''
  loadServices()
  loadTechnicians()
})

async function loadServices() {
  try { const { data } = await serviceApi.list(); services.value = data } catch { uni.showToast({ title: '加载失败', icon: 'none' }) }
}
async function loadTechnicians() {
  try { const { data } = await scheduleApi.getRotation(); technicians.value = data } catch { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

async function searchMember() {
  if (!memberPhone.value.trim()) { currentMember.value = null; return }
  try {
    const { data } = await memberApi.search(memberPhone.value.trim(), 1, 1)
    currentMember.value = data.list?.[0] || null
    if (!currentMember.value) uni.showToast({ title: '未找到该会员', icon: 'none' })
  } catch { uni.showToast({ title: '搜索失败', icon: 'none' }) }
}

function addService(svc: any) {
  const recommended = technicians.value[0]
  selectedItems.value.push({
    serviceId: svc.id,
    serviceName: svc.name,
    technicianId: recommended?.technicianId || 0,
    technicianName: recommended?.name || '未分配',
    price: currentMember.value && svc.memberPrice ? svc.memberPrice : svc.price,
  })
}

function pickTechnician(idx: number) {
  pendingServiceIdx.value = idx
  showTechPicker.value = true
}

function confirmTechnician(tech: any) {
  if (pendingServiceIdx.value >= 0) {
    selectedItems.value[pendingServiceIdx.value].technicianId = tech.technicianId
    selectedItems.value[pendingServiceIdx.value].technicianName = tech.name
  }
  showTechPicker.value = false
}

function removeItem(idx: number) { selectedItems.value.splice(idx, 1) }

async function submitOrder() {
  if (selectedItems.value.length === 0) {
    uni.showToast({ title: '请至少选择一项服务', icon: 'none' }); return
  }
  submitting.value = true
  try {
    const order = await orderStore.createOrder({
      roomId: roomId.value,
      memberId: currentMember.value?.id,
      items: selectedItems.value.map(i => ({ serviceId: i.serviceId, technicianId: i.technicianId })),
    })
    uni.showToast({ title: '开单成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/sub-packages/cashier/detail?orderId=${order.id}` })
    }, 500)
  } catch (e: any) {
    uni.showToast({ title: e.message || '开单失败', icon: 'none' })
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="create-page">
    <view class="section">
      <text class="section-title">房台</text>
      <text class="room-tag">{{ roomName || '未选择' }}</text>
    </view>

    <view class="section">
      <text class="section-title">会员识别</text>
      <view class="member-search">
        <input v-model="memberPhone" class="input" placeholder="输入手机号识别会员" type="number" @confirm="searchMember" />
        <text class="search-btn" @tap="searchMember">查询</text>
      </view>
      <view v-if="currentMember" class="member-info">
        <text>{{ currentMember.name || '会员' }} · 余额 ¥{{ currentMember.balance }}</text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">选择服务</text>
      <view class="service-grid">
        <view v-for="svc in services" :key="svc.id" class="service-item" @tap="addService(svc)">
          <text class="svc-name">{{ svc.name }}</text>
          <text class="svc-price">¥{{ currentMember && svc.memberPrice ? svc.memberPrice : svc.price }}</text>
          <text class="svc-duration">{{ svc.duration }}分钟</text>
        </view>
      </view>
    </view>

    <view v-if="selectedItems.length > 0" class="section">
      <text class="section-title">已选服务</text>
      <view v-for="(item, idx) in selectedItems" :key="idx" class="selected-item">
        <view class="item-info">
          <text class="item-name">{{ item.serviceName }}</text>
          <text class="item-tech" @tap="pickTechnician(idx)">技师: {{ item.technicianName }} ›</text>
        </view>
        <text class="item-price">¥{{ item.price }}</text>
        <text class="item-remove" @tap="removeItem(idx)">×</text>
      </view>
    </view>

    <view class="bottom-bar">
      <view class="total">
        <text>共 {{ selectedItems.length }} 项</text>
      </view>
      <button class="submit-btn" :loading="submitting" @tap="submitOrder">确认开单</button>
    </view>

    <!-- 技师选择弹窗 -->
    <view v-if="showTechPicker" class="picker-mask" @tap="showTechPicker = false">
      <view class="picker-panel" @tap.stop>
        <text class="picker-title">选择技师</text>
        <view v-for="tech in technicians" :key="tech.technicianId" class="tech-item" @tap="confirmTechnician(tech)">
          <text class="tech-name">{{ tech.name }}</text>
          <text class="tech-status" :style="{ color: tech.isBusy ? '#ff9500' : '#4cd964' }">
            {{ tech.isBusy ? '忙碌' : '空闲' }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.create-page { padding: 20rpx; padding-bottom: 140rpx; background: #f5f6fa; min-height: 100vh; }
.section { background: #fff; border-radius: 12rpx; padding: 24rpx; margin-bottom: 20rpx; }
.section-title { font-size: 28rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; display: block; }
.room-tag { font-size: 30rpx; color: #4a90d9; font-weight: bold; }
.member-search { display: flex; gap: 16rpx; }
.input { flex: 1; height: 72rpx; background: #f5f6fa; border-radius: 12rpx; padding: 0 20rpx; font-size: 28rpx; }
.search-btn { height: 72rpx; line-height: 72rpx; padding: 0 24rpx; background: #4a90d9; color: #fff; border-radius: 12rpx; font-size: 28rpx; }
.member-info { margin-top: 12rpx; font-size: 26rpx; color: #ff9500; }
.service-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.service-item { width: calc(33.33% - 12rpx); background: #f5f6fa; border-radius: 12rpx; padding: 16rpx; text-align: center; }
.svc-name { font-size: 26rpx; color: #333; display: block; }
.svc-price { font-size: 28rpx; color: #ff9500; font-weight: bold; display: block; margin-top: 4rpx; }
.svc-duration { font-size: 22rpx; color: #999; }
.selected-item { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.item-info { flex: 1; }
.item-name { font-size: 28rpx; color: #333; display: block; }
.item-tech { font-size: 24rpx; color: #4a90d9; margin-top: 4rpx; }
.item-price { font-size: 28rpx; color: #ff9500; margin-right: 16rpx; }
.item-remove { font-size: 36rpx; color: #ff3b30; padding: 0 8rpx; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; padding: 16rpx 24rpx; background: #fff; box-shadow: 0 -2rpx 10rpx rgba(0,0,0,0.05); }
.total { flex: 1; font-size: 28rpx; color: #333; }
.submit-btn { width: 240rpx; height: 80rpx; line-height: 80rpx; background: #4a90d9; color: #fff; border-radius: 40rpx; font-size: 30rpx; border: none; }
.picker-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 100; }
.picker-panel { width: 100%; max-height: 60vh; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 30rpx; overflow-y: auto; }
.picker-title { font-size: 30rpx; font-weight: bold; color: #333; display: block; margin-bottom: 20rpx; text-align: center; }
.tech-item { display: flex; justify-content: space-between; padding: 24rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.tech-name { font-size: 28rpx; color: #333; }
.tech-status { font-size: 26rpx; }
</style>
