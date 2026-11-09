/**
 * audio.js
 * ------------------------------------------------------------
 * Música de fondo y efectos de sonido generados con la Web Audio API.
 * No se usa ningún archivo de audio: todo se sintetiza con osciladores.
 *
 * El AudioContext se crea en la primera interacción (botón "¡Jugar!")
 * para respetar las políticas de reproducción automática.
 */
(function () {
  'use strict';

  // Frecuencias de algunas notas (Hz).
  const N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5,
  };

  // Melodía alegre (corcheas). null = silencio. 32 corcheas = 4 compases.
  const MELODY = [
    'E4', 'G4', 'A4', 'G4', 'E4', null, 'C4', 'D4',
    'E4', 'E4', 'D4', 'C4', 'D4', null, null, null,
    'C4', 'E4', 'F4', 'A4', 'C5', 'A4', 'G4', null,
    'G4', 'A4', 'G4', 'E4', 'D4', null, 'G3', null,
  ];
  // Acordes por compás (C - Am - F - G).
  const CHORDS = [
    ['C3', 'E4', 'G4'],
    ['A3', 'C4', 'E4'],
    ['F3', 'A3', 'C4'],
    ['G3', 'B3', 'D4'],
  ];

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.musicOn = false;
      this.tempo = 104;          // pulsaciones por minuto
      this.step = 0;             // corchea actual de la melodía
      this.nextTime = 0;         // momento en el que suena la próxima corchea
      this.timer = null;
    }

    /** Crea el contexto de audio. Llamar dentro de un gesto del usuario. */
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return; // navegador sin Web Audio: el juego funciona sin sonido
      this.ctx = new Ctx();

      // Cadena: música/efectos -> master -> compresor suave -> altavoces
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      // Filtro paso bajo para que la música sea suave y no moleste.
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      this.musicGain.connect(lp).connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
    }

    get ready() {
      return !!this.ctx;
    }

    /** Activa o desactiva todo el sonido. Devuelve el nuevo estado (true = silenciado). */
    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    setMuted(muted) {
      this.muted = muted;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, t, 0.05);
    }

    /** Suspende/reanuda el contexto (por ejemplo, al ocultar la pestaña). */
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

    /** Baja o restaura el volumen de la música (por ejemplo, en la pausa). */
    duckMusic(ducked) {
      if (!this.ctx) return;
      this.musicGain.gain.setTargetAtTime(ducked ? 0.05 : 0.16, this.ctx.currentTime, 0.2);
    }

    // ---------------------------------------------------------------------------
    // Bloques básicos de síntesis
    // ---------------------------------------------------------------------------

    /**
     * Toca una nota con envolvente suave.
     * @param {number} freq  frecuencia en Hz
     * @param {number} time  momento de inicio (ctx.currentTime)
     * @param {number} dur   duración en segundos
     * @param {object} o     opciones: type, vol, dest, attack, slideTo
     */
    tone(freq, time, dur, { type = 'sine', vol = 0.3, dest = this.sfxGain, attack = 0.01, slideTo = null } = {}) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, time + dur);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(vol, time + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(g).connect(dest);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }

    /** Ruido filtrado (para "whoosh" del cohete). */
    noise(time, dur, { vol = 0.2, from = 400, to = 2400 } = {}) {
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(from, time);
      filter.frequency.exponentialRampToValueAtTime(to, time + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(vol, time + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      src.connect(filter).connect(g).connect(this.sfxGain);
      src.start(time);
    }

    // ---------------------------------------------------------------------------
    // Música de fondo (secuenciador sencillo con planificación anticipada)
    // ---------------------------------------------------------------------------

    startMusic() {
      if (!this.ctx || this.musicOn) return;
      this.musicOn = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      // Cada 50 ms programamos las notas de los próximos 200 ms.
      this.timer = setInterval(() => this.scheduleMusic(), 50);
    }

    stopMusic() {
      this.musicOn = false;
      clearInterval(this.timer);
      this.timer = null;
    }

    scheduleMusic() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const eighth = 60 / this.tempo / 2;
      // Si nos hemos quedado atrás (pestaña inactiva), saltamos al presente.
      if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
      while (this.nextTime < this.ctx.currentTime + 0.2) {
        const t = this.nextTime;
        const i = this.step % MELODY.length;
        const bar = Math.floor(i / 8) % CHORDS.length;

        // Melodía: triángulo suave
        const note = MELODY[i];
        if (note) this.tone(N[note], t, eighth * 1.6, { type: 'triangle', vol: 0.32, dest: this.musicGain, attack: 0.02 });

        // Bajo: en las partes fuertes de cada compás
        if (i % 4 === 0) {
          const root = N[CHORDS[bar][0]] / 2;
          this.tone(root, t, eighth * 3.5, { type: 'sine', vol: 0.4, dest: this.musicGain, attack: 0.02 });
        }
        // Acorde de fondo al principio de cada compás (como un "pad")
        if (i % 8 === 0) {
          for (const n of CHORDS[bar]) {
            this.tone(N[n], t, eighth * 7.5, { type: 'sine', vol: 0.07, dest: this.musicGain, attack: 0.25 });
          }
        }
        // Pequeño destello "campanita" de vez en cuando
        if (i % 16 === 14) this.tone(N.C6, t, 0.3, { type: 'sine', vol: 0.05, dest: this.musicGain });

        this.nextTime += eighth;
        this.step++;
      }
    }

    // ---------------------------------------------------------------------------
    // Efectos de sonido
    // ---------------------------------------------------------------------------

    /** Pulsación de botón: "pop" corto. */
    click() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(660, t, 0.09, { type: 'sine', vol: 0.25, slideTo: 990 });
    }

    /** Acierto: arpegio ascendente brillante. */
    correct() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => {
        this.tone(f, t + i * 0.08, 0.28, { type: 'triangle', vol: 0.3 });
        this.tone(f * 2, t + i * 0.08, 0.15, { type: 'sine', vol: 0.06 });
      });
      this.noise(t, 0.5, { vol: 0.08, from: 600, to: 3000 });
    }

    /** Fallo: dos notas graves, suaves y cortas (nada estridente). */
    wrong() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(N.E4, t, 0.22, { type: 'sine', vol: 0.18 });
      this.tone(N.C4, t + 0.16, 0.35, { type: 'sine', vol: 0.16 });
    }

    /** Llegada a un planeta: fanfarria corta. */
    arrive() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const notes = [N.G4, N.C5, N.E5, N.G5, N.E5, N.G5, N.C6];
      const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68, 0.8];
      notes.forEach((f, i) => this.tone(f, t + times[i], i === notes.length - 1 ? 0.8 : 0.2, { type: 'triangle', vol: 0.28 }));
      [N.C4, N.E4, N.G4].forEach((f) => this.tone(f, t + 0.8, 0.9, { type: 'sine', vol: 0.12, attack: 0.05 }));
    }

    /** Impulso de la nave: "whoosh". */
    whoosh() {
      if (!this.ctx) return;
      this.noise(this.ctx.currentTime, 0.6, { vol: 0.18, from: 300, to: 2500 });
    }

    /** Aparece un objeto de la ayuda visual. */
    pop(index = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(500 + (index % 10) * 25, t, 0.08, { type: 'sine', vol: 0.12, slideTo: 800 });
    }

    /** "Tic" al contar un objeto: cada número suena un poco más agudo. */
    count(index = 0) {
      if (!this.ctx) return;
      const scale = [N.C5, N.D5, N.E5, N.G5, N.A5];
      const f = scale[index % 5] * (index >= 5 ? Math.pow(2, Math.floor(index / 5) * 0.1) : 1);
      this.tone(f, this.ctx.currentTime, 0.18, { type: 'triangle', vol: 0.2 });
    }

    /** Objetos que se van volando (resta). */
    flyAway() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.tone(400, t, 0.35, { type: 'sine', vol: 0.15, slideTo: 1200 });
    }

    /** Destello mágico (agrupar 10 estrellas en un cohete, romper un cohete...). */
    magic() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) this.tone(1200 + i * 180, t + i * 0.04, 0.15, { type: 'sine', vol: 0.08 });
    }
  }

  /** Instancia única compartida por todo el juego. */
  const audio = new AudioManager();

  Object.assign(window.AstroSumas, { audio });
})();
