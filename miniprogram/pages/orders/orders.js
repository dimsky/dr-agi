// pages/orders/orders.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    error: null,
    orders: [],
    filteredOrders: [],
    currentFilter: 'all', // all, pending, paid, processing, completed, cancelled
    filterOptions: [
      { key: 'all', label: '全部', count: 0 },
      { key: 'pending', label: '待付款', count: 0 },
      { key: 'paid', label: '已付款', count: 0 },
      { key: 'processing', label: '处理中', count: 0 },
      { key: 'completed', label: '已完成', count: 0 },
      { key: 'cancelled', label: '已取消', count: 0 }
    ],
    isLoadingMore: false,
    hasMoreData: true,
    pageSize: 10,
    currentPage: 1
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadOrders();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时刷新订单数据
    this.loadOrders();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.refreshOrders().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadMoreOrders();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '未登录',
        content: '请先登录后查看订单',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          } else {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        }
      });
      return false;
    }
    return true;
  },

  /**
   * 加载订单列表
   */
  loadOrders() {
    if (!this.checkLoginStatus()) return;

    this.setData({
      loading: true,
      error: null,
      currentPage: 1
    });

    return this.fetchOrdersFromServer(1)
      .then(orders => {
        this.setData({
          loading: false,
          orders: orders,
          hasMoreData: orders.length >= this.data.pageSize
        });
        this.filterOrders();
        this.updateFilterCounts();
      })
      .catch(error => {
        console.error('加载订单失败:', error);
        this.setData({
          loading: false,
          error: '加载订单失败，请稍后重试'
        });
      });
  },

  /**
   * 刷新订单列表
   */
  refreshOrders() {
    this.setData({
      currentPage: 1
    });
    return this.loadOrders();
  },

  /**
   * 加载更多订单
   */
  loadMoreOrders() {
    if (this.data.isLoadingMore || !this.data.hasMoreData) {
      return;
    }

    this.setData({
      isLoadingMore: true
    });

    const nextPage = this.data.currentPage + 1;
    
    this.fetchOrdersFromServer(nextPage)
      .then(newOrders => {
        if (newOrders.length === 0) {
          this.setData({
            hasMoreData: false
          });
          return;
        }

        const allOrders = [...this.data.orders, ...newOrders];
        this.setData({
          orders: allOrders,
          currentPage: nextPage,
          hasMoreData: newOrders.length >= this.data.pageSize
        });
        this.filterOrders();
        this.updateFilterCounts();
      })
      .catch(error => {
        console.error('加载更多订单失败:', error);
        wx.showToast({
          title: '加载失败',
          icon: 'error'
        });
      })
      .finally(() => {
        this.setData({
          isLoadingMore: false
        });
      });
  },

  /**
   * 从服务器获取订单数据
   */
  fetchOrdersFromServer(page = 1) {
    const token = wx.getStorageSync('token');
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/orders`,
        method: 'GET',
        data: {
          page: page,
          pageSize: this.data.pageSize
        },
        header: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.success) {
            resolve(res.data.orders || []);
          } else {
            // 如果没有真实API，使用模拟数据
            resolve(this.getMockOrders(page));
          }
        },
        fail: (error) => {
          console.log('API调用失败，使用模拟数据');
          resolve(this.getMockOrders(page));
        }
      });
    });
  },

  /**
   * 获取模拟订单数据
   */
  getMockOrders(page = 1) {
    const allMockOrders = [
      {
        id: 'order_001',
        serviceType: 'nutrition_plan',
        serviceName: '营养方案制定',
        status: 'completed',
        statusText: '已完成',
        amount: '199.00',
        createdAt: '2024-09-03 14:30:00',
        paidAt: '2024-09-03 14:32:00',
        completedAt: '2024-09-04 10:15:00',
        serviceData: {
          age: '35',
          gender: '女',
          condition: '减重需求'
        },
        hasResult: true
      },
      {
        id: 'order_002',
        serviceType: 'health_management',
        serviceName: '健康管理方案制定',
        status: 'processing',
        statusText: '处理中',
        amount: '299.00',
        createdAt: '2024-09-03 16:20:00',
        paidAt: '2024-09-03 16:22:00',
        serviceData: {
          age: '42',
          gender: '男',
          condition: '慢性病管理'
        },
        hasResult: false
      },
      {
        id: 'order_003',
        serviceType: 'clinical_research',
        serviceName: '临床研究匹配查询',
        status: 'paid',
        statusText: '已付款',
        amount: '399.00',
        createdAt: '2024-09-02 11:45:00',
        paidAt: '2024-09-02 11:47:00',
        serviceData: {
          disease: '糖尿病',
          stage: '二期'
        },
        hasResult: false
      },
      {
        id: 'order_004',
        serviceType: 'literature_analysis',
        serviceName: '文献解读工具',
        status: 'pending',
        statusText: '待付款',
        amount: '159.00',
        createdAt: '2024-09-02 09:30:00',
        serviceData: {
          document: '心血管研究报告.pdf'
        },
        hasResult: false
      },
      {
        id: 'order_005',
        serviceType: 'wellness_plan',
        serviceName: '养生方案制定',
        status: 'completed',
        statusText: '已完成',
        amount: '249.00',
        createdAt: '2024-09-01 15:20:00',
        paidAt: '2024-09-01 15:22:00',
        completedAt: '2024-09-02 11:30:00',
        serviceData: {
          constitution: '阴虚体质',
          symptoms: '失眠多梦'
        },
        hasResult: true
      },
      {
        id: 'order_006',
        serviceType: 'statistical_analysis',
        serviceName: '数据统计分析',
        status: 'cancelled',
        statusText: '已取消',
        amount: '449.00',
        createdAt: '2024-08-30 10:15:00',
        serviceData: {
          dataType: '实验数据',
          sampleSize: '100'
        },
        hasResult: false
      }
    ];

    // 分页处理
    const startIndex = (page - 1) * this.data.pageSize;
    const endIndex = startIndex + this.data.pageSize;
    return allMockOrders.slice(startIndex, endIndex);
  },

  /**
   * 过滤订单
   */
  filterOrders() {
    const { orders, currentFilter } = this.data;
    let filteredOrders = orders;

    if (currentFilter !== 'all') {
      filteredOrders = orders.filter(order => order.status === currentFilter);
    }

    this.setData({
      filteredOrders: filteredOrders
    });
  },

  /**
   * 更新过滤器计数
   */
  updateFilterCounts() {
    const { orders } = this.data;
    const counts = {
      all: orders.length,
      pending: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      cancelled: 0
    };

    orders.forEach(order => {
      if (counts[order.status] !== undefined) {
        counts[order.status]++;
      }
    });

    const updatedFilterOptions = this.data.filterOptions.map(option => ({
      ...option,
      count: counts[option.key] || 0
    }));

    this.setData({
      filterOptions: updatedFilterOptions
    });
  },

  /**
   * 切换过滤器
   */
  onFilterChange(event) {
    const filter = event.currentTarget.dataset.filter;
    this.setData({
      currentFilter: filter
    });
    this.filterOrders();
  },

  /**
   * 查看订单详情
   */
  onViewOrder(event) {
    const orderId = event.currentTarget.dataset.orderId;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?orderId=${orderId}`,
      fail: (error) => {
        console.error('导航到订单详情失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 重新购买
   */
  onReorder(event) {
    const order = event.currentTarget.dataset.order;
    
    wx.showModal({
      title: '确认重新购买',
      content: `确认重新购买"${order.serviceName}"服务吗？价格：￥${order.amount}元`,
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.navigateToServiceForm(order);
        }
      }
    });
  },

  /**
   * 导航到服务表单页面
   */
  navigateToServiceForm(order) {
    const serviceData = order.serviceData ? JSON.stringify(order.serviceData) : '';
    
    wx.navigateTo({
      url: `/pages/service-form/service-form?serviceType=${order.serviceType}&serviceName=${encodeURIComponent(order.serviceName)}&price=${order.amount}&reorderData=${encodeURIComponent(serviceData)}`,
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
  },

  /**
   * 继续支付
   */
  onContinuePayment(event) {
    const order = event.currentTarget.dataset.order;
    
    wx.showModal({
      title: '继续支付',
      content: `订单金额：￥${order.amount}元，确认支付吗？`,
      confirmText: '支付',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.processPayment(order);
        }
      }
    });
  },

  /**
   * 处理支付
   */
  processPayment(order) {
    wx.showLoading({
      title: '支付中...',
      mask: true
    });

    // 模拟支付处理
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '支付成功',
        icon: 'success'
      });
      
      // 刷新订单列表
      this.refreshOrders();
    }, 2000);
  },

  /**
   * 查看结果
   */
  onViewResult(event) {
    const orderId = event.currentTarget.dataset.orderId;
    wx.navigateTo({
      url: `/pages/result/result?orderId=${orderId}`,
      fail: (error) => {
        console.error('导航到结果页面失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 取消订单
   */
  onCancelOrder(event) {
    const order = event.currentTarget.dataset.order;
    
    wx.showModal({
      title: '确认取消订单',
      content: '取消后无法恢复，确认取消此订单吗？',
      confirmText: '确认取消',
      cancelText: '不取消',
      confirmColor: '#FF5722',
      success: (res) => {
        if (res.confirm) {
          this.processCancelOrder(order);
        }
      }
    });
  },

  /**
   * 处理取消订单
   */
  processCancelOrder(order) {
    wx.showLoading({
      title: '取消中...',
      mask: true
    });

    // 模拟取消处理
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '订单已取消',
        icon: 'success'
      });
      
      // 刷新订单列表
      this.refreshOrders();
    }, 1500);
  },

  /**
   * 重试加载
   */
  onRetry() {
    this.loadOrders();
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: '专业医疗服务平台 - 我的订单',
      path: '/pages/orders/orders',
      imageUrl: '/images/share-orders.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '专业医疗服务平台 - 管理您的医疗服务订单',
      imageUrl: '/images/share-orders.png'
    };
  },

  /**
   * 去服务页面
   */
  goToServices() {
    wx.switchTab({
      url: '/pages/services/services'
    });
  },

  /**
   * 查看进度
   */
  onViewProgress(event) {
    const orderId = event.currentTarget.dataset.orderId;
    wx.navigateTo({
      url: `/pages/task-progress/task-progress?orderId=${orderId}`,
      fail: (error) => {
        console.error('导航到进度页面失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'error'
        });
      }
    });
  }
});