/**
 * 认证服务
 * 微信登录 code 换取 openid → 查找/绑定员工 → 签发 JWT
 */

import { PrismaClient } from '@prisma/client';
import { signToken, JwtPayload } from '../../middleware/auth.middleware';

// 微信 code2session 返回结构
interface WxSessionResult {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 微信小程序登录
   * 1. wx.login code → 调用微信 API 换取 openid
   * 2. 通过 openid 查找已绑定的员工
   * 3. 找到则签发 JWT；未找到则返回需要绑定的标识
   */
  async wxLogin(code: string): Promise<{
    needBind: boolean;
    token?: string;
    employee?: any;
    openid?: string;
  }> {
    // 换取 openid
    const session = await this.code2Session(code);
    if (!session.openid) {
      throw new Error('微信登录失败：无法获取openid');
    }

    // 查找已绑定该 openid 的员工
    const employee = await this.prisma.employee.findFirst({
      where: {
        wxOpenid: session.openid,
        status: 'active',
      },
      include: {
        store: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      // 未绑定，返回 openid 用于后续绑定
      return { needBind: true, openid: session.openid };
    }

    // 已绑定，签发 Token
    const payload: JwtPayload = {
      employeeId: employee.id,
      storeId: employee.storeId,
      role: employee.role,
      name: employee.name,
    };
    const token = signToken(payload);

    return {
      needBind: false,
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        employeeNo: employee.employeeNo,
        role: employee.role,
        store: employee.store,
      },
    };
  }

  /**
   * 员工绑定微信
   * 使用工号 + 手机号验证身份，绑定 openid
   */
  async bindEmployee(
    openid: string,
    employeeNo: string,
    phone: string,
  ): Promise<{ token: string; employee: any }> {
    // 查找匹配的员工
    const employee = await this.prisma.employee.findFirst({
      where: {
        employeeNo,
        phone,
        status: 'active',
      },
      include: {
        store: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      throw new Error('工号或手机号不匹配，请联系管理员');
    }

    // 检查是否已被其他微信绑定
    if (employee.wxOpenid && employee.wxOpenid !== openid) {
      throw new Error('该员工已绑定其他微信，请联系管理员解绑');
    }

    // 绑定 openid
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { wxOpenid: openid },
    });

    // 签发 Token
    const payload: JwtPayload = {
      employeeId: employee.id,
      storeId: employee.storeId,
      role: employee.role,
      name: employee.name,
    };
    const token = signToken(payload);

    return {
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        employeeNo: employee.employeeNo,
        role: employee.role,
        store: employee.store,
      },
    };
  }

  /**
   * 获取当前用户信息
   */
  async getProfile(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        store: { select: { id: true, name: true, address: true, phone: true, businessHours: true } },
      },
    });

    if (!employee) {
      throw new Error('员工不存在');
    }

    return {
      id: employee.id,
      name: employee.name,
      employeeNo: employee.employeeNo,
      phone: employee.phone,
      role: employee.role,
      skills: employee.skills ? JSON.parse(employee.skills) : [],
      store: employee.store,
    };
  }

  /**
   * 调用微信 code2Session 接口
   */
  private async code2Session(code: string): Promise<WxSessionResult> {
    const appId = process.env.WX_APPID;
    const appSecret = process.env.WX_APP_SECRET;

    if (!appId || !appSecret) {
      // 开发环境 mock：返回基于 code 的伪 openid
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Auth] WX_APPID/WX_APP_SECRET not set, using mock openid');
        return { openid: `mock_openid_${code}`, session_key: 'mock_session_key' };
      }
      throw new Error('微信小程序配置缺失');
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    const response = await fetch(url);
    const data = (await response.json()) as WxSessionResult;

    if (data.errcode) {
      throw new Error(`微信登录失败: ${data.errmsg} (${data.errcode})`);
    }

    return data;
  }
}
