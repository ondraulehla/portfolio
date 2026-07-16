/**
 * The 3D playground: a toy plane flying over a hand-shaped island –
 * rolling hills, snowy mountains, a winding river, a little town and
 * organic forests. Fly close to a floating billboard and press Enter
 * to open the project it advertises. Everything is procedural.
 */
import * as THREE from 'three';
import { WORLD } from './world';

interface ProjectSign {
  title: string;
  year: number;
  url: string;
}

interface WorldData {
  projects: ProjectSign[];
  labels: { open: string; pressEnter: string };
}

// --- world layout: edit src/playground/world.ts, not these aliases -------------
const ISLAND_RADIUS = WORLD.islandRadius;
const COAST_WIDTH = WORLD.coastWidth;
const WATER_LEVEL = WORLD.waterLevel;
const CITY = WORLD.city;
const MOUNTAINS = WORLD.mountains;
const SIGN_SPOTS = WORLD.signSpots;

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

// Shared, theme-independent terrain colors – the lighting does the mood.
const COLORS = {
  sandDeep: 0xb3a071,
  sand: 0xe6d095,
  grass: [0x62b45c, 0x54a355, 0x74c468],
  meadow: 0xa9cf62,
  alpine: 0x8fae5e,
  rockDark: 0x6b5d52,
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
  panelAccent: '#c94b3d',
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
  const r = WORLD.river;
  return r.a1 * Math.sin(z * r.f1) + r.offset + r.a2 * Math.sin(z * r.f2);
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Distance to the nearest dirt-road centre line. */
function roadDist(x: number, z: number): number {
  let best = Infinity;
  for (const path of WORLD.roads.paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      best = Math.min(best, distToSegment(x, z, a.x, a.z, b.x, b.z));
    }
  }
  return best;
}

/** Which tilled field (if any) covers this point – returns its tint or -1. */
function fieldTint(x: number, z: number): number {
  for (const f of WORLD.fields) {
    const cos = Math.cos(-f.rot);
    const sin = Math.sin(-f.rot);
    const lx = (x - f.x) * cos - (z - f.z) * sin;
    const lz = (x - f.x) * sin + (z - f.z) * cos;
    if (Math.abs(lx) < f.w / 2 && Math.abs(lz) < f.l / 2) return f.tint;
  }
  return -1;
}

