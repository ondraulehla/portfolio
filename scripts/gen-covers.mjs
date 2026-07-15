/**
 * Generates the project cover SVGs as a consistent series of "technical
 * plates": bone paper, hairline grid, crop marks, mono spec labels and an
 * engraved line diagram per project – ink + vermilion only.
 *
 *   node scripts/gen-covers.mjs
 */
import { writeFileSync } from 'node:fs';

const W = 1200;
const H = 675;
const PAPER = '#f7f3ea';
const INK = '#29221b';
const LINE = '#e2dac8';
const ACCENT = '#c2360c';
const MONO = "font-family='ui-monospace, Menlo, Consolas, monospace'";

/* ---------- shared plate furniture ---------- */

function grid() {
  let s = `<g stroke="${LINE}" stroke-width="1">`;
  for (let x = 60; x < W; x += 60) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 15; y < H; y += 60) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  s += '</g>';
  return s;
}

function cropMarks() {
  const m = 26;
  const l = 16;
  const c = `stroke="${INK}" stroke-opacity="0.65" stroke-width="2"`;
  return `<g ${c}>
    <path d="M${m} ${m + l} V${m} H${m + l}" fill="none"/>
    <path d="M${W - m - l} ${m} H${W - m} V${m + l}" fill="none"/>
    <path d="M${W - m} ${H - m - l} V${H - m} H${W - m - l}" fill="none"/>
    <path d="M${m + l} ${H - m} H${m} V${H - m - l}" fill="none"/>
  </g>`;
}

function mono(x, y, text, { size = 19, anchor = 'start', fill = INK, ls = 3, opacity = 1, weight = 500 } = {}) {
  return `<text x="${x}" y="${y}" ${MONO} font-size="${size}" font-weight="${weight}" letter-spacing="${ls}" text-anchor="${anchor}" fill="${fill}" fill-opacity="${opacity}">${text}</text>`;
}

function hatch(x, y, w, h, color = INK, opacity = 0.5) {
  let s = `<g clip-path="url(#hp-${x}-${y})"><defs><clipPath id="hp-${x}-${y}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`;
  s += `<g stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.4">`;
  for (let i = -h; i < w + h; i += 7) {
    s += `<line x1="${x + i}" y1="${y + h}" x2="${x + i + h}" y2="${y}"/>`;
  }
  s += '</g></g>';
  return s;
}

