import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { getS3Client, getS3BucketName, generateFileKey, getPublicFileUrl } from '@/lib/s3-client';
import { validateFile } from '@/lib/file-validation';
import { withErrorHandler, createError } from '@/lib/error-handler';

// 上传响应接口
interface UploadResponse {
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

/**
 * POST /api/upload
 * 处理文件上传
 */
async function uploadHandler(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    console.log('🚀 开始处理文件上传请求...');

    // 检查请求类型
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      throw createError.validation('请求必须是 multipart/form-data 格式');
    }

    // 解析FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw createError.validation('未找到上传文件');
    }

    console.log(`📄 接收到文件: ${file.name}, 大小: ${file.size} bytes, 类型: ${file.type}`);

    // 将文件转换为Buffer以进行验证
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 进行文件安全验证
    console.log('🔍 开始文件安全验证...');
    const validation = await validateFile(buffer, file.name, file.type);
    
    if (!validation.isValid && validation.error) {
      throw createError.validation(validation.error.message, validation.error.details);
    }

    // 获取用户ID（从Token中提取，这里暂时使用匿名用户）
    // 在真实应用中，你需要从JWT token中提取用户ID
    const userId = extractUserIdFromRequest(request);

    // 生成唯一的文件键
    const fileKey = generateFileKey(file.name, userId);
    console.log(`🗝️ 生成文件键: ${fileKey}`);

    // 准备S3上传参数
    const s3Client = getS3Client();
    const bucketName = getS3BucketName();

    const uploadParams: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: file.type,
      ContentLength: buffer.length,
      Metadata: {
        'original-filename': encodeURIComponent(file.name),
        'upload-timestamp': new Date().toISOString(),
        'user-id': userId || 'anonymous',
      },
      // 设置文件访问权限为私有（根据需要调整）
      ACL: 'private',
    };

    // 执行S3上传
    console.log('☁️ 开始上传到S3...');
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    console.log('✅ 文件上传成功');

    // 生成文件访问URL
    const fileUrl = getPublicFileUrl(fileKey);

    // 返回成功响应
    const response: UploadResponse = {
      success: true,
      data: {
        fileUrl,
        fileKey,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ 文件上传失败:', error);
    throw error; // 让错误处理中间件处理
  }
}

/**
 * 从请求中提取用户ID
 * 这是一个占位函数，在真实应用中需要实现JWT验证
 */
function extractUserIdFromRequest(_request: NextRequest): string | undefined {
  // TODO: 实现JWT token验证和用户ID提取
  // const token = _request.headers.get('authorization')?.replace('Bearer ', '');
  // if (token) {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   return decoded.userId;
  // }
  
  // 暂时返回undefined，表示匿名用户
  return undefined;
}

/**
 * GET /api/upload
 * 获取上传配置信息（用于前端）
 */
async function getUploadConfigHandler(): Promise<NextResponse> {
  const config = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    supportedTypes: [
      // 图片类型
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // 文档类型
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // 文本类型
      'text/plain', 'text/csv', 'application/json',
      // 压缩文件
      'application/zip', 'application/x-rar-compressed'
    ],
    s3Configured: !!process.env.AWS_S3_BUCKET_NAME,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({ success: true, data: config });
}

// 使用错误处理中间件包装处理函数
export const POST = withErrorHandler(uploadHandler);
export const GET = withErrorHandler(getUploadConfigHandler);