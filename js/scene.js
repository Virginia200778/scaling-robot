/**
 * scene.js
 * ------------------------------------------------------------
 * Escena 3D con Three.js: cámara, luces, campo de estrellas con parallax,
 * planetas con rasgos distintos y la nave con su astronauta.
 * Todo se modela con geometrías primitivas (estilo juguete), sin texturas externas.
 */
import * as THREE from 'three';

// -----------------------------------------------------------------------------
// Datos de los planetas
// -----------------------------------------------------------------------------

/** Planeta de salida (se ve en la pantalla de inicio). */
export const HOME_PLANET = {
  name: 'Planeta Casa', color: '#4aa8ff', color2: '#5ed37a', feature: 'spots', spots: 9,
  face: true, moons: 1, moonColor: '#f4f7ff',
};

/** Planetas de destino, en orden de viaje. */
export const PLANETS = [
  { name: 'Planeta Gominola', color: '#ff7eb6', color2: '#ffd1e6', feature: 'spots', spots: 14, face: true, moons: 1, moonColor: '#ffe27a' },
  { name: 'Planeta Burbuja', color: '#5ec8ff', color2: '#e6f8ff', feature: 'spots', spots: 10, rings: ['#fff27a'] },
  { name: 'Planeta Menta', color: '#4fe3c1', color2: '#1fae8c', feature: 'stripes', face: true, moons: 2, moonColor: '#ffffff' },
  { name: 'Planeta Volcán', color: '#ff8a5c', color2: '#c94f30', feature: 'craters', spots: 8, moons: 1, moonColor: '#ffd23f' },
  { name: 'Planeta Lavanda', color: '#a98bff', color2: '#7a5ce0', feature: 'stripes', face: true, rings: ['#ffb3e0', '#fff27a'] },
  { name: 'Planeta Arcoíris', color: '#ffd23f', color2: '#ff9f43', feature: 'spots', spots: 10, face: true,
    rings: ['#ff6fb5', '#5ec8ff', '#4fe3c1'], moons: 3, moonColor: '#ffffff' },
];

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

/** Material estándar con aspecto de juguete de plástico. */
export function toyMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.05, ...opts });
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** Textura circular suave (generada en un canvas) para las estrellas del fondo. */
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Libera geometrías y materiales de un objeto y sus hijos. */
export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

/** Ojos y sonrisa simpáticos para planetas (mirando hacia +z). */
function makeFace(radius) {
  const face = new THREE.Group();
  const dark = toyMaterial('#2b3a67', { roughness: 0.25 });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeGeo = new THREE.SphereGeometry(radius * 0.13, 20, 16);
  const shineGeo = new THREE.SphereGeometry(radius * 0.045, 12, 8);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.scale.set(0.85, 1.1, 0.5);
    eye.position.set(s * radius * 0.3, radius * 0.12, radius * 0.95);
    const shine = new THREE.Mesh(shineGeo, white);
    shine.position.set(s * radius * 0.3 + radius * 0.04, radius * 0.19, radius * 1.02);
    face.add(eye, shine);
    // Mofletes
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.09, 16, 12),
      toyMaterial('#ff9eb5', { transparent: true, opacity: 0.85 }));
    cheek.scale.set(1.3, 0.7, 0.3);
    cheek.position.set(s * radius * 0.5, -radius * 0.08, radius * 0.87);
    face.add(cheek);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.16, radius * 0.035, 10, 24, Math.PI), dark);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -radius * 0.08, radius * 0.97);
  face.add(smile);
  return face;
}

/**
 * Construye un planeta a partir de su definición.
 * Devuelve un grupo con userData.spin (parte que rota) y userData.moons.
 */
