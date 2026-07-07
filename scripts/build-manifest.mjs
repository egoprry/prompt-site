/**
 * Build content/manifest.json from the post folders in content/.
 *
 * Each post folder may contain:
 *   title.md    (required) — first non-empty line is the title
 *   tags.md     (required) — tags separated by newlines or commas, "#" optional
 *   content.md  (required) — the post body (prompts), rendered as markdown
 *   date.md     (optional) — a YYYY-MM-DD date; falls back to content.md mtime
 *   *.webp/…    (optional) — up to 5 images, shown in filename sort order
 *
 * Run after adding or editing posts:  npm run manifest
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif']);

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
  const [titleMd, tagsMd, contentMd, dateMd] = await Promise.all([
    readIfExists(path.join(dir, 'title.md')),
    readIfExists(path.join(dir, 'tags.md')),
    readIfExists(path.join(dir, 'content.md')),
    readIfExists(path.join(dir, 'date.md')),
  ]);

  if (contentMd === null && titleMd === null) {
    console.warn(`  ! skipping ${folder}: no title.md or content.md`);
    continue;
  }

  const images = (await readdir(dir))
    .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .slice(0, 5);

  posts.push({
    id: folder,
    title: parseTitle(titleMd, folder),
    tags: parseTags(tagsMd),
    date: await parseDate(dir, dateMd),
    images,
    content: (contentMd || '').replace(/\r\n/g, '\n').trim(),
  });
}

const manifest = { generated: new Date().toISOString(), posts };
await writeFile(path.join(CONTENT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Wrote content/manifest.json with ${posts.length} post(s).`);
