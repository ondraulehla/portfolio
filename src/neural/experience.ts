/**
 * Interactive neural-network visualizer – the revived core of my master's
 * thesis. The network is fully editable, matching the original project:
 * per-layer neuron counts, adding/removing hidden layers, and clicking any
 * edge in the 2D schematic to edit that individual weight. The decision
 * surface learns the dataset live via backprop, and a 3D model (Three.js)
 * lights neurons up with their activations.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MLP, makeDataset, type Activation, type DatasetKind, type Point } from './nn';

interface Theme {
  pos: string; // class 1 / positive weight
  neg: string; // class 0 / negative weight
  ink: string;
  edgePos: number;
  edgeNeg: number;
}

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const dark = document.documentElement.dataset.theme === 'dark';
  const accent = css.getPropertyValue('--accent').trim() || '#c0392b';
  return {
    pos: accent,
    neg: dark ? '#5b6b8c' : '#8aa0c8',
    ink: css.getPropertyValue('--ink').trim() || '#111',
    edgePos: 0xd8613a,
    edgeNeg: 0x7f8aa6,
  };
}

const MAX_HIDDEN_LAYERS = 3;
const MAX_NEURONS = 10;

export function initNeural(): void {
  const surface = document.getElementById('nn-surface') as HTMLCanvasElement;
  const canvas3d = document.getElementById('nn-3d') as HTMLCanvasElement;
  const schematic = document.getElementById('nn-schematic') as HTMLDivElement;
  const schemWrap = document.getElementById('nn-schem-wrap') as HTMLElement;
  const layersEl = document.getElementById('nn-layers') as HTMLDivElement;
  if (!surface || !canvas3d || !schematic || !schemWrap || !layersEl) return;

  const state = {
    dataset: 'circle' as DatasetKind,
    activation: 'tanh' as Activation,
    /** neuron counts of the hidden layers; full arch is [2, ...hidden, 1] */
    hidden: [8, 8],
    lr: 0.15,
    running: true,
    epoch: 0,
    loss: 1,
  };
  const arch = () => [2, ...state.hidden, 1];

  let data: Point[] = makeDataset(state.dataset, 220);
  let net = new MLP(arch(), state.activation, 42);
  let theme = readTheme();

  // ---- 2D decision surface --------------------------------------------------
  const sctx = surface.getContext('2d')!;
  const GRID = 64;
  const grid = sctx.createImageData(GRID, GRID);

  function drawSurface() {
    const pr = hexToRgb(theme.pos);
    const ng = hexToRgb(theme.neg);
    let i = 0;
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x = (gx / (GRID - 1)) * 2 - 1;
        const y = 1 - (gy / (GRID - 1)) * 2;
        const p = net.forward([x, y])[0]!; // 0..1
        grid.data[i++] = Math.round(ng.r + (pr.r - ng.r) * p);
        grid.data[i++] = Math.round(ng.g + (pr.g - ng.g) * p);
        grid.data[i++] = Math.round(ng.b + (pr.b - ng.b) * p);
        grid.data[i++] = 235;
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
      sctx.fillStyle = pt.label === 1 ? theme.pos : theme.neg;
      sctx.fill();
      sctx.lineWidth = 1;
      sctx.strokeStyle = 'rgba(255,255,255,0.7)';
      sctx.stroke();
    }
  }

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
  let editing: SchemEdge | null = null;

  function schemPositions(): { x: number; y: number }[][] {
    const layers = net.sizes;
    const padX = 55;
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
            openWeightEditor(edge);
          });
          svg.appendChild(hit);
        }
      }
    }

    // neurons
    layers.forEach((count, l) => {
      const circles: SVGCircleElement[] = [];
      for (let j = 0; j < count; j++) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(pos[l]![j]!.x));
        c.setAttribute('cy', String(pos[l]![j]!.y));
        c.setAttribute('r', '9');
        c.setAttribute('stroke', 'var(--line)');
        c.setAttribute('stroke-width', '1');
        svg.appendChild(c);
        circles.push(c);
      }
      schemNeurons.push(circles);

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(pos[l]![0]!.x));
      label.setAttribute('y', String(VB_H - 14));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--ink-faint)');
      label.setAttribute('style', 'font: 600 11px var(--font-mono)');
      label.textContent =
        l === 0
          ? layersEl.dataset.lInput!
          : l === layers.length - 1
            ? layersEl.dataset.lOutput!
            : `L${l}`;
      svg.appendChild(label);
    });

    schematic.appendChild(svg);
    updateSchematic();
  }

  function updateSchematic() {
    const maxAbs = net.weights.map((w) => {
      let m = 1e-6;
      for (const row of w) for (const v of row) m = Math.max(m, Math.abs(v));
      return m;
    });
    for (const e of schemEdges) {
      const v = net.weights[e.l]![e.j]![e.k]!;
      const norm = Math.min(1, Math.abs(v) / maxAbs[e.l]!);
      e.path.setAttribute('stroke', v >= 0 ? theme.pos : theme.neg);
      e.path.setAttribute('stroke-width', (0.5 + norm * 2.6).toFixed(2));
      e.path.setAttribute('stroke-opacity', (0.25 + norm * 0.6).toFixed(2));
    }
  }

  function showTip(edge: SchemEdge) {
    if (editing) return;
    const v = net.weights[edge.l]![edge.j]![edge.k]!;
    const { left, top } = toWrapPx(edge.cx, edge.cy);
    tip.textContent = `w = ${v.toFixed(2)}`;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.hidden = false;
  }

  function openWeightEditor(edge: SchemEdge) {
    // pause so backprop doesn't immediately overwrite the manual edit
    setRunning(false);
    tip.hidden = true;
    editing = edge;
    const v = net.weights[edge.l]![edge.j]![edge.k]!;
    const { left, top } = toWrapPx(edge.cx, edge.cy);
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
        net.weights[editing.l]![editing.j]![editing.k] = v;
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

  // ---- layer builder ---------------------------------------------------------
  function renderLayers() {
    const d = layersEl.dataset;
    layersEl.innerHTML = '';

    const fixed = (label: string, n: number) => {
      const el = document.createElement('span');
      el.className = 'nn-layer nn-layer-fixed';
      el.textContent = `${label} · ${n}`;
      layersEl.appendChild(el);
    };
    const arrow = () => {
      const el = document.createElement('span');
      el.className = 'nn-arrow';
      el.textContent = '→';
      layersEl.appendChild(el);
    };

    fixed(d.lInput!, 2);
    arrow();

    state.hidden.forEach((count, i) => {
      const box = document.createElement('span');
      box.className = 'nn-layer';

      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'nn-step';
      minus.textContent = '−';
      minus.disabled = count <= 1;
      minus.addEventListener('click', () => {
        state.hidden[i] = Math.max(1, count - 1);
        rebuild(false);
      });

      const num = document.createElement('span');
      num.className = 'nn-count';
      num.textContent = String(count);

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'nn-step';
      plus.textContent = '+';
      plus.disabled = count >= MAX_NEURONS;
      plus.addEventListener('click', () => {
        state.hidden[i] = Math.min(MAX_NEURONS, count + 1);
        rebuild(false);
      });

      box.append(minus, num, plus);

      if (state.hidden.length > 1) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'nn-remove';
        rm.textContent = '×';
        rm.title = d.lRemove!;
        rm.setAttribute('aria-label', d.lRemove!);
        rm.addEventListener('click', () => {
          state.hidden.splice(i, 1);
          rebuild(false);
        });
        box.appendChild(rm);
      }

      layersEl.appendChild(box);
      arrow();
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'nn-chip';
    add.textContent = d.lAdd!;
    add.disabled = state.hidden.length >= MAX_HIDDEN_LAYERS;
    add.addEventListener('click', () => {
      state.hidden.push(4);
      rebuild(false);
    });
    layersEl.appendChild(add);

    const tail = document.createElement('span');
    tail.className = 'nn-arrow';
    tail.textContent = '→';
    layersEl.appendChild(tail);
    fixed(d.lOutput!, 1);
  }

  // ---- 3D network -----------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas3d);
  controls.enableDamping = true;
  controls.enablePan = false;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  let netGroup = new THREE.Group();
  scene.add(netGroup);
  const neuronGeo = new THREE.SphereGeometry(0.16, 20, 16);
  let neuronMeshes: THREE.Mesh[][] = [];
  interface Edge {
    mat: THREE.LineBasicMaterial;
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
        if (g && g !== neuronGeo) g.dispose();
        const m = (any as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) m.dispose();
      }
    });
  }

  function buildNetwork() {
    disposeGroup();
    scene.remove(netGroup);
    netGroup = new THREE.Group();
    neuronMeshes = [];
    edges = [];
    const layers = net.sizes;
    const xGap = 1.5;
    const totalW = (layers.length - 1) * xGap;
    const positions: THREE.Vector3[][] = [];

    layers.forEach((count, l) => {
      const meshes: THREE.Mesh[] = [];
      const layerPos: THREE.Vector3[] = [];
      const yGap = 0.7;
      const h = (count - 1) * yGap;
      for (let j = 0; j < count; j++) {
        const pos = new THREE.Vector3(l * xGap - totalW / 2, h / 2 - j * yGap, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
        const mesh = new THREE.Mesh(neuronGeo, mat);
        mesh.position.copy(pos);
        netGroup.add(mesh);
        meshes.push(mesh);
        layerPos.push(pos);
      }
      neuronMeshes.push(meshes);
      positions.push(layerPos);
    });

    // edges — geometry built once; material opacity/colour updated in place
    for (let l = 0; l < net.weights.length; l++) {
      const w = net.weights[l]!;
      for (let j = 0; j < w.length; j++) {
        for (let k = 0; k < w[j]!.length; k++) {
          const geom = new THREE.BufferGeometry().setFromPoints([positions[l]![k]!, positions[l + 1]![j]!]);
          const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 });
          netGroup.add(new THREE.Line(geom, mat));
          edges.push({ mat, l, j, k });
        }
      }
    }
    scene.add(netGroup);
    updateEdges();

    // frame the camera once per (re)build; the loop never touches it, so the
    // user's orbit is preserved during training
    const spanY = Math.max(...layers) * 0.7;
    const r = Math.max(totalW, spanY) * 0.9 + 1.5;
    camera.position.set(0.2, 0.4, r);
    controls.target.set(0, 0, 0);
  }

  const edgePos = new THREE.Color(theme.edgePos);
  const edgeNeg = new THREE.Color(theme.edgeNeg);
  function updateEdges() {
    // normalise opacity against the largest current weight per layer
    const maxAbs = net.weights.map((w) => {
      let m = 1e-6;
      for (const row of w) for (const v of row) m = Math.max(m, Math.abs(v));
      return m;
    });
    for (const e of edges) {
      const v = net.weights[e.l]![e.j]![e.k]!;
      e.mat.color.copy(v >= 0 ? edgePos : edgeNeg);
      e.mat.opacity = 0.1 + Math.min(1, Math.abs(v) / maxAbs[e.l]!) * 0.65;
    }
  }

  function paintActivations() {
    // one representative forward pass (dataset centroid-ish sample)
    net.forward([0.5, 0.5]);
    const c = new THREE.Color();
    const pr = new THREE.Color(theme.pos);
    const ng = new THREE.Color(theme.neg);
    net.activations.forEach((layer, l) => {
      layer.forEach((aRaw, j) => {
        // map activation to 0..1 (tanh is -1..1, sigmoid 0..1, relu 0..)
        const a = l === 0 ? (aRaw + 1) / 2 : Math.max(0, Math.min(1, (aRaw + 1) / 2));
        c.copy(ng).lerp(pr, a);
        const mesh = neuronMeshes[l]?.[j];
        if (mesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.copy(c);
          mat.emissive.copy(pr).multiplyScalar(a * 0.35);
        }
        const circle = schemNeurons[l]?.[j];
        if (circle) circle.setAttribute('fill', `#${c.getHexString()}`);
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

  function rebuild(resetData = true) {
    if (resetData) data = makeDataset(state.dataset, 220);
    net = new MLP(arch(), state.activation, 42);
    state.epoch = 0;
    renderLayers();
    buildNetwork();
    buildSchematic();
    drawSurface();
    paintActivations();
    updateHud();
  }

  // ---- loop -----------------------------------------------------------------
  let raf = 0;
  let frame = 0;
  function tick() {
    if (state.running) {
      for (let s = 0; s < 3; s++) state.loss = net.trainStep(data, state.lr);
      state.epoch += 3;
      if (frame % 2 === 0) drawSurface();
      if (frame % 4 === 0) {
        updateEdges();
        updateSchematic();
      }
      paintActivations();
      if (frame % 6 === 0) updateHud();
    }
    controls.update();
    renderer.render(scene, camera);
    frame++;
    raf = requestAnimationFrame(tick);
  }

  // ---- HUD + controls -------------------------------------------------------
  const elEpoch = document.getElementById('nn-epoch');
  const elLoss = document.getElementById('nn-loss');
  const elToggle = document.getElementById('nn-toggle');
  function updateHud() {
    if (elEpoch) elEpoch.textContent = String(state.epoch);
    if (elLoss) elLoss.textContent = state.loss.toFixed(3);
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
  });

  elToggle?.addEventListener('click', () => setRunning(!state.running));
  document.getElementById('nn-reset')?.addEventListener('click', () => rebuild(false));

  addEventListener('resize', () => {
    resize();
    drawSurface();
  });
  document.addEventListener(
    'astro:before-swap',
    () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
    { once: true },
  );

  // theme changes: re-read colors
  new MutationObserver(() => {
    theme = readTheme();
    edgePos.set(theme.edgePos);
    edgeNeg.set(theme.edgeNeg);
    scene.background = null;
    updateEdges();
    updateSchematic();
    drawSurface();
    paintActivations();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // go
  resize();
  renderLayers();
  buildNetwork();
  buildSchematic();
  drawSurface();
  paintActivations();
  updateHud();
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
