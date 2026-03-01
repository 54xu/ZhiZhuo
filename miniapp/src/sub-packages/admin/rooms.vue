<script setup lang="ts">
/**
 * 房间管理
 * 顶部区域标签 + 房间卡片网格
 */
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { roomApi, zoneApi } from '@/api/room'

interface Zone {
  id: number
  name: string
  sortOrder?: number
}

interface Room {
  id: number
  zoneId: number
  name: string
  capacity?: number
  sortOrder?: number
  currentStatus: string
}

const zones = ref<Zone[]>([])
const rooms = ref<Room[]>([])
const activeZoneId = ref<number | null>(null)
const loading = ref(false)

// ---- 区域弹窗 ----
const showZoneModal = ref(false)
const zoneForm = ref({ name: '', sortOrder: 0 })
const editingZoneId = ref<number | null>(null)

// ---- 房间弹窗 ----
const showRoomModal = ref(false)
const roomForm = ref({ name: '', capacity: 0, sortOrder: 0 })
const editingRoomId = ref<number | null>(null)

const statusColor: Record<string, string> = {
  idle: '#4cd964',
  in_use: '#ff9500',
  pending_clean: '#ff3b30',
  disabled: '#c7c7cc',
}
const statusText: Record<string, string> = {
  idle: '空闲',
  in_use: '使用中',
  pending_clean: '待清理',
  disabled: '停用',
}

const filteredRooms = computed(() => {
  if (!activeZoneId.value) return rooms.value
  return rooms.value.filter(r => r.zoneId === activeZoneId.value)
})

onShow(() => {
  loadZones()
  loadRooms()
})

async function loadZones() {
  try {
    const { data } = await zoneApi.list()
    zones.value = data
    if (data.length > 0 && !activeZoneId.value) {
      activeZoneId.value = data[0].id
    }
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) }
}

async function loadRooms() {
  loading.value = true
  try {
    const { data } = await roomApi.list()
    rooms.value = data
  } catch { uni.showToast({ title: '加载失败', icon: 'none' }) } finally {
    loading.value = false
  }
}

function selectZone(id: number) {
  activeZoneId.value = id
}

// ---- 区域操作 ----
function openAddZone() {
  editingZoneId.value = null
  zoneForm.value = { name: '', sortOrder: 0 }
  showZoneModal.value = true
}

function onZoneLongPress(zone: Zone) {
  uni.showActionSheet({
    itemList: ['编辑区域', '删除区域'],
    success: (res) => {
      if (res.tapIndex === 0) {
        editingZoneId.value = zone.id
        zoneForm.value = { name: zone.name, sortOrder: zone.sortOrder || 0 }
        showZoneModal.value = true
      } else if (res.tapIndex === 1) {
        confirmDeleteZone(zone)
      }
    },
  })
}

