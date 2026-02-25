/**
 * 会员管理路由
 * GET    /api/v1/members                    搜索会员
 * GET    /api/v1/members/recent             最近到访
 * GET    /api/v1/members/:id                详情
 * POST   /api/v1/members                    注册
 * PUT    /api/v1/members/:id                更新
 * POST   /api/v1/members/:id/recharge       充值（金额/次卡）
 * GET    /api/v1/members/:id/orders         消费记录
 * GET    /api/v1/members/:id/recharges      充值记录
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { MemberService } from './member.service';
import { prisma } from '../../app';

const router = Router();

let memberService: MemberService;
function getService(): MemberService {
  if (!memberService) memberService = new MemberService(prisma);
  return memberService;
}

// 搜索会员
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const keyword = (req.query.keyword as string) || '';
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    if (!keyword) {
      // 无关键词时返回最近会员
      const recent = await getService().getRecentMembers(req.user!.storeId, pageSize);
      res.json({ code: 0, data: { list: recent, total: recent.length, page: 1, pageSize } });
      return;
    }

    const result = await getService().search(req.user!.storeId, keyword, page, pageSize);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 最近到访
router.get('/recent', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const list = await getService().getRecentMembers(req.user!.storeId, limit);
    res.json({ code: 0, data: list });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 会员详情
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const member = await getService().getDetail(req.user!.storeId, Number(req.params.id));
    res.json({ code: 0, data: member });
  } catch (error: any) {
    res.status(404).json({ code: 404, message: error.message });
  }
});

// 注册会员
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phone, name, gender, birthday, remark } = req.body;
    if (!phone) {
      res.status(400).json({ code: 400, message: '手机号不能为空' });
      return;
    }
    const member = await getService().register(req.user!.storeId, { phone, name, gender, birthday, remark });
    res.json({ code: 0, data: member });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 更新会员
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, gender, birthday, remark, phone } = req.body;
    const member = await getService().update(
      req.user!.storeId,
      Number(req.params.id),
      { name, gender, birthday, remark, phone },
    );
    res.json({ code: 0, data: member });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 充值
router.post('/:id/recharge', requireAuth, async (req: Request, res: Response) => {
  try {
    const memberId = Number(req.params.id);
    const { planId, paymentMethod, remark } = req.body;

    if (!planId || !paymentMethod) {
      res.status(400).json({ code: 400, message: '充值方案和支付方式不能为空' });
      return;
    }

    // 查询方案类型
    const plan = await prisma.rechargePlan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(400).json({ code: 400, message: '充值方案不存在' });
      return;
    }

    const params = {
      memberId,
      planId,
      paymentMethod,
      operatorId: req.user!.employeeId,
      remark,
    };

    const result = plan.planType === 'visit'
      ? await getService().rechargeVisitCard(req.user!.storeId, params)
      : await getService().rechargeAmount(req.user!.storeId, params);

    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message });
  }
});

// 消费记录
router.get('/:id/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await getService().getConsumeRecords(
      req.user!.storeId, Number(req.params.id), page, pageSize,
    );
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 充值记录
router.get('/:id/recharges', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const result = await getService().getRechargeRecords(
      req.user!.storeId, Number(req.params.id), page, pageSize,
    );
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

export default router;