export function createPlanet(def, radius = 1.6) {
  const planet = new THREE.Group();
  planet.name = def.name;

  // Superficie que gira (esfera + detalles)
  const spin = new THREE.Group();
  planet.add(spin);
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), toyMaterial(def.color)));

  if (def.feature === 'stripes') {
    const mat = toyMaterial(def.color2);
    [-0.55, 0, 0.5].forEach((lat, i) => {
      const r = Math.sqrt(1 - lat * lat) * radius;
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, radius * (0.07 + i * 0.015), 12, 64), mat);
      band.rotation.x = Math.PI / 2;
      band.position.y = lat * radius;
      spin.add(band);
    });
  } else if (def.feature === 'spots' || def.feature === 'craters') {
    const mat = toyMaterial(def.color2);
    const n = def.spots || 10;
    for (let i = 0; i < n; i++) {
      // Distribución en espiral para repartir los lunares por la esfera
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.4;
      const dir = new THREE.Vector3(Math.cos(a) * r, y * 0.9, Math.sin(a) * r).normalize();
      const size = radius * (0.12 + ((i * 37) % 10) / 70);
      const geo = def.feature === 'craters'
        ? new THREE.TorusGeometry(size, size * 0.35, 10, 20)
        : new THREE.SphereGeometry(size, 16, 12);
      const spot = new THREE.Mesh(geo, mat);
      spot.position.copy(dir.multiplyScalar(radius * (def.feature === 'craters' ? 0.99 : 0.97)));
      spot.lookAt(0, 0, 0);
      if (def.feature !== 'craters') spot.scale.set(1, 1, 0.35);
      spin.add(spot);
    }
  }

  // Atmósfera suave (brillo alrededor)
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.12, 32, 24),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false })
  );
  planet.add(glow);

  // Cara simpática (no gira con la superficie: siempre mira a la cámara)
  if (def.face) planet.add(makeFace(radius));

  // Anillos (toros aplanados)
  if (def.rings) {
    const ringGroup = new THREE.Group();
    def.rings.forEach((col, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (1.55 + i * 0.22), radius * 0.075, 12, 80),
        toyMaterial(col, { roughness: 0.3 })
      );
      ring.scale.z = 0.35;
      ringGroup.add(ring);
    });
    ringGroup.rotation.set(Math.PI / 2 - 0.35, 0, 0.3);
    planet.add(ringGroup);
    planet.userData.rings = ringGroup;
  }

  // Lunas que orbitan
  planet.userData.moons = [];
  for (let i = 0; i < (def.moons || 0); i++) {
    const pivot = new THREE.Group();
    pivot.rotation.set(0.4 + i * 0.5, i * 2.1, 0.2 * i);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(radius * (0.16 + 0.04 * (i % 2)), 20, 16), toyMaterial(def.moonColor || '#ffffff'));
    moon.position.x = radius * (2.0 + i * 0.35);
    pivot.add(moon);
    planet.add(pivot);
    planet.userData.moons.push({ pivot, speed: 0.5 + i * 0.25 });
  }

  planet.userData.spin = spin;
  return planet;
}

/** Astronauta de juguete hecho con primitivas. Mira hacia la cámara (+z). */
function createAstronaut() {
  const astro = new THREE.Group();
  const white = toyMaterial('#f4f7ff');
  const grey = toyMaterial('#c9d3ea');
  const orange = toyMaterial('#ff8a5c');
  const navy = toyMaterial('#1d2550', { roughness: 0.15, metalness: 0.2 });

  // Cuerpo
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.18, 8, 16), white);
  body.position.y = 0.2;
  astro.add(body);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), toyMaterial('#5ec8ff'));
  panel.position.set(0, 0.22, 0.19);
  astro.add(panel);
  const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.14, 6, 12), grey);
  pack.position.set(0, 0.24, -0.17);
  astro.add(pack);

  // Brazos (uno saluda)
  const armGeo = new THREE.CapsuleGeometry(0.065, 0.2, 6, 12);
  const handGeo = new THREE.SphereGeometry(0.08, 12, 10);
  const armL = new THREE.Group();
  const armLm = new THREE.Mesh(armGeo, white); armLm.position.y = -0.12;
  const handL = new THREE.Mesh(handGeo, orange); handL.position.y = -0.26;
  armL.add(armLm, handL);
  armL.position.set(-0.22, 0.32, 0);
  armL.rotation.z = -0.5;
  const armR = armL.clone();
  armR.position.x = 0.22;
  armR.rotation.z = 2.5; // brazo levantado
  astro.add(armL, armR);
  astro.userData.armR = armR;

  // Piernas (a horcajadas sobre el cohete)
  const legGeo = new THREE.CapsuleGeometry(0.07, 0.16, 6, 12);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, white);
    leg.position.set(s * 0.12, -0.02, 0.12 * s);
    leg.rotation.x = s * 0.6;
    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), orange);
    boot.scale.set(1, 0.8, 1.2);
    boot.position.set(s * 0.12, -0.12, 0.2 * s);
    astro.add(leg, boot);
  }

  // Cabeza: casco, visor y ojos grandes
  const head = new THREE.Group();
  head.position.y = 0.62;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), white);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 24), navy);
  visor.scale.set(1, 0.82, 0.62);
  visor.position.z = 0.13;
  head.add(helmet, visor);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#7fe3ff' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), eyeMat);
    eye.scale.set(0.85, 1.15, 0.5);
    eye.position.set(s * 0.085, 0.02, 0.285);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pupilMat);
    glint.position.set(s * 0.085 + 0.012, 0.04, 0.31);
    head.add(eye, glint);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), eyeMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.06, 0.29);
  head.add(smile);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), orange);
    ear.rotation.z = Math.PI / 2;
    ear.position.x = s * 0.3;
    head.add(ear);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), grey);
  antenna.position.set(0.1, 0.33, 0);
  antenna.rotation.z = -0.3;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), toyMaterial('#ffd23f', { emissive: '#ffb000', emissiveIntensity: 0.6 }));
  ball.position.set(0.135, 0.41, 0);
  head.add(antenna, ball);
  astro.add(head);
  astro.userData.head = head;
  astro.userData.ball = ball;
  return astro;
}

