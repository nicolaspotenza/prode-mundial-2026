# Llaves conectadas a la API — detección de ganadores, puntaje y overlay de realidad

Fecha: 2026-06-28

## Objetivo

Conectar el cuadro de eliminatorias ("llaves") a la fuente de datos real para que,
al igual que ya ocurre con la fase de grupos:

1. Se **detecte automáticamente el ganador** de cada cruce de eliminatorias desde la API.
2. Se otorguen **+20 puntos** a cada usuario que haya acertado quién avanza en ese cruce.
3. El cuadro del usuario se **actualice con el ganador real** y, si su predicción cayó,
   deba **volver a predecir** la fase siguiente con los equipos reales.
4. Se muestre el **3.º y 4.º puesto** debajo de la final (con su propio cruce puntuable).

Restricciones que se respetan:

- **Solo importa el ganador, no los goles** (`calcularPuntosEliminatoria` ya ignora goles).
- **No debe reproducirse el bug del "storm"** que dejaba la app cargando para siempre.
- Cambios acotados a las llaves: **no se toca la lógica ni los datos de la fase de grupos**.

## Contexto del estado actual

- Los 16 cruces de Dieciseisavos (`DIECISEISAVOS` en `src/data/bracket.js`) **son el cuadro
  real oficial** → se pueden matchear contra la API por identidad de equipos.
- Eliminatorias **no tienen empates**: siempre hay un ganador (tiempo extra o penales).
  La fuente debe indicar quién avanza.
- `elimination_matches` (clave de storage, sembrada por `seed.js`) tiene un registro por
  cruce con `ganador: null`. **Hoy ese `ganador` nunca se completa** y
  `recomputeMatchForAllUsers` (en `recalc.js`) **no se llama desde ningún lado**: el puntaje
  de llaves no se calcula nunca.
- `Bracket.jsx` ya lee `elimination_matches` para marcar 🟢/🔴, pero la cascada del cuadro del
  usuario (`resolveBracket(preds)`) usa **solo** los picks del usuario.

## Diseño

### 1. Dos cuadros: el real (verdad) y el del usuario (predicción)

Comparten la misma estructura de árbol (`KO_MATCHES`):

- **Predicción** — `pronosticos_eliminatorias:{alias}`: picks del usuario (ya existe).
- **Real** — `elimination_matches`: `ganador` real por cruce (hoy `null`). Lo completa la API.

El puntaje no cambia conceptualmente: **20 pts si el ganador elegido por el usuario para un
cruce coincide con el ganador real de ese cruce** (`calcularPuntosEliminatoria`).

### 2. Detección de ganadores desde la fuente — `applyKnockout(updates)`

Nuevo paso del sync, **independiente** de `applySync` (que sigue manejando solo grupos).
Se ejecuta en `runSync` después de `applySync`, consumiendo los mismos `updates`.

Algoritmo:

1. Leer `elimination_matches`. **Guard anti-pisado**: si el read vino vacío (fallo transitorio
   del storage), abortar sin escribir (misma defensa que `applySync`).
2. Resolver el cuadro **real** de abajo hacia arriba: los Dieciseisavos tienen equipos fijos;
   cada ronda superior se llena con los ganadores reales ya detectados de sus hijos.
3. Indexar los `updates` con `status === 'finished'` por par de equipos canónico
   (reutilizando `canonicalTeam` de `data/aliases.js`).
4. Para cada cruce cuyos dos equipos efectivos ya están definidos y aún no tiene `ganador`,
   buscar un partido finalizado cuyo par de equipos coincida (en cualquier orden). Si existe,
   asignar `ganador` = ganador del partido.
5. **Iterar hasta estabilizar**: al setear el ganador de un Dieciseisavo se revelan los equipos
   de su Octavo, que pueden coincidir con otro partido ya finalizado del mismo lote. Repetir
   hasta que no cambie ningún cruce.
6. Persistir `elimination_matches` **una sola vez** (antes de tocar a los usuarios) y devolver el
   conjunto de cruces cuyo `ganador` cambió en este sync.

**Determinación del ganador de un partido** (`winnerOf(event, teamA, teamB)`):

- Si la fuente provee el equipo que avanza (`event.ganador`, ver §6), usarlo.
- Si no, ganar = el equipo con **más goles** (cubre tiempo extra).
- Si el marcador está empatado (definición por penales) y la fuente no indica el avanzado,
  el cruce **queda pendiente** y se reintenta en el próximo sync. Nunca cuelga ni adivina mal.

