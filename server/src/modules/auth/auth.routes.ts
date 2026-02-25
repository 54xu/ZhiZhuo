/**
 * 认证路由
 * POST /api/v1/auth/wx-login    微信登录
 * POST /api/v1/auth/bind         员工绑定微信
 * GET  /api/v1/auth/profile      获取当前用户信息
 */

import { Router, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { requireAuth } from '../../middleware/auth.middleware';
import { prisma } from '../../app';

const router = Router();

// 延迟初始化（等待 prisma 就绪）
let authService: AuthService;
function getService(): AuthService {
  if (!authService) authService = new AuthService(prisma);
  return authService;
}

/**
 * 微信小程序登录
 * Body: { code: string }
 */
router.post('/wx-login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ code: 400, message: '缺少微信登录code' });
      return;
    }
    const result = await getService().wxLogin(code);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '登录失败' });
  }
});

/**
 * 员工绑定微信
 * Body: { openid: string, employeeNo: string, phone: string }
 */
router.post('/bind', async (req: Request, res: Response) => {
  try {
    const { openid, employeeNo, phone } = req.body;
    if (!openid || !employeeNo || !phone) {
      res.status(400).json({ code: 400, message: '缺少必填参数' });
      return;
    }
    const result = await getService().bindEmployee(openid, employeeNo, phone);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(400).json({ code: 400, message: error.message || '绑定失败' });
  }
});

/**
 * 获取当前用户信息
 */
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await getService().getProfile(req.user!.employeeId);
    res.json({ code: 0, data: profile });
  } catch (error: any) {
    res.status(500).json({ code: 500, message: error.message || '获取信息失败' });
  }
});

export default router;
