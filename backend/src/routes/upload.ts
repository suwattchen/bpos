import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { storage } from '../utils/storage';
import { config } from '../config';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${config.upload.allowedMimeTypes.join(', ')}`));
    }
  },
});

// Upload product image
router.post(
  '/product-image',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await storage.uploadFile(req.file, 'products');

      res.json({
        fileName: result.fileName,
        url: result.url,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Upload error:', error);
      throw new AppError('Failed to upload file', 500);
    }
  }
);

// Upload multiple files
router.post(
  '/multiple',
  authenticate,
  upload.array('images', 10),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.files || (req.files as any[]).length === 0) {
        throw new AppError('No files uploaded', 400);
      }

      const files = req.files as any[];
      const results = await Promise.all(
        files.map((file) => storage.uploadFile(file, 'products'))
      );

      res.json({
        files: results.map((result, index) => ({
          fileName: result.fileName,
          url: result.url,
          size: files[index].size,
          mimeType: files[index].mimetype,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Upload multiple error:', error);
      throw new AppError('Failed to upload files', 500);
    }
  }
);

// Delete file
router.delete('/:fileName(*)', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      throw new AppError('File name is required', 400);
    }

    await storage.deleteFile(fileName);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Delete file error:', error);
    throw new AppError('Failed to delete file', 500);
  }
});

// Get presigned URL
router.get('/presigned/:fileName(*)', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileName } = req.params;
    const expiry = parseInt(req.query.expiry as string) || 3600;

    if (!fileName) {
      throw new AppError('File name is required', 400);
    }

    const url = await storage.getPresignedUrl(fileName, expiry);

    res.json({ url, expiresIn: expiry });
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Get presigned URL error:', error);
    throw new AppError('Failed to generate presigned URL', 500);
  }
});

// List files
router.get('/list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { prefix } = req.query;
    const files = await storage.listFiles(prefix as string);

    res.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    throw new AppError('Failed to list files', 500);
  }
});

export default router;
