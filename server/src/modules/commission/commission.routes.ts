/**
 * 提成查询路由
 * GET  /api/v1/commissions/summary         提成汇总（按技师分组）
 * GET  /api/v1/commissions/detail/:techId   某技师提成明细
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { CommissionService } from './commission.service';
import { prisma } from '../../app';

const router = Router();

let commissionService: CommissionService;
function getService(): CommissionService {
  if (!commissionService) {
    commissionService = new CommissionService(prisma);
    commissionService.registerEvents(); // 注册事件监听
  }
  return commissionService;
}

// 提成汇总
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    // 确保服务已初始化（含事件注册）
    getService();

    const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || startDate;

    const summary = await getService().getSummary(req.user!.storeId, startDate, endDate);
    res.json({ code: 0, data: summary });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 某技师提成明细
router.get('/detail/:techId', requireAuth, async (req: Request, res: Response) => {
  try {
    const technicianId = Number(req.params.techId);

    // 技师只能查看自己的
    if (req.user!.role === 'technician' && req.user!.employeeId !== technicianId) {
      res.status(403).json({ code: 403, message: '无权查看其他人的提成' });
      return;
    }

    const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || startDate;

    const detail = await getService().getTechnicianDetail(
      req.user!.storeId, technicianId, startDate, endDate,
    );
    res.json({ code: 0, data: detail });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
