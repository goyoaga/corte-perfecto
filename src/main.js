import * as THREE from 'three';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const stage = $('#stage');
const overlay = $('#cut-overlay');
const options = $('#apple-options');
const fmt = (number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number);
const fmtPrecise = (number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rnd = (min, max) => min + Math.random() * (max - min);
const colors = ['#bb3231', '#5a983d', '#d8b43e'];
const names = ['Carmín', 'Verde', 'Dorada'];
// Tres siluetas reconocibles que cambian de color en cada partida.
const shapes = [
  { width: 0.99, roundness: 0.43, shoulder: 1.1, belly: -0.018, lobe: 0.072, bend: 0.014, asymmetry: 0.014, leanAngle: 0 },
  { width: 0.93, roundness: 0.46, shoulder: 0.7, belly: 0.014, lobe: 0.046, bend: 0.042, asymmetry: 0.076, leanAngle: 0 },
  { width: 1.055, roundness: 0.39, shoulder: 1.3, belly: -0.014, lobe: 0.056, bend: 0.06, asymmetry: 0.048, leanAngle: Math.PI },
];

let renderer, scene, camera, apples = [], selected = null, state = 'select';
let cut = null, pointerStart = null, cutCount = 0, soundEnabled = false;
let lastTime = 0, activeAnimation = null;
let confetti = null;
const clock = new THREE.Clock();
const target = new THREE.Vector3(0, 0.95, 0);
const topPosition = new THREE.Vector3(0, 7.4, 0.001);
const frontPosition = new THREE.Vector3(0, 3.5, 7.5);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const localPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);

function noise(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

function appleShape(apple, y, angle) {
  const h = clamp((y + 1.08) / 2.16, 0, 1);
  // Cuerpo lleno y redondeado, hombros apenas más anchos que la base.
  const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * h)), apple.roundness);
  const shoulder = 0.93 + 0.15 * h
    + apple.shoulder * 0.095 * Math.exp(-Math.pow((h - 0.7) / 0.16, 2))
    + apple.belly * Math.exp(-Math.pow((h - 0.35) / 0.2, 2));
  // Los cinco lóbulos alcanzan también el hombro, que define el contorno visto
  // desde arriba. Una ondulación amplia rompe la simetría sin deformar el cuerpo.
  const crownLobes = 0.48 + 0.52 * Math.exp(-Math.pow((h - 0.77) / 0.24, 2));
  const lobes = 1 + apple.lobe * Math.cos(5 * angle + apple.phase) * crownLobes
    + apple.bend * Math.cos(2 * angle - apple.phase * 0.7) * (0.45 + 0.25 * h)
    + apple.asymmetry * Math.cos(angle - apple.leanAngle) * (0.45 + 0.35 * h);
  return apple.width * envelope * shoulder * lobes;
}

function appleVolume(apple) {
  // Área de cada sección horizontal integrada con la misma función que dibuja la piel.
  // Basta para vincular el peso a la forma sin repetir el muestreo 3D del corte.
  const levels = 48, angles = 64;
  let squaredRadii = 0;
  for (let j = 0; j < levels; j++) {
    const y = -1.08 + (j + 0.5) * 2.16 / levels;
    for (let i = 0; i < angles; i++) {
      const radius = appleShape(apple, y, (i + 0.5) * 2 * Math.PI / angles);
      squaredRadii += radius * radius;
    }
  }
  return squaredRadii * Math.PI * 2.16 / (levels * angles);
}

function surfaceY(y, radius) {
  // La hendidura superior y la cavidad inferior usan el mismo perfil en piel y volumen.
  const crown = 0.27 * Math.exp(-Math.pow(radius / 0.38, 2)) * clamp((y - 0.28) / 0.8, 0, 1);
  const base = 0.17 * Math.exp(-Math.pow(radius / 0.33, 2)) * clamp((-y - 0.4) / 0.68, 0, 1);
  return y - crown + base;
}

