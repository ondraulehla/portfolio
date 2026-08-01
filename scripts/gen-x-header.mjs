/**
 * Generates the X/Twitter profile header (1500×500) in the technical-plate
 * language – bone paper, hairline grid, crop marks, mono spec labels,
 * ink + vermilion only, same vocabulary as the project covers.
 *
 *  - public/og/x-header.png
 *
 * Safe zones: the bottom-left corner (x < 380, y > 395) stays empty because
 * the avatar sits there, and all type stays inside the crop marks so nothing
 * is clipped on narrow viewports.
 *
 * Requires librsvg (rsvg-convert) – `brew install librsvg`.
 *
 *   node scripts/gen-x-header.mjs
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 1500;
const H = 500;
const PAPER = '#f7f3ea';
const INK = '#29221b';
const LINE = '#e2dac8';
const ACCENT = '#cb3a00';
const MONO = "font-family='Menlo, Consolas, monospace'";

function grid() {
  let s = `<g stroke="${LINE}" stroke-width="1">`;
  for (let x = 60; x < W; x += 60) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 20; y < H; y += 60) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
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

function mono(
  x,
  y,
  text,
  { size = 19, anchor = 'start', fill = INK, ls = 3, opacity = 1, weight = 500 } = {},
) {
  return `<text x="${x}" y="${y}" ${MONO} font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" text-anchor="${anchor}" fill="${fill}" fill-opacity="${opacity}">${text}</text>`;
}

function hatch(x, y, w, h, color = INK, opacity = 0.5) {
  let s = `<defs><clipPath id="hp-${x}-${y}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`;
  s += `<g clip-path="url(#hp-${x}-${y})"><g stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.4">`;
  for (let i = -h; i < w + h; i += 7)
    s += `<line x1="${x + i}" y1="${y + h}" x2="${x + i + h}" y2="${y}"/>`;
  return s + '</g></g>';
}

function quiltStar(cx, cy, s) {
  // "rosette-1" from a-single-div – the site emblem
  const r = (x, y, rot = '') =>
    `<rect x="${x}" y="${y}" width="30" height="30" ${rot ? `transform="rotate(${rot})"` : ''}/>`;
  const u = s / 150;
  return `<g fill="none" stroke="${INK}" stroke-opacity="0.7" stroke-width="${1.5 / u}" transform="translate(${cx - s / 2} ${cy - s / 2}) scale(${u})">
    ${r(22, 22)}${r(98, 22)}${r(22, 98)}${r(98, 98)}
    ${r(60, 6, '45 75 21')}${r(114, 60, '45 129 75')}${r(60, 114, '45 75 129')}${r(6, 60, '45 21 75')}
    <polygon points="75,51 78.6,66.2 92,58 83.8,71.4 99,75 83.8,78.6 92,92 78.6,83.8 75,99 71.4,83.8 58,92 66.2,78.6 51,75 66.2,71.4 58,58 71.4,66.2"/>
    <path d="M75 68v14M68 75h14"/>
  </g>`;
}

const thin = `stroke="${INK}" stroke-width="2" fill="none"`;
const mid = `stroke="${INK}" stroke-width="3" fill="none"`;
const acc = `stroke="${ACCENT}" stroke-width="3" fill="none"`;

function box(x, y, w, h, { dash = 0, stroke = INK, sw = 2.8 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

function diamond(cx, cy, s, fill = ACCENT) {
  return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="${fill}" transform="rotate(45 ${cx} ${cy})"/>`;
}

/* ---------- three recorded flights: two land, one diverges ---------- */

