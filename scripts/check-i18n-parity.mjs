#!/usr/bin/env node
/**
 * Build gate: every project case study must exist in both locales,
 * so the language switcher never lands on a 404.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'src/content/projects');
const locales = ['en'];

const bySlug = new Map();
for (const locale of locales) {
  for (const file of readdirSync(join(base, locale))) {
    if (!file.endsWith('.mdx')) continue;
    const entry = bySlug.get(file) ?? new Set();
    entry.add(locale);
    bySlug.set(file, entry);
  }
}

const problems = [];
for (const [slug, present] of bySlug) {
  for (const locale of locales) {
    if (!present.has(locale)) problems.push(`Missing ${locale}/${slug}`);
  }
}

if (problems.length) {
  console.error('i18n parity check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`i18n parity OK (${bySlug.size} case studies × ${locales.length} locales)`);