/** Cohete redondeado con aletas, ventana, llama y el astronauta encima. Apunta hacia +x. */
function createShip() {
  const ship = new THREE.Group();
  const rocket = new THREE.Group();
  rocket.rotation.z = -Math.PI / 2; // el cohete se modela vertical y lo tumbamos
  ship.add(rocket);

  // Perfil del cuerpo (torno)
  const bodyPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = -0.85 + t * 1.45;
    const r = 0.36 + 0.14 * Math.sin(Math.PI * (0.15 + t * 0.75));
    bodyPts.push(new THREE.Vector2(r, y));
  }
  bodyPts.unshift(new THREE.Vector2(0, -0.85));
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 40), toyMaterial('#f4f7ff'));
  rocket.add(body);

  // Morro redondeado
  const nosePts = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    nosePts.push(new THREE.Vector2(Math.cos(a) * 0.44, 0.58 + Math.sin(a) * 0.62));
  }
  const nose = new THREE.Mesh(new THREE.LatheGeometry(nosePts, 40), toyMaterial('#ff6fb5'));
  rocket.add(nose);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), toyMaterial('#ffd23f'));
  tip.position.y = 1.2;
  rocket.add(tip);

  // Banda decorativa
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 12, 40), toyMaterial('#9b7bff'));
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.45;
  rocket.add(band);

  // Ventana (mirando a la cámara)
  const win = new THREE.Group();
  win.position.set(0, 0.2, 0.46);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 12, 32), toyMaterial('#ffd23f'));
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16),
    toyMaterial('#5ec8ff', { emissive: '#1d6fa5', emissiveIntensity: 0.5, roughness: 0.1 }));
  glass.scale.z = 0.45;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  shine.position.set(-0.05, 0.06, 0.07);
  win.add(frame, glass, shine);
  rocket.add(win);

  // Aletas redondeadas (forma extruida con bisel)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.quadraticCurveTo(0.42, -0.1, 0.48, -0.5);
  finShape.quadraticCurveTo(0.3, -0.42, 0, -0.38);
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 });
  finGeo.translate(0, 0, -0.02);
  const finMat = toyMaterial('#9b7bff');
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i * Math.PI * 2) / 3 + Math.PI / 2;
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(0.36, -0.42, 0);
    pivot.add(fin);
    rocket.add(pivot);
  }

  // Tobera y llama
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.16, 24), toyMaterial('#7d86a8'));
  nozzle.position.y = -0.92;
  rocket.add(nozzle);
  const flame = new THREE.Group();
  flame.position.y = -1.0;
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 20),
    new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.85 }));
  outer.rotation.x = Math.PI;
  outer.position.y = -0.35;
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 16), new THREE.MeshBasicMaterial({ color: '#fff27a' }));
  inner.rotation.x = Math.PI;
  inner.position.y = -0.24;
  flame.add(outer, inner);
  rocket.add(flame);

  // Astronauta montado encima del cohete
  const astronaut = createAstronaut();
  astronaut.position.set(-0.15, 0.42, 0);
  astronaut.rotation.y = 0.25;
  ship.add(astronaut);

  ship.userData = { rocket, flame, astronaut };
  return ship;
}

