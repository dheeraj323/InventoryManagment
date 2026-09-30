import { File } from 'expo-file-system';

declare const process: {
  env: Record<string, string | undefined>;
};

// Pure JavaScript SHA-1 implementation for client-side signing without heavy native crypto dependencies
function sha1(str: string): string {
  function safeAdd(x: number, y: number): number {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }

  function rol(num: number, cnt: number): number {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  function ft(t: number, b: number, c: number, d: number): number {
    if (t < 20) return (b & c) | (~b & d);
    if (t < 40) return b ^ c ^ d;
    if (t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }

  function kt(t: number): number {
    return t < 20 ? 1518500249 : t < 40 ? 1859775393 : t < 60 ? -1894007588 : -899497514;
  }

  const utf8 = unescape(encodeURIComponent(str));
  const x: number[] = [];
  for (let i = 0; i < utf8.length * 8; i += 8) {
    x[i >> 5] = (x[i >> 5] || 0) | ((utf8.charCodeAt(i / 8) & 0xff) << (24 - (i % 32)));
  }

  const len = utf8.length * 8;
  x[len >> 5] = (x[len >> 5] || 0) | (0x80 << (24 - (len % 32)));
  x[(((len + 64) >> 9) << 4) + 15] = len;

  const w = new Array(80);
  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;
  let e = -1009589776;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;
    const olde = e;

    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = x[i + j] || 0;
      } else {
        w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      }
      const t = safeAdd(safeAdd(rol(a, 5), ft(j, b, c, d)), safeAdd(safeAdd(e, w[j]), kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
    e = safeAdd(e, olde);
  }

  const hexDigits = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += hexDigits.charAt((a >> ((3 - i) * 8 + 4)) & 0x0f) + hexDigits.charAt((a >> ((3 - i) * 8)) & 0x0f);
  }
  for (let i = 0; i < 4; i++) {
    result += hexDigits.charAt((b >> ((3 - i) * 8 + 4)) & 0x0f) + hexDigits.charAt((b >> ((3 - i) * 8)) & 0x0f);
  }
  for (let i = 0; i < 4; i++) {
    result += hexDigits.charAt((c >> ((3 - i) * 8 + 4)) & 0x0f) + hexDigits.charAt((c >> ((3 - i) * 8)) & 0x0f);
  }
  for (let i = 0; i < 4; i++) {
    result += hexDigits.charAt((d >> ((3 - i) * 8 + 4)) & 0x0f) + hexDigits.charAt((d >> ((3 - i) * 8)) & 0x0f);
  }
  for (let i = 0; i < 4; i++) {
    result += hexDigits.charAt((e >> ((3 - i) * 8 + 4)) & 0x0f) + hexDigits.charAt((e >> ((3 - i) * 8)) & 0x0f);
  }
  return result;
}

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  format?: string;
  width?: number;
  height?: number;
}

export interface UploadBillAttachmentParams {
  uri: string;
  base64?: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  userId: string;
  supplierId: string;
  billId: string;
}

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'bp7daqjz';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '557233692116286';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'IypQ8JQ2Z0yjgElag7qBM5NZfLQ';

export const cloudinaryService = {
  /**
   * Upload a bill document/image to Cloudinary under folder:
   * bills/{userId}/{supplierId}/{billId}
   */
  uploadBillAttachment: async (
    params: UploadBillAttachmentParams
  ): Promise<CloudinaryUploadResult> => {
    const { uri, base64, fileName, fileType, userId, supplierId, billId, fileSize } = params;

    const folder = `bills/${userId || 'admin'}/${supplierId}/${billId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Sign the request parameters: folder and timestamp (sorted alphabetically)
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = sha1(stringToSign);

    // Determine file type and name
    const cleanFileName = fileName || `bill_${Date.now()}.${fileType.includes('pdf') ? 'pdf' : 'jpg'}`;
    const cleanMimeType = fileType || (cleanFileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const isPdf = cleanMimeType.includes('pdf') || cleanFileName.toLowerCase().endsWith('.pdf');
    const resourceType = isPdf ? 'raw' : 'auto';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    try {
      let filePayload: string = '';

      if (base64) {
        filePayload = base64.startsWith('data:')
          ? base64
          : `data:${cleanMimeType};base64,${base64}`;
      } else if (uri.startsWith('data:')) {
        filePayload = uri;
      } else {
        try {
          const file = new File(uri);
          const b64 = await file.base64();
          filePayload = `data:${cleanMimeType};base64,${b64}`;
        } catch (e) {
          console.warn('Could not read file via File.base64():', e);
          filePayload = uri;
        }
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          file: filePayload,
          api_key: CLOUDINARY_API_KEY,
          timestamp,
          folder,
          signature,
        }),
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Failed to process upload response. Please try again.');
      }

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || 'Failed to upload attachment. Please try again.');
      }

      return {
        url: data.url,
        secureUrl: data.secure_url,
        publicId: data.public_id,
        fileName: cleanFileName,
        fileType: cleanMimeType,
        fileSize: data.bytes || fileSize || 0,
        format: data.format,
        width: data.width,
        height: data.height,
      };
    } catch (error: any) {
      console.error('Attachment upload error:', error);
      throw new Error(error.message || 'Failed to upload attachment. Please check your connection and try again.');
    }
  },
};
