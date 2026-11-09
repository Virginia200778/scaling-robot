# Astro Sumas: Aventura Espacial

Juego web educativo para practicar **sumas y restas** (6 a 8 años).
Sitio 100 % estático: sólo HTML, CSS y JavaScript vanilla (scripts clásicos, sin módulos ni compilación).
Gráficos 3D con Three.js (`three@0.160.0` desde jsDelivr).
Ilustraciones en SVG y audio sintetizado con Web Audio API, todo generado en código.

## Cómo ejecutarlo

Abre `index.html` con doble clic en el navegador. No hace falta servidor ni instalar nada.
Sólo se necesita conexión a internet para cargar Three.js y la fuente Fredoka.

También se puede publicar tal cual en cualquier alojamiento estático (GitHub Pages, Netlify…).

Los scripts se cargan en orden desde `index.html` y comparten sus piezas a través de `window.AstroSumas`.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Pantallas e import map |
| `css/styles.css` | Estilos y diseño adaptable |
| `js/main.js` | Arranque, eventos y bucle de render |
| `js/scene.js` | Escena 3D: cámara, luces, estrellas, planetas, nave |
| `js/game.js` | Estado de la partida y flujo de preguntas (`GAME_CONFIG`) |
| `js/difficulty.js` | Operaciones y dificultad adaptativa (`DIFFICULTY_CONFIG`, `LEVELS`) |
| `js/helpers3d.js` | Ayuda visual para contar y celebraciones (`HELPER_CONFIG`) |
| `js/audio.js` | Música y efectos con Web Audio API |
| `js/ui.js` | Pantallas, botones y mensajes |
| `js/illustrations.js` | Ilustraciones SVG |

Atajos en ordenador: teclas `1`–`4` para responder y `Esc`/`P` para pausar.
