// pages/login/login.js
const app = getApp()

Page({
  data: {
    isLoading: false,
    loginType: 'normal', // 'normal' | 'withPhone'
    showPhoneOption: true // 是否显示手机号授权选项
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
   * 微信登录按钮点击事件（不获取手机号）
   */
  async onLogin() {
    console.log("开始普通登录流程")
    if (this.data.isLoading) return

    this.setData({ 
      isLoading: true,
      loginType: 'normal'
    })

    try {
      // 执行微信登录获取code
      const loginResult = await this.wxLogin()
      
      // 发送登录请求到后端（不包含手机号）
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
   * 手机号授权登录（按照新流程：phoneCode → 获取手机号 → wx.login → 登录）
   */
  async onLoginWithPhone(e) {
    console.log("开始手机号授权登录流程", e.detail)
    
    if (this.data.isLoading) return

    // 检查用户是否同意授权
    if (!e.detail.code) {
      wx.showToast({
        title: '需要获取手机号才能继续',
        icon: 'none',
        duration: 2000
      })
      return
    }

    this.setData({ 
      isLoading: true,
      loginType: 'withPhone'
    })

    try {
      // 第一步：使用 phoneCode 调用 /api/auth/phone 获取手机号
      const phoneCode = e.detail.code
      console.log('📱 第一步：使用 phoneCode 获取手机号...')
      const phoneNumber = await this.getPhoneNumber(phoneCode)
      console.log('✅ 成功获取手机号:', phoneNumber)
      
      // 第二步：在获取手机号成功的回调中调用 wx.login() 获取 code
      console.log('🔐 第二步：获取微信登录 code...')
      const loginResult = await this.wxLogin()
      console.log('✅ 微信登录 code 获取成功')
      
      // 第三步：调用 /api/auth/wechat 将 code 和手机号传递给后台完成登录
      console.log('🚀 第三步：将 code 和手机号传递给后台完成登录...')
      const loginResponse = await this.loginToServer({
        code: loginResult.code,
        phoneNumber: phoneNumber
      })
      console.log('✅ 登录成功')

      // 显示手机号登录成功提示
      wx.showToast({
        title: '登录成功，已获取手机号',
        icon: 'success',
        duration: 2000
      })

      // 登录成功，检查用户信息完整性
      await this.checkUserProfileCompleteness()

    } catch (error) {
      console.error('手机号授权登录失败:', error)
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
   * 获取用户手机号
   */
  async getPhoneNumber(phoneCode) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/auth/phone`,
        method: 'POST',
        data: { phoneCode },
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.success) {
            resolve(res.data.phoneNumber)
          } else {
            const errorMsg = res.data.error || '获取手机号失败'
            reject(new Error(errorMsg))
          }
        },
        fail: (err) => {
          console.error('获取手机号请求失败:', err)
          reject(new Error('网络连接失败，请检查网络后重试'))
        }
      })
    })
  },

  /**
   * 更新用户手机号（保留备用）
   */
  async updateUserPhoneNumber(phoneCode) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('access_token')
      if (!token) {
        reject(new Error('未找到登录token'))
        return
      }

      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/auth/phone`,
        method: 'POST',
        data: { phoneCode },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.success) {
            // 更新本地存储的用户信息
            let userInfo = wx.getStorageSync('user_info')
            if (userInfo) {
              userInfo.phoneNumber = res.data.phoneNumber
              wx.setStorageSync('user_info', userInfo)
              app.globalData.userInfo = userInfo
            }
            resolve(res.data)
          } else {
            const errorMsg = res.data.error || '更新手机号失败'
            reject(new Error(errorMsg))
          }
        },
        fail: (err) => {
          console.error('更新手机号请求失败:', err)
          reject(new Error('网络连接失败，请检查网络后重试'))
        }
      })
    })
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
        fail: () => {
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
   * 向服务器发送登录请求（支持传递手机号）
   */
  async loginToServer(data) {
    return new Promise((resolve, reject) => {
      const loadingTitle = data.phoneNumber ? '正在登录并保存手机号...' : '正在登录...'
      wx.showLoading({ title: loadingTitle })
      
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/auth/wechat`,
        method: 'POST',
        data: data,
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          wx.hideLoading()
          
          if (res.statusCode === 200 && res.data.success) {
            console.log('登录成功:', res.data)
            
            // 保存用户信息和token
            wx.setStorageSync('access_token', res.data.token)
            wx.setStorageSync('refresh_token', res.data.token)
            wx.setStorageSync('user_info', res.data.user)
            
            // 更新全局用户信息
            app.globalData.userInfo = res.data.user
            app.globalData.isLoggedIn = true
            
            // 显示登录成功提示（不在这里显示，由调用方决定）
            
            resolve(res.data)
          } else {
            const errorMsg = res.data.error || '登录失败'
            reject(new Error(errorMsg))
          }
        },
        fail: (err) => {
          wx.hideLoading()
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

  }
})