function quiltStar(cx, cy, s) {
  const r = (x, y, w, rot = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${w}" ${rot ? `transform="rotate(${rot})"` : ''}/>`;
  const u = s / 48;
  return `<g fill="none" stroke="${INK}" stroke-opacity="0.7" stroke-width="${1.3 / u}" transform="translate(${cx - s / 2} ${cy - s / 2}) scale(${u})">
    ${r(7.5, 7.5, 11)}${r(29.5, 7.5, 11)}${r(7.5, 29.5, 11)}${r(29.5, 29.5, 11)}
    ${r(18.5, 4.5, 11, '45 24 10')}${r(32.5, 18.5, 11, '45 38 24')}${r(18.5, 32.5, 11, '45 24 38')}${r(4.5, 18.5, 11, '45 10 24')}
  </g>`;
}

function plate(index, name, caption, diagram) {
  const num = String(index).padStart(2, '0');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${grid()}
  ${cropMarks()}
  <!-- header band -->
  ${mono(60, 76, `PLATE ${num}`, { fill: ACCENT, size: 20, weight: 600 })}
  ${mono(208, 76, name.toUpperCase(), { size: 20, weight: 600 })}
  ${mono(W - 60, 76, 'ONDREJ ULEHLA · 2026', { anchor: 'end', size: 15, opacity: 0.55 })}
  <line x1="60" y1="94" x2="${W - 60}" y2="94" stroke="${INK}" stroke-opacity="0.6" stroke-width="1.6"/>
  ${hatch(60, 100, 150, 8)}
  <!-- diagram -->
  ${diagram}
  <!-- footer -->
  <line x1="60" y1="${H - 74}" x2="${W - 60}" y2="${H - 74}" stroke="${INK}" stroke-opacity="0.35" stroke-width="1"/>
  ${mono(60, ` ${H - 44}`.trim(), caption.toUpperCase(), { size: 14, opacity: 0.6, ls: 2.4 })}
  ${quiltStar(W - 82, H - 49, 40)}
</svg>
`;
}

/* ---------- diagram helpers ---------- */

const thin = `stroke="${INK}" stroke-width="1.6" fill="none"`;
const mid = `stroke="${INK}" stroke-width="2.2" fill="none"`;
const acc = `stroke="${ACCENT}" stroke-width="2.2" fill="none"`;

function box(x, y, w, h, { dash = 0, stroke = INK, sw = 2.2 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

function arrow(x1, y1, x2, y2, { stroke = INK, sw = 2, dash = 0 } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const l = 11;
  const p1x = x2 - l * Math.cos(a - 0.42);
  const p1y = y2 - l * Math.sin(a - 0.42);
  const p2x = x2 - l * Math.cos(a + 0.42);
  const p2y = y2 - l * Math.sin(a + 0.42);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
  <path d="M${x2} ${y2} L${p1x} ${p1y} M${x2} ${y2} L${p2x} ${p2y}" stroke="${stroke}" stroke-width="${sw}" fill="none"/>`;
}

function diamond(cx, cy, s, fill = ACCENT) {
  return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" fill="${fill}" transform="rotate(45 ${cx} ${cy})"/>`;
}

/* ---------- the eight plates ---------- */

const covers = {};

/* 01 readme-ci: README doc, fenced blocks wired to a CI rail, one fails */
covers['readme-ci'] = plate(
  1,
  'readme-ci',
  'Run the code blocks in your readme · fail ci when the quickstart breaks',
  (() => {
    let d = '';
    // document
    d += box(140, 150, 470, 400);
    d += mono(170, 196, '# README.MD', { size: 17, weight: 600 });
    d += `<line x1="170" y1="216" x2="480" y2="216" ${thin} stroke-opacity="0.4"/>`;
    d += `<line x1="170" y1="236" x2="420" y2="236" ${thin} stroke-opacity="0.4"/>`;
    // three fenced blocks
    const blocks = [262, 352, 442];
    blocks.forEach((y, i) => {
      d += box(170, y, 410, 62, { dash: 0, sw: 1.6 });
      d += mono(186, y + 25, '```BASH', { size: 13, opacity: 0.55, ls: 2 });
      d += `<line x1="186" y1="${y + 42}" x2="${i === 2 ? 430 : 360}" y2="${y + 42}" ${acc}/>`;
      // wire to rail
      d += `<line x1="580" y1="${y + 31}" x2="700" y2="${y + 31}" ${thin} stroke-dasharray="2 6"/>`;
    });
    // CI rail
    d += `<line x1="700" y1="230" x2="700" y2="530" ${mid}/>`;
    const marks = [
      { y: 293, ok: true },
      { y: 383, ok: true },
      { y: 473, ok: false },
    ];
    marks.forEach((m) => {
      d += box(674, m.y - 26, 52, 52, { sw: 2.2, stroke: m.ok ? INK : ACCENT });
      d += m.ok
        ? `<path d="M688 ${m.y} l9 10 l17 -20" ${mid}/>`
        : `<path d="M690 ${m.y - 10} l20 20 M710 ${m.y - 10} l-20 20" ${acc}/>`;
    });
    d += mono(760, 298, 'PASS', { size: 15, opacity: 0.6 });
    d += mono(760, 388, 'PASS', { size: 15, opacity: 0.6 });
    d += mono(760, 478, 'EXIT 1 · LINE 47', { size: 15, fill: ACCENT, weight: 600 });
    // pointer back to the failing block
    d += arrow(880, 505, 596, 473, { stroke: ACCENT, dash: '7 6' });
    d += mono(860, 545, 'ANNOTATED IN THE PR', { size: 13, opacity: 0.55 });
    return d;
  })(),
);

/* 02 mcp-sandbox: client → stdio bridge → isolated sandbox */
covers['mcp-sandbox'] = plate(
  2,
  'mcp-sandbox',
  'Run any mcp server inside an isolated cloud sandbox · one command',
  (() => {
    let d = '';
    d += box(120, 280, 220, 120);
    d += mono(230, 330, 'MCP CLIENT', { size: 16, anchor: 'middle', weight: 600 });
    d += mono(230, 356, 'CLAUDE · IDE', { size: 12, anchor: 'middle', opacity: 0.5 });
    // bridge
    d += arrow(340, 340, 470, 340);
    d += box(470, 306, 150, 68, { sw: 1.8 });
    d += mono(545, 336, 'STDIO', { size: 14, anchor: 'middle', weight: 600 });
    d += mono(545, 356, 'BRIDGE', { size: 14, anchor: 'middle', weight: 600 });
    d += arrow(620, 340, 740, 340);
    // sandbox: dashed isolation border with hatched buffer zone
    d += box(740, 170, 330, 340, { dash: '10 8', sw: 2.4, stroke: ACCENT });
    d += hatch(740, 170, 330, 16, ACCENT, 0.4);
    d += hatch(740, 494, 330, 16, ACCENT, 0.4);
    d += mono(905, 212, 'E2B SANDBOX', { size: 16, anchor: 'middle', weight: 600, fill: ACCENT });
    d += box(800, 250, 210, 90);
    d += mono(905, 289, 'MCP SERVER', { size: 14, anchor: 'middle', weight: 600 });
    d += mono(905, 312, 'UNTRUSTED', { size: 12, anchor: 'middle', opacity: 0.5 });
    // blast radius contained
    d += `<circle cx="905" cy="415" r="52" ${acc} stroke-dasharray="3 6"/>`;
    d += diamond(905, 415, 10);
    d += mono(905, 415 + 76, 'BLAST RADIUS · CONTAINED', { size: 12, anchor: 'middle', opacity: 0.6 });
    d += mono(230, 430, 'NO CODE CHANGES', { size: 12, anchor: 'middle', opacity: 0.55 });
    return d;
  })(),
);

/* 03 agent-audit: config scan with flagged findings */
covers['agent-audit'] = plate(
  3,
  'agent-audit',
  'Security auditor for ai agent configurations · finds them before they hurt you',
  (() => {
    let d = '';
    // config doc with line numbers
    d += box(140, 150, 440, 400);
    for (let i = 0; i < 12; i++) {
      const y = 190 + i * 31;
      d += mono(166, y + 5, String(i + 1).padStart(2, '0'), { size: 12, opacity: 0.35 });
      const flagged = i === 2 || i === 6 || i === 9;
      const wj = 90 + ((i * 73) % 210);
      d += `<line x1="205" y1="${y}" x2="${205 + wj + (flagged ? 60 : 0)}" y2="${y}" stroke="${flagged ? ACCENT : INK}" stroke-opacity="${flagged ? 1 : 0.35}" stroke-width="${flagged ? 3 : 2}"/>`;
      if (flagged) d += diamond(148 + 12, y, 9);
    }
    // leader lines to findings
    const findings = [
      { y: 190 + 2 * 31, code: 'MCP003', label: 'INLINE API KEY' },
      { y: 190 + 6 * 31, code: 'CC001', label: 'BASH (*) ALLOWED' },
      { y: 190 + 9 * 31, code: 'SK001', label: 'PROMPT INJECTION' },
    ];
    findings.forEach((f, i) => {
      const y = 205 + i * 110;
      d += `<path d="M${580} ${f.y} H 660 V ${y} H 700" stroke="${ACCENT}" stroke-width="1.8" fill="none"/>`;
      d += box(700, y - 34, 330, 68, { sw: 1.8 });
      d += mono(724, y - 6, f.code, { size: 16, weight: 600, fill: ACCENT });
      d += mono(724, y + 18, f.label, { size: 13, opacity: 0.6 });
      d += hatch(1006, y - 34, 24, 68, ACCENT, 0.45);
    });
    d += mono(360, 585, '3 FINDINGS · 0 FALSE POSITIVES', { size: 13, anchor: 'middle', opacity: 0.6 });
    return d;
  })(),
);

/* 04 agent-lens: session timeline with tool-call tracks */
covers['agent-lens'] = plate(
  4,
  'agent-lens',
  'Drop an agent transcript in the browser · see where the time and tokens went',
  (() => {
    let d = '';
    const x0 = 150;
    const x1 = 1050;
    const y0 = 180;
    // time axis
    d += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" ${mid}/>`;
    for (let i = 0; i <= 8; i++) {
      const x = x0 + ((x1 - x0) / 8) * i;
      d += `<line x1="${x}" y1="${y0 - 7}" x2="${x}" y2="${y0 + 7}" ${thin}/>`;
      d += mono(x, y0 - 18, `${i * 6}S`, { size: 12, anchor: 'middle', opacity: 0.45 });
    }
    // tracks
    const tracks = [
      { label: 'MODEL', bars: [[0, 10], [22, 30], [39, 48]] },
      { label: 'BASH', bars: [[10, 20]] },
      { label: 'READ', bars: [[20, 22], [30, 33]] },
      { label: 'EDIT', bars: [[33, 39], [48, 46.5]], fail: 1 },
    ];
    tracks.forEach((t, ti) => {
      const y = 240 + ti * 82;
      d += mono(x0 - 14, y + 20, t.label, { size: 14, anchor: 'end', opacity: 0.6, weight: 600 });
      d += `<line x1="${x0}" y1="${y + 14}" x2="${x1}" y2="${y + 14}" ${thin} stroke-opacity="0.25"/>`;
      t.bars.forEach(([a, b], bi) => {
        const bx = x0 + ((x1 - x0) / 48) * a;
        const bw = Math.max(Math.abs(((x1 - x0) / 48) * (b - a)), 14);
        const failed = t.fail === bi;
        d += `<rect x="${bx}" y="${y}" width="${bw}" height="28" fill="${failed ? PAPER : ti === 0 ? ACCENT : PAPER}" stroke="${failed ? ACCENT : INK}" stroke-width="2"/>`;
        if (failed) d += hatch(bx, y, bw, 28, ACCENT, 0.7);
      });
    });
    d += mono(x0, 590, '48.0 S · 2 TURNS · 8 TOOL CALLS · 1 FAILED · $0.15 EST.', { size: 14, opacity: 0.65 });
    d += arrow(985, 560, 942, 495, { stroke: ACCENT, dash: '6 6' });
    d += mono(1000, 578, 'FAILED EDIT', { size: 13, anchor: 'end', fill: ACCENT, weight: 600 });
    return d;
  })(),
);

/* 05 neural-vr: MLP layers + decision surface swatch */
covers['neural-vr'] = plate(
  5,
  'neural networks in vr',
  'Master’s thesis · configure a network on the web, walk through it in vr',
  (() => {
    let d = '';
    const layers = [
      { x: 240, n: 4 },
      { x: 430, n: 6 },
      { x: 620, n: 6 },
      { x: 810, n: 3 },
    ];
    const cy = 360;
    const gap = 62;
    // edges
    for (let li = 0; li < layers.length - 1; li++) {
      const a = layers[li];
      const b = layers[li + 1];
      for (let i = 0; i < a.n; i++) {
        for (let j = 0; j < b.n; j++) {
          const y1 = cy + (i - (a.n - 1) / 2) * gap;
          const y2 = cy + (j - (b.n - 1) / 2) * gap;
          const w = (i * 7 + j * 5 + li * 3) % 9;
          d += `<line x1="${a.x}" y1="${y1}" x2="${b.x}" y2="${y2}" stroke="${w < 2 ? ACCENT : INK}" stroke-opacity="${w < 2 ? 0.8 : 0.16}" stroke-width="${w < 2 ? 2 : 1.2}"/>`;
        }
      }
    }
    // nodes
    layers.forEach((l, li) => {
      for (let i = 0; i < l.n; i++) {
        const y = cy + (i - (l.n - 1) / 2) * gap;
        const hot = (i + li) % 3 === 0;
        d += `<circle cx="${l.x}" cy="${y}" r="17" fill="${PAPER}" stroke="${hot ? ACCENT : INK}" stroke-width="${hot ? 3 : 2}"/>`;
        if (hot) d += `<circle cx="${l.x}" cy="${y}" r="7" fill="${ACCENT}"/>`;
      }
    });
    d += mono(240, 572, 'X · Y · X² · SIN πX', { size: 13, anchor: 'middle', opacity: 0.55 });
    d += mono(810, 572, 'SOFTMAX · 3 CLASSES', { size: 13, anchor: 'middle', opacity: 0.55 });
    // decision surface swatch
    d += box(930, 210, 150, 150, { sw: 2 });
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const on = Math.sin(i * 1.1 + j * 0.6) > 0.1;
        if (on) d += `<rect x="${932 + i * 24.5}" y="${212 + j * 24.5}" width="24.5" height="24.5" fill="${ACCENT}" fill-opacity="0.7"/>`;
      }
    d += mono(1005, 392, 'DECISION SURFACE', { size: 12, anchor: 'middle', opacity: 0.55 });
    return d;
  })(),
);

