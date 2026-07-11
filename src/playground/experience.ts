/**
 * The 3D playground: a toy plane flying over a hand-shaped island —
 * rolling hills, snowy mountains, a winding river, a little town and
 * organic forests. Fly close to a floating billboard and press Enter
 * to open the project it advertises. Everything is procedural.
 */
import * as THREE from 'three';

interface ProjectSign {
  title: string;
  year: number;
  url: string;
}

interface WorldData {
  projects: ProjectSign[];
  labels: { open: string; pressEnter: string };
}

// --- world layout constants ---------------------------------------------------
const ISLAND_RADIUS = 95; // where land starts fading into the sea
const COAST_WIDTH = 45;
const WATER_LEVEL = -0.9;
const CITY = { x: 45, z: 35, radius: 22 };
const MOUNTAINS = [
  { x: -58, z: -42, h: 26, r: 17 },
  { x: -72, z: -18, h: 20, r: 14 },
  { x: -42, z: -64, h: 22, r: 15 },
  { x: -30, z: -38, h: 12, r: 12 },
];
const SIGN_SPOTS = [
  { x: -15, z: -68 },
  { x: 72, z: -8 },
  { x: -8, z: 76 },
];

const SKY = {
  light: {
    sky: 0x9ed2f5,
    skyTop: 0x5fa8e8,
    skyHorizon: 0xdcedf8,
    fog: 0xc9e6f7,
    hemiSky: 0xbfe3ff,
    hemiGround: 0x8fbf7f,
    hemiIntensity: 0.95,
    sunColor: 0xfff3d6,
    sunIntensity: 1.35,
    water: 0x3f86c9,
  },
  dark: {
    // sunset flight: purple dusk overhead, peach glow at the horizon
    sky: 0x38285c,
    skyTop: 0x2a1d4d,
    skyHorizon: 0xf29c72,
    fog: 0xe0916f,
    hemiSky: 0x8a6fc4,
    hemiGround: 0x4f4066,
    hemiIntensity: 0.85,
    sunColor: 0xffab66,
    sunIntensity: 1.6,
    water: 0x5d6fb5,
  },
} as const;

// Shared, theme-independent terrain colors — the lighting does the mood.
const COLORS = {
  sandDeep: 0xb3a071,
  sand: 0xe6d095,
  grass: [0x62b45c, 0x54a355, 0x74c468],
  meadow: 0xa9cf62,
  rock: 0x8a7a6e,
  rockHigh: 0x9d918a,
  snow: 0xf4f6f8,
  trunk: 0x7d5a3c,
  pine: [0x2f7a46, 0x39894e, 0x27693c],
  leafy: [0x55a84f, 0x6cbb52, 0x8cc953, 0xd9903f],
  wall: [0xf3ead8, 0xffffff, 0xe8c39a, 0xd9a066, 0xc4d0dc],
  roof: [0xc0504a, 0xa93b32, 0x8a5a3c, 0x6d4c41, 0x4f6a8f],
  cloud: 0xffffff,
  planeBody: 0xe3574f,
  planeWing: 0xf7f2e8,
  planeDark: 0x3a3f4c,
  panel: '#fffdf8',
  panelText: '#232838',
  panelAccent: '#4f46e5',
};

// --- deterministic value noise --------------------------------------------------
// sin-based hash: well distributed even for the small lattice coords we use
function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x * freq, z * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum; // ~0..1
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Centre line of the river (x as a function of z). */
function riverX(z: number): number {
  return 34 * Math.sin(z * 0.018) - 8 + 6 * Math.sin(z * 0.05);
}

