# Cuadro de eliminatorias con ganadores que avanzan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la sección "Llaves" por un cuadro de eliminación real (Dieciseisavos → Final) con cruces R32 fijos, donde el usuario elige el ganador de cada cruce y ese ganador avanza en cascada hasta el campeón; 20 puntos por ganador acertado.

**Architecture:** El cuadro se modela por partidos en `src/data/bracket.js` (16 cruces R32 hardcodeados + árbol derivado). La lógica de cascada e invalidación vive en una función pura nueva `src/lib/bracket.js`. La UI (`src/views/Bracket.jsx`) deriva el árbol del usuario con `resolveBracket` y persiste vía `predictions.js`. El scoring (`scoring.js`/`recalc.js`) pasa a 20 pts por partido.

**Tech Stack:** React 18 + Vite + Tailwind + framer-motion; Vitest para tests; storage propio (`src/lib/storage.js`).

## Global Constraints

- **No tocar datos de grupos.** Cero cambios sobre `pronosticos_grupos:{alias}`, `matches` (resultados de grupos) ni el campo `puntosGrupos` de los usuarios. Todos los cambios son sobre la sección de eliminatorias.
- **Persistencia vía `storage` (`src/lib/storage.js`), nunca `localStorage` nativo.**
- **Nombres de equipos exactamente como en `GRUPOS`** (`src/data/groups.js`) — es lo que espera `Flag`.
- **Mobile-first**, columnas con scroll horizontal.
- Test runner: `npm test` (= `vitest run`). Tests individuales: `npx vitest run <archivo>`.

---

### Task 1: Scoring de eliminatorias a 20/0

**Files:**
- Modify: `src/lib/scoring.js`
- Test: `tests/scoring.test.js`

**Interfaces:**
- Produces: `calcularPuntosEliminatoria(ganadorElegido, ganadorReal) -> 20 | 0`

- [ ] **Step 1: Actualizar el test de eliminatorias**

En `tests/scoring.test.js`, reemplazar el bloque `describe('calcularPuntosEliminatoria', ...)` (líneas 13-17) por:

```js
describe('calcularPuntosEliminatoria', () => {
  it('ganador acertado = 20', () => expect(calcularPuntosEliminatoria('Argentina', 'Argentina')).toBe(20))
  it('ganador equivocado = 0', () => expect(calcularPuntosEliminatoria('Brasil', 'Argentina')).toBe(0))
  it('sin elección = 0', () => expect(calcularPuntosEliminatoria(null, 'Argentina')).toBe(0))
  it('sin resultado real = 0', () => expect(calcularPuntosEliminatoria('Argentina', null)).toBe(0))
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/scoring.test.js`
Expected: FAIL (espera 20, recibe 10).

- [ ] **Step 3: Implementar el nuevo scoring**

En `src/lib/scoring.js`, reemplazar la función `calcularPuntosEliminatoria` (líneas 14-17) por:

```js
// Knockouts: all-or-nothing, sin marcador — solo el ganador del cruce.
export function calcularPuntosEliminatoria(ganadorElegido, ganadorReal) {
  return ganadorElegido != null && ganadorReal != null && ganadorElegido === ganadorReal ? 20 : 0
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/scoring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.js tests/scoring.test.js
git commit -m "feat(llaves): scoring de eliminatorias a 20 puntos por ganador"
```

---

### Task 2: Modelo de datos del cuadro

**Files:**
- Modify (reescribir): `src/data/bracket.js`
- Test: `tests/bracket-data.test.js` (crear)

**Interfaces:**
- Produces:
  - `DIECISEISAVOS: { id, teamA, teamB }[]` (16 cruces fijos)
  - `KO_RONDAS: string[]` = `['dieciseisavos','octavos','cuartos','semis','final']`
  - `RONDA_LABELS: Record<string,string>`
  - `KO_MATCHES: { id, ronda, indice, teamA: string|null, teamB: string|null, children: [string,string]|null }[]` (31 partidos, orden por ronda ascendente)
  - `ELIMINATION_MATCHES: { id, ronda, indice, teamA, teamB, ganador: null }[]` (lo que se siembra)

