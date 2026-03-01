/**
 * 数据导出服务（Excel）
 * 使用 exceljs 生成各类报表的 Excel 文件
 *
 * 支持报表：
 * - 营收报表（汇总 + 订单明细）
 * - 技师业绩报表
 * - 会员列表
 * - 充值记录
 * - 收银对账
 */

import ExcelJS from 'exceljs';
import { PrismaClient, Prisma } from '@prisma/client';

/** 表头样式：加粗、蓝底白字 */
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};
const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  vertical: 'middle',
  horizontal: 'center',
};

/**
 * 为工作表设置表头样式并自动调整列宽
 */
function styleSheet(sheet: ExcelJS.Worksheet): void {
  // 样式化表头行
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = HEADER_ALIGNMENT;
  });
  headerRow.height = 22;

  // 自动列宽：基于表头文字长度和数据内容
  sheet.columns.forEach((column) => {
    const header = column.header as string | undefined;
    let maxLen = header ? header.length * 2 + 4 : 10; // 中文字符按2倍计

    // 遍历数据行计算最大宽度
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头
        const val = cell.value != null ? String(cell.value) : '';
        // 粗略估算：中文字符宽度约为英文字符的2倍
        let len = 0;
        for (const ch of val) {
          len += ch.charCodeAt(0) > 127 ? 2 : 1;
        }
        if (len + 2 > maxLen) maxLen = len + 2;
      });
    }

    column.width = Math.min(Math.max(maxLen, 8), 40);
  });
}

/**
 * 向空的工作表添加"暂无数据"提示行
 */
function addEmptyMessage(sheet: ExcelJS.Worksheet, colCount: number): void {
  const row = sheet.addRow(['暂无数据']);
  sheet.mergeCells(row.number, 1, row.number, colCount);
  row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  row.getCell(1).font = { color: { argb: 'FF999999' }, italic: true };
}

/** 支付方式映射 */
const PAYMENT_TYPE_MAP: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  member_balance: '会员余额',
  visit_card: '次卡',
  combined: '组合支付',
};

function formatPaymentType(type: string): string {
  return PAYMENT_TYPE_MAP[type] || type;
}