La final y el cruce de 3.º puesto se distinguen solos: tienen equipos distintos
(ganadores vs. perdedores de las semis), así que el match por par de equipos no se confunde.

### 3. Anti-storm (lo más importante)

El storm anterior nacía de recalcular **por-partido × usuarios** con persistencia diferida.
Defensas por diseño:

- **Persistir `elimination_matches` primero**, antes de cualquier recálculo por usuario, y con
  guard de read vacío (no pisar).
- **Recálculo en UNA sola pasada por usuario** — `recomputeKnockoutForAllUsers(winnersById)`:
  recibe el mapa `{ matchId → ganadorReal }` de los cruces que cambiaron y hace **una** pasada
  O(usuarios): por cada usuario actualiza solo los puntos de esos cruces y, al final, **un**
  `recomputeUserTotals`. No es O(cruces × usuarios).
- **Idempotente / solo-cambios**: solo se escribe el pronóstico de un usuario si su puntaje
  cambió. Si en un sync no cambió ningún ganador (`winnersById` vacío), **no se toca a ningún
  usuario** (se omite todo el recálculo).
- Son ≤32 cruces (no ~50 partidos de grupo) y el recálculo es de un solo paso → imposible el
  storm.

`recomputeKnockoutForAllUsers` (nuevo, en `recalc.js`) reemplaza en uso a
`recomputeMatchForAllUsers` (que recalculaba un cruce a la vez). Firma inyectable
(`store = storage`) para testear.