- [ ] **Step 1: Escribir el test del modelo**

Crear `tests/bracket-data.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { DIECISEISAVOS, KO_RONDAS, KO_MATCHES, ELIMINATION_MATCHES, RONDA_LABELS } from '../src/data/bracket.js'
import { GRUPOS } from '../src/data/groups.js'

const ALL_TEAMS = new Set(Object.values(GRUPOS).flat())

describe('DIECISEISAVOS', () => {
  it('tiene 16 cruces', () => expect(DIECISEISAVOS).toHaveLength(16))
  it('usa 32 equipos únicos, todos presentes en GRUPOS', () => {
    const teams = DIECISEISAVOS.flatMap((c) => [c.teamA, c.teamB])
    expect(new Set(teams).size).toBe(32)
    for (const t of teams) expect(ALL_TEAMS.has(t)).toBe(true)
  })
  it('primer cruce es Alemania vs Escocia', () => {
    expect(DIECISEISAVOS[0]).toMatchObject({ teamA: 'Alemania', teamB: 'Escocia' })
  })
})

describe('KO_MATCHES', () => {
  it('tiene 31 partidos (16+8+4+2+1)', () => expect(KO_MATCHES).toHaveLength(31))
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
})

describe('ELIMINATION_MATCHES', () => {
  it('un registro por partido, con ganador real null', () => {
    expect(ELIMINATION_MATCHES).toHaveLength(31)
    for (const m of ELIMINATION_MATCHES) expect(m.ganador).toBeNull()
  })
})

describe('RONDA_LABELS / KO_RONDAS', () => {
  it('cubre las 5 rondas en orden', () => {
    expect(KO_RONDAS).toEqual(['dieciseisavos', 'octavos', 'cuartos', 'semis', 'final'])
    for (const r of KO_RONDAS) expect(RONDA_LABELS[r]).toBeTruthy()
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/bracket-data.test.js`
Expected: FAIL (exports viejos `QUALIFIER_SLOTS`/`KO_SLOTS`, no existe `DIECISEISAVOS`).

- [ ] **Step 3: Reescribir `src/data/bracket.js`**

Reemplazar TODO el contenido de `src/data/bracket.js` por:

