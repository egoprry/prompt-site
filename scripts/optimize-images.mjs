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

import { readdir, readFile, copyFile, stat, rename, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');
const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const STYLES_DIR = path.resolve(import.meta.dirname, '..', 'styles');
const MAX_DIM = 2048;
const QUALITY = 82;
const THUMB_SIZE = 320;   // square-cropped, covers 2x screens at ~150px
const THUMB_QUALITY = 70;
const DISPLAY_SIZE = 1400;   // fin/mult display copies: retina-safe at ~700px
const DISPLAY_QUALITY = 78;
const MAX_IMAGES = 7;
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.tif', '.tiff', '.bmp', '.avif', '.webp']);
const REF_DIRS = ['style-ref', 'img-ref', 'omni-ref'];
const FINAL_RE = /^(?:(?:fin|img|ref|mult)-\d{2}|res-[a-z](?:-\d{2})?)\.webp$/;

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

/* Target prefix for a file. Post root:
     fin…    -> fin   (single featured final)
     mult…   -> mult  (a set of finals shown together)
     res-a…  -> res-a (ordered resource — the letter fixes "first/second image")
     else    -> img
   Ref-folder images are always "ref". */
function targetPrefix(file, isRefDir) {
  if (isRefDir) return 'ref';
  if (/^fin/i.test(file)) return 'fin';
  if (/^mult/i.test(file)) return 'mult';
  const res = file.match(/^res[-_ ]([a-z])(?![a-z0-9])/i);
  if (res) return `res-${res[1].toLowerCase()}`;
  return 'img';
}

async function processDir(dir, label, isRefDir) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
  } catch {
    return 0; // folder doesn't exist
  }
  if (files.length === 0) return 0;

  // Already-conformant files (correct prefix for their location, within
  // limits) are left alone; everything else is converted or renamed.
  // Numbering continues per-prefix after existing conformant files.
  const nextNum = { fin: 1, img: 1, ref: 1, mult: 1 };
  const toProcess = [];
  const taken = new Set(files);
  let untouched = 0;

  for (const file of files.sort()) {
    if (FINAL_RE.test(file)) {
      const numbered = file.match(/^(fin|img|ref|mult)-(\d{2})\.webp$/);
      const prefix = numbered ? numbered[1] : 'res';
      const prefixOk = isRefDir ? prefix === 'ref' : prefix !== 'ref';
      if (prefixOk) {
        const meta = await sharp(path.join(dir, file)).metadata();
        if (meta.width <= MAX_DIM && meta.height <= MAX_DIM) {
          if (numbered) nextNum[prefix] = Math.max(nextNum[prefix], Number(numbered[2]) + 1);
          untouched++;
          continue;
        }
      }
    }
    toProcess.push(file);
  }

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

  for (const file of toProcess) {
    const src = path.join(dir, file);
    const prefix = targetPrefix(file, isRefDir);
    let finalName;
    if (prefix.startsWith('res-')) {
      // ordered resource: res-a.webp, res-b.webp… (letter is the order)
      finalName = `${prefix}.webp`;
      let n = 2;
      while (taken.has(finalName) && finalName !== file) {
        finalName = `${prefix}-${String(n++).padStart(2, '0')}.webp`;
      }
    } else {
      do {
        finalName = `${prefix}-${String(nextNum[prefix]).padStart(2, '0')}.webp`;
        nextNum[prefix]++;
      } while (taken.has(finalName) && finalName !== file);
    }
    taken.add(finalName);
    const dest = path.join(dir, finalName);

    // Read into a buffer so sharp never holds a handle on the source file
    // (a held handle makes the rename below fail with EBUSY on Windows).
    const buf = await readFile(src);
    const meta = await sharp(buf).metadata();

    // Already-optimized WebP under the wrong name: rename, don't re-encode.
    if (path.extname(file).toLowerCase() === '.webp' &&
        meta.width <= MAX_DIM && meta.height <= MAX_DIM) {
      if (keepOriginals) {
        await copyFile(src, dest);
      } else {
        await rename(src, dest);
      }
      console.log(`  > ${label}/${file} -> ${finalName} (renamed)`);
      continue;
    }

    const tmp = path.join(dir, `.tmp-${finalName}`);
    const before = buf.length;
    await sharp(buf)
      .rotate() // respect EXIF orientation
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 5 })
      .toFile(tmp);
    const after = (await stat(tmp)).size;

    if (!keepOriginals) await unlink(src);
    await rename(tmp, dest);

    console.log(`  > ${label}/${file} -> ${finalName} (${kb(before)} -> ${kb(after)})`);
  }

  if (toProcess.length === 0) {
    console.log(`  = ${label}: ${untouched} image(s) already optimized`);
  }
  return files.length;
}

