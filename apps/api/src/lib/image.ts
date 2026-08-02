import sharp from 'sharp';

export async function autoOrientImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (!mimeType.startsWith('image/') || mimeType === 'image/gif') return buffer;

  try {
    const metadata = await sharp(buffer, { failOn: 'none' }).metadata();
    const orientation = metadata.orientation ?? 1;
    if (orientation === 1) return buffer;

    const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/pjpeg';
    return isJpeg
      ? await sharp(buffer).rotate().jpeg({ quality: 92 }).toBuffer()
      : await sharp(buffer).rotate().toBuffer();
  } catch {
    return buffer;
  }
}
