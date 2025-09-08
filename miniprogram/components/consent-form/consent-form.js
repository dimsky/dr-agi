/**
 * 知情同意书组件
 * 处理用户知情同意书的显示、同意记录和版本管理
 */

// 配置常量
const CONFIG = {
  // 知情同意书版本
  CONSENT_VERSION: 'v1.0.0',
  // 后端API地址
  API_BASE_URL: 'https://your-domain.com/api',  // 需要替换为实际域名
  // 本地存储键名
  STORAGE_KEYS: {
    CONSENT_AGREED: 'consent_agreed',
    CONSENT_VERSION: 'consent_version',
    CONSENT_TIMESTAMP: 'consent_timestamp'
  },
  // 请求超时时间
  REQUEST_TIMEOUT: 10000
};

Component({
  properties: {
    // 是否显示模态框形式
    modal: {
      type: Boolean,
      value: false
    },
    // 自定义知情同意书版本
    version: {
      type: String,
      value: CONFIG.CONSENT_VERSION
    },
    // 是否强制重新同意
    forceReagree: {
      type: Boolean,
      value: false
    }
  },

  data: {
    // 知情同意书版本
    consentVersion: CONFIG.CONSENT_VERSION,
    // 用户是否已阅读到底部
    hasScrolledToBottom: false,
    // 同意条款状态
    agreedToTerms: false,
    // 同意隐私政策状态
    agreedToPrivacy: false,
    // 是否可以确认（两个选项都选中且已读完）
    canConfirm: false,
    // 提交状态
    isSubmitting: false
  },

  lifetimes: {
    /**
     * 组件初始化
     */
    attached() {
      console.log('📄 知情同意书组件初始化');
      this.initializeConsent();
    }
  },

  methods: {
    /**
     * 初始化知情同意书
     */
    async initializeConsent() {
      try {
        // 设置版本号
        const version = this.properties.version || CONFIG.CONSENT_VERSION;
        this.setData({ consentVersion: version });

        // 检查是否需要重新同意
        if (!this.properties.forceReagree) {
          const hasAgreed = await this.checkExistingConsent(version);
          if (hasAgreed) {
            console.log('✅ 用户已同意当前版本知情同意书');
            this.triggerConsentSuccess();
            return;
          }
        }

        console.log('ℹ️ 需要用户同意知情同意书');
      } catch (error) {
        console.error('❌ 初始化知情同意书失败:', error);
      }
    },

    /**
     * 检查用户是否已同意当前版本
     */
    async checkExistingConsent(version) {
      try {
        const [agreedVersion, timestamp] = await Promise.all([
          this.getStorageAsync(CONFIG.STORAGE_KEYS.CONSENT_VERSION),
          this.getStorageAsync(CONFIG.STORAGE_KEYS.CONSENT_TIMESTAMP)
        ]);

        return agreedVersion === version && timestamp;
      } catch (error) {
        console.error('❌ 检查同意状态失败:', error);
        return false;
      }
    },

    /**
     * 处理滚动到底部事件
     */
    handleScrollToBottom() {
      if (!this.data.hasScrolledToBottom) {
        console.log('📖 用户已阅读完知情同意书');
        this.setData({ 
          hasScrolledToBottom: true 
        });
        this.updateConfirmStatus();
        
        // 显示提示
        wx.showToast({
          title: '请勾选同意选项',
          icon: 'none',
          duration: 2000
        });
      }
    },

    /**
     * 处理同意选项变化
     */
    handleConsentChange(e) {
      const values = e.detail.value;
      const agreedToTerms = values.includes('terms');
      const agreedToPrivacy = values.includes('privacy');
      
      console.log('🔄 同意状态变更:', { agreedToTerms, agreedToPrivacy });
      
      this.setData({
        agreedToTerms,
        agreedToPrivacy
      });
      
      this.updateConfirmStatus();
    },

    /**
     * 更新确认按钮状态
     */
    updateConfirmStatus() {
      const canConfirm = this.data.hasScrolledToBottom && 
                        this.data.agreedToTerms && 
                        this.data.agreedToPrivacy;
      
      this.setData({ canConfirm });
      
      if (canConfirm) {
        console.log('✅ 可以确认同意');
      }
    },

    /**
     * 处理取消操作
     */
    handleCancel() {
      wx.showModal({
        title: '确认取消',
        content: '取消后将无法使用平台服务，确定要取消吗？',
        showCancel: true,
        cancelText: '继续阅读',
        confirmText: '确定取消',
        success: (res) => {
          if (res.confirm) {
            console.log('❌ 用户取消同意知情同意书');
            this.triggerEvent('consentCancel');
          }
        }
      });
    },

    /**
     * 处理确认同意
     */
    async handleConfirm() {
      if (!this.data.canConfirm || this.data.isSubmitting) {
        return;
      }

      this.setData({ isSubmitting: true });

      try {
        console.log('📝 开始记录用户同意...');

        // 获取用户IP地址和设备信息
        const deviceInfo = await this.getDeviceInfo();
        const timestamp = new Date().toISOString();

        // 构造同意记录
        const consentRecord = {
          version: this.data.consentVersion,
          timestamp: timestamp,
          agreedToTerms: this.data.agreedToTerms,
          agreedToPrivacy: this.data.agreedToPrivacy,
          deviceInfo: deviceInfo,
          userAgent: 'WeChat-MiniProgram'
        };

        // 保存到本地存储
        await this.saveConsentRecord(consentRecord);

        // 上传到服务器
        await this.uploadConsentRecord(consentRecord);

        console.log('✅ 知情同意书确认成功');

        // 显示成功提示
        wx.showToast({
          title: '确认成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟触发成功事件，让用户看到成功提示
        setTimeout(() => {
          this.triggerConsentSuccess(consentRecord);
        }, 1500);

      } catch (error) {
        console.error('❌ 确认知情同意书失败:', error);
        this.handleConsentError(error);
      } finally {
        this.setData({ isSubmitting: false });
      }
    },

    /**
     * 获取设备信息
     */
    async getDeviceInfo() {
      try {
        const systemInfo = await this.getSystemInfoAsync();
        const networkInfo = await this.getNetworkInfoAsync();
        
        return {
          model: systemInfo.model,
          system: systemInfo.system,
          version: systemInfo.version,
          platform: systemInfo.platform,
          screenWidth: systemInfo.screenWidth,
          screenHeight: systemInfo.screenHeight,
          networkType: networkInfo.networkType,
          // IP地址需要通过服务器端获取
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('⚠️ 获取设备信息失败:', error);
        return {
          error: 'Failed to get device info',
          timestamp: Date.now()
        };
      }
    },

    /**
     * 保存同意记录到本地存储
     */
    async saveConsentRecord(record) {
      const savePromises = [
        this.setStorageAsync(CONFIG.STORAGE_KEYS.CONSENT_AGREED, true),
        this.setStorageAsync(CONFIG.STORAGE_KEYS.CONSENT_VERSION, record.version),
        this.setStorageAsync(CONFIG.STORAGE_KEYS.CONSENT_TIMESTAMP, record.timestamp)
      ];

      await Promise.all(savePromises);
      console.log('💾 同意记录已保存到本地');
    },

    /**
     * 上传同意记录到服务器
     */
    async uploadConsentRecord(record) {
      try {
        // 获取用户token
        const token = await this.getStorageAsync('auth_token');
        
        const response = await this.requestAsync({
          url: `${CONFIG.API_BASE_URL}/user/consent`,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : undefined
          },
          data: record
        });

        if (response.data.success) {
          console.log('☁️ 同意记录已上传到服务器');
        } else {
          throw new Error(response.data.error || '上传失败');
        }
      } catch (error) {
        console.error('⚠️ 上传同意记录失败:', error);
        // 上传失败不影响本地确认流程
      }
    },

    /**
     * 处理同意确认错误
     */
    handleConsentError(error) {
      let errorMessage = '确认失败，请重试';

      if (error.message.includes('网络') || error.message.includes('timeout')) {
        errorMessage = '网络连接失败，但本地记录已保存';
      } else if (error.message.includes('存储')) {
        errorMessage = '保存失败，请检查存储权限';
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });

      // 触发错误事件
      this.triggerEvent('consentError', {
        error: error.message,
        code: error.code || -1
      });
    },

    /**
     * 触发同意成功事件
     */
    triggerConsentSuccess(record) {
      this.triggerEvent('consentSuccess', {
        version: this.data.consentVersion,
        timestamp: record ? record.timestamp : new Date().toISOString(),
        record: record
      });
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
     * Promise化的wx.getSystemInfo
     */
    getSystemInfoAsync() {
      return new Promise((resolve, reject) => {
        wx.getSystemInfo({
          success: resolve,
          fail: reject
        });
      });
    },

    /**
     * Promise化的wx.getNetworkType
     */
    getNetworkInfoAsync() {
      return new Promise((resolve, reject) => {
        wx.getNetworkType({
          success: resolve,
          fail: reject
        });
      });
    }
  }
});