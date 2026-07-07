/**
 * Optimize post images for the web.
 *
 * For every post folder in content/:
 *  - converts images (png/jpg/jpeg/gif/tiff/bmp/avif/webp) to WebP
 *  - resizes so neither dimension exceeds 2048px (never enlarges)
 *  - compresses (quality 82)
 *  - renames to a consistent format: img-01.webp, img-02.webp, …
 *    (numbered by the original filenames' sort order)
 *  - deletes the originals after successful conversion
 *
 * Usage:
 *   node scripts/optimize-images.mjs           # process all post folders
 *   node scripts/optimize-images.mjs --keep    # keep original files
 *   node scripts/optimize-images.mjs my-post   # process a single folder
 */

import { readdir, stat, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');
const MAX_DIM = 2048;
const QUALITY = 82;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.tif', '.tiff', '.bmp', '.avif', '.webp']);
const FINAL_RE = /^img-\d{2}\.webp$/;

const args = process.argv.slice(2);
const keepOriginals = args.includes('--keep');
const onlyFolder = args.find((a) => !a.startsWith('--'));

async function listPostFolders() {
  const entries = await readdir(CONTENT_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !onlyFolder || name === onlyFolder);
}

async function processFolder(folder) {
  const dir = path.join(CONTENT_DIR, folder);
  const files = (await readdir(dir)).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
  if (files.length === 0) return;

  if (files.length > 5) {
    console.warn(`  ! ${folder}: ${files.length} images found — the site shows a max of 5 per post`);
  }

  // Check which already-final files are within limits and can be left alone.
  const conformant = [];
  const toProcess = [];
  for (const file of files.sort()) {
    if (FINAL_RE.test(file)) {
      const meta = await sharp(path.join(dir, file)).metadata();
      if (meta.width <= MAX_DIM && meta.height <= MAX_DIM) {
        conformant.push(file);
        continue;
      }
    }
    toProcess.push(file);
  }

  if (toProcess.length === 0) {
    console.log(`  = ${folder}: ${conformant.length} image(s) already optimized`);
    return;
  }

  // Assign numbers after the highest existing conformant number.
  let next = conformant.reduce((max, f) => Math.max(max, Number(f.slice(4, 6))), 0) + 1;

  for (const file of toProcess) {
    const src = path.join(dir, file);
    const finalName = `img-${String(next).padStart(2, '0')}.webp`;
    const tmp = path.join(dir, `.tmp-${finalName}`);
    const dest = path.join(dir, finalName);

    const before = (await stat(src)).size;
    await sharp(src)
      .rotate() // respect EXIF orientation
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 5 })
      .toFile(tmp);
    const after = (await stat(tmp)).size;

    if (!keepOriginals) await unlink(src);
    await rename(tmp, dest);

    const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
    console.log(`  > ${folder}/${file} -> ${finalName} (${kb(before)} -> ${kb(after)})`);
    next++;
  }
}

const folders = await listPostFolders();
if (folders.length === 0) {
  console.log('No post folders found in content/.');
} else {
  console.log(`Optimizing images in ${folders.length} post folder(s)…`);
  for (const folder of folders) await processFolder(folder);
  console.log('Done.');
}
