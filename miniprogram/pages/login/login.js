// pages/login/login.js
const app = getApp()

Page({
  data: {
    isLoading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查是否已登录
    this.checkLoginStatus()
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('access_token')
    if (token) {
      // 已登录，跳转到主页
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }
  },

  /**
   * 微信登录按钮点击事件
   */
  async onLogin() {
    console.log("开始登录流程")
    if (this.data.isLoading) return

    this.setData({ isLoading: true })

    try {
      // 执行微信登录获取code
      const loginResult = await this.wxLogin()
      
      // 发送登录请求到后端
      await this.loginToServer({
        code: loginResult.code
      })

      // 登录成功，检查用户信息完整性
      await this.checkUserProfileCompleteness()

    } catch (error) {
      console.error('登录失败:', error)
      wx.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  /**
   * 微信登录获取code
   */
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          console.log("res", res)
          if (res.code) {
            resolve(res)
          } else {
            reject(new Error('微信登录失败'))
          }
        },
        fail: (err) => {
          reject(new Error('微信登录失败'))
        }
      })
    })
  },

  /**
   * 检查用户信息完整性
   */
  async checkUserProfileCompleteness() {
    const userInfo = wx.getStorageSync('user_info')
    console.log('检查用户信息完整性:', userInfo)
    
    if (!userInfo) {
      // 没有用户信息，跳转到完善信息页面
      console.log('无用户信息，跳转到完善信息页面')
      wx.reLaunch({
        url: '/pages/personal-info/personal-info'
      })
      return
    }

    // 检查必填信息是否完整
    const isComplete = this.isUserProfileComplete(userInfo)
    
    if (!isComplete) {
      console.log('用户信息不完整，跳转到完善信息页面')
      wx.reLaunch({
        url: '/pages/personal-info/personal-info'
      })
    } else {
      console.log('用户信息完整，跳转到主页')
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }
  },

  /**
   * 判断用户信息是否完整
   * @param {Object} userInfo 用户信息
   * @returns {boolean} 是否完整
   */
  isUserProfileComplete(userInfo) {
    // 检查昵称是否存在且不为空
    if (!userInfo.nickname || userInfo.nickname.trim() === '') {
      return false
    }
    
    // 可以根据业务需求添加其他必填字段的检查
    // 例如：头像、职业等
    
    return true
  },

  /**
   * 向服务器发送登录请求
   */
  async loginToServer(data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/auth/wechat`,
        method: 'POST',
        data: data,
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.success) {
            console.log(res.data)
            // 保存用户信息和token
            wx.setStorageSync('access_token', res.data.token)
            wx.setStorageSync('refresh_token', res.data.token)
            wx.setStorageSync('user_info', res.data.user)
            
            // 更新全局用户信息
            app.globalData.userInfo = res.data.user
            app.globalData.isLoggedIn = true
            
            resolve(res.data)
          } else {
            reject(new Error(res.data.message || '登录失败'))
          }
        },
        fail: (err) => {
          console.error('登录请求失败:', err)
          reject(new Error('网络连接失败，请检查网络后重试'))
        }
      })
    })
  },

  /**
   * 查看隐私协议
   */
  onPrivacyTap() {
    wx.showModal({
      title: '隐私协议',
      content: '我们承诺保护您的个人隐私信息安全，具体内容请查看完整的隐私协议。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  /**
   * 查看服务条款
   */
  onTermsTap() {
    wx.showModal({
      title: '服务条款',
      content: '使用本服务即表示您同意遵守相关服务条款，具体内容请查看完整的服务条款。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },
  getPhoneNumber (e) {
    console.log(e.detail.code)  // 动态令牌
    console.log(e.detail.errMsg) // 回调信息（成功失败都会返回）
    console.log(e.detail.errno)  // 错误码（失败时返回）
  }
})