/** Terrain height – the single source of truth used by every builder. */
function getHeight(x: number, z: number): number {
  // rolling hills on a solid landmass base
  let h =
    2.8 +
    (fbm(x * 0.02, z * 0.02) - 0.45) * 9 +
    (fbm(x * 0.055 + 40, z * 0.055 + 40) - 0.45) * 2.2;

  // mountain massif: gaussian footprint × ridged noise → craggy peaks and
  // ridgelines instead of smooth domes
  for (const m of MOUNTAINS) {
    const d2 = (x - m.x) ** 2 + (z - m.z) ** 2;
    const g = Math.exp(-d2 / (2 * m.r * m.r));
    if (g < 0.01) continue;
    const ridge = 1 - Math.abs(2 * fbm(x * 0.045 + m.x * 0.1, z * 0.045 + m.z * 0.1) - 1);
    h += m.h * g * (0.62 + 0.6 * ridge);
  }

  // river carves a smooth valley
  const riverDist = Math.abs(x - riverX(z));
  const carve = smoothstep(WORLD.river.width, WORLD.river.width * 0.32, riverDist);
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
  const sea = buildSea(sky.water);
  scene.add(sea);
  scene.add(buildFoam());
  scene.add(buildForests());
  scene.add(buildRocks());
  scene.add(buildTown());
  scene.add(buildBridge());
  scene.add(buildFarm());
  const pier = buildPier();
  scene.add(pier);
  const moored = pier.getObjectByName('moored') as THREE.Group;
  const windmill = buildWindmill();
  scene.add(windmill);
  const windmillBlades = windmill.getObjectByName('blades') as THREE.Group;
  const birds = buildBirds();
  scene.add(birds);
  scene.add(buildSheep());
  const boats = buildBoats();
  scene.add(boats);
  const lighthouse = buildLighthouse();
  scene.add(lighthouse);
  const clouds = buildClouds();
  scene.add(clouds);

  const signs: { group: THREE.Group; project: ProjectSign; base: number }[] = [];
  data.projects.forEach((project, i) => {
    const spot = SIGN_SPOTS[i % SIGN_SPOTS.length]!;
    const y = Math.max(getHeight(spot.x, spot.z), 0) + (spot.h ?? 13);
    const group = buildFloatingSign(project, data.labels.pressEnter);
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
  const onKeyDown = onKey(true);
  const onKeyUp = onKey(false);
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);

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

    // banking drives the turn – lean in, then the nose follows
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

    // gentle sea swell, drifting sailboats, lighthouse beacon
    animateSea(sea, elapsed);
    boats.children.forEach((boat, i) => {
      const b = boat.userData as { angle: number; radius: number; speed: number };
      b.angle += b.speed * dt;
      boat.position.set(Math.cos(b.angle) * b.radius, WATER_LEVEL + 0.12, Math.sin(b.angle) * b.radius);
      boat.rotation.y = -b.angle;
      boat.rotation.z = Math.sin(elapsed * 1.3 + i * 2) * 0.045;
      boat.position.y += Math.sin(elapsed * 1.1 + i * 1.7) * 0.08;
    });
    const beacon = lighthouse.getObjectByName('beacon') as THREE.Mesh | null;
    if (beacon) {
      (beacon.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.6 + Math.sin(elapsed * 2.6) * 1.3;
    }

    // windmill blades, circling birds, moored boats bobbing at the pier
    windmillBlades.rotation.z += 0.55 * dt;
    birds.children.forEach((bird) => {
      const b = bird.userData as { angle: number; radius: number; h: number; speed: number; flap: number };
      b.angle += b.speed * dt;
      bird.position.set(Math.cos(b.angle) * b.radius, b.h + Math.sin(elapsed * 0.7 + b.flap) * 1.2, Math.sin(b.angle) * b.radius);
      bird.rotation.y = -b.angle; // head (+z) points along the orbit's velocity
      bird.rotation.z = 0.18; // slight inward lean into the turn
      const flap = Math.sin(elapsed * b.flap) * 0.55;
      (bird.getObjectByName('wingL') as THREE.Mesh).rotation.z = flap;
      (bird.getObjectByName('wingR') as THREE.Mesh).rotation.z = -flap;
    });
    moored.children.forEach((boat, i) => {
      boat.position.y = WATER_LEVEL + 0.1 + Math.sin(elapsed * 1.2 + i * 2.4) * 0.07;
      boat.rotation.z = Math.sin(elapsed * 1.05 + i * 1.9) * 0.04;
    });

    // blimps bob and sway gently on their moorings
    signs.forEach((sign, i) => {
      sign.group.position.y = sign.base + Math.sin(elapsed * 1.1 + i * 2.1) * 0.55;
      const rig = sign.group.getObjectByName('rig');
      if (rig) rig.rotation.z = Math.sin(elapsed * 0.8 + i * 1.4) * 0.028;
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
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
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
  const segments = 148;
  const indexed = new THREE.PlaneGeometry(size, size, segments, segments);
  indexed.rotateX(-Math.PI / 2);

  // displace on the indexed grid (shared verts keep the surface watertight)…
  const gridPos = indexed.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < gridPos.count; i++) {
    gridPos.setY(i, getHeight(gridPos.getX(i), gridPos.getZ(i)));
  }

  // …then split faces apart: one colour + one normal PER TRIANGLE gives the
  // crisp faceted low-poly look instead of soft vertex-blended gradients
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const grass = COLORS.grass.map((c) => new THREE.Color(c));
  const meadow = new THREE.Color(COLORS.meadow);
  const sand = new THREE.Color(COLORS.sand);
  const sandDeep = new THREE.Color(COLORS.sandDeep);
  const alpine = new THREE.Color(COLORS.alpine);
  const strata = [
    new THREE.Color(COLORS.rockDark),
    new THREE.Color(COLORS.rock),
    new THREE.Color(COLORS.rockHigh),
  ];
  const snow = new THREE.Color(COLORS.snow);
  const field = new THREE.Color();
  const dirt = new THREE.Color();

  for (let i = 0; i < pos.count; i += 3) {
    // face centroid + true face slope from the triangle's normal
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const h = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    edge1
      .set(pos.getX(i + 1) - pos.getX(i), pos.getY(i + 1) - pos.getY(i), pos.getZ(i + 1) - pos.getZ(i));
    edge2
      .set(pos.getX(i + 2) - pos.getX(i), pos.getY(i + 2) - pos.getY(i), pos.getZ(i + 2) - pos.getZ(i));
    const steep = 1 - Math.abs(edge1.cross(edge2).normalize().y); // 0 flat … 1 vertical

    const tint = fbm(x * 0.08 + 90, z * 0.08 + 90); // gentle variation everywhere
    // irregular but CRISP feature lines instead of long smooth blends
    // snow only near the summits – the massifs peak around 25–30
    const snowline = 19.2 + (fbm(x * 0.09 + 55, z * 0.09 + 55) - 0.5) * 4.5;
    const rockline = 7.6 + (fbm(x * 0.07 + 21, z * 0.07 + 21) - 0.5) * 4;

    if (h < WATER_LEVEL + 0.25) {
      color.copy(sandDeep).lerp(sand, smoothstep(-4, WATER_LEVEL, h));
    } else if (h < 0.75) {
      color.copy(sand).lerp(grass[0]!, smoothstep(0.2, 0.75, h));
    } else if (h > snowline) {
      // snow with faint cool shading in hollows
      color.copy(snow).offsetHSL(0, 0.02, (tint - 0.7) * 0.05);
    } else if (h > rockline || (h > 4 && steep > 0.42)) {
      // banded strata following the contour lines, like layered sediment;
      // steeper faces pick darker layers
      const band = h * 0.55 + (fbm(x * 0.06 + 9, z * 0.06 + 9) - 0.5) * 1.8 + steep * 1.2;
      color
        .copy(strata[((Math.floor(band) % 3) + 3) % 3]!)
        .offsetHSL(0, 0, (tint - 0.5) * 0.06);
      // dusting of snow just under the snowline
      if (h > snowline - 1.1 && steep < 0.5) color.lerp(snow, 0.5);
    } else if (h > rockline - 1.3) {
      // alpine meadow rim right below the rock – a crisp colour step
      color.copy(alpine).offsetHSL(0, 0, (tint - 0.5) * 0.06);
    } else {
      const meadowMix = smoothstep(0.62, 0.78, fbm(x * 0.035 + 300, z * 0.035 + 300));
      color
        .copy(grass[Math.floor(tint * grass.length) % grass.length]!)
        .lerp(meadow, meadowMix * 0.85);
      // tilled fields: flat patches take their crop tint with faint row striping
      const ft = fieldTint(x, z);
      if (ft >= 0 && h > 0.4 && h < 6) {
        const rows = Math.sin((x * 0.94 + z * 0.34) * 2.6) * 0.045;
        color.copy(field.setHex(ft)).offsetHSL(0, 0, rows + (tint - 0.5) * 0.04);
      }
    }

    // dirt roads are painted over grass, fields and sand – not over rock faces.
    // Two tones: a wide sandy shoulder fading out, and a packed-earth core.
    const rd = roadDist(x, z);
    const RW = WORLD.roads.width;
    if (rd < RW * 2 && h > WATER_LEVEL + 0.05 && h < 9) {
      const shoulder = smoothstep(RW * 2, RW * 0.85, rd);
      dirt.setHex(0xc9b183);
      color.lerp(dirt, shoulder * 0.45);
      const core = smoothstep(RW * 0.9, RW * 0.4, rd);
      dirt.setHex(0xa98a58).offsetHSL(0, 0, (fbm(x * 0.35, z * 0.35) - 0.5) * 0.07);
      color.lerp(dirt, core * 0.95);
    }

    // subtle per-face brightness jitter – the "hand-cut facets" texture
    color.offsetHSL(0, 0, (hash2(i, 977) - 0.5) * 0.035);

    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = color.r;
      colors[(i + k) * 3 + 1] = color.g;
      colors[(i + k) * 3 + 2] = color.b;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); // unshared verts → true flat facet normals

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildSea(waterColor: number): THREE.Mesh {
  // segmented plane so animateSea() can roll a gentle swell through it
  const geometry = new THREE.PlaneGeometry(820, 820, 46, 46);
  geometry.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
    }),
  );
  sea.position.y = WATER_LEVEL;
  return sea;
}

/** Gentle two-directional swell; recomputed normals keep the specular alive. */
function animateSea(sea: THREE.Mesh, t: number): void {
  const pos = sea.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, Math.sin(x * 0.085 + t * 0.9) * 0.17 + Math.cos(z * 0.105 + t * 0.65) * 0.15);
  }
  pos.needsUpdate = true;
  sea.geometry.computeVertexNormals();
}

