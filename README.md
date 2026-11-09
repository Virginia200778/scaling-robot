# Astro Sumas: Aventura Espacial

Juego web educativo para practicar **sumas y restas** (6 a 8 años).
HTML, CSS y JavaScript vanilla con módulos ES; gráficos 3D con Three.js (`three@0.160.0` desde jsDelivr mediante import map).
Ilustraciones en SVG y audio sintetizado con Web Audio API, todo generado en código.

## Cómo ejecutarlo

Los módulos ES necesitan un servidor (no funciona abriendo `index.html` con doble clic):

```bash
npx serve .
```

o bien `python3 -m http.server 8000`, o la extensión **Live Server** de VS Code. Después abre la URL que indique (p. ej. http://localhost:3000).
Hace falta conexión a internet para cargar Three.js y la fuente Fredoka.

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
