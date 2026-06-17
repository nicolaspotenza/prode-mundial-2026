# Prode Mundial 2026 — Diseño: Manejo EN VIVO + Sistema UI/UX

**Fecha:** 2026-06-17
**Estado:** Aprobado
**Base:** Extiende `prode-mundial.md` (spec maestro). Este documento cubre únicamente lo nuevo de esta iteración: el manejo de partidos en vivo y el sistema de diseño visual. Todo lo no mencionado aquí sigue como está en `prode-mundial.md`.

---

## 1. Objetivo de la iteración

1. Que la app **detecte el estado real de cada partido al entrar el usuario** y actúe en consecuencia: bloquear apuestas de partidos en juego, cargar resultados de partidos terminados y devolver puntos a todos los jugadores.
2. Mostrar **resultados en vivo** (marcador, minuto, goles, tarjetas) mientras un partido se juega.
3. Aplicar un **sistema de diseño dinámico y animado** (mobile-first, sin sonido) sobre todas las vistas.

Lo demás (Home, Grupos, Fase de Grupos, Eliminatorias, Ranking, scoring, storage compartido, fuentes Promiedos→API-Football→football-data) ya está especificado en `prode-mundial.md` y se mantiene.

---

## 2. Manejo EN VIVO y flujo de datos

### 2.1 Tres estados de partido

Cada partido tiene un `estado` derivado de la fuente de datos:

| Estado | Detección | Apuesta | Qué muestra la UI |
|---|---|---|---|
| `programado` | Aún no empezó (hora futura / fuente dice no iniciado) | Editable | Hora + equipos + pronóstico del usuario (si lo cargó) |
| `en_vivo` | La fuente reporta el partido en juego | **Bloqueada** | Marcador en vivo + minuto + badge "EN VIVO" pulsante + goles/tarjetas en tiempo real |
| `finalizado` | La fuente lo marca terminado | Bloqueada | Resultado final + eventos + puntos obtenidos |

Regla derivada: `bloqueado = estado !== 'programado'`. El booleano `bloqueado` del spec original deja de almacenarse como dato y pasa a calcularse desde `estado`.

### 2.2 Flujo al entrar el usuario

Al abrir la app, **antes de renderizar datos**, corre `syncResultados()`:

1. Consulta la fuente activa (Promiedos → fallback). Trae, por partido: `estado`, marcador, `minuto`, goles y tarjetas; y las posiciones de los 12 grupos.
2. Para cada partido que pasó a `en_vivo`: se bloquea el input de apuesta de ese partido inmediatamente.
3. Para cada partido que pasó a `finalizado` y aún no estaba procesado:
   - Se guarda el resultado en `matches` (`shared: true`).
   - Se guardan sus eventos en `eventos_partido:{matchId}`.
   - Se **recalculan los puntos de todos los usuarios** registrados en `users` (grupos vía `calcularPuntosGrupos`; eliminatorias vía `calcularPuntosEliminatoria` cuando se confirma el equipo que avanza).
   - Se actualizan totales y, por ende, el ranking.
4. Se guarda `last_sync`.

### 2.3 Polling adaptativo

- Trigger base: al abrir la app y al recuperar foco de la ventana (`visibilitychange` / `focus`).
- Si tras una sync hay **≥1 partido `en_vivo`**, se programa re-sync cada `DATA_CONFIG.livePollSeconds` (≈60s) hasta que ninguno siga en vivo.
- Si no hay partidos en vivo, no se hace polling continuo (solo el sync diario `syncIntervalHours` ya previsto y los triggers de apertura/foco).
- El polling se limpia al desmontar y al pasar la ventana a background, para no saturar la fuente/proxy.

### 2.4 Cambios concretos sobre `prode-mundial.md`

