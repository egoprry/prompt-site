/**
 * Guided post folder creator.
 *
 * Walks through the post naming schema [gpt/mj/custom]-[core topic]-[version]
 * and scaffolds the folder:
 *   date.md     today's date (YYYY-MM-DD)
 *   hero.md     center
 *   tags.md     chatgpt-image-2 (gpt) / midjourney (mj) / the custom name
 *   title.md    core topic + version
 *   content.md  empty "## Prompt" skeleton
 * For mj posts, also creates empty style-ref/, img-ref/, omni-ref/ folders.
 *
 * The version (1, 2, 3, …) is picked automatically: one higher than the
 * highest existing version of the same prefix and topic.
 *
 * Usage: npm run new
 */

import { createInterface } from 'node:readline/promises';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');
const REF_DIRS = ['style-ref', 'img-ref', 'omni-ref'];

const TAGS = {
  gpt: 'chatgpt-image-2',
  mj: 'midjourney',
};

const slugify = (s) => s
  .toLowerCase()
  .trim()
  .replace(/[\s_]+/g, '-')
  .replace(/[^a-z0-9-]/g, '')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const rl = createInterface({ input: process.stdin, output: process.stdout });

// 1. post type
let type = '';
while (!type) {
  const answer = (await rl.question('Post type — gpt (1) / mj (2) / custom (3): ')).trim().toLowerCase();
  if (answer === '1' || answer === 'gpt') type = 'gpt';
  else if (answer === '2' || answer === 'mj') type = 'mj';
  else if (answer === '3' || answer === 'custom') type = 'custom';
  else console.log('  Please enter 1, 2, or 3.');
}

// 2. custom name (folder prefix + tag)
let customName = '';
let prefix = type;
if (type === 'custom') {
  while (!customName) {
    customName = (await rl.question('Custom name: ')).trim();
    if (!customName) console.log('  A name is required for custom posts.');
    else if (!slugify(customName)) { console.log('  Name must contain letters or numbers.'); customName = ''; }
  }
  prefix = slugify(customName);
}

// 3. core topic
const topicInput = (await rl.question('Core topic [misc]: ')).trim();
const topic = slugify(topicInput) || 'misc';

rl.close();

// 4. version — one higher than the highest existing version of this
// prefix + topic (gaps are never refilled)
const base = `${prefix}-${topic}`;
const versionRe = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
let maxVersion = 0;
try {
  for (const entry of await readdir(CONTENT_DIR, { withFileTypes: true })) {
    const m = entry.isDirectory() && entry.name.match(versionRe);
    if (m) maxVersion = Math.max(maxVersion, Number(m[1]));
  }
} catch { /* content dir missing — first post ever */ }
const version = String(maxVersion + 1);
const folder = `${base}-${version}`;

// 5. scaffold
const dir = path.join(CONTENT_DIR, folder);
await mkdir(dir, { recursive: true });

const today = new Date();
const date = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');

const topicTitle = topic.replace(/-/g, ' ');
const title = topicTitle.charAt(0).toUpperCase() + topicTitle.slice(1) + ' ' + version;
const tag = TAGS[type] || customName;

await writeFile(path.join(dir, 'date.md'), date);
await writeFile(path.join(dir, 'hero.md'), 'center');
await writeFile(path.join(dir, 'tags.md'), tag);
await writeFile(path.join(dir, 'title.md'), title);
await writeFile(path.join(dir, 'content.md'), '## Prompt\n\n```\n```\n');

if (type === 'mj') {
  for (const ref of REF_DIRS) await mkdir(path.join(dir, ref), { recursive: true });
}

console.log(`
Created content/${folder}/
  date.md     ${date}
  hero.md     center
  tags.md     ${tag}
  title.md    ${title}
  content.md  "## Prompt" skeleton${type === 'mj' ? `\n  ${REF_DIRS.map((r) => r + '/').join('  ')} (empty, for reference images)` : ''}

Next: add your images (name the final "fin ..."), fill in content.md, then run "npm run build".`);