function inside(apple, x, y, z) {
  if (Math.abs(y) >= 1.08) return false;
  // Invertimos la pequeña deformación vertical para muestrear exactamente el
  // mismo cuerpo usado por la malla. Converge en unas pocas iteraciones.
  let profileY = y;
  let radius;
  for (let i = 0; i < 5; i++) {
    radius = Math.hypot(x - apple.tilt * profileY * 0.15, z);
    profileY += y - surfaceY(profileY, radius);
  }
  if (profileY <= -1.08 || profileY >= 1.08) return false;
  return radius <= appleShape(apple, profileY, Math.atan2(z, x - apple.tilt * profileY * 0.15));
}

function makeGeometry(apple) {
  const sides = 80, rings = 56;
  const vertices = [], indices = [], tones = [];
  const base = new THREE.Color(apple.color);
  const warm = new THREE.Color('#e2a74f');
  const green = new THREE.Color('#729b55');
  for (let j = 0; j <= rings; j++) {
    const y = -1.08 + 2.16 * j / rings;
    for (let i = 0; i <= sides; i++) {
      const angle = 2 * Math.PI * i / sides;
      const radius = appleShape(apple, y, angle);
      vertices.push(apple.tilt * y * 0.15 + radius * Math.cos(angle), surfaceY(y, radius), radius * Math.sin(angle));
      // Rubor, vetas y motas muy suaves; el patrón se cierra sin costura angular.
      const streak = Math.sin(angle * 9 + apple.phase + y * 1.6) * 0.5 + 0.5;
      const mottling = Math.sin(angle * 23 + y * 19) * Math.sin(angle * 17 - y * 27);
      const tint = base.clone().lerp(warm, 0.07 + 0.1 * streak).lerp(green, 0.09 * (1 - streak) * (0.5 + 0.5 * y / 1.08));
      const shade = 0.9 + 0.06 * y + 0.045 * mottling;
      tones.push(tint.r * shade, tint.g * shade, tint.b * shade);
      if (j < rings && i < sides) {
        const a = j * (sides + 1) + i, b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeApple(index, shape) {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const random = noise(seed);
  const apple = {
    seed, color: colors[index], name: names[index], width: shape.width + (random() - 0.5) * 0.025,
    roundness: shape.roundness + (random() - 0.5) * 0.014,
    shoulder: shape.shoulder + (random() - 0.5) * 0.08,
    belly: shape.belly + (random() - 0.5) * 0.008,
    lobe: shape.lobe + (random() - 0.5) * 0.008,
    bend: shape.bend + (random() - 0.5) * 0.006,
    asymmetry: shape.asymmetry + (random() - 0.5) * 0.006,
    leanAngle: shape.leanAngle + (random() - 0.5) * 0.28,
    tilt: random() * 0.7 - 0.35, phase: random() * Math.PI * 2,
    index,
  };
  // La densidad varía ligeramente entre piezas, pero el volumen domina el peso.
  apple.weight = Math.round(43 * appleVolume(apple) * (0.97 + random() * 0.06));
  apple.geometry = makeGeometry(apple);
  apple.group = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.17, side: THREE.DoubleSide });
  apple.skin = skin;
  apple.body = new THREE.Mesh(apple.geometry, skin);
  apple.body.castShadow = true;
  apple.body.receiveShadow = true;
  apple.group.add(apple.body);
  // El tallo es decorativo: queda fuera del cálculo del peso.
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.038, 0.34, 9), new THREE.MeshStandardMaterial({ color: '#553d26', roughness: 0.85 }));
  stem.position.set(0.02, 0.96, 0);
  stem.rotation.z = 0.2;
  stem.castShadow = true;
  apple.group.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#486c3d', roughness: 0.56, side: THREE.DoubleSide }));
  leaf.scale.set(0.23, 0.035, 0.105);
  leaf.position.set(0.21, 1.06, 0);
  leaf.rotation.set(0.2, -0.35, 0.35);
  apple.group.add(leaf);
  scene.add(apple.group);
  return apple;
}

