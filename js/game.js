/**
 * game.js
 * ------------------------------------------------------------
 * Estado de la partida y flujo de preguntas:
 * pregunta -> respuesta -> (celebración | ayuda + reintento) -> avance -> planeta.
 */
(function () {
  'use strict';
  const { DifficultyManager, generateOptions, DIFFICULTY_CONFIG, PLANETS, Tweener } = window.AstroSumas;

  /** Ajustes generales de la partida. */
  const GAME_CONFIG = {
    CORRECT_PER_PLANET: 4,     // aciertos necesarios para llegar al siguiente planeta
    CELEBRATION_TIME: 1.7,     // segundos de celebración tras acertar
    ARRIVAL_TIME: 3.0,         // segundos que dura la llegada a un planeta
  };

  /** Mensajes (frases cortas y cálidas). */
  const MESSAGES = {
    correct: ['¡Genial!', '¡Eres un crack!', '¡Despegamos!', '¡Muy bien!', '¡Fantástico!', '¡Súper!',
      '¡Lo has clavado!', '¡Increíble!', '¡Bravo, astronauta!', '¡Así se hace!'],
    correctAfterHelp: ['¡Muy bien! ¡Lo has contado!', '¡Eso es! ¡Genial!', '¡Lo conseguiste!'],
    levelUp: ['¡Vas como un cohete! Ahora, un reto mayor', '¡Qué bien lo haces! Subimos un poquito'],
    wrong: ['¡Casi! Vamos a contarlo juntos', '¡Por poquito! Contemos juntos', '¡Buen intento! Lo contamos juntos'],
    wrongAgain: ['¡Tranquilo! Lo miramos otra vez', '¡No pasa nada! Contemos de nuevo'],
    retry: ['¡Ahora tú! ¿Cuánto es?', '¡Tu turno! ¿Cuál es?'],
    first: '¡Despegamos! Resuelve para avanzar',
  };

  class Game {
    /**
     * @param {object} deps  ui, space (escena), helper (ayuda 3D), celebration, audio
     */
    constructor({ ui, space, helper, celebration, audio }) {
      this.ui = ui;
      this.space = space;
      this.helper = helper;
      this.celebration = celebration;
      this.audio = audio;
      this.difficulty = new DifficultyManager();
      this.timer = new Tweener();   // esperas en "tiempo de juego" (se congelan en la pausa)
      this.session = 0;             // invalida secuencias antiguas al reiniciar
      this.state = 'idle';
      this.paused = false;
    }

    /** Espera en tiempo de juego. */
    delay(s) { return this.timer.wait(s); }

    /** Empieza una partida nueva desde cero (no se guarda progreso). */
    async start() {
      const id = ++this.session;
      this.timer.clear();
      this.helper.clear();
      this.difficulty.reset();
      this.planetIndex = 0;
      this.progress = 0;
      this.totalStars = 0;
      this.paused = false;
      this.state = 'traveling';

      this.ui.setDestination(PLANETS[0], 0, PLANETS.length);
      this.ui.setProgress(0, GAME_CONFIG.CORRECT_PER_PLANET);
      this.ui.showAnswers(false);
      this.ui.clearQuestion();
      this.space.departTo(PLANETS[0]);
      this.audio.whoosh();
      this.ui.say(MESSAGES.first, 'cheer', 2200);
      await this.delay(1.6);
      if (id !== this.session) return;
      this.nextQuestion();
    }

    /** Detiene la partida (al volver al inicio). */
    stop() {
      this.session++;
      this.timer.clear();
      this.helper.clear();
      this.state = 'idle';
      this.paused = false;
      this.ui.hideFeedback();
      this.ui.hideBanner();
    }

    /** Prepara y muestra una nueva operación. */
    nextQuestion() {
      this.operation = this.difficulty.nextOperation();
      this.assisted = false;
      this.helpCount = 0;
      this.state = 'question';
      this.ui.setQuestion(this.operation);
      this.ui.setOptions(generateOptions(this.operation.result, DIFFICULTY_CONFIG.NUM_OPTIONS), (v) => this.answer(v));
    }

    /** El niño ha pulsado una respuesta. */
    answer(value) {
      if (this.state !== 'question' || this.paused) return;
      this.audio.click();
      if (value === this.operation.result) this.onCorrect(value);
      else this.onWrong(value);
    }

    async onCorrect(value) {
      const id = this.session;
      this.state = 'celebrating';
      this.ui.setAnswersEnabled(false);
      this.ui.markCorrect(value);
      this.ui.setQuestion(this.operation, true);
      this.helper.hide();

      const { levelChange } = this.difficulty.registerAnswer(true, { assisted: this.assisted });
      this.progress++;
      this.totalStars++;

      // Celebración: sonido, salto con pirueta, impulso y confeti 3D
      this.audio.correct();
      this.audio.whoosh();
      this.space.jump();
      this.space.boost();
      this.space.setProgress(this.progress / GAME_CONFIG.CORRECT_PER_PLANET);
      this.celebration.burst(this.space.getShipWorldPosition().add({ x: 0.3, y: 0.6, z: 0.5 }), 80);
      this.ui.setProgress(this.progress, GAME_CONFIG.CORRECT_PER_PLANET);
      if (levelChange > 0) this.ui.say(MESSAGES.levelUp, 'wow');
      else this.ui.say(this.assisted ? MESSAGES.correctAfterHelp : MESSAGES.correct, 'cheer');

      await this.delay(GAME_CONFIG.CELEBRATION_TIME);
      if (id !== this.session) return;
      this.ui.hideFeedback();

      if (this.progress >= GAME_CONFIG.CORRECT_PER_PLANET) await this.arrive(id);
      else this.nextQuestion();
    }

    async onWrong(value) {
      const id = this.session;
      this.state = 'helping';
      this.helpCount++;
      this.difficulty.registerAnswer(false);
      this.ui.setAnswersEnabled(false);
      this.ui.markWrong(value);
      this.audio.wrong();
      this.space.think();
      this.ui.say(this.helpCount > 1 ? MESSAGES.wrongAgain : MESSAGES.wrong, 'encourage');

      await this.delay(1.3);
      if (id !== this.session) return;
      this.ui.markTried(value);
      this.ui.showAnswers(false);
      this.ui.hideFeedback();

      // Ayuda visual en 3D para contar
      await this.helper.show(this.operation);
      if (id !== this.session) return;
      await this.delay(0.6);
      if (id !== this.session) return;

      // Reintento de la MISMA operación
      this.assisted = true;
      this.state = 'question';
      this.ui.say(MESSAGES.retry, 'happy');
      this.ui.showAnswers(true);
      this.ui.setAnswersEnabled(true);
    }

    /** Llegada a un planeta y paso al siguiente tramo del viaje. */
    async arrive(id) {
      this.state = 'arriving';
      const planet = PLANETS[this.planetIndex];
      this.ui.showAnswers(false);
      this.audio.arrive();
      this.ui.showBanner(`<small>¡Llegamos al</small>${planet.name}!`, GAME_CONFIG.ARRIVAL_TIME * 1000);
      this.ui.say('¡Hola, planeta nuevo!', 'wow');
      this.space.jump();
      if (this.space.planet) this.celebration.burst(this.space.planet.position.clone(), 110);
      await this.delay(GAME_CONFIG.ARRIVAL_TIME);
      if (id !== this.session) return;
      this.ui.hideFeedback();

      this.planetIndex++;
      if (this.planetIndex >= PLANETS.length) {
        this.victory();
        return;
      }
      // Siguiente destino
      this.progress = 0;
      this.state = 'traveling';
      const next = PLANETS[this.planetIndex];
      this.ui.setDestination(next, this.planetIndex, PLANETS.length);
      this.ui.setProgress(0, GAME_CONFIG.CORRECT_PER_PLANET);
      this.ui.clearQuestion();
      this.space.departTo(next);
      this.audio.whoosh();
      this.ui.say(`¡Rumbo al ${next.name}!`, 'cheer', 1800);
      await this.delay(1.6);
      if (id !== this.session) return;
      this.nextQuestion();
    }

    victory() {
      this.state = 'victory';
      this.audio.arrive();
      const ship = this.space.getShipWorldPosition();
      this.celebration.burst(ship.clone().add({ x: 0, y: 1, z: 0 }), 120);
      this.ui.showVictory({ planets: PLANETS.length, stars: this.totalStars });
    }

    pause() {
      if (this.paused || this.state === 'idle' || this.state === 'victory') return;
      this.paused = true;
      this.audio.duckMusic(true);
      this.ui.showOverlay('pause');
    }

    resume() {
      if (!this.paused) return;
      this.paused = false;
      this.audio.duckMusic(false);
      this.ui.showOverlay(null);
    }

    /** Avanza los temporizadores del juego (no se llama durante la pausa). */
    update(dt) {
      this.timer.update(dt);
    }
  }

  Object.assign(window.AstroSumas, { GAME_CONFIG, MESSAGES, Game });
})();