```js
export async function recomputeKnockoutForAllUsers(winnersById, store = storage) {
  if (!winnersById || Object.keys(winnersById).length === 0) return
  const users = (await store.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_eliminatorias:${u.alias}`
    const list = (await store.get(key)) || []
    let changed = false
    for (const p of list) {
      if (p.matchId in winnersById) {
        const pts = calcularPuntosEliminatoria(p.ganador, winnersById[p.matchId])
        if (pts !== p.puntos) { p.puntos = pts; changed = true }
      }
    }
    if (changed) await store.set(key, list)
  }
  await recomputeUserTotals(store)
}
```

### 4. Overlay de realidad en el cuadro del usuario

`resolveBracket` pasa a aceptar el cuadro real: `resolveBracket(preds, realById)`, donde
`realById` mapea `matchId → ganador real` (o `null`).

- El equipo que **avanza** de cada hijo a su padre = **ganador real si ya se conoce, si no el
  pick del usuario**. Así, apenas un cruce se resuelve, la casilla superior se actualiza al
  equipo real, **aunque el usuario haya elegido a otro**.
- Si el usuario había predicho al equipo eliminado, su pick de la fase siguiente deja de ser
  válido (su equipo ya no participa del cruce) → `resolveBracket` lo devuelve como `ganador:
  null` y la casilla se libera para **re-predecir** entre los equipos reales. Al re-elegir,
  `setBracketPick` poda los picks aguas arriba que quedaron inconsistentes.
- El puntaje del cruce se calcula **contra el ganador real**, independiente de la cascada: un
  usuario que predijo un equipo que ni siquiera llegó a ese cruce simplemente suma 0.

`setKnockoutPrediction` (en `predictions.js`) carga `realById` desde `elimination_matches` y lo
pasa a `setBracketPick(preds, matchId, ganador, userId, realById)`, para que la poda use los
equipos reales actuales.

Un cruce con `ganador` real != null queda **bloqueado** (read-only) en la UI, igual que un
partido de grupos finalizado.

### 5. 3.º y 4.º puesto

Se agrega un cruce especial al árbol: `ko_tercer_1` (ronda `tercer`), cuyos `children` son las
dos semis pero toma a los **perdedores** de cada una.

- En `resolveBracket`, para el cruce de tercer puesto el equipo que aporta cada hijo = **el
  perdedor** de ese hijo, derivable solo cuando el hijo tiene sus dos equipos y un ganador
  (real o del usuario): `loser = ganadorEfectivo === teamA ? teamB : teamA`.
- El usuario predice el ganador de ese cruce → ese es **3.º**, el otro **4.º**. Suma **20 pts**
  por acertar el ganador, detectado por la API como cualquier otro cruce (su partido tiene
  equipos distintos a la final).
- Estructura: `KO_MATCHES` pasa de 31 a **32** registros; `ELIMINATION_MATCHES` también.
  `RONDA_LABELS.tercer = 'Tercer puesto'`. `KO_RONDAS` no incluye `tercer` para no afectar el
  layout en columnas (se renderiza aparte, ver §6).

Siembra: `SEED_VERSION` se incrementa para incorporar el nuevo cruce. La siembra de
`elimination_matches` en bump de versión **mergea** (conserva el `ganador` de los cruces
existentes y agrega los slots faltantes); **nunca** pisa resultados ya detectados. No toca
`matches` (firstRun gate intacto) ni `users` (los bonus se conservan).

### 6. UI (`Bracket.jsx`)

- `resolveBracket` se llama con `realById` (que ya se computa en la vista) para que la cascada
  use la realidad.
- Estados visuales por cruce:
  - **Abierto** (sin ganador real): tocable como hoy.
  - **Cerrado** (con ganador real): read-only. La fila del **ganador real** se marca como
    "avanzó". Si el usuario había elegido en ese cruce: su fila muestra 🟢 **+20** si acertó,
    🔴 **0** si erró. Sin pick → 0 sin penalización.
- Debajo del 🏆 Campeón se agrega el bloque **3.º / 4.º puesto**: el cruce `ko_tercer_1`
  (tocable / bloqueado igual que el resto) y el rótulo del 3.º (ganador) y 4.º (perdedor)
  cuando se conocen.
- La interacción de elegir (tocar para avanzar) no cambia para los cruces abiertos.

### 7. Fuente de datos — campo de ganador opcional

La forma común de evento se extiende con un campo opcional `ganador` (nombre del equipo que
avanza), para fuentes que lo conocen:

- **TheSportsDB** (gratis, primaria): no expone avanzado en penales → `ganador` queda
  `undefined`; `applyKnockout` deriva por goles. Penales sin definición → cruce pendiente.
- **API-Football** (si hay `apiFootballKey`): expone el equipo ganador (incl. penales) → puebla
  `ganador`, resolviendo el 100% de los cruces automáticamente.

Esta es la **única limitación de datos** conocida: con solo la fuente gratuita, un cruce
definido por penales puede quedar pendiente hasta tener una fuente que indique el avanzado.

## Flujo de sync resultante

`runSync`: `ensureSeeded()` → `updates = syncWithSources(...)` → `applySync(updates)` (grupos)
→ `applyKnockout(updates)` (llaves) → `setTick(t+1)`.

`applyKnockout` devuelve `{ resolved }` (cruces que cambiaron) y, si hubo cambios, llama a
`recomputeKnockoutForAllUsers(winnersById)` una sola vez.

## Plan de pruebas

- **Detección por identidad de equipos + cascada real**: un partido finalizado matchea su
  cruce y setea `ganador`; al resolverse un Dieciseisavo, su Octavo recibe al equipo real.
- **Iteración hasta estabilizar**: dos rondas que se resuelven en el mismo lote de `updates`.
- **Ganador por goles** y **fallback pendiente** en empate sin `ganador` de fuente.
- **Overlay de realidad**: el cuadro del usuario muestra el equipo real avanzando aunque el
  usuario haya elegido a otro; el pick de la fase siguiente con el equipo eliminado se invalida
  y se puede re-predecir.
- **Puntaje**: +20 al acertar el ganador real; 0 al errar; 0 (sin error) sin pick.
- **3.º puesto**: perdedores de las semis; ganador = 3.º, otro = 4.º; suma 20.
- **Anti-storm**: `recomputeKnockoutForAllUsers` hace una sola pasada O(usuarios); idempotencia
  (segundo sync sin cambios no escribe); guard de `elimination_matches` vacío no pisa.
- **Regresión**: test que falle si se volviera a recalcular por-cruce dentro de un loop de
  partidos (patrón que causó el storm).
- **Siembra**: bump de versión agrega `ko_tercer_1` sin pisar `ganador` existentes ni `matches`.

## Fuera de alcance (YAGNI)

- No se cargan goles ni eventos de los partidos de eliminatorias (solo el ganador).
- No hay predicción de marcador en llaves (solo quién avanza).
- No se agrega carga manual de ganadores; los penales no resueltos por la fuente quedan
  pendientes y se reintentan.
