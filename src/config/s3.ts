import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3Client = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'mama-dye-dreams-images';
const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1';

/**
 * Upload an image to S3
 * @param file Buffer of the file
 * @param fileName Name for the file
 * @param contentType MIME type of the file
 * @param folder Optional folder path
 * @returns Public URL of the uploaded file
 */
export const uploadImage = async (
  file: Buffer,
  fileName: string,
  contentType: string,
  folder: string = 'products'
): Promise<string> => {
  try {
    const key = `${folder}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      // ACL removed - bucket uses bucket policy for public access instead
    });

    await s3Client.send(command);

    // Return public URL
    return `https://${BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw new Error('Failed to upload image to S3');
  }
};

/**
 * Delete an image from S3
 * @param imageUrl Full URL of the image
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract key from URL
    const urlParts = imageUrl.split('.amazonaws.com/');
    if (urlParts.length !== 2) {
      throw new Error('Invalid S3 URL');
    }
    
    const key = urlParts[1];

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw new Error('Failed to delete image from S3');
  }
};

/**
 * Generate a presigned URL for temporary access
 * @param key S3 object key
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export const getPresignedUrl = async (
  key: string,
  expiresIn: number = 3600
): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
};

/**
 * Upload multiple images
 * @param files Array of file buffers with metadata
 * @returns Array of public URLs
 */
export const uploadMultipleImages = async (
  files: Array<{ buffer: Buffer; fileName: string; contentType: string }>,
  folder: string = 'products'
): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file =>
      uploadImage(file.buffer, file.fileName, file.contentType, folder)
    );

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw new Error('Failed to upload images to S3');
  }
};
