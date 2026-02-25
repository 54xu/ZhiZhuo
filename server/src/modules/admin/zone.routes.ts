/**
 * 区域管理路由
 * GET    /api/v1/zones           列表
 * POST   /api/v1/zones           新建
 * PUT    /api/v1/zones/:id       更新
 * DELETE /api/v1/zones/:id       删除（软删除）
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// 获取区域列表（含房间数量）
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const zones = await prisma.zone.findMany({
      where: { storeId: req.user!.storeId, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { rooms: true } },
      },
    });
    res.json({ code: 0, data: zones });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建区域
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name) {
      res.status(400).json({ code: 400, message: '区域名称不能为空' });
      return;
    }

    const zone = await prisma.zone.create({
      data: {
        storeId: req.user!.storeId,
        name,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json({ code: 0, data: zone });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新区域
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, sortOrder, status } = req.body;

    // 权限校验：只能操作自己门店的数据
    const existing = await prisma.zone.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '区域不存在' });
      return;
    }

    const zone = await prisma.zone.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: zone });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除区域（软删除）
router.delete('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.zone.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '区域不存在' });
      return;
    }

    // 检查是否有房间
    const roomCount = await prisma.room.count({
      where: { zoneId: id, status: 'active' },
    });
    if (roomCount > 0) {
      res.status(400).json({ code: 400, message: '该区域下仍有房台，请先删除或移动' });
      return;
    }

    await prisma.zone.update({
      where: { id },
      data: { status: 'inactive' },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
