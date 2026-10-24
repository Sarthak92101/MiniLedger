import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../../config';
import { ApiError } from '../../lib/errors';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

function ensureUploadDir(): string {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  return config.uploadDir;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, ensureUploadDir());
  },
  filename(_req, file, cb) {
    const ext = EXTENSION_BY_MIME[file.mimetype] ?? '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const receiptUpload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new ApiError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Receipt must be a JPEG, PNG, WEBP or HEIC image',
        ),
      );
      return;
    }
    cb(null, true);
  },
});

/** Public URL of a stored receipt, relative to the API host. */
export function receiptUrlFor(filename: string): string {
  return `/api/uploads/receipt/${path.basename(filename)}`;
}

/** Check the actual file header instead of trusting the multipart MIME value. */
export async function hasValidReceiptSignature(filePath: string, mimeType: string): Promise<boolean> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (mimeType === 'image/jpeg') {
      return bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    }
    if (mimeType === 'image/png') {
      return header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (mimeType === 'image/webp') {
      return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    }
    if (mimeType === 'image/heic') {
      if (header.toString('ascii', 4, 8) !== 'ftyp') return false;
      const brands = header.toString('ascii', 8, bytesRead);
      return /^(?:heic|heix|heis|heim|hevc|hevx|mif1|msf1)/i.test(brands);
    }
    return false;
  } finally {
    await handle.close();
  }
}
