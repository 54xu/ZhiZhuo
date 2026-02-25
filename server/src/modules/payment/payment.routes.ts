/**
 * 支付路由
 *
 * POST /api/v1/payment/wechat/create  - 创建微信支付（需登录）
 * POST /api/v1/payment/wechat/notify  - 微信支付回调（无需登录！）
 * POST /api/v1/payment/wechat/refund  - 微信退款（需管理员）
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { wechatPayService } from './wechat-pay.service';
import { prisma } from '../../app';
import { Prisma } from '@prisma/client';

const router = Router();

/**
 * 创建微信支付
 *
 * Body:
 *   orderId?    - 订单 ID（订单支付时传）
 *   rechargeId? - 充值记录 ID（会员充值时传）
 *   openid      - 付款人微信 openid
 *   description? - 商品描述（可选，自动生成）
 */
router.post('/wechat/create', requireAuth, async (req: Request, res: Response) => {
  try {
    const { orderId, rechargeId, openid, description } = req.body;

    if (!openid) {
      res.status(400).json({ code: 400, message: '缺少付款人 openid' });
      return;
    }

    if (!orderId && !rechargeId) {
      res.status(400).json({ code: 400, message: '需要 orderId 或 rechargeId' });
      return;
    }

    let amountCents: number;
    let paymentDescription: string;
    let paymentId: number;

    if (orderId) {
      // ---- 订单支付 ----
      const order = await prisma.order.findFirst({
        where: {
          id: Number(orderId),
          storeId: req.user!.storeId,
          orderStatus: { in: ['pending', 'in_progress'] },
        },
      });
      if (!order) {
        res.status(404).json({ code: 404, message: '订单不存在或已结账' });
        return;
      }

      // 检查是否已存在 pending 的微信支付记录（防止重复创建）
      const existingPayment = await prisma.payment.findFirst({
        where: {
          orderId: order.id,
          paymentType: 'wechat',
          status: 'pending',
        },
      });
      if (existingPayment) {
        res.status(409).json({ code: 409, message: '该订单已有进行中的微信支付，请勿重复发起' });
        return;
      }

      amountCents = Math.round(order.actualAmount.toNumber() * 100);
      paymentDescription = description || `致卓-订单${order.orderNo}`;

      // 创建 pending 状态的支付记录
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentType: 'wechat',
          amount: order.actualAmount,
          status: 'pending',
          operatorId: req.user!.employeeId,
        },
      });
      paymentId = payment.id;

    } else {
      // ---- 充值支付 ----
      const recharge = await prisma.rechargeRecord.findUnique({
        where: { id: Number(rechargeId) },
      });
      if (!recharge) {
        res.status(404).json({ code: 404, message: '充值记录不存在' });
        return;
      }

      // 检查是否已有 pending 支付
      const existingPayment = await prisma.payment.findFirst({
        where: {
          rechargeId: recharge.id,
          paymentType: 'wechat',
          status: 'pending',
        },
      });
      if (existingPayment) {
        res.status(409).json({ code: 409, message: '该充值已有进行中的微信支付，请勿重复发起' });
        return;
      }

      amountCents = Math.round(recharge.payAmount.toNumber() * 100);
      paymentDescription = description || `致卓-会员充值`;

      const payment = await prisma.payment.create({
        data: {
          rechargeId: recharge.id,
          paymentType: 'wechat',
          amount: recharge.payAmount,
          status: 'pending',
          operatorId: req.user!.employeeId,
        },
      });
      paymentId = payment.id;
    }

    if (amountCents <= 0) {
      res.status(400).json({ code: 400, message: '支付金额必须大于0' });
      return;
    }

    // 调用微信支付下单
    const result = await wechatPayService.createJSAPIPayment({
      description: paymentDescription,
      totalAmountCents: amountCents,
      openid,
      // 在 attach 中携带 paymentId，回调时用于定位记录
      attach: JSON.stringify({ paymentId }),
    });

    // 将商户订单号写入支付记录
    await prisma.payment.update({
      where: { id: paymentId },
      data: { wechatTradeNo: result.outTradeNo },
    });

    res.json({
      code: 0,
      data: {
        paymentId,
        outTradeNo: result.outTradeNo,
        ...result.paymentParams,
      },
    });
  } catch (error: any) {
    console.error('[Payment] 创建微信支付失败:', error);
    res.status(500).json({ code: 500, message: error.message || '创建支付失败' });
  }
});

/**
 * 微信支付回调通知
 *
 * 重要：此接口不需要 JWT 认证！
 * 由微信服务器直接调用，需验签确认来源合法性。
 *
 * 处理逻辑：
 * 1. 验签 + 解密
 * 2. 根据 out_trade_no 找到 Payment 记录
 * 3. 幂等处理（已 success 的直接返回成功）
 * 4. 验证金额一致性
 * 5. 更新 Payment 状态
 * 6. 如果是订单支付，更新 Order 状态
 */
