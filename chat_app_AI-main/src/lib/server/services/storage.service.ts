import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.cloudflare.accessKeyId,
    secretAccessKey: config.cloudflare.secretAccessKey,
  },
});

export class StorageService {
  async uploadImage(file: Express.Multer.File): Promise<string> {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const key = `images/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: config.cloudflare.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000',
      });

      await s3Client.send(command);

      // Return public URL
      const publicUrl = `${config.cloudflare.publicUrl}/${key}`;
      logger.info('Image uploaded successfully', { key, publicUrl });
      
      return publicUrl;
    } catch (error) {
      logger.error('Image upload failed', error);
      throw new Error('Failed to upload image');
    }
  }

  async deleteImage(url: string): Promise<void> {
    try {
      // Extract key from URL
      const key = url.replace(`${config.cloudflare.publicUrl}/`, '');

      const command = new DeleteObjectCommand({
        Bucket: config.cloudflare.bucketName,
        Key: key,
      });

      await s3Client.send(command);
      logger.info('Image deleted successfully', { key });
    } catch (error) {
      logger.error('Image deletion failed', error);
      throw new Error('Failed to delete image');
    }
  }

  validateImageFile(file: Express.Multer.File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    if (file.size > maxSize) {
      throw new Error('File size exceeds 5MB limit.');
    }

    return true;
  }
}

export const storageService = new StorageService();
