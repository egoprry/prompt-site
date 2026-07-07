/**
 * Dev utility: generate oversized placeholder PNGs inside sample post folders
 * so the optimize-images script has something realistic to process.
 * Not needed in production — replace with your real generated images.
 *
 * Usage: node scripts/generate-placeholders.mjs
 */

import path from 'node:path';
import sharp from 'sharp';

const CONTENT_DIR = path.resolve(import.meta.dirname, '..', 'content');

// folder -> [{name, w, h, hue, label}]
const SPECS = {
  'cyberpunk-alley-rain': [
    { name: 'render a.png', w: 2688, h: 2688, bg: '#0d1b2a', fg: '#4cc9f0', label: 'alley 1' },
    { name: 'Render B final.png', w: 3136, h: 1792, bg: '#161a30', fg: '#f72585', label: 'alley 2' },
    { name: 'IMG_20260701.png', w: 1792, h: 3136, bg: '#1a1423', fg: '#7209b7', label: 'alley 3' },
  ],
  'perfume-product-shot': [
    { name: 'perfume-final-v3.png', w: 2048, h: 2560, bg: '#2b2118', fg: '#e0aaff', label: 'bottle 1' },
    { name: 'perfume shot (2).png', w: 2560, h: 2048, bg: '#1b263b', fg: '#ffd60a', label: 'bottle 2' },
  ],
  'seedance-liquid-chrome': [
    { name: 'frame_0001.png', w: 3840, h: 2160, bg: '#212529', fg: '#adb5bd', label: 'chrome' },
  ],
  'grok-retro-arcade-posters': [
    { name: 'poster1.png', w: 1664, h: 2432, bg: '#240046', fg: '#ff9e00', label: 'poster 1' },
    { name: 'poster2.png', w: 1664, h: 2432, bg: '#03071e', fg: '#48cae4', label: 'poster 2' },
    { name: 'poster3.png', w: 1664, h: 2432, bg: '#250902', fg: '#f48c06', label: 'poster 3' },
    { name: 'poster4.png', w: 1664, h: 2432, bg: '#10002b', fg: '#c77dff', label: 'poster 4' },
    { name: 'poster5.png', w: 1664, h: 2432, bg: '#001219', fg: '#94d2bd', label: 'poster 5' },
  ],
};

for (const [folder, specs] of Object.entries(SPECS)) {
  for (const s of specs) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}">
      <rect width="100%" height="100%" fill="${s.bg}"/>
      <circle cx="${s.w / 2}" cy="${s.h / 2}" r="${Math.min(s.w, s.h) / 4}" fill="none" stroke="${s.fg}" stroke-width="24"/>
      <text x="50%" y="52%" font-family="Arial" font-size="${Math.min(s.w, s.h) / 12}"
        fill="${s.fg}" text-anchor="middle">${s.label}</text>
      <text x="50%" y="95%" font-family="Arial" font-size="${Math.min(s.w, s.h) / 30}"
        fill="${s.fg}" text-anchor="middle">${s.w}x${s.h} placeholder</text>
    </svg>`;
    const out = path.join(CONTENT_DIR, folder, s.name);
    await sharp(Buffer.from(svg)).png().toFile(out);
    console.log(`  + ${folder}/${s.name} (${s.w}x${s.h})`);
  }
}
console.log('Placeholders generated. Run "npm run images" to optimize them.');