router.post('/wechat/notify', async (req: Request, res: Response) => {
  try {
    // 获取原始请求体（需要 raw body 来验签）
    const headers = req.headers as Record<string, string>;
    const rawBody = JSON.stringify(req.body);

    // 验签 + 解密
    const notifyResult = wechatPayService.handleNotify(headers, rawBody);

    const { outTradeNo, transactionId, tradeState, totalAmountCents } = notifyResult;

    // 查找支付记录
    const payment = await prisma.payment.findFirst({
      where: { wechatTradeNo: outTradeNo },
    });

    if (!payment) {
      console.warn(`[Payment] 回调找不到支付记录 outTradeNo=${outTradeNo}`);
      // 仍然返回成功，避免微信重试
      res.json({ code: 'SUCCESS', message: '处理成功' });
      return;
    }

    // 幂等：已成功的支付不再处理（防止重复通知）
    if (payment.status === 'success') {
      res.json({ code: 'SUCCESS', message: '已处理' });
      return;
    }

    // 只处理 pending 状态的支付（防止已 failed/refunded 的被覆盖）
    if (payment.status !== 'pending') {
      console.warn(`[Payment] 支付记录状态异常 id=${payment.id} status=${payment.status}`);
      res.json({ code: 'SUCCESS', message: '已处理' });
      return;
    }

    if (tradeState === 'SUCCESS') {
      // 验证金额一致性（防止篡改）
      const expectedCents = Math.round(payment.amount.toNumber() * 100);
      if (totalAmountCents !== expectedCents) {
        console.error(
          `[Payment] 金额不一致！ paymentId=${payment.id} ` +
          `expected=${expectedCents} actual=${totalAmountCents}`,
        );
        // 标记为异常但仍返回成功给微信
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
        res.json({ code: 'SUCCESS', message: '已处理' });
        return;
      }

      // 使用事务确保原子性
      await prisma.$transaction(async (tx) => {
        // 乐观锁：仅更新 pending 状态的记录（并发安全）
        const updated = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: 'pending',
          },
          data: {
            status: 'success',
            wechatTradeNo: transactionId, // 更新为微信支付订单号
          },
        });

        // 如果没有更新到（被其他并发请求先处理了），直接返回
        if (updated.count === 0) {
          return;
        }

        // 如果是订单支付，更新订单状态
        if (payment.orderId) {
          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
          });

          if (order && ['pending', 'in_progress'].includes(order.orderStatus)) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                orderStatus: 'completed',
                endTime: new Date(),
              },
            });

            // 释放房台
            await tx.room.update({
              where: { id: order.roomId },
              data: { currentStatus: 'pending_clean' },
            });
          }
        }

        // 如果是充值支付，更新充值记录的微信订单号
        if (payment.rechargeId) {
          await tx.rechargeRecord.update({
            where: { id: payment.rechargeId },
            data: { wechatTradeNo: transactionId },
          });
        }
      });
    } else if (['CLOSED', 'PAYERROR', 'NOTPAY'].includes(tradeState)) {
      // 支付失败/关闭
      await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: 'pending',
        },
        data: { status: 'failed' },
      });
    }
    // 其他状态（如 REFUND、REVOKED）暂不处理

    // 返回成功响应给微信（必须返回此格式，否则微信会重试）
    res.json({ code: 'SUCCESS', message: '处理成功' });
  } catch (error: any) {
    console.error('[Payment] 处理微信回调异常:', error);
    // 返回失败让微信重试
    res.status(500).json({ code: 'FAIL', message: error.message || '处理失败' });
  }
});

/**
 * 微信退款
 *
 * Body:
 *   orderId - 要退款的订单 ID
 *   reason? - 退款原因
 *
 * 需要管理员权限
 */
router.post('/wechat/refund', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId) {
      res.status(400).json({ code: 400, message: '缺少 orderId' });
      return;
    }

    // 查找订单及其成功的微信支付记录
    const order = await prisma.order.findFirst({
      where: {
        id: Number(orderId),
        storeId: req.user!.storeId,
      },
      include: {
        payments: {
          where: {
            paymentType: 'wechat',
            status: 'success',
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({ code: 404, message: '订单不存在' });
      return;
    }

    if (!order.payments || order.payments.length === 0) {
      res.status(400).json({ code: 400, message: '该订单无成功的微信支付记录' });
      return;
    }

    // 取第一笔成功的微信支付（通常只有一笔）
    const payment = order.payments[0];

    if (!payment.wechatTradeNo) {
      res.status(400).json({ code: 400, message: '微信支付订单号缺失，无法退款' });
      return;
    }

    const refundAmountCents = Math.round(payment.amount.toNumber() * 100);
    const totalAmountCents = Math.round(order.actualAmount.toNumber() * 100);

    // 生成退款单号
    const outRefundNo = `ZZR${Date.now()}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    // 调用微信退款接口
    const refundResult = await wechatPayService.createRefund({
      transactionId: payment.wechatTradeNo,
      outRefundNo,
      reason: reason || '商户发起退款',
      refundAmountCents,
      totalAmountCents,
    });

    // 更新支付记录状态
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });

    // 更新订单状态
    await prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'refunded' },
    });

    // 记录操作日志
    await prisma.operationLog.create({
      data: {
        storeId: req.user!.storeId,
        operatorId: req.user!.employeeId,
        action: 'wechat_refund',
        targetType: 'order',
        targetId: order.id,
        detail: JSON.stringify({
          orderNo: order.orderNo,
          refundId: refundResult.refundId,
          outRefundNo,
          amount: payment.amount.toString(),
          reason,
        }),
      },
    });

    res.json({
      code: 0,
      data: {
        refundId: refundResult.refundId,
        outRefundNo: refundResult.outRefundNo,
        status: refundResult.status,
      },
    });
  } catch (error: any) {
    console.error('[Payment] 微信退款失败:', error);
    res.status(500).json({ code: 500, message: error.message || '退款失败' });
  }
});

export default router;
