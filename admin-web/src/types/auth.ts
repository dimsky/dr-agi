// 微信认证相关类型定义

// 用户角色枚举
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export interface WeChatUserInfo {
  nickName: string;
  avatarUrl: string;
  gender: number; // 0: 未知, 1: 男性, 2: 女性
  city: string;
  province: string;
  country: string;
  language: string;
}

export interface WeChatSession {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export interface WeChatLoginRequest {
  code: string;
  userInfo?: WeChatUserInfo; // 微信已不再支持直接获取用户信息，改为可选
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    nickname?: string; // 可选，因为微信不再直接提供
    avatarUrl?: string; // 可选，因为微信不再直接提供
    openId: string;
    role: UserRole; // 用户角色
  };
  error?: string;
}

export interface JWTPayload {
  // 通用字段
  role: UserRole; // 用户角色，通过角色区分用户类型
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  
  // 微信用户字段（role === 'user' 时使用）
  userId?: string; // 微信用户的数据库ID
  openId?: string; // 微信用户的 openId
  
  // 管理员字段（role === 'admin' 时使用）
  username?: string; // 管理员用户名
}

export interface AuthError {
  code: string;
  message: string;
  details?: unknown;
}

// 权限相关类型定义
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  openId?: string;
}

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
}

// 权限验证选项
export interface AuthOptions {
  requiredRole?: UserRole;
  allowSelf?: boolean; // 是否允许用户操作自己的资源
  resourceOwnerId?: string; // 资源所有者ID，用于验证用户是否可以操作自己的资源
}

// 微信API错误码
export const WECHAT_ERROR_CODES = {
  INVALID_CODE: 40029,
  CODE_EXPIRED: 40163,
  SYSTEM_BUSY: -1,
  INVALID_APPID: 40013,
  INVALID_SECRET: 40125,
} as const;

// 微信API错误消息映射
export const WECHAT_ERROR_MESSAGES: Record<number, string> = {
  [WECHAT_ERROR_CODES.INVALID_CODE]: '授权码无效',
  [WECHAT_ERROR_CODES.CODE_EXPIRED]: '授权码已过期',
  [WECHAT_ERROR_CODES.SYSTEM_BUSY]: '微信系统繁忙，请稍后重试',
  [WECHAT_ERROR_CODES.INVALID_APPID]: 'AppID无效',
  [WECHAT_ERROR_CODES.INVALID_SECRET]: 'AppSecret无效',
};

// 微信支付相关类型定义

export interface WeChatPayUnifyOrderRequest {
  appid: string;
  mch_id: string;
  nonce_str: string;
  sign: string;
  body: string;
  out_trade_no: string;
  total_fee: number;
  spbill_create_ip: string;
  notify_url: string;
  trade_type: 'JSAPI' | 'NATIVE' | 'APP' | 'MWEB';
  openid?: string; // JSAPI需要
  [key: string]: unknown; // 添加索引签名以支持Record<string, unknown>
}

export interface WeChatPayUnifyOrderResponse {
  return_code: 'SUCCESS' | 'FAIL';
  return_msg: string;
  result_code?: 'SUCCESS' | 'FAIL';
  err_code?: string;
  err_code_des?: string;
  appid?: string;
  mch_id?: string;
  nonce_str?: string;
  sign?: string;
  prepay_id?: string;
  trade_type?: string;
}

export interface WeChatPayNotification {
  appid: string;
  mch_id: string;
  nonce_str: string;
  sign: string;
  result_code: 'SUCCESS' | 'FAIL';
  return_code: 'SUCCESS' | 'FAIL';
  return_msg?: string;
  err_code?: string;
  err_code_des?: string;
  openid?: string;
  is_subscribe?: 'Y' | 'N';
  trade_type: string;
  bank_type: string;
  total_fee: string;
  settlement_total_fee?: string;
  fee_type?: string;
  cash_fee: string;
  cash_fee_type?: string;
  transaction_id: string;
  out_trade_no: string;
  attach?: string;
  time_end: string;
}

export interface WeChatPayRefundRequest {
  appid: string;
  mch_id: string;
  nonce_str: string;
  sign: string;
  transaction_id?: string;
  out_trade_no?: string;
  out_refund_no: string;
  total_fee: number;
  refund_fee: number;
  refund_desc?: string;
  notify_url?: string;
  [key: string]: unknown; // 添加索引签名以支持Record<string, unknown>
}