async function saveZone() {
  if (!zoneForm.value.name.trim()) {
    uni.showToast({ title: '请输入区域名称', icon: 'none' })
    return
  }
  try {
    if (editingZoneId.value) {
      await zoneApi.update(editingZoneId.value, zoneForm.value)
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await zoneApi.create(zoneForm.value)
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showZoneModal.value = false
    await loadZones()
  } catch { uni.showToast({ title: '保存失败', icon: 'none' }) }
}

function confirmDeleteZone(zone: Zone) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除区域「${zone.name}」？该区域下的房间也将被删除。`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await zoneApi.remove(zone.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          if (activeZoneId.value === zone.id) {
            activeZoneId.value = zones.value.length > 1 ? zones.value[0].id : null
          }
          await loadZones()
          await loadRooms()
        } catch { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    },
  })
}

// ---- 房间操作 ----
function openAddRoom() {
  if (!activeZoneId.value) {
    uni.showToast({ title: '请先选择或创建区域', icon: 'none' })
    return
  }
  editingRoomId.value = null
  roomForm.value = { name: '', capacity: 0, sortOrder: 0 }
  showRoomModal.value = true
}

function onRoomTap(room: Room) {
  editingRoomId.value = room.id
  roomForm.value = {
    name: room.name,
    capacity: room.capacity || 0,
    sortOrder: room.sortOrder || 0,
  }
  showRoomModal.value = true
}

function onRoomLongPress(room: Room) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除房间「${room.name}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          await roomApi.remove(room.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
          await loadRooms()
        } catch { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    },
  })
}

async function saveRoom() {
  if (!roomForm.value.name.trim()) {
    uni.showToast({ title: '请输入房间名称', icon: 'none' })
    return
  }
  try {
    if (editingRoomId.value) {
      await roomApi.update(editingRoomId.value, {
        ...roomForm.value,
        zoneId: activeZoneId.value,
      })
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      await roomApi.create({
        ...roomForm.value,
        zoneId: activeZoneId.value!,
      })
      uni.showToast({ title: '添加成功', icon: 'success' })
    }
    showRoomModal.value = false
    await loadRooms()
  } catch { uni.showToast({ title: '保存失败', icon: 'none' }) }
}
</script>

<template>
  <view class="page">
    <!-- 顶部标题 -->
    <view class="page-header">
      <text class="page-title">房间管理</text>
    </view>

    <!-- 区域标签栏 -->
    <view class="zone-bar">
      <scroll-view scroll-x class="zone-scroll">
        <view class="zone-tabs">
          <view
            v-for="zone in zones"
            :key="zone.id"
            class="zone-tab"
            :class="{ active: activeZoneId === zone.id }"
            @tap="selectZone(zone.id)"
            @longpress="onZoneLongPress(zone)"
          >
            <text class="zone-tab-text">{{ zone.name }}</text>
          </view>
        </view>
      </scroll-view>
      <view class="zone-add-btn" @tap="openAddZone">
        <text class="zone-add-icon">+</text>
      </view>
    </view>

    <view class="zone-hint">
      <text class="hint-text">长按区域标签可编辑或删除 | 点击房间编辑，长按房间删除</text>
    </view>

    <!-- 房间网格 -->
    <scroll-view scroll-y class="room-area">
      <view class="room-actions-bar">
        <view class="add-room-btn" @tap="openAddRoom">
          <text class="add-room-text">+ 添加房间</text>
        </view>
      </view>

      <view v-if="filteredRooms.length > 0" class="room-grid">
        <view
          v-for="room in filteredRooms"
          :key="room.id"
          class="room-card"
          :style="{ borderTopColor: statusColor[room.currentStatus] || '#ccc' }"
          @tap="onRoomTap(room)"
          @longpress="onRoomLongPress(room)"
        >
          <text class="room-name">{{ room.name }}</text>
          <text class="room-status" :style="{ color: statusColor[room.currentStatus] }">
            {{ statusText[room.currentStatus] || room.currentStatus }}
          </text>
          <text v-if="room.capacity" class="room-capacity">容纳{{ room.capacity }}人</text>
        </view>
      </view>
      <view v-else class="empty-tip">
        <text>{{ loading ? '加载中...' : '暂无房间' }}</text>
      </view>
    </scroll-view>

    <!-- 区域弹窗 -->
    <view v-if="showZoneModal" class="modal-mask" @tap="showZoneModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingZoneId ? '编辑区域' : '添加区域' }}</text>
        <view class="form-group">
          <text class="form-label">区域名称</text>
          <input v-model="zoneForm.name" class="form-input" placeholder="请输入区域名称" />
        </view>
        <view class="form-group">
          <text class="form-label">排序</text>
          <input v-model.number="zoneForm.sortOrder" class="form-input" type="number" placeholder="数字越小越靠前" />
        </view>
        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showZoneModal = false">取消</text>
          <text class="modal-btn confirm" @tap="saveZone">保存</text>
        </view>
      </view>
    </view>

    <!-- 房间弹窗 -->
    <view v-if="showRoomModal" class="modal-mask" @tap="showRoomModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingRoomId ? '编辑房间' : '添加房间' }}</text>
        <view class="form-group">
          <text class="form-label">房间名称</text>
          <input v-model="roomForm.name" class="form-input" placeholder="请输入房间名称" />
        </view>
        <view class="form-group">
          <text class="form-label">容纳人数</text>
          <input v-model.number="roomForm.capacity" class="form-input" type="number" placeholder="请输入容纳人数" />
        </view>
        <view class="form-group">
          <text class="form-label">排序</text>
          <input v-model.number="roomForm.sortOrder" class="form-input" type="number" placeholder="数字越小越靠前" />
        </view>
        <view class="modal-footer">
          <text class="modal-btn cancel" @tap="showRoomModal = false">取消</text>
          <text class="modal-btn confirm" @tap="saveRoom">保存</text>
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

/* 区域标签栏 */
.zone-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 20rpx;
  gap: 12rpx;
}
.zone-scroll {
  flex: 1;
  white-space: nowrap;
}
.zone-tabs {
  display: flex;
  gap: 16rpx;
}
.zone-tab {
  display: inline-flex;
  padding: 12rpx 28rpx;
  border-radius: 24rpx;
  background: #f0f0f0;
  flex-shrink: 0;
}
.zone-tab.active {
  background: #4a90d9;
}
.zone-tab-text {
  font-size: 26rpx;
  color: #666;
}
.zone-tab.active .zone-tab-text {
  color: #fff;
}
.zone-add-btn {
  width: 56rpx;
  height: 56rpx;
  line-height: 54rpx;
  text-align: center;
  background: #4a90d9;
  border-radius: 50%;
  flex-shrink: 0;
}
.zone-add-icon {
  font-size: 36rpx;
  color: #fff;
}

.zone-hint {
  padding: 8rpx 32rpx 0;
}
.hint-text {
  font-size: 22rpx;
  color: #bbb;
}

/* 房间区域 */
.room-area {
  flex: 1;
  padding: 20rpx;
}
.room-actions-bar {
  margin-bottom: 20rpx;
}
.add-room-btn {
  display: inline-flex;
  padding: 12rpx 28rpx;
  background: #4a90d9;
  border-radius: 24rpx;
}
.add-room-text {
  font-size: 26rpx;
  color: #fff;
}

.room-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.room-card {
  width: calc(33.33% - 12rpx);
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 16rpx;
  border-top: 6rpx solid #ccc;
  box-sizing: border-box;
  text-align: center;
}
.room-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}
.room-status {
  font-size: 24rpx;
  display: block;
  margin-bottom: 4rpx;
}
.room-capacity {
  font-size: 22rpx;
  color: #999;
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
