import { get, put, post, del } from './request'

export const storeApi = {
  detail: (id: number) => get(`/stores/${id}`),
  update: (id: number, data: Record<string, any>) => put(`/stores/${id}`, data),
}

export const rechargePlanApi = {
  list: (planType?: string) => get('/recharge-plans', planType ? { planType } : undefined),
  create: (data: Record<string, any>) => post('/recharge-plans', data),
  update: (id: number, data: Record<string, any>) => put(`/recharge-plans/${id}`, data),
  remove: (id: number) => del(`/recharge-plans/${id}`),
}

export const commissionRuleApi = {
  list: (params?: { serviceId?: number; technicianId?: number }) =>
    get('/commission-rules', params),
  create: (data: Record<string, any>) => post('/commission-rules', data),
  update: (id: number, data: Record<string, any>) => put(`/commission-rules/${id}`, data),
  remove: (id: number) => del(`/commission-rules/${id}`),
}

export const commissionApi = {
  summary: (startDate: string, endDate: string) =>
    get('/commissions/summary', { startDate, endDate }),
  detail: (techId: number, startDate: string, endDate: string) =>
    get(`/commissions/detail/${techId}`, { startDate, endDate }),
}
