import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, type Order, type UpdateOrderInput } from '@/db/schema/orders';
import {
  WeChatPayUnifyOrderRequest,
  WeChatPayUnifyOrderResponse,
  WeChatPayRefundRequest,
  WeChatPayRefundResponse,
  WeChatPayError,
  WeChatPayConfig,
  PaymentResult,
  RefundResult,
  WECHAT_PAY_ERROR_MESSAGES,
} from '@/types/auth';

/**
 * 微信支付服务类
 * 负责处理微信支付统一下单、支付结果通知、签名验证、退款等功能
 */
class WeChatPayService {
  private readonly config: WeChatPayConfig;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1秒
  private readonly baseUrl: string = 'https://api.mch.weixin.qq.com';

  constructor() {
    this.config = {
      appId: process.env.WECHAT_APPID!,
      mchId: process.env.WECHAT_MCH_ID!,
      apiKey: process.env.WECHAT_PAY_API_KEY!,
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL!,
      certPath: process.env.WECHAT_PAY_CERT_PATH,
      keyPath: process.env.WECHAT_PAY_KEY_PATH,
    };

    // 验证必要的环境变量
    if (!this.config.appId || !this.config.mchId || !this.config.apiKey || !this.config.notifyUrl) {
      throw new Error('Missing required environment variables for WeChat Pay');
    }
  }