/** Terrain height — the single source of truth used by every builder. */
function getHeight(x: number, z: number): number {
  // rolling hills on a solid landmass base
  let h =
    2.8 +
    (fbm(x * 0.02, z * 0.02) - 0.45) * 9 +
    (fbm(x * 0.055 + 40, z * 0.055 + 40) - 0.45) * 2.2;

  // mountain massif (smooth gaussian bumps blended together)
  for (const m of MOUNTAINS) {
    const d2 = (x - m.x) ** 2 + (z - m.z) ** 2;
    h += m.h * Math.exp(-d2 / (2 * m.r * m.r));
  }

  // river carves a smooth valley
  const riverDist = Math.abs(x - riverX(z));
  const carve = smoothstep(10, 3.2, riverDist);
  h = h * (1 - carve) + (WATER_LEVEL - 1.6) * carve;

  // town sits on a level plateau
  const cityDist = Math.hypot(x - CITY.x, z - CITY.z);
  const flat = smoothstep(CITY.radius + 6, CITY.radius - 8, cityDist);
  h = h * (1 - flat) + 1.35 * flat;

  // island falls away into the sea
  const shore = Math.hypot(x, z);
  const island = 1 - smoothstep(ISLAND_RADIUS, ISLAND_RADIUS + COAST_WIDTH, shore);
  return h * island - (1 - island) * 6;
}

