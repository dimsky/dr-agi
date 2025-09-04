//app.js
App({
  onLaunch: function () {
    // 检查登录状态
    const token = wx.getStorageSync('token');
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
      url: `${this.globalData.baseUrl}/api/auth/verify`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          this.globalData.userInfo = res.data.user;
          this.globalData.isLoggedIn = true;
        } else {
          // token无效，清除本地存储
          wx.removeStorageSync('token');
          this.globalData.isLoggedIn = false;
        }
      },
      fail: () => {
        // 网络错误，清除token
        wx.removeStorageSync('token');
        this.globalData.isLoggedIn = false;
      }
    });
  },

  // 全局数据
  globalData: {
    baseUrl: 'https://your-domain.com', // 后端API地址，需要替换为实际域名
    userInfo: null,
    isLoggedIn: false,
    systemInfo: null,
    version: '1.0.0'
  }
})