```js
// Cuadro de eliminatorias del Mundial 2026 (versión prode).
// Cruces de Dieciseisavos (R32) FIJOS e iguales para todos (detectados de la imagen
// de referencia; todos los equipos coinciden con GRUPOS). El usuario elige el ganador
// de cada cruce y ese ganador avanza en cascada hasta el campeón. 20 pts por acierto.

// El ORDEN de estos 16 cruces define todo el árbol: el partido i de la ronda superior
// enfrenta a los ganadores de los cruces (2i-1) y (2i) de la ronda anterior.
// Mitad izquierda = 1..8, mitad derecha = 9..16; se cruzan en la final.
export const DIECISEISAVOS = [
  { id: 'ko_dieciseisavos_1', teamA: 'Alemania', teamB: 'Escocia' },
  { id: 'ko_dieciseisavos_2', teamA: 'Francia', teamB: 'Suecia' },
  { id: 'ko_dieciseisavos_3', teamA: 'República de Corea', teamB: 'Suiza' },
  { id: 'ko_dieciseisavos_4', teamA: 'Países Bajos', teamB: 'Marruecos' },
  { id: 'ko_dieciseisavos_5', teamA: 'Colombia', teamB: 'Ghana' },
  { id: 'ko_dieciseisavos_6', teamA: 'España', teamB: 'Austria' },
  { id: 'ko_dieciseisavos_7', teamA: 'Estados Unidos', teamB: 'Argelia' },
  { id: 'ko_dieciseisavos_8', teamA: 'Egipto', teamB: 'Chequia' },
  { id: 'ko_dieciseisavos_9', teamA: 'Brasil', teamB: 'Japón' },
  { id: 'ko_dieciseisavos_10', teamA: 'Costa de Marfil', teamB: 'Noruega' },
  { id: 'ko_dieciseisavos_11', teamA: 'México', teamB: 'Cabo Verde' },
  { id: 'ko_dieciseisavos_12', teamA: 'Inglaterra', teamB: 'DR Congo' },
  { id: 'ko_dieciseisavos_13', teamA: 'Argentina', teamB: 'Uruguay' },
  { id: 'ko_dieciseisavos_14', teamA: 'Australia', teamB: 'Irán' },
  { id: 'ko_dieciseisavos_15', teamA: 'Canadá', teamB: 'Bélgica' },
  { id: 'ko_dieciseisavos_16', teamA: 'Portugal', teamB: 'Paraguay' },
]

const ROUND_COUNTS = [
  ['dieciseisavos', 16],
  ['octavos', 8],
  ['cuartos', 4],
  ['semis', 2],
  ['final', 1],
]

export const KO_RONDAS = ROUND_COUNTS.map(([r]) => r)

export const RONDA_LABELS = {
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semis: 'Semifinales',
  final: 'Final',
}

// Árbol completo de partidos. R32 trae teamA/teamB fijos de DIECISEISAVOS; cada partido
// superior referencia los dos partidos hijos que lo alimentan (teamA/teamB se derivan
// en runtime de los ganadores del usuario). El campeón = ganador de ko_final_1.
export const KO_MATCHES = ROUND_COUNTS.flatMap(([ronda, count], roundIdx) =>
  Array.from({ length: count }, (_, i) => {
    const indice = i + 1
    const id = `ko_${ronda}_${indice}`
    if (roundIdx === 0) {
      const cross = DIECISEISAVOS[i]
      return { id, ronda, indice, teamA: cross.teamA, teamB: cross.teamB, children: null }
    }
    const prev = ROUND_COUNTS[roundIdx - 1][0]
    return {
      id,
      ronda,
      indice,
      teamA: null,
      teamB: null,
      children: [`ko_${prev}_${indice * 2 - 1}`, `ko_${prev}_${indice * 2}`],
    }
  }),
)

// Lo que se siembra en storage (clave `elimination_matches`). `ganador` es el resultado
// REAL del cruce (null hasta conocerse; se completa por el mismo mecanismo que hoy).
export const ELIMINATION_MATCHES = KO_MATCHES.map((m) => ({
  id: m.id,
  ronda: m.ronda,
  indice: m.indice,
  teamA: m.teamA,
  teamB: m.teamB,
  ganador: null,
}))
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/bracket-data.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/bracket.js tests/bracket-data.test.js
git commit -m "feat(llaves): modelo de cuadro R32->final con cruces fijos"
```

---

### Task 3: Lógica de cascada (resolveBracket / setBracketPick)

**Files:**
- Create: `src/lib/bracket.js`
- Test: `tests/bracket.test.js` (crear)

**Interfaces:**
- Consumes: `KO_MATCHES` de `src/data/bracket.js`
- Produces:
  - `resolveBracket(preds) -> Record<matchId, { teamA, teamB, ganador }>` — deriva los equipos efectivos de cada partido y valida el ganador elegido (null si quedó stale).
  - `setBracketPick(preds, matchId, ganador, userId) -> preds[]` — setea/limpia un ganador y poda los picks aguas arriba que quedaron inconsistentes. Preserva los demás campos de cada pred.

- [ ] **Step 1: Escribir los tests de cascada**

