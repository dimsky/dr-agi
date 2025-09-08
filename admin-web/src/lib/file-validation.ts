import { ErrorType } from './error-handler';

// 支持的文件类型配置
export const SUPPORTED_FILE_TYPES = {
  // 图片类型
  'image/jpeg': { ext: ['.jpg', '.jpeg'], maxSize: 10 * 1024 * 1024 }, // 10MB
  'image/png': { ext: ['.png'], maxSize: 10 * 1024 * 1024 }, // 10MB
  'image/gif': { ext: ['.gif'], maxSize: 5 * 1024 * 1024 }, // 5MB
  'image/webp': { ext: ['.webp'], maxSize: 10 * 1024 * 1024 }, // 10MB
  
  // 文档类型
  'application/pdf': { ext: ['.pdf'], maxSize: 50 * 1024 * 1024 }, // 50MB
  'application/msword': { ext: ['.doc'], maxSize: 30 * 1024 * 1024 }, // 30MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    ext: ['.docx'], 
    maxSize: 30 * 1024 * 1024 // 30MB
  },
  'application/vnd.ms-excel': { ext: ['.xls'], maxSize: 20 * 1024 * 1024 }, // 20MB
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { 
    ext: ['.xlsx'], 
    maxSize: 20 * 1024 * 1024 // 20MB
  },
  'application/vnd.ms-powerpoint': { ext: ['.ppt'], maxSize: 50 * 1024 * 1024 }, // 50MB
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { 
    ext: ['.pptx'], 
    maxSize: 50 * 1024 * 1024 // 50MB
  },
  
  // 文本类型
  'text/plain': { ext: ['.txt'], maxSize: 1 * 1024 * 1024 }, // 1MB
  'text/csv': { ext: ['.csv'], maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/json': { ext: ['.json'], maxSize: 5 * 1024 * 1024 }, // 5MB
  
  // 压缩文件
  'application/zip': { ext: ['.zip'], maxSize: 100 * 1024 * 1024 }, // 100MB
  'application/x-rar-compressed': { ext: ['.rar'], maxSize: 100 * 1024 * 1024 }, // 100MB
} as const;

// 全局最大文件大小（50MB）
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// 危险文件扩展名黑名单
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.sh', '.php', '.py', '.pl', '.rb', '.asp', '.aspx', '.jsp', '.jsp'
];

// 文件验证结果接口
export interface FileValidationResult {
  isValid: boolean;
  error?: {
    type: ErrorType;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 验证文件类型
 */
function validateFileType(mimeType: string, filename: string): FileValidationResult {
  // 检查MIME类型是否被支持
  if (!(mimeType in SUPPORTED_FILE_TYPES)) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: `不支持的文件类型: ${mimeType}`,
        details: { 
          mimeType, 
          supportedTypes: Object.keys(SUPPORTED_FILE_TYPES) 
        }
      }
    };
  }

  // 检查文件扩展名
  const fileExt = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const typeConfig = SUPPORTED_FILE_TYPES[mimeType as keyof typeof SUPPORTED_FILE_TYPES];
  
  if (typeConfig) {
    const isValidExt = typeConfig.ext.some(ext => ext === fileExt);
    if (!isValidExt) {
      return {
        isValid: false,
        error: {
          type: ErrorType.FILE_UPLOAD,
          message: `文件扩展名与MIME类型不匹配`,
          details: { 
            filename,
            mimeType,
            expectedExtensions: typeConfig.ext,
            actualExtension: fileExt
          }
        }
      };
    }
  }

  return { isValid: true };
}

/**
 * 验证文件大小
 */