function flights() {
  let d = '';
  const x0 = 620;
  const laneW = 460;
  const lanes = [118, 220, 322];
  // shared route – one vertex per tool call
  const path = [
    [0.03, 60],
    [0.14, 28],
    [0.28, 46],
    [0.43, 22],
    [0.6, 38],
    [0.78, 26],
    [0.95, 32],
  ].map(([t, dy]) => [x0 + t * laneW, dy]);

  lanes.forEach((yt, i) => {
    const diverged = i === 2;
    d += box(x0 - 20, yt, laneW + 60, 88, { dash: '7 6', sw: 1.8 });
    d += mono(x0 - 6, yt + 20, `E2B SANDBOX 0${i + 1}`, { size: 11, opacity: 0.45, ls: 2 });

    const upto = diverged ? 4 : path.length;
    const pts = path.slice(0, upto).map(([x, dy]) => `${x},${yt + dy}`);
    d += `<polyline points="${pts.join(' ')}" ${mid}/>`;

    if (diverged) {
      // ghost of the expected route, then the accent fork
      const ghost = path.slice(3).map(([x, dy]) => `${x},${yt + dy}`);
      d += `<polyline points="${ghost.join(' ')}" ${thin} stroke-opacity="0.3" stroke-dasharray="3 7"/>`;
      const [fx, fy] = path[3];
      d += `<polyline points="${fx},${yt + fy} ${fx + 70},${yt + 72} ${fx + 160},${yt + 80}" ${acc}/>`;
      d += diamond(fx, yt + fy, 13);
    }

    (diverged ? path.slice(0, 4) : path).forEach(([x, dy]) => {
      d += `<circle cx="${x}" cy="${yt + dy}" r="4.5" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>`;
    });

    // assertion verdict
    const my = yt + 44;
    const bx = x0 + laneW + 70;
    d += `<line x1="${x0 + laneW + 40}" y1="${my}" x2="${bx}" y2="${my}" ${thin} stroke-dasharray="2 6"/>`;
    d += box(bx, my - 22, 44, 44, { sw: 2.2, stroke: diverged ? ACCENT : INK });
    d += diverged
      ? `<path d="M${bx + 13} ${my - 9} l18 18 M${bx + 31} ${my - 9} l-18 18" ${acc}/>`
      : `<path d="M${bx + 11} ${my + 1} l8 9 l15 -18" ${mid}/>`;
    d += diverged
      ? mono(bx + 60, my + 5, 'DIVERGED · STEP 4', { size: 14, fill: ACCENT, weight: 600, ls: 2 })
      : mono(bx + 60, my + 5, 'PASS', { size: 14, opacity: 0.55, ls: 2 });
  });
  return d;
}

/* ---------- compose ---------- */

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${grid()}
  ${cropMarks()}

  ${mono(60, 70, 'ONDREJ ULEHLA', { fill: ACCENT, size: 21, weight: 600, ls: 5 })}
  ${mono(W - 60, 70, 'PRAGUE · FULLSTACK &amp; AGENT INFRASTRUCTURE', { anchor: 'end', size: 13, opacity: 0.55, ls: 2.4 })}
  <line x1="60" y1="88" x2="${W - 60}" y2="88" stroke="${INK}" stroke-opacity="0.6" stroke-width="1.6"/>
  ${hatch(60, 94, 150, 8)}

  ${mono(60, 175, 'A DEMO THAT', { size: 40, weight: 600, ls: 1 })}
  ${mono(60, 225, 'WORKS ONCE', { size: 40, weight: 600, ls: 1 })}
  ${mono(60, 273, 'TELLS YOU NOTHING.', { size: 26, weight: 600, ls: 1, fill: ACCENT })}
  <line x1="60" y1="303" x2="520" y2="303" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>

  ${flights()}

  <line x1="440" y1="432" x2="${W - 60}" y2="432" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>
  ${mono(440, 462, 'PASS RATE · FLAKINESS · COST PER SUCCESS · ULEHLA.DEV', { size: 13, opacity: 0.6, ls: 2 })}
  ${quiltStar(W - 82, 452, 40)}
</svg>
`;

mkdirSync('public/og', { recursive: true });
writeFileSync('/tmp/x-header.svg', svg);
execFileSync('rsvg-convert', [
  '-w',
  String(W),
  '-h',
  String(H),
  '/tmp/x-header.svg',
  '-o',
  'public/og/x-header.png',
]);
console.log('wrote public/og/x-header.png');
