// result.js
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
    
    // 任务结果信息
    resultInfo: {
      taskId: '',
      orderId: '',
      serviceName: '',
      completedTime: '',
      executionTime: '',
      resultType: 'text' // text, image, pdf, mixed
    },
    
    // 结果内容
    resultContent: {
      textContent: '',
      images: [],
      pdfUrl: '',
      files: [],
      summary: ''
    },
    
    // 分享信息
    shareConfig: {
      title: '',
      desc: '',
      imageUrl: ''
    },
    
    // 评价相关
    ratingVisible: false,
    currentRating: 5,
    ratingComment: '',
    hasRated: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('结果页面参数:', options);
    
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

    this.loadTaskResult();
  },

  /**
   * 加载任务结果
   */
  loadTaskResult() {
    this.setData({
      loading: true,
      error: null
    });

    wx.request({
      url: `${app.globalData.baseUrl}/api/tasks/${this.data.taskId}/result`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        console.log('任务结果获取成功:', res.data);
        
        if (res.statusCode === 200 && res.data.success) {
          const result = res.data.data;
          this.processTaskResult(result);
          
          this.setData({
            loading: false
          });
          
        } else {
          throw new Error(res.data.message || '获取任务结果失败');
        }
      },
      fail: (error) => {
        console.error('获取任务结果失败:', error);
        this.setData({
          loading: false,
          error: '网络错误，请检查网络连接后重试'
        });
      }
    });
  },

  /**
   * 处理任务结果数据
   */
  processTaskResult(result) {
    // 格式化时间
    const completedTime = this.formatTime(new Date(result.completedAt));
    const executionTime = this.calculateExecutionTime(result.startedAt, result.completedAt);

    // 处理结果内容
    const resultContent = this.processResultContent(result.output);
    
    // 确定结果类型
    const resultType = this.determineResultType(result.output);

    // 设置分享配置
    const shareConfig = this.generateShareConfig(result);

    this.setData({
      resultInfo: {
        taskId: result.id,
        orderId: result.orderId,
        serviceName: result.serviceName || '医疗AI服务',
        completedTime,
        executionTime,
        resultType
      },
      resultContent,
      shareConfig,
      hasRated: result.hasRated || false
    });
  },

  /**
   * 处理结果内容
   */
  processResultContent(output) {
    const content = {
      textContent: '',
      images: [],
      pdfUrl: '',
      files: [],
      summary: ''
    };

    if (typeof output === 'string') {
      // 纯文本结果
      content.textContent = output;
      content.summary = this.generateSummary(output);
    } else if (typeof output === 'object') {
      // 复合类型结果
      if (output.text) {
        content.textContent = output.text;
        content.summary = this.generateSummary(output.text);
      }
      
      if (output.images && Array.isArray(output.images)) {
        content.images = output.images.map(img => ({
          url: img.url || img,
          title: img.title || '分析图片',
          description: img.description || ''
        }));
      }
      
      if (output.pdf) {
        content.pdfUrl = output.pdf;
      }
      
      if (output.files && Array.isArray(output.files)) {
        content.files = output.files.map(file => ({
          name: file.name,
          url: file.url,
          size: file.size,
          type: file.type
        }));
      }
      
      if (output.summary) {
        content.summary = output.summary;
      }
    }

    return content;
  },

  /**
   * 确定结果类型
   */
  determineResultType(output) {
    if (typeof output === 'string') {
      return 'text';
    }
    
    if (typeof output === 'object') {
      const hasText = !!output.text;
      const hasImages = output.images && output.images.length > 0;
      const hasPdf = !!output.pdf;
      const hasFiles = output.files && output.files.length > 0;
      
      const typeCount = [hasText, hasImages, hasPdf, hasFiles].filter(Boolean).length;
      
      if (typeCount > 1) {
        return 'mixed';
      } else if (hasImages) {
        return 'image';
      } else if (hasPdf) {
        return 'pdf';
      } else if (hasFiles) {
        return 'file';
      }
    }
    
    return 'text';
  },

  /**
   * 生成摘要
   */
  generateSummary(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // 简单的摘要生成：取前200个字符
    if (text.length <= 200) {
      return text;
    }
    
    return text.substring(0, 200) + '...';
  },

  /**
   * 生成分享配置
   */
  generateShareConfig(result) {
    return {
      title: `${result.serviceName}分析报告`,
      desc: '我刚刚完成了AI医疗服务分析，快来查看报告！',
      imageUrl: '/images/share-result.png'
    };
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
   * 预览图片
   */
  onPreviewImage(event) {
    const { current } = event.currentTarget.dataset;
    const urls = this.data.resultContent.images.map(img => img.url);
    
    wx.previewImage({
      current,
      urls,
      fail: (error) => {
        console.error('预览图片失败:', error);
        wx.showToast({
          title: '预览失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 下载文件
   */
  onDownloadFile(event) {
    const { url, name } = event.currentTarget.dataset;
    
    if (!url) {
      wx.showToast({
        title: '文件地址无效',
        icon: 'error'
      });
      return;
    }

    wx.showLoading({
      title: '下载中...'
    });

    wx.downloadFile({
      url,
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            success: () => {
              console.log('文件打开成功');
            },
            fail: (error) => {
              console.error('文件打开失败:', error);
              wx.showToast({
                title: '文件打开失败',
                icon: 'error'
              });
            }
          });
        } else {
          wx.showToast({
            title: '下载失败',
            icon: 'error'
          });
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('文件下载失败:', error);
        wx.showToast({
          title: '下载失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 显示评价弹窗
   */
  onShowRating() {
    if (this.data.hasRated) {
      wx.showToast({
        title: '您已评价过了',
        icon: 'none'
      });
      return;
    }

    this.setData({
      ratingVisible: true,
      currentRating: 5,
      ratingComment: ''
    });
  },

  /**
   * 隐藏评价弹窗
   */
  onHideRating() {
    this.setData({
      ratingVisible: false
    });
  },

  /**
   * 选择评分
   */
  onSelectRating(event) {
    const { rating } = event.currentTarget.dataset;
    this.setData({
      currentRating: rating
    });
  },

  /**
   * 评价输入
   */
  onRatingInput(event) {
    this.setData({
      ratingComment: event.detail.value
    });
  },

  /**
   * 提交评价
   */
  onSubmitRating() {
    const { currentRating, ratingComment, taskId } = this.data;
    
    if (!currentRating) {
      wx.showToast({
        title: '请选择评分',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '提交中...'
    });

    wx.request({
      url: `${app.globalData.baseUrl}/api/tasks/${taskId}/feedback`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        'Content-Type': 'application/json'
      },
      data: {
        rating: currentRating,
        comment: ratingComment.trim()
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({
            title: '感谢您的评价',
            icon: 'success'
          });
          
          this.setData({
            ratingVisible: false,
            hasRated: true
          });
          
        } else {
          wx.showToast({
            title: res.data.message || '评价失败',
            icon: 'error'
          });
        }
      },
      fail: (error) => {
        wx.hideLoading();
        console.error('提交评价失败:', error);
        wx.showToast({
          title: '网络错误',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 复制文本内容
   */
  onCopyText() {
    const { textContent } = this.data.resultContent;
    
    if (!textContent) {
      wx.showToast({
        title: '暂无文本内容',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: textContent,
      success: () => {
        wx.showToast({
          title: '复制成功',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 分享结果
   */
  onShareResult() {
    // 这里可以实现自定义分享逻辑
    // 小程序会自动调用 onShareAppMessage
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 返回上一页
   */
  onGoBack() {
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
    this.loadTaskResult();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadTaskResult();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  /**
   * 分享配置
   */
  onShareAppMessage() {
    const { shareConfig } = this.data;
    return {
      title: shareConfig.title,
      desc: shareConfig.desc,
      path: `/pages/result/result?taskId=${this.data.taskId}&orderId=${this.data.orderId}`,
      imageUrl: shareConfig.imageUrl
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { shareConfig } = this.data;
    return {
      title: shareConfig.title,
      imageUrl: shareConfig.imageUrl
    };
  }
});