// ================================================================================
export async function startExperience(): Promise<void> {
  const canvas = document.getElementById('playground-canvas') as HTMLCanvasElement;
  const dataEl = document.getElementById('playground-data');
  const data: WorldData = dataEl
    ? JSON.parse(dataEl.textContent ?? '{}')
    : { projects: [], labels: { open: '', pressEnter: '' } };
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const sky = SKY[theme];

  // --- renderer / scene / camera -----------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme === 'dark' ? 1.05 : 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sky.sky);
  scene.fog = new THREE.Fog(sky.fog, 90, 260);
  scene.add(buildSkyDome(sky.skyTop, sky.skyHorizon));

  // far plane must reach past the sky dome (r=460) from anywhere on the island
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);

  const hemi = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, sky.hemiIntensity);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(sky.sunColor, sky.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 70;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 260;
  scene.add(sun, sun.target);

  if (theme === 'dark') scene.add(buildStars());

  // --- world ---------------------------------------------------------------------
  scene.add(buildTerrain());
  scene.add(buildSea(sky.water));
  scene.add(buildForests());
  scene.add(buildRocks());
  scene.add(buildTown());
  const clouds = buildClouds();
  scene.add(clouds);

  const signs: { group: THREE.Group; project: ProjectSign; base: number }[] = [];
  data.projects.forEach((project, i) => {
    const spot = SIGN_SPOTS[i % SIGN_SPOTS.length]!;
    const y = Math.max(getHeight(spot.x, spot.z), 0) + 13;
    const group = buildFloatingSign(project);
    group.position.set(spot.x, y, spot.z);
    group.lookAt(0, y, 0);
    scene.add(group);
    signs.push({ group, project, base: y });
  });

  // --- plane -----------------------------------------------------------------------
  const { plane, propeller } = buildPlane();
  plane.position.set(0, 14, 108);
  scene.add(plane);

  const puffs = new PuffTrail(scene);
  let puffTimer = 0;

  // --- input -----------------------------------------------------------------------
  const keys = { up: false, down: false, left: false, right: false };
  const keymap: Record<string, keyof typeof keys> = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  let activeSign: ProjectSign | null = null;

  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    const key = keymap[e.code];
    if (key) {
      keys[key] = down;
      e.preventDefault();
    }
    if (down && e.code === 'Enter' && activeSign) location.href = activeSign.url;
  };
  addEventListener('keydown', onKey(true));
  addEventListener('keyup', onKey(false));

  const pad = document.getElementById('touch-pad');
  if (pad && matchMedia('(pointer: coarse)').matches) {
    pad.hidden = false;
    pad.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((btn) => {
      const key = btn.dataset.touchKey as keyof typeof keys;
      const press = (down: boolean) => (e: Event) => {
        e.preventDefault();
        keys[key] = down;
      };
      btn.addEventListener('pointerdown', press(true));
      btn.addEventListener('pointerup', press(false));
      btn.addEventListener('pointercancel', press(false));
      btn.addEventListener('pointerleave', press(false));
    });
  }

  const hudControls = document.getElementById('hud-controls');
  const hudPrompt = document.getElementById('hud-prompt');
  const hudPromptText = document.getElementById('hud-prompt-text');
  if (hudControls) hudControls.hidden = false;
  hudPrompt?.addEventListener('click', () => {
    if (activeSign) location.href = activeSign.url;
  });
  if (hudPrompt) hudPrompt.style.pointerEvents = 'auto';

  // --- flight model -------------------------------------------------------------------
  let heading = Math.PI; // facing the island centre
  let bank = 0;
  let pitch = 0;
  let currentSpeed = 19;
  const BASE_SPEED = 19;
  const forward = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 18, 122);
  const camLook = new THREE.Vector3();
  const tipOffset = new THREE.Vector3();
  let lastTime = performance.now();
  let elapsed = 0;

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    elapsed += dt;

    // banking drives the turn — lean in, then the nose follows
    const turnInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    const bankTarget = turnInput * 0.62;
    bank += (bankTarget - bank) * (1 - Math.pow(0.002, dt));
    heading += bank * 1.15 * dt;

    const pitchInput = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
    const pitchTarget = pitchInput * 0.4;
    pitch += (pitchTarget - pitch) * (1 - Math.pow(0.004, dt));

    // near a billboard the plane eases into a hover so you can read it and
    // press Enter; any steering input takes off again
    const anyInput = keys.up || keys.down || keys.left || keys.right;
    const hovering = activeSign !== null && !anyInput;
    // dive a little faster, climb a little slower
    const targetSpeed = hovering ? 0 : BASE_SPEED - pitch * 7;
    currentSpeed += (targetSpeed - currentSpeed) * (1 - Math.pow(0.1, dt));
    const speed = currentSpeed;
    forward.set(Math.sin(heading), 0, Math.cos(heading));
    plane.position.addScaledVector(forward, speed * dt);
    plane.position.y += pitch * speed * 0.55 * dt;

    // stay above the terrain and under the ceiling
    const floor = Math.max(getHeight(plane.position.x, plane.position.z), WATER_LEVEL) + 3;
    if (plane.position.y < floor) {
      plane.position.y += (floor - plane.position.y) * Math.min(1, 8 * dt);
      pitch = Math.max(pitch, 0);
    }
    plane.position.y = Math.min(plane.position.y, 42);

    // soft steer back when drifting out to sea
    const r = Math.hypot(plane.position.x, plane.position.z);
    if (r > 125) {
      const toCenter = Math.atan2(-plane.position.x, -plane.position.z);
      let diff = toCenter - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading += diff * Math.min(1, (r - 125) / 18) * 1.6 * dt;
    }

    plane.rotation.set(-pitch * 0.9, heading, -bank, 'YXZ');
    plane.position.y += Math.sin(elapsed * (hovering ? 2.4 : 1.7)) * (hovering ? 0.02 : 0.008);
    propeller.rotation.z += (hovering ? 18 : 42) * dt;

    // cartoon contrail: little cloud puffs popping off the wingtips
    puffTimer += dt;
    if (speed > 4 && puffTimer > 0.05) {
      puffTimer = 0;
      tipOffset.set(2.35, 0.18, -0.5).applyEuler(plane.rotation).add(plane.position);
      puffs.spawn(tipOffset);
      tipOffset.set(-2.35, 0.18, -0.5).applyEuler(plane.rotation).add(plane.position);
      puffs.spawn(tipOffset);
    }
    puffs.update(dt);

    // chase camera
    camLook.copy(plane.position).addScaledVector(forward, 7);
    const desired = camLook
      .clone()
      .addScaledVector(forward, -17)
      .add(new THREE.Vector3(0, 5.2, 0));
    camPos.lerp(desired, 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    camera.lookAt(plane.position.x, plane.position.y + 1.4, plane.position.z);

    // sun (and its shadow frustum) follows the plane so shadows stay crisp
    sun.position.set(plane.position.x + 45, plane.position.y + 70, plane.position.z + 28);
    sun.target.position.copy(plane.position);

    // drifting clouds
    clouds.children.forEach((cloud, i) => {
      cloud.position.x += (1.1 + (i % 3) * 0.35) * dt;
      if (cloud.position.x > 170) cloud.position.x = -170;
    });

    // floating signs bob and shimmer
    signs.forEach((sign, i) => {
      sign.group.position.y = sign.base + Math.sin(elapsed * 1.1 + i * 2.1) * 0.5;
      const ring = sign.group.getObjectByName('ring');
      if (ring) ring.rotation.z += 0.4 * dt;
    });

    // proximity
    let nearest: { project: ProjectSign; distance: number } | null = null;
    for (const sign of signs) {
      const d = sign.group.position.distanceTo(plane.position);
      if (d < 12 && (!nearest || d < nearest.distance)) {
        nearest = { project: sign.project, distance: d };
      }
    }
    const next = nearest?.project ?? null;
    if (next !== activeSign) {
      activeSign = next;
      if (hudPrompt && hudPromptText) {
        hudPrompt.hidden = !next;
        if (next) hudPromptText.textContent = `${data.labels.open} „${next.title}"`;
      }
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  let raf = requestAnimationFrame(tick);

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  document.addEventListener(
    'astro:before-swap',
    () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
    { once: true },
  );
}

// ================================================================================
// world builders
// ================================================================================

function buildTerrain(): THREE.Mesh {
  const size = 320;
  const segments = 110;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  const grass = COLORS.grass.map((c) => new THREE.Color(c));
  const meadow = new THREE.Color(COLORS.meadow);
  const sand = new THREE.Color(COLORS.sand);
  const sandDeep = new THREE.Color(COLORS.sandDeep);
  const rock = new THREE.Color(COLORS.rock);
  const rockHigh = new THREE.Color(COLORS.rockHigh);
  const snow = new THREE.Color(COLORS.snow);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = getHeight(x, z);
    pos.setY(i, h);

    const tint = fbm(x * 0.08 + 90, z * 0.08 + 90); // gentle variation everywhere
    if (h < WATER_LEVEL + 0.25) {
      color.copy(sandDeep).lerp(sand, smoothstep(-4, WATER_LEVEL, h));
    } else if (h < 0.75) {
      color.copy(sand).lerp(grass[0]!, smoothstep(0.2, 0.75, h));
    } else if (h < 9) {
      const meadowMix = smoothstep(0.62, 0.78, fbm(x * 0.035 + 300, z * 0.035 + 300));
      color
        .copy(grass[Math.floor(tint * grass.length) % grass.length]!)
        .lerp(meadow, meadowMix * 0.85);
    } else if (h < 15.5) {
      color.copy(rock).lerp(rockHigh, smoothstep(9, 15.5, h)).offsetHSL(0, 0, (tint - 0.5) * 0.06);
    } else {
      color.copy(rockHigh).lerp(snow, smoothstep(15.5, 18.5, h));
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); // smooth rolling shapes, no hard facets

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildSea(waterColor: number): THREE.Mesh {
  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(400, 64),
    new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WATER_LEVEL;
  return sea;
}

/** Trees in organic noise-driven clusters; instanced for cheap draw calls. */
function buildForests(): THREE.Group {
  const group = new THREE.Group();

  interface Placement {
    x: number;
    z: number;
    h: number;
    scale: number;
    kind: 'pine' | 'leafy';
  }
  const placements: Placement[] = [];

  for (let i = 0; i < 3200 && placements.length < 320; i++) {
    const x = (hash2(i, 17) - 0.5) * 2 * (ISLAND_RADIUS + 10);
    const z = (hash2(i, 91) - 0.5) * 2 * (ISLAND_RADIUS + 10);
    const h = getHeight(x, z);
    if (h < 0.9 || h > 8.5) continue;
    if (Math.abs(x - riverX(z)) < 7) continue;
    if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.radius + 5) continue;
    // forests grow where the forest-noise says so — organic patches with soft edges
    const density = fbm(x * 0.03 + 700, z * 0.03 + 700);
    if (density < 0.5) continue;
    placements.push({
      x,
      z,
      h,
      scale: 1.15 + hash2(i, 5) * 0.85,
      kind: hash2(i, 33) < 0.55 ? 'pine' : 'leafy',
    });
  }

  const pines = placements.filter((p) => p.kind === 'pine');
  const leafies = placements.filter((p) => p.kind === 'leafy');
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // trunks (shared by both kinds)
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.2, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.h + 0.5 * p.scale, p.z);
    dummy.scale.setScalar(p.scale);
    dummy.rotation.set(0, hash2(i, 2) * Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = true;
  group.add(trunks);

  // pine crowns: two stacked, slightly rounded cones
  const pineGeo = new THREE.ConeGeometry(1, 2.1, 8);
  const pineMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  for (const tier of [0, 1]) {
    const mesh = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
    pines.forEach((p, i) => {
      const s = p.scale * (tier === 0 ? 1.25 : 0.85);
      dummy.position.set(p.x, p.h + (tier === 0 ? 1.9 : 3.1) * p.scale, p.z);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(0, hash2(i, 7 + tier) * Math.PI, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(COLORS.pine[(i + tier) % COLORS.pine.length]!));
    });
    mesh.castShadow = true;
    group.add(mesh);
  }

  // leafy crowns: one rounded canopy from three overlapping smooth spheres,
  // all sharing the tree's colour so it reads as a single crown
  const blobGeo = new THREE.IcosahedronGeometry(1, 2);
  const blobMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const CANOPY = [
    { dx: 0, dy: 2.55, dz: 0, s: 1.28 },
    { dx: 0.88, dy: 2.0, dz: 0.25, s: 0.78 },
    { dx: -0.82, dy: 2.1, dz: -0.25, s: 0.7 },
  ] as const;
  for (const part of CANOPY) {
    const mesh = new THREE.InstancedMesh(blobGeo, blobMat, leafies.length);
    leafies.forEach((p, i) => {
      const rot = hash2(i, 3) * Math.PI * 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const dx = part.dx * cos - part.dz * sin;
      const dz = part.dx * sin + part.dz * cos;
      const s = part.s * p.scale;
      dummy.position.set(p.x + dx * p.scale, p.h + part.dy * p.scale, p.z + dz * p.scale);
      dummy.scale.set(s, s * 0.9, s);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const autumn = hash2(i, 21) > 0.86;
      mesh.setColorAt(i, color.setHex(autumn ? COLORS.leafy[3]! : COLORS.leafy[i % 3]!));
    });
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

/**
 * Unit gable roof: 1×1 base centred at the origin, ridge at y=1 running
 * along the Z axis. Flat-shaded slopes and gable-end triangles, no bottom.
 */
function buildGableRoofGeometry(): THREE.BufferGeometry {
  // prettier-ignore
  const v = {
    A: [-0.5, 0, -0.5], B: [0.5, 0, -0.5], C: [0, 1, -0.5],
    D: [-0.5, 0, 0.5],  E: [0.5, 0, 0.5],  F: [0, 1, 0.5],
  };
  // prettier-ignore
  const triangles = [
    v.A, v.C, v.B, // front gable end
    v.D, v.E, v.F, // back gable end
    v.A, v.D, v.F,  v.A, v.F, v.C, // left slope
    v.B, v.C, v.F,  v.B, v.F, v.E, // right slope
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles.flat(), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildRocks(): THREE.InstancedMesh {
  const placements: { x: number; z: number; h: number; s: number }[] = [];
  for (let i = 0; i < 600 && placements.length < 40; i++) {
    const x = (hash2(i, 401) - 0.5) * 2 * ISLAND_RADIUS;
    const z = (hash2(i, 907) - 0.5) * 2 * ISLAND_RADIUS;
    const h = getHeight(x, z);
    if (h < 6 || h > 15) continue; // rocky band on the mountain flanks
    placements.push({ x, z, h, s: 0.5 + hash2(i, 3) * 1.1 });
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: COLORS.rockHigh, roughness: 0.95 }),
    placements.length,
  );
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.h + p.s * 0.3, p.z);
    dummy.scale.set(p.s, p.s * 0.7, p.s);
    dummy.rotation.set(hash2(i, 1) * 3, hash2(i, 2) * 3, hash2(i, 4) * 3);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true;
  return mesh;
}

/** A little town: colourful houses with pitched roofs, a few flats, a church. */
function buildTown(): THREE.Group {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  const spots: { x: number; z: number; rot: number; w: number; h: number; d: number }[] = [];
  let n = 0;
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (gx === 0 && gz === 0) continue; // village square
      n++;
      const jx = (hash2(n, 51) - 0.5) * 2.4;
      const jz = (hash2(n, 77) - 0.5) * 2.4;
      spots.push({
        x: CITY.x + gx * 6.4 + jx,
        z: CITY.z + gz * 6.4 + jz,
        rot: (hash2(n, 9) - 0.5) * 0.5 + (Math.abs(gx) > Math.abs(gz) ? Math.PI / 2 : 0),
        w: 2.3 + hash2(n, 13) * 1.1,
        h: 1.7 + hash2(n, 17) * 0.9,
        d: 2.6 + hash2(n, 19) * 1.2,
      });
    }
  }

  const groundY = 1.35;

  // walls
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, spots.length);
  spots.forEach((sp, i) => {
    dummy.position.set(sp.x, groundY + sp.h / 2, sp.z);
    dummy.scale.set(sp.w, sp.h, sp.d);
    dummy.rotation.set(0, sp.rot, 0);
    dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix);
    walls.setColorAt(i, color.setHex(COLORS.wall[i % COLORS.wall.length]!));
  });
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // gable roofs sitting square on the walls, ridge along the house length
  const roofGeo = buildGableRoofGeometry();
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, spots.length);
  spots.forEach((sp, i) => {
    dummy.position.set(sp.x, groundY + sp.h, sp.z);
    dummy.scale.set(sp.w * 1.16, sp.w * 0.5, sp.d * 1.14);
    dummy.rotation.set(0, sp.rot, 0);
    dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix);
    roofs.setColorAt(i, color.setHex(COLORS.roof[i % COLORS.roof.length]!));
  });
  roofs.castShadow = true;
  group.add(roofs);

  // church on the square: nave + tower + spire
  const churchMat = new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.85 });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 4.6), churchMat);
  nave.position.set(CITY.x, groundY + 1.3, CITY.z);
  nave.castShadow = true;
  const naveRoof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x8a5a3c }));
  naveRoof.scale.set(3.4, 1.5, 5.1);
  naveRoof.position.set(CITY.x, groundY + 2.6, CITY.z);
  naveRoof.castShadow = true;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.6, 1.5), churchMat);
  tower.position.set(CITY.x, groundY + 2.3, CITY.z + 3);
  tower.castShadow = true;
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.6, 4),
    new THREE.MeshStandardMaterial({ color: 0x4f6a8f }),
  );
  spire.position.set(CITY.x, groundY + 5.9, CITY.z + 3);
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  group.add(nave, naveRoof, tower, spire);

  return group;
}

