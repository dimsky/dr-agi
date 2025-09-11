// profile.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    isLoggedIn: false,
    isEditing: false,
    loading: false,
    formData: {
      nickname: '',
      avatarUrl: '',
      email: '',
      profession: '',
      phone: ''
    },
    professionOptions: [
      '临床医生',
      '护士',
      '药师',
      '医技人员',
      '医院管理',
      '科研人员',
      '医学生',
      '其他'
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.checkLoginStatus();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadUserInfo().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const userInfo = app.globalData.userInfo;
    const isLoggedIn = app.globalData.isLoggedIn;
    
    if (isLoggedIn && userInfo) {
      this.setData({
        userInfo: userInfo,
        isLoggedIn: isLoggedIn,
        formData: {
          nickname: userInfo.nickname || '',
          avatarUrl: userInfo.avatarUrl || '',
          email: userInfo.email || '',
          profession: userInfo.profession || '',
          phone: userInfo.phone || ''
        }
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: null
      });
    }
  },

  /**
   * 登录状态变化回调 - 由app.js调用
   */
  onLoginStatusChange(isLoggedIn, userInfo) {
    console.log('个人中心接收到登录状态变化:', { isLoggedIn, userInfo });
    if (isLoggedIn && userInfo) {
      this.setData({
        userInfo: userInfo,
        isLoggedIn: isLoggedIn,
        formData: {
          nickname: userInfo.nickname || '',
          avatarUrl: userInfo.avatarUrl || '',
          email: userInfo.email || '',
          profession: userInfo.profession || '',
          phone: userInfo.phone || ''
        }
      });
    } else {
      this.setData({
        isLoggedIn: false,
        userInfo: null,
        isEditing: false,
        formData: {
          nickname: '',
          avatarUrl: '',
          email: '',
          profession: '',
          phone: ''
        }
      });
    }
  },

  /**
   * 从服务器加载用户信息
   */
  loadUserInfo() {
    const token = wx.getStorageSync('access_token');
    if (!token) {
      return Promise.resolve();
    }

    this.setData({ loading: true });

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBaseUrl}/api/auth/verify`,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.success) {
            const userInfo = res.data.user;
            app.globalData.userInfo = userInfo;
            app.globalData.isLoggedIn = true;
            
            this.setData({
              userInfo: userInfo,
              isLoggedIn: true,
              formData: {
                nickname: userInfo.nickname || '',
                avatarUrl: userInfo.avatarUrl || '',
                email: userInfo.email || '',
                profession: userInfo.profession || '',
                phone: userInfo.phone || ''
              }
            });
            resolve(userInfo);
          } else {
            reject(new Error('获取用户信息失败'));
          }
        },
        fail: (error) => {
          reject(error);
        },
        complete: () => {
          this.setData({ loading: false });
        }
      });
    });
  },

  /**
   * 处理登录
   */
  onLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  /**
   * 选择头像
   */
  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      },
      fail: (error) => {
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 上传头像
   */
  uploadAvatar(filePath) {
    const token = wx.getStorageSync('access_token');
    
    wx.showLoading({
      title: '上传中...'
    });

    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/upload/avatar`,
      filePath: filePath,
      name: 'avatar',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.success) {
            this.setData({
              'formData.avatarUrl': data.avatarUrl
            });
            wx.showToast({
              title: '头像上传成功',
              icon: 'success'
            });
          } else {
            throw new Error(data.error || '上传失败');
          }
        } catch (error) {
          wx.showToast({
            title: '头像上传失败',
            icon: 'error'
          });
        }
      },
      fail: (error) => {
        wx.showToast({
          title: '头像上传失败',
          icon: 'error'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  /**
   * 输入框输入事件
   */
  onInputChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  /**
   * 选择职业
   */
  onProfessionChange(event) {
    const index = event.detail.value;
    const profession = this.data.professionOptions[index];
    
    this.setData({
      'formData.profession': profession
    });
  },

  /**
   * 切换编辑模式
   */
  onToggleEdit() {
    if (this.data.isEditing) {
      // 保存修改
      this.saveUserInfo();
    } else {
      // 进入编辑模式
      this.setData({
        isEditing: true
      });
    }
  },

  /**
   * 取消编辑
   */
  onCancelEdit() {
    // 恢复原始数据
    const userInfo = this.data.userInfo;
    this.setData({
      isEditing: false,
      formData: {
        nickname: userInfo.nickname || '',
        avatarUrl: userInfo.avatarUrl || '',
        email: userInfo.email || '',
        profession: userInfo.profession || '',
        phone: userInfo.phone || ''
      }
    });
  },

  /**
   * 保存用户信息
   */
  saveUserInfo() {
    // 表单验证
    if (!this.validateForm()) {
      return;
    }

    const token = wx.getStorageSync('access_token');
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'error'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...'
    });

    wx.request({
      url: `${app.globalData.apiBaseUrl}/api/users/profile`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: this.data.formData,
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          // 更新全局用户信息 - API返回的数据在data.user中
          const updatedUserInfo = res.data.data.user;
          app.globalData.userInfo = updatedUserInfo;
          
          this.setData({
            userInfo: updatedUserInfo,
            isEditing: false
          });

          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.data.message || '保存失败',
            icon: 'error'
          });
        }
      },
      fail: (error) => {
        wx.showToast({
          title: '网络错误',
          icon: 'error'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { nickname, email, phone } = this.data.formData;

    if (!nickname || nickname.trim().length === 0) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'error'
      });
      return false;
    }

    if (nickname.trim().length > 20) {
      wx.showToast({
        title: '昵称不能超过20个字符',
        icon: 'error'
      });
      return false;
    }

    if (email && !this.isValidEmail(email)) {
      wx.showToast({
        title: '请输入正确的邮箱格式',
        icon: 'error'
      });
      return false;
    }

    if (phone && !this.isValidPhone(phone)) {
      wx.showToast({
        title: '请输入正确的手机号格式',
        icon: 'error'
      });
      return false;
    }

    return true;
  },

  /**
   * 验证邮箱格式
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * 验证手机号格式
   */
  isValidPhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  },

  /**
   * 查看我的订单
   */
  onViewOrders() {
    wx.switchTab({
      url: '/pages/orders/orders'
    });
  },

  /**
   * 查看反馈建议
   */
  onViewFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  /**
   * 联系客服
   */
  onContactService() {
    wx.showModal({
      title: '联系客服',
      content: '如有问题请联系客服微信：medical-platform-service',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 关于我们
   */
  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: 'DR.Agent AI 医学服务平台\n版本：' + app.globalData.version + '\n专注于为医疗工作者提供专业的AI辅助服务',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 退出登录
   */
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '您确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 调用app统一的退出登录方法
          app.logout();
        }
      }
    });
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: 'DR.Agent AI 医学服务平台 - 专业医疗AI助手',
      path: '/pages/index/index',
      imageUrl: '/images/share-profile.png'
    };
  }
});