<script setup lang="ts">
/**
 * 排班编辑
 * 编辑指定日期的技师排班安排
 * 选择技师、设置班次时间和轮牌顺序
 */
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { scheduleApi } from '@/api/schedule'
import { employeeApi } from '@/api/employee'

interface TechItem {
  id: number
  name: string
  checked: boolean
  shiftStart: string
  shiftEnd: string
  rotationOrder: number
}

const date = ref('')
const loading = ref(false)
const saving = ref(false)
const techList = ref<TechItem[]>([])

const displayDate = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

const weekDayMap: Record<number, string> = {
  0: '周日', 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六',
}

const displayWeekDay = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return weekDayMap[d.getDay()]
})

const selectedCount = computed(() => techList.value.filter(t => t.checked).length)

async function loadData() {
  loading.value = true
  try {
    const [techRes, scheduleRes] = await Promise.all([
      employeeApi.technicians(),
      scheduleApi.getDaySchedule(date.value),
    ])

    const technicians = techRes.data || []
    const existingSchedule = scheduleRes.data || []

    const scheduleMap = new Map<number, any>()
    existingSchedule.forEach((s: any) => {
      scheduleMap.set(s.technicianId, s)
    })

    techList.value = technicians.map((tech: any, index: number) => {
      const existing = scheduleMap.get(tech.id)
      return {
        id: tech.id,
        name: tech.name,
        checked: !!existing,
        shiftStart: existing?.shiftStart || '09:00',
        shiftEnd: existing?.shiftEnd || '18:00',
        rotationOrder: existing?.rotationOrder || (index + 1),
      }
    })
  } catch {
    uni.showToast({ title: '加载数据失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function toggleTech(item: TechItem) {
  item.checked = !item.checked
}

function onStartTimeChange(item: TechItem, e: any) {
  item.shiftStart = e.detail.value
}

function onEndTimeChange(item: TechItem, e: any) {
  item.shiftEnd = e.detail.value
}

function onOrderInput(item: TechItem, e: any) {
  const val = parseInt(e.detail.value)
  item.rotationOrder = isNaN(val) ? 1 : val
}

function selectAll() {
  const allChecked = techList.value.every(t => t.checked)
  techList.value.forEach(t => { t.checked = !allChecked })
}

async function saveSchedule() {
  const selectedTechs = techList.value.filter(t => t.checked)
  if (selectedTechs.length === 0) {
    uni.showToast({ title: '请至少选择一名技师', icon: 'none' })
    return
  }

  // 验证时间
  for (const tech of selectedTechs) {
    if (tech.shiftStart >= tech.shiftEnd) {
      uni.showToast({ title: `${tech.name}的下班时间须晚于上班时间`, icon: 'none' })
      return
    }
    if (tech.rotationOrder < 1) {
      uni.showToast({ title: `${tech.name}的轮牌序号须大于0`, icon: 'none' })
      return
    }
  }

  saving.value = true
  try {
    const items = selectedTechs.map(t => ({
      technicianId: t.id,
      shiftStart: t.shiftStart,
      shiftEnd: t.shiftEnd,
      rotationOrder: t.rotationOrder,
    }))
    await scheduleApi.setDaySchedule(date.value, items)
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onLoad((options) => {
  date.value = options?.date || ''
  if (!date.value) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    date.value = `${y}-${m}-${d}`
  }
  loadData()
})
</script>

<template>
  <view class="page">
    <!-- 日期显示 -->
    <view class="date-header">
      <text class="date-title">{{ displayDate }}</text>
      <text class="date-weekday">{{ displayWeekDay }}</text>
    </view>

    <!-- 操作提示 -->
    <view class="tip-bar">
      <text class="tip-text">已选 {{ selectedCount }} 人排班</text>
      <view class="select-all-btn" @tap="selectAll">
        <text class="select-all-text">{{ techList.every(t => t.checked) ? '取消全选' : '全选' }}</text>
      </view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-box">
      <text class="loading-text">加载中...</text>
    </view>

    <!-- 技师列表 -->
    <view v-else class="tech-list">
      <view v-if="techList.length === 0" class="empty-box">
        <text class="empty-text">暂无技师数据</text>
      </view>

      <view
        v-for="item in techList"
        :key="item.id"
        class="tech-row"
        :class="{ 'tech-row-active': item.checked }"
      >
        <!-- 选中状态 -->
        <view class="check-area" @tap="toggleTech(item)">
          <view class="checkbox" :class="{ checked: item.checked }">
            <text v-if="item.checked" class="check-icon">&#10003;</text>
          </view>
        </view>

        <!-- 技师信息 -->
        <view class="tech-main">
          <text class="tech-name">{{ item.name }}</text>

          <view v-if="item.checked" class="shift-config">
            <!-- 上班时间 -->
            <view class="time-row">
              <text class="time-label">上班</text>
              <picker mode="time" :value="item.shiftStart" @change="(e: any) => onStartTimeChange(item, e)">
                <view class="time-picker">
                  <text class="time-value">{{ item.shiftStart }}</text>
                </view>
              </picker>
            </view>

            <!-- 下班时间 -->
            <view class="time-row">
              <text class="time-label">下班</text>
              <picker mode="time" :value="item.shiftEnd" @change="(e: any) => onEndTimeChange(item, e)">
                <view class="time-picker">
                  <text class="time-value">{{ item.shiftEnd }}</text>
                </view>
              </picker>
            </view>

            <!-- 轮牌序号 -->
            <view class="time-row">
              <text class="time-label">轮牌</text>
              <view class="order-input-wrap">
                <input
                  class="order-input"
                  type="number"
                  :value="String(item.rotationOrder)"
                  @input="(e: any) => onOrderInput(item, e)"
                  placeholder="序号"
                />
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 保存按钮 -->
    <view class="bottom-bar">
      <view class="save-btn" :class="{ disabled: saving || selectedCount === 0 }" @tap="saveSchedule">
        <text class="save-btn-text">{{ saving ? '保存中...' : '保存排班' }}</text>
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

/* 日期头 */
.date-header {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  padding: 32rpx;
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}
.date-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}
.date-weekday {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
}

/* 提示条 */
.tip-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 32rpx;
  background: #fff;
  margin-bottom: 16rpx;
}
.tip-text {
  font-size: 28rpx;
  color: #666;
}
.select-all-btn {
  padding: 8rpx 24rpx;
  background: #f5f6fa;
  border-radius: 20rpx;
}
.select-all-text {
  font-size: 24rpx;
  color: #4a90d9;
}

/* 加载 & 空状态 */
.loading-box, .empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 32rpx;
}
.loading-text, .empty-text {
  font-size: 28rpx;
  color: #999;
}

/* 技师列表 */
.tech-list {
  padding: 0 24rpx;
}
.tech-row {
  display: flex;
  align-items: flex-start;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  border-left: 6rpx solid #e0e0e0;
  transition: border-color 0.2s;
}
.tech-row-active {
  border-left-color: #4a90d9;
}

/* 复选框 */
.check-area {
  padding-right: 20rpx;
  padding-top: 4rpx;
}
.checkbox {
  width: 44rpx;
  height: 44rpx;
  border: 3rpx solid #ddd;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.checkbox.checked {
  background: #4a90d9;
  border-color: #4a90d9;
}
.check-icon {
  font-size: 28rpx;
  color: #fff;
  font-weight: bold;
}

/* 技师主体 */
.tech-main {
  flex: 1;
}
.tech-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

/* 班次配置 */
.shift-config {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.time-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.time-label {
  font-size: 24rpx;
  color: #999;
  width: 60rpx;
}
.time-picker {
  background: #f5f6fa;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  min-width: 120rpx;
  text-align: center;
}
.time-value {
  font-size: 26rpx;
  color: #333;
}
.order-input-wrap {
  background: #f5f6fa;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  width: 100rpx;
}
.order-input {
  font-size: 26rpx;
  color: #333;
  text-align: center;
  height: 44rpx;
}

/* 底部保存 */
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
.save-btn {
  background: linear-gradient(135deg, #4a90d9, #357abd);
  border-radius: 16rpx;
  padding: 24rpx 0;
  text-align: center;
}
.save-btn.disabled {
  opacity: 0.5;
}
.save-btn-text {
  font-size: 32rpx;
  color: #fff;
  font-weight: 600;
}
</style>
