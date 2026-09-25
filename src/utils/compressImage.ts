import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { Image } from 'react-native';

export interface CompressImageOptions {
  /** Target max dimension (width or height) in pixels. Defaults to 2200px */
  maxDimension?: number;
  /** Explicit quality override (0.0 to 1.0) */
  quality?: number;
  /** Keep PNG format if original is PNG. Defaults to false (converts to optimized JPEG for bills) */
  preservePng?: boolean;
}

export interface CompressedImageResult {
  uri: string;
  name: string;
  mimeType: string;
  base64?: string;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

/**
 * Helper to get image dimensions reliably
 */
const getImageDimensions = (uri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => {
        console.warn('Failed to get image size via Image.getSize:', err);
        resolve({ width: 0, height: 0 });
      }
    );
  });
};

/**
 * Helper to safely get file size using Expo File System
 */
const safeGetFileSize = (uri: string): number => {
  try {
    const file = new File(uri);
    return file.size || 0;
  } catch {
    return 0;
  }
};

/**
 * Formats byte counts into human readable strings (e.g., "1.2 MB", "450 KB")
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

/**
 * Reusable client-side image compression utility for bill and invoice images.
 *
 * Implements adaptive compression:
 * - Validates input is an image (skips PDFs)
 * - Preserves aspect ratio and EXIF orientation
 * - Resizes high-resolution camera images down to <= 2200px
 * - Adapts quality based on input size to ensure clear readability of text, invoice numbers, and totals
 */
export const compressBillImage = async (
  inputUri: string,
  fileName: string = 'bill_image.jpg',
  mimeType: string = 'image/jpeg',
  knownSize?: number,
  options?: CompressImageOptions
): Promise<CompressedImageResult> => {
  const isPdf =
    mimeType.toLowerCase().includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

  // 1. If it's a PDF, do not manipulate/compress as image
  if (isPdf) {
    const size = knownSize || safeGetFileSize(inputUri);

    return {
      uri: inputUri,
      name: fileName,
      mimeType: 'application/pdf',
      originalSize: size,
      compressedSize: size,
      savedPercentage: 0,
      width: 0,
      height: 0,
      wasCompressed: false,
    };
  }

  // 2. Determine original file size
  const originalSize = knownSize || safeGetFileSize(inputUri);

  // 3. Inspect image dimensions
  const dims = await getImageDimensions(inputUri);
  let srcWidth = dims.width;
  let srcHeight = dims.height;

  const maxDimension = options?.maxDimension || 2200;
  const actions: any[] = [];

  // Calculate resize action if dimensions exceed maxDimension
  if (srcWidth > maxDimension || srcHeight > maxDimension) {
    if (srcWidth >= srcHeight) {
      actions.push({ resize: { width: maxDimension } });
    } else {
      actions.push({ resize: { height: maxDimension } });
    }
  }

  // 4. Determine adaptive quality based on size
  // Target: Prioritize clear invoice text readability over extreme compression
  let targetQuality = 0.82; // Default moderate high quality

  if (options?.quality !== undefined) {
    targetQuality = options.quality;
  } else if (originalSize > 0) {
    if (originalSize < 500 * 1024) {
      // Small image (< 500 KB): Minimal optimization, maintain high sharpness
      targetQuality = actions.length > 0 ? 0.88 : 0.9;
    } else if (originalSize <= 2 * 1024 * 1024) {
      // Medium image (500 KB - 2 MB): Moderate compression
      targetQuality = 0.82;
    } else if (originalSize <= 5 * 1024 * 1024) {
      // Large camera image (2 MB - 5 MB): Good compression with preserved text clarity
      targetQuality = 0.78;
    } else {
      // Very large image (> 5 MB): Stronger compression + resize
      targetQuality = 0.75;
    }
  }

  // Choose format
  const isPng =
    (mimeType.toLowerCase().includes('png') || fileName.toLowerCase().endsWith('.png')) &&
    options?.preservePng;

  const saveFormat = isPng ? SaveFormat.PNG : SaveFormat.JPEG;
  const outMimeType = isPng ? 'image/png' : 'image/jpeg';
  const outExtension = isPng ? '.png' : '.jpg';

  let cleanName = fileName;
  if (!cleanName.toLowerCase().endsWith(outExtension)) {
    const base = cleanName.substring(0, cleanName.lastIndexOf('.')) || cleanName;
    cleanName = `${base}${outExtension}`;
  }

  try {
    const result = await manipulateAsync(inputUri, actions, {
      compress: targetQuality,
      format: saveFormat,
      base64: true,
    });

    // 5. Query compressed file size
    let compressedSize = safeGetFileSize(result.uri);

    if (compressedSize === 0) {
      compressedSize = originalSize > 0 ? Math.round(originalSize * targetQuality) : 0;
    }

    // Calculate percentage saved
    let savedPercentage = 0;
    if (originalSize > 0 && compressedSize < originalSize) {
      savedPercentage = Math.round(((originalSize - compressedSize) / originalSize) * 100);
    }

    return {
      uri: result.uri,
      name: cleanName,
      mimeType: outMimeType,
      base64: result.base64,
      originalSize,
      compressedSize,
      savedPercentage,
      width: result.width,
      height: result.height,
      wasCompressed: true,
    };
  } catch (error: any) {
    console.error('Image compression failed, fallback to original if valid:', error);

    // If compression throws an error, fallback to original if size is within safety limit (< 15MB)
    const safetyLimit = 15 * 1024 * 1024;
    if (originalSize > safetyLimit) {
      throw new Error(`Image is too large (${formatFileSize(originalSize)}) and compression failed.`);
    }

    return {
      uri: inputUri,
      name: fileName,
      mimeType,
      originalSize,
      compressedSize: originalSize,
      savedPercentage: 0,
      width: srcWidth,
      height: srcHeight,
      wasCompressed: false,
    };
  }
};