function buildClouds(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.cloud,
    roughness: 1,
    transparent: true,
    opacity: 0.92,
    flatShading: false,
  });
  for (let c = 0; c < 11; c++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(hash2(c, 71) * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(geo, mat);
      const s = 2.2 + hash2(c * 10 + p, 3) * 2.6;
      puff.position.set(p * 2.6 - puffs, (hash2(c * 10 + p, 5) - 0.5) * 1.2, (hash2(c * 10 + p, 7) - 0.5) * 2.5);
      puff.scale.set(s, s * 0.55, s * 0.8);
      cloud.add(puff);
    }
    cloud.position.set(
      (hash2(c, 11) - 0.5) * 300,
      26 + hash2(c, 13) * 9,
      (hash2(c, 17) - 0.5) * 260,
    );
    group.add(cloud);
  }
  return group;
}

// ================================================================================
// plane, contrail, signs
// ================================================================================

function buildPlane(): { plane: THREE.Group; propeller: THREE.Group } {
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.planeBody, roughness: 0.55 });
  const wingMat = new THREE.MeshStandardMaterial({ color: COLORS.planeWing, roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: COLORS.planeDark, roughness: 0.5 });

  // smooth capsule fuselage, nose towards +Z
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.9, 6, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  plane.add(fuselage);

  // canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.15, metalness: 0.35 }),
  );
  canopy.scale.set(0.85, 0.7, 1.15);
  canopy.position.set(0, 0.38, 0.15);
  plane.add(canopy);

  // main wing with red tips
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.1, 1.05), wingMat);
  wing.position.set(0, 0.14, 0.1);
  wing.castShadow = true;
  plane.add(wing);
  [-2.45, 2.45].forEach((x) => {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 1.05), bodyMat);
    tip.position.set(x, 0.14, 0.1);
    plane.add(tip);
  });

  // tail
  const stabilizer = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.6), wingMat);
  stabilizer.position.set(0, 0.1, -1.45);
  plane.add(stabilizer);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.62), bodyMat);
  fin.position.set(0, 0.45, -1.45);
  fin.castShadow = true;
  plane.add(fin);

  // engine + propeller
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.3, 12), darkMat);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.z = 1.42;
  plane.add(cowl);
  const propeller = new THREE.Group();
  for (const rot of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.04), darkMat);
    blade.rotation.z = rot;
    propeller.add(blade);
  }
  propeller.position.z = 1.62;
  plane.add(propeller);

  // fixed landing gear
  [-0.55, 0.55].forEach((x) => {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), darkMat);
    strut.position.set(x, -0.5, 0.35);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), darkMat);
    wheel.scale.set(0.55, 1, 1);
    wheel.position.set(x, -0.75, 0.35);
    plane.add(wheel);
  });

  return { plane, propeller };
}

