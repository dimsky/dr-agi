//app.js
App({
  onLaunch: function () {
    // 检查登录状态
    const token = wx.getStorageSync('access_token');
    console.log("login-token", token)
    if (token) {
      // 验证token有效性
      this.verifyToken(token);
    }
    
    // 获取系统信息
    wx.getSystemInfo({
      success: res => {
        this.globalData.systemInfo = res;
        console.log('系统信息:', res);
      }
    });
  },

  onShow: function () {
    // 小程序切前台时触发
    console.log('小程序切前台');
  },

  onHide: function () {
    // 小程序切后台时触发
    console.log('小程序切后台');
  },

  onError: function (msg) {
    // 小程序发生脚本错误或API调用失败时触发
    console.error('小程序错误:', msg);
  },

  // 验证token有效性
  verifyToken: function(token) {
    wx.request({
      url: `${this.globalData.apiBaseUrl}/api/auth/verify`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('token验证响应:', res.data);
        if (res.statusCode === 200 && res.data.success && res.data.valid) {
          this.globalData.userInfo = res.data.user;
          this.globalData.isLoggedIn = true;
          
          // 通知所有页面登录状态已更新
          this.notifyLoginStatusChange();
          
          // 检查用户信息完整性
          this.checkUserProfileCompleteness(res.data.user);
        } else {
          // token无效，清除本地存储
          console.log('token验证失败:', res.data.error);
          this.clearLoginData();
        }
      },
      fail: () => {
        // 网络错误，清除token
        this.clearLoginData();
      }
    });
  },

  // 通知页面登录状态变化
  notifyLoginStatusChange: function() {
    // 获取当前页面栈
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      // 如果当前页面有 onLoginStatusChange 方法，调用它
      if (typeof currentPage.onLoginStatusChange === 'function') {
        currentPage.onLoginStatusChange(this.globalData.isLoggedIn, this.globalData.userInfo);
      }
    }
  },

  // 清除登录数据
  clearLoginData: function() {
    wx.removeStorageSync('access_token');
    wx.removeStorageSync('refresh_token');
    wx.removeStorageSync('user_info');
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
    
    // 通知页面登录状态已更新
    this.notifyLoginStatusChange();
  },

  // 退出登录
  logout: function() {
    this.clearLoginData();
    // 跳转到登录页面
    wx.reLaunch({
      url: '/pages/login/login'
    });
  },

  // 检查登录状态
  checkLogin: function() {
    if (!this.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录后使用此功能',
        showCancel: false,
        success: () => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }
      });
      return false;
    }
    return true;
  },

  // 检查用户信息完整性
  checkUserProfileCompleteness: function(userInfo) {
    if (!userInfo) {
      return;
    }
    
    const isComplete = this.isUserProfileComplete(userInfo);
    
    if (!isComplete) {
      console.log('用户信息不完整，需要完善信息');
      // 延迟跳转，避免与页面初始化冲突
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/personal-info/personal-info'
        });
      }, 1000);
    }
  },

  // 判断用户信息是否完整
  isUserProfileComplete: function(userInfo) {
    // 检查昵称是否存在且不为空
    if (!userInfo.nickname || userInfo.nickname.trim() === '') {
      return false;
    }
    
    // 可以根据业务需求添加其他必填字段的检查
    // 例如：头像、职业等
    
    return true;
  },

  // 全局数据
  globalData: {
    // 后端API地址 - 需要替换为实际的服务器域名
    // 开发环境
    apiBaseUrl: 'http://localhost:3000',
    // 生产环境 - 取消注释并替换为实际域名
    // apiBaseUrl: 'https://your-domain.com',
    
    userInfo: null,
    isLoggedIn: false,
    systemInfo: null,
    version: '1.0.0',
    
    // 功能开关
    features: {
      enablePhoneNumber: true, // 是否启用手机号获取
      requirePhoneNumber: false, // 是否强制要求手机号
    }
  }
})