/** Little toy sailboats drifting in slow circles around the island. */
function buildBoats(): THREE.Group {
  const group = new THREE.Group();
  const configs = [
    { angle: 0.7, radius: 128, speed: 0.03, hull: 0xc0504a, sail: 0xffffff },
    { angle: 2.8, radius: 152, speed: -0.022, hull: 0x4f6a8f, sail: 0xf7f2e8 },
    { angle: 4.7, radius: 138, speed: 0.026, hull: 0x6d4c41, sail: 0xffe9c9 },
  ];
  for (const cfg of configs) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.55, 0.95),
      new THREE.MeshStandardMaterial({ color: cfg.hull, roughness: 0.85 }),
    );
    hull.position.y = 0.28;
    boat.add(hull);
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 1, 4),
      new THREE.MeshStandardMaterial({ color: cfg.hull, roughness: 0.85 }),
    );
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(1.7, 0.28, 0);
    boat.add(bow);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 }),
    );
    mast.position.y = 1.55;
    boat.add(mast);
    const sailGeo = new THREE.BufferGeometry();
    sailGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0.65, 0, 0, 2.5, 0, 1.35, 0.95, 0], 3),
    );
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(
      sailGeo,
      new THREE.MeshStandardMaterial({ color: cfg.sail, roughness: 0.9, side: THREE.DoubleSide }),
    );
    sail.position.x = 0.06;
    boat.add(sail);
    boat.userData = { angle: cfg.angle, radius: cfg.radius, speed: cfg.speed };
    group.add(boat);
  }
  return group;
}

