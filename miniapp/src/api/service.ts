import { get, post, put, del } from './request'

export const serviceCategoryApi = {
  list: () => get('/services/categories'),
  create: (data: { name: string; sortOrder?: number }) => post('/services/categories', data),
  update: (id: number, data: Record<string, any>) => put(`/services/categories/${id}`, data),
  remove: (id: number) => del(`/services/categories/${id}`),
}

export const serviceApi = {
  list: (categoryId?: number) => get('/services', categoryId ? { categoryId } : undefined),
  create: (data: Record<string, any>) => post('/services', data),
  update: (id: number, data: Record<string, any>) => put(`/services/${id}`, data),
  remove: (id: number) => del(`/services/${id}`),
}
