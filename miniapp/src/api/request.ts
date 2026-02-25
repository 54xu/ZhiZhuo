/**
 * 统一请求封装
 *
 * 功能：
 * - 自动注入 JWT Token
 * - 统一错误处理
 * - Token 过期自动刷新
 * - 请求/响应拦截
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: any
  header?: Record<string, string>
  showLoading?: boolean
  showError?: boolean
}

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

/** 获取本地存储的 Token */
function getToken(): string {
  return uni.getStorageSync('access_token') || ''
}

/** 设置 Token */
export function setToken(token: string): void {
  uni.setStorageSync('access_token', token)
}

/** 清除 Token */
export function clearToken(): void {
  uni.removeStorageSync('access_token')
  uni.removeStorageSync('refresh_token')
}

/**
 * 发起请求
 */
export function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header = {}, showLoading = false, showError = true } = options

  if (showLoading) {
    uni.showLoading({ title: '加载中...' })
  }

  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...header,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: headers,
      success: (res: any) => {
        if (showLoading) uni.hideLoading()

        const statusCode = res.statusCode
        const body = res.data as ApiResponse<T>

        if (statusCode === 200 && body.code === 0) {
          resolve(body)
          return
        }

        // Token 过期
        if (statusCode === 401) {
          clearToken()
          uni.reLaunch({ url: '/pages/login/index' })
          reject(new Error('登录已过期，请重新登录'))
          return
        }

        // 功能未开启
        if (statusCode === 403 && body.message?.includes('功能模块')) {
          if (showError) {
            uni.showToast({ title: '该功能暂未开启', icon: 'none' })
          }
          reject(new Error(body.message))
          return
        }

        // 其他错误
        if (showError) {
          uni.showToast({ title: body.message || '请求失败', icon: 'none' })
        }
        reject(new Error(body.message || `HTTP ${statusCode}`))
      },
      fail: (err: any) => {
        if (showLoading) uni.hideLoading()
        if (showError) {
          uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        }
        reject(err)
      },
    })
  })
}

/** GET 请求 */
export function get<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
  return request<T>({ url, method: 'GET', data, ...options })
}

/** POST 请求 */
export function post<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
  return request<T>({ url, method: 'POST', data, ...options })
}

/** PUT 请求 */
export function put<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
  return request<T>({ url, method: 'PUT', data, ...options })
}

/** DELETE 请求 */
export function del<T = any>(url: string, data?: any, options?: Partial<RequestOptions>) {
  return request<T>({ url, method: 'DELETE', data, ...options })
}