/** Cartoon contrail: a pool of little cloud puffs that swell up and dissolve. */
class PuffTrail {
  private pool: {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    age: number;
    life: number;
    size: number;
  }[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene, size = 110) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < size; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, material, age: 0, life: 1, size: 1 });
    }
  }

  spawn(position: THREE.Vector3): void {
    const puff = this.pool[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.pool.length;
    puff.age = 0;
    puff.life = 1.3 + Math.random() * 0.5;
    puff.mesh.visible = true;
    puff.mesh.position
      .copy(position)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.35,
          (Math.random() - 0.5) * 0.35,
        ),
      );
    puff.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    puff.size = 0.9 + Math.random() * 0.5; // every puff a bit different
  }

  update(dt: number): void {
    for (const puff of this.pool) {
      if (!puff.mesh.visible) continue;
      puff.age += dt;
      const t = puff.age / puff.life;
      if (t >= 1) {
        puff.mesh.visible = false;
        continue;
      }
      // swell quickly, then slowly dissolve while drifting up a touch
      const grow = (0.4 + 1.1 * Math.min(1, t * 2.6)) * puff.size;
      puff.mesh.scale.set(grow, grow * 0.78, grow * 0.92);
      puff.mesh.position.y += 0.25 * dt;
      puff.material.opacity = 0.9 * Math.pow(1 - t, 1.4);
    }
  }
}