Crear `tests/bracket.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolveBracket, setBracketPick } from '../src/lib/bracket.js'

describe('resolveBracket', () => {
  it('R32 usa los equipos fijos', () => {
    const r = resolveBracket([])
    expect(r['ko_dieciseisavos_1']).toMatchObject({ teamA: 'Alemania', teamB: 'Escocia', ganador: null })
  })

  it('el ganador de un cruce R32 aparece como lado del octavo padre', () => {
    const preds = [{ matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' }]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].teamA).toBe('Alemania')
    expect(r['ko_octavos_1'].teamB).toBeNull() // el otro hijo aún sin elegir
  })

  it('invalida (null) un pick cuyo equipo ya no participa del cruce', () => {
    const preds = [
      { matchId: 'ko_dieciseisavos_1', ganador: 'Alemania' },
      { matchId: 'ko_dieciseisavos_2', ganador: 'Francia' },
      { matchId: 'ko_octavos_1', ganador: 'Francia' }, // válido: octavos_1 = Alemania vs Francia
    ]
    const r = resolveBracket(preds)
    expect(r['ko_octavos_1'].ganador).toBe('Francia')

    // si ahora el hijo 2 da ganador a Suecia, "Francia" en octavos_1 deja de ser válido
    const preds2 = preds.map((p) =>
      p.matchId === 'ko_dieciseisavos_2' ? { ...p, ganador: 'Suecia' } : p,
    )
    const r2 = resolveBracket(preds2)
    expect(r2['ko_octavos_1'].teamB).toBe('Suecia')
    expect(r2['ko_octavos_1'].ganador).toBeNull()
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
    // re-elijo el hijo 1 a Escocia => "Alemania" en octavos_1 ya no participa
    const out = setBracketPick(start, 'ko_dieciseisavos_1', 'Escocia', 'Ana')
    expect(out.find((p) => p.matchId === 'ko_dieciseisavos_1').ganador).toBe('Escocia')
    expect(out.find((p) => p.matchId === 'ko_octavos_1')).toBeUndefined() // podado
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/bracket.test.js`
Expected: FAIL ("Failed to resolve import '../src/lib/bracket.js'").

- [ ] **Step 3: Implementar `src/lib/bracket.js`**

Crear `src/lib/bracket.js`:

```js
import { KO_MATCHES } from '../data/bracket.js'

// Deriva, para cada partido del árbol, sus equipos efectivos (teamA/teamB) y el ganador
// elegido por el usuario VALIDADO contra esos equipos (null si quedó inconsistente).
// KO_MATCHES viene ordenado por ronda ascendente, así que los hijos se resuelven antes.
export function resolveBracket(preds) {
  const pick = new Map((preds || []).map((p) => [p.matchId, p.ganador]))
  const resolved = {}
  for (const m of KO_MATCHES) {
    let teamA, teamB
    if (!m.children) {
      teamA = m.teamA
      teamB = m.teamB
    } else {
      teamA = resolved[m.children[0]]?.ganador ?? null
      teamB = resolved[m.children[1]]?.ganador ?? null
    }
    const chosen = pick.get(m.id) ?? null
    const ganador = chosen && (chosen === teamA || chosen === teamB) ? chosen : null
    resolved[m.id] = { teamA, teamB, ganador }
  }
  return resolved
}

// Setea (o limpia con ganador null) el ganador de un partido y poda los picks aguas
// arriba que dejaron de ser válidos. Preserva los demás campos de cada predicción.
export function setBracketPick(preds, matchId, ganador, userId) {
  let list = (preds || []).map((p) => ({ ...p }))
  const existing = list.find((p) => p.matchId === matchId)
  if (ganador) {
    if (existing) existing.ganador = ganador
    else list.push({ userId, matchId, ganador, puntos: null })
  } else {
    list = list.filter((p) => p.matchId !== matchId)
  }
  const resolved = resolveBracket(list)
  // conserva solo los picks que siguen siendo válidos tras la resolución/cascada
  return list.filter((p) => resolved[p.matchId]?.ganador === p.ganador)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/bracket.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket.js tests/bracket.test.js
git commit -m "feat(llaves): logica de cascada e invalidacion del cuadro"
```