/** Striped lighthouse on a rocky islet off the coast, with a pulsing beacon. */
function buildLighthouse(): THREE.Group {
  const group = new THREE.Group();
  // truncated rocky islet – the tower stands on its flat top, not on a spike
  const rock = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 6.2, 8.6, 7),
    new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 1, flatShading: true }),
  );
  rock.position.y = WATER_LEVEL + 0.75;
  group.add(rock);

  const bands = [0xffffff, 0xc0504a, 0xffffff, 0xc0504a];
  const baseY = WATER_LEVEL + 5.1;
  bands.forEach((c, i) => {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(1.06 - i * 0.08, 1.16 - i * 0.08, 1.55, 10),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
    );
    seg.position.y = baseY + i * 1.55;
    group.add(seg);
  });

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe9a8,
      emissive: 0xffc45e,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
  );
  beacon.name = 'beacon';
  beacon.position.y = baseY + bands.length * 1.55 + 0.15;
  group.add(beacon);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 0.95, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.planeDark, roughness: 0.7 }),
  );
  cap.position.y = beacon.position.y + 0.9;
  group.add(cap);

  group.position.set(118, 0, -64);
  return group;
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

  for (let i = 0; i < 3200 && placements.length < WORLD.forest.maxTrees; i++) {
    const x = (hash2(i, 17) - 0.5) * 2 * (ISLAND_RADIUS + 10);
    const z = (hash2(i, 91) - 0.5) * 2 * (ISLAND_RADIUS + 10);
    const h = getHeight(x, z);
    if (h < WORLD.forest.minHeight || h > WORLD.forest.maxHeight) continue;
    if (Math.abs(x - riverX(z)) < 7) continue;
    if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.radius + 5) continue;
    if (roadDist(x, z) < 4) continue;
    if (fieldTint(x, z) >= 0) continue;
    if (Math.hypot(x - WORLD.windmill.x, z - WORLD.windmill.z) < 6) continue;
    if (Math.hypot(x - WORLD.pier.x, z - WORLD.pier.z) < 8) continue;
    if (Math.hypot(x - WORLD.farm.x, z - WORLD.farm.z) < 17) continue;
    // forests grow where the forest-noise says so – organic patches with soft edges
    const density = fbm(x * 0.03 + 700, z * 0.03 + 700);
    if (density < WORLD.forest.densityThreshold) continue;
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

  // trunks (shared by both kinds) – tall enough to reach well into the crown
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.24, 2.4, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 0.9 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.h + 1.0 * p.scale, p.z);
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
  // dy positions sit low enough that every blob overlaps the trunk top (~2.2·scale)
  const CANOPY = [
    { dx: 0, dy: 2.5, dz: 0, s: 1.28 },
    { dx: 0.72, dy: 2.05, dz: 0.22, s: 0.78 },
    { dx: -0.68, dy: 2.12, dz: -0.22, s: 0.7 },
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

/** Ring of breaking foam hugging the shoreline. */
function buildFoam(): THREE.Mesh {
  const STEPS = 240;
  const verts: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // walk outward to the first point where land dips under the water line
    let r = ISLAND_RADIUS - 24;
    while (r < ISLAND_RADIUS + COAST_WIDTH && getHeight(cos * r, sin * r) > WATER_LEVEL) r += 0.8;
    const wobble = (fbm(cos * 3 + 40, sin * 3 + 40) - 0.5) * 2.2;
    const inner = r - 1.3 + wobble;
    const outer = r + 1.1 + wobble;
    verts.push(cos * inner, WATER_LEVEL + 0.06, sin * inner);
    verts.push(cos * outer, WATER_LEVEL + 0.06, sin * outer);
    if (i < STEPS) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
  );
}

/**
 * Wooden bridge where the western road crosses the river: a gently arched
 * deck of segments that share their end points, with the two ends anchored
 * INTO the banks so the walkway touches land on both sides.
 */
function buildBridge(): THREE.Group {
  const group = new THREE.Group();
  const z = WORLD.bridge.z;
  const cx = riverX(z);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6844, roughness: 0.9 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x6d5136, roughness: 0.95 });

  // walk outward from the river centre until each side is dry land
  let xL = cx;
  while (getHeight(xL, z) < WATER_LEVEL + 1.1 && cx - xL < 30) xL -= 0.5;
  let xR = cx;
  while (getHeight(xR, z) < WATER_LEVEL + 1.1 && xR - cx < 30) xR += 0.5;
  xL -= 1.6; // bite into the banks so the ends rest on solid ground
  xR += 1.6;
  const yL = getHeight(xL, z) + 0.1;
  const yR = getHeight(xR, z) + 0.1;

  // arched centre line sampled into joints
  const SEG = 8;
  const joints: { x: number; y: number }[] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    joints.push({ x: xL + (xR - xL) * t, y: yL + (yR - yL) * t + Math.sin(t * Math.PI) * 1.15 });
  }

  // deck planks (two alternating wood tones), side stringers and rails –
  // all segments share their end points, so nothing gaps
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x9a7750, roughness: 0.9 });
  for (let i = 0; i < SEG; i++) {
    const a = joints[i]!;
    const b = joints[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) + 0.1;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 3.2), i % 2 ? wood : woodLight);
    deck.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z);
    deck.rotation.z = angle;
    deck.castShadow = true;
    group.add(deck);
    // stringer beams carrying the deck, visible from the water
    for (const side of [-1.25, 1.25]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(len + 0.12, 0.3, 0.34), woodDark);
      beam.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.24, z + side);
      beam.rotation.z = angle;
      group.add(beam);
    }
    // top rail + mid rail on both sides
    for (const side of [-1.45, 1.45]) {
      for (const [ry, s] of [
        [1.05, 0.11],
        [0.58, 0.08],
      ] as const) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, s, s), wood);
        rail.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + ry, z + side);
        rail.rotation.z = angle;
        group.add(rail);
      }
    }
  }

  // rail posts at every joint; piles drop to the riverbed at every other one
  for (let i = 0; i <= SEG; i++) {
    const j = joints[i]!;
    for (const side of [-1.45, 1.45]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.15, 0.15), woodDark);
      post.position.set(j.x, j.y + 0.52, z + side);
      group.add(post);
    }
    if (i % 2 === 0) {
      const ground = Math.max(getHeight(j.x, z), WATER_LEVEL - 2.2);
      if (j.y - ground > 0.6) {
        for (const side of [-1.05, 1.05]) {
          const pile = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.19, j.y - ground + 0.4, 6),
            woodDark,
          );
          pile.position.set(j.x, (j.y + ground) / 2 - 0.1, z + side);
          group.add(pile);
        }
      }
    }
  }

  // stone abutments anchoring the ends into the banks
  const stoneMat = new THREE.MeshStandardMaterial({
    color: COLORS.rock,
    roughness: 1,
    flatShading: true,
  });
  for (const end of [joints[0]!, joints[SEG]!]) {
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 4.2), stoneMat);
    abutment.position.set(end.x, end.y - 0.75, z);
    abutment.rotation.y = 0.06;
    group.add(abutment);
  }
  return group;
}

