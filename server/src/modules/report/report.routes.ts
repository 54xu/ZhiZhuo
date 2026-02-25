/**
 * 报表路由
 * GET /api/v1/reports/dashboard           今日经营简报
 * GET /api/v1/reports/revenue             营收统计
 * GET /api/v1/reports/staff-performance   技师业绩
 * GET /api/v1/reports/member-stats        会员统计
 * GET /api/v1/reports/recharge-stats      充值统计
 * GET /api/v1/reports/reconciliation      收银对账
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { ReportService } from './report.service';
import { prisma } from '../../app';

const router = Router();

let reportService: ReportService;
function getService(): ReportService {
  if (!reportService) reportService = new ReportService(prisma);
  return reportService;
}

// 今日经营简报
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await getService().getDashboard(req.user!.storeId);
    res.json({ code: 0, data });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 营收统计（管理员/收银员）
router.get('/revenue', requireAuth, requireRole('admin', 'cashier'), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const data = await getService().getRevenue(req.user!.storeId, startDate, endDate);
    res.json({ code: 0, data });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 技师业绩
router.get('/staff-performance', requireAuth, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;

    let data = await getService().getStaffPerformance(req.user!.storeId, startDate, endDate);

    // 技师只看自己
    if (req.user!.role === 'technician') {
      data = data.filter((d: typeof data[number]) => d.id === req.user!.employeeId);
    }

    res.json({ code: 0, data });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 会员统计
router.get('/member-stats', requireAuth, requireRole('admin', 'cashier'), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const data = await getService().getMemberStats(req.user!.storeId, startDate, endDate);
    res.json({ code: 0, data });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 充值统计
router.get('/recharge-stats', requireAuth, requireRole('admin', 'cashier'), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startDate = (req.query.startDate as string) || today;
    const endDate = (req.query.endDate as string) || today;
    const data = await getService().getRechargeStats(req.user!.storeId, startDate, endDate);
    res.json({ code: 0, data });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 收银对账
router.get('/reconciliation', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const data = await getService().getReconciliation(req.user!.storeId, date);
    res.json({ code: 0, data });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
