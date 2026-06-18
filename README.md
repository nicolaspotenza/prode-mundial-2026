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

## Persistencia (`src/lib/storage.js`)

El adaptador elige el backend en este orden:

1. **`window.storage`** del artifact de Claude, si está presente (compartido entre usuarios).
2. **API remota `/api/storage`** (Upstash Redis) cuando corre en producción (`import.meta.env.PROD`). Da **ranking y pronósticos compartidos entre todos los celulares**. Si el backend no está configurado o no responde, degrada al shim local (la app sigue andando por dispositivo).
3. **Shim sobre `localStorage`** en desarrollo local y tests (por dispositivo).

### Ranking compartido en producción (Upstash Redis)

La función serverless [`api/storage.js`](./api/storage.js) expone `GET/POST /api/storage` y guarda los valores en Upstash Redis vía su API REST. Para activarlo:

1. En el proyecto de Vercel: **Storage → Create / Marketplace → Upstash for Redis** (o `npx vercel integration add upstash`). Conectalo al proyecto `prode-mundial-2026`.
2. La integración inyecta automáticamente `KV_REST_API_URL` / `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` / `_TOKEN`). La función acepta cualquiera de los dos pares.
3. Redeploy (o push): el siguiente deploy ya usa el storage compartido.

Hasta conectarlo, la app funciona igual pero el ranking es local por dispositivo.

### Mudar datos locales al backend

Si un jugador cargó datos **antes** de conectar Upstash, quedaron en el `localStorage` de
su celular. En producción aparece un botón ☁️ (`CloudUpload`) en el header **solo si se
detectan datos locales sin migrar**. Al tocarlo, `src/lib/migrate.js` mergea su usuario y
pronósticos al backend compartido de forma **no destructiva** (lo que ya está en la nube
gana; lo local solo rellena huecos), re-puntúa los pronósticos de grupos y marca el flag
`prode:migrated` para no repetir.

## Fuentes de datos

Configurables en `src/config.js` (`DATA_CONFIG`). Orden con degradación silenciosa:

1. **TheSportsDB** (`thesportsdb`) — fuente principal. Gratuita, con CORS habilitado, sin key obligatoria (usa la key pública `3`). Trae resultados reales del Mundial 2026 (liga 4429) por jornada.
2. **API-Football** — fallback (requiere `apiFootballKey`).
3. **football-data.org** — fallback (requiere `footballDataKey`).
4. **Promiedos** (scraping vía proxy CORS) — último recurso.

Los nombres de equipo llegan en inglés y se normalizan a los nombres en español de la app (`src/data/aliases.js`), así que el matching funciona sin importar el idioma ni el orden local/visitante.

### Cobertura completa (opcional)

Combinando endpoints, TheSportsDB gratis suele devolver el **fixture completo + resultados** de todos los grupos. Si en algún momento rate-limita, podés garantizar cobertura total con API-Football:

1. Registrate gratis en https://www.api-football.com/ (free tier: 100 req/día).
2. Copiá `.env.example` a `.env` y pegá tu key:
   ```
   VITE_API_FOOTBALL_KEY=tu_key_aca
   ```
3. Reiniciá `npm run dev`.

Al definir la key, **API-Football pasa a ser la fuente principal automáticamente** (cobertura completa) y TheSportsDB queda como fallback. Las keys nunca se commitean (`.env` está en `.gitignore`).

## Documentación de diseño

- Spec maestro: [`prode-mundial.md`](./prode-mundial.md)
- Diseño de esta iteración (live + UI/UX): [`docs/superpowers/specs/2026-06-17-prode-live-uiux-design.md`](./docs/superpowers/specs/2026-06-17-prode-live-uiux-design.md)
- Plan de implementación: [`docs/superpowers/plans/2026-06-17-prode-live-uiux.md`](./docs/superpowers/plans/2026-06-17-prode-live-uiux.md)
