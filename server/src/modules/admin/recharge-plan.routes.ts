/**
 * 充值方案管理路由
 * GET    /api/v1/recharge-plans           列表
 * POST   /api/v1/recharge-plans           新建
 * PUT    /api/v1/recharge-plans/:id       更新
 * DELETE /api/v1/recharge-plans/:id       删除（软删除）
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// 充值方案列表
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { planType } = req.query;
    const where: any = { storeId: req.user!.storeId, status: 'active' };
    if (planType) where.planType = planType;

    const plans = await prisma.rechargePlan.findMany({
      where,
      orderBy: [{ planType: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json({ code: 0, data: plans });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建充值方案
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { planType, name, payAmount, giftAmount, serviceId, buyCount, giftCount, sortOrder } = req.body;

    if (!planType || !name || payAmount === undefined) {
      res.status(400).json({ code: 400, message: '类型、名称、金额为必填项' });
      return;
    }

    if (planType === 'visit' && (!serviceId || !buyCount)) {
      res.status(400).json({ code: 400, message: '次卡方案需要指定服务项目和购买次数' });
      return;
    }

    const plan = await prisma.rechargePlan.create({
      data: {
        storeId: req.user!.storeId,
        planType,
        name,
        payAmount,
        giftAmount: giftAmount ?? 0,
        serviceId: serviceId ?? null,
        buyCount: buyCount ?? null,
        giftCount: giftCount ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json({ code: 0, data: plan });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新充值方案
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, payAmount, giftAmount, serviceId, buyCount, giftCount, sortOrder, status } = req.body;

    const existing = await prisma.rechargePlan.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '充值方案不存在' });
      return;
    }

    const plan = await prisma.rechargePlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(payAmount !== undefined && { payAmount }),
        ...(giftAmount !== undefined && { giftAmount }),
        ...(serviceId !== undefined && { serviceId }),
        ...(buyCount !== undefined && { buyCount }),
        ...(giftCount !== undefined && { giftCount }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: plan });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除充值方案（软删除）
router.delete('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.rechargePlan.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '充值方案不存在' });
      return;
    }

    await prisma.rechargePlan.update({
      where: { id },
      data: { status: 'inactive' },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