/** Plank pier reaching from the beach into the sea, two rowboats moored. */
function buildPier(): THREE.Group {
  const group = new THREE.Group();
  const P = WORLD.pier;
  const dir = new THREE.Vector3(Math.sin(P.angle), 0, Math.cos(P.angle));
  const deckY = WATER_LEVEL + 1.0;
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6844, roughness: 0.9 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x6d5136, roughness: 0.95 });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, P.length), wood);
  deck.position.set(P.x + dir.x * (P.length / 2), deckY, P.z + dir.z * (P.length / 2));
  deck.rotation.y = P.angle;
  deck.castShadow = true;
  group.add(deck);

  for (let i = 1; i <= 4; i++) {
    const t = (i / 4) * P.length;
    for (const side of [-1.05, 1.05]) {
      const px = P.x + dir.x * t - dir.z * side;
      const pz = P.z + dir.z * t + dir.x * side;
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 6), woodDark);
      pile.position.set(px, deckY - 1.4, pz);
      group.add(pile);
    }
  }

  // two moored rowboats bobbing beside the pier head
  const boats = new THREE.Group();
  boats.name = 'moored';
  [
    { side: -2.3, t: P.length * 0.7, hull: 0xc0504a },
    { side: 2.4, t: P.length * 0.85, hull: 0x4f6a8f },
  ].forEach((cfg, i) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.5, 0.9),
      new THREE.MeshStandardMaterial({ color: cfg.hull, roughness: 0.85 }),
    );
    hull.position.y = 0.25;
    boat.add(hull);
    const bow = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: cfg.hull, roughness: 0.85 }),
    );
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(1.4, 0.25, 0);
    boat.add(bow);
    boat.position.set(
      P.x + dir.x * cfg.t - dir.z * cfg.side,
      WATER_LEVEL + 0.1,
      P.z + dir.z * cfg.t + dir.x * cfg.side,
    );
    boat.rotation.y = P.angle + (i === 0 ? 0.35 : -0.2);
    boats.add(boat);
  });
  group.add(boats);
  return group;
}

/** Stone windmill overlooking the fields; the blades spin in tick(). */
function buildWindmill(): THREE.Group {
  const group = new THREE.Group();
  const M = WORLD.windmill;
  const baseY = getHeight(M.x, M.z);

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 2.3, 7, 9),
    new THREE.MeshStandardMaterial({ color: 0xe8dfcc, roughness: 0.95, flatShading: true }),
  );
  tower.position.set(M.x, baseY + 3.4, M.z);
  tower.castShadow = true;
  group.add(tower);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(2.1, 2, 9),
    new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.9, flatShading: true }),
  );
  cap.position.set(M.x, baseY + 7.9, M.z);
  group.add(cap);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x6d5136, roughness: 0.9 }),
  );
  door.position.set(M.x, baseY + 0.75, M.z + 2.2);
  group.add(door);

  // blade assembly on a hub facing the fields (roughly +z)
  const blades = new THREE.Group();
  blades.name = 'blades';
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xf3ead8,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.4, 0.08), bladeMat);
    blade.position.y = 2.2;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
  }
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6d5136, roughness: 0.8 }),
  );
  blades.add(hub);
  blades.position.set(M.x, baseY + 6.6, M.z + 2.1);
  group.add(blades);
  return group;
}

