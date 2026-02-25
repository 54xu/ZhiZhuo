/**
 * 门店管理路由
 * GET    /api/v1/stores/:id       获取门店信息
 * PUT    /api/v1/stores/:id       更新门店信息
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// 获取当前门店信息
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const storeId = Number(req.params.id);
    if (req.user!.storeId !== storeId) {
      res.status(403).json({ code: 403, message: '无权访问该门店' });
      return;
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        _count: {
          select: { zones: true, rooms: true, employees: true, services: true },
        },
      },
    });

    if (!store) {
      res.status(404).json({ code: 404, message: '门店不存在' });
      return;
    }

    res.json({ code: 0, data: store });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取门店信息失败' });
  }
});

// 更新门店信息（仅管理员）
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const storeId = Number(req.params.id);
    if (req.user!.storeId !== storeId) {
      res.status(403).json({ code: 403, message: '无权操作该门店' });
      return;
    }

    const { name, address, phone, businessHours } = req.body;
    const store = await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(businessHours !== undefined && { businessHours }),
      },
    });

    res.json({ code: 0, data: store });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '更新门店信息失败' });
  }
});

export default router;