---

### Task 4: predictions.js usa el nuevo modelo por partido

**Files:**
- Modify: `src/lib/predictions.js:41-51`

**Interfaces:**
- Consumes: `setBracketPick` de `src/lib/bracket.js`
- Produces: `setKnockoutPrediction(alias, matchId, ganador) -> Promise<preds[]>` (firma nueva: `matchId`, `ganador`)

- [ ] **Step 1: Reemplazar `setKnockoutPrediction`**

En `src/lib/predictions.js`, agregar el import al inicio (debajo del import de storage):

```js
import { setBracketPick } from './bracket.js'
```

Reemplazar la función `setKnockoutPrediction` (líneas 41-51) por:

```js
export async function setKnockoutPrediction(alias, matchId, ganador) {
  const list = await getKnockoutPredictions(alias)
  const next = setBracketPick(list, matchId, ganador || null, alias)
  await storage.set(`pronosticos_eliminatorias:${alias}`, next)
  return next
}
```

(`getKnockoutPredictions` no cambia.)

- [ ] **Step 2: Verificar que la suite no se rompe**

Run: `npm test`
Expected: PASS (los tests de scoring/bracket pasan; los de migrate se arreglan en Task 7 — si fallan ahí, es esperado y se resuelve en esa tarea). Confirmá que no hay errores de import en predictions.

- [ ] **Step 3: Commit**

```bash
git add src/lib/predictions.js
git commit -m "feat(llaves): setKnockoutPrediction por matchId con cascada"
```

---

### Task 5: recalc por partido

**Files:**
- Modify: `src/lib/recalc.js:18-30`

**Interfaces:**
- Consumes: `calcularPuntosEliminatoria(ganadorElegido, ganadorReal)` (Task 1)
- Produces: `recomputeMatchForAllUsers(matchId, ganadorReal) -> Promise<void>`

- [ ] **Step 1: Reemplazar `recomputeSlotForAllUsers`**

En `src/lib/recalc.js`, reemplazar la función `recomputeSlotForAllUsers` (líneas 18-30) por:

```js
export async function recomputeMatchForAllUsers(matchId, ganadorReal) {
  const users = (await storage.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_eliminatorias:${u.alias}`
    const list = (await storage.get(key)) || []
    const p = list.find((x) => x.matchId === matchId)
    if (p) {
      p.puntos = calcularPuntosEliminatoria(p.ganador, ganadorReal)
      await storage.set(key, list)
    }
  }
  await recomputeUserTotals()
}
```

(`recomputeUserTotals` no cambia: suma `p.puntos` y es agnóstico a la estructura.)

- [ ] **Step 2: Verificar imports / suite**

Run: `npm test`
Expected: PASS salvo los de migrate (Task 7). Confirmá que recalc importa sin errores y que no quedaron referencias a `recomputeSlotForAllUsers` (no hay otros consumidores en `src/`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/recalc.js
git commit -m "feat(llaves): recompute de puntos por partido de eliminatorias"
```

---

### Task 6: Seed del nuevo cuadro + limpieza de pronósticos viejos

**Files:**
- Modify: `src/lib/seed.js`

**Interfaces:**
- Consumes: `ELIMINATION_MATCHES` de `src/data/bracket.js`, `recomputeUserTotals` de `src/lib/recalc.js`

- [ ] **Step 1: Reescribir `src/lib/seed.js`**

Reemplazar TODO el contenido de `src/lib/seed.js` por:

