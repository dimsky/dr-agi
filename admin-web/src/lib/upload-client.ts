/**
 * 文件上传API测试工具
 */

// 支持的文件类型
const SUPPORTED_FILE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp',  // 图片
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',  // 文档
  'txt', 'csv', 'json',  // 文本
  'zip', 'rar'  // 压缩文件
];

// 最大文件大小（50MB）
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * 客户端文件验证
 */
export function validateFileClient(file: File): { valid: boolean; error?: string } {
  // 检查文件大小
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `文件大小超出限制，最大允许 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB` 
    };
  }

  // 检查文件扩展名
  const fileExt = file.name.toLowerCase().split('.').pop();
  if (!fileExt || !SUPPORTED_FILE_EXTENSIONS.includes(fileExt)) {
    return { 
      valid: false, 
      error: `不支持的文件类型，支持的类型: ${SUPPORTED_FILE_EXTENSIONS.join(', ')}` 
    };
  }

  return { valid: true };
}

/**
 * 上传文件到服务器
 */
export async function uploadFile(file: File, authToken?: string): Promise<{
  success: boolean;
  data?: {
    fileUrl: string;
    fileKey: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  };
  error?: {
    type: string;
    message: string;
    details?: Record<string, unknown>;
  };
}> {
  try {
    // 客户端预验证
    const clientValidation = validateFileClient(file);
    if (!clientValidation.valid) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: clientValidation.error!
        }
      };
    }

    // 创建FormData
    const formData = new FormData();
    formData.append('file', file);

    // 准备请求头
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // 发送请求
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    // 解析响应
    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || {
          type: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`
        }
      };
    }

    return result;

  } catch (error) {
    console.error('文件上传失败:', error);
    return {
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : '网络请求失败'
      }
    };
  }
}

/**
 * 获取上传配置
 */
export async function getUploadConfig(): Promise<{
  success: boolean;
  data?: {
    maxFileSize: number;
    supportedTypes: string[];
    s3Configured: boolean;
    timestamp: string;
  };
  error?: {
    type: string;
    message: string;
  };
}> {
  try {
    const response = await fetch('/api/upload', {
      method: 'GET',
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || {
          type: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`
        }
      };
    }

    return result;

  } catch (error) {
    console.error('获取上传配置失败:', error);
    return {
      success: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : '网络请求失败'
      }
    };
  }
}

/**
 * 使用示例
 */
export const uploadExamples = {
  /**
   * 基本上传示例
   */
  basic: async (fileInput: HTMLInputElement) => {
    const file = fileInput.files?.[0];
    if (!file) {
      console.log('请选择文件');
      return;
    }

    console.log('开始上传文件:', file.name);
    const result = await uploadFile(file);
    
    if (result.success) {
      console.log('上传成功:', result.data);
      return result.data?.fileUrl;
    } else {
      console.error('上传失败:', result.error);
      return null;
    }
  },

  /**
   * 带认证的上传示例
   */
  withAuth: async (file: File, token: string) => {
    console.log('开始认证上传:', file.name);
    const result = await uploadFile(file, token);
    
    if (result.success) {
      console.log('认证上传成功:', result.data);
      return result.data?.fileUrl;
    } else {
      console.error('认证上传失败:', result.error);
      return null;
    }
  },

  /**
   * 获取配置示例
   */
  getConfig: async () => {
    console.log('获取上传配置...');
    const result = await getUploadConfig();
    
    if (result.success) {
      console.log('配置获取成功:', result.data);
      return result.data;
    } else {
      console.error('配置获取失败:', result.error);
      return null;
    }
  }
};

// 类型导出
export interface UploadResult {
  success: boolean;
  data?: {
    fileUrl: string;
    fileKey: string;
    filename: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  };
  error?: {
    type: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface UploadConfig {
  maxFileSize: number;
  supportedTypes: string[];
  s3Configured: boolean;
  timestamp: string;
}