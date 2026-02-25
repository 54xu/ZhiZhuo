import { get, post, put } from './request'

export const scheduleApi = {
  /** 某日排班 */
  getDaySchedule: (date?: string) => get('/schedules', date ? { date } : undefined),

  /** 批量设置排班 */
  setDaySchedule: (date: string, items: Array<{
    technicianId: number; shiftStart: string; shiftEnd: string; rotationOrder: number
  }>) => post('/schedules', { date, items }),

  /** 更新排班状态 */
  updateStatus: (id: number, status: string) => put(`/schedules/${id}/status`, { status }),

  /** 轮牌推荐列表 */
  getRotation: (serviceId?: number) =>
    get('/schedules/rotation', serviceId ? { serviceId } : undefined),
}
