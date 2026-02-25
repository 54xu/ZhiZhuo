/**
 * 微信支付服务 - WeChat Pay API v3 集成
 *
 * 功能：
 * - JSAPI 下单（小程序支付）
 * - 支付回调通知验签 + 解密
 * - 申请退款
 *
 * 开发模式（NODE_ENV=development 且 WX_MCH_ID 为空）返回 mock 数据，
 * 无需真实微信支付凭证即可走通流程。
 */

import crypto from 'crypto';
import fs from 'fs';
import https from 'https';

// ==================== 类型定义 ====================

export interface CreateJSAPIPaymentParams {
  /** 商品描述 */
  description: string;
  /** 订单总金额（单位：分） */
  totalAmountCents: number;
  /** 付款人 openid */
  openid: string;
  /** 可选：自定义商户订单号，不传则自动生成 */
  outTradeNo?: string;
  /** 附加数据，回调时原样返回 */
  attach?: string;
}

export interface JSAPIPaymentResult {
  /** 微信预支付交易会话标识 */
  prepayId: string;
  /** 商户订单号 */
  outTradeNo: string;
  /** wx.requestPayment 所需参数 */
  paymentParams: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'RSA';
    paySign: string;
  };
}

export interface NotifyResult {
  /** 商户订单号 */
  outTradeNo: string;
  /** 微信支付订单号 */
  transactionId: string;
  /** 交易状态：SUCCESS / REFUND / NOTPAY / CLOSED / PAYERROR */
  tradeState: string;
  /** 交易状态描述 */
  tradeStateDesc: string;
  /** 付款人 openid */
  payerOpenid: string;
  /** 订单总金额（分） */
  totalAmountCents: number;
  /** 实际支付金额（分） */
  payerAmountCents: number;
  /** 支付完成时间 */
  successTime?: string;
  /** 附加数据 */
  attach?: string;
}

export interface CreateRefundParams {
  /** 微信支付订单号（与 outTradeNo 二选一） */
  transactionId?: string;
  /** 商户订单号（与 transactionId 二选一） */
  outTradeNo?: string;
  /** 商户退款单号 */
  outRefundNo: string;
  /** 退款原因 */
  reason?: string;
  /** 退款金额（分） */
  refundAmountCents: number;
  /** 原订单总金额（分） */
  totalAmountCents: number;
}

export interface RefundResult {
  refundId: string;
  outRefundNo: string;
  transactionId: string;
  outTradeNo: string;
  status: string;
}

// ==================== 服务实现 ====================

export class WechatPayService {
  private appId: string;
  private mchId: string;
  private apiKey: string; // v3 API 密钥（用于解密通知）
  private certPath: string;
  private keyPath: string;
  private notifyUrl: string;
  private isDev: boolean;
  private privateKey: string | null = null;

  constructor() {
    this.appId = process.env.WX_APPID || '';
    this.mchId = process.env.WX_MCH_ID || '';
    this.apiKey = process.env.WX_PAY_API_KEY || '';
    this.certPath = process.env.WX_PAY_CERT_PATH || '';
    this.keyPath = process.env.WX_PAY_KEY_PATH || '';
    this.notifyUrl = process.env.WX_PAY_NOTIFY_URL || '';

    // 开发模式判断：NODE_ENV=development 且 WX_MCH_ID 为空
    this.isDev = process.env.NODE_ENV === 'development' && !this.mchId;

    if (this.isDev) {
      console.log('[WechatPay] 开发模式 - 使用 mock 数据');
    }
  }

  // ==================== 公开方法 ====================

  /**
   * JSAPI 下单 - 用于小程序支付
   * 调用微信统一下单接口，返回 wx.requestPayment 所需全部参数
   */
  async createJSAPIPayment(params: CreateJSAPIPaymentParams): Promise<JSAPIPaymentResult> {
    const outTradeNo = params.outTradeNo || this.generateOutTradeNo();

    // 开发模式返回 mock 数据
    if (this.isDev) {
      return this.mockCreatePayment(outTradeNo);
    }

    const url = '/v3/pay/transactions/jsapi';
    const body = {
      appid: this.appId,
      mchid: this.mchId,
      description: params.description,
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      amount: {
        total: params.totalAmountCents,
        currency: 'CNY',
      },
      payer: {
        openid: params.openid,
      },
      ...(params.attach ? { attach: params.attach } : {}),
    };

    const response = await this.requestWechatAPI('POST', url, body);

    if (!response.prepay_id) {
      throw new Error(`微信下单失败: ${JSON.stringify(response)}`);
    }

    const paymentParams = this.buildRequestPaymentParams(response.prepay_id);

    return {
      prepayId: response.prepay_id,
      outTradeNo,
      paymentParams,
    };
  }