```js
import { storage } from './storage.js'
import { FIXTURES } from '../data/fixtures.js'
import { ELIMINATION_MATCHES } from '../data/bracket.js'
import { recomputeUserTotals } from './recalc.js'

// Subir esta versión fuerza re-sembrar partidos/cuadro cuando cambia su estructura.
// Los pronósticos de grupos NO se tocan (van por matchId).
const SEED_VERSION = 3

// Siembra el storage compartido con los partidos y el cuadro hardcodeados.
// La sincronización luego actualiza estos registros con datos reales.
export async function ensureSeeded() {
  const version = await storage.get('seed_version')
  const matches = await storage.get('matches')
  const stale = version !== SEED_VERSION

  if (stale || !matches || matches.length === 0) {
    await storage.set('matches', FIXTURES.map((m) => ({ ...m })))
  }

  const ko = await storage.get('elimination_matches')
  if (stale || !ko || ko.length === 0) {
    await storage.set('elimination_matches', ELIMINATION_MATCHES.map((m) => ({ ...m })))
  }

  if (stale) {
    // El modelo viejo de eliminatorias (slots `pos_`/`ko_*` con `slotId`) es incompatible
    // con el nuevo (por `matchId`). Descartamos esos pronósticos sin tocar los de grupos.
    let limpiado = false
    const users = (await storage.get('users')) || []
    for (const u of users) {
      const key = `pronosticos_eliminatorias:${u.alias}`
      const list = (await storage.get(key)) || []
      const cleaned = list.filter((p) => p.matchId)
      if (cleaned.length !== list.length) {
        await storage.set(key, cleaned)
        limpiado = true
      }
    }
    if (limpiado) await recomputeUserTotals()
    await storage.set('seed_version', SEED_VERSION)
  }
}
```

- [ ] **Step 2: Verificar build/suite**

Run: `npm test`
Expected: PASS salvo migrate (Task 7). Confirmá que seed importa sin errores de import.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seed.js
git commit -m "feat(llaves): seed del nuevo cuadro y limpieza de pronosticos viejos"
```

---

### Task 7: Migración por matchId

**Files:**
- Modify: `src/lib/migrate.js:101`
- Test: `tests/migrate.test.js:123,136`

**Interfaces:**
- Consumes: `mergeByKey(remote, local, 'matchId')`

- [ ] **Step 1: Actualizar el test de migración**

En `tests/migrate.test.js`, en el test `'merges users + predictions, re-scores, totals, and reports a summary'`:

Reemplazar la línea 123:

```js
      'pronosticos_eliminatorias:Beto': [{ slotId: 'pos_A_1', equipoElegido: 'México', puntos: null }],
```

por:

```js
      'pronosticos_eliminatorias:Beto': [{ matchId: 'ko_dieciseisavos_13', ganador: 'Argentina', puntos: null }],
```

(La aserción `expect(summary.llavesAdded).toBe(1)` de la línea 136 queda igual.)

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run tests/migrate.test.js`
Expected: FAIL en `llavesAdded` (el merge sigue usando `slotId`, así que la entrada con `matchId` no se cuenta bien).

- [ ] **Step 3: Cambiar la clave de merge de eliminatorias**

En `src/lib/migrate.js`, línea 101, reemplazar:

```js
    const mergedE = mergeByKey(remoteE, localE, 'slotId')
```

por:

```js
    const mergedE = mergeByKey(remoteE, localE, 'matchId')
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run tests/migrate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migrate.js tests/migrate.test.js
git commit -m "feat(llaves): migracion de pronosticos de eliminatorias por matchId"
```

---

### Task 8: Copy de scoring (ScoringInfo) a 20 pts

**Files:**
- Modify: `src/components/ScoringInfo.jsx:17-25,85-89`

- [ ] **Step 1: Actualizar reglas, resumen y nota de eliminatorias**

En `src/components/ScoringInfo.jsx`, reemplazar el bloque `ELIM_RULES` y `SUMMARY` (líneas 17-25) por:

```js
const ELIM_RULES = [
  { pts: '+20', label: 'Ganador del cruce', desc: 'el equipo que hiciste avanzar es el que realmente ganó el cruce' },
  { pts: '0', label: 'Incorrecto o vacío', desc: 'no se predicen marcadores, solo quién avanza' },
]

const SUMMARY = {
  grupos: 'Exacto +10 · Ganador +5 · Goles +2',
  eliminatorias: 'Ganador del cruce +20',
}
```

