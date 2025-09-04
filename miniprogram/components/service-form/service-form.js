/**
 * 动态服务表单组件
 * 根据服务类型动态生成表单，支持文本输入、文件上传、选择器
 */

// 配置常量
const CONFIG = {
  // 文件上传限制
  FILE_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_TYPES: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
  // API地址
  API_BASE_URL: 'https://your-domain.com/api',
  // 请求超时时间
  REQUEST_TIMEOUT: 30000
};

// 预定义的表单模板
const FORM_TEMPLATES = {
  // 健康咨询服务
  'health-consultation': {
    title: '健康咨询服务',
    fields: [
      {
        type: 'text',
        key: 'symptoms',
        label: '症状描述',
        placeholder: '请详细描述您的症状',
        required: true,
        maxLength: 500
      },
      {
        type: 'text',
        key: 'duration',
        label: '持续时间',
        placeholder: '如：3天、1周等',
        required: true,
        maxLength: 50
      },
      {
        type: 'picker',
        key: 'urgency',
        label: '紧急程度',
        options: ['不紧急', '一般', '紧急', '非常紧急'],
        required: true
      },
      {
        type: 'file',
        key: 'medical_files',
        label: '相关病历或检查报告',
        accept: 'image/*,.pdf,.doc,.docx',
        multiple: true,
        required: false
      }
    ]
  },
  
  // 体检报告解读
  'report-analysis': {
    title: '体检报告解读',
    fields: [
      {
        type: 'file',
        key: 'report_files',
        label: '体检报告文件',
        accept: 'image/*,.pdf',
        multiple: true,
        required: true
      },
      {
        type: 'textarea',
        key: 'concerns',
        label: '特别关注的项目',
        placeholder: '请描述您特别关注或担心的检查项目',
        required: false,
        maxLength: 300
      },
      {
        type: 'picker',
        key: 'report_type',
        label: '报告类型',
        options: ['常规体检', '入职体检', '专项检查', '其他'],
        required: true
      }
    ]
  },
  
  // 用药指导
  'medication-guide': {
    title: '用药指导',
    fields: [
      {
        type: 'text',
        key: 'medication_name',
        label: '药品名称',
        placeholder: '请输入药品名称',
        required: true,
        maxLength: 100
      },
      {
        type: 'textarea',
        key: 'current_condition',
        label: '当前病情描述',
        placeholder: '请描述目前的身体状况和症状',
        required: true,
        maxLength: 500
      },
      {
        type: 'text',
        key: 'age',
        label: '年龄',
        placeholder: '请输入年龄',
        required: true,
        maxLength: 3
      },
      {
        type: 'picker',
        key: 'gender',
        label: '性别',
        options: ['男', '女'],
        required: true
      },
      {
        type: 'file',
        key: 'prescription_image',
        label: '处方或药品图片',
        accept: 'image/*',
        multiple: false,
        required: false
      }
    ]
  }
};

