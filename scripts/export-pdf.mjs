#!/usr/bin/env node
/**
 * Renders /{lang}/cv/print from the built site into public/cv/*.pdf and
 * captures the OG images. Requires a local Chrome install (uses channel:
 * 'chrome' so no browser download is needed). Run after `astro build`;
 * commit the regenerated files.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path.endsWith('/')) path += 'index.html';
  let file = join(dist, path);
  if (!existsSync(file) && existsSync(join(dist, path, 'index.html'))) {
    file = join(dist, path, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

for (const lang of ['en']) {
  await page.goto(`http://localhost:${port}/${lang}/cv/print/`, { waitUntil: 'networkidle' });
  await page.pdf({
    path: join(root, `public/cv/ondrej-ulehla-${lang}.pdf`),
    format: 'A4',
    printBackground: true,
  });
  console.log(`✓ public/cv/ondrej-ulehla-${lang}.pdf`);

  // OG image: screenshot the homepage hero at OG dimensions.
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`http://localhost:${port}/${lang}/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(root, `public/og/default-${lang}.png`) });
  console.log(`✓ public/og/default-${lang}.png`);
}

await browser.close();
server.close();
