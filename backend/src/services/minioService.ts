import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const minioClient = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1', // MinIO requires a region, even a dummy one
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || '',
    secretAccessKey: process.env.MINIO_SECRET_KEY || ''
  },
  forcePathStyle: true, // Needed for MinIO
});

const bucketName = process.env.MINIO_BUCKET_NAME || 'kalend-ai-images';

export let isLocalFallback = false;

export async function initializeMinio(): Promise<void> {
  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
    console.warn('⚠️ MinIO is not fully configured in environment variables. Falling back to local storage.');
    isLocalFallback = true;
    return;
  }

  const maxRetries = 3;
  const retryDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxRetries}] Checking/Configuring MinIO bucket: ${bucketName}...`);
      
      const headPromise = minioClient.send(new HeadBucketCommand({ Bucket: bucketName }));
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('MinIO connection timeout')), 3000));
      
      await Promise.race([headPromise, timeoutPromise]);
      console.log(`✅ MinIO connected. Bucket "${bucketName}" already exists.`);
      isLocalFallback = false;
      return; // Success!
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        try {
          await minioClient.send(new CreateBucketCommand({ Bucket: bucketName }));
          console.log(`✅ MinIO connected. Bucket "${bucketName}" created successfully.`);
          isLocalFallback = false;
          return; // Success!
        } catch (createErr: any) {
          console.error('❌ Error creating MinIO bucket:', createErr.message);
        }
      }
      
      console.warn(`⚠️ [Attempt ${attempt}/${maxRetries}] Failed to connect to MinIO: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  console.warn('⚠️ MinIO is not running or accessible. Falling back to local filesystem storage for attachments.');
  isLocalFallback = true;
}

export async function getPresignedUrl(objectKey: string): Promise<string> {
  if (isLocalFallback) {
    return `/uploads/${objectKey}`;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    
    // URL expires in 1 hour
    const url = await getSignedUrl(minioClient, command, { expiresIn: 3600 });

    // Transform internal Docker minio hostname to public endpoint for external browser consumption
    if (process.env.MINIO_PUBLIC_URL) {
      const internalEndpoint = process.env.MINIO_ENDPOINT || 'http://minio:9000';
      if (url.startsWith(internalEndpoint)) {
        return url.replace(internalEndpoint, process.env.MINIO_PUBLIC_URL);
      }

      // Also support replacing standard variations (e.g. minio container dns http://minio:9000)
      const containerEndpoint = 'http://minio:9000';
      if (url.startsWith(containerEndpoint)) {
        return url.replace(containerEndpoint, process.env.MINIO_PUBLIC_URL);
      }
    }
    
    return url;
  } catch (err: any) {
    console.error(`Error generating presigned URL for ${objectKey}:`, err.message);
    return '';
  }
}

export async function uploadFile(fileBuffer: Buffer, objectKey: string, mimeType: string): Promise<string> {
  if (isLocalFallback) {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, objectKey);
    await fs.promises.writeFile(filePath, fileBuffer);
    return objectKey;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });
  await minioClient.send(command);
  return objectKey;
}

export async function deleteFile(objectKey: string): Promise<void> {
  if (isLocalFallback) {
    const filePath = path.join(process.cwd(), 'uploads', objectKey);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err: any) {
      console.error(`Error deleting local file ${objectKey}:`, err.message);
    }
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });
  await minioClient.send(command);
}