Y reemplazar la nota de la variante eliminatorias (líneas 85-89) por:

```js
              {variant === 'eliminatorias' && (
                <p className="mt-1 rounded-lg bg-bg/60 p-2 text-xs text-white/50">
                  Cada acierto vale +20 en cualquier ronda: Dieciseisavos, Octavos, Cuartos, Semis o Final.
                </p>
              )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScoringInfo.jsx
git commit -m "feat(llaves): copy de puntaje de eliminatorias a 20 puntos"
```

---

### Task 9: Reescribir la vista del cuadro

**Files:**
- Modify (reescribir): `src/views/Bracket.jsx`

**Interfaces:**
- Consumes: `KO_MATCHES`, `KO_RONDAS`, `RONDA_LABELS` de `src/data/bracket.js`; `resolveBracket` de `src/lib/bracket.js`; `getKnockoutPredictions`, `setKnockoutPrediction` de `src/lib/predictions.js`; `useStored` de `src/hooks/useStored.js`; `Flag`, `ScoringInfo`.

- [ ] **Step 1: Reescribir `src/views/Bracket.jsx`**

Reemplazar TODO el contenido de `src/views/Bracket.jsx` por:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { KO_MATCHES, KO_RONDAS, RONDA_LABELS } from '../data/bracket.js'
import { useStored } from '../hooks/useStored.js'
import { getKnockoutPredictions, setKnockoutPrediction } from '../lib/predictions.js'
import { resolveBracket } from '../lib/bracket.js'
import Flag from '../components/Flag.jsx'
import ScoringInfo from '../components/ScoringInfo.jsx'

