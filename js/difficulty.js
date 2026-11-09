/**
 * difficulty.js
 * ------------------------------------------------------------
 * Generación de operaciones (sumas y restas) y dificultad adaptativa.
 *
 * Todo lo ajustable está en DIFFICULTY_CONFIG y LEVELS, para poder
 * cambiar el comportamiento del juego sin tocar la lógica.
 */

/** Constantes configurables de la dificultad adaptativa. */
export const DIFFICULTY_CONFIG = {
  STREAK_TO_LEVEL_UP: 3,      // aciertos seguidos para subir de nivel
  STREAK_TO_LEVEL_DOWN: 2,    // fallos seguidos para bajar de nivel
  MIN_LEVEL: 1,
  MAX_LEVEL: 6,
  START_LEVEL: 1,
  NUM_OPTIONS: 4,             // número de botones de respuesta (3 o 4)
  // Si el niño acierta tras ver la ayuda, ¿cuenta para la racha de aciertos?
  ASSISTED_COUNTS_FOR_STREAK: false,
  // Desplazamientos usados para crear distractores plausibles.
  DISTRACTOR_OFFSETS: [1, -1, 2, -2, 10, -10, 3, -3],
};

/**
 * Definición de los niveles.
 *  - ops:   operaciones permitidas.
 *  - max:   valor máximo de cualquier número (operandos y resultado).
 *  - carry: 'none' (sin llevadas), 'required' (con llevadas) o 'any'.
 *  - minTop: valor mínimo del número mayor (para que el nivel sea distinto al anterior).
 */
export const LEVELS = {
  1: { ops: ['+'],      max: 10,  carry: 'any',      minTop: 0 },
  2: { ops: ['+', '-'], max: 10,  carry: 'any',      minTop: 0 },
  3: { ops: ['+', '-'], max: 20,  carry: 'none',     minTop: 11 },
  4: { ops: ['+', '-'], max: 20,  carry: 'required', minTop: 11 },
  5: { ops: ['+', '-'], max: 50,  carry: 'any',      minTop: 21 },
  6: { ops: ['+', '-'], max: 100, carry: 'any',      minTop: 51 },
};

/** Entero aleatorio entre min y max (ambos incluidos). */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Baraja un array (Fisher-Yates) y lo devuelve. */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** ¿La operación necesita llevada (suma) o préstamo (resta)? */
export function hasCarry(a, b, op) {
  return op === '+' ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10);
}

/** Comprueba si una operación cumple las reglas de un nivel. */
function fitsLevel(a, b, op, def) {
  const result = op === '+' ? a + b : a - b;
  if (result < 0) return false;                       // nunca negativos
  if (Math.max(a, b, result) > def.max) return false;
  if (Math.max(a, b, result) < def.minTop) return false;
  if (def.carry === 'none' && hasCarry(a, b, op)) return false;
  if (def.carry === 'required' && !hasCarry(a, b, op)) return false;
  // Evitamos operaciones triviales con 0 (salvo raras excepciones en niveles bajos).
  if (b === 0 && Math.random() < 0.85) return false;
  if (a === 0) return false;
  return true;
}

/**
 * Genera una operación para el nivel indicado.
 * Usa muestreo con rechazo: probamos números al azar hasta que cumplen las reglas.
 * @param {number} level
 * @param {{a:number,b:number,op:string}} [avoid] operación a no repetir
 * @returns {{a:number, b:number, op:'+'|'-', result:number, level:number}}
 */
export function generateOperation(level, avoid = null) {
  const def = LEVELS[level] || LEVELS[1];
  for (let tries = 0; tries < 500; tries++) {
    const op = def.ops[randInt(0, def.ops.length - 1)];
    let a, b;
    if (op === '+') {
      // Elegimos primero el resultado para que se repartan bien los totales.
      const result = randInt(Math.max(2, def.minTop), def.max);
      a = randInt(1, result - 1);
      b = result - a;
    } else {
      a = randInt(1, def.max);
      b = randInt(0, a);
    }
    if (!fitsLevel(a, b, op, def)) continue;
    if (avoid && avoid.a === a && avoid.b === b && avoid.op === op) continue;
    return { a, b, op, result: op === '+' ? a + b : a - b, level };
  }
  // Respaldo seguro (no debería ocurrir).
  return { a: 2, b: 3, op: '+', result: 5, level };
}

/**
 * Crea las opciones de respuesta: el resultado correcto más distractores
 * plausibles (±1, ±2, ±10...), sin repetir y nunca negativos.
 * @param {number} result
 * @param {number} [count]
 * @returns {number[]} opciones barajadas
 */
export function generateOptions(result, count = DIFFICULTY_CONFIG.NUM_OPTIONS) {
  const options = new Set([result]);
  // Los ±10 sólo tienen sentido cuando el resultado ya tiene decenas.
  // Damos prioridad a ±1 y ±2 (los errores más típicos de conteo), con algo de azar
  // para que el ±10 también aparezca a menudo cuando tiene sentido.
  const offsets = DIFFICULTY_CONFIG.DISTRACTOR_OFFSETS
    .filter((o) => Math.abs(o) < 10 || result >= 10)
    .map((o) => ({ o, key: Math.min(Math.abs(o), 4) + Math.random() * 2.5 }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.o);
  for (const off of offsets) {
    if (options.size >= count) break;
    const v = result + off;
    if (v >= 0) options.add(v);
  }
  // Por si aún faltan (resultados muy pequeños), añadimos valores cercanos.
  let extra = 1;
  while (options.size < count) {
    options.add(result + extra);
    extra++;
  }
  return shuffle([...options]);
}

/**
 * Gestor de la dificultad adaptativa.
 * Lleva las rachas de aciertos/fallos y decide cuándo cambiar de nivel.
 */
export class DifficultyManager {
  constructor(config = DIFFICULTY_CONFIG) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.level = this.config.START_LEVEL;
    this.successStreak = 0;
    this.failStreak = 0;
    this.lastOperation = null;
  }

  /** Devuelve una nueva operación del nivel actual, sin repetir la anterior. */
  nextOperation() {
    const operation = generateOperation(this.level, this.lastOperation);
    this.lastOperation = operation;
    return operation;
  }

  /**
   * Registra una respuesta y ajusta el nivel si toca.
   * @param {boolean} correct
   * @param {{assisted?: boolean}} [opts] assisted = acierto tras ver la ayuda
   * @returns {{levelChange: -1|0|1, level: number}}
   */
  registerAnswer(correct, { assisted = false } = {}) {
    const c = this.config;
    let levelChange = 0;
    if (correct) {
      this.failStreak = 0;
      if (!assisted || c.ASSISTED_COUNTS_FOR_STREAK) this.successStreak++;
      if (this.successStreak >= c.STREAK_TO_LEVEL_UP) {
        this.successStreak = 0;
        if (this.level < c.MAX_LEVEL) { this.level++; levelChange = 1; }
      }
    } else {
      this.successStreak = 0;
      this.failStreak++;
      if (this.failStreak >= c.STREAK_TO_LEVEL_DOWN) {
        this.failStreak = 0;
        if (this.level > c.MIN_LEVEL) { this.level--; levelChange = -1; }
      }
    }
    return { levelChange, level: this.level };
  }
}
