/**
 * illustrations.js
 * ------------------------------------------------------------
 * Ilustraciones infantiles en SVG generadas en código:
 * astronauta, mascota "Lumi", iconos y decoraciones.
 * Estilo: formas redondeadas, contornos suaves y ojos grandes.
 */

// Paleta compartida (alegre y armónica)
const C = {
  line: '#2b3a67',
  white: '#ffffff',
  suit: '#f4f7ff',
  suitShade: '#c9d3ea',
  skin: '#ffd8b5',
  blush: '#ff9eb5',
  orange: '#ff8a5c',
  yellow: '#ffd23f',
  yellowDark: '#f4a51c',
  blue: '#5ec8ff',
  pink: '#ff6fb5',
  mint: '#4fe3c1',
  purple: '#9b7bff',
};

/** Ojos grandes y brillantes, reutilizables. */
function eyes(cx1, cx2, cy, r = 9, look = 0) {
  const eye = (cx) => `
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.2}" fill="${C.line}"/>
    <circle cx="${cx + look + r * 0.3}" cy="${cy - r * 0.45}" r="${r * 0.38}" fill="#fff"/>
    <circle cx="${cx + look - r * 0.35}" cy="${cy + r * 0.45}" r="${r * 0.16}" fill="#fff"/>`;
  return eye(cx1) + eye(cx2);
}

/** Astronauta saludando (pantalla de inicio y victoria). */
export function astronautSVG() {
  return `
<svg viewBox="0 0 240 290" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Astronauta saludando">
  <defs>
    <radialGradient id="visorGlass" cx="35%" cy="30%" r="80%">
      <stop offset="0" stop-color="#bfeaff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#5ec8ff" stop-opacity="0.15"/>
    </radialGradient>
  </defs>
  <!-- Mochila -->
  <rect x="48" y="128" width="144" height="104" rx="34" fill="${C.suitShade}" stroke="${C.line}" stroke-width="5"/>
  <!-- Piernas y botas -->
  <rect x="80" y="214" width="34" height="46" rx="15" fill="${C.suit}" stroke="${C.line}" stroke-width="5"/>
  <rect x="126" y="214" width="34" height="46" rx="15" fill="${C.suit}" stroke="${C.line}" stroke-width="5"/>
  <ellipse cx="95" cy="266" rx="24" ry="14" fill="${C.orange}" stroke="${C.line}" stroke-width="5"/>
  <ellipse cx="145" cy="266" rx="24" ry="14" fill="${C.orange}" stroke="${C.line}" stroke-width="5"/>
  <!-- Brazo izquierdo (abajo) -->
  <rect x="42" y="150" width="34" height="62" rx="17" fill="${C.suit}" stroke="${C.line}" stroke-width="5" transform="rotate(14 59 150)"/>
  <circle cx="48" cy="214" r="16" fill="${C.orange}" stroke="${C.line}" stroke-width="5"/>
  <!-- Brazo derecho (saludando) -->
  <g class="wave-arm">
    <rect x="166" y="96" width="34" height="66" rx="17" fill="${C.suit}" stroke="${C.line}" stroke-width="5" transform="rotate(-28 183 160)"/>
    <circle cx="214" cy="100" r="17" fill="${C.orange}" stroke="${C.line}" stroke-width="5"/>
  </g>
  <!-- Cuerpo -->
  <rect x="68" y="136" width="104" height="100" rx="42" fill="${C.suit}" stroke="${C.line}" stroke-width="5"/>
  <rect x="98" y="164" width="44" height="32" rx="10" fill="${C.blue}" stroke="${C.line}" stroke-width="4"/>
  <circle cx="111" cy="180" r="5" fill="${C.yellow}"/>
  <circle cx="129" cy="180" r="5" fill="${C.pink}"/>
  <!-- Antena -->
  <line x1="120" y1="28" x2="120" y2="8" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>
  <circle cx="120" cy="8" r="8" fill="${C.yellow}" stroke="${C.line}" stroke-width="4"/>
  <!-- Casco -->
  <circle cx="120" cy="96" r="70" fill="${C.white}" stroke="${C.line}" stroke-width="5"/>
  <circle cx="52" cy="100" r="13" fill="${C.orange}" stroke="${C.line}" stroke-width="4"/>
  <circle cx="188" cy="100" r="13" fill="${C.orange}" stroke="${C.line}" stroke-width="4"/>
  <!-- Cara dentro del visor -->
  <ellipse cx="120" cy="100" rx="54" ry="48" fill="${C.skin}" stroke="${C.line}" stroke-width="5"/>
  <path d="M72 88 Q86 58 120 58 Q156 58 168 88 Q148 74 120 76 Q94 74 72 88 Z" fill="#8a5a3c"/>
  ${eyes(100, 140, 102, 10)}
  <ellipse cx="86" cy="120" rx="10" ry="6" fill="${C.blush}" opacity="0.8"/>
  <ellipse cx="154" cy="120" rx="10" ry="6" fill="${C.blush}" opacity="0.8"/>
  <path d="M106 124 Q120 138 134 124" fill="none" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/>
  <!-- Brillo del cristal -->
  <ellipse cx="120" cy="100" rx="54" ry="48" fill="url(#visorGlass)"/>
  <path d="M82 76 Q92 62 110 58" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
</svg>`;
}

