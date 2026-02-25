/**
 * 提成规则管理路由
 * GET    /api/v1/commission-rules           列表（支持技师/服务筛选）
 * POST   /api/v1/commission-rules           新建
 * PUT    /api/v1/commission-rules/:id       更新
 * DELETE /api/v1/commission-rules/:id       删除
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// 提成规则列表
router.get('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { serviceId, technicianId } = req.query;
    const where: any = { storeId: req.user!.storeId, status: 'active' };
    if (serviceId) where.serviceId = Number(serviceId);
    if (technicianId) where.technicianId = Number(technicianId);

    const rules = await prisma.commissionRule.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
      orderBy: [{ serviceId: 'asc' }],
    });
    res.json({ code: 0, data: rules });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建提成规则
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { serviceId, technicianId, commissionType, commissionValue } = req.body;
    if (!serviceId || !commissionType || commissionValue === undefined) {
      res.status(400).json({ code: 400, message: '服务项目、提成类型、提成值为必填项' });
      return;
    }

    const validTypes = ['fixed', 'percentage'];
    if (!validTypes.includes(commissionType)) {
      res.status(400).json({ code: 400, message: '提成类型无效，可选: fixed/percentage' });
      return;
    }

    // 检查是否已存在同一服务+技师的规则
    const existing = await prisma.commissionRule.findFirst({
      where: {
        storeId: req.user!.storeId,
        serviceId,
        technicianId: technicianId ?? null,
        status: 'active',
      },
    });
    if (existing) {
      res.status(400).json({ code: 400, message: '该服务项目已存在提成规则' });
      return;
    }

    const rule = await prisma.commissionRule.create({
      data: {
        storeId: req.user!.storeId,
        serviceId,
        technicianId: technicianId ?? null,
        commissionType,
        commissionValue,
      },
    });
    res.json({ code: 0, data: rule });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新提成规则
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { commissionType, commissionValue, status } = req.body;

    const existing = await prisma.commissionRule.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '规则不存在' });
      return;
    }

    const rule = await prisma.commissionRule.update({
      where: { id },
      data: {
        ...(commissionType !== undefined && { commissionType }),
        ...(commissionValue !== undefined && { commissionValue }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: rule });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除提成规则（软删除）
router.delete('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.commissionRule.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '规则不存在' });
      return;
    }

    await prisma.commissionRule.update({
      where: { id },
      data: { status: 'inactive' },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