export interface WeChatPayRefundResponse {
  return_code: 'SUCCESS' | 'FAIL';
  return_msg: string;
  result_code?: 'SUCCESS' | 'FAIL';
  err_code?: string;
  err_code_des?: string;
  appid?: string;
  mch_id?: string;
  nonce_str?: string;
  sign?: string;
  transaction_id?: string;
  out_trade_no?: string;
  out_refund_no?: string;
  refund_id?: string;
  refund_channel?: string;
  refund_fee?: string;
  settlement_refund_fee?: string;
  total_fee?: string;
  settlement_total_fee?: string;
  fee_type?: string;
  cash_fee?: string;
  cash_fee_type?: string;
  cash_refund_fee?: string;
  coupon_refund_fee?: string;
  coupon_refund_count?: string;
}

export interface WeChatPayError {
  code: string;
  message: string;
  details?: unknown;
}

export interface WeChatPayConfig {
  appId: string;
  mchId: string;
  apiKey: string;
  certPath?: string;
  keyPath?: string;
  notifyUrl: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  outTradeNo: string;
  totalFee: number;
  paidAt?: Date;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  outRefundNo: string;
  refundFee: number;
  refundedAt?: Date;
  error?: string;
}

// 微信支付错误码
export const WECHAT_PAY_ERROR_CODES = {
  PARAM_ERROR: 'PARAM_ERROR',
  ORDERPAID: 'ORDERPAID',
  NOAUTH: 'NOAUTH',
  NOTENOUGH: 'NOTENOUGH',
  ORDERCLOSED: 'ORDERCLOSED',
  SYSTEMERROR: 'SYSTEMERROR',
  APPID_NOT_EXIST: 'APPID_NOT_EXIST',
  MCHID_NOT_EXIST: 'MCHID_NOT_EXIST',
  APPID_MCHID_NOT_MATCH: 'APPID_MCHID_NOT_MATCH',
  LACK_PARAMS: 'LACK_PARAMS',
  OUT_TRADE_NO_USED: 'OUT_TRADE_NO_USED',
  SIGNERROR: 'SIGNERROR',
  XML_FORMAT_ERROR: 'XML_FORMAT_ERROR',
  REQUIRE_POST_METHOD: 'REQUIRE_POST_METHOD',
  POST_DATA_EMPTY: 'POST_DATA_EMPTY',
  NOT_UTF8: 'NOT_UTF8',
} as const;

// 微信支付错误消息映射
export const WECHAT_PAY_ERROR_MESSAGES: Record<string, string> = {
  [WECHAT_PAY_ERROR_CODES.PARAM_ERROR]: '参数错误',
  [WECHAT_PAY_ERROR_CODES.ORDERPAID]: '订单已支付',
  [WECHAT_PAY_ERROR_CODES.NOAUTH]: '商户无权限',
  [WECHAT_PAY_ERROR_CODES.NOTENOUGH]: '余额不足',
  [WECHAT_PAY_ERROR_CODES.ORDERCLOSED]: '订单已关闭',
  [WECHAT_PAY_ERROR_CODES.SYSTEMERROR]: '系统错误',
  [WECHAT_PAY_ERROR_CODES.APPID_NOT_EXIST]: 'APPID不存在',
  [WECHAT_PAY_ERROR_CODES.MCHID_NOT_EXIST]: '商户号不存在',
  [WECHAT_PAY_ERROR_CODES.APPID_MCHID_NOT_MATCH]: 'APPID与商户号不匹配',
  [WECHAT_PAY_ERROR_CODES.LACK_PARAMS]: '缺少参数',
  [WECHAT_PAY_ERROR_CODES.OUT_TRADE_NO_USED]: '商户订单号重复',
  [WECHAT_PAY_ERROR_CODES.SIGNERROR]: '签名错误',
  [WECHAT_PAY_ERROR_CODES.XML_FORMAT_ERROR]: 'XML格式错误',
  [WECHAT_PAY_ERROR_CODES.REQUIRE_POST_METHOD]: '请使用POST方法',
  [WECHAT_PAY_ERROR_CODES.POST_DATA_EMPTY]: 'POST数据为空',
  [WECHAT_PAY_ERROR_CODES.NOT_UTF8]: '编码格式错误',
};