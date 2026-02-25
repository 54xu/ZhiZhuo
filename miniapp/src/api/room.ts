import { get, post, put, del } from './request'

export const roomApi = {
  /** 房台列表 */
  list: (params?: { zoneId?: number; status?: string }) => get('/rooms', params),

  /** 房台总览（按区域分组） */
  overview: () => get('/rooms/overview'),

  /** 新建房台 */
  create: (data: { zoneId: number; name: string; capacity?: number; sortOrder?: number }) =>
    post('/rooms', data),

  /** 更新房台 */
  update: (id: number, data: Record<string, any>) => put(`/rooms/${id}`, data),

  /** 更新房台状态 */
  updateStatus: (id: number, currentStatus: string) =>
    put(`/rooms/${id}/status`, { currentStatus }),

  /** 删除房台 */
  remove: (id: number) => del(`/rooms/${id}`),
}

export const zoneApi = {
  list: () => get('/zones'),
  create: (data: { name: string; sortOrder?: number }) => post('/zones', data),
  update: (id: number, data: Record<string, any>) => put(`/zones/${id}`, data),
  remove: (id: number) => del(`/zones/${id}`),
}