function makeScene() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    $('#webgl-error').classList.remove('hidden');
    $('#loading').classList.add('hidden');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.7;
  renderer.localClippingEnabled = true;
  stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#eeebe3');
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.copy(frontPosition);
  camera.lookAt(target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#baada0', 2.4));
  const key = new THREE.DirectionalLight('#fff8eb', 3.4);
  key.position.set(-3, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', 1.1);
  fill.position.set(3, 4, -4);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#eeebe3', roughness: 0.91 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.08, 0.12, 80), new THREE.MeshStandardMaterial({ color: '#e4ded3', roughness: 0.83 }));
  tray.position.y = 0.06;
  tray.receiveShadow = true;
  scene.add(tray);
  window.addEventListener('resize', resize);
  resize();
  $('#loading').classList.add('hidden');
  renderer.setAnimationLoop(animate);
  return true;
}

function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height || !renderer) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = width < 520 ? 49 : 38;
  camera.updateProjectionMatrix();
}

function animate() {
  const elapsed = clock.getElapsedTime();
  const dt = Math.min(elapsed - lastTime, 0.05);
  lastTime = elapsed;
  if (activeAnimation) activeAnimation(dt);
  if (state === 'select') {
    apples.forEach((apple, index) => { apple.group.rotation.y = Math.sin(elapsed * 0.35 + index) * 0.13; });
  }
  renderer.render(scene, camera);
}

function setView(view) {
  $('#app').dataset.view = view;
  ['select', 'aim', 'result'].forEach((name) => $(`#${name}-panel`).classList.toggle('hidden', name !== view));
  overlay.classList.toggle('hidden', view !== 'aim');
  $('#stage-step').textContent = view === 'select' ? '01 — SELECCIÓN' : view === 'aim' ? '02 — EL CORTE' : '03 — EL VEREDICTO';
  $('#stage-kicker').textContent = view === 'select' ? 'LA COSECHA DE HOY' : view === 'aim' ? 'BUSCA EL EQUILIBRIO' : 'EL MOMENTO DE LA VERDAD';
  state = view;
  // En móvil, la pantalla de corte empieza arriba aunque se haya elegido la fruta más abajo.
  if (view === 'aim' || view === 'result') requestAnimationFrame(() => window.scrollTo(0, 0));
  requestAnimationFrame(resize);
}

function clearApples() {
  apples.forEach((apple) => {
    scene.remove(apple.group);
    apple.geometry.dispose();
    apple.skin.dispose();
    apple.capGeometry?.dispose();
    apple.capMaterial?.dispose();
  });
  apples = [];
}

function newGame() {
  activeAnimation = null;
  confetti?.remove();
  confetti = null;
  camera.position.copy(frontPosition);
  camera.lookAt(target);
  clearApples();
  selected = null;
  cut = null;
  cutCount = 0;
  $('#cut-line').style.opacity = '0';
  $('#cut-button').disabled = true;
  options.innerHTML = '';
  // Una forma de cada tipo, barajada para que el color no revele la dificultad.
  const shuffledShapes = [...shapes];
  for (let i = shuffledShapes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledShapes[i], shuffledShapes[j]] = [shuffledShapes[j], shuffledShapes[i]];
  }
  apples = [0, 1, 2].map((i) => makeApple(i, shuffledShapes[i]));
  apples.forEach((apple, i) => {
    apple.group.position.set((i - 1) * 1.82, 0.87, 0);
    apple.group.scale.setScalar(0.68);
    const button = document.createElement('button');
    button.className = 'apple-option';
    button.type = 'button';
    button.innerHTML = `<span class="fruit-dot" style="--fruit-color:${apple.color}"></span><span>${String(i + 1).padStart(2, '0')} / ${apple.name}</span><span>↗</span>`;
    button.addEventListener('click', () => selectApple(apple));
    options.appendChild(button);
  });
  setView('select');
}

function backToSelection() {
  if (state !== 'aim') return;
  selected = null;
  cut = null;
  pointerStart = null;
  $('#cut-line').style.opacity = '0';
  $('#cut-button').disabled = true;
  apples.forEach((apple, i) => {
    apple.group.visible = true;
    apple.group.position.set((i - 1) * 1.82, 0.87, 0);
    apple.group.scale.setScalar(0.68);
  });
  camera.position.copy(frontPosition);
  camera.lookAt(target);
  setView('select');
}

