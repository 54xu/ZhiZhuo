/**
 * 服务分类 + 服务项目管理路由
 *
 * 分类：
 * GET    /api/v1/services/categories          分类列表
 * POST   /api/v1/services/categories          新建分类
 * PUT    /api/v1/services/categories/:id      更新分类
 * DELETE /api/v1/services/categories/:id      删除分类
 *
 * 服务项目：
 * GET    /api/v1/services                     列表（支持分类筛选）
 * POST   /api/v1/services                     新建
 * PUT    /api/v1/services/:id                 更新
 * DELETE /api/v1/services/:id                 删除（软删除）
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// ============ 服务分类 ============

// 分类列表
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { storeId: req.user!.storeId, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { services: true } },
      },
    });
    res.json({ code: 0, data: categories });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建分类
router.post('/categories', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, sortOrder } = req.body;
    if (!name) {
      res.status(400).json({ code: 400, message: '分类名称不能为空' });
      return;
    }

    const category = await prisma.serviceCategory.create({
      data: {
        storeId: req.user!.storeId,
        name,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json({ code: 0, data: category });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新分类
router.put('/categories/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, sortOrder, status } = req.body;

    const existing = await prisma.serviceCategory.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '分类不存在' });
      return;
    }

    const category = await prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: category });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除分类（软删除）
router.delete('/categories/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.serviceCategory.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '分类不存在' });
      return;
    }

    const serviceCount = await prisma.service.count({
      where: { categoryId: id, status: 'active' },
    });
    if (serviceCount > 0) {
      res.status(400).json({ code: 400, message: '该分类下仍有服务项目，请先删除或移动' });
      return;
    }

    await prisma.serviceCategory.update({
      where: { id },
      data: { status: 'inactive' },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ============ 服务项目 ============

// 服务列表（支持分类筛选）
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.query;
    const where: any = { storeId: req.user!.storeId, status: 'active' };
    if (categoryId) where.categoryId = Number(categoryId);

    const services = await prisma.service.findMany({
      where,
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
      },
    });
    res.json({ code: 0, data: services });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建服务
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { categoryId, name, duration, price, memberPrice, description, sortOrder } = req.body;
    if (!categoryId || !name || duration === undefined || price === undefined) {
      res.status(400).json({ code: 400, message: '分类、名称、时长、价格为必填项' });
      return;
    }

    // 验证分类归属
    const category = await prisma.serviceCategory.findFirst({
      where: { id: categoryId, storeId: req.user!.storeId, status: 'active' },
    });
    if (!category) {
      res.status(400).json({ code: 400, message: '服务分类不存在' });
      return;
    }

    const service = await prisma.service.create({
      data: {
        storeId: req.user!.storeId,
        categoryId,
        name,
        duration,
        price,
        memberPrice: memberPrice ?? null,
        description: description ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.json({ code: 0, data: service });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新服务
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { categoryId, name, duration, price, memberPrice, description, sortOrder, status } = req.body;

    const existing = await prisma.service.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '服务不存在' });
      return;
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(name !== undefined && { name }),
        ...(duration !== undefined && { duration }),
        ...(price !== undefined && { price }),
        ...(memberPrice !== undefined && { memberPrice }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: service });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除服务（软删除）
router.delete('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.service.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '服务不存在' });
      return;
    }

    await prisma.service.update({
      where: { id },
      data: { status: 'inactive' },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