/* 06 ai-framework: monorepo core with docking plugin modules */
covers['ai-framework'] = plate(
  6,
  'ai application platform',
  'Typescript monorepo for ai products · plugin architecture · typed apis',
  (() => {
    let d = '';
    // core
    d += box(470, 270, 260, 150, { sw: 2.6 });
    d += mono(600, 330, 'CORE', { size: 18, anchor: 'middle', weight: 600 });
    d += mono(600, 356, 'TYPED API · TRPC', { size: 12, anchor: 'middle', opacity: 0.55 });
    d += hatch(470, 270, 260, 12);
    // plugins docking
    const plugs = [
      { x: 150, y: 170, label: 'CHAT' },
      { x: 150, y: 430, label: 'RAG' },
      { x: 900, y: 170, label: 'AGENTS' },
      { x: 900, y: 430, label: 'BILLING' },
    ];
    plugs.forEach((p) => {
      d += box(p.x, p.y, 180, 90);
      d += mono(p.x + 90, p.y + 40, p.label, { size: 15, anchor: 'middle', weight: 600 });
      d += mono(p.x + 90, p.y + 63, 'PLUGIN', { size: 11, anchor: 'middle', opacity: 0.5 });
      // connector: notched line into the core
      const fromX = p.x < 400 ? p.x + 180 : p.x;
      const toX = p.x < 400 ? 470 : 730;
      const y = p.y + 45;
      const toY = p.y < 300 ? 300 : 390;
      d += `<path d="M${fromX} ${y} H ${(fromX + toX) / 2} V ${toY} H ${toX}" ${mid}/>`;
      d += diamond(toX, toY, 10);
    });
    d += mono(600, 560, 'ONE DESIGN SYSTEM · SHARED SCHEMAS · PNPM WORKSPACES', { size: 13, anchor: 'middle', opacity: 0.6 });
    return d;
  })(),
);

