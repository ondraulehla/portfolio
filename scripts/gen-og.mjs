/**
 * Generates the Open Graph share images in the technical-plate language.
 *
 *  - public/og/default-en.png … homepage/site card (1200×630)
 *  - public/og/<slug>.png     … one per project, rendered from its cover plate
 *
 * Requires librsvg (rsvg-convert) – `brew install librsvg`.
 *
 *   node scripts/gen-og.mjs
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';

const W = 1200;
const H = 630;
const PAPER = '#f7f3ea';
const INK = '#29221b';
const LINE = '#e2dac8';
const ACCENT = '#cb3a00';
const MONO = "font-family='Menlo, Consolas, monospace'";

function grid() {
  let s = `<g stroke="${LINE}" stroke-width="1">`;
  for (let x = 60; x < W; x += 60) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 15; y < H; y += 60) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  return s + '</g>';
}

function cropMarks() {
  const m = 26;
  const l = 16;
  return `<g stroke="${INK}" stroke-opacity="0.65" stroke-width="2" fill="none">
    <path d="M${m} ${m + l} V${m} H${m + l}"/>
    <path d="M${W - m - l} ${m} H${W - m} V${m + l}"/>
    <path d="M${W - m} ${H - m - l} V${H - m} H${W - m - l}"/>
    <path d="M${m + l} ${H - m} H${m} V${H - m - l}"/>
  </g>`;
}

function mono(x, y, text, { size = 19, anchor = 'start', fill = INK, ls = 3, opacity = 1, weight = 500 } = {}) {
  return `<text x="${x}" y="${y}" ${MONO} font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" text-anchor="${anchor}" fill="${fill}" fill-opacity="${opacity}">${text}</text>`;
}

function hatch(x, y, w, h) {
  let s = `<g clip-path="url(#hp)"><defs><clipPath id="hp"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`;
  s += `<g stroke="${INK}" stroke-opacity="0.5" stroke-width="1.4">`;
  for (let i = -h; i < w + h; i += 7) s += `<line x1="${x + i}" y1="${y + h}" x2="${x + i + h}" y2="${y}"/>`;
  return s + '</g></g>';
}

function emblem(cx, cy, s, stroke = ACCENT) {
  const u = s / 150;
  const r = (x, y, rot = '') =>
    `<rect x="${x}" y="${y}" width="30" height="30" ${rot ? `transform="rotate(${rot})"` : ''}/>`;
  return `<g fill="none" stroke="${stroke}" stroke-width="${4.5 / u}" transform="translate(${cx - s / 2} ${cy - s / 2}) scale(${u})">
    ${r(22, 22)}${r(98, 22)}${r(22, 98)}${r(98, 98)}
    ${r(60, 6, '45 75 21')}${r(114, 60, '45 129 75')}${r(60, 114, '45 75 129')}${r(6, 60, '45 21 75')}
    <polygon points="75,51 78.6,66.2 92,58 83.8,71.4 99,75 83.8,78.6 92,92 78.6,83.8 75,99 71.4,83.8 58,92 66.2,78.6 51,75 66.2,71.4 58,58 71.4,66.2"/>
    <path d="M75 68v14M68 75h14"/>
  </g>`;
}

/* ---------- homepage card ---------- */
const home = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${grid()}
  ${cropMarks()}
  ${mono(60, 76, 'ULEHLA.DEV', { fill: ACCENT, size: 20, weight: 600 })}
  ${mono(W - 60, 76, 'PRAGUE · CZECH REPUBLIC', { anchor: 'end', size: 15, opacity: 0.55 })}
  <line x1="60" y1="94" x2="${W - 60}" y2="94" stroke="${INK}" stroke-opacity="0.6" stroke-width="1.6"/>
  ${hatch(60, 100, 150, 8)}

  ${mono(60, 285, 'ONDŘEJ ÚLEHLA', { size: 76, weight: 700, ls: 2 })}
  ${mono(60, 375, 'FULLSTACK DEVELOPER', { size: 44, weight: 600, ls: 4, opacity: 0.85 })}
  ${mono(60, 435, '&amp; AI ENGINEER', { size: 44, weight: 600, ls: 4, fill: ACCENT })}
  ${emblem(1040, 360, 220)}

  <line x1="60" y1="${H - 74}" x2="${W - 60}" y2="${H - 74}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>
  ${mono(60, H - 44, 'I BUILD AND SHIP COMPLETE PRODUCTS', { size: 14, opacity: 0.6, ls: 2.4 })}
  ${mono(W - 60, H - 44, '2026', { anchor: 'end', size: 14, opacity: 0.6, ls: 2.4 })}
</svg>`;

mkdirSync('public/og', { recursive: true });
writeFileSync('/tmp/og-home.svg', home);
execFileSync('rsvg-convert', ['-w', String(W), '/tmp/og-home.svg', '-o', 'public/og/default-en.png']);
console.log('wrote public/og/default-en.png');

/* ---------- one card per project, straight from its cover plate ---------- */
for (const slug of readdirSync('src/assets/projects')) {
  const src = `src/assets/projects/${slug}/cover.svg`;
  const out = `public/og/${slug}.png`;
  execFileSync('rsvg-convert', ['-w', '1200', src, '-o', out]);
  console.log('wrote', out);
}
