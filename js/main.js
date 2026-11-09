/**
 * main.js
 * ------------------------------------------------------------
 * Arranque del juego: crea la escena, la interfaz y el estado,
 * conecta los botones y ejecuta el bucle de render.
 */
import { SpaceScene, HOME_PLANET } from './scene.js';
import { CountingHelper, Celebration } from './helpers3d.js';
import { audio } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const ui = new UI();
const canvas = document.getElementById('scene');

// --- Escena 3D (con mensaje amable si el navegador no tiene WebGL) -----------
let space;
try {
  space = new SpaceScene(canvas);
} catch (err) {
  console.error(err);
  document.getElementById('webgl-error').hidden = false;
  document.getElementById('btn-play').disabled = true;
  throw err;
}

const helper = new CountingHelper(space, audio);
const celebration = new Celebration(space.scene);
const game = new Game({ ui, space, helper, celebration, audio });

// Pantalla de inicio: la nave junto a su planeta de casa
space.showPlanetNear(HOME_PLANET);
ui.showScreen('start');

// --- Botones ------------------------------------------------------------------

// Sonido de "pop" en cualquier botón (excepto las respuestas, que lo gestiona el juego)
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('button');
  if (btn && !btn.disabled && !btn.classList.contains('btn-answer')) audio.click();
});

document.getElementById('btn-play').addEventListener('click', () => {
  // El audio sólo puede arrancar tras una interacción del usuario
  audio.init();
  audio.setMuted(audio.muted);
  audio.startMusic();
  ui.showScreen('game');
  space.setMode('game');
  game.start();
});

document.getElementById('btn-sound').addEventListener('click', () => {
  audio.init();
  const muted = audio.toggleMute();
  if (!audio.musicOn && document.body.dataset.screen === 'game') audio.startMusic();
  ui.setMuted(muted);
});

document.getElementById('btn-pause').addEventListener('click', () => game.pause());
document.getElementById('btn-resume').addEventListener('click', () => game.resume());

function goHome() {
  game.stop();
  space.setMode('menu');
  space.showPlanetNear(HOME_PLANET);
  ui.showScreen('start');
}
document.getElementById('btn-home').addEventListener('click', goHome);
document.getElementById('btn-victory-home').addEventListener('click', goHome);
document.getElementById('btn-again').addEventListener('click', () => {
  ui.showOverlay(null);
  game.stop();
  game.start();
});

// --- Teclado (ordenador): 1-4 para responder, Espacio/Escape para pausa -------
document.addEventListener('keydown', (e) => {
  if (document.body.dataset.screen !== 'game') return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    game.paused ? game.resume() : game.pause();
    return;
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 4 && !game.paused) {
    const btn = document.querySelectorAll('#answers .btn-answer')[n - 1];
    if (btn && !btn.disabled) btn.click();
  }
});

// --- Parallax con el puntero ----------------------------------------------------
window.addEventListener('pointermove', (e) => {
  space.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
});

// --- Redimensionado ---------------------------------------------------------------
function onResize() {
  space.resize();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

// --- Pestaña oculta: pausamos el juego y el audio ------------------------------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (document.body.dataset.screen === 'game') game.pause();
    audio.suspend();
  } else {
    audio.resume();
  }
});

// --- Evitar zoom accidental y menús en tablets/móviles --------------------------
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// --- Bucle de render ----------------------------------------------------------------
let last = performance.now();
let time = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // limitamos dt para evitar saltos
  last = now;
  time += dt;

  if (!game.paused) {
    game.update(dt);
    helper.update(dt);
    celebration.update(dt);
  }
  space.update(game.paused ? dt * 0.25 : dt, time);
  space.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Acceso para depuración desde la consola
window.astro = { game, space, helper, ui, audio };