Component({
  properties: {
    // 服务类型
    serviceType: {
      type: String,
      value: '',
      observer: 'onServiceTypeChange'
    },
    // 自定义表单配置
    customSchema: {
      type: Object,
      value: null,
      observer: 'onSchemaChange'
    }
  },

  data: {
    formData: {},           // 表单数据
    formErrors: {},         // 表单错误
    formSchema: null,       // 当前表单结构
    isSubmitting: false,    // 提交状态
    isValid: false,         // 表单是否有效
    uploadedFiles: {}       // 已上传的文件
  },

  lifetimes: {
    /**
     * 组件初始化
     */
    attached() {
      console.log('🔧 动态服务表单组件初始化');
      this.initializeForm();
    }
  },

  methods: {
    /**
     * 初始化表单
     */
    initializeForm() {
      if (this.data.serviceType) {
        this.renderForm(this.data.serviceType);
      } else if (this.data.customSchema) {
        this.renderCustomForm(this.data.customSchema);
      }
    },

    /**
     * 服务类型变化处理
     */
    onServiceTypeChange(newType) {
      if (newType) {
        this.renderForm(newType);
      }
    },

    /**
     * 自定义表单配置变化处理
     */
    onSchemaChange(newSchema) {
      if (newSchema) {
        this.renderCustomForm(newSchema);
      }
    },

    /**
     * 根据服务类型渲染表单
     */
    renderForm(serviceType) {
      const schema = FORM_TEMPLATES[serviceType];
      if (!schema) {
        console.error(`❌ 未找到服务类型 ${serviceType} 的表单模板`);
        return;
      }

      console.log(`📋 渲染 ${serviceType} 服务表单`);
      this.setData({
        formSchema: schema,
        formData: {},
        formErrors: {},
        uploadedFiles: {},
        isValid: false
      });
    },

    /**
     * 渲染自定义表单
     */
    renderCustomForm(schema) {
      console.log('📋 渲染自定义表单');
      this.setData({
        formSchema: schema,
        formData: {},
        formErrors: {},
        uploadedFiles: {},
        isValid: false
      });
    },

    /**
     * 处理输入变化
     */
    onInputChange(event) {
      const { field } = event.currentTarget.dataset;
      const value = event.detail.value;
      
      const formData = { ...this.data.formData };
      formData[field] = value;
      
      // 清除该字段的错误信息
      const formErrors = { ...this.data.formErrors };
      if (formErrors[field]) {
        delete formErrors[field];
      }
      
      this.setData({
        formData,
        formErrors
      });
      
      // 重新验证表单
      this.validateForm();
    },

    /**
     * 处理选择器变化
     */
    onPickerChange(event) {
      const { field, options } = event.currentTarget.dataset;
      const index = event.detail.value;
      const selectedValue = options[index];
      
      const formData = { ...this.data.formData };
      formData[field] = selectedValue;
      
      // 清除该字段的错误信息
      const formErrors = { ...this.data.formErrors };
      if (formErrors[field]) {
        delete formErrors[field];
      }
      
      this.setData({
        formData,
        formErrors
      });
      
      // 重新验证表单
      this.validateForm();
    },

    /**
     * 处理文件上传
     */
    async onFileUpload(event) {
      const { field } = event.currentTarget.dataset;
      const fieldConfig = this.data.formSchema.fields.find(f => f.key === field);
      
      if (!fieldConfig) {
        return;
      }
      
      try {
        wx.showLoading({ title: '选择文件中...' });
        
        // 选择文件
        const chooseResult = await this.chooseFile(fieldConfig);
        wx.hideLoading();
        
        if (!chooseResult || !chooseResult.tempFilePaths.length) {
          return;
        }
        
        wx.showLoading({ title: '上传文件中...' });
        
        // 上传文件
        const uploadPromises = chooseResult.tempFilePaths.map(async (filePath, index) => {
          // 验证文件
          const fileInfo = await this.getFileInfo(filePath);
          this.validateFile(fileInfo);
          
          // 上传到服务器
          return this.uploadFile(filePath, field, index);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        wx.hideLoading();
        
        // 更新上传的文件列表
        const uploadedFiles = { ...this.data.uploadedFiles };
        if (!uploadedFiles[field]) {
          uploadedFiles[field] = [];
        }
        
        if (fieldConfig.multiple) {
          uploadedFiles[field] = [...uploadedFiles[field], ...uploadResults];
        } else {
          uploadedFiles[field] = [uploadResults[0]];
        }
        
        // 更新表单数据
        const formData = { ...this.data.formData };
        formData[field] = uploadedFiles[field];
        
        // 清除该字段的错误信息
        const formErrors = { ...this.data.formErrors };
        if (formErrors[field]) {
          delete formErrors[field];
        }
        
        this.setData({
          formData,
          formErrors,
          uploadedFiles
        });
        
        // 重新验证表单
        this.validateForm();
        
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
        
      } catch (error) {
        wx.hideLoading();
        console.error('❌ 文件上传失败:', error);
        
        wx.showToast({
          title: error.message || '上传失败',
          icon: 'none',
          duration: 3000
        });
      }
    },

    /**
     * 选择文件
     */
    chooseFile(fieldConfig) {
      return new Promise((resolve, reject) => {
        if (fieldConfig.accept && fieldConfig.accept.includes('image')) {
          // 选择图片
          wx.chooseImage({
            count: fieldConfig.multiple ? 9 : 1,
            sizeType: ['original', 'compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          });
        } else {
          // 选择文件（微信小程序限制，主要是图片）
          wx.chooseMessageFile({
            count: fieldConfig.multiple ? 10 : 1,
            type: 'file',
            success: resolve,
            fail: reject
          });
        }
      });
    },

    /**
     * 获取文件信息
     */
    getFileInfo(filePath) {
      return new Promise((resolve, reject) => {
        wx.getFileInfo({
          filePath: filePath,
          success: resolve,
          fail: reject
        });
      });
    },

    /**
     * 验证文件
     */
    validateFile(fileInfo) {
      // 检查文件大小
      if (fileInfo.size > CONFIG.FILE_MAX_SIZE) {
        throw new Error(`文件大小不能超过${Math.round(CONFIG.FILE_MAX_SIZE / 1024 / 1024)}MB`);
      }
      
      // 检查文件类型（基于文件路径扩展名）
      const extension = fileInfo.filePath.split('.').pop().toLowerCase();
      if (!CONFIG.ALLOWED_FILE_TYPES.includes(extension)) {
        throw new Error(`不支持的文件类型：${extension}`);
      }
    },

    /**
     * 上传文件到服务器
     */
    uploadFile(filePath, fieldKey, index) {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${CONFIG.API_BASE_URL}/upload`,
          filePath: filePath,
          name: 'file',
          formData: {
            field: fieldKey,
            index: index
          },
          timeout: CONFIG.REQUEST_TIMEOUT,
          success: (response) => {
            try {
              const result = JSON.parse(response.data);
              if (result.success) {
                resolve({
                  url: result.url,
                  name: result.filename,
                  size: result.size
                });
              } else {
                reject(new Error(result.error || '上传失败'));
              }
            } catch (error) {
              reject(new Error('服务器响应格式错误'));
            }
          },
          fail: (error) => {
            reject(new Error(`上传失败: ${error.errMsg}`));
          }
        });
      });
    },

    /**
     * 删除已上传的文件
     */
    onRemoveFile(event) {
      const { field, index } = event.currentTarget.dataset;
      
      const uploadedFiles = { ...this.data.uploadedFiles };
      if (uploadedFiles[field] && uploadedFiles[field][index]) {
        uploadedFiles[field].splice(index, 1);
        
        // 更新表单数据
        const formData = { ...this.data.formData };
        formData[field] = uploadedFiles[field];
        
        this.setData({
          formData,
          uploadedFiles
        });
        
        // 重新验证表单
        this.validateForm();
      }
    },

    /**
     * 表单验证
     */
    validateForm() {
      if (!this.data.formSchema) {
        return false;
      }
      
      const errors = {};
      const formData = this.data.formData;
      
      // 验证每个字段
      for (const field of this.data.formSchema.fields) {
        const value = formData[field.key];
        
        // 必填验证
        if (field.required) {
          if (!value || (Array.isArray(value) && value.length === 0)) {
            errors[field.key] = `${field.label}为必填项`;
            continue;
          }
        }
        
        // 长度验证
        if (field.maxLength && value && value.length > field.maxLength) {
          errors[field.key] = `${field.label}长度不能超过${field.maxLength}个字符`;
        }
        
        // 数字验证
        if (field.type === 'number' && value && isNaN(Number(value))) {
          errors[field.key] = `${field.label}必须是数字`;
        }
      }
      
      const isValid = Object.keys(errors).length === 0;
      
      this.setData({
        formErrors: errors,
        isValid: isValid
      });
      
      return isValid;
    },

    /**
     * 提交表单
     */
    async onSubmit() {
      if (this.data.isSubmitting) {
        return;
      }
      
      // 验证表单
      if (!this.validateForm()) {
        wx.showToast({
          title: '请完善表单信息',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      this.setData({ isSubmitting: true });
      
      try {
        // 触发提交事件，让父组件处理
        this.triggerEvent('submit', {
          serviceType: this.data.serviceType,
          formData: this.data.formData,
          schema: this.data.formSchema
        });
        
        console.log('✅ 表单提交成功:', this.data.formData);
        
      } catch (error) {
        console.error('❌ 表单提交失败:', error);
        
        wx.showToast({
          title: '提交失败，请重试',
          icon: 'none',
          duration: 3000
        });
      } finally {
        this.setData({ isSubmitting: false });
      }
    },

    /**
     * 重置表单
     */
    resetForm() {
      this.setData({
        formData: {},
        formErrors: {},
        uploadedFiles: {},
        isValid: false
      });
    },

    /**
     * 获取表单数据
     */
    getFormData() {
      return {
        isValid: this.data.isValid,
        formData: this.data.formData,
        errors: this.data.formErrors
      };
    }
  }
});