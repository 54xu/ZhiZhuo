import { defineStore } from 'pinia'
import { ref } from 'vue'
import { orderApi, type OrderItem } from '@/api/order'

export const useOrderStore = defineStore('order', () => {
  const currentOrder = ref<any>(null)
  const todayCustomers = ref<any[]>([])
  const loading = ref(false)

  /** 开单 */
  async function createOrder(data: {
    roomId: number; memberId?: number; customerName?: string;
    customerPhone?: string; items: OrderItem[]
  }) {
    const { data: order } = await orderApi.create(data)
    currentOrder.value = order
    return order
  }

  /** 加单 */
  async function addItems(orderId: number, items: OrderItem[]) {
    const { data: order } = await orderApi.addItems(orderId, items)
    currentOrder.value = order
    return order
  }

  /** 结账 */
  async function checkout(orderId: number, paymentType: string, payments?: Array<{ type: string; amount: number }>) {
    const { data: order } = await orderApi.checkout(orderId, { paymentType, payments })
    currentOrder.value = order
    return order
  }

  /** 加载今日客表 */
  async function loadTodayCustomers(status?: string) {
    loading.value = true
    try {
      const { data } = await orderApi.todayCustomers(status)
      todayCustomers.value = data
    } finally {
      loading.value = false
    }
  }

  /** 加载订单详情 */
  async function loadOrderDetail(orderId: number) {
    const { data } = await orderApi.detail(orderId)
    currentOrder.value = data
    return data
  }

  return {
    currentOrder, todayCustomers, loading,
    createOrder, addItems, checkout, loadTodayCustomers, loadOrderDetail,
  }
})
