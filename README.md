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
     *.png/jpg/…   optional — up to 5 images, any format
   ```

2. Optimize the images and rebuild the manifest:

   ```
   npm run build
   ```

   This converts images to WebP (max 2048px on the long edge, quality 82), renames them to `img-01.webp`, `img-02.webp`, … and regenerates `content/manifest.json`.

3. Commit and push. GitHub Pages serves the result as-is.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Optimize all images, then rebuild the manifest |
| `npm run images` | Optimize images only (`--keep` preserves originals, or pass a folder name) |
| `npm run manifest` | Rebuild `content/manifest.json` only |
| `npm run serve` | Local dev server at http://localhost:4173 |
| `npm run placeholders` | Regenerate sample placeholder images (dev only) |

## Prompt of the day

`content/prompt-of-day.json` holds a `prompts` array. The site picks one deterministically per calendar day, so every visitor sees the same prompt on a given day.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → deploy from the `main` branch, root folder.
3. Done — the site uses relative paths and hash routing, so it works at `https://<user>.github.io/<repo>/` without configuration.

Note: `node_modules/` is only needed locally for the scripts; it's gitignored and never deployed.
