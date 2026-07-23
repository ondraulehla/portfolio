/**
 * Interactive neural-network visualizer – the revived core of my master's
 * thesis. The network is fully editable, like the original configurator:
 * neuron counts of every layer including input (engineered features of x, y)
 * and output (binary sigmoid or 2–3-class softmax), adding/removing hidden
 * layers, and clicking any edge in the 2D schematic to edit that individual
 * weight. The decision surface learns the dataset live via backprop, and a
 * 3D model arranges each layer's neurons in a ring – a volumetric "3D brain"
 * that lights up with activations.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  MLP,
  makeDataset,
  features,
  FEATURE_NAMES,
  MAX_FEATURES,
  type Activation,
  type DatasetKind,
  type Point,
} from './nn';

interface Theme {
  /** class colours by index: 0 = cool, 1 = accent, 2 = teal, 3 = ochre */
  classes: string[];
  ink: string;
  /** page background the decision surface fades towards at low confidence */
  surface: string;
  edgePos: number;
  edgeNeg: number;
}

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const dark = document.documentElement.dataset.theme === 'dark';
  const accent = css.getPropertyValue('--accent').trim() || '#c0392b';
  return {
    classes: [
      dark ? '#5b6b8c' : '#8aa0c8',
      accent,
      dark ? '#4db3a4' : '#2f8f83',
      dark ? '#c9a94e' : '#a8842c',
    ],
    ink: css.getPropertyValue('--ink').trim() || '#111',
    surface: css.getPropertyValue('--surface').trim() || (dark ? '#17110f' : '#fbf7f0'),
    edgePos: 0xd8613a,
    edgeNeg: 0x7f8aa6,
  };
}

const MAX_HIDDEN_LAYERS = 3;
const MAX_NEURONS = 10;
const MAX_OUTPUTS = 4;

