# Migración de datos locales → backend compartido

**Fecha:** 2026-06-18
**Estado:** aprobado

## Problema

Antes de conectar Upstash, la app en producción guardaba todo en `localStorage`
(shim de `src/lib/storage.js`) porque `window.storage` no existe en Vercel. Esos datos
quedaron huérfanos: el adaptador remoto ahora lee/escribe en `/api/storage` (Upstash) y
no ve las claves `prode:*` del `localStorage` de cada dispositivo. El usuario quiere un
botón para **mudar sus datos locales al backend compartido**.

## Decisiones de diseño

- **Ubicación:** ícono en el header (`CloudUpload`) junto a "Cambiar alias". Se muestra
  **solo cuando hay datos locales sin migrar** y solo en producción (`import.meta.env.PROD`).
- **Conflictos:** merge **no destructivo**. El backend siempre gana; lo local solo rellena
  huecos. Nunca se pisan apuestas hechas en otro dispositivo ni se rompe el array compartido
  `users`.

## Componentes

### `src/lib/migrate.js` (lógica, testeada)

- `readLocalRaw(key)` — lee `localStorage['prode:'+key]` con parse seguro (null si falta).
- `hasLocalData()` — `true` si hay `users` varado en localStorage y no existe el flag
  `prode:migrated`. (No mira `current_user`: ese es device-local por diseño y siempre vive
  en localStorage, así que no es un dato a migrar.)
- `mergeUsers(remote, local)` — pura. Mantiene los usuarios del backend por `alias`;
  agrega los locales cuyo alias no esté en el backend.
- `mergeByKey(remote, local, keyField)` — pura. Arranca del backend; agrega solo los
  ítems locales cuya clave (`matchId` para grupos, `slotId` para llaves) no exista en el
  backend.
- `rescoreGroupPreds(list, matches)` — pura. Recalcula `puntos` de cada pronóstico de
  grupos contra los partidos `finalizado` con resultado; deja `null` si el partido no
  terminó.
- `migrateLocalToRemote({ storage, matches, localReader })` — orquestador:
  1. Lee `users` local y remoto; `merged = mergeUsers(remoto, local)`.
  2. Por cada usuario **local**: mergea `pronosticos_grupos:{alias}` y
     `pronosticos_eliminatorias:{alias}` (no destructivo), re-puntúa los de grupos contra
     `matches`, y escribe ambas claves.
  3. Escribe `users = merged`, corre `recomputeUserTotals()`, marca `prode:migrated`.
  4. Devuelve `{ migratedUsers, gruposAdded, llavesAdded }`.

### `src/App.jsx`

- Estado `canMigrate` (de `hasLocalData()`), se evalúa al montar.
- Botón header condicional → `confirm` → `migrateLocalToRemote` → `alert` resumen →
  `runSync()` para refrescar vistas/ranking → oculta el botón.

## Garantías

- No destructivo (remoto gana en conflictos).
- No rompe el array compartido `users` (merge por alias).
- Idempotente: tras el flag `prode:migrated`, el botón no reaparece.
- Lee `localStorage` directo, independiente del adaptador activo.

## Tests (TDD)

- `mergeUsers`: agrega faltantes, conserva los del backend.
- `mergeByKey`: el backend gana, lo local rellena huecos.
- `rescoreGroupPreds`: puntúa contra finalizados, null si no terminó.
- `migrateLocalToRemote`: end-to-end con storage falso + lector local falso (mergea,
  re-puntúa, totales, idempotencia).