function selectApple(apple) {
  selected = apple;
  apples.forEach((item) => { item.group.visible = item === apple; item.group.rotation.y = 0; });
  apple.group.position.set(0, 1.2, 0);
  apple.group.scale.setScalar(1);
  $('#total-weight').textContent = `${apple.weight} g`;
  $('#aim-status').textContent = 'Dibuja una línea para empezar.';
  cut = null;
  $('#cut-line').style.opacity = '0';
  $('#cut-button').disabled = true;
  // En la pantalla estrecha acercamos la cámara para que la fruta siga siendo fácil de cortar.
  camera.position.copy(stage.clientWidth <= 760 ? new THREE.Vector3(0, 5.35, 0.001) : topPosition);
  camera.lookAt(new THREE.Vector3(0, 1.1, 0));
  setView('aim');
  tone(580, 0.04);
}

function screenPoint(event) {
  const rect = stage.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
}

function worldPoint(point) {
  pointer.set(point.x / point.width * 2 - 1, -(point.y / point.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const result = new THREE.Vector3();
  return raycaster.ray.intersectPlane(localPlane, result) ? result : null;
}

function updateLine(start, end) {
  const line = $('#cut-line');
  line.setAttribute('x1', start.x / start.width * 100);
  line.setAttribute('y1', start.y / start.height * 100);
  line.setAttribute('x2', end.x / end.width * 100);
  line.setAttribute('y2', end.y / end.height * 100);
  line.style.opacity = '1';
}

function validateCut(start, end) {
  if (Math.hypot(end.x - start.x, end.y - start.y) < 50) return null;
  const a = worldPoint(start), b = worldPoint(end);
  if (!a || !b) return null;
  const tangent = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  const offset = normal.dot(a);
  if (Math.abs(offset) > 0.77) return null;
  return { normal, tangent, offset };
}

function preview(start, end) {
  updateLine(start, end);
  cut = validateCut(start, end);
  $('#cut-button').disabled = !cut;
  $('#aim-status').textContent = cut ? 'Corte válido. ¿Listo para intentarlo?' : 'Traza una línea más larga que atraviese la fruta.';
  $('#cut-hint').classList.toggle('hidden', !!cut);
}

function measure(apple, cutPlane) {
  // Muestreo uniforme y determinista del mismo volumen paramétrico que genera la piel.
  // La suma de ambas partes se normaliza al peso total mostrado antes del corte.
  const steps = 72, bound = 1.37;
  let left = 0, right = 0;
  for (let yi = 0; yi < steps; yi++) {
    const y = -1.08 + (yi + 0.5) * 2.16 / steps;
    for (let xi = 0; xi < steps; xi++) {
      const x = -bound + (xi + 0.5) * 2 * bound / steps;
      for (let zi = 0; zi < steps; zi++) {
        const z = -bound + (zi + 0.5) * 2 * bound / steps;
        if (!inside(apple, x, y, z)) continue;
        if (cutPlane.normal.x * x + cutPlane.normal.z * z >= cutPlane.offset) right++;
        else left++;
      }
    }
  }
  const sum = left + right;
  return { a: apple.weight * left / sum, b: apple.weight * right / sum };
}

function capFor(apple, cutPlane) {
  const { normal: n, tangent: t, offset: d } = cutPlane;
  const positions = [], levels = 55, samples = 96;
  let previous = null;
  for (let j = 0; j <= levels; j++) {
    const y = -1.08 + (j + 0.001) * 2.16 / levels;
    const hits = [];
    for (let k = 0; k <= samples; k++) {
      const along = -1.5 + 3 * k / samples;
      const x = n.x * d + t.x * along, z = n.z * d + t.z * along;
      if (inside(apple, x, y, z)) hits.push(along);
    }
    if (hits.length < 2) { previous = null; continue; }
    const current = { y, min: hits[0], max: hits[hits.length - 1] };
    if (previous) {
      const point = (row, along) => [n.x * d + t.x * along, row.y, n.z * d + t.z * along];
      const a = point(previous, previous.min), b = point(previous, previous.max);
      const c = point(current, current.max), e = point(current, current.min);
      positions.push(...a, ...b, ...c, ...a, ...c, ...e);
    }
    previous = current;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function performCut() {
  if (!cut || !selected || cutCount) return;
  cutCount++;
  $('#cut-button').disabled = true;
  overlay.classList.add('hidden');
  const apple = selected;
  const result = measure(apple, cut);
  const n = cut.normal.clone();
  const basePlane = new THREE.Plane(n.clone(), -cut.offset);
  const opposingPlane = new THREE.Plane(n.clone().negate(), cut.offset);
  apple.skin.clippingPlanes = [basePlane];
  const secondSkin = apple.skin.clone();
  secondSkin.clippingPlanes = [opposingPlane];
  const second = new THREE.Mesh(apple.geometry, secondSkin);
  second.castShadow = true;
  second.receiveShadow = true;
  const capGeometry = capFor(apple, cut);
  const capMaterial = new THREE.MeshPhysicalMaterial({ color: '#f6d8aa', roughness: 0.56, clearcoat: 0.24, side: THREE.DoubleSide });
  const cap1 = new THREE.Mesh(capGeometry, capMaterial);
  const cap2 = new THREE.Mesh(capGeometry, capMaterial);
  const halfA = new THREE.Group(), halfB = new THREE.Group();
  apple.group.remove(apple.body);
  halfA.add(apple.body, cap1);
  halfB.add(second, cap2);
  apple.group.add(halfA, halfB);
  apple.capGeometry = capGeometry;
  apple.capMaterial = capMaterial;
  // El tallo deja de mostrarse en la animación para evitar que aparezca duplicado.
  apple.group.children.forEach((child) => { if (child !== halfA && child !== halfB) child.visible = false; });
  const startTime = performance.now();
  camera.position.copy(frontPosition);
  camera.lookAt(target);
  knifeSound();
  activeAnimation = () => {
    const progress = clamp((performance.now() - startTime) / 850, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const distance = eased * 0.46;
    halfA.position.copy(n).multiplyScalar(distance);
    halfB.position.copy(n).multiplyScalar(-distance);
    basePlane.constant = -cut.offset - distance;
    opposingPlane.constant = cut.offset - distance;
    if (progress >= 1) activeAnimation = null;
  };
  setTimeout(() => showResult(result), 850);
}

function showResult(result) {
  const difference = Math.abs(result.a - result.b);
  const percentage = difference / selected.weight * 100;
  $('#piece-a').textContent = `${fmt(result.a)} g`;
  $('#piece-b').textContent = `${fmt(result.b)} g`;
  $('#difference').textContent = `${difference < 1 ? fmtPrecise(difference) : fmt(difference)} g`;
  $('#percentage').textContent = `${fmt(percentage)} % DEL PESO TOTAL`;
  $('#verdict').innerHTML = difference < 1 ? '¡Corte<br />perfecto!' : percentage < 1 ? 'Casi<br />perfecto.' : percentage < 5 ? '¡Muy<br />cerca!' : percentage < 12 ? 'Bien<br />cortado.' : 'Una mitad<br />ganó.';
  $('#scale-center').style.left = `${clamp(50 + (result.b - result.a) / selected.weight * 110, 9, 91)}%`;
  try {
    const previous = Number(localStorage.getItem('corte-perfecto-best'));
    const best = previous > 0 ? Math.min(previous, percentage) : percentage;
    localStorage.setItem('corte-perfecto-best', String(best));
    $('#personal-best').textContent = `MEJOR MARCA PERSONAL · ${fmt(best)} %`;
  } catch {
    $('#personal-best').textContent = '';
  }
  setView('result');
  if (difference < 1) celebrateCut();
  tone(660, 0.055);
}

function celebrateCut() {
  // Una celebración breve, sin dependencias ni interacción sobre los controles.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confetti?.remove();
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  const palette = ['#bb4333', '#d8a83a', '#486c3d', '#f6d8aa'];
  for (let i = 0; i < 48; i++) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--x', `${rnd(32, 68)}vw`);
    piece.style.setProperty('--y', `${rnd(12, 30)}vh`);
    piece.style.setProperty('--dx', `${rnd(-52, 52)}vw`);
    piece.style.setProperty('--dy', `${rnd(50, 85)}vh`);
    piece.style.setProperty('--spin', `${rnd(-720, 720)}deg`);
    piece.style.setProperty('--delay', `${rnd(0, 0.18)}s`);
    piece.style.setProperty('--duration', `${rnd(1.2, 1.8)}s`);
    piece.style.backgroundColor = palette[i % palette.length];
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  confetti = layer;
  setTimeout(() => {
    layer.remove();
    if (confetti === layer) confetti = null;
  }, 2100);
}

function knifeSound() {
  if (!soundEnabled) return;
  try {
    // Ruido filtrado para el filo y un golpe suave para el contacto con la fruta.
    // Se crea dentro del clic: los navegadores móviles permiten audio tras el gesto.
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const start = context.currentTime;
    const duration = 0.18;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1250;
    filter.Q.value = 0.8;
    const swish = context.createGain();
    swish.gain.setValueAtTime(0.001, start);
    swish.gain.linearRampToValueAtTime(0.12, start + 0.018);
    swish.gain.exponentialRampToValueAtTime(0.001, start + duration);
    noiseSource.connect(filter).connect(swish).connect(context.destination);
    const thud = context.createOscillator();
    const thudGain = context.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(155, start);
    thud.frequency.exponentialRampToValueAtTime(75, start + 0.1);
    thudGain.gain.setValueAtTime(0.001, start);
    thudGain.gain.linearRampToValueAtTime(0.055, start + 0.012);
    thudGain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
    thud.connect(thudGain).connect(context.destination);
    noiseSource.start(start);
    thud.start(start);
    thud.stop(start + 0.12);
    noiseSource.onended = () => context.close();
  } catch { /* El audio nunca debe impedir jugar. */ }
}

function tone(frequency, duration) {
  if (!soundEnabled) return;
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => context.close();
  } catch { /* El audio nunca debe impedir jugar. */ }
}

overlay.addEventListener('pointerdown', (event) => {
  if (state !== 'aim') return;
  overlay.setPointerCapture(event.pointerId);
  pointerStart = screenPoint(event);
  $('#cut-hint').classList.add('hidden');
  preview(pointerStart, pointerStart);
});
overlay.addEventListener('pointermove', (event) => {
  if (!pointerStart || state !== 'aim') return;
  preview(pointerStart, screenPoint(event));
});
overlay.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  preview(pointerStart, screenPoint(event));
  pointerStart = null;
});
overlay.addEventListener('pointercancel', () => { pointerStart = null; });
stage.addEventListener('click', (event) => {
  if (state !== 'select') return;
  const point = screenPoint(event);
  pointer.set(point.x / point.width * 2 - 1, -(point.y / point.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(apples.map((apple) => apple.body), false);
  const apple = apples.find((item) => item.body === hits[0]?.object);
  if (apple) selectApple(apple);
});
$('#cut-button').addEventListener('click', performCut);
$('#back-button').addEventListener('click', backToSelection);
$('#again-button').addEventListener('click', newGame);
$('#sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('#sound-toggle').textContent = `SONIDO: ${soundEnabled ? 'ON' : 'OFF'}`;
  $('#sound-toggle').setAttribute('aria-label', `${soundEnabled ? 'Desactivar' : 'Activar'} sonido`);
  tone(750, 0.06);
});

const saveDialog = $('#save-dialog');
$('#save-button').addEventListener('click', () => {
  const agent = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(agent);
  $('#save-instructions').textContent = ios
    ? 'Si abriste el juego desde Instagram, ábrelo primero en Safari. En Safari, abre el menú de la página, elige «Añadir marcador» y guárdalo en «Favoritos». También puedes usar «Añadir a pantalla de inicio».'
    : android
      ? 'Si abriste el juego desde Instagram, ábrelo primero en Chrome. En Chrome, abre el menú ⋮ y toca la estrella para añadir el juego a tus marcadores.'
      : `Pulsa ${/Macintosh|Mac OS X/.test(agent) ? '⌘' : 'Ctrl'} + D para guardarlo en los favoritos de tu navegador.`;
  saveDialog.showModal();
});
$('#close-save').addEventListener('click', () => saveDialog.close());
$('#save-done').addEventListener('click', () => saveDialog.close());
saveDialog.addEventListener('click', (event) => {
  if (event.target === saveDialog) saveDialog.close();
});

if (makeScene()) newGame();