/**
 * Mascota "Lumi", una estrellita amiga que da ánimos.
 * @param {'happy'|'cheer'|'encourage'|'wow'} mood
 */
export function mascotSVG(mood = 'happy') {
  // Estrella de 5 puntas (las esquinas se redondean con stroke-linejoin)
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 50 : 26;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(60 + r * Math.cos(a)).toFixed(1)},${(64 + r * Math.sin(a)).toFixed(1)}`);
  }
  const star = pts.join(' ');
  const mouths = {
    happy: `<path d="M50 78 Q60 88 70 78" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>`,
    cheer: `<path d="M48 76 Q60 94 72 76 Z" fill="#e2445c" stroke="${C.line}" stroke-width="4" stroke-linejoin="round"/>`,
    encourage: `<path d="M51 80 Q60 86 69 80" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round"/>`,
    wow: `<ellipse cx="60" cy="81" rx="6" ry="7" fill="#e2445c" stroke="${C.line}" stroke-width="4"/>`,
  };
  const extras = {
    happy: '',
    cheer: sparkle(12, 18, 7, C.pink) + sparkle(106, 22, 6, C.mint) + sparkle(104, 104, 5, C.blue),
    encourage: `<path d="M41 54 Q47 50 53 54" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>
                <path d="M67 54 Q73 50 79 54" fill="none" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>`,
    wow: sparkle(14, 30, 7, C.mint) + sparkle(106, 30, 7, C.pink),
  };
  return `
<svg viewBox="0 0 120 124" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lumi, la estrellita">
  <polygon points="${star}" fill="${C.yellowDark}" stroke="${C.yellowDark}" stroke-width="18" stroke-linejoin="round"/>
  <polygon points="${star}" fill="${C.yellow}" stroke="${C.yellow}" stroke-width="10" stroke-linejoin="round"/>
  <ellipse cx="48" cy="44" rx="8" ry="5" fill="#fff" opacity="0.6" transform="rotate(-30 48 44)"/>
  ${eyes(48, 72, 66, 6.5)}
  <ellipse cx="40" cy="78" rx="5" ry="3" fill="${C.blush}"/>
  <ellipse cx="80" cy="78" rx="5" ry="3" fill="${C.blush}"/>
  ${mouths[mood] || mouths.happy}
  ${extras[mood] || ''}
</svg>`;
}

/** Destello de 4 puntas (decoración). */
function sparkle(cx, cy, r, color) {
  return `<path d="M${cx} ${cy - r} Q${cx + r * 0.2} ${cy - r * 0.2} ${cx + r} ${cy} Q${cx + r * 0.2} ${cy + r * 0.2} ${cx} ${cy + r}
    Q${cx - r * 0.2} ${cy + r * 0.2} ${cx - r} ${cy} Q${cx - r * 0.2} ${cy - r * 0.2} ${cx} ${cy - r} Z" fill="${color}"/>`;
}

