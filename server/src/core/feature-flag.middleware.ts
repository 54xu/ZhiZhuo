/**
 * 功能开关路由中间件
 *
 * 用法：router.get('/api/v1/coupons', requireFeature('module.coupon'), couponController.list)
 * 未开启的功能模块返回 403
 */

import { Request, Response, NextFunction } from 'express';
import { featureFlagService } from './feature-flag.service';

/**
 * 从请求中提取 storeId
 * 优先从 JWT payload 中获取，其次从 query 参数
 */
function getStoreId(req: Request): number | null {
  // 从 JWT 解码后挂载的用户信息中获取
  const user = (req as any).user;
  if (user?.storeId) return user.storeId;
  // 从 query 参数获取（备用）
  if (req.query.storeId) return Number(req.query.storeId);
  return null;
}

/**
 * 要求某功能模块已启用的中间件
 */
export function requireFeature(flagKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const storeId = getStoreId(req);
    if (!storeId) {
      res.status(401).json({ code: 401, message: '未能识别门店信息' });
      return;
    }

    const enabled = await featureFlagService.isEnabled(storeId, flagKey);
    if (!enabled) {
      res.status(403).json({
        code: 403,
        message: `功能模块 ${flagKey} 未开启`,
        flagKey,
      });
      return;
    }

    next();
  };
}

/**
 * 将功能开关配置注入到请求中（可选中间件）
 * 使用后可通过 req.featureConfig 获取配置
 */
export function injectFeatureConfig(flagKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const storeId = getStoreId(req);
    if (storeId) {
      const config = await featureFlagService.getConfig(storeId, flagKey);
      (req as any).featureConfig = config;
    }
    next();
  };
}
