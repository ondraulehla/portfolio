/**
 * The 3D playground: a small low-poly island you drive around in a toy car.
 * Approach a signpost and press Enter to open the project it advertises.
 * Everything is procedural — no model files to download.
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

const WORLD_RADIUS = 60;
const SIGN_RADIUS = 24;
const SIGN_TRIGGER_DISTANCE = 7;

const PALETTES = {
  light: {
    sky: 0xdfe8f5,
    fog: 0xdfe8f5,
    ground: 0x8fc78f,
    groundEdge: 0x7ab57a,
    trunk: 0x8a6444,
    leaves: [0x4f9e5c, 0x63b06b, 0x3f8e50],
    rock: 0x9aa3ad,
    carBody: 0x4f46e5,
    carCabin: 0xdfe6f5,
    wheel: 0x2a2f38,
    pole: 0x7d8590,
    panel: '#ffffff',
    panelText: '#1c2030',
    panelAccent: '#4f46e5',
  },
  dark: {
    sky: 0x12141f,
    fog: 0x12141f,
    ground: 0x2e5d45,
    groundEdge: 0x254c38,
    trunk: 0x5d4430,
    leaves: [0x2e6b46, 0x3a7d52, 0x25593b],
    rock: 0x525a66,
    carBody: 0x8b85f4,
    carCabin: 0x2b3040,
    wheel: 0x14161c,
    pole: 0x555c68,
    panel: '#2c3247',
    panelText: '#f2f3fa',
    panelAccent: '#b5b0ff',
  },
} as const;

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

export async function startExperience(): Promise<void> {
  const canvas = document.getElementById('playground-canvas') as HTMLCanvasElement;
  const dataEl = document.getElementById('playground-data');
  const data: WorldData = dataEl ? JSON.parse(dataEl.textContent ?? '{}') : { projects: [], labels: {} };
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const palette = PALETTES[theme];

  // --- renderer / scene / camera -------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.fog, 55, 110);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(0, 6, 12);

  const hemi = new THREE.HemisphereLight(palette.sky, palette.ground, theme === 'dark' ? 1.2 : 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(theme === 'dark' ? 0xbdc7ff : 0xffffff, theme === 'dark' ? 1.1 : 1.2);
  sun.position.set(24, 36, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 120;
  scene.add(sun);

  if (theme === 'dark') scene.add(buildStars());

  // --- world ----------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_RADIUS, 48),
    new THREE.MeshStandardMaterial({ color: palette.ground, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WORLD_RADIUS, WORLD_RADIUS + 4, 3, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: palette.groundEdge, flatShading: true, side: THREE.DoubleSide }),
  );
  rim.position.y = -1.5;
  scene.add(rim);

  scatterNature(scene, palette);

  // --- signposts --------------------------------------------------------------
  const signs: { mesh: THREE.Group; project: ProjectSign }[] = [];
  data.projects.forEach((project, i) => {
    const angle = (i / data.projects.length) * Math.PI * 2 - Math.PI / 2;
    const sign = buildSignpost(project, palette);
    sign.position.set(Math.cos(angle) * SIGN_RADIUS, 0, Math.sin(angle) * SIGN_RADIUS);
    sign.lookAt(0, sign.position.y, 0);
    scene.add(sign);
    signs.push({ mesh: sign, project });
  });

  // --- car --------------------------------------------------------------------
  const { car, wheels, frontWheels } = buildCar(palette);
  scene.add(car);

  // --- input --------------------------------------------------------------------
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

  // Touch d-pad
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

  // HUD
  const hudControls = document.getElementById('hud-controls');
  const hudPrompt = document.getElementById('hud-prompt');
  const hudPromptText = document.getElementById('hud-prompt-text');
  if (hudControls) hudControls.hidden = false;
  hudPrompt?.addEventListener('click', () => {
    if (activeSign) location.href = activeSign.url;
  });
  if (hudPrompt) hudPrompt.style.pointerEvents = 'auto';

  // --- simulation ---------------------------------------------------------------
  let speed = 0;
  let heading = Math.PI;
  const MAX_SPEED = 22;
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3().copy(camera.position);
  let lastTime = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // driving model: accelerate, brake/reverse, drag, speed-scaled steering
    const accel = keys.up ? 30 : keys.down ? -18 : 0;
    speed += accel * dt;
    speed -= speed * 1.6 * dt;
    speed = THREE.MathUtils.clamp(speed, -MAX_SPEED * 0.5, MAX_SPEED);
    if (Math.abs(speed) < 0.02 && !accel) speed = 0;

    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    const steerStrength = 1.9 * Math.min(1, Math.abs(speed) / 6);
    heading += steer * steerStrength * Math.sign(speed || 1) * dt;

    car.position.x += Math.sin(heading) * speed * dt;
    car.position.z += Math.cos(heading) * speed * dt;
    car.rotation.y = heading;

    // keep the car on the island
    const dist = Math.hypot(car.position.x, car.position.z);
    const limit = WORLD_RADIUS - 3;
    if (dist > limit) {
      car.position.x *= limit / dist;
      car.position.z *= limit / dist;
      speed *= 0.4;
    }

    // wheel spin + front wheel steering + body lean
    wheels.forEach((wheel) => (wheel.rotation.x += (speed / 0.5) * dt));
    frontWheels.forEach((wheel) => (wheel.rotation.y = steer * 0.42));
    car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, -steer * Math.min(1, Math.abs(speed) / MAX_SPEED) * 0.06, 0.15);

    // follow camera
    const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
    camTarget.copy(car.position).addScaledVector(back, 9).add(new THREE.Vector3(0, 4.5, 0));
    camPos.lerp(camTarget, 1 - Math.pow(0.0015, dt));
    camera.position.copy(camPos);
    camera.lookAt(car.position.x, car.position.y + 1.2, car.position.z);

    // signpost proximity
    let nearest: { project: ProjectSign; distance: number } | null = null;
    for (const sign of signs) {
      const d = sign.mesh.position.distanceTo(car.position);
      if (d < SIGN_TRIGGER_DISTANCE && (!nearest || d < nearest.distance)) {
        nearest = { project: sign.project, distance: d };
      }
    }
    const next = nearest?.project ?? null;
    if (next !== activeSign) {
      activeSign = next;
      if (hudPrompt && hudPromptText) {
        hudPrompt.hidden = !next;
        if (next) hudPromptText.textContent = `${data.labels.open} „${next.title}“`;
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

  // View Transitions: tear the world down when navigating away.
  document.addEventListener(
    'astro:before-swap',
    () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
    { once: true },
  );
}

// --- builders -----------------------------------------------------------------

function buildCar(palette: Palette) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 3),
    new THREE.MeshStandardMaterial({ color: palette.carBody, flatShading: true }),
  );
  body.position.y = 0.65;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.55, 1.4),
    new THREE.MeshStandardMaterial({ color: palette.carCabin, flatShading: true }),
  );
  cabin.position.set(0, 1.2, -0.15);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeometry.rotateZ(Math.PI / 2);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: palette.wheel, flatShading: true });

  const wheels: THREE.Mesh[] = [];
  const frontWheels: THREE.Group[] = [];
  (
    [
      [-0.85, 1.05, true],
      [0.85, 1.05, true],
      [-0.85, -1.05, false],
      [0.85, -1.05, false],
    ] as const
  ).forEach(([x, z, front]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.castShadow = true;
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.38, z);
    pivot.add(wheel);
    car.add(pivot);
    wheels.push(wheel);
    if (front) frontWheels.push(pivot);
  });

  return { car, wheels, frontWheels };
}

function buildSignpost(project: ProjectSign, palette: Palette): THREE.Group {
  const group = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({ color: palette.pole, flatShading: true });

  [-2.1, 2.1].forEach((x) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), poleMaterial);
    pole.position.set(x, 1.7, 0);
    pole.castShadow = true;
    group.add(pole);
  });

  const texture = makePanelTexture(project, palette);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 1.9, 0.12),
    [
      poleMaterial, poleMaterial, poleMaterial, poleMaterial,
      // Basic material: the sign stays readable regardless of scene lighting.
      new THREE.MeshBasicMaterial({ map: texture }),
      new THREE.MeshStandardMaterial({ color: palette.pole }),
    ],
  );
  panel.position.y = 2.8;
  panel.castShadow = true;
  group.add(panel);

  // marker ring on the ground showing the trigger zone
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 2.9, 32),
    new THREE.MeshBasicMaterial({ color: palette.carBody, transparent: true, opacity: 0.35 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  return group;
}

function makePanelTexture(project: ProjectSign, palette: Palette): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 424;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.panel;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = palette.panelAccent;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  ctx.fillStyle = palette.panelAccent;
  ctx.font = '600 44px ui-monospace, monospace';
  ctx.fillText(String(project.year), 60, 110);

  ctx.fillStyle = palette.panelText;
  ctx.font = 'bold 72px system-ui, sans-serif';
  wrapText(ctx, project.title, 60, 210, canvas.width - 120, 84);

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

function scatterNature(scene: THREE.Scene, palette: Palette) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: palette.trunk, flatShading: true });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: palette.rock, flatShading: true });
  const leafMaterials = palette.leaves.map(
    (color) => new THREE.MeshStandardMaterial({ color, flatShading: true }),
  );

  for (let i = 0; i < 46; i++) {
    const angle = Math.random() * Math.PI * 2;
    // keep the center and the signpost ring clear
    const radius = 32 + Math.random() * (WORLD_RADIUS - 38);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (Math.random() < 0.72) {
      const tree = new THREE.Group();
      const height = 1.4 + Math.random() * 1.4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, height, 6), trunkMaterial);
      trunk.position.y = height / 2;
      trunk.castShadow = true;
      tree.add(trunk);
      const size = 1.1 + Math.random() * 1.3;
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(size, size * 2.1, 6),
        leafMaterials[Math.floor(Math.random() * leafMaterials.length)],
      );
      crown.position.y = height + size * 0.9;
      crown.castShadow = true;
      tree.add(crown);
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI;
      scene.add(tree);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.7, 0), rockMaterial);
      rock.position.set(x, 0.3, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      scene.add(rock);
    }
  }
}

function buildStars(): THREE.Points {
  const count = 400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 130 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.45;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xbfc6ff, size: 0.7, sizeAttenuation: true }));
}
