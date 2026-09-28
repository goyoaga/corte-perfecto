import * as THREE from 'three';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const stage = $('#stage');
const overlay = $('#cut-overlay');
const options = $('#apple-options');
const fmt = (number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rnd = (min, max) => min + Math.random() * (max - min);
const colors = ['#bb3231', '#d8a83a', '#b74b3c'];
const names = ['Carmín', 'Dorada', 'Rosada'];

let renderer, scene, camera, apples = [], selected = null, state = 'select';
let cut = null, pointerStart = null, cutCount = 0, soundEnabled = false;
let lastTime = 0, activeAnimation = null;
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
  const envelope = Math.pow(Math.max(0, Math.sin(Math.PI * h)), 0.59);
  const shoulder = 1 + 0.17 * h - 0.09 * Math.cos(2 * Math.PI * h);
  const lobes = 1 + apple.lobe * Math.cos(5 * angle + apple.phase) * (0.25 + 0.75 * h)
    + apple.bend * Math.cos(3 * angle - apple.phase * 0.7) * (1 - 0.25 * h);
  return apple.width * envelope * shoulder * lobes;
}

function inside(apple, x, y, z) {
  if (Math.abs(y) >= 1.08) return false;
  const angle = Math.atan2(z, x);
  const centerX = apple.tilt * y * 0.15;
  return Math.hypot(x - centerX, z) <= appleShape(apple, y, angle);
}

function makeGeometry(apple) {
  const sides = 64, rings = 42;
  const vertices = [], indices = [], tones = [];
  const base = new THREE.Color(apple.color);
  for (let j = 0; j <= rings; j++) {
    const y = -1.08 + 2.16 * j / rings;
    for (let i = 0; i <= sides; i++) {
      const angle = 2 * Math.PI * i / sides;
      const radius = appleShape(apple, y, angle);
      vertices.push(apple.tilt * y * 0.15 + radius * Math.cos(angle), y, radius * Math.sin(angle));
      const streak = Math.sin(angle * 11 + apple.phase + y * 1.9) * 0.045;
      const shade = 0.9 + 0.1 * (y + 1.08) / 2.16 + streak;
      tones.push(base.r * shade, base.g * shade, base.b * shade);
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

function makeApple(index) {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const random = noise(seed);
  const apple = {
    seed, color: colors[index], name: names[index], width: 0.91 + random() * 0.15,
    lobe: 0.035 + random() * 0.07, bend: 0.035 + random() * 0.08,
    tilt: random() * 1.6 - 0.8, phase: random() * Math.PI * 2,
    weight: Math.round(172 + random() * 72), index,
  };
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
  stem.position.set(0.02, 1.18, 0);
  stem.rotation.z = 0.2;
  stem.castShadow = true;
  apple.group.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#486c3d', roughness: 0.56, side: THREE.DoubleSide }));
  leaf.scale.set(0.23, 0.035, 0.105);
  leaf.position.set(0.21, 1.28, 0);
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
  ['select', 'aim', 'result'].forEach((name) => $(`#${name}-panel`).classList.toggle('hidden', name !== view));
  overlay.classList.toggle('hidden', view !== 'aim');
  $('#stage-step').textContent = view === 'select' ? '01 — SELECCIÓN' : view === 'aim' ? '02 — EL CORTE' : '03 — EL VEREDICTO';
  $('#stage-kicker').textContent = view === 'select' ? 'LA COSECHA DE HOY' : view === 'aim' ? 'BUSCA EL EQUILIBRIO' : 'EL MOMENTO DE LA VERDAD';
  state = view;
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
  camera.position.copy(frontPosition);
  camera.lookAt(target);
  clearApples();
  selected = null;
  cut = null;
  cutCount = 0;
  $('#cut-line').style.opacity = '0';
  $('#cut-button').disabled = true;
  options.innerHTML = '';
  apples = [0, 1, 2].map((i) => makeApple(i));
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
  camera.position.copy(topPosition);
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
  tone(240, 0.09);
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
  $('#difference').textContent = `${fmt(difference)} g`;
  $('#percentage').textContent = `${fmt(percentage)} % DEL PESO TOTAL`;
  $('#verdict').innerHTML = percentage < 1 ? 'Casi<br />perfecto.' : percentage < 5 ? '¡Muy<br />cerca!' : percentage < 12 ? 'Bien<br />cortado.' : 'Una mitad<br />ganó.';
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
  tone(660, 0.055);
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

if (makeScene()) newGame();
