import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('access_token') || '')
  const userInfo = ref<Record<string, any> | null>(null)
  const isLoggedIn = computed(() => !!token.value)
  const role = computed(() => userInfo.value?.role || '')
  const storeId = computed(() => userInfo.value?.store?.id || 0)
  const storeName = computed(() => userInfo.value?.store?.name || '')

  /** 微信登录 */
  async function wxLogin() {
    const [err, res] = await uni.login({ provider: 'weixin' }) as any
    if (err) throw new Error('微信登录失败')

    const { data } = await authApi.wxLogin(res.code)
    if (data.needBind) {
      // 未绑定，跳转绑定页面，传 openid
      uni.navigateTo({ url: `/pages/index/index?openid=${data.openid}` })
      return { needBind: true }
    }

    // 已绑定，保存 token
    token.value = data.token
    userInfo.value = data.employee
    uni.setStorageSync('access_token', data.token)
    return { needBind: false }
  }

  /** 绑定员工 */
  async function bindEmployee(openid: string, employeeNo: string, phone: string) {
    const { data } = await authApi.bind({ openid, employeeNo, phone })
    token.value = data.token
    userInfo.value = data.employee
    uni.setStorageSync('access_token', data.token)
  }

  /** 获取用户信息 */
  async function fetchProfile() {
    if (!token.value) return
    try {
      const { data } = await authApi.getProfile()
      userInfo.value = data
    } catch {
      logout()
    }
  }

  /** 退出登录 */
  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('access_token')
    uni.reLaunch({ url: '/pages/index/index' })
  }

  /** 权限检查 */
  function hasRole(...roles: string[]) {
    return roles.includes(role.value)
  }

  return {
    token, userInfo, isLoggedIn, role, storeId, storeName,
    wxLogin, bindEmployee, fetchProfile, logout, hasRole,
  }
})