/** Farmstead on the west meadow: red barn, silo, fenced paddock and an orchard. */
function buildFarm(): THREE.Group {
  const group = new THREE.Group();
  const F = WORLD.farm;
  const y = getHeight(F.x, F.z);
  const rot = 0.35;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb0503a, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xe8dfcc, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5f4a38, roughness: 0.9, flatShading: true });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x6d5136, roughness: 0.95 });

  // barn: long red box, ridge along its length, bone trim door
  const barn = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.1, 7), wallMat);
  barn.position.set(F.x, y + 1.55, F.z);
  barn.rotation.y = rot;
  barn.castShadow = true;
  group.add(barn);
  const roof = new THREE.Mesh(buildGableRoofGeometry(), roofMat);
  roof.scale.set(5.3, 2.2, 7.9);
  roof.position.set(F.x, y + 3.1, F.z);
  roof.rotation.y = rot;
  roof.castShadow = true;
  group.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 0.18), trimMat);
  door.position.set(F.x + Math.sin(rot) * 3.55, y + 1.05, F.z + Math.cos(rot) * 3.55);
  door.rotation.y = rot;
  group.add(door);

  // silo beside the barn
  const silo = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.35, 5.4, 9),
    new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.9, flatShading: true }),
  );
  silo.position.set(F.x - 4.4, y + 2.7, F.z - 1.5);
  silo.castShadow = true;
  group.add(silo);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.28, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    roofMat,
  );
  dome.position.set(F.x - 4.4, y + 5.4, F.z - 1.5);
  group.add(dome);

  // fenced paddock east of the barn with a couple of haystacks
  const px = F.x + 8.5;
  const pz = F.z + 3;
  const pw = 11;
  const pl = 8;
  const railMat = woodDark;
  for (const [x0, z0, x1, z1] of [
    [px - pw / 2, pz - pl / 2, px + pw / 2, pz - pl / 2],
    [px + pw / 2, pz - pl / 2, px + pw / 2, pz + pl / 2],
    [px + pw / 2, pz + pl / 2, px - pw / 2, pz + pl / 2],
    [px - pw / 2, pz + pl / 2, px - pw / 2, pz - pl / 2],
  ] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const posts = Math.round(len / 2.2);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), railMat);
      post.position.set(x, getHeight(x, z) + 0.55, z);
      group.add(post);
    }
    for (const ry of [0.45, 0.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.09), railMat);
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      rail.position.set(mx, getHeight(mx, mz) + ry, mz);
      rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      group.add(rail);
    }
  }
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd9b95c, roughness: 1, flatShading: true });
  for (const [hx, hz, s] of [
    [px - 2.5, pz - 1, 1],
    [px + 1.8, pz + 1.6, 0.8],
  ] as const) {
    const hay = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 1.6 * s, 8), hayMat);
    hay.position.set(hx, getHeight(hx, hz) + 0.8 * s, hz);
    hay.castShadow = true;
    group.add(hay);
  }

  // orchard: a small grid of round fruit trees south of the barn
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c452e, roughness: 1 });
  const canopyMats = [
    new THREE.MeshStandardMaterial({ color: 0x6d9e4f, roughness: 0.95, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x86b35c, roughness: 0.95, flatShading: true }),
  ];
  let t = 0;
  for (let gx = 0; gx < 4; gx++) {
    for (let gz = 0; gz < 3; gz++) {
      t++;
      const x = F.x - 3 + gx * 3.1 + (hash2(t, 31) - 0.5) * 0.9;
      const z = F.z + 8.5 + gz * 3.1 + (hash2(t, 67) - 0.5) * 0.9;
      const gy = getHeight(x, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 5), trunkMat);
      trunk.position.set(x, gy + 0.5, z);
      group.add(trunk);
      const canopy = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1 + hash2(t, 13) * 0.35, 1),
        canopyMats[t % 2]!,
      );
      canopy.position.set(x, gy + 1.6, z);
      canopy.castShadow = true;
      group.add(canopy);
    }
  }
  return group;
}

/** A loose flock of birds circling above the island; wings flap in tick(). */
function buildBirds(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3f4c, roughness: 0.8, side: THREE.DoubleSide });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xd9903f, roughness: 0.8 });
  for (let i = 0; i < WORLD.fauna.birds; i++) {
    const bird = new THREE.Group();
    // proper little body: fuselage + tail + beak, so the bird reads in 3D
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.78, 6), mat);
    body.rotation.x = Math.PI / 2; // tapered end backwards along -z
    bird.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), mat);
    head.position.set(0, 0.05, 0.42);
    bird.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.05, 0.58);
    bird.add(beak);
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, -0.36, -0.14, 0.02, -0.62, 0.14, 0.02, -0.62], 3),
    );
    tailGeo.computeVertexNormals();
    bird.add(new THREE.Mesh(tailGeo, mat));
    for (const side of [-1, 1]) {
      const wingGeo = new THREE.BufferGeometry();
      wingGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0.28, 0, 0, -0.28, side * 1.05, 0.18, 0], 3),
      );
      wingGeo.computeVertexNormals();
      const wing = new THREE.Mesh(wingGeo, mat);
      wing.name = side < 0 ? 'wingL' : 'wingR';
      bird.add(wing);
    }
    bird.userData = {
      angle: (i / WORLD.fauna.birds) * Math.PI * 2 + hash2(i, 12) * 0.8,
      radius: 34 + hash2(i, 44) * 30,
      h: 26 + hash2(i, 68) * 8,
      speed: 0.14 + hash2(i, 90) * 0.05,
      flap: 5 + hash2(i, 31) * 3,
    };
    group.add(bird);
  }
  return group;
}

