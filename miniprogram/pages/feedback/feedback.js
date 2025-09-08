// feedback.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 表单数据
    formData: {
      category: '',
      title: '',
      content: '',
      attachments: []
    },
    
    // 分类选项（与数据库模型保持一致）
    categoryOptions: [
      { value: 'bug_report', name: '错误报告', desc: '报告系统错误或故障' },
      { value: 'feature_request', name: '功能建议', desc: '建议新功能或改进现有功能' },
      { value: 'improvement', name: '改进建议', desc: '对现有功能的改进建议' },
      { value: 'user_experience', name: '用户体验', desc: '关于用户界面和交互体验的反馈' },
      { value: 'performance', name: '性能问题', desc: '系统性能相关问题' },
      { value: 'content_quality', name: '内容质量', desc: '对内容准确性和质量的反馈' },
      { value: 'service_quality', name: '服务质量', desc: '对医疗服务质量的反馈' },
      { value: 'other', name: '其他', desc: '其他类型的反馈和建议' }
    ],
    
    // 选中的分类索引
    selectedCategoryIndex: -1,
    
    // 状态标志
    isSubmitting: false,
    isLoggedIn: false,
    
    // 最大文件数量
    maxFileCount: 3,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    
    // 反馈编号（提交成功后生成）
    feedbackNumber: '',
    
    // 显示成功提示
    showSuccess: false
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
   * 检查登录状态
   */
  checkLoginStatus() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    
    this.setData({
      isLoggedIn: isLoggedIn && userInfo
    });
    
    if (!isLoggedIn) {
      wx.showModal({
        title: '需要登录',
        content: '请先登录后再提交反馈建议',
        showCancel: true,
        confirmText: '去登录',
        cancelText: '暂不登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/profile/profile'
            });
          } else {
            wx.navigateBack();
          }
        }
      });
    }
  },

  /**
   * 选择反馈分类
   */
  onCategoryChange(event) {
    const index = event.detail.value;
    const selectedCategory = this.data.categoryOptions[index];
    
    this.setData({
      selectedCategoryIndex: index,
      'formData.category': selectedCategory.value
    });
  },

  /**
   * 标题输入
   */
  onTitleInput(event) {
    const value = event.detail.value;
    this.setData({
      'formData.title': value
    });
  },

  /**
   * 内容输入
   */
  onContentInput(event) {
    const value = event.detail.value;
    this.setData({
      'formData.content': value
    });
  },

  /**
   * 选择附件
   */
  onChooseAttachment() {
    const currentAttachments = this.data.formData.attachments;
    
    if (currentAttachments.length >= this.data.maxFileCount) {
      wx.showToast({
        title: `最多只能上传${this.data.maxFileCount}个文件`,
        icon: 'none'
      });
      return;
    }
    
    wx.chooseMedia({
      count: this.data.maxFileCount - currentAttachments.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        const tempFiles = res.tempFiles;
        
        // 检查文件大小
        for (let file of tempFiles) {
          if (file.size > this.data.maxFileSize) {
            wx.showToast({
              title: '文件大小不能超过10MB',
              icon: 'none'
            });
            return;
          }
        }
        
        // 添加到附件列表
        const newAttachments = [...currentAttachments, ...tempFiles.map(file => ({
          tempFilePath: file.tempFilePath,
          size: file.size
        }))];
        
        this.setData({
          'formData.attachments': newAttachments
        });
      },
      fail: (error) => {
        console.error('选择文件失败:', error);
        wx.showToast({
          title: '选择文件失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 删除附件
   */
  onDeleteAttachment(event) {
    const index = event.currentTarget.dataset.index;
    const attachments = this.data.formData.attachments;
    
    wx.showModal({
      title: '删除附件',
      content: '确定要删除这个附件吗？',
      success: (res) => {
        if (res.confirm) {
          attachments.splice(index, 1);
          this.setData({
            'formData.attachments': attachments
          });
        }
      }
    });
  },

  /**
   * 预览附件
   */
  onPreviewAttachment(event) {
    const index = event.currentTarget.dataset.index;
    const attachment = this.data.formData.attachments[index];
    
    wx.previewImage({
      current: attachment.tempFilePath,
      urls: this.data.formData.attachments.map(item => item.tempFilePath)
    });
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { category, title, content } = this.data.formData;
    
    if (!category) {
      wx.showToast({
        title: '请选择反馈分类',
        icon: 'none'
      });
      return false;
    }
    
    if (!title || title.trim().length === 0) {
      wx.showToast({
        title: '请输入反馈标题',
        icon: 'none'
      });
      return false;
    }
    
    if (title.trim().length > 100) {
      wx.showToast({
        title: '标题长度不能超过100字符',
        icon: 'none'
      });
      return false;
    }
    
    if (!content || content.trim().length === 0) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      });
      return false;
    }
    
    if (content.trim().length < 10) {
      wx.showToast({
        title: '反馈内容至少需要10个字符',
        icon: 'none'
      });
      return false;
    }
    
    if (content.trim().length > 2000) {
      wx.showToast({
        title: '反馈内容不能超过2000字符',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  /**
   * 生成反馈编号
   */
  generateFeedbackNumber() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `FB${timestamp}${random}`.toUpperCase();
  },

  /**
   * 上传附件
   */
  uploadAttachments(feedbackId) {
    const attachments = this.data.formData.attachments;
    if (attachments.length === 0) {
      return Promise.resolve([]);
    }
    
    const token = wx.getStorageSync('token');
    const uploadPromises = attachments.map((attachment, index) => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/api/feedback/upload`,
          filePath: attachment.tempFilePath,
          name: 'attachment',
          formData: {
            feedbackId: feedbackId,
            index: index
          },
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              if (data.success) {
                resolve(data.attachmentUrl);
              } else {
                reject(new Error(data.error || '上传失败'));
              }
            } catch (error) {
              reject(new Error('解析响应数据失败'));
            }
          },
          fail: (error) => {
            reject(error);
          }
        });
      });
    });
    
    return Promise.all(uploadPromises);
  },

  /**
   * 提交反馈
   */
  onSubmitFeedback() {
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      this.checkLoginStatus();
      return;
    }
    
    // 表单验证
    if (!this.validateForm()) {
      return;
    }
    
    // 防止重复提交
    if (this.data.isSubmitting) {
      return;
    }
    
    this.setData({
      isSubmitting: true
    });
    
    wx.showLoading({
      title: '提交中...'
    });
    
    const token = wx.getStorageSync('token');
    const feedbackNumber = this.generateFeedbackNumber();
    const { category, title, content } = this.data.formData;
    
    // 提交反馈数据
    wx.request({
      url: `${app.globalData.baseUrl}/api/feedback`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        category: category,
        title: title.trim(),
        content: content.trim(),
        feedbackNumber: feedbackNumber
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          const feedbackId = res.data.feedback.id;
          
          // 如果有附件，上传附件
          if (this.data.formData.attachments.length > 0) {
            this.uploadAttachments(feedbackId)
              .then(() => {
                this.showSuccessResult(feedbackNumber);
              })
              .catch((error) => {
                console.error('上传附件失败:', error);
                // 即使附件上传失败，反馈也算提交成功
                this.showSuccessResult(feedbackNumber);
                wx.showToast({
                  title: '附件上传失败，但反馈已提交',
                  icon: 'none'
                });
              });
          } else {
            this.showSuccessResult(feedbackNumber);
          }
        } else {
          wx.showToast({
            title: res.data.error || '提交失败',
            icon: 'error'
          });
        }
      },
      fail: (error) => {
        console.error('提交反馈失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'error'
        });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({
          isSubmitting: false
        });
      }
    });
  },

  /**
   * 显示成功结果
   */
  showSuccessResult(feedbackNumber) {
    this.setData({
      feedbackNumber: feedbackNumber,
      showSuccess: true
    });
    
    // 清空表单
    this.setData({
      formData: {
        category: '',
        title: '',
        content: '',
        attachments: []
      },
      selectedCategoryIndex: -1
    });
    
    // 3秒后自动隐藏成功提示
    setTimeout(() => {
      this.setData({
        showSuccess: false
      });
    }, 5000);
  },

  /**
   * 关闭成功提示
   */
  onCloseSuccess() {
    this.setData({
      showSuccess: false
    });
  },

  /**
   * 复制反馈编号
   */
  onCopyFeedbackNumber() {
    wx.setClipboardData({
      data: this.data.feedbackNumber,
      success: () => {
        wx.showToast({
          title: '反馈编号已复制',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 查看我的反馈记录
   */
  onViewMyFeedback() {
    wx.navigateTo({
      url: '/pages/feedback-history/feedback-history'
    });
  },

  /**
   * 重置表单
   */
  onResetForm() {
    wx.showModal({
      title: '重置表单',
      content: '确定要清空所有输入的内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            formData: {
              category: '',
              title: '',
              content: '',
              attachments: []
            },
            selectedCategoryIndex: -1
          });
          
          wx.showToast({
            title: '表单已清空',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 页面分享配置
   */
  onShareAppMessage() {
    return {
      title: 'DR.Agent AI 医学服务平台 - 意见反馈',
      path: '/pages/feedback/feedback',
      imageUrl: '/images/share-feedback.png'
    };
  },

  /**
   * 页面分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: 'DR.Agent AI 医学服务平台 - 意见反馈',
      imageUrl: '/images/share-feedback.png'
    };
  }
});