  /**
   * 处理支付回调通知
   * 验签 + 解密通知体，返回解析后的支付结果
   */
  handleNotify(headers: Record<string, string>, rawBody: string): NotifyResult {
    // 开发模式跳过验签
    if (this.isDev) {
      const body = JSON.parse(rawBody);
      // 如果是 mock 格式直接返回
      if (body.out_trade_no) {
        return {
          outTradeNo: body.out_trade_no,
          transactionId: body.transaction_id || `mock_txn_${Date.now()}`,
          tradeState: body.trade_state || 'SUCCESS',
          tradeStateDesc: body.trade_state_desc || '支付成功',
          payerOpenid: body.payer?.openid || 'mock_openid',
          totalAmountCents: body.amount?.total || 0,
          payerAmountCents: body.amount?.payer_total || body.amount?.total || 0,
          successTime: body.success_time,
          attach: body.attach,
        };
      }
    }

    // 1. 解析通知体
    const body = JSON.parse(rawBody);
    const { resource } = body;

    if (!resource || !resource.ciphertext || !resource.nonce || !resource.associated_data) {
      throw new Error('通知数据格式不正确');
    }

    // 2. AEAD_AES_256_GCM 解密
    const decrypted = this.decryptNotification(
      resource.ciphertext,
      resource.nonce,
      resource.associated_data,
    );

    const result = JSON.parse(decrypted);

    // 3. 构造标准返回
    return {
      outTradeNo: result.out_trade_no,
      transactionId: result.transaction_id,
      tradeState: result.trade_state,
      tradeStateDesc: result.trade_state_desc || '',
      payerOpenid: result.payer?.openid || '',
      totalAmountCents: result.amount?.total || 0,
      payerAmountCents: result.amount?.payer_total || result.amount?.total || 0,
      successTime: result.success_time,
      attach: result.attach,
    };
  }

  /**
   * 申请退款
   */
  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    // 开发模式返回 mock
    if (this.isDev) {
      return this.mockCreateRefund(params);
    }

    const url = '/v3/refund/domestic/refunds';
    const body: Record<string, any> = {
      out_refund_no: params.outRefundNo,
      amount: {
        refund: params.refundAmountCents,
        total: params.totalAmountCents,
        currency: 'CNY',
      },
    };

    if (params.transactionId) {
      body.transaction_id = params.transactionId;
    } else if (params.outTradeNo) {
      body.out_trade_no = params.outTradeNo;
    } else {
      throw new Error('退款需提供 transactionId 或 outTradeNo');
    }

    if (params.reason) {
      body.reason = params.reason;
    }

    const response = await this.requestWechatAPI('POST', url, body);

    if (!response.refund_id) {
      throw new Error(`微信退款失败: ${JSON.stringify(response)}`);
    }

