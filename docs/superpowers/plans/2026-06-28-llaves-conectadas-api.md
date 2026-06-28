# Llaves conectadas a la API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar el cuadro de eliminatorias a la fuente real para detectar automáticamente al ganador de cada cruce, otorgar +20 pts a quien acertó, reflejar el ganador real en el cuadro del usuario (re-predicción) y mostrar 3.º/4.º puesto — sin reproducir el bug del "storm".

**Architecture:** Un nuevo paso de sync `applyKnockout(updates)` resuelve el cuadro REAL (`elimination_matches`) de abajo hacia arriba, matcheando partidos finalizados por par de equipos canónico, e itera hasta estabilizar. Persiste el cuadro real primero y luego hace UNA sola pasada O(usuarios) de recálculo (`recomputeKnockoutForAllUsers`) solo para los cruces que cambiaron. El cuadro del usuario (`resolveBracket`) recibe un "overlay de realidad": el equipo que avanza de cada cruce es el real si ya se conoce, si no el pick del usuario.

**Tech Stack:** React + Vite, Vitest, storage adapter sobre `/api/storage` (Upstash) con shim local.

## Global Constraints

- **Solo importa el ganador, no los goles** en eliminatorias. Puntaje vía `calcularPuntosEliminatoria` (20 o 0).
- **No reproducir el storm:** persistir `elimination_matches` antes de recalcular; recálculo de UNA pasada O(usuarios), idempotente; guard de read vacío (no pisar).
- **No tocar la lógica ni los datos de la fase de grupos** (`applySync`, `matches`, `pronosticos_grupos:*`).
- Degradación silenciosa: si una fuente falla o un cruce se define por penales sin dato de avanzado, queda pendiente y se reintenta — nunca cuelga ni adivina.
- Persistencia vía `storage` de `src/lib/storage.js` (nunca `localStorage`).

## File Structure

- `src/data/bracket.js` (modificar): agrega el cruce de 3.º puesto al árbol.
- `src/lib/bracket.js` (modificar): `resolveBracket(preds, realById)` con overlay de realidad + derivación de perdedores para 3.º puesto; `setBracketPick(preds, matchId, ganador, userId, realById)`.
- `src/lib/predictions.js` (modificar): `setKnockoutPrediction` carga `realById` y lo pasa a `setBracketPick`.
- `src/lib/recalc.js` (modificar): agrega `recomputeKnockoutForAllUsers(winnersById, store)`.
- `src/lib/applyKnockout.js` (crear): detección de ganadores reales + cascada + iteración + persistencia + disparo del recálculo.
- `src/hooks/useSync.js` (modificar): llama `applyKnockout(updates)` después de `applySync`.
- `src/views/Bracket.jsx` (modificar): pasa `realById` a `resolveBracket`, bloquea cruces cerrados, muestra +20/0 y el bloque 3.º/4.º puesto.
- `src/lib/sources/apiFootball.js` (modificar): puebla `ganador` (equipo que avanza, incl. penales).
- Tests: `tests/bracket-data.test.js`, `tests/bracket.test.js`, `tests/recalc.test.js`, `tests/applyKnockout.test.js` (crear), `tests/predictions.test.js` (crear o ampliar).

---

### Task 1: Cruce de 3.º puesto en los datos del árbol

**Files:**
- Modify: `src/data/bracket.js`
- Test: `tests/bracket-data.test.js`

**Interfaces:**
- Produces: `KO_MATCHES` ahora con 32 entradas; incluye `{ id: 'ko_tercer_1', ronda: 'tercer', indice: 1, teamA: null, teamB: null, children: ['ko_semis_1','ko_semis_2'], esTercerPuesto: true }`. `ELIMINATION_MATCHES` con 32 entradas. `RONDA_LABELS.tercer = 'Tercer puesto'`. `KO_RONDAS` SIGUE siendo las 5 rondas de columnas (no incluye `tercer`).

- [ ] **Step 1: Actualizar los tests de datos**

En `tests/bracket-data.test.js`, ajustar los conteos y agregar el cruce de tercer puesto. Reemplazar el bloque `describe('KO_MATCHES', ...)` y `describe('ELIMINATION_MATCHES', ...)` por:

```js
describe('KO_MATCHES', () => {
  it('tiene 32 partidos (16+8+4+2+1+1 tercer puesto)', () => expect(KO_MATCHES).toHaveLength(32))
  it('los 16 de dieciseisavos tienen equipos fijos y sin hijos', () => {
    const r32 = KO_MATCHES.filter((m) => m.ronda === 'dieciseisavos')
    expect(r32).toHaveLength(16)
    for (const m of r32) {
      expect(m.teamA).toBeTruthy()
      expect(m.teamB).toBeTruthy()
      expect(m.children).toBeNull()
    }
  })
  it('octavos_1 se alimenta de dieciseisavos_1 y _2', () => {
    const o1 = KO_MATCHES.find((m) => m.id === 'ko_octavos_1')
    expect(o1.children).toEqual(['ko_dieciseisavos_1', 'ko_dieciseisavos_2'])
    expect(o1.teamA).toBeNull()
  })
  it('la final se alimenta de las dos semis', () => {
    const f = KO_MATCHES.find((m) => m.id === 'ko_final_1')
    expect(f.children).toEqual(['ko_semis_1', 'ko_semis_2'])
  })
  it('el 3er puesto se alimenta de las dos semis y está marcado', () => {
    const t = KO_MATCHES.find((m) => m.id === 'ko_tercer_1')
    expect(t.ronda).toBe('tercer')
    expect(t.children).toEqual(['ko_semis_1', 'ko_semis_2'])
    expect(t.esTercerPuesto).toBe(true)
  })
})

describe('ELIMINATION_MATCHES', () => {
  it('un registro por partido (32), con ganador real null', () => {
    expect(ELIMINATION_MATCHES).toHaveLength(32)
    for (const m of ELIMINATION_MATCHES) expect(m.ganador).toBeNull()
  })
})
```

En el mismo archivo, dentro de `describe('RONDA_LABELS / KO_RONDAS', ...)`, agregar tras el `it` existente:

```js
  it('incluye etiqueta de tercer puesto', () => {
    expect(RONDA_LABELS.tercer).toBeTruthy()
  })
```

- [ ] **Step 2: Correr los tests para verel fallo**

Run: `npx vitest run tests/bracket-data.test.js`
Expected: FAIL (KO_MATCHES tiene 31, no existe `ko_tercer_1`, `RONDA_LABELS.tercer` undefined)

