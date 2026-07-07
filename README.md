# Prompt Site

A static single-page site for sharing image-generation prompts, designed for GitHub Pages. No framework, no build step for the site itself — just a manifest generated from the `content/` folder.

## Adding a post

1. Create a folder in `content/` (the folder name becomes the post's URL slug):

   ```
   content/my-new-post/
     title.md      required — first line is the post title
     tags.md       required — tags separated by newlines or commas
                   (midjourney, chatgpt-image-2, kling-3, seedance-2.0, grok, …)
     content.md    required — the post body / prompts, markdown supported
     date.md       optional — YYYY-MM-DD (falls back to file modified date)
     hero.md       optional — hero thumbnail crop anchor: top, bottom,
                   center, left, right, or an exact "X% Y%" position
                   (default: center)
     author.md     optional — the author's X handle (with or without @);
                   linked on the card (bottom right) and in the post
                   header next to the tags
     *.png/jpg/…   optional — up to 7 images, any format
     style-ref/    optional — style reference images (midjourney posts)
     img-ref/      optional — image reference images
     omni-ref/     optional — omni reference images
   ```

2. Optimize the images and rebuild the manifest:

   ```
   npm run build
   ```

   This converts images to WebP (max 2048px on the long edge, quality 82) and regenerates `content/manifest.json`.

   **Image naming standard** (applied automatically by the optimizer):

   | Original name | Becomes | Meaning |
   |---|---|---|
   | starts with `fin` | `fin-01.webp`, `fin-02.webp`, … | Featured finals — always shown first, red border, set apart from other thumbnails |
   | anything else | `img-01.webp`, `img-02.webp`, … | Regular post images |
   | inside `style-ref/`, `img-ref/`, `omni-ref/` | `ref-01.webp`, `ref-02.webp`, … | Reference images — shown in their own labeled sections in the post, don't count toward the 7-image cap |

   To mark an image as a final, name the file with a `fin` prefix (e.g. `fin cover.png`) before running the build; already-optimized `fin-NN.webp` files keep their status.

3. Commit and push. GitHub Pages serves the result as-is.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Optimize all images, then rebuild the manifest |
| `npm run images` | Optimize images only (`--keep` preserves originals, or pass a folder name) |
| `npm run manifest` | Rebuild `content/manifest.json` only |
| `npm run serve` | Local dev server at http://localhost:4173 |
| `npm run placeholders` | Regenerate sample placeholder images (dev only) |

## Assets gallery

Images dropped into `data/` at the repo root appear on the **Assets** page (`#/assets`) as a masonry gallery. They get the exact same treatment as post images: `npm run build` optimizes them to WebP and applies the naming standard (`fin`-prefixed files sort first with a red border). Every image has a download button, the lightbox works the same as in posts, and a "Download all (.zip)" button at the top bundles the whole gallery client-side (no server needed).

Posts with more than one image also get a "Download all (.zip)" button, which includes reference images with their folder paths. The lightbox has a Copy button that puts the image on the clipboard as PNG.

## Prompt of the day

`content/prompt-of-day.json` holds a `prompts` array. The site picks one deterministically per calendar day, so every visitor sees the same prompt on a given day.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → deploy from the `main` branch, root folder.
3. Done — the site uses relative paths and hash routing, so it works at `https://<user>.github.io/<repo>/` without configuration.

Note: `node_modules/` is only needed locally for the scripts; it's gitignored and never deployed.
