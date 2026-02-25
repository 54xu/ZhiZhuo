import { get, post } from './request'

export interface OrderItem {
  serviceId: number
  technicianId: number
  quantity?: number
  isVisitCard?: boolean
}

export const orderApi = {
  /** 开单 */
  create: (data: {
    roomId: number
    memberId?: number
    customerName?: string
    customerPhone?: string
    items: OrderItem[]
  }) => post('/orders', data),

  /** 加单 */
  addItems: (orderId: number, items: OrderItem[]) =>
    post(`/orders/${orderId}/items`, { items }),

  /** 结账 */
  checkout: (orderId: number, data: {
    paymentType: string
    payments?: Array<{ type: string; amount: number }>
  }) => post(`/orders/${orderId}/checkout`, data),

  /** 退款 */
  refund: (orderId: number) => post(`/orders/${orderId}/refund`, {}),

  /** 订单详情 */
  detail: (orderId: number) => get(`/orders/${orderId}`),

  /** 今日客表 */
  todayCustomers: (status?: string) => get('/orders/today', status ? { status } : undefined),
}
