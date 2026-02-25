import { post, get } from './request'

export const authApi = {
  /** 微信登录 */
  wxLogin: (code: string) => post('/auth/wx-login', { code }),

  /** 员工绑定微信 */
  bind: (data: { openid: string; employeeNo: string; phone: string }) =>
    post('/auth/bind', data),

  /** 获取当前用户信息 */
  getProfile: () => get('/auth/profile'),
}
