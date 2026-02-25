/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer Token，解析用户信息注入 req.user
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  employeeId: number;
  storeId: number;
  role: string; // admin / cashier / technician
  name: string;
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'zhizhuo-pos-dev-secret';

/**
 * 生成 JWT Token
 */
export function signToken(payload: JwtPayload, expiresIn: number | string = '7d'): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * 认证中间件 - 必须登录
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 401, message: '未登录或Token已过期' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ code: 401, message: 'Token无效或已过期' });
  }
}

/**
 * 角色权限中间件 - 检查用户角色
 * @param roles 允许的角色列表
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 401, message: '未登录' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ code: 403, message: '无权限执行此操作' });
      return;
    }
    next();
  };
}