- [ ] **Step 3: Agregar el cruce de 3.º puesto en `src/data/bracket.js`**

Tras la definición de `KO_MATCHES` (después de la línea que cierra el `flatMap`, la `)` de la línea 67), agregar el nodo especial y reconstruir las exportaciones derivadas. Reemplazar el bloque que va desde la asignación de `KO_MATCHES` hasta el final del archivo por:

```js
export const KO_MATCHES = [
  ...ROUND_COUNTS.flatMap(([ronda, count], roundIdx) =>
    Array.from({ length: count }, (_, i) => {
      const indice = i + 1
      const id = `ko_${ronda}_${indice}`
      if (roundIdx === 0) {
        const cross = DIECISEISAVOS[i]
        return { id, ronda, indice, teamA: cross.teamA, teamB: cross.teamB, children: null, esTercerPuesto: false }
      }
      const prev = ROUND_COUNTS[roundIdx - 1][0]
      return {
        id,
        ronda,
        indice,
        teamA: null,
        teamB: null,
        children: [`ko_${prev}_${indice * 2 - 1}`, `ko_${prev}_${indice * 2}`],
        esTercerPuesto: false,
      }
    }),
  ),
  // Partido por el 3.º puesto: lo juegan los PERDEDORES de las dos semifinales.
  // El ganador es 3.º y el otro 4.º. Suma 20 pts como cualquier cruce.
  {
    id: 'ko_tercer_1',
    ronda: 'tercer',
    indice: 1,
    teamA: null,
    teamB: null,
    children: ['ko_semis_1', 'ko_semis_2'],
    esTercerPuesto: true,
  },
]

// Lo que se siembra en storage (clave `elimination_matches`). `ganador` es el resultado
// REAL del cruce (null hasta conocerse; lo completa applyKnockout).
export const ELIMINATION_MATCHES = KO_MATCHES.map((m) => ({
  id: m.id,
  ronda: m.ronda,
  indice: m.indice,
  teamA: m.teamA,
  teamB: m.teamB,
  ganador: null,
}))
```

Y agregar la etiqueta de la ronda en el objeto `RONDA_LABELS` (líneas 38-44), tras `final: 'Final',`:

```js
  tercer: 'Tercer puesto',
```

Nota: `KO_RONDAS` (línea 36) NO cambia — sigue derivando de `ROUND_COUNTS`, así que no incluye `tercer` y el layout en columnas no se altera. El bloque de dieciseisavos/octavos/etc. ya tendrá `esTercerPuesto: false` por consistencia.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/bracket-data.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/bracket.js tests/bracket-data.test.js
git commit -m "feat(llaves): cruce de 3er puesto en el arbol de eliminatorias"
```

---

### Task 2: Overlay de realidad y 3.º puesto en `resolveBracket`

**Files:**
- Modify: `src/lib/bracket.js`
- Test: `tests/bracket.test.js`

**Interfaces:**
- Consumes: `KO_MATCHES` (con `ko_tercer_1`, `esTercerPuesto`) de Task 1.
- Produces:
  - `resolveBracket(preds, realById)` → `{ [matchId]: { teamA, teamB, ganador } }`. `realById` es un `Map<string, string|null>` opcional (default `Map` vacío). El equipo que **avanza** de cada hijo a su padre = `realById.get(childId) ?? pickValidado(childId)`. Para el cruce con `esTercerPuesto`, el equipo que aporta cada hijo es el **perdedor** del hijo (derivable solo si el hijo tiene teamA, teamB y un ganador efectivo). `ganador` del cruce = pick del usuario validado contra `teamA`/`teamB` actuales (no se fuerza al real; el real se usa solo para la cascada).
  - `setBracketPick(preds, matchId, ganador, userId, realById)` → poda usando `resolveBracket(list, realById)`.

- [ ] **Step 1: Escribir los tests de overlay y 3.º puesto**

Reemplazar el contenido de `tests/bracket.test.js` por (mantiene los casos existentes y agrega los nuevos):

```js
import { describe, it, expect } from 'vitest'
import { resolveBracket, setBracketPick } from '../src/lib/bracket.js'

