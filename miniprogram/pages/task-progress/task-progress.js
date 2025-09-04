// task-progress.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    error: null,
    taskId: '',
    orderId: '',
    
    // 任务信息
    taskInfo: {
      taskId: '',
      orderId: '',
      serviceName: '',
      createdTime: '',
      startedTime: '',
      completedTime: '',
      executionTime: '',
      estimatedDuration: ''
    },
    
    // 任务状态
    taskStatus: 'pending', // pending, running, completed, failed
    progressPercentage: 0,
    
    // 状态显示
    statusIcon: '⏳',
    statusTitle: '正在准备...',
    statusMessage: '任务已创建，正在等待处理'
  },

  // 轮询定时器
  pollingTimer: null,
  pollingInterval: 3000, // 3秒轮询一次

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('任务进度页面参数:', options);
    
    const { taskId, orderId } = options;
    
    if (!taskId || !orderId) {
      this.setData({
        loading: false,
        error: '缺少必要参数，请重新进入'
      });
      return;
    }

    this.setData({
      taskId,
      orderId
    });

    this.loadTaskInfo();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时开始轮询
    if (this.data.taskId && !this.pollingTimer) {
      this.startPolling();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    // 页面隐藏时停止轮询
    this.stopPolling();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 页面卸载时停止轮询
    this.stopPolling();
  },

  /**
   * 加载任务信息
   */
  loadTaskInfo() {
    this.setData({
      loading: true,
      error: null
    });

    wx.request({
      url: `${app.globalData.baseUrl}/api/tasks/${this.data.taskId}`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        console.log('任务信息获取成功:', res.data);
        
        if (res.statusCode === 200 && res.data.success) {
          const task = res.data.data;
          this.updateTaskData(task);
          
          this.setData({
            loading: false
          });

          // 如果任务还未完成，开始轮询
          if (task.status !== 'completed' && task.status !== 'failed') {
            this.startPolling();
          }
          
        } else {
          throw new Error(res.data.message || '获取任务信息失败');
        }
      },
      fail: (error) => {
        console.error('获取任务信息失败:', error);
        this.setData({
          loading: false,
          error: '网络错误，请检查网络连接后重试'
        });
      }
    });
  },

  /**
   * 更新任务数据
   */
  updateTaskData(task) {
    // 格式化时间
    const createdTime = this.formatTime(new Date(task.createdAt));
    const startedTime = task.startedAt ? this.formatTime(new Date(task.startedAt)) : '';
    const completedTime = task.completedAt ? this.formatTime(new Date(task.completedAt)) : '';
    const executionTime = this.calculateExecutionTime(task.startedAt, task.completedAt);

    // 计算进度百分比
    const progressPercentage = this.calculateProgress(task.status);
    
    // 获取状态显示信息
    const statusDisplay = this.getStatusDisplay(task.status, task.errorMessage);

    this.setData({
      taskInfo: {
        taskId: task.id,
        orderId: task.orderId,
        serviceName: task.serviceName || '医疗AI服务',
        createdTime,
        startedTime,
        completedTime,
        executionTime,
        estimatedDuration: task.estimatedDuration || '3-5分钟'
      },
      taskStatus: task.status,
      progressPercentage,
      statusIcon: statusDisplay.icon,
      statusTitle: statusDisplay.title,
      statusMessage: statusDisplay.message
    });
  },

  /**
   * 计算进度百分比
   */
  calculateProgress(status) {
    switch (status) {
      case 'pending':
        return 10;
      case 'running':
        return 60;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  },

  /**
   * 获取状态显示信息
   */
  getStatusDisplay(status, errorMessage) {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          title: '等待处理',
          message: '任务已创建，正在排队等待AI处理，请耐心等待...'
        };
      case 'running':
        return {
          icon: '⚡',
          title: 'AI处理中',
          message: 'AI正在分析您的需求并生成专业报告，预计还需要几分钟...'
        };
      case 'completed':
        return {
          icon: '✅',
          title: '处理完成',
          message: 'AI已完成分析并生成了您的专业报告，点击下方按钮查看结果'
        };
      case 'failed':
        return {
          icon: '❌',
          title: '处理失败',
          message: errorMessage || '很抱歉，AI处理过程中遇到了问题，请联系客服或重试'
        };
      default:
        return {
          icon: '❓',
          title: '未知状态',
          message: '任务状态异常，请刷新页面或联系客服'
        };
    }
  },

  /**
   * 计算执行时间
   */
  calculateExecutionTime(startedAt, completedAt) {
    if (!startedAt || !completedAt) {
      return '';
    }

    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffSeconds = Math.floor((end - start) / 1000);

    if (diffSeconds < 60) {
      return `${diffSeconds}秒`;
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;
      return `${minutes}分${seconds}秒`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      return `${hours}小时${minutes}分钟`;
    }
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  /**
   * 开始轮询
   */
  startPolling() {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(() => {
      this.pollTaskStatus();
    }, this.pollingInterval);

    console.log('开始轮询任务状态');
  },

  /**
   * 停止轮询
   */
  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('停止轮询任务状态');
    }
  },

  /**
   * 轮询任务状态
   */
  pollTaskStatus() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/tasks/${this.data.taskId}/status`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          const task = res.data.data;
          this.updateTaskData(task);

          // 如果任务完成或失败，停止轮询
          if (task.status === 'completed' || task.status === 'failed') {
            this.stopPolling();
            
            // 任务完成时显示提示
            if (task.status === 'completed') {
              wx.showToast({
                title: '任务已完成',
                icon: 'success',
                duration: 2000
              });
            }
          }
        }
      },
      fail: (error) => {
        console.error('轮询任务状态失败:', error);
        // 轮询失败不显示错误，避免频繁提示
      }
    });
  },

  /**
   * 查看结果
   */
  onViewResult() {
    try {
      wx.navigateTo({
        url: `/pages/result/result?taskId=${this.data.taskId}&orderId=${this.data.orderId}`,
        success: () => {
          console.log('导航到结果页面成功');
        },
        fail: (error) => {
          console.error('导航到结果页面失败:', error);
          wx.showToast({
            title: '页面跳转失败',
            icon: 'error'
          });
        }
      });
    } catch (error) {
      console.error('查看结果失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  /**
   * 重新执行任务
   */
  onRetryTask() {
    wx.showModal({
      title: '确认重试',
      content: '是否重新执行该任务？',
      confirmText: '重试',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.retryTask();
        }
      }
    });
  },

  /**
   * 执行重试
   */
  retryTask() {
    wx.showLoading({
      title: '重新提交中...'
    });

    wx.request({
      url: `${app.globalData.baseUrl}/api/tasks/${this.data.taskId}/retry`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({
            title: '重试成功',
            icon: 'success'
          });
          
          // 重新加载任务信息
          this.loadTaskInfo();
          
        } else {
          wx.showToast({
            title: res.data.message || '重试失败',
            icon: 'error'
          });
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('重试任务失败:', error);
        wx.showToast({
          title: '网络错误',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 返回订单列表
   */
  onBackToOrders() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        // 如果无法返回，则跳转到订单页面
        wx.switchTab({
          url: '/pages/orders/orders'
        });
      }
    });
  },

  /**
   * 重试加载
   */
  onRetry() {
    this.loadTaskInfo();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadTaskInfo();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    return {
      title: '任务执行进度 - DR.Agent',
      path: `/pages/task-progress/task-progress?taskId=${this.data.taskId}&orderId=${this.data.orderId}`,
      imageUrl: '/images/share-task.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '正在使用AI医疗服务处理我的需求',
      imageUrl: '/images/share-task.png'
    };
  }
});