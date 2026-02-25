import { get, post, put } from './request'

export const memberApi = {
  /** 搜索/列表 */
  search: (keyword?: string, page = 1, pageSize = 20) =>
    get('/members', { keyword, page, pageSize }),

  /** 最近到访 */
  recent: (limit = 10) => get('/members/recent', { limit }),

  /** 会员详情 */
  detail: (id: number) => get(`/members/${id}`),

  /** 注册会员 */
  register: (data: {
    phone: string; name?: string; gender?: string; birthday?: string; remark?: string
  }) => post('/members', data),

  /** 更新会员 */
  update: (id: number, data: Record<string, any>) => put(`/members/${id}`, data),

  /** 充值 */
  recharge: (id: number, data: { planId: number; paymentMethod: string; remark?: string }) =>
    post(`/members/${id}/recharge`, data),

  /** 消费记录 */
  orders: (id: number, page = 1) => get(`/members/${id}/orders`, { page }),

  /** 充值记录 */
  recharges: (id: number, page = 1) => get(`/members/${id}/recharges`, { page }),
}
