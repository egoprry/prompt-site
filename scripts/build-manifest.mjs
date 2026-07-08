/**
 * Build content/manifest.json from the post folders in content/.
 *
 * Each post folder may contain:
 *   title.md    (required) — first non-empty line is the title
 *   tags.md     (required) — tags separated by newlines or commas, "#" optional
 *   content.md  (required) — the post body (prompts), rendered as markdown
 *   date.md     (optional) — a YYYY-MM-DD date; falls back to content.md mtime
 *   author.md   (optional) — the author's X handle (with or without @);
 *               shown as a profile link on the card and in the post
 *   hero.md     (optional) — crop anchor for the card's hero thumbnail:
 *               top | bottom | center | left | right, or an exact
 *               CSS object-position like "50% 20%" (default: center)
 *   *.webp/…    (optional) — up to 7 images; "fin-" prefixed finals sort first
 *   style-ref/, img-ref/, omni-ref/ (optional) — reference image subfolders,
 *               listed separately in the manifest under "refs"
 *
 * Run after adding or editing posts:  npm run manifest
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif']);
const REF_DIRS = ['style-ref', 'img-ref', 'omni-ref'];
const MAX_IMAGES = 7;

const isImage = (f) => IMAGE_EXT.has(path.extname(f).toLowerCase());
const isFin = (f) => /^fin/i.test(f);

async function readIfExists(file) {
  try { return await readFile(file, 'utf8'); } catch { return null; }
}

function parseTitle(md, folder) {
  const line = (md || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return line ? line.replace(/^#+\s*/, '') : folder;
}

function parseTags(md) {
  return (md || '')
    .split(/[\n,]/)
    .map((t) => t.trim().replace(/^#/, '').toLowerCase())
    .filter((t) => t.length > 0);
}

/* First non-empty line of author.md as a bare X handle, or null. */
function parseAuthor(md) {
  const line = (md || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  if (!line) return null;
  const handle = line.replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    console.warn(`  ! invalid author.md value "${line}" — expected an X handle`);
    return null;
  }
  return handle;
}

/* Normalize hero.md to a safe CSS object-position value, or null. */
function parseHero(md) {
  const line = (md || '').split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  if (!line) return null;
  const v = line.toLowerCase();
  const keywords = {
    top: '50% 10%',
    bottom: '50% 100%',
    center: '50% 50%',
    left: '0% 50%',
    right: '100% 50%',
  };
  if (keywords[v]) return keywords[v];
  if (/^\d{1,3}% \d{1,3}%$/.test(v)) return v;
  console.warn(`  ! invalid hero.md value "${line}" — expected top/bottom/center/left/right or "X% Y%"`);
  return null;
}

async function parseDate(dir, dateMd) {
  const m = (dateMd || '').match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  try {
    const s = await stat(path.join(dir, 'content.md'));
    return s.mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const entries = await readdir(CONTENT_DIR, { withFileTypes: true });
const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

const posts = [];
for (const folder of folders) {
  const dir = path.join(CONTENT_DIR, folder);
  const [titleMd, tagsMd, contentMd, dateMd, heroMd, authorMd] = await Promise.all([
    readIfExists(path.join(dir, 'title.md')),
    readIfExists(path.join(dir, 'tags.md')),
    readIfExists(path.join(dir, 'content.md')),
    readIfExists(path.join(dir, 'date.md')),
    readIfExists(path.join(dir, 'hero.md')),
    readIfExists(path.join(dir, 'author.md')),
  ]);

  if (contentMd === null && titleMd === null) {
    console.warn(`  ! skipping ${folder}: no title.md or content.md`);
    continue;
  }

  const allImages = (await readdir(dir))
    .filter(isImage)
    .sort((a, b) => (isFin(b) - isFin(a)) || a.localeCompare(b));
  if (allImages.length > MAX_IMAGES) {
    console.warn(`  ! ${folder}: ${allImages.length} images — only the first ${MAX_IMAGES} are shown`);
  }
  const images = allImages.slice(0, MAX_IMAGES);

  const refs = {};
  for (const refDir of REF_DIRS) {
    try {
      const files = (await readdir(path.join(dir, refDir))).filter(isImage).sort();
      if (files.length) refs[refDir] = files;
    } catch { /* folder doesn't exist */ }
  }

  const hero = parseHero(heroMd);
  const author = parseAuthor(authorMd);

  posts.push({
    id: folder,
    title: parseTitle(titleMd, folder),
    tags: parseTags(tagsMd),
    date: await parseDate(dir, dateMd),
    images,
    ...(hero ? { hero } : {}),
    ...(author ? { author } : {}),
    ...(Object.keys(refs).length ? { refs } : {}),
    content: (contentMd || '').replace(/\r\n/g, '\n').trim(),
  });
}

// Static assets gallery from data/ at the repo root (fin-first, no cap).
let assets = [];
try {
  assets = (await readdir(path.resolve(CONTENT_DIR, '..', 'data')))
    .filter(isImage)
    .sort((a, b) => (isFin(b) - isFin(a)) || a.localeCompare(b));
} catch { /* no data folder */ }

const manifest = { generated: new Date().toISOString(), posts, assets };
await writeFile(path.join(CONTENT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Wrote content/manifest.json with ${posts.length} post(s) and ${assets.length} asset(s).`);
