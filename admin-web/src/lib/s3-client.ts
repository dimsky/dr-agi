import { S3Client } from '@aws-sdk/client-s3';

// AWS S3 配置验证
function validateS3Config() {
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET_NAME'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`缺少必需的 AWS S3 环境变量: ${missing.join(', ')}`);
  }
}

// 创建S3客户端实例
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    validateS3Config();
    
    s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  
  return s3Client;
}

// S3 存储桶名称
export function getS3BucketName(): string {
  if (!process.env.AWS_S3_BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME 环境变量未配置');
  }
  return process.env.AWS_S3_BUCKET_NAME;
}

// 生成唯一文件键
export function generateFileKey(originalName: string, userId?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomId = Math.random().toString(36).substring(2, 15);
  const ext = originalName.split('.').pop();
  
  const prefix = userId ? `uploads/${userId}` : 'uploads/anonymous';
  return `${prefix}/${timestamp}-${randomId}.${ext}`;
}

// 获取文件公共访问URL
export function getPublicFileUrl(fileKey: string): string {
  const bucketName = getS3BucketName();
  const region = process.env.AWS_REGION;
  return `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;
}