  /**
   * 统一下单API调用
   * @param params 下单参数
   * @returns 下单响应
   */
  async unifyOrder(params: {
    body: string;
    outTradeNo: string;
    totalFee: number;
    clientIp: string;
    openId: string;
    attach?: string;
  }): Promise<{ prepayId: string; paySign: string; timeStamp: string; nonceStr: string }> {
    try {
      const nonceStr = this.generateNonceStr();
      const timeStamp = Math.floor(Date.now() / 1000).toString();

      // 构建请求参数
      const requestData: WeChatPayUnifyOrderRequest = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        nonce_str: nonceStr,
        sign: '', // 待计算
        body: params.body,
        out_trade_no: params.outTradeNo,
        total_fee: params.totalFee,
        spbill_create_ip: params.clientIp,
        notify_url: this.config.notifyUrl,
        trade_type: 'JSAPI',
        openid: params.openId,
      };

      // 计算签名
      requestData.sign = this.generateSign(requestData);

      // 发送请求
      const response = await this.sendRequest('/pay/unifiedorder', requestData);

      if (response.return_code !== 'SUCCESS') {
        throw this.createPayError(
          'UNIFY_ORDER_FAILED',
          `统一下单失败: ${response.return_msg}`,
          response
        );
      }

      if (response.result_code !== 'SUCCESS') {
        const errorMessage = WECHAT_PAY_ERROR_MESSAGES[response.err_code!] || response.err_code_des!;
        throw this.createPayError(
          response.err_code!,
          `统一下单失败: ${errorMessage}`,
          response
        );
      }

      if (!response.prepay_id) {
        throw this.createPayError('INVALID_RESPONSE', '统一下单响应缺少prepay_id');
      }

      // 生成小程序支付签名
      const paySign = this.generateJSAPIPaySign({
        appId: this.config.appId,
        timeStamp,
        nonceStr,
        package: `prepay_id=${response.prepay_id}`,
        signType: 'MD5',
      });

      return {
        prepayId: response.prepay_id,
        paySign,
        timeStamp,
        nonceStr,
      };
    } catch (error) {
      console.error('WeChat Pay unify order failed:', error);
      
      if (error instanceof Error && error.message.includes('PAY_ERROR')) {
        throw error;
      }
      
      throw this.createPayError('UNIFY_ORDER_ERROR', '统一下单异常', error);
    }
  }

  /**
   * 处理支付结果通知
   * @param notificationXml 微信支付通知的XML数据
   * @returns 支付结果
   */
  async handlePaymentNotification(notificationXml: string): Promise<PaymentResult> {
    try {
      // 解析XML数据
      const notification = this.parseXML(notificationXml);

      // 验证签名
      if (!this.verifySign(notification)) {
        throw this.createPayError('INVALID_SIGNATURE', '支付通知签名验证失败');
      }

      // 检查支付结果
      if (notification.return_code !== 'SUCCESS' || notification.result_code !== 'SUCCESS') {
        return {
          success: false,
          outTradeNo: notification.out_trade_no,
          totalFee: parseInt(notification.total_fee),
          error: notification.err_code_des || notification.return_msg || '支付失败',
        };
      }

      // 更新订单状态
      const paidAt = this.parseWeChatTime(notification.time_end);
      await this.updateOrderPaymentStatus(
        notification.out_trade_no,
        notification.transaction_id,
        paidAt
      );

      return {
        success: true,
        transactionId: notification.transaction_id,
        outTradeNo: notification.out_trade_no,
        totalFee: parseInt(notification.total_fee),
        paidAt,
      };
    } catch (error) {
      console.error('Payment notification handling failed:', error);
      
      if (error instanceof Error && error.message.includes('PAY_ERROR')) {
        throw error;
      }
      
      throw this.createPayError('NOTIFICATION_ERROR', '支付通知处理异常', error);
    }
  }

  /**
   * 申请退款
   * @param params 退款参数
   * @returns 退款结果
   */
  async refund(params: {
    transactionId?: string;
    outTradeNo?: string;
    outRefundNo: string;
    totalFee: number;
    refundFee: number;
    refundDesc?: string;
  }): Promise<RefundResult> {
    try {
      const nonceStr = this.generateNonceStr();

      // 构建请求参数
      const requestData: WeChatPayRefundRequest = {
        appid: this.config.appId,
        mch_id: this.config.mchId,
        nonce_str: nonceStr,
        sign: '', // 待计算
        transaction_id: params.transactionId,
        out_trade_no: params.outTradeNo,
        out_refund_no: params.outRefundNo,
        total_fee: params.totalFee,
        refund_fee: params.refundFee,
        refund_desc: params.refundDesc,
      };

      // 计算签名
      requestData.sign = this.generateSign(requestData);

      // 发送请求（退款需要证书）
      const response = await this.sendSecureRequest('/secapi/pay/refund', requestData);

      if (response.return_code !== 'SUCCESS') {
        throw this.createPayError(
          'REFUND_FAILED',
          `退款失败: ${response.return_msg}`,
          response
        );
      }

      if (response.result_code !== 'SUCCESS') {
        const errorMessage = WECHAT_PAY_ERROR_MESSAGES[response.err_code!] || response.err_code_des!;
        throw this.createPayError(
          response.err_code!,
          `退款失败: ${errorMessage}`,
          response
        );
      }

      // 更新订单状态为退款
      if (params.outTradeNo) {
        await this.updateOrderRefundStatus(params.outTradeNo);
      }

      return {
        success: true,
        refundId: response.refund_id!,
        outRefundNo: params.outRefundNo,
        refundFee: params.refundFee,
        refundedAt: new Date(),
      };
    } catch (error) {
      console.error('WeChat Pay refund failed:', error);
      
      if (error instanceof Error && error.message.includes('PAY_ERROR')) {
        throw error;
      }
      
      return {
        success: false,
        outRefundNo: params.outRefundNo,
        refundFee: params.refundFee,
        error: '退款异常',
      };
    }
  }

  /**
   * 生成随机字符串
   * @param length 长度，默认32
   * @returns 随机字符串
   */
  private generateNonceStr(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成签名
   * @param params 参数对象
   * @returns MD5签名
   */
  private generateSign(params: Record<string, unknown>): string {
    // 过滤空值和sign字段
    const filteredParams: Record<string, string> = {};
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '' && key !== 'sign') {
        filteredParams[key] = String(params[key]);
      }
    });

    // 按字典序排序
    const sortedKeys = Object.keys(filteredParams).sort();
    
    // 拼接参数字符串
    let queryString = '';
    sortedKeys.forEach(key => {
      if (queryString) {
        queryString += '&';
      }
      queryString += `${key}=${filteredParams[key]}`;
    });
    
    // 加上API密钥
    queryString += `&key=${this.config.apiKey}`;
    
    // 计算MD5
    return crypto.createHash('md5').update(queryString, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * 生成JSAPI支付签名
   * @param params 支付参数
   * @returns 签名
   */
  private generateJSAPIPaySign(params: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
  }): string {
    const signParams = {
      appId: params.appId,
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
    };

    return this.generateSign(signParams);
  }

  /**
   * 验证签名
   * @param params 参数对象
   * @returns 是否验证成功
   */
  private verifySign(params: Record<string, unknown>): boolean {
    const receivedSign = params.sign as string;
    const calculatedSign = this.generateSign(params);
    
    return receivedSign === calculatedSign;
  }

  /**
   * 发送HTTP请求
   * @param endpoint API端点
   * @param data 请求数据
   * @returns 响应数据
   */
  private async sendRequest(
    endpoint: string,
    data: Record<string, unknown>
  ): Promise<WeChatPayUnifyOrderResponse> {
    const xml = this.buildXML(data);
    const url = `${this.baseUrl}${endpoint}`;

    let lastError: Error | null = null;

    // 重试机制
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'User-Agent': 'WeChatPayService/1.0.0',
          },
          body: xml,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseXml = await response.text();
        return this.parseXML(responseXml) as unknown as WeChatPayUnifyOrderResponse;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries) {
          console.warn(`WeChat Pay API call attempt ${attempt} failed:`, error);
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw this.createPayError(
      'NETWORK_ERROR',
      `网络请求失败，已重试${this.maxRetries}次`,
      lastError
    );
  }

  /**
   * 发送需要证书的安全请求
   * @param endpoint API端点
   * @param data 请求数据
   * @returns 响应数据
   */
  private async sendSecureRequest(
    endpoint: string,
    data: Record<string, unknown>
  ): Promise<WeChatPayRefundResponse> {
    // 注意：实际项目中需要配置SSL证书
    // 这里提供基本的实现框架
    const xml = this.buildXML(data);
    const url = `${this.baseUrl}${endpoint}`;

    try {
      // TODO: 在生产环境中需要配置SSL证书
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'WeChatPayService/1.0.0',
        },
        body: xml,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseXml = await response.text();
      return this.parseXML(responseXml) as unknown as WeChatPayRefundResponse;
    } catch (error) {
      throw this.createPayError('SECURE_REQUEST_ERROR', '安全请求失败', error);
    }
  }

  /**
   * 构建XML数据
   * @param data 数据对象
   * @returns XML字符串
   */
  private buildXML(data: Record<string, unknown>): string {
    let xml = '<xml>';
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== undefined && value !== null && value !== '') {
        xml += `<${key}><![CDATA[${value}]]></${key}>`;
      }
    });
    xml += '</xml>';
    return xml;
  }

  /**
   * 解析XML数据
   * @param xml XML字符串
   * @returns 数据对象
   */
  private parseXML(xml: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    // 简单的XML解析实现
    // 在生产环境中建议使用专业的XML解析库
    const regex = /<([^>]+)><!\[CDATA\[([^\]]+)\]\]><\/\1>/g;
    let match;
    
    while ((match = regex.exec(xml)) !== null) {
      const [, key, value] = match;
      result[key] = value;
    }
    
    // 处理不带CDATA的标签
    const simpleRegex = /<([^>]+)>([^<]+)<\/\1>/g;
    while ((match = simpleRegex.exec(xml)) !== null) {
      const [, key, value] = match;
      if (!result[key]) { // 避免覆盖已有的CDATA值
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * 解析微信时间格式
   * @param timeStr 微信时间字符串 (yyyyMMddHHmmss)
   * @returns Date对象
   */
  private parseWeChatTime(timeStr: string): Date {
    const year = parseInt(timeStr.substring(0, 4));
    const month = parseInt(timeStr.substring(4, 6)) - 1; // 月份从0开始
    const day = parseInt(timeStr.substring(6, 8));
    const hour = parseInt(timeStr.substring(8, 10));
    const minute = parseInt(timeStr.substring(10, 12));
    const second = parseInt(timeStr.substring(12, 14));
    
    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * 更新订单支付状态
   * @param outTradeNo 商户订单号
   * @param transactionId 微信交易号
   * @param paidAt 支付时间
   */
  private async updateOrderPaymentStatus(
    outTradeNo: string,
    transactionId: string,
    paidAt: Date
  ): Promise<void> {
    try {
      const updateData: UpdateOrderInput = {
        status: 'paid',
        paymentMethod: 'wechat_pay',
        transactionId,
        paidAt,
      };

      await db
        .update(orders)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, outTradeNo));
    } catch (error) {
      console.error('Failed to update order payment status:', error);
      throw this.createPayError('DATABASE_ERROR', '更新订单支付状态失败', error);
    }
  }

  /**
   * 更新订单退款状态
   * @param outTradeNo 商户订单号
   */
  private async updateOrderRefundStatus(outTradeNo: string): Promise<void> {
    try {
      const updateData: UpdateOrderInput = {
        status: 'refunded',
      };

      await db
        .update(orders)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, outTradeNo));
    } catch (error) {
      console.error('Failed to update order refund status:', error);
      throw this.createPayError('DATABASE_ERROR', '更新订单退款状态失败', error);
    }
  }

  /**
   * 创建支付错误
   * @param code 错误码
   * @param message 错误消息
   * @param details 错误详情
   * @returns Error with WeChatPayError properties
   */
  private createPayError(code: string, message: string, details?: unknown): Error {
    const payError = new Error(`PAY_ERROR: ${message}`) as Error & WeChatPayError;
    payError.code = code;
    payError.message = message;
    payError.details = details;
    
    return payError;
  }

  /**
   * 延迟执行
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 根据订单ID查询订单
   * @param orderId 订单ID
   * @returns 订单信息
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const orderList = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      return orderList.length > 0 ? orderList[0] : null;
    } catch (error) {
      throw this.createPayError('DATABASE_ERROR', '查询订单信息失败', error);
    }
  }

  /**
   * 检查微信支付配置是否完整
   * @returns 配置是否完整
   */
  isConfigured(): boolean {
    return !!(
      this.config.appId &&
      this.config.mchId &&
      this.config.apiKey &&
      this.config.notifyUrl
    );
  }

  /**
   * 生成商户订单号
   * @param prefix 前缀，默认为'PAY'
   * @returns 商户订单号
   */
  generateOutTradeNo(prefix: string = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * 验证订单金额
   * @param amount 金额（元）
   * @returns 金额（分）
   */
  validateAmount(amount: number): number {
    if (amount <= 0) {
      throw this.createPayError('INVALID_AMOUNT', '订单金额必须大于0');
    }
    
    if (amount > 100000) {
      throw this.createPayError('INVALID_AMOUNT', '订单金额超过限制');
    }

    // 转换为分，四舍五入
    return Math.round(amount * 100);
  }
}

// 创建单例实例
let wechatPayService: WeChatPayService | null = null;

/**
 * 获取微信支付服务实例
 * @returns WeChatPayService实例
 */
export function getWeChatPayService(): WeChatPayService {
  if (!wechatPayService) {
    wechatPayService = new WeChatPayService();
  }
  return wechatPayService;
}

// 导出类型
export type { WeChatPayService };