    return {
      refundId: response.refund_id,
      outRefundNo: response.out_refund_no,
      transactionId: response.transaction_id,
      outTradeNo: response.out_trade_no,
      status: response.status,
    };
  }

  // ==================== 辅助方法 ====================

  /** 生成商户订单号：ZZP + 时间戳 + 6位随机 */
  private generateOutTradeNo(): string {
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    return `ZZP${ts}${rand}`;
  }

  /** 生成随机字符串 */
  private generateNonce(length = 32): string {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  /**
   * SHA256withRSA 签名
   * 签名串格式：HTTP方法\n请求URL\n时间戳\n随机串\n请求体\n
   */
  private generateSignature(
    method: string,
    url: string,
    timestamp: string,
    nonce: string,
    body: string,
  ): string {
    const signStr = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
    const privateKey = this.getPrivateKey();
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    return sign.sign(privateKey, 'base64');
  }

  /**
   * AEAD_AES_256_GCM 解密微信通知
   * @param ciphertext Base64 编码的密文
   * @param nonce 通知中的 nonce
   * @param associatedData 通知中的 associated_data
   */
  private decryptNotification(ciphertext: string, nonce: string, associatedData: string): string {
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64');

    // GCM 的 auth tag 为最后 16 字节
    const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - 16);
    const encryptedData = ciphertextBuffer.subarray(0, ciphertextBuffer.length - 16);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.apiKey, 'utf8'), // v3 API 密钥作为解密 key
      Buffer.from(nonce, 'utf8'),
    );
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(associatedData, 'utf8'));

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * 构建 wx.requestPayment 参数
   * 签名串：appId\n时间戳\n随机串\nprepay_id=xxx\n
   */
  private buildRequestPaymentParams(prepayId: string): JSAPIPaymentResult['paymentParams'] {
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = this.generateNonce();
    const packageStr = `prepay_id=${prepayId}`;

    // 小程序签名使用的签名串与 API 请求签名格式不同
    const signStr = `${this.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
    const privateKey = this.getPrivateKey();
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const paySign = sign.sign(privateKey, 'base64');

    return {
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign,
    };
  }

  /** 读取商户私钥（懒加载 + 缓存） */
  private getPrivateKey(): string {
    if (!this.privateKey) {
      if (!this.keyPath) {
        throw new Error('未配置 WX_PAY_KEY_PATH（商户私钥路径）');
      }
      this.privateKey = fs.readFileSync(this.keyPath, 'utf8');
    }
    return this.privateKey;
  }

  /**
   * 向微信支付 API 发送请求
   * 自动添加 Authorization 头（SHA256-RSA 签名）
   */
  private requestWechatAPI(method: string, urlPath: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(body);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = this.generateNonce();
      const signature = this.generateSignature(method, urlPath, timestamp, nonce, bodyStr);

      const serialNo = this.getCertSerialNo();
      const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;

      const options: https.RequestOptions = {
        hostname: 'api.mch.weixin.qq.com',
        port: 443,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
          'User-Agent': 'ZhiZhuo-POS-Server/1.0',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`微信API请求失败 [${res.statusCode}]: ${JSON.stringify(parsed)}`));
            }
          } catch {
            reject(new Error(`微信API响应解析失败: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`微信API网络请求失败: ${err.message}`));
      });

      req.write(bodyStr);
      req.end();
    });
  }

  /** 获取商户证书序列号（从证书文件中读取） */
  private getCertSerialNo(): string {
    if (!this.certPath) {
      throw new Error('未配置 WX_PAY_CERT_PATH（商户证书路径）');
    }
    const certPem = fs.readFileSync(this.certPath, 'utf8');
    const cert = new crypto.X509Certificate(certPem);
    // X509Certificate.serialNumber 返回冒号分隔的十六进制，需去掉冒号
    return cert.serialNumber.replace(/:/g, '').toUpperCase();
  }

  // ==================== Mock 方法（开发模式） ====================

  private mockCreatePayment(outTradeNo: string): JSAPIPaymentResult {
    const prepayId = `mock_prepay_${Date.now()}`;
    console.log(`[WechatPay][Mock] 创建支付 outTradeNo=${outTradeNo} prepayId=${prepayId}`);

    return {
      prepayId,
      outTradeNo,
      paymentParams: {
        timeStamp: String(Math.floor(Date.now() / 1000)),
        nonceStr: this.generateNonce(),
        package: `prepay_id=${prepayId}`,
        signType: 'RSA',
        paySign: 'mock_pay_sign_for_development',
      },
    };
  }

  private mockCreateRefund(params: CreateRefundParams): RefundResult {
    console.log(`[WechatPay][Mock] 创建退款 outRefundNo=${params.outRefundNo}`);

    return {
      refundId: `mock_refund_${Date.now()}`,
      outRefundNo: params.outRefundNo,
      transactionId: params.transactionId || `mock_txn_${Date.now()}`,
      outTradeNo: params.outTradeNo || '',
      status: 'PROCESSING',
    };
  }
}

// 单例导出
export const wechatPayService = new WechatPayService();
