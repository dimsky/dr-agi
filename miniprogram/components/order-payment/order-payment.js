/**
 * 订单支付组件
 * 处理订单创建、支付流程和状态跟踪
 */

// 配置常量
const CONFIG = {
  // API地址
  API_BASE_URL: 'https://your-domain.com/api',
  // 请求超时时间
  REQUEST_TIMEOUT: 30000,
  // 支付状态检查间隔
  PAYMENT_CHECK_INTERVAL: 2000,
  // 最大检查次数
  MAX_CHECK_COUNT: 30
};

Component({
  properties: {
    // 服务配置ID
    serviceConfigId: {
      type: String,
      value: '',
      observer: 'onServiceConfigChange'
    },
    // 服务数据（表单提交的数据）
    serviceData: {
      type: Object,
      value: {},
      observer: 'onServiceDataChange'
    },
    // 用户ID
    userId: {
      type: String,
      value: ''
    },
    // 是否显示支付组件
    visible: {
      type: Boolean,
      value: false,
      observer: 'onVisibilityChange'
    }
  },

  data: {
    // 订单信息
    orderInfo: null,
    // 支付状态
    paymentStatus: 'pending', // pending, paying, success, failed, cancelled
    // 组件状态
    isLoading: false,
    isCreatingOrder: false,
    isProcessingPayment: false,
    // 错误信息
    errorMessage: '',
    // 支付检查计数器
    paymentCheckCount: 0,
    checkTimer: null
  },

  lifetimes: {
    /**
     * 组件初始化
     */
    attached() {
      console.log('💰 订单支付组件初始化');
    },

    /**
     * 组件销毁
     */
    detached() {
      // 清理定时器
      this.clearPaymentTimer();
    }
  },

  methods: {
    /**
     * 服务配置ID变化处理
     */
    onServiceConfigChange(newServiceConfigId) {
      if (newServiceConfigId && this.data.serviceData && this.data.userId) {
        this.prepareOrder();
      }
    },

    /**
     * 服务数据变化处理
     */
    onServiceDataChange(newServiceData) {
      if (newServiceData && this.data.serviceConfigId && this.data.userId) {
        this.prepareOrder();
      }
    },

    /**
     * 显示状态变化处理
     */
    onVisibilityChange(visible) {
      if (visible && this.data.serviceConfigId && this.data.serviceData && this.data.userId) {
        this.prepareOrder();
      } else if (!visible) {
        this.resetComponent();
      }
    },

    /**
     * 准备订单信息
     */
    async prepareOrder() {
      if (this.data.isCreatingOrder) {
        return;
      }

      this.setData({
        isCreatingOrder: true,
        isLoading: true,
        errorMessage: ''
      });

      try {
        console.log('📦 准备创建订单');

        // 获取服务配置信息
        const serviceConfig = await this.getServiceConfig(this.data.serviceConfigId);
        
        // 构建订单信息
        const orderInfo = {
          serviceConfigId: this.data.serviceConfigId,
          serviceData: this.data.serviceData,
          serviceName: serviceConfig.name || '医疗服务',
          serviceDescription: serviceConfig.description || '',
          amount: serviceConfig.price || '0.00',
          currency: 'CNY'
        };

        this.setData({
          orderInfo: orderInfo,
          isLoading: false
        });

        console.log('✅ 订单信息准备完成:', orderInfo);

      } catch (error) {
        console.error('❌ 准备订单失败:', error);
        this.setData({
          errorMessage: error.message || '准备订单失败',
          isLoading: false
        });
      } finally {
        this.setData({
          isCreatingOrder: false
        });
      }
    },

    /**
     * 获取服务配置
     */
    async getServiceConfig(serviceConfigId) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${CONFIG.API_BASE_URL}/service-configs/${serviceConfigId}`,
          method: 'GET',
          timeout: CONFIG.REQUEST_TIMEOUT,
          success: (response) => {
            if (response.statusCode === 200 && response.data.success) {
              resolve(response.data.data);
            } else {
              reject(new Error(response.data.message || '获取服务配置失败'));
            }
          },
          fail: (error) => {
            reject(new Error(`网络请求失败: ${error.errMsg}`));
          }
        });
      });
    },

    /**
     * 创建订单
     */
    async createOrder() {
      if (this.data.isProcessingPayment) {
        return;
      }

      this.setData({
        isProcessingPayment: true,
        isLoading: true,
        errorMessage: '',
        paymentStatus: 'pending'
      });

      try {
        console.log('🛒 创建订单');

        const orderData = {
          userId: this.data.userId,
          serviceConfigId: this.data.serviceConfigId,
          serviceData: this.data.serviceData,
          amount: this.data.orderInfo.amount,
          paymentMethod: 'wechat_pay'
        };

        // 调用创建订单API
        const createResult = await this.callCreateOrderAPI(orderData);
        
        // 保存订单信息
        const updatedOrderInfo = {
          ...this.data.orderInfo,
          orderId: createResult.orderId,
          orderNumber: createResult.orderNumber
        };

        this.setData({
          orderInfo: updatedOrderInfo
        });

        console.log('✅ 订单创建成功:', createResult);

        // 发起微信支付
        await this.initiateWeChatPayment(createResult.paymentParams);

      } catch (error) {
        console.error('❌ 创建订单失败:', error);
        this.setData({
          errorMessage: error.message || '创建订单失败',
          paymentStatus: 'failed',
          isLoading: false,
          isProcessingPayment: false
        });
      }
    },

    /**
     * 调用创建订单API
     */
    async callCreateOrderAPI(orderData) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${CONFIG.API_BASE_URL}/orders`,
          method: 'POST',
          data: orderData,
          timeout: CONFIG.REQUEST_TIMEOUT,
          success: (response) => {
            if (response.statusCode === 200 && response.data.success) {
              resolve(response.data.data);
            } else {
              reject(new Error(response.data.message || '创建订单失败'));
            }
          },
          fail: (error) => {
            reject(new Error(`网络请求失败: ${error.errMsg}`));
          }
        });
      });
    },

    /**
     * 发起微信支付
     */
    async initiateWeChatPayment(paymentParams) {
      try {
        console.log('💳 发起微信支付');
        
        this.setData({
          paymentStatus: 'paying'
        });

        // 调用微信支付API
        const paymentResult = await this.requestWeChatPayment(paymentParams);

        // 支付成功，开始检查支付状态
        console.log('✅ 微信支付调用成功:', paymentResult);
        this.startPaymentStatusCheck();

      } catch (error) {
        console.error('❌ 微信支付失败:', error);
        
        // 处理不同的支付错误
        let errorMessage = '支付失败';
        let paymentStatus = 'failed';

        if (error.errMsg) {
          if (error.errMsg.includes('cancel')) {
            errorMessage = '用户取消支付';
            paymentStatus = 'cancelled';
          } else if (error.errMsg.includes('fail')) {
            errorMessage = '支付失败，请重试';
          }
        }

        this.setData({
          errorMessage: errorMessage,
          paymentStatus: paymentStatus,
          isLoading: false,
          isProcessingPayment: false
        });
      }
    },

    /**
     * 请求微信支付
     */
    async requestWeChatPayment(paymentParams) {
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: paymentParams.timeStamp,
          nonceStr: paymentParams.nonceStr,
          package: paymentParams.package,
          signType: paymentParams.signType,
          paySign: paymentParams.paySign,
          success: (result) => {
            console.log('💰 支付成功回调:', result);
            resolve(result);
          },
          fail: (error) => {
            console.log('💸 支付失败回调:', error);
            reject(error);
          }
        });
      });
    },

    /**
     * 开始检查支付状态
     */
    startPaymentStatusCheck() {
      console.log('🔍 开始检查支付状态');
      
      this.setData({
        paymentCheckCount: 0
      });

      this.checkTimer = setInterval(() => {
        this.checkPaymentStatus();
      }, CONFIG.PAYMENT_CHECK_INTERVAL);
    },

    /**
     * 检查支付状态
     */
    async checkPaymentStatus() {
      const { paymentCheckCount, orderInfo } = this.data;
      
      // 检查次数限制
      if (paymentCheckCount >= CONFIG.MAX_CHECK_COUNT) {
        this.clearPaymentTimer();
        this.setData({
          errorMessage: '支付状态检查超时，请稍后查看订单状态',
          paymentStatus: 'failed',
          isLoading: false,
          isProcessingPayment: false
        });
        return;
      }

      try {
        console.log(`🔍 第${paymentCheckCount + 1}次检查支付状态`);

        const statusResult = await this.callPaymentStatusAPI(orderInfo.orderId);
        
        this.setData({
          paymentCheckCount: paymentCheckCount + 1
        });

        // 处理支付状态
        if (statusResult.status === 'paid') {
          // 支付成功
          this.clearPaymentTimer();
          this.handlePaymentSuccess(statusResult);
        } else if (statusResult.status === 'cancelled' || statusResult.status === 'failed') {
          // 支付失败或取消
          this.clearPaymentTimer();
          this.handlePaymentFailure(statusResult);
        }
        // 其他状态继续检查

      } catch (error) {
        console.error('❌ 检查支付状态失败:', error);
        this.setData({
          paymentCheckCount: paymentCheckCount + 1
        });
      }
    },

    /**
     * 调用支付状态检查API
     */
    async callPaymentStatusAPI(orderId) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${CONFIG.API_BASE_URL}/orders/${orderId}/payment-status`,
          method: 'GET',
          timeout: CONFIG.REQUEST_TIMEOUT,
          success: (response) => {
            if (response.statusCode === 200 && response.data.success) {
              resolve(response.data.data);
            } else {
              reject(new Error(response.data.message || '检查支付状态失败'));
            }
          },
          fail: (error) => {
            reject(new Error(`网络请求失败: ${error.errMsg}`));
          }
        });
      });
    },

    /**
     * 处理支付成功
     */
    handlePaymentSuccess(statusResult) {
      console.log('🎉 支付成功');
      
      this.setData({
        paymentStatus: 'success',
        isLoading: false,
        isProcessingPayment: false,
        orderInfo: {
          ...this.data.orderInfo,
          transactionId: statusResult.transactionId,
          paidAt: statusResult.paidAt
        }
      });

      // 显示成功提示
      wx.showToast({
        title: '支付成功',
        icon: 'success',
        duration: 2000
      });

      // 触发支付成功事件
      this.triggerEvent('paymentSuccess', {
        orderId: this.data.orderInfo.orderId,
        transactionId: statusResult.transactionId,
        orderInfo: this.data.orderInfo
      });
    },

    /**
     * 处理支付失败
     */
    handlePaymentFailure(statusResult) {
      console.log('💔 支付失败或取消');
      
      const paymentStatus = statusResult.status === 'cancelled' ? 'cancelled' : 'failed';
      const errorMessage = statusResult.status === 'cancelled' ? '支付已取消' : '支付失败';

      this.setData({
        paymentStatus: paymentStatus,
        errorMessage: errorMessage,
        isLoading: false,
        isProcessingPayment: false
      });

      // 触发支付失败事件
      this.triggerEvent('paymentFailure', {
        orderId: this.data.orderInfo.orderId,
        status: paymentStatus,
        error: errorMessage
      });
    },

    /**
     * 清理支付检查定时器
     */
    clearPaymentTimer() {
      if (this.checkTimer) {
        clearInterval(this.checkTimer);
        this.checkTimer = null;
      }
    },

    /**
     * 重试支付
     */
    onRetryPayment() {
      if (this.data.orderInfo && this.data.orderInfo.orderId) {
        // 如果已有订单，直接重新发起支付
        this.retryExistingOrderPayment();
      } else {
        // 重新创建订单并支付
        this.createOrder();
      }
    },

    /**
     * 重试已有订单的支付
     */
    async retryExistingOrderPayment() {
      try {
        this.setData({
          isProcessingPayment: true,
          isLoading: true,
          errorMessage: '',
          paymentStatus: 'pending'
        });

        console.log('🔄 重试支付已有订单');

        // 获取支付参数
        const paymentParams = await this.getPaymentParams(this.data.orderInfo.orderId);
        
        // 发起支付
        await this.initiateWeChatPayment(paymentParams);

      } catch (error) {
        console.error('❌ 重试支付失败:', error);
        this.setData({
          errorMessage: error.message || '重试支付失败',
          paymentStatus: 'failed',
          isLoading: false,
          isProcessingPayment: false
        });
      }
    },

    /**
     * 获取支付参数
     */
    async getPaymentParams(orderId) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${CONFIG.API_BASE_URL}/orders/${orderId}/payment-params`,
          method: 'POST',
          timeout: CONFIG.REQUEST_TIMEOUT,
          success: (response) => {
            if (response.statusCode === 200 && response.data.success) {
              resolve(response.data.data);
            } else {
              reject(new Error(response.data.message || '获取支付参数失败'));
            }
          },
          fail: (error) => {
            reject(new Error(`网络请求失败: ${error.errMsg}`));
          }
        });
      });
    },

    /**
     * 取消支付
     */
    onCancelPayment() {
      // 清理定时器
      this.clearPaymentTimer();
      
      // 重置状态
      this.setData({
        paymentStatus: 'cancelled',
        isLoading: false,
        isProcessingPayment: false
      });

      // 触发取消事件
      this.triggerEvent('paymentCancel', {
        orderId: this.data.orderInfo ? this.data.orderInfo.orderId : null
      });
    },

    /**
     * 重置组件状态
     */
    resetComponent() {
      // 清理定时器
      this.clearPaymentTimer();
      
      // 重置数据
      this.setData({
        orderInfo: null,
        paymentStatus: 'pending',
        isLoading: false,
        isCreatingOrder: false,
        isProcessingPayment: false,
        errorMessage: '',
        paymentCheckCount: 0
      });
    },

    /**
     * 格式化金额显示
     */
    formatAmount(amount) {
      if (!amount) return '0.00';
      return parseFloat(amount).toFixed(2);
    },

    /**
     * 获取支付状态文本
     */
    getPaymentStatusText(status) {
      const statusMap = {
        pending: '待支付',
        paying: '支付中...',
        success: '支付成功',
        failed: '支付失败',
        cancelled: '支付取消'
      };
      return statusMap[status] || '未知状态';
    }
  }
});