function buildFloatingSign(project: ProjectSign): THREE.Group {
  const group = new THREE.Group();
  const texture = makePanelTexture(project);
  const panelGeo = new THREE.PlaneGeometry(7.4, 3.05);

  // two back-to-back faces so the sign reads from both directions
  [1, -1].forEach((side) => {
    const face = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ map: texture }));
    face.position.z = side * 0.05;
    face.rotation.y = side === 1 ? 0 : Math.PI;
    group.add(face);
  });

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(7.7, 3.35, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.4 }),
  );
  group.add(frame);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.7, 0.1, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0x8b85f4, transparent: true, opacity: 0.75 }),
  );
  ring.name = 'ring';
  group.add(ring);

  // soft light beam anchoring the sign to the ground
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.9, 26, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x8b85f4,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = -13;
  group.add(beam);

  return group;
}

function makePanelTexture(project: ProjectSign): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 424;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = COLORS.panelAccent;
  ctx.fillRect(0, 0, canvas.width, 26);

  ctx.fillStyle = COLORS.panelAccent;
  ctx.font = '600 46px ui-monospace, monospace';
  ctx.fillText(String(project.year), 62, 120);

  ctx.fillStyle = COLORS.panelText;
  ctx.font = 'bold 78px system-ui, sans-serif';
  wrapText(ctx, project.title, 62, 218, canvas.width - 124, 90);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = candidate;
    }
  }
  ctx.fillText(line, x, y);
}

/** Gradient sky sphere: horizon glow fading into the zenith colour. */
function buildSkyDome(topHex: number, horizonHex: number): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(460, 32, 24);
  const top = new THREE.Color(topHex);
  const horizon = new THREE.Color(horizonHex);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = smoothstep(-0.04, 0.38, pos.getY(i) / 460);
    c.copy(horizon).lerp(top, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
}

function buildStars(): THREE.Points {
  const count = 450;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 300 + hash2(i, 1) * 120;
    const theta = hash2(i, 2) * Math.PI * 2;
    const phi = hash2(i, 3) * Math.PI * 0.45;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffe8d0, size: 1.1, sizeAttenuation: true }),
  );
}
