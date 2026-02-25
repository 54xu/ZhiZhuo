import { get } from './request'

export const reportApi = {
  /** 今日经营简报 */
  dashboard: () => get('/reports/dashboard'),

  /** 营收统计 */
  revenue: (startDate: string, endDate: string) =>
    get('/reports/revenue', { startDate, endDate }),

  /** 技师业绩 */
  staffPerformance: (startDate: string, endDate: string) =>
    get('/reports/staff-performance', { startDate, endDate }),

  /** 会员统计 */
  memberStats: (startDate: string, endDate: string) =>
    get('/reports/member-stats', { startDate, endDate }),

  /** 充值统计 */
  rechargeStats: (startDate: string, endDate: string) =>
    get('/reports/recharge-stats', { startDate, endDate }),

  /** 收银对账 */
  reconciliation: (date: string) => get('/reports/reconciliation', { date }),
}
