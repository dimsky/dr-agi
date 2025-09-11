// index.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    isLoggedIn: false,
    announcements: [],
    recommendedServices: [],
    loading: true,
    platformStats: {
      totalUsers: '10,000+',
      totalServices: '7',
      successRate: '99%'
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadPageData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次页面显示时更新登录状态
    this.checkLoginStatus();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadPageData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const userInfo = app.globalData.userInfo;
    const isLoggedIn = app.globalData.isLoggedIn;
    
    this.setData({
      userInfo: userInfo,
      isLoggedIn: isLoggedIn
    });
  },

  /**
   * 登录状态变化回调 - 由app.js调用
   */
  onLoginStatusChange(isLoggedIn, userInfo) {
    console.log('首页接收到登录状态变化:', { isLoggedIn, userInfo });
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    });
  },

  /**
   * 加载页面数据
   */
  loadPageData() {
    this.setData({ loading: true });
    
    return Promise.all([
      this.loadAnnouncements(),
      this.loadRecommendedServices()
    ]).finally(() => {
      this.setData({ loading: false });
    });
  },

  /**
   * 加载公告信息
   */
  loadAnnouncements() {
    return new Promise((resolve) => {
      // 模拟从服务器获取公告
      setTimeout(() => {
        const announcements = [
          {
            id: 1,
            title: '🎉 平台正式上线',
            content: 'DR.Agent AI 医学服务平台正式上线，为广大医生提供专业的AI辅助服务',
            time: '2025-09-01',
            type: 'info'
          },
          {
            id: 2,
            title: '🔥 新服务上线',
            content: '临床研究方案撰写服务现已上线，助力医生科研工作',
            time: '2025-08-28',
            type: 'success'
          },
          {
            id: 3,
            title: '💡 使用小贴士',
            content: '建议在使用服务前详细填写个人信息，以获得更精准的服务',
            time: '2025-08-25',
            type: 'warning'
          }
        ];
        
        this.setData({ announcements });
        resolve(announcements);
      }, 500);
    });
  },

  /**
   * 加载推荐服务
   */
  loadRecommendedServices() {
    return new Promise((resolve) => {
      // 模拟从服务器获取推荐服务
      setTimeout(() => {
        const recommendedServices = [
          {
            id: 'nutrition',
            name: '营养方案制定',
            description: '个性化营养管理方案',
            icon: '🥗',
            price: '199',
            hot: true
          },
          {
            id: 'literature_analysis',
            name: '文献解读工具',
            description: '专业医学文献解读',
            icon: '📚',
            price: '159',
            hot: false
          },
          {
            id: 'research_proposal',
            name: '临床研究方案撰写',
            description: '规范研究方案撰写',
            icon: '📝',
            price: '599',
            hot: true
          }
        ];
        
        this.setData({ recommendedServices });
        resolve(recommendedServices);
      }, 600);
    });
  },

  /**
   * 导航到服务页面
   */
  onNavigateToServices() {
    wx.switchTab({
      url: '/pages/services/services'
    });
  },

  /**
   * 选择推荐服务
   */
  onSelectRecommendedService(event) {
    const service = event.currentTarget.dataset.service;
    
    if (!service) {
      wx.showToast({
        title: '服务信息错误',
        icon: 'error'
      });
      return;
    }

    // 显示确认对话框
    wx.showModal({
      title: '选择服务',
      content: `您选择了"${service.name}"服务，价格：￥${service.price}元，是否立即开始？`,
      confirmText: '立即开始',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 导航到服务表单页面
          wx.navigateTo({
            url: `/pages/service-form/service-form?serviceId=${service.id}&serviceName=${encodeURIComponent(service.name)}&price=${service.price}`
          });
        }
      }
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
   * 查看个人中心
   */
  onViewProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  /**
   * 查看所有公告
   */
  onViewAllAnnouncements() {
    wx.showToast({
      title: '公告详情功能开发中',
      icon: 'none'
    });
  },

  /**
   * 快速联系客服
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
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: 'DR.Agent AI 医学服务平台 - 专业AI医疗服务',
      path: '/pages/index/index',
      imageUrl: '/images/share-home.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: 'DR.Agent AI 医学服务平台 - 让医疗服务更智能',
      imageUrl: '/images/share-home.png'
    };
  }
});