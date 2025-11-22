import { Client } from 'minio';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  private client: Client;
  private bucketName: string;

  constructor() {
    this.client = new Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    this.bucketName = config.minio.bucketName;
    this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        console.log(`✅ Bucket '${this.bucketName}' created`);

        // Set bucket policy for public read
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };

        await this.client.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }
    } catch (error) {
      console.error('Error ensuring bucket:', error);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads'
  ): Promise<{ fileName: string; url: string }> {
    try {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${folder}/${uuidv4()}.${fileExt}`;

      await this.client.putObject(this.bucketName, fileName, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      });

      // Generate URL
      const url = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endPoint}:${
        config.minio.port
      }/${this.bucketName}/${fileName}`;

      return { fileName, url };
    } catch (error) {
      console.error('Upload file error:', error);
      throw new Error('Failed to upload file');
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, fileName);
    } catch (error) {
      console.error('Delete file error:', error);
      throw new Error('Failed to delete file');
    }
  }

  async getPresignedUrl(fileName: string, expiry: number = 3600): Promise<string> {
    try {
      const url = await this.client.presignedGetObject(this.bucketName, fileName, expiry);
      return url;
    } catch (error) {
      console.error('Get presigned URL error:', error);
      throw new Error('Failed to generate presigned URL');
    }
  }

  async listFiles(prefix: string = ''): Promise<string[]> {
    try {
      const stream = this.client.listObjectsV2(this.bucketName, prefix, true);
      const files: string[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (obj) => files.push(obj.name));
        stream.on('error', reject);
        stream.on('end', () => resolve(files));
      });
    } catch (error) {
      console.error('List files error:', error);
      throw new Error('Failed to list files');
    }
  }
}

export const storage = new StorageService();