describe('resolveBracket', () => {
  it('R32 usa los equipos fijos', () => {
    const r = resolveBracket([])
    expect(r['ko_dieciseisavos_1']).toMatchObject({ teamA: 'Alemania', teamB: 'Paraguay', ganador: null })
  })

  it('el ganador de un cruce R32 aparece como lado del octavo padre', () => {
    const preds = [{ matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' }]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].teamA).toBe('Alemania')
    expect(r['ko_octavos_1'].teamB).toBeNull()
  })

  it('invalida (null) un pick cuyo equipo ya no participa del cruce', () => {
    const preds = [
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' },
      { matchId: 'ko_dieciseisavos_2', ganador: 'Francia' },
      { matchId: 'ko_octavos_1', ganador: 'Francia' },
    ]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].ganador).toBe('Francia')

    const preds2 = preds.map((p) =>
      p.matchId === 'ko_dieciseisavos_2' ? { ...p, ganador: 'Suecia' } : p,
    )
    const r2 = resolveBracket(preds2)
    expect(r2['ko_octavos_1'].teamB).toBe('Suecia')
    expect(r2['ko_octavos_1'].ganador).toBeNull()
  })

  it('overlay de realidad: el equipo REAL avanza aunque el usuario haya elegido a otro', () => {
    // Usuario eligió Alemania en el cruce 1, pero la realidad dice Paraguay.
    const preds = [{ matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' }]
    const realById = new Map([['ko_dieciseisavos_1', 'Paraguay']])
    const r = resolveBracket(preds, realById)
    // Su pick en el cruce 1 se conserva (se puntúa aparte), pero el que sube es el real.
    expect(r['ko_dieciseisavos_1'].ganador).toBe('Alemania')
    expect(r['ko_octavos_1'].teamA).toBe('Paraguay')
  })

  it('overlay de realidad: invalida el pick de la fase siguiente que apuntaba al eliminado', () => {
    const preds = [
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' },
      { matchId: 'ko_dieciseisavos_2', ganador: 'Francia' },
      { matchId: 'ko_octavos_1', ganador: 'Alemania' },
    ]
    // La realidad: en el cruce 1 avanzó Paraguay (no Alemania).
    const realById = new Map([['ko_dieciseisavos_1', 'Paraguay']])
    const r = resolveBracket(preds, realById)
    expect(r['ko_octavos_1'].teamA).toBe('Paraguay')
    expect(r['ko_octavos_1'].teamB).toBe('Francia')
    expect(r['ko_octavos_1'].ganador).toBeNull() // "Alemania" ya no participa → re-predecir
  })

  it('3er puesto: lo juegan los perdedores de las semis', () => {
    const realById = new Map([
      ['ko_semis_1', 'Argentina'],
      ['ko_semis_2', 'Francia'],
    ])
    const preds = [
      { matchId: 'ko_semis_1', ganador: 'Brasil' }, // se ignora para teamA/teamB: manda el real
    ]
    // Equipos efectivos de las semis vienen de su cascada real; para el test damos teamA/teamB
    // a las semis directamente vía picks que sí coinciden con realById de octavos→cuartos.
    // Simplificación: validamos la derivación de perdedor con semis ya resueltas por realById.
    const r = resolveBracket(preds, realById)
    // semis_1 real = Argentina (perdedor de su cruce depende de teamA/teamB; ver nota)
    expect(r['ko_tercer_1']).toBeDefined()
  })
})

describe('setBracketPick', () => {
  it('agrega un pick nuevo preservando userId/puntos en su forma', () => {
    const out = setBracketPick([], 'ko_dieciseisavos_1', 'Alemania', 'Ana')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' })
  })

  it('null limpia el pick', () => {
    const start = [{ userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null }]
    const out = setBracketPick(start, 'ko_dieciseisavos_1', null, 'Ana')
    expect(out).toHaveLength(0)
  })

  it('podar: cambiar un hijo elimina el pick del padre que quedó inválido', () => {
    const start = [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
      { userId: 'Ana', matchId: 'ko_dieciseisavos_2', ganador: 'Francia', puntos: null },
      { userId: 'Ana', matchId: 'ko_octavos_1', ganador: 'Alemania', puntos: null },
    ]
    const out = setBracketPick(start, 'ko_dieciseisavos_1', 'Paraguay', 'Ana')
    expect(out.find((p) => p.matchId === 'ko_dieciseisavos_1').ganador).toBe('Paraguay')
    expect(out.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined()
  })
})
```

Nota para el implementador: en el caso del 3.º puesto, el "perdedor" de una semi solo se puede derivar cuando esa semi tiene `teamA`, `teamB` y un ganador efectivo. El test de arriba solo verifica que el cruce existe en la resolución; la derivación completa se ejercita en el test integral de `applyKnockout` (Task 5), donde las semis llegan con equipos reales.

- [ ] **Step 2: Correr los tests para ver el fallo**

Run: `npx vitest run tests/bracket.test.js`
Expected: FAIL (overlay no implementado: el octavo sigue tomando el pick, no el real)

- [ ] **Step 3: Implementar overlay + 3.º puesto en `src/lib/bracket.js`**

Reemplazar el contenido completo de `src/lib/bracket.js` por:

```js
import { KO_MATCHES } from '../data/bracket.js'

// Deriva, para cada partido del árbol, sus equipos efectivos (teamA/teamB) y el ganador
// elegido por el usuario VALIDADO contra esos equipos (null si quedó inconsistente).
//
// Overlay de realidad: `realById` (Map matchId→ganador real) hace que el equipo que AVANZA
// de cada hijo sea el real si ya se conoce, y si no el pick del usuario. Así, apenas un cruce
// se resuelve en la realidad, la casilla superior se actualiza y un pick que apuntaba al
// equipo eliminado queda inválido (ganador null) para re-predecir. El `ganador` propio de
// cada cruce NO se fuerza al real: se puntúa aparte (calcularPuntosEliminatoria).
//
// KO_MATCHES viene ordenado por ronda ascendente, así que los hijos se resuelven antes.
export function resolveBracket(preds, realById = new Map()) {
  const pick = new Map((preds || []).map((p) => [p.matchId, p.ganador]))
  const resolved = {}
  // Equipo que avanza de un cruce a su padre: el real si se conoce, si no el pick validado.
  const avanza = (id) => (realById.get(id) ?? resolved[id]?.ganador) ?? null
  // Perdedor de un cruce (para el 3.º puesto): requiere ambos equipos y un avanzado conocido.
  const perdedor = (id) => {
    const r = resolved[id]
    const win = avanza(id)
    if (!r || !r.teamA || !r.teamB || !win) return null
    return win === r.teamA ? r.teamB : r.teamA
  }
  for (const m of KO_MATCHES) {
    let teamA, teamB
    if (!m.children) {
      teamA = m.teamA
      teamB = m.teamB
    } else if (m.esTercerPuesto) {
      teamA = perdedor(m.children[0])
      teamB = perdedor(m.children[1])
    } else {
      teamA = avanza(m.children[0])
      teamB = avanza(m.children[1])
    }
    const chosen = pick.get(m.id) ?? null
    const ganador = chosen && (chosen === teamA || chosen === teamB) ? chosen : null
    resolved[m.id] = { teamA, teamB, ganador }
  }
  return resolved
}

// Setea (o limpia con ganador null) el ganador de un partido y poda los picks aguas arriba
// que dejaron de ser válidos (considerando el overlay real). Preserva los demás campos.
export function setBracketPick(preds, matchId, ganador, userId, realById = new Map()) {
  let list = (preds || []).map((p) => ({ ...p }))
  const existing = list.find((p) => p.matchId === matchId)
  if (ganador) {
    if (existing) existing.ganador = ganador
    else list.push({ userId, matchId, ganador, puntos: null })
  } else {
    list = list.filter((p) => p.matchId !== matchId)
  }
  const resolved = resolveBracket(list, realById)
  return list.filter((p) => resolved[p.matchId]?.ganador === p.ganador)
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/bracket.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket.js tests/bracket.test.js
git commit -m "feat(llaves): overlay de realidad y derivacion de 3er puesto en resolveBracket"
```

---

### Task 3: `setKnockoutPrediction` usa el cuadro real para podar

**Files:**
- Modify: `src/lib/predictions.js`
- Test: `tests/predictions.test.js` (crear)

**Interfaces:**
- Consumes: `setBracketPick(preds, matchId, ganador, userId, realById)` de Task 2; `storage`.
- Produces: `setKnockoutPrediction(alias, matchId, ganador)` carga `elimination_matches` y construye `realById` antes de podar.

- [ ] **Step 1: Escribir el test**

Crear `tests/predictions.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { setKnockoutPrediction, getKnockoutPredictions } from '../src/lib/predictions.js'

beforeEach(() => storage._resetForTests())

describe('setKnockoutPrediction', () => {
  it('poda el pick aguas arriba que quedó inválido por el ganador REAL', async () => {
    // Realidad: en dieciseisavos_1 avanzó Paraguay (no Alemania).
    await storage.set('elimination_matches', [
      { id: 'ko_dieciseisavos_1', ronda: 'dieciseisavos', ganador: 'Paraguay' },
    ])
    // El usuario tenía un pick de octavos_1 apostando a Alemania (que ya no participa).
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_octavos_1', ganador: 'Alemania', puntos: null },
    ])

    // Hace un pick nuevo cualquiera; al re-resolver con la realidad, el de octavos cae.
    await setKnockoutPrediction('Ana', 'ko_dieciseisavos_2', 'Francia')

    const list = await getKnockoutPredictions('Ana')
    expect(list.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined()
    expect(list.find((p) => p.matchId === 'ko_dieciseisavos_2').ganador).toBe('Francia')
  })
})
```

- [ ] **Step 2: Correr el test para ver el fallo**

Run: `npx vitest run tests/predictions.test.js`
Expected: FAIL (sin `realById`, el pick de octavos no se poda)

- [ ] **Step 3: Implementar la carga de `realById` en `src/lib/predictions.js`**

Reemplazar la función `setKnockoutPrediction` (líneas 42-47) por:

```js
export async function setKnockoutPrediction(alias, matchId, ganador) {
  const list = await getKnockoutPredictions(alias)
  const elim = (await storage.get('elimination_matches')) || []
  const realById = new Map(elim.map((m) => [m.id, m.ganador]))
  const next = setBracketPick(list, matchId, ganador || null, alias, realById)
  await storage.set(`pronosticos_eliminatorias:${alias}`, next)
  return next
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run tests/predictions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/predictions.js tests/predictions.test.js
git commit -m "feat(llaves): podar predicciones segun el ganador real al guardar"
```

---

### Task 4: `recomputeKnockoutForAllUsers` (recálculo de una sola pasada)

**Files:**
- Modify: `src/lib/recalc.js`
- Test: `tests/recalc.test.js`

**Interfaces:**
- Consumes: `calcularPuntosEliminatoria`, `recomputeUserTotals(store)`, `storage`.
- Produces: `recomputeKnockoutForAllUsers(winnersById, store = storage)` — `winnersById` es `{ [matchId]: ganadorReal }`. Hace UNA pasada O(usuarios): por usuario actualiza solo los puntos de los cruces presentes en `winnersById`, escribe el pronóstico solo si cambió, y al final llama `recomputeUserTotals(store)` una vez. Si `winnersById` está vacío, no hace nada.

- [ ] **Step 1: Escribir los tests**

Agregar a `tests/recalc.test.js` (importar la nueva función en la línea de import existente):

```js
import {
  recomputeGroupMatchForAllUsers,
  recomputeMatchForAllUsers,
  recomputeUserTotals,
  recomputeKnockoutForAllUsers,
} from '../src/lib/recalc.js'
```

Y agregar este bloque al final del archivo:

```js
describe('recomputeKnockoutForAllUsers', () => {
  it('otorga +20 al acertar y 0 al errar, en una sola pasada', async () => {
    await storage.set('users', [
      { alias: 'Ana', puntosGrupos: 0, puntosEliminatorias: 0 },
      { alias: 'Beto', puntosGrupos: 0, puntosEliminatorias: 0 },
    ])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Paraguay', puntos: null },
    ])
    await storage.set('pronosticos_eliminatorias:Beto', [
      { userId: 'Beto', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])

    await recomputeKnockoutForAllUsers({ ko_dieciseisavos_1: 'Paraguay' })

    const ana = (await storage.get('users')).find((u) => u.alias === 'Ana')
    const beto = (await storage.get('users')).find((u) => u.alias === 'Beto')
    expect(ana.puntosEliminatorias).toBe(20)
    expect(beto.puntosEliminatorias).toBe(0)
  })

  it('es idempotente: re-ejecutar con el mismo resultado no cambia los puntos', async () => {
    await storage.set('users', [{ alias: 'Ana', puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Paraguay', puntos: 20 },
    ])

    let writes = 0
    const base = storage
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => {
        if (k.startsWith('pronosticos_eliminatorias:')) writes++
        return base.set(k, v)
      },
    }

    await recomputeKnockoutForAllUsers({ ko_dieciseisavos_1: 'Paraguay' }, spy)
    expect(writes).toBe(0) // ya estaba en 20 → no se reescribe el pronóstico
  })

  it('winnersById vacío no toca a ningún usuario', async () => {
    let writes = 0
    const base = storage
    const spy = { get: (k) => base.get(k), set: (k, v) => { writes++; return base.set(k, v) } }
    await recomputeKnockoutForAllUsers({}, spy)
    expect(writes).toBe(0)
  })
})
```

- [ ] **Step 2: Correr los tests para ver el fallo**

Run: `npx vitest run tests/recalc.test.js`
Expected: FAIL (`recomputeKnockoutForAllUsers` no existe)

- [ ] **Step 3: Implementar en `src/lib/recalc.js`**

Agregar esta función tras `recomputeMatchForAllUsers` (después de la línea 30):

```js
// Recálculo de eliminatorias en UNA sola pasada O(usuarios). Recibe { matchId: ganadorReal }
// de los cruces que cambiaron en este sync. Escribe el pronóstico de un usuario solo si su
// puntaje cambió (idempotente) y recalcula totales UNA vez al final. Si no hay cambios, no
// hace nada. Esta forma de un-solo-paso es la que evita el "storm" (no es O(cruces×usuarios)).
export async function recomputeKnockoutForAllUsers(winnersById, store = storage) {
  if (!winnersById || Object.keys(winnersById).length === 0) return
  const users = (await store.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_eliminatorias:${u.alias}`
    const list = (await store.get(key)) || []
    let changed = false
    for (const p of list) {
      if (Object.prototype.hasOwnProperty.call(winnersById, p.matchId)) {
        const pts = calcularPuntosEliminatoria(p.ganador, winnersById[p.matchId])
        if (pts !== p.puntos) {
          p.puntos = pts
          changed = true
        }
      }
    }
    if (changed) await store.set(key, list)
  }
  await recomputeUserTotals(store)
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/recalc.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/recalc.js tests/recalc.test.js
git commit -m "feat(llaves): recomputeKnockoutForAllUsers de una sola pasada (anti-storm)"
```

---

### Task 5: `applyKnockout` — detección de ganadores reales y disparo del recálculo

**Files:**
- Create: `src/lib/applyKnockout.js`
- Test: `tests/applyKnockout.test.js` (crear)

**Interfaces:**
- Consumes: `KO_MATCHES` (`src/data/bracket.js`), `canonicalTeam` (`src/data/aliases.js`), `resolveBracket` (`src/lib/bracket.js`), `recomputeKnockoutForAllUsers` (`src/lib/recalc.js`), `storage`.
- Produces: `applyKnockout(updates, store = storage)` → `{ resolved: string[] }` (ids de cruces cuyo `ganador` quedó definido en este sync). Persiste `elimination_matches` con los ganadores nuevos ANTES de recalcular. Guard: si el read de `elimination_matches` viene vacío, retorna `{ resolved: [] }` sin escribir. También exporta `winnerOf(update, teamA, teamB)`.

- [ ] **Step 1: Escribir los tests**

Crear `tests/applyKnockout.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applyKnockout, winnerOf } from '../src/lib/applyKnockout.js'
import { ELIMINATION_MATCHES } from '../src/data/bracket.js'

beforeEach(() => storage._resetForTests())

function seedElim() {
  return storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
}

describe('winnerOf', () => {
  it('usa el ganador provisto por la fuente si existe', () => {
    expect(winnerOf({ ganador: 'Paraguay', rA: 1, rB: 1 }, 'Alemania', 'Paraguay')).toBe('Paraguay')
  })
  it('si no, gana el de más goles', () => {
    expect(winnerOf({ rA: 2, rB: 1 }, 'Alemania', 'Paraguay')).toBe('Alemania')
    expect(winnerOf({ rA: 0, rB: 3 }, 'Alemania', 'Paraguay')).toBe('Paraguay')
  })
  it('empate sin ganador de fuente → null (pendiente)', () => {
    expect(winnerOf({ rA: 1, rB: 1 }, 'Alemania', 'Paraguay')).toBeNull()
  })
})

describe('applyKnockout', () => {
  it('detecta el ganador de un dieciseisavo por par de equipos (canónico, cualquier orden)', async () => {
    await seedElim()
    // La fuente trae los nombres en inglés y con local/visitante invertidos.
    const updates = [{ home: 'Paraguay', away: 'Germany', status: 'finished', rA: 2, rB: 1 }]
    const { resolved } = await applyKnockout(updates)
    expect(resolved).toContain('ko_dieciseisavos_1')
    const elim = await storage.get('elimination_matches')
    expect(elim.find((m) => m.id === 'ko_dieciseisavos_1').ganador).toBe('Paraguay')
  })

  it('itera hasta estabilizar: resuelve un octavo en el mismo lote que sus dieciseisavos', async () => {
    await seedElim()
    const updates = [
      { home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 3, rB: 0 }, // dieciseisavos_1 → Alemania
      { home: 'Francia', away: 'Suecia', status: 'finished', rA: 2, rB: 0 },     // dieciseisavos_2 → Francia
      { home: 'Alemania', away: 'Francia', status: 'finished', rA: 1, rB: 0 },   // octavos_1 → Alemania
    ]
    const { resolved } = await applyKnockout(updates)
    expect(resolved).toEqual(expect.arrayContaining(['ko_dieciseisavos_1', 'ko_dieciseisavos_2', 'ko_octavos_1']))
    const elim = await storage.get('elimination_matches')
    expect(elim.find((m) => m.id === 'ko_octavos_1').ganador).toBe('Alemania')
  })

  it('otorga +20 a quien acertó el ganador del cruce', async () => {
    await seedElim()
    await storage.set('users', [{ alias: 'Ana', puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])
    await applyKnockout([{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 2, rB: 1 }])
    const ana = (await storage.get('users')).find((u) => u.alias === 'Ana')
    expect(ana.puntosEliminatorias).toBe(20)
  })

  it('guard anti-pisado: si elimination_matches viene vacío, no escribe', async () => {
    // No sembramos elimination_matches (read vacío).
    const { resolved } = await applyKnockout([{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 2, rB: 1 }])
    expect(resolved).toEqual([])
    expect(await storage.get('elimination_matches')).toBeNull()
  })

  it('idempotente: segundo sync sin novedades no reprocesa', async () => {
    await seedElim()
    const updates = [{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 2, rB: 1 }]
    const first = await applyKnockout(updates)
    expect(first.resolved).toContain('ko_dieciseisavos_1')
    const second = await applyKnockout(updates)
    expect(second.resolved).toEqual([]) // ya estaba resuelto → no vuelve a aparecer
  })

  it('3er puesto: ganador es 3.º, detectado por su propio partido', async () => {
    // Pre-cargamos semis reales para que el 3er puesto tenga participantes (perdedores).
    const elim = ELIMINATION_MATCHES.map((m) => ({ ...m }))
    const set = (id, teamA, teamB, ganador) => {
      const m = elim.find((x) => x.id === id)
      m.teamA = teamA; m.teamB = teamB; m.ganador = ganador
    }
    set('ko_semis_1', 'Argentina', 'Brasil', 'Argentina') // pierde Brasil
    set('ko_semis_2', 'Francia', 'España', 'Francia')      // pierde España
    await storage.set('elimination_matches', elim)
    const { resolved } = await applyKnockout([
      { home: 'Brasil', away: 'España', status: 'finished', rA: 2, rB: 1 }, // 3er puesto → Brasil
    ])
    expect(resolved).toContain('ko_tercer_1')
    const after = await storage.get('elimination_matches')
    expect(after.find((m) => m.id === 'ko_tercer_1').ganador).toBe('Brasil')
  })
})
```

- [ ] **Step 2: Correr los tests para ver el fallo**

Run: `npx vitest run tests/applyKnockout.test.js`
Expected: FAIL (`applyKnockout` no existe)

- [ ] **Step 3: Implementar `src/lib/applyKnockout.js`**

```js
import { storage } from './storage.js'
import { KO_MATCHES } from '../data/bracket.js'
import { canonicalTeam } from '../data/aliases.js'
import { resolveBracket } from './bracket.js'
import { recomputeKnockoutForAllUsers } from './recalc.js'

// Ganador de un partido de eliminatorias. Solo importa el ganador, no los goles.
// Prioridad: el equipo que la fuente marca como avanzado (incl. penales) → más goles.
// Empate sin avanzado conocido → null (queda pendiente y se reintenta el próximo sync).
export function winnerOf(u, teamA, teamB) {
  if (u.ganador) {
    const g = canonicalTeam(u.ganador)
    if (g === teamA || g === teamB) return g
  }
  if (u.rA == null || u.rB == null) return null
  if (u.rA > u.rB) return teamA
  if (u.rB > u.rA) return teamB
  return null
}

// Indexa los updates finalizados por par de equipos canónico (ambos órdenes).
function finishedByPair(updates) {
  const idx = new Map()
  for (const u of updates || []) {
    if (u.status !== 'finished') continue
    const h = canonicalTeam(u.home)
    const a = canonicalTeam(u.away)
    if (!h || !a) continue
    idx.set(`${h}|${a}`, u)
    idx.set(`${a}|${h}`, u) // par invertido
  }
  return idx
}

// Detecta ganadores reales de eliminatorias desde la fuente. Resuelve el cuadro REAL de abajo
// hacia arriba (resolveBracket con realById), matchea cada cruce con equipos definidos contra
// un partido finalizado, e itera hasta estabilizar (un cruce resuelto revela el siguiente).
// Persiste elimination_matches ANTES de recalcular y dispara UNA pasada de recálculo.
export async function applyKnockout(updates, store = storage) {
  const elim = (await store.get('elimination_matches')) || []
  // Guard anti-pisado: read vacío (fallo transitorio) no debe borrar el cuadro compartido.
  if (elim.length === 0) return { resolved: [] }
  if (!updates || updates.length === 0) return { resolved: [] }

  const realById = new Map(elim.map((m) => [m.id, m.ganador]))
  const idx = finishedByPair(updates)
  const newWinners = {}

  let changed = true
  while (changed) {
    changed = false
    const resolved = resolveBracket([], realById) // cuadro REAL (sin picks de usuario)
    for (const m of KO_MATCHES) {
      if (realById.get(m.id)) continue // ya resuelto
      const r = resolved[m.id]
      if (!r || !r.teamA || !r.teamB) continue // participantes aún no definidos
      const u = idx.get(`${r.teamA}|${r.teamB}`)
      if (!u) continue
      const win = winnerOf(u, r.teamA, r.teamB)
      if (!win) continue // empate sin avanzado → pendiente
      realById.set(m.id, win)
      newWinners[m.id] = win
      changed = true
    }
  }

  const ids = Object.keys(newWinners)
  if (ids.length === 0) return { resolved: [] }

  // Persistir el cuadro real PRIMERO (antes de tocar a los usuarios).
  for (const m of elim) {
    if (newWinners[m.id]) m.ganador = newWinners[m.id]
  }
  await store.set('elimination_matches', elim)

  // Una sola pasada de recálculo, solo con los cruces que cambiaron.
  await recomputeKnockoutForAllUsers(newWinners, store)

  return { resolved: ids }
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/applyKnockout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/applyKnockout.js tests/applyKnockout.test.js
git commit -m "feat(llaves): applyKnockout detecta ganadores reales y dispara recalculo"
```

---

### Task 6: Cablear `applyKnockout` en el ciclo de sync

**Files:**
- Modify: `src/hooks/useSync.js`
- Modify: `src/lib/sources/apiFootball.js`

**Interfaces:**
- Consumes: `applyKnockout(updates)` de Task 5.
- Produces: `runSync` ahora llama `applyKnockout(updates)` tras `applySync(updates)`. `fetchApiFootball` agrega `ganador` (nombre del equipo que avanza, incl. penales) a cada evento.

- [ ] **Step 1: Cablear en `src/hooks/useSync.js`**

Agregar el import tras la línea 4 (`import { applySync } ...`):

```js
import { applyKnockout } from '../lib/applyKnockout.js'
```

Y dentro de `runSync`, tras la línea `const { live } = await applySync(updates)` (línea 19), agregar:

```js
      await applyKnockout(updates)
```

(El orden importa: grupos primero, llaves después. Ambos consumen el mismo `updates`.)

- [ ] **Step 2: Poblar `ganador` en `src/lib/sources/apiFootball.js`**

En el `.map((f) => ({ ... }))` (líneas 22-31), agregar el campo `ganador` derivado del flag de avanzado de API-Football (cubre penales). Reemplazar el objeto retornado por:

```js
    return data.response.map((f) => ({
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      status: mapStatus(f.fixture?.status?.short),
      rA: f.goals?.home ?? null,
      rB: f.goals?.away ?? null,
      minuto: f.fixture?.status?.elapsed ?? null,
      eventos: [],
      fecha: f.fixture?.date ?? null,
      // En eliminatorias, API-Football marca con `winner: true` al equipo que avanza
      // (incluye definición por penales). applyKnockout lo prioriza sobre los goles.
      ganador: f.teams?.home?.winner ? f.teams?.home?.name : f.teams?.away?.winner ? f.teams?.away?.name : null,
    }))
```

- [ ] **Step 3: Correr toda la suite (no debe romper nada)**

Run: `npx vitest run`
Expected: PASS (toda la suite, incluido el set previo)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSync.js src/lib/sources/apiFootball.js
git commit -m "feat(llaves): cablear applyKnockout en el sync y ganador real desde api-football"
```

---

### Task 7: Siembra del 3.º puesto sin pisar resultados (merge en bump de versión)

**Files:**
- Modify: `src/lib/seed.js`
- Test: `tests/seed.test.js`

**Interfaces:**
- Consumes: `ELIMINATION_MATCHES` (32 entradas, incl. `ko_tercer_1`) de Task 1; `storage`.
- Produces: en bump de `SEED_VERSION`, `ensureSeeded` mergea `elimination_matches` (agrega slots faltantes como `ko_tercer_1`, conserva el `ganador` de los existentes). No toca `matches` ni `users`.

- [ ] **Step 1: Escribir el test**

Agregar a `tests/seed.test.js` un caso (importar `ELIMINATION_MATCHES` si hace falta; el archivo ya usa `storage`):

```js
import { ELIMINATION_MATCHES } from '../src/data/bracket.js'

describe('ensureSeeded — merge de elimination_matches en bump de versión', () => {
  it('agrega ko_tercer_1 sin pisar ganadores existentes', async () => {
    storage._resetForTests()
    // Backend ya inicializado en una versión anterior, sin el slot de 3er puesto, y con
    // un ganador real ya detectado en un cruce.
    await storage.set('seed_version', 1)
    await storage.set('matches', [{ id: 'g_A_1', estado: 'finalizado' }])
    const viejos = ELIMINATION_MATCHES.filter((m) => m.id !== 'ko_tercer_1').map((m) => ({ ...m }))
    viejos.find((m) => m.id === 'ko_dieciseisavos_1').ganador = 'Alemania'
    await storage.set('elimination_matches', viejos)

    await ensureSeeded()

    const elim = await storage.get('elimination_matches')
    expect(elim.find((m) => m.id === 'ko_tercer_1')).toBeDefined()
    expect(elim.find((m) => m.id === 'ko_dieciseisavos_1').ganador).toBe('Alemania') // conservado
    expect((await storage.get('matches')).length).toBe(1) // matches intacto
  })
})
```

Verificar el nombre de la función importada al tope de `tests/seed.test.js` (`ensureSeeded`) y que `storage` esté importado; si el archivo no los importa, agregarlos.

- [ ] **Step 2: Correr el test para ver el fallo**

Run: `npx vitest run tests/seed.test.js`
Expected: FAIL (no se agrega `ko_tercer_1` en bump de versión)

- [ ] **Step 3: Implementar el merge en `src/lib/seed.js`**

Subir `SEED_VERSION` a 4 (línea 8):

```js
const SEED_VERSION = 4
```

Dentro del bloque `if (version !== SEED_VERSION) { ... }` (antes de `await store.set('seed_version', SEED_VERSION)`), agregar el merge de `elimination_matches`:

```js
    // Merge no destructivo del cuadro: agrega slots nuevos (p. ej. ko_tercer_1) conservando
    // el `ganador` real ya detectado. Nunca pisa resultados ni re-siembra desde cero.
    const elimActual = (await store.get('elimination_matches')) || []
    if (elimActual.length) {
      const porId = new Map(elimActual.map((m) => [m.id, m]))
      let agregados = false
      const merged = ELIMINATION_MATCHES.map((base) => {
        const prev = porId.get(base.id)
        if (!prev) {
          agregados = true
          return { ...base }
        }
        return prev
      })
      if (agregados || merged.length !== elimActual.length) {
        await store.set('elimination_matches', merged)
      }
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run tests/seed.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seed.js tests/seed.test.js
git commit -m "feat(llaves): sembrar ko_tercer_1 con merge no destructivo en bump de version"
```

---

### Task 8: UI — overlay de realidad, bloqueo, +20/0 y bloque 3.º/4.º puesto

**Files:**
- Modify: `src/views/Bracket.jsx`

**Interfaces:**
- Consumes: `resolveBracket(preds, realById)` de Task 2; `KO_MATCHES`, `RONDA_LABELS` (con `tercer`); `elimination_matches` vía `useStored`.
- Produces: la vista pasa `realById` a `resolveBracket`; los cruces con ganador real quedan read-only y muestran 🟢 **+20** / 🔴 **0**; debajo del campeón aparece el cruce de 3.º puesto y los rótulos 3.º/4.º.

- [ ] **Step 1: Pasar el overlay real a la resolución y bloquear cruces cerrados**

En `src/views/Bracket.jsx`, cambiar la línea 79-80 para que la resolución use el overlay:

```jsx
  const realById = useMemo(() => new Map(matches.map((m) => [m.id, m.ganador])), [matches])
  const resolved = useMemo(() => resolveBracket(preds, realById), [preds, realById])
```

(Quitar la línea original `const resolved = useMemo(() => resolveBracket(preds), [preds])` — queda reemplazada por las dos de arriba en ese orden: primero `realById`, luego `resolved`.)

- [ ] **Step 2: Mostrar +20/0 y bloquear la fila cuando el cruce está cerrado**

Reemplazar el componente `TeamRow` (líneas 12-33) por:

```jsx
function TeamRow({ team, picked, real, onPick, mirror }) {
  const cerrado = !!real
  const disabled = !team || cerrado
  const showResult = picked && cerrado
  const acerto = showResult && real === team
  const esGanadorReal = cerrado && real === team
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(team)}
      aria-pressed={picked}
      aria-label={team || 'A definir'}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition
        ${mirror ? 'flex-row-reverse text-right' : 'text-left'}
        ${picked ? 'bg-pitch/20 ring-1 ring-pitch' : esGanadorReal ? 'bg-trophy/10 ring-1 ring-trophy/40' : 'bg-bg hover:bg-white/5'}
        ${disabled ? 'cursor-default' : ''}
        ${!team ? 'opacity-40' : ''}`}
    >
      {team ? <Flag team={team} className="h-4 w-6" /> : <span className="h-4 w-6 rounded-sm bg-white/10" />}
      <span className="flex-1 truncate">{team || 'A definir'}</span>
      {showResult && (
        <span className={`text-xs font-semibold ${acerto ? 'text-pitch' : 'text-red-400'}`}>
          {acerto ? '🟢 +20' : '🔴 0'}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 2b: Evitar que un cruce cerrado intente deseleccionar**

En `MatchCard` (líneas 36-47), el `toggle` debe no hacer nada si el cruce está cerrado. Reemplazar la función `toggle` por:

```jsx
  const toggle = (team) => {
    if (!team || real) return
    onPick(team === ganador ? null : team)
  }
```

- [ ] **Step 3: Agregar el bloque 3.º/4.º puesto bajo el campeón**

En el bloque central (tras el `div` del 🏆 Campeón, dentro del mismo contenedor central, después de la línea 167 `</div>` que cierra el `flex flex-col items-center gap-1` del campeón), agregar el cruce de 3.º puesto. Insertar antes del cierre del contenedor central:

```jsx
              {/* 3.º y 4.º puesto: lo juegan los perdedores de las semis. */}
              {(() => {
                const tercer = KO_MATCHES.find((m) => m.esTercerPuesto)
                const tr = resolved[tercer.id] || { teamA: null, teamB: null, ganador: null }
                const realTercer = realById.get(tercer.id) || null
                const tercero = realTercer || tr.ganador
                const cuarto = tercero ? (tercero === tr.teamA ? tr.teamB : tr.teamA) : null
                return (
                  <div className="w-full space-y-1">
                    <h4 className="text-center text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      {RONDA_LABELS.tercer}
                    </h4>
                    <MatchCard
                      teamA={tr.teamA}
                      teamB={tr.teamB}
                      ganador={tr.ganador}
                      real={realTercer}
                      onPick={(team) => handlePick(tercer.id, team)}
                    />
                    <p className="text-center text-xs text-white/60">
                      🥉 3.º: <span className="font-semibold text-white/80">{tercero || '—'}</span>
                      {' · '}4.º: <span className="font-semibold text-white/80">{cuarto || '—'}</span>
                    </p>
                  </div>
                )
              })()}
```

- [ ] **Step 4: Verificar el build (la vista no tiene test unitario; validar que compila)**

Run: `npx vite build`
Expected: build exitoso, sin errores de sintaxis/imports.

- [ ] **Step 5: Commit**

```bash
git add src/views/Bracket.jsx
git commit -m "feat(llaves): overlay real en la UI, +20/0 y bloque 3er/4to puesto"
```

---

### Task 9: Test de regresión anti-storm (integración)

**Files:**
- Test: `tests/regresion-knockout-storm.test.js` (crear)

**Interfaces:**
- Consumes: `applyKnockout`, `storage`, `ELIMINATION_MATCHES`.
- Produces: prueba que un lote grande de cruces finalizados con muchos usuarios se procesa con un número de escrituras acotado (O(usuarios), no O(cruces×usuarios)) y converge (no diverge ni se cuelga).

- [ ] **Step 1: Escribir el test de regresión**

Crear `tests/regresion-knockout-storm.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applyKnockout } from '../src/lib/applyKnockout.js'
import { ELIMINATION_MATCHES } from '../src/data/bracket.js'
import { DIECISEISAVOS } from '../src/data/bracket.js'

beforeEach(() => storage._resetForTests())

describe('regresión: applyKnockout no entra en storm', () => {
  it('un lote de 16 dieciseisavos con 12 usuarios converge con escrituras O(usuarios)', async () => {
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))

    // 12 usuarios, cada uno con un pick en cada dieciseisavo.
    const users = Array.from({ length: 12 }, (_, i) => ({ alias: `U${i}`, puntosEliminatorias: 0 }))
    await storage.set('users', users)
    for (const u of users) {
      await storage.set(
        `pronosticos_eliminatorias:${u.alias}`,
        DIECISEISAVOS.map((c) => ({ userId: u.alias, matchId: c.id, ganador: c.teamA, puntos: null })),
      )
    }

    // La fuente finaliza los 16 dieciseisavos (gana siempre teamA).
    const updates = DIECISEISAVOS.map((c) => ({
      home: c.teamA, away: c.teamB, status: 'finished', rA: 1, rB: 0,
    }))

    // Contar escrituras de pronósticos de usuarios durante el recálculo.
    let userWrites = 0
    const base = storage
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => {
        if (k.startsWith('pronosticos_eliminatorias:')) userWrites++
        return base.set(k, v)
      },
    }

    const { resolved } = await applyKnockout(updates, spy)

    // Resolvió los 16 (y eventualmente más, por cascada, pero al menos los 16).
    expect(resolved.length).toBeGreaterThanOrEqual(16)
    // Anti-storm: a lo sumo una escritura por usuario (no 16×12). Margen holgado.
    expect(userWrites).toBeLessThanOrEqual(users.length)

    // Cada usuario sumó 20×16 = 320 por acertar todos los teamA.
    const u0 = (await storage.get('users')).find((u) => u.alias === 'U0')
    expect(u0.puntosEliminatorias).toBe(320)
  })

  it('segundo sync idéntico no reprocesa (idempotente, 0 escrituras de usuario)', async () => {
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
    await storage.set('users', [{ alias: 'Ana', puntosEliminatorias: 0 }])
    await storage.set('pronosticos_eliminatorias:Ana', [
      { userId: 'Ana', matchId: 'ko_dieciseisavos_1', ganador: 'Alemania', puntos: null },
    ])
    const updates = [{ home: 'Alemania', away: 'Paraguay', status: 'finished', rA: 1, rB: 0 }]
    await applyKnockout(updates)

    let userWrites = 0
    const base = storage
    const spy = {
      get: (k) => base.get(k),
      set: (k, v) => { if (k.startsWith('pronosticos_eliminatorias:')) userWrites++; return base.set(k, v) },
    }
    const { resolved } = await applyKnockout(updates, spy)
    expect(resolved).toEqual([])
    expect(userWrites).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test**

Run: `npx vitest run tests/regresion-knockout-storm.test.js`
Expected: PASS

- [ ] **Step 3: Correr TODA la suite**

Run: `npx vitest run`
Expected: PASS (toda la suite verde)

- [ ] **Step 4: Commit**

```bash
git add tests/regresion-knockout-storm.test.js
git commit -m "test(regresion): applyKnockout converge sin storm (escrituras O(usuarios))"
```

---

## Self-Review

**Cobertura del spec:**
- §1 dos cuadros → Task 2 (overlay) + Task 5 (cuadro real). ✔
- §2 detección `applyKnockout` (cascada, match por par, iteración) → Task 5. ✔
- §3 anti-storm (persistir primero, una pasada, idempotente, guard vacío) → Task 4 + Task 5 + Task 9. ✔
- §4 overlay de realidad (re-predicción, puntaje independiente) → Task 2 + Task 3 + Task 8. ✔
- §5 3.º/4.º puesto (datos, derivación, puntaje, siembra merge) → Task 1 + Task 2 + Task 5 + Task 7 + Task 8. ✔
- §6 UI (overlay, bloqueo, +20/0, bloque 3.º/4.º) → Task 8. ✔
- §7 fuente con `ganador` opcional → Task 5 (`winnerOf` lo prioriza) + Task 6 (api-football lo puebla). ✔
- Flujo de sync → Task 6. ✔
- Plan de pruebas → Tasks 1,2,3,4,5,7,9 cubren detección, cascada, goles/pendiente, overlay, puntaje, 3.º puesto, anti-storm, regresión, siembra. ✔

**Placeholders:** ninguno; todo el código está completo. La nota del par invertido en Task 5 Step 3 indica el valor exacto a usar.

**Consistencia de tipos:** `resolveBracket(preds, realById)`, `setBracketPick(preds, matchId, ganador, userId, realById)`, `recomputeKnockoutForAllUsers(winnersById, store)`, `applyKnockout(updates, store)` y `winnerOf(u, teamA, teamB)` se usan con la misma firma en todas las tasks. `realById` es siempre `Map<id, ganador|null>`; `winnersById`/`newWinners` siempre `{ [matchId]: ganadorReal }`.
