/**
 * ui.js
 * ------------------------------------------------------------
 * Pantallas, botones y mensajes (capa HTML por encima del canvas 3D).
 */
(function () {
  'use strict';
  const { astronautSVG, mascotSVG, planetIconSVG, titleDecorSVG, icons } = window.AstroSumas;

  const $ = (sel) => document.querySelector(sel);

  /** Elige un elemento al azar sin repetir el último usado. */
  function pickVaried(list, last) {
    if (list.length < 2) return list[0];
    let item;
    do { item = list[Math.floor(Math.random() * list.length)]; } while (item === last);
    return item;
  }

  class UI {
    constructor() {
      this.screens = {
        start: $('#screen-start'),
        game: $('#screen-game'),
        pause: $('#screen-pause'),
        victory: $('#screen-victory'),
      };
      this.el = {
        question: $('#question'),
        answers: $('#answers'),
        feedback: $('#feedback'),
        bubble: $('#feedback .bubble'),
        mascot: $('#feedback .mascot'),
        destName: $('#dest-name'),
        destIcon: $('#dest-icon'),
        destCount: $('#dest-count'),
        stars: $('#progress-stars'),
        banner: $('#banner'),
        soundBtn: $('#btn-sound'),
        pauseBtn: $('#btn-pause'),
        victoryText: $('#victory-text'),
      };
      this.lastMessage = null;
      this.feedbackTimer = null;
      this.bannerTimer = null;
      this.injectIllustrations();
    }

    /** Inserta las ilustraciones SVG generadas en código. */
    injectIllustrations() {
      $('#start-astronaut').innerHTML = astronautSVG();
      $('#victory-astronaut').innerHTML = astronautSVG();
      $('#title-decor').innerHTML = titleDecorSVG();
      $('#pause-mascot').innerHTML = mascotSVG('happy');
      this.el.pauseBtn.innerHTML = icons.pause();
      $('#btn-resume .icon').innerHTML = icons.play();
      $('#btn-home .icon').innerHTML = icons.home();
      $('#btn-again .icon').innerHTML = icons.replay();
      $('#btn-victory-home .icon').innerHTML = icons.home();
      this.setMuted(false);
    }

    // ---------------------------------------------------------------------------
    // Pantallas
    // ---------------------------------------------------------------------------

    /** Muestra la pantalla principal indicada ('start' o 'game'). */
    showScreen(name) {
      for (const key of ['start', 'game']) this.screens[key].classList.toggle('active', key === name);
      this.showOverlay(null);
      document.body.dataset.screen = name;
    }

    /** Muestra una capa superpuesta ('pause', 'victory') o ninguna (null). */
    showOverlay(name) {
      for (const key of ['pause', 'victory']) this.screens[key].classList.toggle('active', key === name);
    }

    setMuted(muted) {
      this.el.soundBtn.innerHTML = muted ? icons.soundOff() : icons.soundOn();
      this.el.soundBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
      this.el.soundBtn.classList.toggle('muted', muted);
    }

    // ---------------------------------------------------------------------------
    // Operación y respuestas
    // ---------------------------------------------------------------------------

    /** Escribe la operación, con el hueco "?" o con el resultado revelado. */
    setQuestion({ a, b, op, result }, revealed = false) {
      const sign = op === '+' ? '+' : '−';
      const answer = revealed
        ? `<span class="slot revealed">${result}</span>`
        : '<span class="slot">?</span>';
      this.el.question.parentElement.classList.remove('empty');
      this.el.question.innerHTML =
        `<span class="num">${a}</span><span class="op">${sign}</span><span class="num">${b}</span><span class="op">=</span>${answer}`;
      this.el.question.parentElement.classList.remove('pop');
      void this.el.question.offsetWidth; // reinicia la animación CSS
      this.el.question.parentElement.classList.add('pop');
    }

    /** Oculta la tarjeta de la operación (mientras la nave viaja). */
    clearQuestion() {
      this.el.question.innerHTML = '';
      this.el.question.parentElement.classList.add('empty');
    }

    /**
     * Crea los botones de respuesta.
     * @param {number[]} values
     * @param {(value:number, btn:HTMLButtonElement)=>void} onPick
     */
    setOptions(values, onPick) {
      const box = this.el.answers;
      box.innerHTML = '';
      box.dataset.count = values.length;
      const colors = ['c1', 'c2', 'c3', 'c4'];
      values.forEach((v, i) => {
        const btn = document.createElement('button');
        btn.className = `btn btn-answer ${colors[i % colors.length]}`;
        btn.type = 'button';
        btn.textContent = v;
        btn.dataset.value = v;
        btn.setAttribute('aria-label', `Respuesta ${v}`);
        btn.style.animationDelay = `${i * 0.07}s`;
        btn.addEventListener('click', () => onPick(v, btn));
        box.appendChild(btn);
      });
      this.showAnswers(true);
    }

    showAnswers(visible) {
      this.el.answers.classList.toggle('hidden', !visible);
    }

    setAnswersEnabled(enabled) {
      this.el.answers.querySelectorAll('.btn-answer').forEach((b) => {
        if (!b.classList.contains('tried')) b.disabled = !enabled;
      });
    }

    buttonFor(value) {
      return this.el.answers.querySelector(`.btn-answer[data-value="${value}"]`);
    }

    /** Marca la respuesta correcta con una animación alegre. */
    markCorrect(value) {
      const b = this.buttonFor(value);
      if (b) b.classList.add('correct');
    }

    /** Marca suavemente una respuesta equivocada (sin colores alarmantes). */
    markWrong(value) {
      const b = this.buttonFor(value);
      if (!b) return;
      b.classList.add('wiggle');
      setTimeout(() => b.classList.remove('wiggle'), 600);
    }

    /** Deja una opción ya probada en gris para el reintento. */
    markTried(value) {
      const b = this.buttonFor(value);
      if (!b) return;
      b.classList.add('tried');
      b.disabled = true;
    }

    /** Devuelve los botones habilitados (para atajos de teclado). */
    enabledButtons() {
      return [...this.el.answers.querySelectorAll('.btn-answer:not(:disabled)')];
    }

    // ---------------------------------------------------------------------------
    // Mensajes de la mascota
    // ---------------------------------------------------------------------------

    /**
     * La mascota Lumi dice algo.
     * @param {string|string[]} text  texto o lista de textos (se elige uno variado)
     * @param {'happy'|'cheer'|'encourage'|'wow'} mood
     * @param {number} [ms] tiempo visible (0 = hasta que se oculte)
     */
    say(text, mood = 'happy', ms = 0) {
      const msg = Array.isArray(text) ? pickVaried(text, this.lastMessage) : text;
      this.lastMessage = msg;
      this.el.mascot.innerHTML = mascotSVG(mood);
      this.el.bubble.textContent = msg;
      const fb = this.el.feedback;
      fb.classList.remove('show');
      void fb.offsetWidth;
      fb.classList.add('show');
      fb.dataset.mood = mood;
      clearTimeout(this.feedbackTimer);
      if (ms > 0) this.feedbackTimer = setTimeout(() => this.hideFeedback(), ms);
      return msg;
    }

    hideFeedback() {
      clearTimeout(this.feedbackTimer);
      this.el.feedback.classList.remove('show');
    }

    /** Cartel grande (por ejemplo, al llegar a un planeta). */
    showBanner(html, ms = 2500) {
      const b = this.el.banner;
      b.innerHTML = html;
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
    }

    hideBanner() {
      clearTimeout(this.bannerTimer);
      this.el.banner.classList.remove('show');
    }

    // ---------------------------------------------------------------------------
    // Progreso hacia el siguiente planeta
    // ---------------------------------------------------------------------------

    setDestination(def, index, total) {
      // "Planeta " se oculta en pantallas estrechas para que se lea el nombre
      const short = def.name.replace(/^Planeta\s+/, '');
      this.el.destName.innerHTML = `<span class="dest-prefix">Planeta </span>${short}`;
      this.el.destIcon.innerHTML = planetIconSVG(def.color, (def.rings && def.rings[0]) || '#ffffff');
      this.el.destCount.textContent = `${index + 1}/${total}`;
    }

    /** Dibuja las estrellas de progreso (conseguidas / necesarias). */
    setProgress(done, total) {
      const box = this.el.stars;
      if (box.children.length !== total) {
        box.innerHTML = '';
        for (let i = 0; i < total; i++) {
          const s = document.createElement('span');
          s.className = 'pstar';
          box.appendChild(s);
        }
      }
      [...box.children].forEach((s, i) => {
        const filled = i < done;
        if (filled && !s.classList.contains('on')) {
          s.classList.add('on', 'bump');
          setTimeout(() => s.classList.remove('bump'), 600);
        }
        if (!filled) s.classList.remove('on');
        s.innerHTML = icons.star(filled);
      });
    }

    showVictory({ planets, stars }) {
      this.el.victoryText.textContent = `Has visitado ${planets} planetas y has ganado ${stars} estrellas.`;
      this.showOverlay('victory');
    }
  }

  Object.assign(window.AstroSumas, { UI });
})();
