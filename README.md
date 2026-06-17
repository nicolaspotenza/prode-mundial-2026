# Prode Mundial 2026 ⚽🏆

Aplicación web de prode (quiniela) para el Mundial 2026. Cualquiera se registra con un alias, carga sus pronósticos partido a partido, arma su bracket de eliminatorias y compite en un ranking global. Los datos se sincronizan al entrar: se cargan resultados, se bloquean los partidos en vivo y se reparten los puntos.

## Características

- **Sincronización al entrar + polling adaptativo en vivo.** Al abrir la app se actualizan los datos antes de mostrar nada viejo. Si hay un partido en curso, se refresca cada ~60s hasta que termina.
- **Tres estados de partido:** `programado` (apuesta editable), `en_vivo` (bloqueado + marcador y minuto en vivo), `finalizado` (resultado, eventos y puntos).
- **Eventos completos:** goles (jugador, minuto, penal), tarjetas amarillas y rojas.
- **Tabla de grupos** recalculada automáticamente con cada resultado.
- **Bracket interactivo** de Dieciseisavos a la Final.
- **Ranking** con aislamiento de datos: cada jugador ve solo sus pronósticos; el ranking muestra alias + puntos.
- **UI dinámica y animada**, mobile-first, dark mode "estadio moderno".

## Stack

Vite · React 18 · Tailwind CSS · framer-motion · lucide-react · Vitest.

## Scripts

```bash
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo
npm test         # tests (lógica de puntos, estados, standings, sync, etc.)
npm run build    # build de producción
npm run preview  # previsualizar el build
```

## Persistencia (`window.storage`)

La app usa el adaptador `src/lib/storage.js`:

- Si está disponible el `window.storage` del artifact de Claude (storage compartido entre usuarios), lo usa con `shared: true`.
- Si no (ejecución standalone / GitHub / tests), cae a un shim respaldado por `localStorage`. Es solo para desarrollo: no comparte datos entre usuarios.

## Fuentes de datos

Configurables en `src/config.js` (`DATA_CONFIG`). Orden con degradación silenciosa:

1. **TheSportsDB** (`thesportsdb`) — fuente principal. Gratuita, con CORS habilitado, sin key obligatoria (usa la key pública `3`). Trae resultados reales del Mundial 2026 (liga 4429) por jornada.
2. **API-Football** — fallback (requiere `apiFootballKey`).
3. **football-data.org** — fallback (requiere `footballDataKey`).
4. **Promiedos** (scraping vía proxy CORS) — último recurso.

Los nombres de equipo llegan en inglés y se normalizan a los nombres en español de la app (`src/data/aliases.js`), así que el matching funciona sin importar el idioma ni el orden local/visitante.

> **Cobertura:** la key pública gratuita de TheSportsDB está limitada (devuelve ~5 partidos por jornada). Para cobertura completa, cargá una key premium de TheSportsDB o una key de **API-Football** (free tier, 100 req/día) en `src/config.js` — el mismo pipeline la usa automáticamente.

## Documentación de diseño

- Spec maestro: [`prode-mundial.md`](./prode-mundial.md)
- Diseño de esta iteración (live + UI/UX): [`docs/superpowers/specs/2026-06-17-prode-live-uiux-design.md`](./docs/superpowers/specs/2026-06-17-prode-live-uiux-design.md)
- Plan de implementación: [`docs/superpowers/plans/2026-06-17-prode-live-uiux.md`](./docs/superpowers/plans/2026-06-17-prode-live-uiux.md)
