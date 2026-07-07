/**
 * Optimize post images for the web.
 *
 * For every post folder in content/ (and its optional style-ref/, img-ref/,
 * omni-ref/ subfolders):
 *  - converts images (png/jpg/jpeg/gif/tiff/bmp/avif/webp) to WebP
 *  - resizes so neither dimension exceeds 2048px (never enlarges)
 *  - compresses (quality 82)
 *  - renames to the naming standard:
 *      post root:  originals starting with "fin" -> fin-01.webp, fin-02.webp…
 *                  everything else               -> img-01.webp, img-02.webp…
 *      ref subfolders (style-ref/img-ref/omni-ref) -> ref-01.webp, ref-02.webp…
 *    (numbered by the original filenames' sort order; "fin" images are the
 *    featured finals and always display first on the site)
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
const MAX_IMAGES = 7;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.tif', '.tiff', '.bmp', '.avif', '.webp']);
const REF_DIRS = ['style-ref', 'img-ref', 'omni-ref'];
const FINAL_RE = /^(fin|img|ref)-\d{2}\.webp$/;

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

/* Target prefix for a file: post-root images starting with "fin" are finals,
   ref-folder images are always "ref", everything else is "img". */
function targetPrefix(file, isRefDir) {
  if (isRefDir) return 'ref';
  return /^fin/i.test(file) ? 'fin' : 'img';
}

async function processDir(dir, label, isRefDir) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
  } catch {
    return 0; // folder doesn't exist
  }
  if (files.length === 0) return 0;

  // Already-conformant files within limits are left alone; everything else
  // is converted. Numbering continues per-prefix after existing files.
  const nextNum = { fin: 1, img: 1, ref: 1 };
  const toProcess = [];
  let untouched = 0;

  for (const file of files.sort()) {
    if (FINAL_RE.test(file)) {
      const meta = await sharp(path.join(dir, file)).metadata();
      if (meta.width <= MAX_DIM && meta.height <= MAX_DIM) {
        const prefix = file.slice(0, 3);
        nextNum[prefix] = Math.max(nextNum[prefix], Number(file.slice(4, 6)) + 1);
        untouched++;
        continue;
      }
    }
    toProcess.push(file);
  }

  for (const file of toProcess) {
    const src = path.join(dir, file);
    const prefix = targetPrefix(file, isRefDir);
    const finalName = `${prefix}-${String(nextNum[prefix]).padStart(2, '0')}.webp`;
    nextNum[prefix]++;
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
    console.log(`  > ${label}/${file} -> ${finalName} (${kb(before)} -> ${kb(after)})`);
  }

  if (toProcess.length === 0) {
    console.log(`  = ${label}: ${untouched} image(s) already optimized`);
  }
  return files.length;
}

async function processFolder(folder) {
  const dir = path.join(CONTENT_DIR, folder);
  const rootCount = await processDir(dir, folder, false);
  if (rootCount > MAX_IMAGES) {
    console.warn(`  ! ${folder}: ${rootCount} images found — the site shows a max of ${MAX_IMAGES} per post`);
  }
  for (const ref of REF_DIRS) {
    await processDir(path.join(dir, ref), `${folder}/${ref}`, true);
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
