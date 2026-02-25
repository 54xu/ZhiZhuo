/**
 * 房台管理路由
 * GET    /api/v1/rooms            列表（支持区域筛选）
 * GET    /api/v1/rooms/overview   房台总览（按区域分组，含状态）
 * POST   /api/v1/rooms            新建
 * PUT    /api/v1/rooms/:id        更新
 * PUT    /api/v1/rooms/:id/status 更新房台状态
 * DELETE /api/v1/rooms/:id        删除（软删除）
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { eventBus, Events } from '../../core/event-bus';
import { prisma } from '../../app';

const router = Router();

// 房台列表
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { zoneId, status } = req.query;
    const where: any = { storeId: req.user!.storeId };
    if (zoneId) where.zoneId = Number(zoneId);
    if (status) where.currentStatus = status;
    else where.status = 'active';

    const rooms = await prisma.room.findMany({
      where,
      orderBy: [{ zoneId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        zone: { select: { id: true, name: true } },
      },
    });
    res.json({ code: 0, data: rooms });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 房台总览（按区域分组 - 工作台首页使用）
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const storeId = req.user!.storeId;

    const zones = await prisma.zone.findMany({
      where: { storeId, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      include: {
        rooms: {
          where: { status: 'active' },
          orderBy: { sortOrder: 'asc' },
          include: {
            orders: {
              where: { orderStatus: { in: ['pending', 'in_progress'] } },
              select: {
                id: true,
                orderNo: true,
                orderStatus: true,
                startTime: true,
                member: { select: { id: true, name: true, phone: true } },
                orderItems: {
                  select: {
                    service: { select: { name: true, duration: true } },
                    technician: { select: { id: true, name: true } },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    // 统计
    const allRooms = zones.flatMap((z: typeof zones[number]) => z.rooms);
    const stats = {
      total: allRooms.length,
      idle: allRooms.filter((r: typeof allRooms[number]) => r.currentStatus === 'idle').length,
      inUse: allRooms.filter((r: typeof allRooms[number]) => r.currentStatus === 'in_use').length,
      pendingClean: allRooms.filter((r: typeof allRooms[number]) => r.currentStatus === 'pending_clean').length,
    };

    res.json({ code: 0, data: { zones, stats } });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建房台
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { zoneId, name, capacity, sortOrder } = req.body;
    if (!zoneId || !name) {
      res.status(400).json({ code: 400, message: '区域ID和房台名称不能为空' });
      return;
    }

    // 验证区域归属
    const zone = await prisma.zone.findFirst({
      where: { id: zoneId, storeId: req.user!.storeId, status: 'active' },
    });
    if (!zone) {
      res.status(400).json({ code: 400, message: '区域不存在' });
      return;
    }

    const room = await prisma.room.create({
      data: {
        storeId: req.user!.storeId,
        zoneId,
        name,
        capacity: capacity ?? 1,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json({ code: 0, data: room });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新房台信息
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, capacity, sortOrder, zoneId, status } = req.body;

    const existing = await prisma.room.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '房台不存在' });
      return;
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(capacity !== undefined && { capacity }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(zoneId !== undefined && { zoneId }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: room });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新房台状态（收银员可操作）
router.put('/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { currentStatus } = req.body;
    const validStatuses = ['idle', 'in_use', 'pending_clean', 'disabled'];
    if (!validStatuses.includes(currentStatus)) {
      res.status(400).json({ code: 400, message: '无效的状态值' });
      return;
    }

    const existing = await prisma.room.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '房台不存在' });
      return;
    }

    const room = await prisma.room.update({
      where: { id },
      data: { currentStatus },
    });

    // 发布房台状态变更事件
    await eventBus.emit(Events.ROOM_STATUS_CHANGED, {
      roomId: id,
      storeId: req.user!.storeId,
      previousStatus: existing.currentStatus,
      newStatus: currentStatus,
    });

    res.json({ code: 0, data: room });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除房台（软删除）
router.delete('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.room.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '房台不存在' });
      return;
    }

    if (existing.currentStatus === 'in_use') {
      res.status(400).json({ code: 400, message: '该房台正在使用中，无法删除' });
      return;
    }

    await prisma.room.update({
      where: { id },
      data: { status: 'inactive' },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
