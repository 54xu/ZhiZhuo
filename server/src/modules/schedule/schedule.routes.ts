/**
 * 排班管理路由
 * GET    /api/v1/schedules              某日排班
 * POST   /api/v1/schedules              批量设置排班
 * PUT    /api/v1/schedules/:id/status   更新排班状态
 * GET    /api/v1/schedules/rotation     轮牌推荐列表
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { ScheduleService } from './schedule.service';
import { prisma } from '../../app';

const router = Router();

let scheduleService: ScheduleService;
function getService(): ScheduleService {
  if (!scheduleService) scheduleService = new ScheduleService(prisma);
  return scheduleService;
}

// 获取某日排班
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const list = await getService().getDaySchedule(req.user!.storeId, date);
    res.json({ code: 0, data: list });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量设置排班（管理员）
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { date, items } = req.body;
    if (!date || !Array.isArray(items)) {
      res.status(400).json({ code: 400, message: '日期和排班列表不能为空' });
      return;
    }
    const list = await getService().setDaySchedule(req.user!.storeId, date, items);
    res.json({ code: 0, data: list });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 更新排班状态
router.put('/:id/status', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ['scheduled', 'on_duty', 'off_duty', 'leave'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ code: 400, message: '无效的状态值' });
      return;
    }
    const schedule = await getService().updateScheduleStatus(
      req.user!.storeId, Number(req.params.id), status,
    );
    res.json({ code: 0, data: schedule });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 轮牌推荐列表
router.get('/rotation', requireAuth, async (req: Request, res: Response) => {
  try {
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
    const list = await getService().getRotationList(req.user!.storeId, serviceId);
    res.json({ code: 0, data: list });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