/** 日期格式化 */
function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class ExportService {
  constructor(private prisma: PrismaClient) {}

  /** 辅助：构建日期范围 where 条件（用于 DateTime 字段） */
  private dateRange(start: string, end: string) {
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end); e.setHours(23, 59, 59, 999);
    return { gte: s, lte: e };
  }

  /** 辅助：构建日期范围 where 条件（用于 DATE 字段，如 commissionDate） */
  private dateRangeDate(start: string, end: string) {
    return { gte: new Date(start + 'T00:00:00Z'), lte: new Date(end + 'T23:59:59.999Z') };
  }

  // ===================== 营收报表 =====================

  /**
   * 导出营收报表 Excel
   * Sheet 1: 营收汇总（按日）
   * Sheet 2: 订单明细
   */
  async exportRevenue(startDate: string, endDate: string, storeId: number): Promise<Buffer> {
    const range = this.dateRange(startDate, endDate);
    const workbook = new ExcelJS.Workbook();

    // ---------- Sheet 1: 营收汇总 ----------
    const summarySheet = workbook.addWorksheet('营收汇总');
    summarySheet.columns = [
      { header: '日期', key: 'date', width: 14 },
      { header: '订单数', key: 'orderCount', width: 10 },
      { header: '总营收', key: 'totalRevenue', width: 14 },
      { header: '现金', key: 'cash', width: 14 },
      { header: '微信', key: 'wechat', width: 14 },
      { header: '会员余额', key: 'memberBalance', width: 14 },
      { header: '次卡', key: 'visitCard', width: 14 },
    ];

    // 逐日查询汇总数据
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(0, 0, 0, 0);
    let hasData = false;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const dayRange = { gte: dayStart, lte: dayEnd };

      const orderCount = await this.prisma.order.count({
        where: { storeId, orderStatus: 'completed', endTime: dayRange },
      });

      const revenue = await this.prisma.order.aggregate({
        where: { storeId, orderStatus: 'completed', endTime: dayRange },
        _sum: { actualAmount: true },
      });

      // 按支付方式统计
      const payments = await this.prisma.payment.groupBy({
        by: ['paymentType'],
        where: {
          order: { storeId, orderStatus: 'completed', endTime: dayRange },
          status: 'success',
        },
        _sum: { amount: true },
      });

      const payMap: Record<string, string> = {};
      for (const p of payments) {
        payMap[p.paymentType] = (p._sum.amount ?? new Prisma.Decimal(0)).toFixed(2);
      }

      if (orderCount > 0) hasData = true;

      summarySheet.addRow({
        date: formatDate(d),
        orderCount,
        totalRevenue: (revenue._sum.actualAmount ?? new Prisma.Decimal(0)).toFixed(2),
        cash: payMap['cash'] || '0.00',
        wechat: payMap['wechat'] || '0.00',
        memberBalance: payMap['member_balance'] || '0.00',
        visitCard: payMap['visit_card'] || '0.00',
      });
    }

    if (!hasData) {
      addEmptyMessage(summarySheet, 7);
    }

    styleSheet(summarySheet);

    // ---------- Sheet 2: 订单明细 ----------
    const detailSheet = workbook.addWorksheet('订单明细');
    detailSheet.columns = [
      { header: '订单号', key: 'orderNo', width: 20 },
      { header: '日期时间', key: 'dateTime', width: 20 },
      { header: '房间', key: 'room', width: 14 },
      { header: '客户', key: 'customer', width: 14 },
      { header: '服务项目', key: 'services', width: 25 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '支付方式', key: 'paymentType', width: 14 },
      { header: '收银员', key: 'cashier', width: 12 },
    ];

    const orders = await this.prisma.order.findMany({
      where: { storeId, orderStatus: 'completed', endTime: range },
      include: {
        room: { select: { name: true } },
        member: { select: { name: true, phone: true } },
        cashier: { select: { name: true } },
        orderItems: {
          include: { service: { select: { name: true } } },
        },
        payments: { where: { status: 'success' } },
      },
      orderBy: { endTime: 'asc' },
    });

    if (orders.length === 0) {
      addEmptyMessage(detailSheet, 8);
    } else {
      for (const order of orders) {
        const serviceNames = order.orderItems.map((item) => item.service.name).join('、');
        const paymentTypes = [...new Set(order.payments.map((p) => formatPaymentType(p.paymentType)))].join('、');
        const customerName = order.member
          ? (order.member.name || order.member.phone)
          : (order.customerName || '散客');

        detailSheet.addRow({
          orderNo: order.orderNo,
          dateTime: formatDateTime(order.endTime),
          room: order.room.name,
          customer: customerName,
          services: serviceNames,
          amount: order.actualAmount.toFixed(2),
          paymentType: paymentTypes,
          cashier: order.cashier.name,
        });
      }
    }

    styleSheet(detailSheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===================== 技师业绩报表 =====================

  /**
   * 导出技师业绩报表 Excel
   * Sheet: 技师业绩
   */
  async exportStaffPerformance(startDate: string, endDate: string, storeId: number): Promise<Buffer> {
    const range = this.dateRangeDate(startDate, endDate);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('技师业绩');

    sheet.columns = [
      { header: '排名', key: 'rank', width: 8 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '工号', key: 'employeeNo', width: 12 },
      { header: '服务次数', key: 'serviceCount', width: 10 },
      { header: '服务金额', key: 'serviceAmount', width: 14 },
      { header: '提成金额', key: 'commissionAmount', width: 14 },
    ];

    const records = await this.prisma.commissionRecord.findMany({
      where: { storeId, commissionDate: range, status: 'normal' },
      include: {
        technician: { select: { id: true, name: true, employeeNo: true } },
      },
    });

    // 按技师聚合
    const techMap = new Map<number, {
      technician: { id: number; name: string; employeeNo: string };
      serviceCount: number;
      serviceAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    }>();

    for (const r of records) {
      if (!techMap.has(r.technicianId)) {
        techMap.set(r.technicianId, {
          technician: r.technician,
          serviceCount: 0,
          serviceAmount: new Prisma.Decimal(0),
          commissionAmount: new Prisma.Decimal(0),
        });
      }
      const entry = techMap.get(r.technicianId)!;
      entry.serviceCount += 1;
      entry.serviceAmount = entry.serviceAmount.add(r.serviceAmount);
      entry.commissionAmount = entry.commissionAmount.add(r.commissionAmount);
    }

    const sorted = Array.from(techMap.values())
      .sort((a, b) => parseFloat(b.serviceAmount.toString()) - parseFloat(a.serviceAmount.toString()));

    if (sorted.length === 0) {
      addEmptyMessage(sheet, 6);
    } else {
      sorted.forEach((entry, index) => {
        sheet.addRow({
          rank: index + 1,
          name: entry.technician.name,
          employeeNo: entry.technician.employeeNo,
          serviceCount: entry.serviceCount,
          serviceAmount: entry.serviceAmount.toFixed(2),
          commissionAmount: entry.commissionAmount.toFixed(2),
        });
      });
    }

    styleSheet(sheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===================== 会员列表 =====================

  /**
   * 导出会员列表 Excel
   * Sheet: 会员列表
   */
  async exportMemberList(storeId: number): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('会员列表');

    sheet.columns = [
      { header: '卡号', key: 'cardNo', width: 16 },
      { header: '姓名', key: 'name', width: 12 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '总余额', key: 'balance', width: 14 },
      { header: '实充余额', key: 'realBalance', width: 14 },
      { header: '赠送余额', key: 'giftBalance', width: 14 },
      { header: '注册日期', key: 'createdAt', width: 14 },
      { header: '最近到访', key: 'lastVisitAt', width: 14 },
    ];

    const members = await this.prisma.member.findMany({
      where: { storeId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (members.length === 0) {
      addEmptyMessage(sheet, 8);
    } else {
      for (const m of members) {
        sheet.addRow({
          cardNo: m.cardNo,
          name: m.name || '',
          phone: m.phone,
          balance: m.balance.toFixed(2),
          realBalance: m.realBalance.toFixed(2),
          giftBalance: m.giftBalance.toFixed(2),
          createdAt: formatDate(m.createdAt),
          lastVisitAt: formatDate(m.lastVisitAt),
        });
      }
    }

    styleSheet(sheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===================== 充值记录 =====================

  /**
   * 导出充值记录 Excel
   * Sheet: 充值记录
   */
  async exportRechargeRecords(startDate: string, endDate: string, storeId: number): Promise<Buffer> {
    const range = this.dateRange(startDate, endDate);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('充值记录');

    sheet.columns = [
      { header: '日期', key: 'date', width: 20 },
      { header: '会员姓名', key: 'memberName', width: 12 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '方案名称', key: 'planName', width: 20 },
      { header: '实付金额', key: 'payAmount', width: 14 },
      { header: '赠送金额', key: 'giftAmount', width: 14 },
      { header: '支付方式', key: 'paymentMethod', width: 14 },
      { header: '操作员', key: 'operator', width: 12 },
    ];

    const records = await this.prisma.rechargeRecord.findMany({
      where: { storeId, createdAt: range },
      include: {
        member: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 获取方案名称映射（planId → planName）
    const planIds = [...new Set(records.map((r) => r.planId))];
    const plans = planIds.length > 0
      ? await this.prisma.rechargePlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : [];
    const planMap = new Map(plans.map((p) => [p.id, p.name]));

    // 获取操作员名称映射（operatorId → name）
    const operatorIds = [...new Set(records.map((r) => r.operatorId))];
    const operators = operatorIds.length > 0
      ? await this.prisma.employee.findMany({
          where: { id: { in: operatorIds } },
          select: { id: true, name: true },
        })
      : [];
    const operatorMap = new Map(operators.map((o) => [o.id, o.name]));

    if (records.length === 0) {
      addEmptyMessage(sheet, 8);
    } else {
      for (const r of records) {
        sheet.addRow({
          date: formatDateTime(r.createdAt),
          memberName: r.member.name || '',
          phone: r.member.phone,
          planName: planMap.get(r.planId) || `方案#${r.planId}`,
          payAmount: r.payAmount.toFixed(2),
          giftAmount: r.giftAmount.toFixed(2),
          paymentMethod: formatPaymentType(r.paymentMethod),
          operator: operatorMap.get(r.operatorId) || `员工#${r.operatorId}`,
        });
      }
    }

    styleSheet(sheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ===================== 收银对账 =====================

  /**
   * 导出收银对账 Excel
   * Sheet: 收银对账
   */
  async exportReconciliation(date: string, storeId: number): Promise<Buffer> {
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('收银对账');

    sheet.columns = [
      { header: '收银员', key: 'cashier', width: 12 },
      { header: '订单数', key: 'orderCount', width: 10 },
      { header: '现金收款', key: 'cash', width: 14 },
      { header: '微信收款', key: 'wechat', width: 14 },
      { header: '会员余额', key: 'memberBalance', width: 14 },
      { header: '合计', key: 'total', width: 14 },
    ];

    const orders = await this.prisma.order.findMany({
      where: { storeId, orderStatus: 'completed', endTime: { gte: dayStart, lte: dayEnd } },
      include: {
        cashier: { select: { id: true, name: true } },
        payments: { where: { status: 'success' } },
      },
    });

    // 按收银员聚合
    const cashierMap = new Map<number, {
      name: string;
      orderCount: number;
      cash: Prisma.Decimal;
      wechat: Prisma.Decimal;
      memberBalance: Prisma.Decimal;
      total: Prisma.Decimal;
    }>();

    for (const order of orders) {
      if (!cashierMap.has(order.cashierId)) {
        cashierMap.set(order.cashierId, {
          name: order.cashier.name,
          orderCount: 0,
          cash: new Prisma.Decimal(0),
          wechat: new Prisma.Decimal(0),
          memberBalance: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0),
        });
      }
      const entry = cashierMap.get(order.cashierId)!;
      entry.orderCount += 1;

      for (const p of order.payments) {
        const amount = p.amount;
        entry.total = entry.total.add(amount);
        switch (p.paymentType) {
          case 'cash':
            entry.cash = entry.cash.add(amount);
            break;
          case 'wechat':
            entry.wechat = entry.wechat.add(amount);
            break;
          case 'member_balance':
          case 'visit_card':
            entry.memberBalance = entry.memberBalance.add(amount);
            break;
          default:
            // combined 或其他类型归入合计
            break;
        }
      }
    }

    const rows = Array.from(cashierMap.values());

    if (rows.length === 0) {
      addEmptyMessage(sheet, 6);
    } else {
      for (const entry of rows) {
        sheet.addRow({
          cashier: entry.name,
          orderCount: entry.orderCount,
          cash: entry.cash.toFixed(2),
          wechat: entry.wechat.toFixed(2),
          memberBalance: entry.memberBalance.toFixed(2),
          total: entry.total.toFixed(2),
        });
      }

      // 合计行
      const totalRow = sheet.addRow({
        cashier: '合计',
        orderCount: rows.reduce((sum, r) => sum + r.orderCount, 0),
        cash: rows.reduce((sum, r) => sum.add(r.cash), new Prisma.Decimal(0)).toFixed(2),
        wechat: rows.reduce((sum, r) => sum.add(r.wechat), new Prisma.Decimal(0)).toFixed(2),
        memberBalance: rows.reduce((sum, r) => sum.add(r.memberBalance), new Prisma.Decimal(0)).toFixed(2),
        total: rows.reduce((sum, r) => sum.add(r.total), new Prisma.Decimal(0)).toFixed(2),
      });

      totalRow.eachCell((cell) => {
        cell.font = { bold: true };
      });
    }

    styleSheet(sheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