/** Planeta pequeño con anillo, coloreado (icono de destino). */
export function planetIconSVG(color = C.purple, ringColor = C.yellow) {
  return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="32" cy="34" rx="29" ry="9" fill="none" stroke="${ringColor}" stroke-width="5" transform="rotate(-18 32 34)"/>
  <circle cx="32" cy="32" r="18" fill="${color}" stroke="${C.line}" stroke-width="3"/>
  <circle cx="25" cy="26" r="4" fill="#fff" opacity="0.45"/>
  <!-- Mitad delantera del anillo, por encima del planeta -->
  <path d="M3 34 A29 9 0 0 0 61 34" fill="none" stroke="${ringColor}" stroke-width="5" stroke-linecap="round" transform="rotate(-18 32 34)"/>
</svg>`;
}

/** Decoración de fondo para el título: estrellitas y planetas. */
export function titleDecorSVG() {
  return `
<svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
  ${sparkle(20, 40, 12, C.yellow)}
  ${sparkle(70, 18, 7, C.mint)}
  ${sparkle(330, 20, 8, C.pink)}
  ${sparkle(380, 46, 12, C.yellow)}
  <circle cx="300" cy="58" r="10" fill="${C.blue}" stroke="${C.line}" stroke-width="3"/>
  <circle cx="104" cy="60" r="7" fill="${C.pink}" stroke="${C.line}" stroke-width="3"/>
</svg>`;
}

// -----------------------------------------------------------------------------
// Iconos de interfaz (trazo blanco grueso y redondeado)
// -----------------------------------------------------------------------------
const iconWrap = (body) =>
  `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none"
     stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  pause: () => iconWrap(`<line x1="17" y1="12" x2="17" y2="36"/><line x1="31" y1="12" x2="31" y2="36"/>`),
  play: () => iconWrap(`<path d="M16 11 L36 24 L16 37 Z" fill="#fff"/>`),
  home: () => iconWrap(`<path d="M8 24 L24 10 L40 24"/><path d="M13 21 V38 H35 V21"/><path d="M21 38 V29 H27 V38"/>`),
  soundOn: () => iconWrap(`<path d="M8 19 H15 L25 11 V37 L15 29 H8 Z" fill="#fff"/><path d="M31 18 Q35 24 31 30"/><path d="M36 13 Q43 24 36 35"/>`),
  soundOff: () => iconWrap(`<path d="M8 19 H15 L25 11 V37 L15 29 H8 Z" fill="#fff"/><line x1="32" y1="19" x2="42" y2="29"/><line x1="42" y1="19" x2="32" y2="29"/>`),
  replay: () => iconWrap(`<path d="M12 24 A12 12 0 1 0 17 14"/><path d="M11 8 V16 H19"/>`),
  /** Estrella rellena (indicador de progreso). */
  star: (filled = true) => `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M24 5 L29.5 17 L42.5 18.5 L32.8 27.3 L35.6 40.2 L24 33.6 L12.4 40.2 L15.2 27.3 L5.5 18.5 L18.5 17 Z"
        fill="${filled ? C.yellow : 'rgba(255,255,255,0.18)'}" stroke="${filled ? C.yellowDark : 'rgba(255,255,255,0.55)'}"
        stroke-width="3.5" stroke-linejoin="round"/>
    </svg>`,
  /** Cohete pequeño (indicador de progreso). */
  rocket: () => `
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g transform="rotate(45 24 24)">
        <path d="M24 4 Q34 14 33 30 H15 Q14 14 24 4 Z" fill="#fff" stroke="${C.line}" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="24" cy="18" r="4.5" fill="${C.blue}" stroke="${C.line}" stroke-width="2.5"/>
        <path d="M15 24 L9 34 L15 32 Z M33 24 L39 34 L33 32 Z" fill="${C.pink}" stroke="${C.line}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M19 31 Q24 44 29 31 Z" fill="${C.orange}"/>
      </g>
    </svg>`,
};
