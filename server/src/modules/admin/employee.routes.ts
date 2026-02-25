/**
 * 员工管理路由
 * GET    /api/v1/employees               列表（支持角色筛选）
 * GET    /api/v1/employees/technicians    技师列表（开单用，含技能和排班状态）
 * GET    /api/v1/employees/:id            详情
 * POST   /api/v1/employees               新建
 * PUT    /api/v1/employees/:id            更新
 * DELETE /api/v1/employees/:id            删除（软删除）
 * PUT    /api/v1/employees/:id/unbind-wx  解绑微信
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// 员工列表
router.get('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { role, status } = req.query;
    const where: any = { storeId: req.user!.storeId };
    if (role) where.role = role;
    if (status) where.status = status;
    else where.status = 'active';

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        phone: true,
        role: true,
        status: true,
        skills: true,
        hireDate: true,
        wxOpenid: false, // 不暴露 openid
        createdAt: true,
      },
    });

    // 解析 skills JSON
    const result = employees.map((e: typeof employees[number]) => ({
      ...e,
      skills: e.skills ? JSON.parse(e.skills) : [],
      hasWxBind: false, // 不暴露具体 openid，只告知是否绑定
    }));

    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 技师列表（开单页使用，含今日排班状态）
router.get('/technicians', requireAuth, async (req: Request, res: Response) => {
  try {
    const storeId = req.user!.storeId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const technicians = await prisma.employee.findMany({
      where: {
        storeId,
        role: 'technician',
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        skills: true,
        schedules: {
          where: { scheduleDate: today },
          select: {
            status: true,
            rotationOrder: true,
            shiftStart: true,
            shiftEnd: true,
          },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = technicians.map((t: typeof technicians[number]) => {
      const schedule = t.schedules[0];
      return {
        id: t.id,
        name: t.name,
        employeeNo: t.employeeNo,
        skills: t.skills ? JSON.parse(t.skills) : [],
        isOnDuty: !!schedule && schedule.status !== 'leave',
        rotationOrder: schedule?.rotationOrder ?? 999,
        shiftTime: schedule ? `${schedule.shiftStart}-${schedule.shiftEnd}` : null,
      };
    });

    // 按轮牌顺序排序
    result.sort((a: typeof result[number], b: typeof result[number]) => a.rotationOrder - b.rotationOrder);

    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 员工详情
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    // 技师只能查看自己
    if (req.user!.role === 'technician' && req.user!.employeeId !== id) {
      res.status(403).json({ code: 403, message: '无权查看其他员工信息' });
      return;
    }

    const employee = await prisma.employee.findFirst({
      where: { id, storeId: req.user!.storeId },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        phone: true,
        role: true,
        status: true,
        skills: true,
        hireDate: true,
        createdAt: true,
      },
    });

    if (!employee) {
      res.status(404).json({ code: 404, message: '员工不存在' });
      return;
    }

    res.json({
      code: 0,
      data: {
        ...employee,
        skills: employee.skills ? JSON.parse(employee.skills) : [],
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 新建员工
router.post('/', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, employeeNo, phone, role, skills, hireDate } = req.body;
    if (!name || !employeeNo || !phone || !role) {
      res.status(400).json({ code: 400, message: '姓名、工号、手机号、角色为必填项' });
      return;
    }

    const validRoles = ['admin', 'cashier', 'technician'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ code: 400, message: '角色无效，可选: admin/cashier/technician' });
      return;
    }

    // 检查工号唯一
    const existing = await prisma.employee.findFirst({
      where: { storeId: req.user!.storeId, employeeNo },
    });
    if (existing) {
      res.status(400).json({ code: 400, message: '工号已存在' });
      return;
    }

    const employee = await prisma.employee.create({
      data: {
        storeId: req.user!.storeId,
        name,
        employeeNo,
        phone,
        role,
        skills: skills ? JSON.stringify(skills) : null,
        hireDate: hireDate ? new Date(hireDate) : null,
      },
    });
    res.json({ code: 0, data: employee });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新员工
router.put('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, role, skills, hireDate, status } = req.body;

    const existing = await prisma.employee.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '员工不存在' });
      return;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role }),
        ...(skills !== undefined && { skills: JSON.stringify(skills) }),
        ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ code: 0, data: employee });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除员工（软删除）
router.delete('/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.employee.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '员工不存在' });
      return;
    }

    await prisma.employee.update({
      where: { id },
      data: { status: 'inactive', wxOpenid: null },
    });
    res.json({ code: 0, message: '删除成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 解绑微信
router.put('/:id/unbind-wx', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.employee.findFirst({
      where: { id, storeId: req.user!.storeId },
    });
    if (!existing) {
      res.status(404).json({ code: 404, message: '员工不存在' });
      return;
    }

    await prisma.employee.update({
      where: { id },
      data: { wxOpenid: null },
    });
    res.json({ code: 0, message: '解绑成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
