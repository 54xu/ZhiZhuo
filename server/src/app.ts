/**
 * 致卓收银 - 后端应用入口
 *
 * 初始化顺序：
 * 1. 环境变量加载
 * 2. 数据库连接（Prisma）
 * 3. 扩展基础设施初始化（EventBus, HookRegistry, FeatureFlag）
 * 4. V1 核心模块路由注册
 * 5. V2/V3 扩展模块动态加载
 * 6. 启动 HTTP 服务
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import { featureFlagService } from './core/feature-flag.service';
import { eventBus } from './core/event-bus';
import { hookRegistry } from './core/hook-registry';
import { CommissionService } from './modules/commission/commission.service';

// V1 模块路由
import authRoutes from './modules/auth/auth.routes';
import storeRoutes from './modules/admin/store.routes';
import zoneRoutes from './modules/admin/zone.routes';
import roomRoutes from './modules/admin/room.routes';
import serviceRoutes from './modules/admin/service.routes';
import employeeRoutes from './modules/admin/employee.routes';
import rechargePlanRoutes from './modules/admin/recharge-plan.routes';
import commissionRuleRoutes from './modules/admin/commission-rule.routes';
import orderRoutes from './modules/cashier/cashier.routes';
import memberRoutes from './modules/member/member.routes';
import scheduleRoutes from './modules/schedule/schedule.routes';
import commissionRoutes from './modules/commission/commission.routes';
import reportRoutes from './modules/report/report.routes';
import exportRoutes from './modules/report/export.routes';
import paymentRoutes from './modules/payment/payment.routes';

// 加载环境变量
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// ---- 基础中间件 ----
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- 健康检查 ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- 功能开关 API（供前端拉取） ----
app.get('/api/v1/feature-flags', async (req, res) => {
  try {
    const storeId = Number(req.query.storeId);
    if (!storeId) {
      res.status(400).json({ code: 400, message: 'storeId is required' });
      return;
    }
    const flags = await featureFlagService.getAllFlags(storeId);
    res.json({ code: 0, data: flags });
  } catch (error) {
    res.status(500).json({ code: 500, message: '获取功能开关失败' });
  }
});

// ---- V1 核心模块路由 ----
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/zones', zoneRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/recharge-plans', rechargePlanRoutes);
app.use('/api/v1/commission-rules', commissionRuleRoutes);

app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/members', memberRoutes);
app.use('/api/v1/schedules', scheduleRoutes);
app.use('/api/v1/commissions', commissionRoutes);

app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/reports', exportRoutes);

app.use('/api/v1/payment', paymentRoutes);

// ---- 启动服务 ----
async function bootstrap() {
  try {
    // 1. 连接数据库
    await prisma.$connect();
    console.log('[DB] MySQL connected');

    // 2. 初始化功能开关服务
    featureFlagService.init(prisma);
    console.log('[FeatureFlag] Service initialized');

    // 3. EventBus 和 HookRegistry 为纯内存实现，无需额外初始化
    console.log('[EventBus] Ready');
    console.log('[HookRegistry] Ready');

    // 4. 初始化提成事件监听（结账后自动计算提成）
    const commissionService = new CommissionService(prisma);
    commissionService.registerEvents();
    console.log('[Commission] Event listeners registered');

    // 5. TODO: 动态加载 V2/V3 扩展模块
    // loadExtensionModules(prisma);

    // 5. 启动 HTTP 服务
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`[Server] 致卓收银后端服务启动 - http://localhost:${port}`);
    });
  } catch (error) {
    console.error('[Server] 启动失败:', error);
    process.exit(1);
  }
}

bootstrap();

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

export { app, prisma };