/* Downscaled copies in a thumbs/ subfolder next to the originals:
     - resource images (post-root img-/res- and all ref-folder files) get
       320px square-cropped thumbnails
     - fin/mult finals get aspect-preserved 1400px display copies, so heroes
       and Result sections never load the full file
   The site shows these; full images load only in the lightbox or via
   download. Skips copies that already exist and removes orphans whose
   source image is gone. */
async function generateThumbs(dir, label, isRefDir) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
  } catch {
    return;
  }
  // artifact plan: square thumbs for resources/refs; fin/mult finals get a
  // 1400px display copy plus a mini- square for the sidebar rail
  const artifacts = [];
  for (const f of files) {
    if (isRefDir || /^(img|res)-/i.test(f)) {
      artifacts.push({ name: f, src: f, kind: 'square' });
    } else if (/^(fin|mult)-/i.test(f)) {
      artifacts.push({ name: f, src: f, kind: 'display' });
      artifacts.push({ name: `mini-${f}`, src: f, kind: 'square' });
    }
  }
  const tdir = path.join(dir, 'thumbs');

  let existing = [];
  try { existing = await readdir(tdir); } catch { /* no thumbs dir yet */ }

  const expected = new Set(artifacts.map((a) => a.name));
  for (const t of existing) {
    if (!expected.has(t)) {
      await unlink(path.join(tdir, t));
      console.log(`  - ${label}/thumbs/${t} (orphan removed)`);
    }
  }

  if (!artifacts.length) return;
  await mkdir(tdir, { recursive: true });
  for (const a of artifacts) {
    if (existing.includes(a.name)) continue;
    const pipeline = sharp(await readFile(path.join(dir, a.src)));
    if (a.kind === 'display') {
      pipeline
        .resize(DISPLAY_SIZE, DISPLAY_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: DISPLAY_QUALITY });
    } else {
      pipeline
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
        .webp({ quality: THUMB_QUALITY });
    }
    await pipeline.toFile(path.join(tdir, a.name));
    console.log(`  + ${label}/thumbs/${a.name}${a.kind === 'display' ? ' (display)' : ''}`);
  }
}

async function processFolder(folder) {
  const dir = path.join(CONTENT_DIR, folder);
  const rootCount = await processDir(dir, folder, false);
  if (rootCount > MAX_IMAGES) {
    console.warn(`  ! ${folder}: ${rootCount} images found — the site shows a max of ${MAX_IMAGES} per post`);
  }
  await generateThumbs(dir, folder, false);
  for (const ref of REF_DIRS) {
    await processDir(path.join(dir, ref), `${folder}/${ref}`, true);
    await generateThumbs(path.join(dir, ref), `${folder}/${ref}`, true);
  }
}

const folders = await listPostFolders();
if (folders.length === 0) {
  console.log('No post folders found in content/.');
} else {
  console.log(`Optimizing images in ${folders.length} post folder(s)…`);
  for (const folder of folders) await processFolder(folder);
}

// Static assets gallery: same handling, no image cap.
if (!onlyFolder || onlyFolder === 'data') {
  await processDir(DATA_DIR, 'data', false);
}

// Style catalog entries: same handling as post roots.
try {
  const styleFolders = (await readdir(STYLES_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !onlyFolder || name === onlyFolder);
  for (const folder of styleFolders) {
    await processDir(path.join(STYLES_DIR, folder), `styles/${folder}`, false);
  }
} catch { /* no styles folder */ }
console.log('Done.');