export function initNeural(): void {
  const surface = document.getElementById('nn-surface') as HTMLCanvasElement;
  const canvas3d = document.getElementById('nn-3d') as HTMLCanvasElement;
  const schematic = document.getElementById('nn-schematic') as HTMLDivElement;
  const schemWrap = document.getElementById('nn-schem-wrap') as HTMLElement;
  const layersEl = document.getElementById('nn-layers') as HTMLDivElement;
  if (!surface || !canvas3d || !schematic || !schemWrap || !layersEl) return;
  // guard against double-init (astro:page-load fires once per navigation, but
  // the swapped-in DOM is fresh, so the marker resets on every visit)
  if (surface.dataset.nnInit) return;
  surface.dataset.nnInit = '1';

  const state = {
    dataset: 'circle' as DatasetKind,
    activation: 'tanh' as Activation,
    /** neuron counts: input features, hidden layers, output units */
    inputs: 2,
    hidden: [8, 8],
    outputs: 1,
    lr: 0.15,
    running: true,
    turbo: false,
    epoch: 0,
    loss: 1,
    acc: 0,
    /** what the edges encode: raw weights, or w × source activation for the probed point */
    edgeMode: 'weights' as 'weights' | 'flow',
  };
  const arch = () => [state.inputs, ...state.hidden, state.outputs];
  const classCount = () => (state.outputs === 1 ? 2 : state.outputs);

  // ---- configuration ↔ URL hash ---------------------------------------------
  // #dataset/arch/activation/lr, e.g. #spiral/6-8-6-1/tanh/0.15 – a lab state
  // is a link you can put in a message or a case study.
  const DATASETS: DatasetKind[] = ['circle', 'xor', 'spiral', 'gaussian'];
  const ACTIVATIONS: Activation[] = ['tanh', 'sigmoid', 'relu'];

  function readHash(): void {
    const parts = location.hash.slice(1).split('/');
    if (parts.length !== 4) return;
    const [ds, archStr, act, lrStr] = parts as [string, string, string, string];
    const sizes = archStr.split('-').map(Number);
    const lr = parseFloat(lrStr);
    if (!DATASETS.includes(ds as DatasetKind)) return;
    if (!ACTIVATIONS.includes(act as Activation)) return;
    if (sizes.length < 2 || sizes.length > 2 + MAX_HIDDEN_LAYERS) return;
    if (sizes.some((n) => !Number.isInteger(n) || n < 1)) return;
    const [inputs, ...rest] = sizes as [number, ...number[]];
    const outputs = rest.pop()!;
    if (inputs > MAX_FEATURES || outputs > MAX_OUTPUTS || rest.some((n) => n > MAX_NEURONS)) return;
    if (!(lr > 0 && lr <= 1)) return;
    state.dataset = ds as DatasetKind;
    state.activation = act as Activation;
    state.inputs = inputs;
    state.hidden = rest;
    state.outputs = outputs;
    state.lr = lr;
  }
  readHash();

  function writeHash(): void {
    const hash = `#${state.dataset}/${arch().join('-')}/${state.activation}/${state.lr}`;
    history.replaceState(null, '', hash);
  }

  /** Reflect state in the segmented controls (hash seeding, presets). */
  function syncSegButtons(): void {
    const sync = (selector: string, match: (v: string) => boolean) => {
      document
        .querySelectorAll<HTMLElement>(selector)
        .forEach((b) => b.setAttribute('aria-pressed', String(match(b.dataset.value!))));
    };
    sync('[data-nn-dataset]', (v) => v === state.dataset);
    sync('[data-nn-activation]', (v) => v === state.activation);
    sync('[data-nn-lr]', (v) => parseFloat(v) === state.lr);
    sync('[data-nn-edges]', (v) => v === state.edgeMode);
  }

  let data: Point[] = makeDataset(state.dataset, 220, 7, classCount());
  let net = new MLP(arch(), state.activation, 42);
  let theme = readTheme();

  const feats = (x: number, y: number) => features(x, y, state.inputs);

  /**
   * Point the activation colours refer to. Clicking the surface pins a point
   * (until it is clicked again or another point is picked); hovering
   * previews a point temporarily on top of the pin.
   */
  let pinned: { x: number; y: number } | null = null;
  let hover: { x: number; y: number } | null = null;
  const probePoint = () => hover ?? pinned ?? { x: 0.5, y: 0.5 };

  // ---- 2D decision surface --------------------------------------------------
  const sctx = surface.getContext('2d')!;
  const GRID = 64;
  const grid = sctx.createImageData(GRID, GRID);

  function drawSurface() {
    const rgb = theme.classes.map(hexToRgb);
    const bg = hexToRgb(theme.surface);
    let i = 0;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x = (gx / (GRID - 1)) * 2 - 1;
        const y = 1 - (gy / (GRID - 1)) * 2;
        const p = net.probs(feats(x, y));
        // winning class sets the hue, its confidence the saturation – regions
        // read crisply and the decision boundary shows up as a pale seam
        let best = 0;
        for (let c = 1; c < p.length; c++) if (p[c]! > p[best]!) best = c;
        const conf = (p[best]! - 1 / p.length) / (1 - 1 / p.length);
        const mix = 0.12 + 0.6 * conf;
        const cc = rgb[best]!;
        grid.data[i++] = Math.round(bg.r + (cc.r - bg.r) * mix);
        grid.data[i++] = Math.round(bg.g + (cc.g - bg.g) * mix);
        grid.data[i++] = Math.round(bg.b + (cc.b - bg.b) * mix);
        grid.data[i++] = 255;
      }
    }
    // scale the low-res grid up into the visible canvas
    const off = new OffscreenCanvas(GRID, GRID);
    off.getContext('2d')!.putImageData(grid, 0, 0);
    const S = surface.width;
    sctx.imageSmoothingEnabled = true;
    sctx.clearRect(0, 0, S, S);
    sctx.drawImage(off, 0, 0, S, S);
    // data points
    for (const pt of data) {
      const px = ((pt.x + 1) / 2) * S;
      const py = ((1 - pt.y) / 2) * S;
      sctx.beginPath();
      sctx.arc(px, py, 3.4, 0, Math.PI * 2);
      sctx.fillStyle = theme.classes[pt.label]!;
      sctx.fill();
      sctx.lineWidth = 1;
      sctx.strokeStyle = 'rgba(255,255,255,0.7)';
      sctx.stroke();
    }
    // probe markers – the pinned point (strong) and the hover preview (light)
    const marker = (pt: { x: number; y: number }, strong: boolean) => {
      const px = ((pt.x + 1) / 2) * S;
      const py = ((1 - pt.y) / 2) * S;
      sctx.beginPath();
      sctx.arc(px, py, strong ? 8 : 6, 0, Math.PI * 2);
      sctx.lineWidth = strong ? 4.5 : 2;
      sctx.strokeStyle = 'rgba(255,255,255,0.85)';
      sctx.stroke();
      sctx.beginPath();
      sctx.arc(px, py, strong ? 8 : 6, 0, Math.PI * 2);
      sctx.lineWidth = strong ? 2.5 : 1.2;
      sctx.strokeStyle = theme.ink;
      sctx.stroke();
      sctx.beginPath();
      sctx.arc(px, py, 2, 0, Math.PI * 2);
      sctx.fillStyle = theme.ink;
      sctx.fill();
    };
    if (pinned) marker(pinned, true);
    if (hover) marker(hover, false);
  }

  function surfacePoint(e: MouseEvent): { x: number; y: number } {
    const r = surface.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: 1 - ((e.clientY - r.top) / r.height) * 2,
    };
  }

  /** Repaint the probe-dependent views immediately while training is paused. */
  function probeChanged() {
    if (!state.running) {
      drawSurface();
      paintActivations();
      if (state.edgeMode === 'flow') {
        updateSchematic();
        updateEdges();
      }
    }
  }

  surface.addEventListener('mousemove', (e) => {
    hover = surfacePoint(e);
    probeChanged();
  });
  surface.addEventListener('mouseleave', () => {
    hover = null;
    probeChanged();
  });
  surface.addEventListener('click', (e) => {
    const pt = surfacePoint(e);
    // clicking the already-pinned point releases it
    pinned = pinned && Math.hypot(pt.x - pinned.x, pt.y - pinned.y) < 0.07 ? null : pt;
    drawSurface();
    paintActivations();
    if (state.edgeMode === 'flow') {
      updateSchematic();
      updateEdges();
    }
  });

  // ---- 2D network schematic (editable weights) ------------------------------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VB_W = 560;
  const VB_H = 430;
  const tip = document.getElementById('nn-tip') as HTMLDivElement;
  const editInput = document.getElementById('nn-weight-edit') as HTMLInputElement;

  interface SchemEdge {
    path: SVGPathElement;
    l: number;
    j: number;
    k: number;
    cx: number;
    cy: number;
  }
  let schemEdges: SchemEdge[] = [];
  let schemNeurons: SVGCircleElement[][] = [];
  /** highlight ring around each neuron; opacity follows its activation */
  let schemHalos: SVGCircleElement[][] = [];
  /** what the inline editor is bound to: an edge's weight or a neuron's bias */
  type EditTarget =
    | { kind: 'weight'; l: number; j: number; k: number; cx: number; cy: number }
    | { kind: 'bias'; l: number; j: number; cx: number; cy: number };
  let editing: EditTarget | null = null;

  function schemPositions(): { x: number; y: number }[][] {
    const layers = net.sizes;
    const padX = 62;
    const xGap = (VB_W - 2 * padX) / Math.max(1, layers.length - 1);
    return layers.map((count, l) => {
      const yGap = Math.min(38, (VB_H - 90) / Math.max(1, count - 1 || 1));
      const h = (count - 1) * yGap;
      return Array.from({ length: count }, (_, j) => ({
        x: padX + l * xGap,
        y: VB_H / 2 - 12 - h / 2 + j * yGap,
      }));
    });
  }

  /** viewBox coords → px offsets inside the schematic wrapper (for tip/editor). */
  function toWrapPx(cx: number, cy: number): { left: number; top: number } {
    const svgRect = schematic.querySelector('svg')!.getBoundingClientRect();
    const wrapRect = schemWrap.getBoundingClientRect();
    return {
      left: svgRect.left - wrapRect.left + (cx / VB_W) * svgRect.width,
      top: svgRect.top - wrapRect.top + (cy / VB_H) * svgRect.height,
    };
  }

  function buildSchematic() {
    closeWeightEditor(false);
    schematic.innerHTML = '';
    schemEdges = [];
    schemNeurons = [];
    schemHalos = [];
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const pos = schemPositions();
    const layers = net.sizes;

    // edges first (under the neurons); curved like the original so parallel
    // connections between big layers stay distinguishable
    for (let l = 0; l < net.weights.length; l++) {
      const w = net.weights[l]!;
      for (let j = 0; j < w.length; j++) {
        for (let k = 0; k < w[j]!.length; k++) {
          const a = pos[l]![k]!;
          const b = pos[l + 1]![j]!;
          const t = layers[l + 1]! > 1 ? j / (layers[l + 1]! - 1) : 0.5;
          const bend = (t - 0.5) * 46;
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2 + bend;
          const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;

          const path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('d', d);
          path.setAttribute('fill', 'none');
          svg.appendChild(path);

          const edge: SchemEdge = { path, l, j, k, cx, cy };
          schemEdges.push(edge);

          const hit = document.createElementNS(SVG_NS, 'path');
          hit.setAttribute('d', d);
          hit.setAttribute('fill', 'none');
          hit.setAttribute('stroke', 'transparent');
          hit.setAttribute('stroke-width', '13');
          hit.setAttribute('class', 'nn-edge-hit');
          hit.addEventListener('mouseenter', () => showTip(edge));
          hit.addEventListener('mouseleave', () => (tip.hidden = true));
          hit.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditor({ kind: 'weight', l: edge.l, j: edge.j, k: edge.k, cx: edge.cx, cy: edge.cy });
          });
          svg.appendChild(hit);
        }
      }
    }

    // neurons
    layers.forEach((count, l) => {
      const circles: SVGCircleElement[] = [];
      const halos: SVGCircleElement[] = [];
      const isInput = l === 0;
      const isOutput = l === layers.length - 1;
      for (let j = 0; j < count; j++) {
        const px = pos[l]![j]!.x;
        const py = pos[l]![j]!.y;
        // activation halo – a ring that lights up when the neuron fires
        const halo = document.createElementNS(SVG_NS, 'circle');
        halo.setAttribute('cx', String(px));
        halo.setAttribute('cy', String(py));
        halo.setAttribute('r', '14.5');
        halo.setAttribute('fill', 'none');
        halo.setAttribute('stroke', theme.classes[1]!);
        halo.setAttribute('stroke-width', '2.5');
        halo.setAttribute('stroke-opacity', '0');
        halo.setAttribute('pointer-events', 'none');
        svg.appendChild(halo);
        halos.push(halo);
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(px));
        c.setAttribute('cy', String(py));
        c.setAttribute('r', '10');
        // hover shows the neuron's live activation (and bias); clicking a
        // non-input neuron opens the inline editor on its bias
        c.addEventListener('mouseenter', () => showNeuronTip(l, j, px, py));
        c.addEventListener('mouseleave', () => (tip.hidden = true));
        if (!isInput) {
          c.setAttribute('class', 'nn-neuron-hit');
          c.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditor({ kind: 'bias', l: l - 1, j, cx: px, cy: py });
          });
        }
        // output neurons carry their class colour as a ring when multi-class
        if (isOutput && count > 1) {
          c.setAttribute('stroke', theme.classes[j] ?? 'var(--line)');
          c.setAttribute('stroke-width', '2.5');
        } else {
          c.setAttribute('stroke', 'var(--ink-faint)');
          c.setAttribute('stroke-width', '1');
          c.setAttribute('stroke-opacity', '0.55');
        }
        svg.appendChild(c);
        circles.push(c);

        // input neurons are labelled with their engineered feature
        if (isInput) {
          const fl = document.createElementNS(SVG_NS, 'text');
          fl.setAttribute('x', String(pos[l]![j]!.x - 16));
          fl.setAttribute('y', String(pos[l]![j]!.y));
          fl.setAttribute('text-anchor', 'end');
          fl.setAttribute('dominant-baseline', 'middle');
          fl.setAttribute('fill', 'var(--ink-muted)');
          fl.setAttribute('style', 'font: 600 12px var(--font-mono)');
          fl.textContent = FEATURE_NAMES[j] ?? '';
          svg.appendChild(fl);
        }
      }
      schemNeurons.push(circles);
      schemHalos.push(halos);

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(pos[l]![0]!.x));
      label.setAttribute('y', String(VB_H - 14));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--ink-faint)');
      label.setAttribute('style', 'font: 600 11px var(--font-mono)');
      label.textContent =
        l === 0 ? layersEl.dataset.lInput! : isOutput ? layersEl.dataset.lOutput! : `L${l}`;
      svg.appendChild(label);
    });

    schematic.appendChild(svg);
    updateSchematic();
  }

  /** Value an edge encodes in the current mode. */
  function edgeValue(l: number, j: number, k: number): number {
    const w = net.weights[l]![j]![k]!;
    return state.edgeMode === 'flow' ? w * (net.activations[l]?.[k] ?? 0) : w;
  }

  /** Per-layer max |value| for normalising edge width/opacity. */
  function edgeMaxAbs(): number[] {
    return net.weights.map((w, l) => {
      let m = 1e-6;
      for (let j = 0; j < w.length; j++)
        for (let k = 0; k < w[j]!.length; k++) m = Math.max(m, Math.abs(edgeValue(l, j, k)));
      return m;
    });
  }

  function updateSchematic() {
    const maxAbs = edgeMaxAbs();
    for (const e of schemEdges) {
      const v = edgeValue(e.l, e.j, e.k);
      const norm = Math.min(1, Math.abs(v) / maxAbs[e.l]!);
      e.path.setAttribute('stroke', v >= 0 ? theme.classes[1]! : theme.classes[0]!);
      e.path.setAttribute('stroke-width', (0.7 + norm * 3.4).toFixed(2));
      e.path.setAttribute('stroke-opacity', (0.3 + norm * 0.62).toFixed(2));
    }
  }

  function showTip(edge: SchemEdge) {
    if (editing) return;
    const w = net.weights[edge.l]![edge.j]![edge.k]!;
    const { left, top } = toWrapPx(edge.cx, edge.cy);
    tip.textContent =
      state.edgeMode === 'flow'
        ? `w = ${w.toFixed(2)} · w·a = ${edgeValue(edge.l, edge.j, edge.k).toFixed(2)}`
        : `w = ${w.toFixed(2)}`;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.hidden = false;
  }

  function showNeuronTip(l: number, j: number, cx: number, cy: number) {
    if (editing) return;
    const a = net.activations[l]?.[j] ?? 0;
    const parts = [`a = ${a.toFixed(2)}`];
    if (l > 0) parts.push(`b = ${net.biases[l - 1]![j]!.toFixed(2)}`);
    const { left, top } = toWrapPx(cx, cy);
    tip.textContent = parts.join(' · ');
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.hidden = false;
  }

  function openEditor(target: EditTarget) {
    // pause so backprop doesn't immediately overwrite the manual edit
    setRunning(false);
    tip.hidden = true;
    editing = target;
    const v =
      target.kind === 'weight'
        ? net.weights[target.l]![target.j]![target.k]!
        : net.biases[target.l]![target.j]!;
    const { left, top } = toWrapPx(target.cx, target.cy);
    editInput.value = v.toFixed(2);
    editInput.style.left = `${left}px`;
    editInput.style.top = `${top}px`;
    editInput.hidden = false;
    editInput.focus();
    editInput.select();
  }

  function closeWeightEditor(commit: boolean) {
    if (!editing) return;
    if (commit) {
      const v = parseFloat(editInput.value);
      if (!isNaN(v)) {
        if (editing.kind === 'weight') {
          net.weights[editing.l]![editing.j]![editing.k] = v;
        } else {
          net.biases[editing.l]![editing.j] = v;
        }
        drawSurface();
        updateSchematic();
        updateEdges();
        paintActivations();
      }
    }
    editing = null;
    editInput.hidden = true;
  }

  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeWeightEditor(true);
    }
    if (e.key === 'Escape') closeWeightEditor(false);
  });
  editInput.addEventListener('blur', () => closeWeightEditor(true));

  // ---- class legend ----------------------------------------------------------
  const legendEl = document.getElementById('nn-legend');
  function renderLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = '';
    for (let i = 0; i < classCount(); i++) {
      const item = document.createElement('span');
      item.className = 'nn-legend-item';
      const dot = document.createElement('span');
      dot.className = 'nn-legend-dot';
      dot.style.background = theme.classes[i]!;
      const label = document.createElement('span');
      label.textContent = `${legendEl.dataset.lClass} ${i + 1}`;
      item.append(dot, label);
      legendEl.appendChild(item);
    }
  }

  // ---- layer builder ---------------------------------------------------------
  /** A stepper controlling a neuron count; `remove` adds a × button. */
  function stepper(opts: {
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
    onRemove?: () => void;
    removeLabel?: string;
    plusTitle?: string;
    minusTitle?: string;
  }): HTMLSpanElement {
    const box = document.createElement('span');
    box.className = 'nn-layer';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'nn-step';
    minus.textContent = '−';
    minus.disabled = opts.value <= opts.min;
    if (opts.minusTitle) minus.title = opts.minusTitle;
    minus.addEventListener('click', () => opts.onChange(opts.value - 1));

    const num = document.createElement('span');
    num.className = 'nn-count';
    num.textContent = String(opts.value);

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'nn-step';
    plus.textContent = '+';
    plus.disabled = opts.value >= opts.max;
    if (opts.plusTitle) plus.title = opts.plusTitle;
    plus.addEventListener('click', () => opts.onChange(opts.value + 1));

    box.append(minus, num, plus);

    if (opts.onRemove) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'nn-remove';
      rm.textContent = '×';
      rm.title = opts.removeLabel!;
      rm.setAttribute('aria-label', opts.removeLabel!);
      rm.addEventListener('click', opts.onRemove);
      box.appendChild(rm);
    }
    return box;
  }

  function renderLayers() {
    const d = layersEl.dataset;
    layersEl.innerHTML = '';

    const arrow = () => {
      const el = document.createElement('span');
      el.className = 'nn-arrow';
      el.textContent = '→';
      layersEl.appendChild(el);
    };
    const named = (label: string, node: HTMLElement) => {
      const wrap = document.createElement('span');
      wrap.className = 'nn-named';
      const tag = document.createElement('span');
      tag.className = 'nn-tag';
      tag.textContent = label;
      wrap.append(tag, node);
      layersEl.appendChild(wrap);
    };

    // input features: changing the count changes what the network sees –
    // the button tooltips name the exact feature that would come or go
    named(
      d.lInput!,
      stepper({
        value: state.inputs,
        min: 1,
        max: MAX_FEATURES,
        plusTitle: state.inputs < MAX_FEATURES ? `+ ${FEATURE_NAMES[state.inputs]}` : undefined,
        minusTitle: state.inputs > 1 ? `− ${FEATURE_NAMES[state.inputs - 1]}` : undefined,
        onChange: (v) => {
          state.inputs = v;
          rebuild(false);
        },
      }),
    );
    arrow();

    state.hidden.forEach((count, i) => {
      // tag mirrors the layer label in the schematic (L1, L2, …) and keeps
      // every group on the same baseline as the input/output steppers
      named(
        `L${i + 1}`,
        stepper({
          value: count,
          min: 1,
          max: MAX_NEURONS,
          onChange: (v) => {
            state.hidden[i] = v;
            rebuild(false);
          },
          onRemove: () => {
            state.hidden.splice(i, 1);
            rebuild(false);
          },
          removeLabel: d.lRemove,
        }),
      );
      arrow();
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'nn-add';
    add.textContent = d.lAdd!;
    add.disabled = state.hidden.length >= MAX_HIDDEN_LAYERS;
    add.addEventListener('click', () => {
      state.hidden.push(4);
      rebuild(false);
    });
    // appended bare (no label column) so it bottom-aligns with the steppers
    layersEl.appendChild(add);
    arrow();

    // output units: 1 = binary sigmoid, 2–4 = softmax classes → new dataset
    // labels. Tooltips spell the head change out, since 1 → 2 keeps two
    // classes and only swaps sigmoid for softmax.
    const classLabel = legendEl?.dataset.lClass ?? 'Class';
    named(
      d.lOutput!,
      stepper({
        value: state.outputs,
        min: 1,
        max: MAX_OUTPUTS,
        plusTitle:
          state.outputs === 1
            ? 'softmax'
            : state.outputs < MAX_OUTPUTS
              ? `+ ${classLabel} ${state.outputs + 1}`
              : undefined,
        minusTitle:
          state.outputs === 2
            ? 'sigmoid'
            : state.outputs > 2
              ? `− ${classLabel} ${state.outputs}`
              : undefined,
        onChange: (v) => {
          state.outputs = v;
          rebuild(true);
        },
      }),
    );
  }

  // ---- 3D network -----------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas3d);
  controls.enableDamping = true;
  controls.enablePan = false;
  // idle auto-rotation sells the volumetric layout; stops at first user grab
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.1;
  controls.addEventListener('start', () => (controls.autoRotate = false));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  let netGroup = new THREE.Group();
  scene.add(netGroup);
  const neuronGeo = new THREE.SphereGeometry(0.16, 20, 16);
  const haloGeo = new THREE.SphereGeometry(0.24, 16, 12);
  // unit cylinder along Y – scaled/rotated per edge so connections have real
  // thickness (WebGL ignores line widths above 1px)
  const edgeGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  let neuronMeshes: THREE.Mesh[][] = [];
  /** translucent shells around the neurons; opacity follows activation */
  let haloMeshes: THREE.Mesh[][] = [];
  interface Edge {
    mat: THREE.MeshBasicMaterial;
    mesh: THREE.Mesh;
    l: number;
    j: number;
    k: number;
  }
  let edges: Edge[] = [];

  /** Dispose all geometries/materials in the current group before replacing it. */
  function disposeGroup() {
    netGroup.traverse((obj) => {
      const any = obj as THREE.Mesh | THREE.Line;
      if ((any as THREE.Mesh).geometry && any !== undefined) {
        const g = (any as THREE.Mesh).geometry;
        if (g && g !== neuronGeo && g !== haloGeo && g !== edgeGeo) g.dispose();
        const m = (any as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) m.dispose();
      }
    });
  }

  /** Neurons of a layer sit on a ring in the YZ plane → the model is truly 3D. */
  function ringPosition(l: number, j: number, count: number, xGap: number, totalW: number): THREE.Vector3 {
    const x = l * xGap - totalW / 2;
    if (count === 1) return new THREE.Vector3(x, 0, 0);
    const r = 0.34 * Math.sqrt(count) + 0.12;
    // stagger rings between layers so edges don't align into a flat sheet
    const angle = (j / count) * Math.PI * 2 + l * 0.7;
    return new THREE.Vector3(x, r * Math.cos(angle), r * Math.sin(angle));
  }

  function buildNetwork() {
    disposeGroup();
    scene.remove(netGroup);
    netGroup = new THREE.Group();
    neuronMeshes = [];
    haloMeshes = [];
    edges = [];
    const layers = net.sizes;
    const xGap = 1.5;
    const totalW = (layers.length - 1) * xGap;
    const positions: THREE.Vector3[][] = [];

    layers.forEach((count, l) => {
      const meshes: THREE.Mesh[] = [];
      const halos: THREE.Mesh[] = [];
      const layerPos: THREE.Vector3[] = [];
      for (let j = 0; j < count; j++) {
        const pos = ringPosition(l, j, count, xGap, totalW);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
        const mesh = new THREE.Mesh(neuronGeo, mat);
        mesh.position.copy(pos);
        netGroup.add(mesh);
        meshes.push(mesh);
        // activation shell – invisible until the neuron fires
        const haloMat = new THREE.MeshBasicMaterial({
          color: theme.edgePos,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.copy(pos);
        netGroup.add(halo);
        halos.push(halo);
        layerPos.push(pos);
      }
      neuronMeshes.push(meshes);
      haloMeshes.push(halos);
      positions.push(layerPos);
    });

    // edges — cylinders placed once; radius/colour/opacity updated in place
    const up = new THREE.Vector3(0, 1, 0);
    for (let l = 0; l < net.weights.length; l++) {
      const w = net.weights[l]!;
      for (let j = 0; j < w.length; j++) {
        for (let k = 0; k < w[j]!.length; k++) {
          const a = positions[l]![k]!;
          const b = positions[l + 1]![j]!;
          const dir = new THREE.Vector3().subVectors(b, a);
          const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false });
          const mesh = new THREE.Mesh(edgeGeo, mat);
          mesh.position.copy(a).add(b).multiplyScalar(0.5);
          mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
          mesh.scale.set(0.01, dir.length(), 0.01);
          netGroup.add(mesh);
          edges.push({ mat, mesh, l, j, k });
        }
      }
    }
    scene.add(netGroup);
    updateEdges();

    // frame the camera once per (re)build; the loop never touches it, so the
    // user's orbit is preserved during training
    const maxRing = 0.34 * Math.sqrt(Math.max(...layers)) + 0.12;
    const r = Math.max(totalW, maxRing * 2) * 0.85 + 1.6;
    camera.position.set(r * 0.35, r * 0.3, r);
    controls.target.set(0, 0, 0);
  }

  const edgePos = new THREE.Color(theme.edgePos);
  const edgeNeg = new THREE.Color(theme.edgeNeg);
  function updateEdges() {
    // normalise radius/opacity against the largest current value per layer
    const maxAbs = edgeMaxAbs();
    for (const e of edges) {
      const v = edgeValue(e.l, e.j, e.k);
      const norm = Math.min(1, Math.abs(v) / maxAbs[e.l]!);
      e.mat.color.copy(v >= 0 ? edgePos : edgeNeg);
      e.mat.opacity = 0.2 + norm * 0.65;
      const r = 0.008 + norm * 0.035;
      e.mesh.scale.x = r;
      e.mesh.scale.z = r;
    }
  }

  function paintActivations() {
    // forward pass for the probed point (pinned/hovered, or a default)
    const p = probePoint();
    net.forward(feats(p.x, p.y));
    const c = new THREE.Color();
    const pr = new THREE.Color(theme.classes[1]);
    const ng = new THREE.Color(theme.classes[0]);
    net.activations.forEach((layer, l) => {
      layer.forEach((aRaw, j) => {
        // map activation to 0..1 (tanh is -1..1, sigmoid/softmax 0..1, relu 0..)
        const a = l === 0 ? (aRaw + 1) / 2 : Math.max(0, Math.min(1, (aRaw + 1) / 2));
        // ring highlight only for genuinely firing neurons, so the eye can
        // follow the active path through the network
        const ring = Math.max(0, a * 1.5 - 0.75);
        c.copy(ng).lerp(pr, a);
        const mesh = neuronMeshes[l]?.[j];
        if (mesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.copy(c);
          mat.emissive.copy(pr).multiplyScalar(a * 0.35);
          // activation also breathes into the neuron's size
          mesh.scale.setScalar(0.75 + a * 0.5);
        }
        const halo3d = haloMeshes[l]?.[j];
        if (halo3d) (halo3d.material as THREE.MeshBasicMaterial).opacity = ring * 0.45;
        const circle = schemNeurons[l]?.[j];
        if (circle) circle.setAttribute('fill', `#${c.getHexString()}`);
        const halo = schemHalos[l]?.[j];
        if (halo) halo.setAttribute('stroke-opacity', ring.toFixed(2));
      });
    });
  }

  function resize() {
    for (const cv of [surface]) {
      const size = Math.min(cv.clientWidth, cv.clientHeight) || cv.clientWidth;
      cv.width = size;
      cv.height = size;
    }
    const w = canvas3d.clientWidth;
    const h = canvas3d.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function rebuild(resetData: boolean) {
    if (resetData) data = makeDataset(state.dataset, 220, 7, classCount());
    net = new MLP(arch(), state.activation, 42);
    state.epoch = 0;
    lossHistory.length = 0;
    renderLayers();
    renderLegend();
    buildNetwork();
    buildSchematic();
    drawSurface();
    paintActivations();
    updateHud();
    drawSpark();
    writeHash();
  }

  // ---- loss sparkline -------------------------------------------------------
  // the last ~240 samples; convergence, plateaus and a hand-broken weight all
  // show as shape, which three running digits cannot
  const spark = document.getElementById('nn-spark') as HTMLCanvasElement | null;
  const lossHistory: number[] = [];
  const SPARK_CAP = 240;

  function drawSpark() {
    if (!spark) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = spark.clientWidth;
    const h = spark.clientHeight;
    if (w === 0) return;
    if (spark.width !== Math.round(w * dpr)) {
      spark.width = Math.round(w * dpr);
      spark.height = Math.round(h * dpr);
    }
    const ctx = spark.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (lossHistory.length < 2) return;
    const max = Math.max(...lossHistory);
    const min = Math.min(...lossHistory);
    const span = Math.max(max - min, 1e-4);
    const css = getComputedStyle(document.documentElement);
    // faint floor line, then the loss curve in accent
    ctx.strokeStyle = css.getPropertyValue('--line').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();
    ctx.strokeStyle = css.getPropertyValue('--accent').trim();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    lossHistory.forEach((v, i) => {
      const x = (i / (SPARK_CAP - 1)) * w;
      const y = 1 + (1 - (v - min) / span) * (h - 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // ---- loop -----------------------------------------------------------------
  let raf = 0;
  let frame = 0;
  function tick() {
    if (state.running) {
      const steps = state.turbo ? 15 : 3;
      for (let s = 0; s < steps; s++) state.loss = net.trainStep(data, state.lr, state.inputs);
      state.epoch += steps;
      if (frame % 2 === 0) drawSurface();
      if (frame % 4 === 0) {
        updateEdges();
        updateSchematic();
      }
      paintActivations();
      if (frame % 6 === 0) {
        updateHud();
        lossHistory.push(state.loss);
        if (lossHistory.length > SPARK_CAP) lossHistory.shift();
        drawSpark();
      }
    }
    controls.update();
    renderer.render(scene, camera);
    frame++;
    raf = requestAnimationFrame(tick);
  }

  // ---- HUD + controls -------------------------------------------------------
  const elEpoch = document.getElementById('nn-epoch');
  const elLoss = document.getElementById('nn-loss');
  const elAcc = document.getElementById('nn-acc');
  const elToggle = document.getElementById('nn-toggle');
  function updateHud() {
    if (elEpoch) elEpoch.textContent = String(state.epoch);
    if (elLoss) elLoss.textContent = state.loss.toFixed(3);
    if (elAcc) {
      let correct = 0;
      for (const p of data) if (net.predict(feats(p.x, p.y)) === p.label) correct++;
      state.acc = correct / data.length;
      elAcc.textContent = `${Math.round(state.acc * 100)} %`;
    }
  }

  function setRunning(run: boolean) {
    state.running = run;
    if (elToggle) elToggle.textContent = run ? elToggle.dataset.pause! : elToggle.dataset.resume!;
  }

  function bindGroup(selector: string, onPick: (value: string, btn: HTMLElement) => void) {
    document.querySelectorAll<HTMLElement>(selector).forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll<HTMLElement>(selector).forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        onPick(btn.dataset.value!, btn);
      });
    });
  }

  bindGroup('[data-nn-dataset]', (v) => {
    state.dataset = v as DatasetKind;
    rebuild(true);
  });
  bindGroup('[data-nn-activation]', (v) => {
    state.activation = v as Activation;
    rebuild(false);
  });
  bindGroup('[data-nn-lr]', (v) => {
    state.lr = parseFloat(v);
    writeHash();
  });
  bindGroup('[data-nn-edges]', (v) => {
    state.edgeMode = v as 'weights' | 'flow';
    // signal flow describes one concrete point – if none is pinned yet, pin
    // the centre so the marker shows exactly what the edges refer to
    if (state.edgeMode === 'flow' && !pinned) {
      pinned = { x: 0.5, y: 0.5 };
      drawSurface();
    }
    updateSchematic();
    updateEdges();
  });

  elToggle?.addEventListener('click', () => setRunning(!state.running));
  document.getElementById('nn-reset')?.addEventListener('click', () => rebuild(false));

  // fast-forward: five times the steps per frame while latched
  const elFfwd = document.getElementById('nn-ffwd');
  elFfwd?.addEventListener('click', () => {
    state.turbo = !state.turbo;
    elFfwd.setAttribute('aria-pressed', String(state.turbo));
    if (state.turbo && !state.running) setRunning(true);
  });

  // one-click challenges: configurations that each demonstrate one idea
  const PRESETS: Record<string, () => void> = {
    // the hard dataset, beaten with feature engineering + a second layer
    spiral: () => {
      state.dataset = 'spiral';
      state.activation = 'tanh';
      state.inputs = 6;
      state.hidden = [8, 6];
      state.outputs = 1;
      state.lr = 0.15;
    },
    // x·y makes XOR linearly separable – one tiny layer instead of depth
    xor: () => {
      state.dataset = 'xor';
      state.activation = 'tanh';
      state.inputs = 5;
      state.hidden = [2];
      state.outputs = 1;
      state.lr = 0.15;
    },
    // three concentric rings – radial classes want the quadratic features
    // (with x,y only the same net plateaus under 70%)
    classes: () => {
      state.dataset = 'circle';
      state.activation = 'tanh';
      state.inputs = 4;
      state.hidden = [6];
      state.outputs = 3;
      state.lr = 0.15;
    },
  };
  document.querySelectorAll<HTMLElement>('[data-nn-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      PRESETS[btn.dataset.nnPreset!]?.();
      setRunning(true);
      rebuild(true);
      syncSegButtons();
    });
  });

  const onResize = () => {
    resize();
    drawSurface();
  };
  addEventListener('resize', onResize);

  // theme changes: re-read colors
  const themeObserver = new MutationObserver(() => {
    theme = readTheme();
    edgePos.set(theme.edgePos);
    edgeNeg.set(theme.edgeNeg);
    scene.background = null;
    updateEdges();
    buildSchematic();
    renderLegend();
    drawSurface();
    paintActivations();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-palette'],
  });

  document.addEventListener(
    'astro:before-swap',
    () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      removeEventListener('resize', onResize);
      themeObserver.disconnect();
    },
    { once: true },
  );

  // go
  resize();
  renderLayers();
  renderLegend();
  buildNetwork();
  buildSchematic();
  drawSurface();
  paintActivations();
  updateHud();
  // a hash-seeded configuration must win over the server-rendered defaults
  syncSegButtons();
  writeHash();
  raf = requestAnimationFrame(tick);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // supports #rrggbb and oklch/other → fallback via a canvas
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return { r: r!, g: g!, b: b! };
}
