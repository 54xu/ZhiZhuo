/**
 * 数据导出路由
 * GET /api/v1/reports/export/revenue              营收报表 Excel 下载
 * GET /api/v1/reports/export/staff-performance     技师业绩 Excel 下载
 * GET /api/v1/reports/export/members               会员列表 Excel 下载
 * GET /api/v1/reports/export/recharge-records      充值记录 Excel 下载
 * GET /api/v1/reports/export/reconciliation        收银对账 Excel 下载
 *
 * 所有接口均需 auth + admin 角色
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { ExportService } from './export.service';
import { prisma } from '../../app';

const router = Router();

let exportService: ExportService;
function getService(): ExportService {
  if (!exportService) exportService = new ExportService(prisma);
  return exportService;
}

/**
 * 设置 Excel 下载响应头
 */
function setExcelHeaders(res: Response, filename: string): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}"`,
  );
}

// ---- 营收报表导出 ----
router.get(
  '/export/revenue',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = (req.query.startDate as string) || today;
      const endDate = (req.query.endDate as string) || today;
      const storeId = req.user!.storeId;

      const buffer = await getService().exportRevenue(startDate, endDate, storeId);

      setExcelHeaders(res, `营收报表-${startDate}-${endDate}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: `导出失败: ${error.message}` });
    }
  },
);

// ---- 技师业绩导出 ----
router.get(
  '/export/staff-performance',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = (req.query.startDate as string) || today;
      const endDate = (req.query.endDate as string) || today;
      const storeId = req.user!.storeId;

      const buffer = await getService().exportStaffPerformance(startDate, endDate, storeId);

      setExcelHeaders(res, `技师业绩-${startDate}-${endDate}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: `导出失败: ${error.message}` });
    }
  },
);

// ---- 会员列表导出 ----
router.get(
  '/export/members',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const storeId = req.user!.storeId;

      const buffer = await getService().exportMemberList(storeId);

      const today = new Date().toISOString().split('T')[0];
      setExcelHeaders(res, `会员列表-${today}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: `导出失败: ${error.message}` });
    }
  },
);

// ---- 充值记录导出 ----
router.get(
  '/export/recharge-records',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startDate = (req.query.startDate as string) || today;
      const endDate = (req.query.endDate as string) || today;
      const storeId = req.user!.storeId;

      const buffer = await getService().exportRechargeRecords(startDate, endDate, storeId);

      setExcelHeaders(res, `充值记录-${startDate}-${endDate}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: `导出失败: ${error.message}` });
    }
  },
);

// ---- 收银对账导出 ----
router.get(
  '/export/reconciliation',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const storeId = req.user!.storeId;

      const buffer = await getService().exportReconciliation(date, storeId);

      setExcelHeaders(res, `收银对账-${date}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ code: 500, message: `导出失败: ${error.message}` });
    }
  },
);

export default router;
