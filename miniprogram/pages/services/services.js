// services.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    error: null,
    services: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadServices();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时刷新数据
    if (this.data.services.length === 0) {
      this.loadServices();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadServices().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载服务列表
   */
  loadServices() {
    this.setData({
      loading: true,
      error: null
    });

    return new Promise((resolve, reject) => {
      try {
        // 模拟异步加载（实际项目中可能从服务器获取）
        setTimeout(() => {
          const services = this.getServicesData();
          this.setData({
            loading: false,
            services: services
          });
          resolve(services);
        }, 800); // 模拟网络延迟
      } catch (error) {
        console.error('加载服务列表失败:', error);
        this.setData({
          loading: false,
          error: '加载服务列表失败，请稍后重试'
        });
        reject(error);
      }
    });
  },

  /**
   * 获取服务数据
   */
  getServicesData() {
    return [
      {
        id: 'nutrition',
        name: '营养方案制定',
        description: '根据个人体质和健康状况，制定个性化的营养管理方案',
        icon: '🥗',
        price: '199',
        duration: '3-5个工作日',
        features: ['个性化定制', '专业营养师', '持续跟踪'],
        serviceType: 'nutrition_plan'
      },
      {
        id: 'health_management',
        name: '健康管理方案制定',
        description: '全面评估健康状况，制定综合性健康管理计划',
        icon: '💪',
        price: '299',
        duration: '5-7个工作日',
        features: ['全面评估', '长期规划', '定期调整'],
        serviceType: 'health_management'
      },
      {
        id: 'wellness',
        name: '养生方案制定',
        description: '结合中医理论，制定适合的养生保健方案',
        icon: '🧘',
        price: '249',
        duration: '3-5个工作日',
        features: ['中医理论', '四季调养', '体质分析'],
        serviceType: 'wellness_plan'
      },
      {
        id: 'research_matching',
        name: '临床研究匹配查询',
        description: '根据病情匹配合适的临床研究项目',
        icon: '🔬',
        price: '399',
        duration: '1-3个工作日',
        features: ['精准匹配', '最新研究', '专业解读'],
        serviceType: 'clinical_research'
      },
      {
        id: 'literature_analysis',
        name: '文献解读工具',
        description: '专业解读医学文献，提供通俗易懂的分析报告',
        icon: '📚',
        price: '159',
        duration: '1-2个工作日',
        features: ['专业解读', '通俗易懂', '重点标注'],
        serviceType: 'literature_analysis'
      },
      {
        id: 'research_proposal',
        name: '临床研究方案撰写',
        description: '协助撰写规范的临床研究方案和计划书',
        icon: '📝',
        price: '599',
        duration: '7-10个工作日',
        features: ['规范撰写', '专家审核', '修改指导'],
        serviceType: 'research_proposal'
      },
      {
        id: 'data_analysis',
        name: '数据统计分析',
        description: '专业的医学数据统计分析和结果解释',
        icon: '📊',
        price: '449',
        duration: '3-7个工作日',
        features: ['专业分析', '图表展示', '结果解读'],
        serviceType: 'statistical_analysis'
      }
    ];
  },

  /**
   * 服务选择处理
   */
  onServiceSelect(event) {
    try {
      const service = event.currentTarget.dataset.service;
      
      if (!service || !service.id) {
        wx.showToast({
          title: '服务信息错误',
          icon: 'error'
        });
        return;
      }

      console.log('选择的服务:', service);

      // 显示选择确认
      wx.showModal({
        title: '确认选择',
        content: `您选择了"${service.name}"服务，价格：￥${service.price}元，是否继续？`,
        confirmText: '继续',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.navigateToServiceForm(service);
          }
        }
      });

    } catch (error) {
      console.error('服务选择处理失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  /**
   * 导航到服务表单页面
   */
  navigateToServiceForm(service) {
    try {
      // 将服务信息传递给表单页面
      wx.navigateTo({
        url: `/pages/service-form/service-form?serviceId=${service.id}&serviceName=${encodeURIComponent(service.name)}&price=${service.price}&serviceType=${service.serviceType}`,
        success: () => {
          console.log('导航到服务表单页面成功');
        },
        fail: (error) => {
          console.error('导航失败:', error);
          wx.showToast({
            title: '页面跳转失败',
            icon: 'error'
          });
        }
      });
    } catch (error) {
      console.error('导航处理失败:', error);
      wx.showToast({
        title: '导航失败',
        icon: 'error'
      });
    }
  },

  /**
   * 重试加载
   */
  onRetry() {
    this.loadServices();
  },

  /**
   * 获取可用服务（供其他页面调用）
   */
  getAvailableServices() {
    return this.getServicesData();
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: '专业医疗服务平台',
      path: '/pages/services/services',
      imageUrl: '/images/share-services.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '专业医疗服务平台 - 选择您需要的医疗服务',
      imageUrl: '/images/share-services.png'
    };
  }
});