import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '@/db';
import { users, type User, type CreateUserInput, type UpdateUserInput } from '@/db/schema/users';
import { 
  WeChatSession, 
  JWTPayload, 
  AuthError, 
  WECHAT_ERROR_CODES, 
  WECHAT_ERROR_MESSAGES,
  UserRole 
} from '@/types/auth';

/**
 * 微信认证服务类
 * 负责处理微信小程序登录、用户数据同步和JWT token管理
 */
class WeChatAuthService {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1秒

  constructor() {
    this.appId = process.env.WECHAT_APPID!;
    this.appSecret = process.env.WECHAT_SECRET!;
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

    // 验证必要的环境变量
    if (!this.appId || !this.appSecret || !this.jwtSecret) {
      throw new Error('Missing required environment variables for WeChat authentication');
    }
  }

  /**
   * 使用微信授权码换取session信息
   * @param code 微信授权码
   * @returns 微信session信息
   */
  async exchangeCodeForSession(code: string): Promise<WeChatSession> {
    if (!code) {
      throw this.createAuthError('INVALID_PARAMETER', '授权码不能为空');
    }

    const url = 'https://api.weixin.qq.com/sns/jscode2session';
    const params = new URLSearchParams({
      appid: this.appId,
      secret: this.appSecret,
      js_code: code,
      grant_type: 'authorization_code'
    });

    let lastError: Error | null = null;
    
    // 重试机制
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${url}?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // 检查微信API返回的错误
        if (data.errcode) {
          const errorMessage = WECHAT_ERROR_MESSAGES[data.errcode] || `微信API错误: ${data.errmsg}`;
          
          // 对于系统繁忙错误，可以重试
          if (data.errcode === WECHAT_ERROR_CODES.SYSTEM_BUSY && attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt);
            continue;
          }
          
          throw this.createAuthError('WECHAT_API_ERROR', errorMessage, {
            errcode: data.errcode,
            errmsg: data.errmsg
          });
        }

        // 验证返回的数据
        if (!data.openid || !data.session_key) {
          throw this.createAuthError('INVALID_RESPONSE', '微信API返回的数据格式无效');
        }