/** Sheep dotted over the open meadows. */
function buildSheep(): THREE.Group {
  const group = new THREE.Group();
  const woolMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 1, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3f362e, roughness: 0.9 });
  const woolGeo = new THREE.IcosahedronGeometry(0.55, 1);
  const headGeo = new THREE.BoxGeometry(0.34, 0.3, 0.42);
  const legGeo = new THREE.BoxGeometry(0.09, 0.35, 0.09);

  let placed = 0;
  for (let i = 0; placed < WORLD.fauna.sheep && i < 900; i++) {
    const x = (hash2(i, 401) - 0.5) * 2 * ISLAND_RADIUS;
    const z = (hash2(i, 733) - 0.5) * 2 * ISLAND_RADIUS;
    const h = getHeight(x, z);
    if (h < 1 || h > 6.5) continue;
    if (Math.abs(x - riverX(z)) < 9) continue;
    if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.radius + 4) continue;
    if (roadDist(x, z) < 4 || fieldTint(x, z) >= 0) continue;
    if (fbm(x * 0.03 + 700, z * 0.03 + 700) > WORLD.forest.densityThreshold - 0.04) continue;
    // reject slopes – compare heights a step apart
    if (Math.abs(getHeight(x + 1.5, z) - h) + Math.abs(getHeight(x, z + 1.5) - h) > 0.9) continue;

    const sheep = new THREE.Group();
    const body = new THREE.Mesh(woolGeo, woolMat);
    body.scale.set(1.15, 0.9, 0.85);
    body.position.y = 0.62;
    body.castShadow = true;
    sheep.add(body);
    const head = new THREE.Mesh(headGeo, darkMat);
    head.position.set(0.62, 0.66, 0);
    sheep.add(head);
    for (const [lx, lz] of [[-0.28, -0.18], [-0.28, 0.18], [0.3, -0.18], [0.3, 0.18]] as const) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(lx, 0.18, lz);
      sheep.add(leg);
    }
    sheep.position.set(x, h - 0.05, z);
    sheep.rotation.y = hash2(i, 55) * Math.PI * 2;
    const s = 0.85 + hash2(i, 77) * 0.4;
    sheep.scale.setScalar(s);
    group.add(sheep);
    placed++;
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
  // deliberate boulder groups at the foot of each mountain, like fallen scree –
  // a big anchor rock with a few smaller ones huddled around it
  const placements: { x: number; z: number; h: number; s: number }[] = [];
  MOUNTAINS.forEach((m, mi) => {
    for (let c = 0; c < WORLD.rocks.clustersPerMountain; c++) {
      const angle = hash2(mi * 7 + c, 5) * Math.PI * 2;
      const dist = m.r * (1.15 + hash2(mi * 3 + c, 9) * 0.45);
      const cx = m.x + Math.cos(angle) * dist;
      const cz = m.z + Math.sin(angle) * dist;
      const ch = getHeight(cx, cz);
      if (ch < 1.5 || ch > 11) continue; // only on the walkable flank
      const anchor = 1.1 + hash2(mi + c, 13) * 0.7;
      placements.push({ x: cx, z: cz, h: ch, s: anchor });
      const count = 2 + Math.floor(hash2(mi * 11 + c, 21) * 3);
      for (let k = 0; k < count; k++) {
        const ra = hash2(k * 5 + c, mi + 31) * Math.PI * 2;
        const rd = anchor + 0.6 + hash2(k * 3 + c, mi + 47) * 1.4;
        const x = cx + Math.cos(ra) * rd;
        const z = cz + Math.sin(ra) * rd;
        placements.push({ x, z, h: getHeight(x, z), s: 0.35 + hash2(k + mi, c + 7) * 0.55 });
      }
    }
  });

  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: COLORS.rockHigh, roughness: 0.95 }),
    placements.length,
  );
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    // partly sunken so they sit in the ground instead of resting on it
    dummy.position.set(p.x, p.h + p.s * 0.2, p.z);
    dummy.scale.set(p.s, p.s * 0.65, p.s * 0.85);
    dummy.rotation.set(0, hash2(i, 2) * Math.PI, (hash2(i, 4) - 0.5) * 0.3);
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
    material: THREE.MeshStandardMaterial;
    age: number;
    life: number;
    size: number;
  }[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene, size = 110) {
    // smooth lit spheres – the shading is what makes them read as 3D volumes
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < size; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xf6f0e4,
        roughness: 1,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      // composite after the (transparent) sea so the trail stays visible over water
      mesh.renderOrder = 10;
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
          (Math.random() - 0.5) * 0.22,
          (Math.random() - 0.5) * 0.22,
          (Math.random() - 0.5) * 0.22,
        ),
      );
    puff.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    puff.size = 0.55 + Math.random() * 0.3; // every puff a bit different
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
      const grow = (0.35 + 0.75 * Math.min(1, t * 2.6)) * puff.size;
      puff.mesh.scale.set(grow, grow * 0.85, grow * 0.95);
      puff.mesh.position.y += 0.15 * dt;
      puff.material.opacity = 0.92 * Math.pow(1 - t, 1.4);
    }
  }
}

