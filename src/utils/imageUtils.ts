import heic2any from 'heic2any';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DIMENSION = 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const HEIC_TYPES = ['image/heic', 'image/heif'];

function isHeic(file: File): boolean {
  if (HEIC_TYPES.includes(file.type)) return true;
  // Some browsers don't set the MIME type for HEIC, check extension
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'heic' || ext === 'heif';
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([resultBlob], name, { type: 'image/jpeg' });
}

export function validateImage(file: File): { valid: boolean; error?: string } {
  const type = file.type;
  if (!ALLOWED_TYPES.includes(type) && !isHeic(file)) {
    return { valid: false, error: `Unsupported format. Use PNG, JPEG, WebP, GIF, or HEIC.` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.` };
  }
  return { valid: true };
}

export async function prepareImage(file: File): Promise<File> {
  // Convert HEIC to JPEG first
  let prepared = isHeic(file) ? await convertHeicToJpeg(file) : file;
  // Then resize if needed
  prepared = await resizeIfNeeded(prepared);
  return prepared;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function resizeIfNeeded(file: File, maxDim = MAX_DIMENSION): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(file);
        return;
      }

      const scale = Math.min(maxDim / img.width, maxDim / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }));
          } else {
            resolve(file);
          }
        },
        file.type,
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