- `DATA_CONFIG` suma `livePollSeconds: 60`.
- Modelo de partido suma `estado` y `minuto`; `bloqueado` pasa a derivado.
- Los parsers de cada fuente (Promiedos scraping y API-Football) deben extraer también estado en vivo + minuto, no solo el resultado final.
- `eventos_partido:{matchId}` se puebla también durante el vivo, no solo al finalizar.
- Degradación silenciosa: si la fuente no informa estado en vivo, el partido se trata como `programado` hasta que aparezca como `finalizado` (nunca rompe).

---

## 3. Sistema de diseño UI/UX

Derivado de la skill UI/UX Pro Max, dirección "estadio moderno".

### 3.1 Estilo base
Dark Mode tipo OLED, deportivo, **mobile-first**. Sin sonido. Respeta `prefers-reduced-motion`.

### 3.2 Paleta (tokens semánticos)

| Rol | Hex |
|---|---|
| Fondo | `#0F172A` |
| Superficie / cards | `#1F1E27` |
| Borde | `rgba(255,255,255,0.08)` |
| Primario (verde cancha) | `#22C55E` (oscuro `#15803D`) |
| Acento (dorado trofeo) | `#F59E0B` |
| CTA secundario (índigo) | `#6366F1` |
| Destructivo / tarjeta roja | `#DC2626` |
| Texto | `#FFFFFF` |
| Texto secundario | gris claro, contraste ≥4.5:1 |

Definir como CSS variables / tokens, no hex sueltos en componentes. Diseñar contraste de dark mode de forma independiente (mínimo AA 4.5:1).

### 3.3 Tipografía
- Títulos / marcadores: **Barlow Condensed** (600–700).
- Cuerpo: **Barlow** (400–500).
- Números de marcadores y tablas con *tabular figures* para evitar saltos de layout.
- `font-display: swap`.

### 3.4 Navegación
- **Bottom tab bar** (máx 5): **Home · Grupos · Fase Grupos · Llaves · Ranking**.
- Ícono (Lucide/SVG) + label. Estado activo resaltado (color + peso).
- **Nunca emojis como íconos de UI.** Las banderas de países sí van como emoji (es contenido).
- Safe-area: padding inferior para no chocar con la barra de gestos.

### 3.5 Animaciones (150–300ms, `transform`/`opacity`, interrumpibles)
- Badge "EN VIVO" pulsante; marcador con *count-up* al cambiar un gol.
- Micro-scale (≈0.97) al presionar cards/partidos; *crossfade* al pasar de "pronóstico" a "resultado".
- *Stagger* (30–50ms) al aparecer listas de partidos y filas del ranking.
- Al sumar puntos: flash dorado + número ascendente; reordenamiento animado de filas en el ranking.
- Bracket: feedback en tiempo real al arrastrar, con umbral de movimiento (drag threshold) para evitar arrastres accidentales; alternativa por dropdown (no depender solo del gesto).
- Skeletons/shimmer mientras carga la sync (>300ms), en vez de spinner bloqueante.

### 3.6 Estados visuales por partido
⬜ sin pronóstico · 🟡 pronóstico cargado · 🔴 en vivo (bloqueado, marcador live) · 🟢 finalizado + puntos.

### 3.7 Accesibilidad (gates)
- Touch targets ≥44px; inputs de goles ≥44px de alto.
- `aria-label` en botones de ícono; color nunca como único indicador (acompañar con ícono/texto).
- Focus visible para navegación por teclado.

---

## 4. Entregable

Sigue siendo **un único archivo `.jsx`** (React + Tailwind, `window.storage`, sin backend), ahora con: estados de partido en vivo, polling adaptativo, recálculo global de puntos al entrar, y el sistema de diseño descripto. El resto del alcance se mantiene según `prode-mundial.md`.

---

## 5. Fuera de alcance (YAGNI)

- Sonido / notificaciones push.
- Edición de fixtures desde la UI (los 104 partidos y 12 grupos van hardcodeados).
- Autenticación real (sigue el modelo de alias + autocompletado del spec original).
