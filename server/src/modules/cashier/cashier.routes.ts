/**
 * 收银路由
 * POST   /api/v1/orders                 开单
 * POST   /api/v1/orders/:id/items       加单
 * POST   /api/v1/orders/:id/checkout    结账
 * POST   /api/v1/orders/:id/refund      退款（需管理员）
 * GET    /api/v1/orders/:id             订单详情
 * GET    /api/v1/orders/today           今日客表
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { CashierService } from './cashier.service';
import { prisma } from '../../app';

const router = Router();

let cashierService: CashierService;
function getService(): CashierService {
  if (!cashierService) cashierService = new CashierService(prisma);
  return cashierService;
}

// 开单
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomId, memberId, customerName, customerPhone, items } = req.body;
    if (!roomId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ code: 400, message: '房台和服务项目不能为空' });
      return;
    }

    const order = await getService().createOrder(req.user!.storeId, {
      roomId,
      memberId: memberId || undefined,
      customerName,
      customerPhone,
      cashierId: req.user!.employeeId,
      items,
    });
    res.json({ code: 0, data: order });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 今日客表（注意：必须放在 /:id 之前）
router.get('/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const list = await getService().getTodayCustomers(req.user!.storeId, status);
    res.json({ code: 0, data: list });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 订单详情
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const order = await getService().getOrderDetail(req.user!.storeId, Number(req.params.id));
    res.json({ code: 0, data: order });
  } catch (error: any) {
    res.status(404).json({ code: 404, message: error.message });
  }
});

// 加单
router.post('/:id/items', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ code: 400, message: '服务项目不能为空' });
      return;
    }
    const order = await getService().addOrderItems(
      req.user!.storeId, Number(req.params.id), items,
    );
    res.json({ code: 0, data: order });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 结账
router.post('/:id/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paymentType, payments } = req.body;
    if (!paymentType) {
      res.status(400).json({ code: 400, message: '支付方式不能为空' });
      return;
    }
    const order = await getService().checkout(
      req.user!.storeId,
      Number(req.params.id),
      { paymentType, operatorId: req.user!.employeeId, payments },
    );
    res.json({ code: 0, data: order });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 退款（需管理员权限）
router.post('/:id/refund', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await getService().refund(req.user!.storeId, Number(req.params.id), req.user!.employeeId);
    res.json({ code: 0, message: '退款成功' });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

export default router;
