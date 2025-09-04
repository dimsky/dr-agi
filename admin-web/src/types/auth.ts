// 微信认证相关类型定义

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
  userInfo: WeChatUserInfo;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    nickname: string;
    avatarUrl: string;
    openId: string;
  };
  error?: string;
}

export interface JWTPayload {
  userId: string;
  type: 'wechat_user' | 'admin_user';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: unknown;
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