function buildFloatingSign(project: ProjectSign, hint: string): THREE.Group {
  const outer = new THREE.Group();
  // everything lives on an inner rig so the bob/sway animation can rotate it
  // without disturbing the outer group's lookAt orientation
  const group = new THREE.Group();
  group.name = 'rig';
  outer.add(group);
  const texture = makePanelTexture(project, hint);

  // hanging card – a single box so nothing z-fights at distance; box UVs are
  // authored per-face from the outside, so both faces read correctly
  const frameMat = new THREE.MeshStandardMaterial({ color: COLORS.planeDark, roughness: 0.45 });
  const faceMat = new THREE.MeshBasicMaterial({ map: texture });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.2, 0.26), [
    frameMat,
    frameMat,
    frameMat,
    frameMat,
    faceMat,
    faceMat,
  ]);
  panel.castShadow = true;
  group.add(panel);

  // a little blimp carries the card – native to a world about flying
  const hullMat = new THREE.MeshStandardMaterial({ color: COLORS.planeWing, roughness: 0.55 });
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), hullMat);
  hull.scale.set(2.55, 1, 1);
  hull.position.y = 4;
  hull.castShadow = true;
  group.add(hull);

  const noseMat = new THREE.MeshStandardMaterial({ color: COLORS.planeBody, roughness: 0.5 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), noseMat);
  nose.scale.set(1.15, 0.78, 0.78);
  nose.position.set(3.35, 4, 0);
  group.add(nose);

  const finGeoV = new THREE.BoxGeometry(1.05, 1.7, 0.12);
  const finGeoH = new THREE.BoxGeometry(1.05, 0.12, 1.7);
  const finV = new THREE.Mesh(finGeoV, noseMat);
  finV.position.set(-3.5, 4, 0);
  const finH = new THREE.Mesh(finGeoH, noseMat);
  finH.position.set(-3.5, 4, 0);
  group.add(finV, finH);

  // rigging cables from the hull down to the card
  const cableMat = new THREE.MeshBasicMaterial({ color: COLORS.planeDark });
  for (const cx of [-2.4, 2.4]) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), cableMat);
    cable.position.set(cx, 2.35, 0);
    group.add(cable);
  }

  // soft light beam anchoring the sign to the ground
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.75, 26, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: COLORS.planeBody,
      transparent: true,
      opacity: 0.11,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = -13;
  group.add(beam);

  return outer;
}

/**
 * The billboard card in the same language as the project cover plates:
 * bone paper, hairline grid, crop marks, PLATE numbering, hatch strip,
 * poster title and a square accent call-to-action.
 */
function makePanelTexture(project: ProjectSign, hint: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 444;
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const PAPER = '#f7f3ea';
  const INK = '#29221b';
  const LINE = '#e2dac8';
  const ACCENT = '#cb3a00';

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // hairline grid
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  for (let x = 64; x < W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 30; y < H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // crop marks
  ctx.strokeStyle = 'rgba(41, 34, 27, 0.65)';
  ctx.lineWidth = 3;
  const m = 22;
  const l = 18;
  for (const [cx, cy, dx, dy] of [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [W - m, H - m, -1, -1],
    [m, H - m, 1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * l, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * l);
    ctx.stroke();
  }

  // header: accent year, rule, hatch strip
  ctx.fillStyle = ACCENT;
  ctx.font = '600 34px ui-monospace, Menlo, monospace';
  ctx.fillText(String(project.year), 64, 92);
  ctx.strokeStyle = 'rgba(41, 34, 27, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 112);
  ctx.lineTo(W - 64, 112);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(64, 122, 130, 12);
  ctx.clip();
  ctx.strokeStyle = 'rgba(41, 34, 27, 0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 150; i += 9) {
    ctx.beginPath();
    ctx.moveTo(64 + i, 134);
    ctx.lineTo(64 + i + 12, 122);
    ctx.stroke();
  }
  ctx.restore();

  // poster title in the site's display face; long titles step down a size
  ctx.fillStyle = INK;
  const title = project.title.toUpperCase();
  ctx.font = '400 88px Anton, "Arial Narrow", sans-serif';
  const size = ctx.measureText(title).width > (W - 128) * 1.85 ? 62 : 88;
  ctx.font = `400 ${size}px Anton, "Arial Narrow", sans-serif`;
  wrapText(ctx, title, 64, 208 + size * 0.45, W - 128, size * 1.12);

  // square accent call-to-action, bottom-right
  ctx.font = '600 33px ui-monospace, Menlo, monospace';
  const label = `⏎ ${hint.toUpperCase()}`;
  const tw = ctx.measureText(label).width;
  const padX = 28;
  const pillW = tw + padX * 2;
  const pillH = 62;
  const px = W - 56 - pillW;
  const py = H - 56 - pillH;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(px, py, pillW, pillH);
  ctx.fillStyle = PAPER;
  ctx.fillText(label, px + padX, py + 42);

  // small accent diamond, bottom-left – the site's marker
  ctx.save();
  ctx.translate(76, H - 84);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.restore();

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
