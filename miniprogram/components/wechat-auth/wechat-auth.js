/**
 * 微信登录组件
 * 提供一键微信登录功能，包括获取登录code、用户信息和后端API调用
 */

// 配置常量
const CONFIG = {
  // 请求超时时间
  REQUEST_TIMEOUT: 10000,
  // 本地存储键名
  STORAGE_KEYS: {
    TOKEN: 'access_token',
    USER_INFO: 'user_info',
    LOGIN_STATUS: 'login_status'
  }
};

// 获取APP实例和配置
const app = getApp();

Component({
  properties: {
    // 是否显示登录按钮文本
    showButtonText: {
      type: Boolean,
      value: true
    },
    // 自定义按钮样式
    buttonClass: {
      type: String,
      value: ''
    },
    // 是否支持手机号获取
    enablePhoneNumber: {
      type: Boolean,
      value: true
    },
    // 登录模式：'both' | 'phone-first' | 'wechat-only'
    loginMode: {
      type: String,
      value: 'both'
    }
  },

  data: {
    isLoggedIn: false,     // 登录状态
    isLoading: false,      // 加载状态
    loginType: 'normal',   // 'normal' | 'withPhone'
    userInfo: null,        // 用户信息
    authToken: null        // 认证令牌
  },

  lifetimes: {
    /**
     * 组件初始化
     */
    attached() {
      console.log('🔧 微信登录组件初始化');
      this.checkAuthStatus();
    }
  },

  methods: {
    /**
     * 检查登录状态
     * 从本地存储中恢复登录信息
     */
    async checkAuthStatus() {
      try {
        const [token, userInfo, loginStatus] = await Promise.all([
          this.getStorageAsync(CONFIG.STORAGE_KEYS.TOKEN),
          this.getStorageAsync(CONFIG.STORAGE_KEYS.USER_INFO),
          this.getStorageAsync(CONFIG.STORAGE_KEYS.LOGIN_STATUS)
        ]);

        if (token && userInfo && loginStatus) {
          console.log('✅ 发现本地登录信息，恢复登录状态');
          this.setData({
            isLoggedIn: true,
            authToken: token,
            userInfo: userInfo
          });
          
          // 验证token有效性
          this.verifyTokenValid(token);
        } else {
          console.log('ℹ️ 未发现本地登录信息');
        }
      } catch (error) {
        console.error('❌ 检查登录状态失败:', error);
        this.clearAuthData();
      }
    },

    /**
     * 验证token有效性
     */
    async verifyTokenValid(token) {
      try {
        const response = await this.requestAsync({
          url: `${app.globalData.apiBaseUrl}/api/auth/verify`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.data.success) {
          console.log('⚠️ Token已失效，清除登录状态');
          this.clearAuthData();
        }
      } catch (error) {
        console.warn('⚠️ Token验证失败，可能网络问题:', error);
      }
    },

    /**
     * 处理微信登录（普通方式）
     */
    async handleWeChatLogin() {
      if (this.data.isLoading) {
        return;
      }

      this.setData({ 
        isLoading: true,
        loginType: 'normal'
      });

      try {
        console.log('🚀 开始普通微信登录流程...');

        // 第一步：获取微信登录code
        const loginCode = await this.getWeChatLoginCode();
        console.log('✅ 获取微信登录code成功');

        // 第二步：调用后端API完成登录（不包含手机号）
        const loginResult = await this.callLoginAPI(loginCode);
        console.log('✅ 后端登录成功:', loginResult);

        // 第三步：保存登录信息
        await this.saveAuthData(loginResult);
        this.updateLoginState(loginResult);

        // 显示成功提示
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 2000
        });

      } catch (error) {
        console.error('❌ 微信登录失败:', error);
        this.handleLoginError(error);
      } finally {
        this.setData({ isLoading: false });
      }
    },

    /**
     * 处理手机号授权登录（按照新流程：phoneCode → 获取手机号 → wx.login → 登录）
     */
    async handlePhoneLogin(e) {
      console.log('📱 开始手机号授权登录流程...', e.detail);
      
      if (this.data.isLoading) {
        return;
      }

      // 检查用户是否同意授权
      if (!e.detail.code) {
        wx.showToast({
          title: '需要获取手机号才能继续',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      this.setData({ 
        isLoading: true,
        loginType: 'withPhone'
      });

      try {
        // 第一步：使用 phoneCode 调用 /api/auth/phone 获取手机号
        const phoneCode = e.detail.code;
        console.log('📱 第一步：使用 phoneCode 获取手机号...');
        const phoneNumber = await this.getPhoneNumber(phoneCode);
        console.log('✅ 成功获取手机号:', phoneNumber);

        // 第二步：在获取手机号成功的回调中调用 wx.login() 获取 code
        console.log('🔐 第二步：获取微信登录 code...');
        const loginCode = await this.getWeChatLoginCode();
        console.log('✅ 微信登录 code 获取成功');

        // 第三步：调用 /api/auth/wechat 将 code 和手机号传递给后台完成登录
        console.log('🚀 第三步：将 code 和手机号传递给后台完成登录...');
        const loginResult = await this.callLoginAPI(loginCode, phoneNumber);
        console.log('✅ 登录成功');

        // 第四步：保存登录信息
        await this.saveAuthData(loginResult);
        
        // 更新组件状态
        this.updateLoginState(loginResult);

        // 显示成功提示
        wx.showToast({
          title: '登录成功，已获取手机号',
          icon: 'success',
          duration: 2000
        });

      } catch (error) {
        console.error('❌ 手机号授权登录失败:', error);
        this.handleLoginError(error);
      } finally {
        this.setData({ isLoading: false });
      }
    },

    /**
     * 更新登录状态
     */
    updateLoginState(loginResult) {
      this.setData({
        isLoggedIn: true,
        userInfo: loginResult.user,
        authToken: loginResult.token
      });

      // 触发登录成功事件
      this.triggerEvent('loginSuccess', {
        user: loginResult.user,
        token: loginResult.token,
        hasPhoneNumber: !!loginResult.user.phoneNumber
      });
    },

    /**
     * 获取微信登录code
     */
    getWeChatLoginCode() {
      return new Promise((resolve, reject) => {
        wx.login({
          success: (result) => {
            if (result.code) {
              resolve(result.code);
            } else {
              reject(new Error('获取登录code失败'));
            }
          },
          fail: (error) => {
            reject(new Error(`微信登录失败: ${error.errMsg}`));
          }
        });
      });
    },

    /**
     * 调用后端登录API（支持传递手机号）
     */
    async callLoginAPI(code, phoneNumber = null) {
      try {
        const requestData = { code };
        if (phoneNumber) {
          requestData.phoneNumber = phoneNumber;
        }

        const response = await this.requestAsync({
          url: `${app.globalData.apiBaseUrl}/api/auth/wechat`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json'
          },
          data: requestData
        });

        const result = response.data;

        if (result.success && result.token) {
          return result;
        } else {
          throw new Error(result.error || '登录失败');
        }
      } catch (error) {
        if (error.statusCode) {
          throw new Error(`登录请求失败 (${error.statusCode}): ${error.data?.error || '网络错误'}`);
        }
        throw error;
      }
    },

    /**
     * 获取用户手机号
     */
    async getPhoneNumber(phoneCode) {
      try {
        const response = await this.requestAsync({
          url: `${app.globalData.apiBaseUrl}/api/auth/phone`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json'
          },
          data: { phoneCode }
        });

        const result = response.data;

        if (result.success && result.phoneNumber) {
          return result.phoneNumber;
        } else {
          throw new Error(result.error || '获取手机号失败');
        }
      } catch (error) {
        if (error.statusCode) {
          throw new Error(`获取手机号失败 (${error.statusCode}): ${error.data?.error || '网络错误'}`);
        }
        throw error;
      }
    },

    /**
     * 保存认证数据到本地存储
     */
    async saveAuthData(loginResult) {
      const savePromises = [
        this.setStorageAsync(CONFIG.STORAGE_KEYS.TOKEN, loginResult.token),
        this.setStorageAsync(CONFIG.STORAGE_KEYS.USER_INFO, loginResult.user),
        this.setStorageAsync(CONFIG.STORAGE_KEYS.LOGIN_STATUS, true)
      ];

      await Promise.all(savePromises);
    },

    /**
     * 更新用户手机号
     */
    async updateUserPhoneNumber(phoneCode) {
      try {
        const token = await this.getStorageAsync(CONFIG.STORAGE_KEYS.TOKEN);
        if (!token) {
          throw new Error('未找到登录token');
        }

        const response = await this.requestAsync({
          url: `${app.globalData.apiBaseUrl}/api/auth/phone`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          data: { phoneCode }
        });

        const result = response.data;

        if (result.success && result.phoneNumber) {
          // 更新本地存储的用户信息
          const userInfo = await this.getStorageAsync(CONFIG.STORAGE_KEYS.USER_INFO);
          if (userInfo) {
            userInfo.phoneNumber = result.phoneNumber;
            await this.setStorageAsync(CONFIG.STORAGE_KEYS.USER_INFO, userInfo);
            
            // 更新组件状态
            this.setData({
              userInfo: userInfo
            });
          }
          
          return result;
        } else {
          throw new Error(result.error || '更新手机号失败');
        }
      } catch (error) {
        if (error.statusCode) {
          throw new Error(`更新手机号失败 (${error.statusCode}): ${error.data?.error || '网络错误'}`);
        }
        throw error;
      }
    },

    /**
     * 处理登录错误
     */
    handleLoginError(error) {
      let errorMessage = '登录失败，请稍后重试';

      if (error.message.includes('getUserProfile')) {
        errorMessage = '需要授权获取用户信息才能登录';
      } else if (error.message.includes('login')) {
        errorMessage = '微信登录失败，请重试';
      } else if (error.message.includes('网络') || error.message.includes('timeout')) {
        errorMessage = '网络连接失败，请检查网络后重试';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = '登录授权失败，请重试';
      } else if (error.message.includes('获取手机号')) {
        errorMessage = error.message; // 直接使用手机号相关的错误信息
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });

      // 触发登录失败事件
      this.triggerEvent('loginFail', {
        error: error.message,
        code: error.statusCode || -1
      });
    },

    /**
     * 处理退出登录
     */
    async handleLogout() {
      try {
        await wx.showModal({
          title: '退出登录',
          content: '确定要退出登录吗？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '确定'
        });

        console.log('🚪 用户确认退出登录');
        await this.clearAuthData();

        this.setData({
          isLoggedIn: false,
          userInfo: null,
          authToken: null
        });

        // 触发退出登录事件
        this.triggerEvent('logout');

        wx.showToast({
          title: '已退出登录',
          icon: 'success',
          duration: 2000
        });

      } catch (error) {
        console.log('ℹ️ 用户取消退出登录');
      }
    },

    /**
     * 清除认证数据
     */
    async clearAuthData() {
      const clearPromises = [
        this.removeStorageAsync(CONFIG.STORAGE_KEYS.TOKEN),
        this.removeStorageAsync(CONFIG.STORAGE_KEYS.USER_INFO),
        this.removeStorageAsync(CONFIG.STORAGE_KEYS.LOGIN_STATUS)
      ];

      await Promise.all(clearPromises);
    },

    /**
     * 显示隐私政策
     */
    showPrivacyPolicy() {
      this.triggerEvent('showPrivacyPolicy');
    },

    /**
     * 显示用户协议
     */
    showUserAgreement() {
      this.triggerEvent('showUserAgreement');
    },

    // === 工具方法 ===

    /**
     * Promise化的wx.request
     */
    requestAsync(options) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('请求超时'));
        }, CONFIG.REQUEST_TIMEOUT);

        wx.request({
          ...options,
          success: (response) => {
            clearTimeout(timeout);
            resolve(response);
          },
          fail: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    },

    /**
     * Promise化的wx.getStorage
     */
    getStorageAsync(key) {
      return new Promise((resolve) => {
        wx.getStorage({
          key: key,
          success: (result) => resolve(result.data),
          fail: () => resolve(null)
        });
      });
    },

    /**
     * Promise化的wx.setStorage
     */
    setStorageAsync(key, data) {
      return new Promise((resolve, reject) => {
        wx.setStorage({
          key: key,
          data: data,
          success: resolve,
          fail: reject
        });
      });
    },

    /**
     * Promise化的wx.removeStorage
     */
    removeStorageAsync(key) {
      return new Promise((resolve) => {
        wx.removeStorage({
          key: key,
          success: resolve,
          fail: resolve  // 即使删除失败也不报错
        });
      });
    }
  }
});