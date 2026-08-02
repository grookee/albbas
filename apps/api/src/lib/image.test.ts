import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { autoOrientImage } from './image.js';

describe('autoOrientImage', () => {
  it('applies EXIF orientation and bakes it into a jpeg', async () => {
    const raw = await sharp({
      create: {
        width: 100,
        height: 50,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const out = await autoOrientImage(raw, 'image/jpeg');
    expect(out).not.toEqual(raw);

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(100);
    expect(meta.orientation).not.toBe(6);
  });

  it('returns the buffer unchanged when there is no EXIF orientation', async () => {
    const raw = await sharp({
      create: {
        width: 40,
        height: 40,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const out = await autoOrientImage(raw, 'image/png');
    expect(out).toEqual(raw);
  });

  it('skips non-images', async () => {
    const raw = Buffer.from('hello world');
    await expect(autoOrientImage(raw, 'text/plain')).resolves.toEqual(raw);
  });

  it('skips animated gifs', async () => {
    const raw = Buffer.from('fake gif bytes');
    await expect(autoOrientImage(raw, 'image/gif')).resolves.toEqual(raw);
  });
});