// -----------------------------------------------------------------------------
// Clase principal de la escena
// -----------------------------------------------------------------------------

export class SpaceScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // límite para tablets
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.camera.position.set(0, 0.4, 10);
    this.scene.add(this.camera); // la cámara tiene hijos (ayuda visual)

    this.pointer = new THREE.Vector2();
    this.camBase = new THREE.Vector3(0, 0.4, 10);
    this.layout = { hw: 4, hh: 3, portrait: false };
    this.mode = 'menu';          // 'menu' (pantalla de inicio) o 'game'

    this.setupLights();
    this.setupStars();

    this.ship = createShip();
    this.scene.add(this.ship);
    this.shipBase = new THREE.Vector3(-2.5, 0, 0);
    this.boostT = 1;   // animación de impulso (1 = terminada)
    this.jumpT = 1;    // salto + pirueta del astronauta
    this.thinkT = 1;   // gesto amable cuando falla

    // Planetas
    this.planet = null;          // destino actual
    this.leaving = null;         // planeta que dejamos atrás
    this.progress = 0;           // progreso mostrado (suavizado)
    this.targetProgress = 0;     // progreso objetivo (0..1)
    this.warp = 0;               // velocidad extra de las estrellas

    this.resize();
  }

  setupLights() {
    this.scene.add(new THREE.HemisphereLight('#cfe8ff', '#5a3d8a', 1.1));
    const key = new THREE.DirectionalLight('#fff3e0', 2.2);
    key.position.set(4, 6, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#ff9be0', 1.2);
    rim.position.set(-6, 2, -6);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight('#7d7dff', 0.35));
  }

  /** Tres capas de estrellas a distintas profundidades = parallax. */
  setupStars() {
    const tex = makeDotTexture();
    this.starLayers = [];
    const layers = [
      { count: 500, size: 0.18, speed: 1.0, spread: 60 },
      { count: 300, size: 0.3, speed: 2.2, spread: 45 },
      { count: 120, size: 0.5, speed: 4.0, spread: 35 },
    ];
    const palette = ['#ffffff', '#fff6c2', '#c9ecff', '#ffd6f0'].map((c) => new THREE.Color(c));
    for (const L of layers) {
      const pos = new Float32Array(L.count * 3);
      const col = new Float32Array(L.count * 3);
      for (let i = 0; i < L.count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * L.spread * 2;
        pos[i * 3 + 1] = (Math.random() - 0.5) * L.spread * 1.4;
        pos[i * 3 + 2] = -Math.random() * 120 + 5;
        const c = palette[Math.floor(Math.random() * palette.length)];
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size: L.size, map: tex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true,
      });
      const points = new THREE.Points(geo, mat);
      this.scene.add(points);
      this.starLayers.push({ points, ...L });
    }
  }

  /** Ajusta el renderizador y la composición al tamaño de la ventana. */
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // Alejamos la cámara en vertical para que siempre quepan nave y planeta.
    const minHalfWidth = 3.3;
    const dist = Math.max(9, minHalfWidth / (tanHalf * aspect));
    this.camBase.set(0, 0.3, dist);
    this.camera.updateProjectionMatrix();

    const hh = tanHalf * dist;
    const hw = hh * aspect;
    const portrait = aspect < 0.9;
    this.layout = { hw, hh, portrait };

    // Posiciones de referencia según orientación (y pantalla)
    if (portrait && this.mode === 'menu') {
      // En vertical, la nave y el planeta van abajo para no tapar el título
      this.shipBase.set(-hw * 0.35, -hh * 0.62, 0);
      this.nearPos = new THREE.Vector3(hw * 0.55, -hh * 0.58, -4);
    } else if (portrait) {
      this.shipBase.set(-hw * 0.3, -hh * 0.05, 0);
      this.nearPos = new THREE.Vector3(hw * 0.55, hh * 0.15, -5);
    } else {
      this.shipBase.set(-hw * 0.42, -hh * 0.08, 0);
      this.nearPos = new THREE.Vector3(hw * 0.5, hh * 0.05, -3.5);
    }
    this.farPos = new THREE.Vector3(this.nearPos.x * 0.6, this.nearPos.y + hh * 0.2, -60);
  }

  /** Cambia la composición entre la pantalla de inicio ('menu') y el juego ('game'). */
  setMode(mode) {
    this.mode = mode;
    this.resize();
  }

  /** Posición del ratón/dedo normalizada (-1..1) para un ligero parallax. */
  setPointer(x, y) {
    this.pointer.set(x, y);
  }

  /** Coloca un planeta según el progreso del viaje (0 = lejos, 1 = llegada). */
  placePlanet(planet, p) {
    const camZ = this.camBase.z;
    const dFar = camZ - this.farPos.z;
    const dNear = camZ - this.nearPos.z;
    // Interpolamos 1/distancia para que el tamaño aparente crezca de forma uniforme.
    const inv = THREE.MathUtils.lerp(1 / dFar, 1 / dNear, p);
    planet.position.set(
      THREE.MathUtils.lerp(this.farPos.x, this.nearPos.x, p),
      THREE.MathUtils.lerp(this.farPos.y, this.nearPos.y, p),
      camZ - 1 / inv
    );
  }

  /** Muestra un planeta ya cercano (pantalla de inicio). */
  showPlanetNear(def) {
    this.clearPlanets();
    this.planet = createPlanet(def);
    this.scene.add(this.planet);
    this.progress = this.targetProgress = 1;
    this.placePlanet(this.planet, 1);
  }

  /** Empieza un nuevo tramo: el planeta actual se queda atrás y aparece el siguiente a lo lejos. */
  departTo(def) {
    if (this.leaving) { this.scene.remove(this.leaving.obj); disposeObject(this.leaving.obj); }
    if (this.planet) {
      this.leaving = { obj: this.planet, t: 0, from: this.planet.position.clone() };
    }
    this.planet = createPlanet(def);
    this.planet.scale.setScalar(0.001);
    this.planet.userData.appear = 0;
    this.scene.add(this.planet);
    this.progress = this.targetProgress = 0;
    this.placePlanet(this.planet, 0);
    this.warp = 6;
    this.boost();
  }

  /** Avanza el progreso hacia el planeta (0..1). */
  setProgress(p) {
    this.targetProgress = clamp01(p);
  }

  clearPlanets() {
    for (const p of [this.planet, this.leaving && this.leaving.obj]) {
      if (p) { this.scene.remove(p); disposeObject(p); }
    }
    this.planet = null;
    this.leaving = null;
  }

  /** Impulso de la nave hacia delante. */
  boost() { this.boostT = 0; }
  /** Salto con pirueta del astronauta. */
  jump() { this.jumpT = 0; }
  /** Gesto pensativo (cabeza ladeada) cuando falla. */
  think() { this.thinkT = 0; }

  /** Posición en pantalla (píxeles) de la nave, útil para la interfaz. */
  getShipWorldPosition(target = new THREE.Vector3()) {
    return this.ship.getWorldPosition(target);
  }

  /** Actualización por fotograma. */
  update(dt, time) {
    // Cámara con parallax suave según el puntero
    const cam = this.camera;
    cam.position.x += (this.camBase.x + this.pointer.x * 0.5 - cam.position.x) * Math.min(1, dt * 2);
    cam.position.y += (this.camBase.y + this.pointer.y * 0.3 - cam.position.y) * Math.min(1, dt * 2);
    cam.position.z = this.camBase.z;
    cam.lookAt(0, 0, -4);

    // Progreso del viaje (suavizado) y velocidad de las estrellas
    const before = this.progress;
    this.progress += (this.targetProgress - this.progress) * Math.min(1, dt * 1.6);
    const travelSpeed = Math.abs(this.progress - before) / Math.max(dt, 1e-3);
    this.warp = Math.max(this.warp * Math.pow(0.35, dt), travelSpeed * 25);

    for (const L of this.starLayers) {
      const arr = L.points.geometry.attributes.position.array;
      const dz = (L.speed * 0.6 + L.speed * this.warp) * dt;
      for (let i = 2; i < arr.length; i += 3) {
        arr[i] += dz;
        if (arr[i] > 8) arr[i] -= 125;
      }
      L.points.geometry.attributes.position.needsUpdate = true;
    }

    // Planeta destino
    if (this.planet) {
      const ud = this.planet.userData;
      if (ud.appear !== undefined && ud.appear < 1) {
        ud.appear = Math.min(1, ud.appear + dt * 0.8);
        this.planet.scale.setScalar(easeInOut(ud.appear));
      }
      this.placePlanet(this.planet, this.progress);
      this.animatePlanet(this.planet, dt, time);
    }
    // Planeta que se aleja (pasa por detrás de la nave)
    if (this.leaving) {
      const L = this.leaving;
      L.t += dt / 2.2;
      const k = easeInOut(clamp01(L.t));
      L.obj.position.set(
        THREE.MathUtils.lerp(L.from.x, -this.layout.hw * 3.2, k),
        THREE.MathUtils.lerp(L.from.y, L.from.y - 1.5, k),
        THREE.MathUtils.lerp(L.from.z, L.from.z + 4, k)
      );
      this.animatePlanet(L.obj, dt, time);
      if (L.t >= 1) {
        this.scene.remove(L.obj);
        disposeObject(L.obj);
        this.leaving = null;
      }
    }

    this.animateShip(dt, time);
  }

  animatePlanet(planet, dt, time) {
    const ud = planet.userData;
    ud.spin.rotation.y += dt * 0.25;
    if (ud.rings) ud.rings.rotation.z += dt * 0.1;
    ud.moons.forEach((m) => { m.pivot.rotation.y += dt * m.speed; });
    planet.rotation.z = Math.sin(time * 0.3) * 0.05;
  }

  animateShip(dt, time) {
    const { flame, astronaut } = this.ship.userData;

    // Balanceo "idle"
    let x = this.shipBase.x;
    let y = this.shipBase.y + Math.sin(time * 1.6) * 0.14;
    this.ship.rotation.z = Math.sin(time * 1.1) * 0.06;
    this.ship.rotation.x = Math.sin(time * 0.8) * 0.08;

    // Impulso: la nave avanza un poco y vuelve
    let flameBoost = 0;
    if (this.boostT < 1) {
      this.boostT = Math.min(1, this.boostT + dt / 1.1);
      const s = Math.sin(Math.PI * this.boostT);
      x += s * 0.7;
      flameBoost = s * 1.4;
      this.ship.rotation.z += s * 0.12;
    }
    this.ship.position.set(x, y, this.shipBase.z);

    // Llama parpadeante
    const flick = 1 + Math.sin(time * 30) * 0.08 + Math.sin(time * 47) * 0.05;
    flame.scale.set(1 + flameBoost * 0.3, (1 + flameBoost) * flick, 1 + flameBoost * 0.3);

    // Astronauta: saludo, salto con pirueta y gesto pensativo
    astronaut.userData.armR.rotation.z = 2.5 + Math.sin(time * 4) * 0.35;
    let ay = 0.42;
    let spin = 0;
    if (this.jumpT < 1) {
      this.jumpT = Math.min(1, this.jumpT + dt / 1.2);
      ay += Math.sin(Math.PI * this.jumpT) * 1.0;
      spin = easeInOut(this.jumpT) * Math.PI * 2;
    }
    astronaut.position.y = ay;
    astronaut.rotation.z = spin;
    const head = astronaut.userData.head;
    if (this.thinkT < 1) {
      this.thinkT = Math.min(1, this.thinkT + dt / 1.6);
      head.rotation.z = Math.sin(this.thinkT * Math.PI * 3) * 0.25 * (1 - this.thinkT);
    } else {
      head.rotation.z = Math.sin(time * 0.9) * 0.06;
    }
    astronaut.userData.ball.material.emissiveIntensity = 0.4 + Math.sin(time * 3) * 0.3;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