        return {
          openid: data.openid,
          session_key: data.session_key,
          unionid: data.unionid
        };

      } catch (error) {
        lastError = error as Error;
        
        // 如果不是网络错误或系统繁忙，不重试
        if (error instanceof Error && !error.message.includes('fetch')) {
          throw error;
        }
        
        if (attempt < this.maxRetries) {
          console.warn(`WeChat API call attempt ${attempt} failed:`, error);
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw this.createAuthError('NETWORK_ERROR', `网络请求失败，已重试${this.maxRetries}次`, lastError);
  }

  /**
   * 创建或更新用户信息
   * @param wechatSession 微信session信息
   * @param userInfo 用户信息（可选）
   * @returns 用户信息
   */
  async createOrUpdateUser(
    wechatSession: WeChatSession, 
    userInfo?: Partial<CreateUserInput>
  ): Promise<User> {
    try {
      // 查找现有用户
      const existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.openId, wechatSession.openid))
        .limit(1);

      const now = new Date();

      if (existingUsers.length > 0) {
        // 更新现有用户
        const existingUser = existingUsers[0];
        const updateData: UpdateUserInput = {
          lastLoginAt: now,
          ...(userInfo && {
            nickname: userInfo.nickname || existingUser.nickname || undefined,
            avatarUrl: userInfo.avatarUrl || existingUser.avatarUrl || undefined,
            email: userInfo.email || existingUser.email || undefined,
            profession: userInfo.profession || existingUser.profession || undefined,
            phone: userInfo.phone || existingUser.phone || undefined,
          })
        };

        const updatedUsers = await db
          .update(users)
          .set({
            ...updateData,
            updatedAt: now,
            // 如果有unionId，更新它
            ...(wechatSession.unionid && { unionId: wechatSession.unionid })
          })
          .where(eq(users.openId, wechatSession.openid))
          .returning();

        return updatedUsers[0];
      } else {
        // 创建新用户
        const createData: CreateUserInput = {
          openId: wechatSession.openid,
          unionId: wechatSession.unionid,
          nickname: userInfo?.nickname,
          avatarUrl: userInfo?.avatarUrl,
          gender: userInfo?.gender,
          city: userInfo?.city,
          province: userInfo?.province,
          country: userInfo?.country,
          language: userInfo?.language,
          email: userInfo?.email,
          profession: userInfo?.profession,
          phone: userInfo?.phone,
          consentAgreedAt: userInfo?.consentAgreedAt,
          consentVersion: userInfo?.consentVersion
        };

        const newUsers = await db
          .insert(users)
          .values(createData)
          .returning();

        return newUsers[0];
      }
    } catch (error) {
      console.error('Database operation failed:', error);
      throw this.createAuthError('DATABASE_ERROR', '数据库操作失败', error);
    }
  }

  /**
   * 生成JWT token
   * @param user 用户信息
   * @returns JWT token
   */
  generateToken(user: User): string {
    try {
      const payload: JWTPayload = {
        userId: user.id,
        role: user.role as UserRole, // 类型转换
        openId: user.openId,
        iss: 'wechat-medical-platform',
        aud: 'wechat-miniprogram'
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (jwt.sign as any)(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    } catch (error) {
      throw this.createAuthError('TOKEN_GENERATION_ERROR', 'JWT token生成失败', error);
    }
  }

  /**
   * 验证JWT token
   * @param token JWT token
   * @returns 解码后的payload
   */
  verifyToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw this.createAuthError('TOKEN_EXPIRED', 'Token已过期');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw this.createAuthError('INVALID_TOKEN', 'Token无效');
      }
      throw this.createAuthError('TOKEN_VERIFICATION_ERROR', 'Token验证失败', error);
    }
  }

  /**
   * 刷新JWT token
   * @param token 当前的JWT token
   * @returns 新的JWT token
   */
  async refreshToken(token: string): Promise<string> {
    try {
      // 验证当前token（允许过期）
      const payload = jwt.decode(token) as JWTPayload;
      if (!payload || !payload.userId) {
        throw this.createAuthError('INVALID_TOKEN', 'Token格式无效');
      }

      // 查找用户
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (userList.length === 0) {
        throw this.createAuthError('USER_NOT_FOUND', '用户不存在');
      }

      const user = userList[0];
      if (!user.isActive) {
        throw this.createAuthError('USER_INACTIVE', '用户已被禁用');
      }

      // 生成新token
      return this.generateToken(user);
    } catch (error) {
      if (error instanceof Error && error.message.includes('AUTH_ERROR')) {
        throw error;
      }
      throw this.createAuthError('TOKEN_REFRESH_ERROR', 'Token刷新失败', error);
    }
  }

  /**
   * 根据用户ID获取用户信息
   * @param userId 用户ID
   * @returns 用户信息
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return userList.length > 0 ? userList[0] : null;
    } catch (error) {
      throw this.createAuthError('DATABASE_ERROR', '查询用户信息失败', error);
    }
  }

  /**
   * 根据openId获取用户信息
   * @param openId 微信openId
   * @returns 用户信息
   */
  async getUserByOpenId(openId: string): Promise<User | null> {
    try {
      const userList = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      return userList.length > 0 ? userList[0] : null;
    } catch (error) {
      throw this.createAuthError('DATABASE_ERROR', '查询用户信息失败', error);
    }
  }

  /**
   * 完整的微信登录流程
   * @param code 微信授权码
   * @param userInfo 用户信息（可选）
   * @returns 登录结果
   */
  async login(code: string, userInfo?: Partial<CreateUserInput>) {
    try {
      // 1. 换取session
      const session = await this.exchangeCodeForSession(code);

      console.log("wechat session", session)
      
      // 2. 创建或更新用户
      const user = await this.createOrUpdateUser(session, userInfo);
      
      // 3. 生成token
      const token = this.generateToken(user);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          nickname: user.nickname || '',
          avatarUrl: user.avatarUrl || '',
          openId: user.openId,
          role: user.role // 添加角色字段
        }
      };
    } catch (error) {
      console.error('WeChat login failed:', error);
      
      if (error instanceof Error && error.message.includes('AUTH_ERROR')) {
        throw error;
      }
      
      throw this.createAuthError('LOGIN_FAILED', '登录失败', error);
    }
  }

  /**
   * 创建认证错误
   * @param code 错误码
   * @param message 错误消息
   * @param details 错误详情
   * @returns Error with AuthError properties
   */
  private createAuthError(code: string, message: string, details?: unknown): Error {
    const authError = new Error(`AUTH_ERROR: ${message}`) as Error & AuthError;
    authError.code = code;
    authError.message = message;
    authError.details = details;
    
    return authError;
  }

  /**
   * 延迟执行
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查微信认证配置是否完整
   * @returns 配置是否完整
   */
  isConfigured(): boolean {
    return !!(this.appId && this.appSecret && this.jwtSecret);
  }
}

// 创建单例实例
let wechatAuthService: WeChatAuthService | null = null;

/**
 * 获取微信认证服务实例
 * @returns WeChatAuthService实例
 */
export function getWeChatAuthService(): WeChatAuthService {
  if (!wechatAuthService) {
    wechatAuthService = new WeChatAuthService();
  }
  return wechatAuthService;
}

// 导出类型
export type { WeChatAuthService };