function validateFileSize(size: number, mimeType: string): FileValidationResult {
  // 检查全局最大大小限制
  if (size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: `文件大小超出限制，最大允许 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB`,
        details: { 
          fileSize: size, 
          maxSize: MAX_FILE_SIZE,
          fileSizeMB: Math.round(size / 1024 / 1024 * 100) / 100
        }
      }
    };
  }

  // 检查特定类型的大小限制
  if (mimeType in SUPPORTED_FILE_TYPES) {
    const typeConfig = SUPPORTED_FILE_TYPES[mimeType as keyof typeof SUPPORTED_FILE_TYPES];
    if (size > typeConfig.maxSize) {
      return {
        isValid: false,
        error: {
          type: ErrorType.FILE_UPLOAD,
          message: `${mimeType} 类型文件大小超出限制，最大允许 ${Math.floor(typeConfig.maxSize / 1024 / 1024)}MB`,
          details: { 
            fileSize: size, 
            maxSizeForType: typeConfig.maxSize,
            mimeType,
            fileSizeMB: Math.round(size / 1024 / 1024 * 100) / 100
          }
        }
      };
    }
  }

  return { isValid: true };
}

/**
 * 验证文件名安全性
 */
function validateFilename(filename: string): FileValidationResult {
  // 检查文件名长度
  if (filename.length > 255) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: '文件名过长，最多允许255个字符',
        details: { filename, maxLength: 255 }
      }
    };
  }

  // 检查危险字符
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: '文件名包含非法字符',
        details: { filename }
      }
    };
  }

  // 检查危险扩展名
  const fileExt = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (DANGEROUS_EXTENSIONS.includes(fileExt)) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: `危险的文件类型: ${fileExt}`,
        details: { filename, extension: fileExt }
      }
    };
  }

  // 检查相对路径攻击
  if (filename.includes('../') || filename.includes('..\\')) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: '文件名包含非法路径字符',
        details: { filename }
      }
    };
  }

  return { isValid: true };
}

/**
 * 基础病毒扫描（文件头检查）
 */
async function performBasicVirusScan(buffer: Buffer, filename: string): Promise<FileValidationResult> {
  // 检查文件是否为空
  if (buffer.length === 0) {
    return {
      isValid: false,
      error: {
        type: ErrorType.FILE_UPLOAD,
        message: '文件内容为空',
        details: { filename }
      }
    };
  }

  // 检查常见的恶意文件签名
  const maliciousSignatures = [
    // PE executable signatures
    Buffer.from([0x4D, 0x5A]), // MZ header
    // Script signatures that shouldn't be in document files
    Buffer.from('<?php'), // PHP
    Buffer.from('<script'), // JavaScript in unexpected files
  ];

  const fileStart = buffer.slice(0, 100); // 检查前100字节
  
  for (const signature of maliciousSignatures) {
    if (fileStart.includes(signature)) {
      return {
        isValid: false,
        error: {
          type: ErrorType.FILE_UPLOAD,
          message: '检测到潜在恶意文件',
          details: { filename }
        }
      };
    }
  }

  // 检查文件头是否与声明的MIME类型匹配
  // const mimeSignatures = {
  //   'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  //   'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG
  //   'image/png': [0x89, 0x50, 0x4E, 0x47], // PNG
  //   'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF8
  //   'application/zip': [0x50, 0x4B, 0x03, 0x04], // ZIP/Office files
  // };

  // 这里可以扩展更复杂的病毒扫描逻辑
  // 在生产环境中，建议集成专业的反病毒服务如 ClamAV

  return { isValid: true };
}

/**
 * 综合文件验证
 */
export async function validateFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<FileValidationResult> {
  // 1. 验证文件名
  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.isValid) {
    return filenameValidation;
  }

  // 2. 验证文件类型
  const typeValidation = validateFileType(mimeType, filename);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // 3. 验证文件大小
  const sizeValidation = validateFileSize(buffer.length, mimeType);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }

  // 4. 进行基础病毒扫描
  const virusScanResult = await performBasicVirusScan(buffer, filename);
  if (!virusScanResult.isValid) {
    return virusScanResult;
  }

  return { isValid: true };
}