import express from 'express';
import multer from 'multer';
import { uploadMultipleImages } from '../config/s3.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Multer Configuration
 * Store files in memory as buffers for direct S3 upload
 */
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

/**
 * POST /api/upload/images
 * Upload multiple product images to S3
 * 
 * Requirements:
 * - Admin authentication required
 * - Maximum 10 images per request
 * - Maximum 5MB per image
 * - Only image files accepted (jpg, png, webp, etc.)
 * 
 * Response:
 * {
 *   success: true,
 *   urls: ['https://bucket.s3.region.amazonaws.com/products/123-image.jpg', ...]
 * }
 */
router.post(
  '/images',
  requireAuth,
  requireAdmin,
  upload.array('images', 10), // Max 10 images
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images provided',
        });
      }

      console.log(`📤 Uploading ${files.length} images to S3...`);

      // Prepare files for S3 upload
      const filesToUpload = files.map((file) => ({
        buffer: file.buffer,
        fileName: file.originalname,
        contentType: file.mimetype,
      }));

      // Upload to S3
      const urls = await uploadMultipleImages(filesToUpload, 'products');

      console.log(`✅ Successfully uploaded ${urls.length} images to S3`);

      res.json({
        success: true,
        urls,
        count: urls.length,
      });
    } catch (error: any) {
      console.error('❌ Image upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload images',
      });
    }
  }
);

/**
 * POST /api/upload/image
 * Upload single product image to S3
 */
router.post(
  '/image',
  requireAuth,
  requireAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      const file = req.file as Express.Multer.File;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No image provided',
        });
      }

      console.log(`📤 Uploading single image to S3: ${file.originalname}`);

      const filesToUpload = [
        {
          buffer: file.buffer,
          fileName: file.originalname,
          contentType: file.mimetype,
        },
      ];

      const urls = await uploadMultipleImages(filesToUpload, 'products');

      console.log(`✅ Successfully uploaded image to S3: ${urls[0]}`);

      res.json({
        success: true,
        url: urls[0],
      });
    } catch (error: any) {
      console.error('❌ Image upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to upload image',
      });
    }
  }
);

export default router;