/* 07 url-shortener: request flow through services with a queue */
covers['url-shortener'] = plate(
  7,
  'url shortener on microservices',
  'Hash · store · redirect · async analytics over a message queue',
  (() => {
    let d = '';
    d += mono(150, 172, 'HTTPS://VERY-LONG-URL.EXAMPLE/PATH?q=…', { size: 14, opacity: 0.6 });
    d += arrow(150, 188, 150, 330);
    d += box(120, 330, 190, 90);
    d += mono(215, 368, 'API', { size: 16, anchor: 'middle', weight: 600 });
    d += mono(215, 392, 'EXPRESS', { size: 11, anchor: 'middle', opacity: 0.5 });
    d += arrow(310, 375, 430, 375);
    d += box(430, 330, 190, 90);
    d += mono(525, 368, 'HASHER', { size: 16, anchor: 'middle', weight: 600 });
    d += mono(525, 392, 'BASE62', { size: 11, anchor: 'middle', opacity: 0.5 });
    d += arrow(620, 375, 740, 375);
    d += box(740, 330, 190, 90);
    d += mono(835, 368, 'STORE', { size: 16, anchor: 'middle', weight: 600 });
    d += mono(835, 392, 'REDIS · PG', { size: 11, anchor: 'middle', opacity: 0.5 });
    // redirect loop
    d += `<path d="M930 375 H 1030 V 210 H 260 V 320" ${acc} stroke-dasharray="8 7"/>`;
    d += arrow(260, 315, 260, 330, { stroke: ACCENT });
    d += mono(645, 200, '301 · ULEH.LA/K7', { size: 15, anchor: 'middle', fill: ACCENT, weight: 600 });
    // queue to analytics
    const qy = 500;
    d += `<line x1="525" y1="420" x2="525" y2="${qy}" ${thin} stroke-dasharray="2 6"/>`;
    for (let i = 0; i < 5; i++) d += diamond(430 + i * 48, qy, 12, i < 3 ? ACCENT : PAPER) + (i >= 3 ? `<rect x="${430 + i * 48 - 6}" y="${qy - 6}" width="12" height="12" fill="none" stroke="${INK}" stroke-width="1.6" transform="rotate(45 ${430 + i * 48} ${qy})"/>` : '');
    d += mono(390, qy + 5, 'QUEUE', { size: 13, anchor: 'end', opacity: 0.6 });
    d += arrow(670, qy, 740, qy);
    d += box(740, qy - 40, 190, 80);
    d += mono(835, qy - 5, 'ANALYTICS', { size: 14, anchor: 'middle', weight: 600 });
    d += mono(835, qy + 18, 'ASYNC WORKER', { size: 11, anchor: 'middle', opacity: 0.5 });
    return d;
  })(),
);

