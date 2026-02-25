import { get, post, put, del } from './request'

export const employeeApi = {
  list: (params?: { role?: string; status?: string }) => get('/employees', params),
  technicians: () => get('/employees/technicians'),
  detail: (id: number) => get(`/employees/${id}`),
  create: (data: Record<string, any>) => post('/employees', data),
  update: (id: number, data: Record<string, any>) => put(`/employees/${id}`, data),
  remove: (id: number) => del(`/employees/${id}`),
  unbindWx: (id: number) => put(`/employees/${id}/unbind-wx`, {}),
}