// Una fila de equipo tocable dentro de un cruce. Si no hay equipo aún, muestra "A definir".
function TeamRow({ team, picked, real, onPick }) {
  const disabled = !team
  const showResult = picked && !!real
  const acerto = showResult && real === team
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(team)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition
        ${picked ? 'bg-pitch/20 ring-1 ring-pitch' : 'bg-bg hover:bg-white/5'}
        ${disabled ? 'cursor-default opacity-40' : ''}`}
    >
      {team ? <Flag team={team} className="h-4 w-6" /> : <span className="h-4 w-6 rounded-sm bg-white/10" />}
      <span className="flex-1 truncate">{team || 'A definir'}</span>
      {showResult && <span>{acerto ? '🟢' : '🔴'}</span>}
    </button>
  )
}

// Un cruce con sus dos equipos. Tocar de nuevo el elegido lo deselecciona.
function MatchCard({ teamA, teamB, ganador, real, onPick }) {
  const toggle = (team) => {
    if (!team) return
    onPick(team === ganador ? null : team)
  }
  return (
    <div className="space-y-1 rounded-xl bg-surface p-2">
      <TeamRow team={teamA} picked={!!ganador && ganador === teamA} real={real} onPick={toggle} />
      <TeamRow team={teamB} picked={!!ganador && ganador === teamB} real={real} onPick={toggle} />
    </div>
  )
}

export default function Bracket({ alias, tick }) {
  const matches = useStored('elimination_matches', tick) || []
  const [preds, setPreds] = useState([])

  useEffect(() => {
    getKnockoutPredictions(alias).then(setPreds)
  }, [alias, tick])

  const resolved = useMemo(() => resolveBracket(preds), [preds])
  const realById = useMemo(() => new Map(matches.map((m) => [m.id, m.ganador])), [matches])

  const handlePick = async (matchId, team) => {
    const list = await setKnockoutPrediction(alias, matchId, team)
    setPreds([...list])
  }

  const campeon = resolved['ko_final_1']?.ganador || null

  return (
    <div className="space-y-3">
      <ScoringInfo variant="eliminatorias" />

      <p className="text-sm text-white/50">
        Tocá el equipo que avanza en cada cruce. El ganador sube a la ronda siguiente
        hasta llegar al <span className="font-semibold text-trophy">campeón</span>.
      </p>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {KO_RONDAS.map((ronda) => {
            const roundMatches = KO_MATCHES.filter((m) => m.ronda === ronda)
            return (
              <div key={ronda} className="w-48 shrink-0 space-y-2">
                <h3 className="font-head text-sm font-semibold uppercase tracking-wide text-white/50">
                  {RONDA_LABELS[ronda]}
                </h3>
                {roundMatches.map((m) => {
                  const r = resolved[m.id] || { teamA: null, teamB: null, ganador: null }
                  return (
                    <MatchCard
                      key={m.id}
                      teamA={r.teamA}
                      teamB={r.teamB}
                      ganador={r.ganador}
                      real={realById.get(m.id) || null}
                      onPick={(team) => handlePick(m.id, team)}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Campeón */}
          <div className="flex w-32 shrink-0 flex-col items-center justify-center gap-2">
            <span className="text-4xl">🏆</span>
            <span className="font-head text-sm text-white/50">Campeón</span>
            {campeon ? (
              <Flag team={campeon} className="h-7 w-10" />
            ) : (
              <span className="h-7 w-10 rounded-sm bg-white/10" />
            )}
            <span className="text-center text-sm font-semibold">{campeon || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build y suite completa**

Run: `npm run build`
Expected: build OK, sin errores de import ni de símbolos sin usar que rompan.

Run: `npm test`
Expected: PASS toda la suite.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`
Comprobar en el navegador (mobile view), pestaña Llaves:
1. Se ven 5 columnas (Dieciseisavos → Final) + Campeón, con scroll horizontal.
2. Dieciseisavos muestra los 16 cruces fijos (Alemania vs Escocia, …, Portugal vs Paraguay).
3. Tocar un equipo lo resalta y aparece como lado en la ronda siguiente.
4. Completar una rama hasta la final actualiza el 🏆 Campeón.
5. Cambiar un ganador abajo limpia los picks de arriba que dependían del equipo quitado.

- [ ] **Step 4: Commit**

```bash
git add src/views/Bracket.jsx
git commit -m "feat(llaves): cuadro interactivo con ganadores que avanzan"
```

---

## Self-Review

**Spec coverage:**
- Cruces R32 fijos hardcodeados → Task 2 (`DIECISEISAVOS`). ✓
- Cascada / elegir solo lo que el usuario formó → Task 3 (`resolveBracket`/`setBracketPick`), Task 9 (UI). ✓
- 20 pts por ganador → Task 1 (scoring), Task 5 (recalc), Task 8 (copy). ✓
- Eliminar sub-pestaña Clasificados y modelo viejo de slots → Task 2 (reescribe bracket.js), Task 9 (UI sin toggle). ✓
- Descartar pronósticos de eliminatorias viejos → Task 6 (limpieza en seed). ✓
- No tocar datos de grupos → ninguna tarea modifica `pronosticos_grupos`/`matches` de grupos/`puntosGrupos`. ✓
- Migración por matchId → Task 7. ✓
- UI estilo imagen con scroll horizontal → Task 9. ✓

**Placeholder scan:** El único "placeholder" es la función deliberada en Task 9 Step 1, con Step 2 dedicado a eliminarla — no es un placeholder de plan, es una instrucción explícita de limpieza. Sin TBD/TODO.

**Type consistency:** `setKnockoutPrediction(alias, matchId, ganador)` consistente entre Task 4 (def) y Task 9 (uso). `recomputeMatchForAllUsers(matchId, ganadorReal)` Task 5. `resolveBracket`/`setBracketPick` firmas iguales en Task 3 y consumidores. Campos de pred: `{ userId, matchId, ganador, puntos }` consistentes (Task 3, 5, 7). Clave de storage `elimination_matches` consistente (Task 2, 6, 9).