/* 08 tradeup: histogram + EV curve crossing break-even */
covers['tradeup-calculator'] = plate(
  8,
  'trade-up profit calculator',
  'Market data ingestion · probability model · expected value per contract',
  (() => {
    let d = '';
    const x0 = 170;
    const y0 = 540;
    const wCh = 760;
    const hCh = 330;
    // axes
    d += `<line x1="${x0}" y1="${y0}" x2="${x0 + wCh}" y2="${y0}" ${mid}/>`;
    d += `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 - hCh}" ${mid}/>`;
    d += mono(x0 - 18, y0 - hCh + 4, 'EV', { size: 13, anchor: 'end', opacity: 0.6 });
    d += mono(x0 + wCh, y0 + 28, 'CONTRACT', { size: 13, anchor: 'end', opacity: 0.6 });
    // break-even dashed line
    const beY = y0 - 150;
    d += `<line x1="${x0}" y1="${beY}" x2="${x0 + wCh}" y2="${beY}" ${thin} stroke-dasharray="7 7" stroke-opacity="0.5"/>`;
    d += mono(x0 + wCh + 8, beY + 5, '±0', { size: 13, opacity: 0.55 });
    // histogram bars (outcome distribution)
    const bars = [40, 85, 130, 190, 150, 110, 70, 45, 120, 210, 165, 95];
    bars.forEach((bh, i) => {
      const bx = x0 + 30 + i * 60;
      const profit = bh > 150;
      d += `<rect x="${bx}" y="${y0 - bh}" width="34" height="${bh}" fill="${profit ? ACCENT : PAPER}" fill-opacity="${profit ? 0.85 : 1}" stroke="${INK}" stroke-width="1.8"/>`;
    });
    // EV curve
    const pts = bars.map((bh, i) => `${x0 + 47 + i * 60},${y0 - 60 - bh * 0.8}`).join(' ');
    d += `<polyline points="${pts}" stroke="${ACCENT}" stroke-width="3" fill="none"/>`;
    // marked best contract
    d += diamond(x0 + 47 + 9 * 60, y0 - 60 - 210 * 0.8, 14);
    d += mono(x0 + 47 + 9 * 60, y0 - 60 - 210 * 0.8 - 22, '+38 %', { size: 15, anchor: 'middle', fill: ACCENT, weight: 600 });
    return d;
  })(),
);

/* ---------- write files ---------- */
for (const [slug, svg] of Object.entries(covers)) {
  const path = `src/assets/projects/${slug}/cover.svg`;
  writeFileSync(path, svg);
  console.log('wrote', path);
}
