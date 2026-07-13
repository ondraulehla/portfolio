/**
 * Interactive neural-network visualizer – the revived core of my master's
 * thesis. Left: a 2D decision surface that learns a dataset live via backprop.
 * Right: a 3D model of the network (Three.js) whose neurons light up with their
 * activations and whose edges are coloured by weight sign – the "3D brain".
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MLP, makeDataset, type Activation, type DatasetKind, type Point } from './nn';

interface Theme {
  pos: string; // class 1 / positive
  neg: string; // class 0 / negative
  ink: string;
  surface: number;
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
    surface: dark ? 0x17110f : 0xfbf7f0,
    edgePos: 0xd8613a,
    edgeNeg: 0x7f8aa6,
  };
}

export function initNeural(): void {
  const surface = document.getElementById('nn-surface') as HTMLCanvasElement | null;
  const canvas3d = document.getElementById('nn-3d') as HTMLCanvasElement | null;
  if (!surface || !canvas3d) return;

  const state = {
    dataset: 'circle' as DatasetKind,
    activation: 'tanh' as Activation,
    arch: [2, 8, 8, 1],
    lr: 0.15,
    running: true,
    epoch: 0,
    loss: 1,
  };

  let data: Point[] = makeDataset(state.dataset, 220);
  let net = new MLP(state.arch, state.activation, 42);
  let theme = readTheme();

  // ---- 2D decision surface --------------------------------------------------
  const sctx = surface.getContext('2d')!;
  const GRID = 64;
  const grid = sctx.createImageData(GRID, GRID);
  const posRGB = hexToRgb(theme.pos);
  const negRGB = hexToRgb(theme.neg);

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
        const mesh = neuronMeshes[l]?.[j];
        if (!mesh) return;
        // map activation to 0..1 (tanh is -1..1, sigmoid 0..1, relu 0..)
        const a = l === 0 ? (aRaw + 1) / 2 : Math.max(0, Math.min(1, (aRaw + 1) / 2));
        c.copy(ng).lerp(pr, a);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(c);
        mat.emissive.copy(pr).multiplyScalar(a * 0.35);
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
    net = new MLP(state.arch, state.activation, 42);
    state.epoch = 0;
    buildNetwork();
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
      if (frame % 4 === 0) updateEdges();
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
  function updateHud() {
    if (elEpoch) elEpoch.textContent = String(state.epoch);
    if (elLoss) elLoss.textContent = state.loss.toFixed(3);
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
  bindGroup('[data-nn-arch]', (v) => {
    state.arch = v.split('-').map(Number);
    rebuild(false);
  });

  document.getElementById('nn-toggle')?.addEventListener('click', (e) => {
    state.running = !state.running;
    (e.currentTarget as HTMLElement).textContent = state.running ? '⏸ Pause' : '▶ Resume';
  });
  document.getElementById('nn-reset')?.addEventListener('click', () => rebuild(false));

  addEventListener('resize', () => {
    resize();
    drawSurface();
  });
  document.addEventListener('astro:before-swap', () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
  }, { once: true });

  // theme changes: re-read colors
  new MutationObserver(() => {
    theme = readTheme();
    scene.background = null;
    buildNetwork();
    drawSurface();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // go
  resize();
  buildNetwork();
  drawSurface();
  paintActivations();
  updateHud();
  raf = requestAnimationFrame(tick);
  void posRGB;
  void negRGB;
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
