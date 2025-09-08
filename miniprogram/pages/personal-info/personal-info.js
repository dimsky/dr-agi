Page({
  data: {
    avatarUrl: '/images/default-avatar.png',
    nickname: '',
    profession: '',
    email: '',
    professionList: [
      '医生',
      '医学生', 
      '营养师',
      '护士',
      '药师',
      '健康管理师',
      '陪诊员',
      '康复师',
      '医学经理',
      '医学编辑',
      '公共卫生人员',
      '其他'
    ],
    professionIndex: 0,
  },

  onLoad(options) {
    console.log('页面加载，职业列表:', this.data.professionList)
    console.log('初始professionIndex:', this.data.professionIndex)
    
    // 从全局数据或缓存中获取用户基本信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        nickname: userInfo.nickName || '',
        avatarUrl: userInfo.avatarUrl || '/images/default-avatar.png'
      })
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      avatarUrl
    })
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  // 邮箱输入
  onEmailInput(e) {
    this.setData({
      email: e.detail.value
    })
  },

  // 职业选择确认  
  onProfessionChange(e) {
    console.log('职业选择器被触发:', e.detail)
    const index = parseInt(e.detail.value)
    const selectedProfession = this.data.professionList[index]
    console.log('选中职业:', selectedProfession, '索引:', index)
    
    this.setData({
      professionIndex: index,
      profession: selectedProfession
    })
    
    wx.showToast({
      title: `已选择: ${selectedProfession}`,
      icon: 'none',
      duration: 2000
    })
  },

  // 表单验证
  validateForm() {
    if (!this.data.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return false
    }

    if (this.data.email && !this.validateEmail(this.data.email)) {
      wx.showToast({
        title: '邮箱格式不正确',
        icon: 'none'
      })
      return false
    }

    return true
  },

  // 邮箱格式验证
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  // 提交表单
  onSubmit() {
    if (!this.validateForm()) {
      return
    }

    wx.showLoading({
      title: '保存中...'
    })

    // 构建用户信息
    const userInfo = {
      avatarUrl: this.data.avatarUrl,
      nickname: this.data.nickname.trim(),
      profession: this.data.profession,
      email: this.data.email.trim()
    }

    // 调用后台API保存用户信息
    wx.request({
      url: getApp().globalData.apiBaseUrl + '/api/users/profile',
      method: 'POST',
      header: {
        'Authorization': 'Bearer ' + wx.getStorageSync('access_token'),
        'Content-Type': 'application/json'
      },
      data: userInfo,
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode === 200 && res.data.success) {
          // 更新本地存储的用户信息
          const updatedUser = res.data.data.user
          wx.setStorageSync('user_info', updatedUser)
          
          // 更新全局用户信息
          getApp().globalData.userInfo = updatedUser
          
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })

          setTimeout(() => {
            // 跳转到主页或返回上一页
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 1500)
        } else {
          wx.showToast({
            title: res.data.message || '保存失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('保存用户信息失败:', err)
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 跳过完善信息
  onSkip() {
    wx.showModal({
      title: '提示',
      content: '跳过后可以在个人中心完善信息，确定要跳过吗？',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      }
    })
  }
})