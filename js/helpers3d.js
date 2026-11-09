/**
 * helpers3d.js
 * ------------------------------------------------------------
 * - Tweener: pequeño motor de animaciones (interpolaciones) que avanza con el
 *   bucle de render, de modo que se congela cuando el juego está en pausa.
 * - CountingHelper: ayuda visual en 3D para contar (sumas y restas).
 *   Hasta 20 se usan objetos sueltos; por encima, cohete = 10 y estrella = 1.
 * - Celebration: explosión de confeti y estrellas 3D al acertar.
 */
(function () {
  'use strict';
  const { toyMaterial } = window.AstroSumas;

  /** Ajustes de la ayuda visual (fáciles de cambiar). */
  const HELPER_CONFIG = {
    DISTANCE: 6,          // distancia a la cámara a la que se dibuja la ayuda
    SPEED: 1,             // >1 más rápido, <1 más lento
    TENS_THRESHOLD: 20,   // a partir de aquí se usan decenas (cohetes) y unidades (estrellas)
    SPACING: 0.52,        // separación entre objetos
    COLS: 5,              // objetos por fila (como un "marco de 10": 2 filas de 5)
  };

  // -----------------------------------------------------------------------------
  // Curvas de animación
  // -----------------------------------------------------------------------------
  const Ease = {
    linear: (t) => t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  // -----------------------------------------------------------------------------
  // Motor de interpolaciones
  // -----------------------------------------------------------------------------
  class Tweener {
    constructor() {
      this.items = [];
    }

    /**
     * Anima propiedades numéricas de un objeto.
     * @returns {Promise<void>} se resuelve al terminar (o al cancelarse)
     */
    to(target, props, { duration = 0.5, delay = 0, ease = Ease.inOut, onUpdate = null } = {}) {
      return new Promise((resolve) => {
        this.items.push({ target, props, duration: Math.max(0.0001, duration), delay, ease, onUpdate, resolve, t: -delay, from: null });
      });
    }

    /** Espera unos segundos (en tiempo de juego). */
    wait(seconds) {
      return this.to({}, {}, { duration: seconds });
    }

    update(dt) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.t += dt;
        if (it.t < 0) continue;
        if (!it.from) {
          it.from = {};
          for (const k in it.props) it.from[k] = it.target[k];
        }
        const p = Math.min(1, it.t / it.duration);
        const e = it.ease(p);
        for (const k in it.props) it.target[k] = it.from[k] + (it.props[k] - it.from[k]) * e;
        if (it.onUpdate) it.onUpdate(e);
        if (p >= 1) {
          this.items.splice(i, 1);
          it.resolve();
        }
      }
    }

    /** Cancela todo y resuelve las promesas pendientes. */
    clear() {
      const pending = this.items;
      this.items = [];
      pending.forEach((it) => it.resolve());
    }
  }

  // -----------------------------------------------------------------------------
  // Etiquetas de texto (sprites con textura de canvas)
  // -----------------------------------------------------------------------------
  function makeLabel(text, { color = '#ffffff', height = 0.6 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 10;

    const draw = (txt, col = color) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '700 150px "Fredoka", "Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 26;
      ctx.strokeStyle = '#1d2550';
      ctx.strokeText(txt, 256, 104);
      ctx.fillStyle = col;
      ctx.fillText(txt, 256, 104);
      tex.needsUpdate = true;
    };
    draw(text);
    sprite.scale.set(height * (512 / 192), height, 1);
    sprite.userData.setText = draw;
    sprite.userData.baseHeight = height;
    return sprite;
  }

  // -----------------------------------------------------------------------------
  // Prototipos de objetos para contar
  // -----------------------------------------------------------------------------

  /** Estrella extruida con bordes redondeados. */
  function makeStarGeometry(outer = 0.23, inner = 0.11) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 4 });
    geo.center();
    return geo;
  }

  class Prototypes {
    constructor() {
      this.starGeo = makeStarGeometry();
      this.planetGeo = new THREE.SphereGeometry(0.18, 24, 16);
      this.ringGeo = new THREE.TorusGeometry(0.27, 0.035, 8, 32);
      this.rocketBody = new THREE.CapsuleGeometry(0.11, 0.32, 6, 16);
      this.rocketNose = new THREE.ConeGeometry(0.11, 0.2, 16);
      this.rocketFin = new THREE.ConeGeometry(0.07, 0.16, 8);
      this.rocketWin = new THREE.SphereGeometry(0.055, 12, 10);
      this.rocketFlame = new THREE.ConeGeometry(0.07, 0.18, 12);
      this.mats = new Map();
    }

    mat(color, extra = {}) {
      const key = color + JSON.stringify(extra);
      if (!this.mats.has(key)) this.mats.set(key, toyMaterial(color, { emissive: color, emissiveIntensity: 0.18, ...extra }));
      return this.mats.get(key);
    }

    star(color = '#ffd23f') {
      const m = new THREE.Mesh(this.starGeo, this.mat(color));
      return wrap(m, 'star');
    }

    planet(color = '#5ec8ff', ringColor = '#ffffff') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.planetGeo, this.mat(color)));
      const ring = new THREE.Mesh(this.ringGeo, this.mat(ringColor));
      ring.rotation.x = Math.PI / 2 - 0.4;
      ring.scale.z = 0.5;
      g.add(ring);
      return wrap(g, 'planet');
    }

    rocket(color = '#ff6fb5') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.rocketBody, this.mat('#f4f7ff'));
      const nose = new THREE.Mesh(this.rocketNose, this.mat(color));
      nose.position.y = 0.3;
      const win = new THREE.Mesh(this.rocketWin, this.mat('#5ec8ff'));
      win.position.set(0, 0.07, 0.1);
      const finL = new THREE.Mesh(this.rocketFin, this.mat(color));
      finL.position.set(-0.13, -0.16, 0);
      finL.rotation.z = 0.5;
      const finR = finL.clone();
      finR.position.x = 0.13;
      finR.rotation.z = -0.5;
      const flame = new THREE.Mesh(this.rocketFlame, new THREE.MeshBasicMaterial({ color: '#ffb03b' }));
      flame.rotation.x = Math.PI;
      flame.position.y = -0.33;
      g.add(body, nose, win, finL, finR, flame);
      return wrap(g, 'rocket');
    }
  }

  /** Envuelve un objeto para animar escala/posición sin pisar su rotación interna. */
  function wrap(inner, kind) {
    const holder = new THREE.Group();
    holder.add(inner);
    holder.userData = { kind, inner, spin: 0.6 + Math.random() * 0.6 };
    holder.scale.setScalar(0.001);
    return holder;
  }

  // -----------------------------------------------------------------------------
  // Distribuciones (posiciones de los objetos)
  // -----------------------------------------------------------------------------

  /** Rejilla centrada de n elementos con `cols` columnas. */
  function grid(n, cols, sx, sy = sx) {
    const pts = [];
    const rows = Math.ceil(n / cols);
    const usedCols = Math.min(n, cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      pts.push(new THREE.Vector3((c - (usedCols - 1) / 2) * sx, ((rows - 1) / 2 - r) * sy, 0));
    }
    return { pts, w: Math.max(0, usedCols - 1) * sx + sx, h: Math.max(0, rows - 1) * sy + sy };
  }

  /**
   * Distribución de decenas (cohetes) y unidades (estrellas).
   * Cohetes a la izquierda y estrellas a la derecha (o arriba/abajo si es vertical).
   */
  function tensLayout(nR, nS, stacked) {
    const S = HELPER_CONFIG.SPACING;
    const R = grid(nR, 5, 0.42, 0.95);
    const U = grid(nS, 5, S);
    const gap = 0.45;
    const rockets = [], stars = [];
    let w, h;
    if (stacked || nR === 0 || nS === 0) {
      // Uno encima del otro
      const hR = nR ? R.h : 0, hS = nS ? U.h : 0;
      h = hR + hS + (nR && nS ? gap : 0);
      const topR = h / 2 - hR / 2;
      const topS = -h / 2 + hS / 2;
      R.pts.forEach((p) => rockets.push(p.clone().setY(p.y + topR)));
      U.pts.forEach((p) => stars.push(p.clone().setY(p.y + topS)));
      w = Math.max(nR ? R.w : 0, nS ? U.w : 0);
    } else {
      w = R.w + U.w + gap;
      h = Math.max(R.h, U.h);
      const cxR = -w / 2 + R.w / 2;
      const cxS = w / 2 - U.w / 2;
      R.pts.forEach((p) => rockets.push(p.clone().setX(p.x + cxR)));
      U.pts.forEach((p) => stars.push(p.clone().setX(p.x + cxS)));
    }
    return { rockets, stars, w, h };
  }

  // -----------------------------------------------------------------------------
  // Ayuda visual para contar
  // -----------------------------------------------------------------------------
  class CountingHelper {
    /**
     * @param {import('./scene.js').SpaceScene} space
     * @param {object} audio  gestor de audio (pop, count, magic, flyAway...)
     */
    constructor(space, audio) {
      this.space = space;
      this.audio = audio;
      this.tw = new Tweener();
      this.proto = new Prototypes();
      this.root = new THREE.Group();
      this.root.visible = false;
      space.camera.add(this.root);
      this.items = [];
      this.labels = [];
      this.panel = null;
      this.runId = 0;
      this.active = false;
    }

    /** Medidas visibles (en unidades 3D) a la distancia de la ayuda. */
    view() {
      const cam = this.space.camera;
      const hh = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * HELPER_CONFIG.DISTANCE;
      return { hh, hw: hh * cam.aspect, portrait: cam.aspect < 0.9 };
    }

    /** Espera teniendo en cuenta la velocidad configurada. */
    wait(s) { return this.tw.wait(s / HELPER_CONFIG.SPEED); }
    dur(s) { return s / HELPER_CONFIG.SPEED; }

    /** Prepara el contenedor: lo escala para que quepa y dibuja el panel de fondo. */
    prepare(contentW, contentH) {
      this.clear();
      const v = this.view();
      // Zona disponible: centro de la pantalla (entre la operación y los botones)
      const labelSpace = 1.1;                 // espacio extra arriba para las etiquetas
      const pw = contentW + 0.9;
      const ph = contentH + labelSpace + 0.5;
      const availW = v.hw * 2 * 0.88;
      const availH = v.hh * 2 * (v.portrait ? 0.42 : 0.37);
      const scale = Math.min(1.5, availW / pw, availH / ph);
      this.root.scale.setScalar(scale);
      // Centramos el panel (contenido + etiquetas) un poco por debajo del centro en
      // horizontal, y algo por encima en vertical (los botones ocupan más abajo).
      const panelCenterY = labelSpace / 2;
      const targetY = v.hh * (v.portrait ? 0.09 : -0.04);
      this.root.position.set(0, targetY - panelCenterY * scale, -HELPER_CONFIG.DISTANCE);
      this.root.visible = true;

      // Panel redondeado semitransparente para que la ayuda destaque sobre la escena
      const r = 0.45;
      const shape = new THREE.Shape();
      shape.moveTo(-pw / 2 + r, -ph / 2);
      shape.lineTo(pw / 2 - r, -ph / 2);
      shape.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + r);
      shape.lineTo(pw / 2, ph / 2 - r);
      shape.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - r, ph / 2);
      shape.lineTo(-pw / 2 + r, ph / 2);
      shape.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - r);
      shape.lineTo(-pw / 2, -ph / 2 + r);
      shape.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + r, -ph / 2);
      this.panel = new THREE.Mesh(
        new THREE.ShapeGeometry(shape, 8),
        new THREE.MeshBasicMaterial({ color: '#1b1f4a', transparent: true, opacity: 0.86, depthWrite: false })
      );
      this.panel.position.set(0, panelCenterY, -0.6);
      this.panel.renderOrder = -1;
      this.root.add(this.panel);
      this.contentTop = contentH / 2;
      return ++this.runId;
    }

    /** ¿Sigue vigente la secuencia (no se ha cancelado)? */
    alive(id) { return this.active && id === this.runId; }

    /** Añade un objeto que aparece con un pequeño "pop". */
    spawn(obj, pos, delay = 0, index = 0) {
      obj.position.copy(pos);
      this.root.add(obj);
      this.items.push(obj);
      const base = obj.userData.baseScale || 1;
      this.tw.to(obj.scale, { x: base, y: base, z: base }, { duration: this.dur(0.35), delay: this.dur(delay), ease: Ease.outBack });
      const id = this.runId;
      this.tw.wait(this.dur(delay)).then(() => this.alive(id) && this.audio.pop(index));
      return obj;
    }

    addLabel(text, pos, opts) {
      const label = makeLabel(text, opts);
      label.position.copy(pos);
      label.material.opacity = 0;
      this.root.add(label);
      this.labels.push(label);
      this.tw.to(label.material, { opacity: 1 }, { duration: this.dur(0.3) });
      return label;
    }

    fadeLabel(label) {
      return this.tw.to(label.material, { opacity: 0 }, { duration: this.dur(0.3) });
    }

    /** Mueve los objetos a sus nuevas posiciones. */
    moveAll(objs, positions, duration = 0.9, stagger = 0.02) {
      const ps = objs.map((o, i) =>
        this.tw.to(o.position, { x: positions[i].x, y: positions[i].y, z: positions[i].z },
          { duration: this.dur(duration), delay: this.dur(i * stagger), ease: Ease.inOut }));
      return Promise.all(ps);
    }

    /** Hace salir volando (y desaparecer) un objeto. */
    flyAway(obj, delay = 0) {
      const dir = (Math.random() - 0.5) * 2;
      this.tw.to(obj.position, { x: obj.position.x + dir, y: obj.position.y + 3.5, z: obj.position.z + 1 },
        { duration: this.dur(1.1), delay: this.dur(delay), ease: Ease.in });
      this.tw.to(obj.rotation, { z: dir * 4 }, { duration: this.dur(1.1), delay: this.dur(delay) });
      return this.tw.to(obj.scale, { x: 0.001, y: 0.001, z: 0.001 }, { duration: this.dur(0.6), delay: this.dur(delay + 0.5) });
    }

    /** Cuenta los objetos en voz "visual": cada uno da un saltito y muestra su número. */
    async countObjects(objs, valueOf, counter, id) {
      const n = objs.length;
      const step = Math.min(0.5, Math.max(0.22, 5.5 / Math.max(n, 1)));
      for (let i = 0; i < n; i++) {
        if (!this.alive(id)) return;
        const o = objs[i];
        const value = valueOf(i);
        // Saltito del objeto
        const base = o.userData.baseScale || 1;
        this.tw.to(o.scale, { x: base * 1.45, y: base * 1.45, z: base * 1.45 }, { duration: this.dur(0.12), ease: Ease.out })
          .then(() => this.tw.to(o.scale, { x: base, y: base, z: base }, { duration: this.dur(0.25), ease: Ease.out }));
        // Número flotante sobre el objeto
        const tag = makeLabel(String(value), { color: '#fff27a', height: 0.36 });
        tag.position.set(o.position.x, o.position.y + 0.42, o.position.z + 0.3);
        this.root.add(tag);
        this.labels.push(tag);
        this.tw.to(tag.position, { y: tag.position.y + 0.35 }, { duration: this.dur(0.8), ease: Ease.out });
        this.tw.to(tag.material, { opacity: 0 }, { duration: this.dur(0.4), delay: this.dur(0.45) });
        counter.userData.setText(String(value));
        this.audio.count(i);
        await this.wait(step);
      }
    }

    /** Muestra la ayuda adecuada para la operación. Devuelve una promesa que termina al acabar. */
    async show({ a, b, op, result }) {
      this.active = true;
      const big = Math.max(a, b, result) > HELPER_CONFIG.TENS_THRESHOLD;
      try {
        if (op === '+') await (big ? this.additionTens(a, b) : this.additionSimple(a, b));
        else await (big ? this.subtractionTens(a, b) : this.subtractionSimple(a, b));
      } catch (e) {
        console.warn('Ayuda visual interrumpida', e);
      }
    }

    // --- Sumas hasta 20: dos grupos (estrellas y planetitas) que se juntan --------
    async additionSimple(a, b) {
      const S = HELPER_CONFIG.SPACING;
      const v = this.view();
      const stacked = v.portrait;
      const cols = HELPER_CONFIG.COLS;
      const gA = grid(a, cols, S), gB = grid(b, cols, S), gT = grid(a + b, cols, S);
      const gap = 1.1;
      let offA, offB, contentW, contentH;
      if (stacked) {
        contentW = Math.max(gA.w, gB.w, gT.w);
        contentH = gA.h + gB.h + gap;
        offA = new THREE.Vector3(0, contentH / 2 - gA.h / 2, 0);
        offB = new THREE.Vector3(0, -contentH / 2 + gB.h / 2, 0);
      } else {
        contentW = gA.w + gB.w + gap;
        contentH = Math.max(gA.h, gB.h, gT.h);
        offA = new THREE.Vector3(-contentW / 2 + gA.w / 2, 0, 0);
        offB = new THREE.Vector3(contentW / 2 - gB.w / 2, 0, 0);
      }
      const id = this.prepare(contentW, contentH);
      const top = contentH / 2 + 0.55;

      // Grupo A: estrellas
      const A = gA.pts.map((p, i) => this.spawn(this.proto.star('#ffd23f'), p.clone().add(offA), i * 0.09, i));
      const labelA = this.addLabel(String(a), stacked ? new THREE.Vector3(-contentW / 2 - 0.1, offA.y, 0.2) : new THREE.Vector3(offA.x, top, 0.2), { color: '#ffd23f', height: 0.6 });
      if (stacked) labelA.scale.multiplyScalar(0.8);
      await this.wait(a * 0.09 + 0.6);
      if (!this.alive(id)) return;

      // Signo "+" y grupo B: planetitas
      const plus = this.addLabel('+', stacked ? new THREE.Vector3(0, (offA.y - gA.h / 2 + offB.y + gB.h / 2) / 2, 0.2) : new THREE.Vector3((offA.x + gA.w / 2 + offB.x - gB.w / 2) / 2, 0, 0.2), { color: '#ffffff', height: 0.7 });
      const B = gB.pts.map((p, i) => this.spawn(this.proto.planet('#5ec8ff', '#ffffff'), p.clone().add(offB), i * 0.09, i + a));
      const labelB = this.addLabel(String(b), stacked ? new THREE.Vector3(-contentW / 2 - 0.1, offB.y, 0.2) : new THREE.Vector3(offB.x, top, 0.2), { color: '#7fe3ff', height: 0.6 });
      if (stacked) labelB.scale.multiplyScalar(0.8);
      await this.wait(b * 0.09 + 1.0);
      if (!this.alive(id)) return;

      // ¡Se juntan!
      [labelA, labelB, plus].forEach((l) => this.fadeLabel(l));
      this.audio.whoosh();
      const all = [...A, ...B];
      await this.moveAll(all, gT.pts, 1.0, 0.025);
      if (!this.alive(id)) return;

      // Contamos juntos
      const counter = this.addLabel('0', new THREE.Vector3(0, gT.h / 2 + 0.6, 0.2), { color: '#ffffff', height: 0.75 });
      await this.wait(0.3);
      await this.countObjects(all, (i) => i + 1, counter, id);
      if (!this.alive(id)) return;
      this.finish(counter, a + b);
    }

    // --- Restas hasta 20: el grupo inicial y los que se van volando ---------------
    async subtractionSimple(a, b) {
      const S = HELPER_CONFIG.SPACING;
      const cols = HELPER_CONFIG.COLS;
      const gA = grid(a, cols, S);
      const result = a - b;
      const gR = grid(Math.max(result, 1), cols, S);
      const id = this.prepare(gA.w + 1.2, gA.h);

      const A = gA.pts.map((p, i) => this.spawn(this.proto.star('#ffd23f'), p, i * 0.08, i));
      const labelA = this.addLabel(String(a), new THREE.Vector3(0, gA.h / 2 + 0.55, 0.2), { color: '#ffd23f', height: 0.6 });
      await this.wait(a * 0.08 + 0.8);
      if (!this.alive(id)) return;

      // Marcamos los que se van (los últimos b)
      const leaving = A.slice(result);
      const staying = A.slice(0, result);
      labelA.userData.setText(`${a} − ${b}`);
      leaving.forEach((o) => {
        o.userData.inner.children.length === 0 && (o.userData.inner.material = this.proto.mat('#ff9eb5'));
        this.tw.to(o.rotation, { z: 0.4 }, { duration: this.dur(0.15) })
          .then(() => this.tw.to(o.rotation, { z: -0.4 }, { duration: this.dur(0.3) }))
          .then(() => this.tw.to(o.rotation, { z: 0 }, { duration: this.dur(0.15) }));
      });
      await this.wait(0.9);
      if (!this.alive(id)) return;

      // ¡Se van volando!
      this.audio.flyAway();
      leaving.forEach((o, i) => this.flyAway(o, i * 0.08));
      await this.wait(1.2 + b * 0.08);
      if (!this.alive(id)) return;
      this.fadeLabel(labelA);

      // Ordenamos los que quedan y contamos
      if (result > 0) await this.moveAll(staying, gR.pts, 0.7, 0.02);
      const counter = this.addLabel('0', new THREE.Vector3(0, gA.h / 2 + 0.55, 0.2), { color: '#ffffff', height: 0.75 });
      await this.wait(0.3);
      await this.countObjects(staying, (i) => i + 1, counter, id);
      if (!this.alive(id)) return;
      this.finish(counter, result);
    }

    // --- Sumas con decenas: cohetes (10) y estrellas (1) ---------------------------
    async additionTens(a, b) {
      const v = this.view();
      const stacked = v.portrait;
      const [tA, uA, tB, uB] = [Math.floor(a / 10), a % 10, Math.floor(b / 10), b % 10];
      const LA = tensLayout(tA, uA, true), LB = tensLayout(tB, uB, true);
      const tR = tA + tB, tS = uA + uB;
      const regroup = tS >= 10;
      // El grupo final siempre en horizontal (cohetes | estrellas): cabe mejor en pantalla
      const LT = tensLayout(tR, tS, false);
      const LF = tensLayout(tR + (regroup ? 1 : 0), regroup ? tS - 10 : tS, false);

      const gap = 1.1;
      let offA, offB, contentW, contentH;
      if (stacked) {
        contentW = Math.max(LA.w, LB.w, LT.w, LF.w);
        contentH = Math.max(LA.h + LB.h + gap, LT.h, LF.h);
        offA = new THREE.Vector3(0, contentH / 2 - LA.h / 2, 0);
        offB = new THREE.Vector3(0, -contentH / 2 + LB.h / 2, 0);
      } else {
        contentW = Math.max(LA.w + LB.w + gap, LT.w, LF.w);
        contentH = Math.max(LA.h, LB.h, LT.h, LF.h);
        offA = new THREE.Vector3(-(LA.w + LB.w + gap) / 2 + LA.w / 2, 0, 0);
        offB = new THREE.Vector3((LA.w + LB.w + gap) / 2 - LB.w / 2, 0, 0);
      }
      const id = this.prepare(contentW, contentH);
      const top = contentH / 2 + 0.55;

      let k = 0;
      const rA = LA.rockets.map((p, i) => this.spawn(this.proto.rocket('#ff6fb5'), p.clone().add(offA), (k++) * 0.1, i));
      const sA = LA.stars.map((p, i) => this.spawn(this.proto.star('#ffd23f'), p.clone().add(offA), (k++) * 0.07, i));
      const labelA = this.addLabel(String(a), stacked ? new THREE.Vector3(-contentW / 2 - 0.2, offA.y, 0.2) : new THREE.Vector3(offA.x, top, 0.2), { color: '#ffd23f', height: 0.6 });
      await this.wait(k * 0.08 + 0.7);
      if (!this.alive(id)) return;

      k = 0;
      const plus = this.addLabel('+', stacked ? new THREE.Vector3(0, (offA.y - LA.h / 2 + offB.y + LB.h / 2) / 2, 0.2) : new THREE.Vector3((offA.x + LA.w / 2 + offB.x - LB.w / 2) / 2, 0, 0.2), { height: 0.7 });
      const rB = LB.rockets.map((p, i) => this.spawn(this.proto.rocket('#9b7bff'), p.clone().add(offB), (k++) * 0.1, i));
      const sB = LB.stars.map((p, i) => this.spawn(this.proto.star('#7fe3ff'), p.clone().add(offB), (k++) * 0.07, i));
      const labelB = this.addLabel(String(b), stacked ? new THREE.Vector3(-contentW / 2 - 0.2, offB.y, 0.2) : new THREE.Vector3(offB.x, top, 0.2), { color: '#7fe3ff', height: 0.6 });
      await this.wait(k * 0.08 + 1.0);
      if (!this.alive(id)) return;

      // Juntamos cohetes con cohetes y estrellas con estrellas
      [labelA, labelB, plus].forEach((l) => this.fadeLabel(l));
      this.audio.whoosh();
      let rockets = [...rA, ...rB];
      let stars = [...sA, ...sB];
      await Promise.all([this.moveAll(rockets, LT.rockets, 1.0), this.moveAll(stars, LT.stars, 1.0)]);
      if (!this.alive(id)) return;

      // Si hay 10 estrellas o más, ¡10 estrellas se convierten en un cohete!
      if (regroup) {
        const ten = stars.slice(stars.length - 10);
        stars = stars.slice(0, stars.length - 10);
        const target = LF.rockets[LF.rockets.length - 1];
        ten.forEach((s) => this.tw.to(s.userData.inner.scale, { x: 1.4, y: 1.4, z: 1.4 }, { duration: this.dur(0.3) }));
        await this.wait(0.5);
        this.audio.magic();
        await this.moveAll(ten, ten.map(() => target), 0.8, 0.03);
        ten.forEach((s) => this.tw.to(s.scale, { x: 0.001, y: 0.001, z: 0.001 }, { duration: this.dur(0.2) }));
        const newRocket = this.spawn(this.proto.rocket('#ffd23f'), target, 0.1, 0);
        rockets.push(newRocket);
        await this.wait(0.5);
        await Promise.all([this.moveAll(rockets.slice(0, -1), LF.rockets, 0.6), this.moveAll(stars, LF.stars, 0.6)]);
        if (!this.alive(id)) return;
      }

      // Contamos de 10 en 10 y luego de 1 en 1
      const counter = this.addLabel('0', new THREE.Vector3(0, contentH / 2 + 0.55, 0.2), { color: '#ffffff', height: 0.75 });
      await this.wait(0.3);
      const tens = rockets.length * 10;
      await this.countObjects(rockets, (i) => (i + 1) * 10, counter, id);
      await this.countObjects(stars, (i) => tens + i + 1, counter, id);
      if (!this.alive(id)) return;
      this.finish(counter, a + b);
    }

    // --- Restas con decenas -----------------------------------------------------
    async subtractionTens(a, b) {
      const stacked = false; // cohetes | estrellas, uno al lado del otro
      let [tA, uA] = [Math.floor(a / 10), a % 10];
      const [tB, uB] = [Math.floor(b / 10), b % 10];
      const borrow = uA < uB;
      const L0 = tensLayout(tA, uA, stacked);
      const L1 = borrow ? tensLayout(tA - 1, uA + 10, stacked) : L0;
      const result = a - b;
      const LR = tensLayout(Math.floor(result / 10), result % 10, stacked);
      const contentW = Math.max(L0.w, L1.w, LR.w) + 1.0;
      const contentH = Math.max(L0.h, L1.h, LR.h);
      const id = this.prepare(contentW, contentH);
      const top = contentH / 2 + 0.55;

      let k = 0;
      let rockets = L0.rockets.map((p, i) => this.spawn(this.proto.rocket('#ff6fb5'), p, (k++) * 0.1, i));
      let stars = L0.stars.map((p, i) => this.spawn(this.proto.star('#ffd23f'), p, (k++) * 0.07, i));
      const label = this.addLabel(String(a), new THREE.Vector3(0, top, 0.2), { color: '#ffd23f', height: 0.6 });
      await this.wait(k * 0.08 + 0.8);
      if (!this.alive(id)) return;
      label.userData.setText(`${a} − ${b}`);

      // Si no hay estrellas suficientes, rompemos un cohete en 10 estrellas
      if (borrow) {
        const rk = rockets.pop();
        this.tw.to(rk.rotation, { z: Math.PI * 2 }, { duration: this.dur(0.6) });
        await this.tw.to(rk.scale, { x: 0.001, y: 0.001, z: 0.001 }, { duration: this.dur(0.6), ease: Ease.in });
        this.audio.magic();
        const from = rk.position.clone();
        await Promise.all([this.moveAll(rockets, L1.rockets, 0.5), this.moveAll(stars, L1.stars.slice(0, stars.length), 0.5)]);
        for (let i = 0; i < 10; i++) {
          const s = this.spawn(this.proto.star('#ffe27a'), from, i * 0.05, i);
          stars.push(s);
          this.tw.to(s.position, { x: L1.stars[uA + i].x, y: L1.stars[uA + i].y, z: 0 }, { duration: this.dur(0.7), delay: this.dur(i * 0.05), ease: Ease.out });
        }
        tA -= 1;
        await this.wait(1.4);
        if (!this.alive(id)) return;
      }

      // Quitamos decenas y unidades: ¡salen volando!
      const goneR = rockets.slice(rockets.length - tB);
      const goneS = stars.slice(stars.length - uB);
      rockets = rockets.slice(0, rockets.length - tB);
      stars = stars.slice(0, stars.length - uB);
      this.audio.flyAway();
      [...goneR, ...goneS].forEach((o, i) => this.flyAway(o, i * 0.07));
      await this.wait(1.3 + (tB + uB) * 0.07);
      if (!this.alive(id)) return;
      this.fadeLabel(label);

      await Promise.all([this.moveAll(rockets, LR.rockets, 0.6), this.moveAll(stars, LR.stars, 0.6)]);
      const counter = this.addLabel('0', new THREE.Vector3(0, top, 0.2), { color: '#ffffff', height: 0.75 });
      await this.wait(0.3);
      const tens = rockets.length * 10;
      await this.countObjects(rockets, (i) => (i + 1) * 10, counter, id);
      await this.countObjects(stars, (i) => tens + i + 1, counter, id);
      if (!this.alive(id)) return;
      this.finish(counter, result);
    }

    /** Remate: el número final se hace grande y brilla. */
    finish(counter, value) {
      counter.userData.setText(String(value), '#7dffb0');
      const h = counter.userData.baseHeight;
      this.tw.to(counter.scale, { x: h * 1.35 * (512 / 192), y: h * 1.35 }, { duration: this.dur(0.35), ease: Ease.outBack });
      this.audio.magic();
    }

    /** Oculta la ayuda con una animación corta. */
    async hide() {
      if (!this.root.visible) return;
      this.active = false;
      this.runId++;
      const s = this.root.scale.x;
      await this.tw.to(this.root.scale, { x: s * 0.01, y: s * 0.01, z: s * 0.01 }, { duration: 0.25, ease: Ease.in });
      this.clear();
    }

    /** Elimina todos los objetos de la ayuda. */
    clear() {
      this.tw.clear();
      for (const o of this.items) this.root.remove(o);
      for (const l of this.labels) {
        this.root.remove(l);
        l.material.map.dispose();
        l.material.dispose();
      }
      if (this.panel) {
        this.root.remove(this.panel);
        this.panel.geometry.dispose();
        this.panel.material.dispose();
        this.panel = null;
      }
      this.items = [];
      this.labels = [];
      this.root.visible = false;
    }

    update(dt) {
      this.tw.update(dt);
      // Las estrellas y planetitas giran suavemente
      for (const o of this.items) {
        // Balanceo suave (sin girar del todo, para que se vean siempre de frente)
        o.userData.phase = (o.userData.phase || Math.random() * 6) + dt * o.userData.spin * 2;
        o.userData.inner.rotation.y = Math.sin(o.userData.phase) * (o.userData.kind === 'planet' ? 0.8 : 0.45);
      }
    }
  }

  // -----------------------------------------------------------------------------
  // Celebración: confeti y estrellas 3D
  // -----------------------------------------------------------------------------
  class Celebration {
    constructor(scene) {
      this.scene = scene;
      this.particles = [];
      this.starGeo = makeStarGeometry(0.16, 0.075);
      this.boxGeo = new THREE.BoxGeometry(0.14, 0.14, 0.04);
      this.ballGeo = new THREE.SphereGeometry(0.07, 10, 8);
      this.ringGeo = new THREE.TorusGeometry(1, 0.05, 8, 48);
      this.colors = ['#ffd23f', '#ff6fb5', '#5ec8ff', '#4fe3c1', '#9b7bff', '#ff8a5c'];
      this.mats = this.colors.map((c) => toyMaterial(c, { emissive: c, emissiveIntensity: 0.35 }));
      this.rings = [];
    }

    /**
     * Lanza una explosión de confeti en un punto.
     * @param {THREE.Vector3} center
     * @param {number} amount número de partículas
     */
    burst(center, amount = 70) {
      for (let i = 0; i < amount; i++) {
        const r = Math.random();
        const geo = r < 0.45 ? this.starGeo : r < 0.8 ? this.boxGeo : this.ballGeo;
        const mesh = new THREE.Mesh(geo, this.mats[i % this.mats.length]);
        mesh.position.copy(center);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, (Math.random() - 0.5) * 0.8).normalize();
        const speed = 3 + Math.random() * 4;
        mesh.userData = {
          vel: dir.multiplyScalar(speed),
          spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
          life: 1.6 + Math.random() * 1.0,
          age: 0,
          scale: 0.8 + Math.random() * 0.7,
        };
        mesh.scale.setScalar(mesh.userData.scale);
        this.scene.add(mesh);
        this.particles.push(mesh);
      }
      // Onda expansiva
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.9, depthWrite: false }));
      ring.position.copy(center);
      ring.scale.setScalar(0.2);
      ring.userData = { age: 0 };
      this.scene.add(ring);
      this.rings.push(ring);
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        const u = p.userData;
        u.age += dt;
        u.vel.y -= 5.5 * dt;            // gravedad suave
        u.vel.multiplyScalar(1 - dt * 0.6); // rozamiento
        p.position.addScaledVector(u.vel, dt);
        p.rotation.x += u.spin.x * dt;
        p.rotation.y += u.spin.y * dt;
        p.rotation.z += u.spin.z * dt;
        const fade = 1 - Math.max(0, (u.age - u.life * 0.6) / (u.life * 0.4));
        p.scale.setScalar(u.scale * Math.max(0.001, fade));
        if (u.age >= u.life) {
          this.scene.remove(p);
          this.particles.splice(i, 1);
        }
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.userData.age += dt;
        const t = r.userData.age / 0.8;
        r.scale.setScalar(0.2 + t * 2.5);
        r.material.opacity = Math.max(0, 0.9 * (1 - t));
        if (t >= 1) {
          this.scene.remove(r);
          r.material.dispose();
          this.rings.splice(i, 1);
        }
      }
    }
  }

  Object.assign(window.AstroSumas, { HELPER_CONFIG, Ease, Tweener, CountingHelper, Celebration });
})();
