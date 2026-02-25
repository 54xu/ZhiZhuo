<script setup lang="ts">
/**
 * 排班查看
 * 按日查看技师排班情况，支持前后日期切换
 * 管理员可跳转编辑排班，可切换技师状态
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { scheduleApi } from '@/api/schedule'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const currentDate = ref('')
const loading = ref(false)
const scheduleList = ref<any[]>([])

const isAdmin = computed(() => userStore.hasRole('admin', 'manager'))

const weekDayMap: Record<number, string> = {
  0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六',
}

const displayDate = computed(() => {
  if (!currentDate.value) return ''
  const d = new Date(currentDate.value)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekDay = weekDayMap[d.getDay()]
  return `${month}月${day}日 ${weekDay}`
})

const isToday = computed(() => {
  return currentDate.value === formatDate(new Date())
})

const statusColor: Record<string, string> = {
  on_duty: '#4cd964',
  serving: '#ff9500',
  off_duty: '#c7c7cc',
  idle: '#4a90d9',
}

const statusText: Record<string, string> = {
  on_duty: '在岗',
  serving: '服务中',
  off_duty: '休息',
  idle: '空闲',
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function changeDate(offset: number) {
  const d = new Date(currentDate.value)
  d.setDate(d.getDate() + offset)
  currentDate.value = formatDate(d)
  loadSchedule()
}

function onDatePick(e: any) {
  currentDate.value = e.detail.value
  loadSchedule()
}

async function loadSchedule() {
  loading.value = true
  try {
    const { data } = await scheduleApi.getDaySchedule(currentDate.value)
    scheduleList.value = data || []
  } catch {
    scheduleList.value = []
  } finally {
    loading.value = false
  }
}

function getAvatarInitial(name: string): string {
  return name ? name.charAt(0) : '?'
}

function getAvatarColor(name: string): string {
  const colors = ['#4a90d9', '#4cd964', '#ff9500', '#ff3b30', '#5856d6', '#34aadc', '#ff2d55', '#8e8e93']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

async function toggleStatus(item: any) {
  if (item.status !== 'idle' && item.status !== 'off_duty') {
    uni.showToast({ title: '仅空闲/休息状态可切换', icon: 'none' })
    return
  }
  const newStatus = item.status === 'idle' ? 'off_duty' : 'idle'
  const confirmText = newStatus === 'off_duty' ? '确认将该技师设为休息？' : '确认将该技师设为空闲？'

  uni.showModal({
    title: '切换状态',
    content: confirmText,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await scheduleApi.updateStatus(item.id, newStatus)
        item.status = newStatus
        uni.showToast({ title: '状态已更新', icon: 'success' })
      } catch {
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
  })
}

function goEdit() {
  uni.navigateTo({
    url: `/sub-packages/staff/schedule-edit?date=${currentDate.value}`,
  })
}

onLoad(() => {
  currentDate.value = formatDate(new Date())
  loadSchedule()
})
</script>

<template>
  <view class="page">
    <!-- 日期选择区 -->
    <view class="date-bar">
      <view class="date-arrow" @tap="changeDate(-1)">
        <text class="arrow-icon">&lt;</text>
      </view>
      <picker mode="date" :value="currentDate" @change="onDatePick">
        <view class="date-display">
          <text class="date-text">{{ displayDate }}</text>
          <text v-if="isToday" class="today-badge">今天</text>
        </view>
      </picker>
      <view class="date-arrow" @tap="changeDate(1)">
        <text class="arrow-icon">&gt;</text>
      </view>
    </view>

    <!-- 统计摘要 -->
    <view class="summary-bar">
      <view class="summary-item">
        <text class="summary-value">{{ scheduleList.length }}</text>
        <text class="summary-label">排班人数</text>
      </view>
      <view class="summary-item">
        <text class="summary-value on-duty">{{ scheduleList.filter(s => s.status === 'on_duty' || s.status === 'idle').length }}</text>
        <text class="summary-label">在岗</text>
      </view>
      <view class="summary-item">
        <text class="summary-value serving">{{ scheduleList.filter(s => s.status === 'serving').length }}</text>
        <text class="summary-label">服务中</text>
      </view>
      <view class="summary-item">
        <text class="summary-value off-duty">{{ scheduleList.filter(s => s.status === 'off_duty').length }}</text>
        <text class="summary-label">休息</text>
      </view>
    </view>

    <!-- 排班列表 -->
    <view class="section-title">
      <text>排班列表</text>
    </view>

    <view v-if="loading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else-if="scheduleList.length === 0" class="empty-box">
      <text class="empty-text">当天暂无排班</text>
      <text class="empty-hint">可点击下方按钮编辑排班</text>
    </view>

    <view v-else class="schedule-list">
      <view
        v-for="item in scheduleList"
        :key="item.id"
        class="tech-card"
        @tap="toggleStatus(item)"
      >
        <view class="tech-avatar" :style="{ backgroundColor: getAvatarColor(item.technicianName || '') }">
          <text class="avatar-text">{{ getAvatarInitial(item.technicianName || '') }}</text>
        </view>
        <view class="tech-info">
          <view class="tech-name-row">
            <text class="tech-name">{{ item.technicianName }}</text>
            <view class="rotation-badge">
              <text class="rotation-text">{{ item.rotationOrder }}</text>
            </view>
          </view>
          <view class="tech-shift">
            <text class="shift-text">{{ item.shiftStart }} - {{ item.shiftEnd }}</text>
          </view>
        </view>
        <view class="status-badge" :style="{ backgroundColor: statusColor[item.status] || '#c7c7cc' }">
          <text class="status-text">{{ statusText[item.status] || item.status }}</text>
        </view>
      </view>
    </view>

    <!-- 底部操作 -->
    <view v-if="isAdmin" class="bottom-bar">
      <view class="edit-btn" @tap="goEdit">
        <text class="edit-btn-text">编辑排班</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6fa;
  padding-bottom: 140rpx;
}

/* 日期选择 */
.date-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  padding: 24rpx 32rpx;
}
.date-arrow {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f6fa;
}
.arrow-icon {
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
}
.date-display {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.date-text {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}
.today-badge {
  font-size: 22rpx;
  color: #fff;
  background: #4a90d9;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

/* 统计摘要 */
.summary-bar {
  display: flex;
  justify-content: space-around;
  background: #fff;
  padding: 24rpx 20rpx;
  margin-top: 2rpx;
}
.summary-item {
  text-align: center;
}
.summary-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
}
.summary-value.on-duty {
  color: #4cd964;
}
.summary-value.serving {
  color: #ff9500;
}
.summary-value.off-duty {
  color: #c7c7cc;
}
.summary-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

/* 列表区 */
.section-title {
  padding: 24rpx 32rpx 16rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #666;
}
.loading-box, .empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 32rpx;
}
.loading-text {
  font-size: 28rpx;
  color: #999;
}
.empty-text {
  font-size: 28rpx;
  color: #999;
}
.empty-hint {
  font-size: 24rpx;
  color: #ccc;
  margin-top: 12rpx;
}

/* 技师卡片 */
.schedule-list {
  padding: 0 24rpx;
}
.tech-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.tech-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-text {
  font-size: 34rpx;
  font-weight: bold;
  color: #fff;
}
.tech-info {
  flex: 1;
  margin-left: 20rpx;
}
.tech-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.tech-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}
.rotation-badge {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rotation-text {
  font-size: 22rpx;
  color: #666;
  font-weight: bold;
}
.tech-shift {
  margin-top: 8rpx;
}
.shift-text {
  font-size: 26rpx;
  color: #999;
}
.status-badge {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}
.status-text {
  font-size: 24rpx;
  color: #fff;
  font-weight: 500;
}

/* 底部操作 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.edit-btn {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx;
  padding: 24rpx 0;
  text-align: center;
}
.edit-btn-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: 600;
}
</style>
