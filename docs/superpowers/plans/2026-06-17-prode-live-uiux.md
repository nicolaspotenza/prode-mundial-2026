# Prode Mundial 2026 — Live + UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Prode Mundial 2026 web app — a World Cup prediction pool with on-entry data sync, live-match locking, daily standings, full match events, scoring, and a dynamic animated UI.

**Architecture:** Vite + React + Tailwind SPA. Pure domain logic (scoring, match-state, ranking, source parsers) lives in testable `src/lib/*` modules with Vitest TDD. Persistence goes through a `storage` adapter that uses the real Claude artifact `window.storage` when present and a localStorage-backed dev shim otherwise. A `sync` engine fetches results/events/standings (Promiedos scraping → API-Football → football-data fallback), derives the three match states, locks bets, and recomputes all users' points. Five views (Home, Grupos, Fase Grupos, Llaves, Ranking) consume shared storage.

**Tech Stack:** Vite, React 18, Tailwind CSS, Vitest + @testing-library, lucide-react (icons), framer-motion (animations), Barlow / Barlow Condensed (Google Fonts).

**Specs:** `prode-mundial.md` (master) + `docs/superpowers/specs/2026-06-17-prode-live-uiux-design.md` (this iteration).

---

## File Structure

```
index.html                      Vite entry, font + viewport meta
package.json                    deps + scripts
vite.config.js                  React plugin
tailwind.config.js              theme tokens (stadium palette, fonts)
postcss.config.js
src/
  main.jsx                      React root
  App.jsx                       shell: tab nav + active view + sync bootstrap
  index.css                     Tailwind layers + CSS tokens + keyframes
  config.js                     DATA_CONFIG (sources, livePollSeconds, intervals)
  data/
    teams.js                    48 teams: name + flag emoji
    groups.js                   GRUPOS_MUNDIAL_2026 (12 groups)
    fixtures.js                 104 group matches (id, group, date, teams)
    bracket.js                  knockout slots (R32→R16→QF→SF→Final)
  lib/
    storage.js                  window.storage adapter + dev shim
    scoring.js                  calcularPuntosGrupos / calcularPuntosEliminatoria
    matchState.js               deriveEstado / isBloqueado
    standings.js                computeStandings from finished matches
    ranking.js                  buildRanking from users
    recalc.js                   recomputeAllUsers on a finished match
    sources/
      promiedos.js              scrape + parse (primary)
      apiFootball.js            fallback 1
      footballData.js           fallback 2
      index.js                  syncResultados orchestrator + fallback chain
  hooks/
    useSync.js                  on-mount + focus + adaptive live polling
    useCurrentUser.js           alias register/select/change
  components/
    BottomNav.jsx
    MatchCard.jsx               score/live badge/lock/states
    MatchDetail.jsx             goals + cards + your points
    ScoreInput.jsx              goal inputs, disabled when locked
    LiveBadge.jsx               pulsing "EN VIVO"
    Skeleton.jsx
  views/
    Home.jsx
    GruposStandings.jsx
    FaseGrupos.jsx
    Bracket.jsx
    Ranking.jsx
    Onboarding.jsx              alias entry + autocomplete + dedupe
tests/                          Vitest specs mirror src/lib
```

---

## Task 1: Scaffold Vite + React + Tailwind project

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1: Scaffold and install**

Run:
```bash
npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
npm install lucide-react framer-motion
npx tailwindcss init -p
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules
dist
.DS_Store
*.local
```

- [ ] **Step 3: Configure Tailwind tokens** — `tailwind.config.js`

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F172A', surface: '#1F1E27',
        pitch: { DEFAULT: '#22C55E', dark: '#15803D' },
        trophy: '#F59E0B', indigo: '#6366F1', danger: '#DC2626',
      },
      fontFamily: { head: ['"Barlow Condensed"','sans-serif'], body: ['Barlow','sans-serif'] },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: `src/index.css`** — Tailwind layers + fonts + tokens + keyframes

```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600;700&display=swap');
@tailwind base; @tailwind components; @tailwind utilities;
:root { color-scheme: dark; }
body { @apply bg-bg text-white font-body; font-variant-numeric: tabular-nums; }
@keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.animate-live { animation: livePulse 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce){ .animate-live{animation:none} *{transition:none!important} }
```

- [ ] **Step 5: `index.html`** — add viewport + font preconnect inside `<head>`

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
```

- [ ] **Step 6: Configure Vitest** — add to `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
})
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 7: Verify dev server boots**

Run: `npm run dev` (Ctrl-C after it prints the local URL). Expected: Vite serves with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + Tailwind with stadium theme"
```

---

## Task 2: Scoring logic (TDD)

**Files:**
- Create: `src/lib/scoring.js`, `tests/scoring.test.js`

- [ ] **Step 1: Write failing tests** — `tests/scoring.test.js`

```js
import { describe, it, expect } from 'vitest'
import { calcularPuntosGrupos, calcularPuntosEliminatoria } from '../src/lib/scoring.js'

describe('calcularPuntosGrupos', () => {
  it('exact score = 10', () => expect(calcularPuntosGrupos(3,0,3,0)).toBe(10))
  it('correct winner only = 5 (3-1 pred, 3-0 real)', () => expect(calcularPuntosGrupos(3,1,3,0)).toBe(5))
  it('correct draw = 5 (1-1 pred, 2-2 real)', () => expect(calcularPuntosGrupos(1,1,2,2)).toBe(5))
  it('one team goals only = 2 (0-0 pred, 3-0 real)', () => expect(calcularPuntosGrupos(0,0,3,0)).toBe(2))
  it('both team goals but wrong winner = 4', () => expect(calcularPuntosGrupos(0,3,3,0)).toBe(4))
  it('nothing right = 0', () => expect(calcularPuntosGrupos(0,1,3,0)).toBe(0))
})

describe('calcularPuntosEliminatoria', () => {
  it('correct team = 10', () => expect(calcularPuntosEliminatoria('Argentina','Argentina')).toBe(10))
  it('wrong team = 0', () => expect(calcularPuntosEliminatoria('Brasil','Argentina')).toBe(0))
  it('no pick = 0', () => expect(calcularPuntosEliminatoria(null,'Argentina')).toBe(0))
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- scoring`
Expected: FAIL (module not found / functions undefined).

- [ ] **Step 3: Implement** — `src/lib/scoring.js`

```js
export function calcularPuntosGrupos(pA, pB, rA, rB) {
  if (pA === rA && pB === rB) return 10
  const gP = pA > pB ? 'A' : pA < pB ? 'B' : 'E'
  const gR = rA > rB ? 'A' : rA < rB ? 'B' : 'E'
  if (gP === gR) return 5
  let pts = 0
  if (pA === rA) pts += 2
  if (pB === rB) pts += 2
  return pts
}

export function calcularPuntosEliminatoria(elegido, clasificado) {
  return elegido != null && elegido === clasificado ? 10 : 0
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- scoring`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.js tests/scoring.test.js && git commit -m "feat: group + knockout scoring with tests"
```

---

## Task 3: Match-state derivation (TDD)

**Files:**
- Create: `src/lib/matchState.js`, `tests/matchState.test.js`

- [ ] **Step 1: Failing tests** — `tests/matchState.test.js`

```js
import { describe, it, expect } from 'vitest'
import { deriveEstado, isBloqueado } from '../src/lib/matchState.js'

describe('deriveEstado', () => {
  it('source finished overrides everything', () =>
    expect(deriveEstado({ status: 'finished' }, '2026-06-11T18:00:00Z', '2026-06-11T20:00:00Z')).toBe('finalizado'))
  it('source live -> en_vivo', () =>
    expect(deriveEstado({ status: 'live' }, '2026-06-11T18:00:00Z', '2026-06-11T18:30:00Z')).toBe('en_vivo'))
  it('no source info, kickoff in future -> programado', () =>
    expect(deriveEstado(null, '2026-06-11T22:00:00Z', '2026-06-11T18:00:00Z')).toBe('programado'))
  it('no source info, kickoff passed -> programado (never auto-live without source)', () =>
    expect(deriveEstado(null, '2026-06-11T10:00:00Z', '2026-06-11T18:00:00Z')).toBe('programado'))
})

describe('isBloqueado', () => {
  it('programado is editable', () => expect(isBloqueado('programado')).toBe(false))
  it('en_vivo is locked', () => expect(isBloqueado('en_vivo')).toBe(true))
  it('finalizado is locked', () => expect(isBloqueado('finalizado')).toBe(true))
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- matchState`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/matchState.js`

```js
// source: { status: 'finished' | 'live' | 'scheduled' } | null
export function deriveEstado(source, kickoffISO, nowISO) {
  if (source?.status === 'finished') return 'finalizado'
  if (source?.status === 'live') return 'en_vivo'
  return 'programado' // never auto-live without source confirmation (silent degradation)
}

export function isBloqueado(estado) {
  return estado !== 'programado'
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- matchState`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchState.js tests/matchState.test.js && git commit -m "feat: derive match state (programado/en_vivo/finalizado)"
```

---

## Task 4: Standings computation (TDD)

**Files:**
- Create: `src/lib/standings.js`, `tests/standings.test.js`

- [ ] **Step 1: Failing tests** — `tests/standings.test.js`

```js
import { describe, it, expect } from 'vitest'
import { computeStandings } from '../src/lib/standings.js'

const teams = ['Argentina','Argelia','Austria','Jordania']
const finished = [
  { equipoA:'Argentina', equipoB:'Argelia', resultadoA:3, resultadoB:0, estado:'finalizado' },
  { equipoA:'Austria', equipoB:'Jordania', resultadoA:1, resultadoB:1, estado:'finalizado' },
  { equipoA:'Argentina', equipoB:'Austria', resultadoA:2, resultadoB:1, estado:'finalizado' },
  { equipoA:'Argelia', equipoB:'Jordania', resultadoA:0, resultadoB:0, estado:'programado' }, // ignored
]

describe('computeStandings', () => {
  const table = computeStandings(teams, finished)
  it('Argentina top with 6 pts', () => {
    expect(table[0].equipo).toBe('Argentina')
    expect(table[0].pts).toBe(6)
    expect(table[0].pj).toBe(2)
    expect(table[0].dg).toBe(4)
  })
  it('ignores non-finished matches (Argelia pj=1)', () => {
    expect(table.find(r => r.equipo === 'Argelia').pj).toBe(1)
  })
  it('returns all 4 teams sorted by pts then dg', () => {
    expect(table.map(r => r.equipo)).toEqual(['Argentina','Austria','Jordania','Argelia'])
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- standings`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/standings.js`

```js
export function computeStandings(teams, matches) {
  const row = (equipo) => ({ equipo, pj:0, g:0, e:0, p:0, gf:0, gc:0, dg:0, pts:0 })
  const t = Object.fromEntries(teams.map(n => [n, row(n)]))
  for (const m of matches) {
    if (m.estado !== 'finalizado') continue
    if (!(m.equipoA in t) || !(m.equipoB in t)) continue
    const a = t[m.equipoA], b = t[m.equipoB]
    a.pj++; b.pj++
    a.gf += m.resultadoA; a.gc += m.resultadoB
    b.gf += m.resultadoB; b.gc += m.resultadoA
    if (m.resultadoA > m.resultadoB) { a.g++; b.p++; a.pts += 3 }
    else if (m.resultadoA < m.resultadoB) { b.g++; a.p++; b.pts += 3 }
    else { a.e++; b.e++; a.pts++; b.pts++ }
  }
  return Object.values(t)
    .map(r => ({ ...r, dg: r.gf - r.gc }))
    .sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.equipo.localeCompare(y.equipo))
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- standings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/standings.js tests/standings.test.js && git commit -m "feat: group standings computation with tests"
```

---

## Task 5: Ranking builder (TDD)

**Files:**
- Create: `src/lib/ranking.js`, `tests/ranking.test.js`

- [ ] **Step 1: Failing tests** — `tests/ranking.test.js`

```js
import { describe, it, expect } from 'vitest'
import { buildRanking } from '../src/lib/ranking.js'

const users = [
  { alias:'Ana', puntosGrupos:20, puntosEliminatorias:10 },
  { alias:'Beto', puntosGrupos:35, puntosEliminatorias:0 },
  { alias:'Caro', puntosGrupos:30, puntosEliminatorias:10 },
]

describe('buildRanking', () => {
  const r = buildRanking(users)
  it('sorts by total desc', () => expect(r.map(u => u.alias)).toEqual(['Caro','Beto','Ana']))
  it('assigns positions', () => expect(r[0].pos).toBe(1))
  it('computes total', () => expect(r[0].total).toBe(40))
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- ranking`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/ranking.js`

```js
export function buildRanking(users) {
  return users
    .map(u => ({ ...u, total: (u.puntosGrupos || 0) + (u.puntosEliminatorias || 0) }))
    .sort((a, b) => b.total - a.total || a.alias.localeCompare(b.alias))
    .map((u, i) => ({ ...u, pos: i + 1 }))
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- ranking`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ranking.js tests/ranking.test.js && git commit -m "feat: ranking builder with tests"
```

---

## Task 6: Storage adapter

**Files:**
- Create: `src/lib/storage.js`, `tests/storage.test.js`

- [ ] **Step 1: Failing test** — `tests/storage.test.js` (exercises the dev shim path)

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'

beforeEach(() => storage._resetForTests())

describe('storage adapter (dev shim)', () => {
  it('set then get returns parsed value', async () => {
    await storage.set('k', { a: 1 }, true)
    expect(await storage.get('k')).toEqual({ a: 1 })
  })
  it('missing key returns null', async () => {
    expect(await storage.get('missing')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- storage`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/storage.js`

```js
// Uses real Claude artifact window.storage when present (shared persistence).
// Falls back to a localStorage-backed dev shim for standalone/GitHub running and tests.
const hasArtifact = typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function'
let mem = {}

const shim = {
  async set(key, value) {
    const s = JSON.stringify(value)
    mem[key] = s
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('prode:' + key, s) } catch {}
  },
  async get(key) {
    let raw = mem[key]
    if (raw == null) { try { raw = localStorage?.getItem('prode:' + key) ?? undefined } catch {} }
    return raw == null ? null : JSON.parse(raw)
  },
}

export const storage = hasArtifact
  ? {
      async set(key, value, shared = true) { await window.storage.set(key, JSON.stringify(value), shared) },
      async get(key) { const d = await window.storage.get(key, true); return d ? JSON.parse(d.value) : null },
      _resetForTests() {},
    }
  : { ...shim, _resetForTests() { mem = {}; try { localStorage?.clear() } catch {} } }
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.js tests/storage.test.js && git commit -m "feat: storage adapter (window.storage + dev shim)"
```

---

## Task 7: Static data — teams, groups, fixtures, bracket

**Files:**
- Create: `src/data/teams.js`, `src/data/groups.js`, `src/data/fixtures.js`, `src/data/bracket.js`, `tests/data.test.js`

- [ ] **Step 1: Failing test** — `tests/data.test.js`

```js
import { describe, it, expect } from 'vitest'
import { GRUPOS } from '../src/data/groups.js'
import { TEAMS } from '../src/data/teams.js'
import { FIXTURES } from '../src/data/fixtures.js'
import { BRACKET } from '../src/data/bracket.js'

describe('static data', () => {
  it('12 groups of 4', () => {
    expect(Object.keys(GRUPOS).length).toBe(12)
    Object.values(GRUPOS).forEach(g => expect(g.length).toBe(4))
  })
  it('48 teams with flags', () => {
    expect(Object.keys(TEAMS).length).toBe(48)
    Object.values(TEAMS).forEach(f => expect(typeof f).toBe('string'))
  })
  it('every fixture team exists in TEAMS and has unique id', () => {
    const ids = new Set()
    FIXTURES.forEach(m => {
      expect(TEAMS[m.equipoA]).toBeTruthy()
      expect(TEAMS[m.equipoB]).toBeTruthy()
      expect(ids.has(m.id)).toBe(false); ids.add(m.id)
    })
  })
  it('bracket has rounds from r32 to final', () => {
    const rondas = new Set(BRACKET.map(s => s.ronda))
    ;['dieciseisavos','octavos','cuartos','semis','final'].forEach(r => expect(rondas.has(r)).toBe(true))
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- data`
Expected: FAIL.

- [ ] **Step 3: Implement data files**

`src/data/groups.js` — use `GRUPOS_MUNDIAL_2026` from `prode-mundial.md` lines 434-447 verbatim, exported as `GRUPOS`.

`src/data/teams.js` — `export const TEAMS = { 'México':'🇲🇽', ... }` mapping all 48 names in GRUPOS to flag emojis. (One entry per team name used in groups; names MUST match GRUPOS exactly.)

`src/data/fixtures.js` — `export const FIXTURES = [...]` the group-stage matches. Each: `{ id, fase:'grupos', grupo, fecha (ISO kickoff), equipoA, equipoB, resultadoA:null, resultadoB:null, estado:'programado', minuto:null, promiedosId }`. Generate the round-robin (6 matches per group × 12 = 72) using real fixture dates where known; where exact kickoff is unknown, use the official group-stage date with a placeholder time — this is hardcoded data and refined by sync.

`src/data/bracket.js` — `export const BRACKET = [...]` slots: 16 `dieciseisavos`, 8 `octavos`, 4 `cuartos`, 2 `semis`, 1 `final`. Each: `{ id, fase:'eliminatorias', ronda, posicion, equipoClasificado:null }`.

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- data`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data tests/data.test.js && git commit -m "feat: hardcoded teams, groups, fixtures, bracket"
```

---

## Task 8: Recalc-all-users engine (TDD)

**Files:**
- Create: `src/lib/recalc.js`, `tests/recalc.test.js`

- [ ] **Step 1: Failing test** — `tests/recalc.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { recomputeGroupMatchForAllUsers, recomputeUserTotals } from '../src/lib/recalc.js'

beforeEach(() => storage._resetForTests())

describe('recomputeGroupMatchForAllUsers', () => {
  it('awards points to every user with a prediction for the match', async () => {
    await storage.set('users', [
      { alias:'Ana', puntosGrupos:0, puntosEliminatorias:0 },
      { alias:'Beto', puntosGrupos:0, puntosEliminatorias:0 },
    ])
    await storage.set('pronosticos_grupos:Ana', [{ matchId:'m1', pronosticoA:3, pronosticoB:0, puntos:null }])
    await storage.set('pronosticos_grupos:Beto', [{ matchId:'m1', pronosticoA:1, pronosticoB:1, puntos:null }])

    await recomputeGroupMatchForAllUsers('m1', 3, 0)

    const ana = await storage.get('pronosticos_grupos:Ana')
    const beto = await storage.get('pronosticos_grupos:Beto')
    expect(ana[0].puntos).toBe(10)
    expect(beto[0].puntos).toBe(0)
    const users = await storage.get('users')
    expect(users.find(u => u.alias === 'Ana').puntosGrupos).toBe(10)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- recalc`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/recalc.js`

```js
import { storage } from './storage.js'
import { calcularPuntosGrupos, calcularPuntosEliminatoria } from './scoring.js'

export async function recomputeGroupMatchForAllUsers(matchId, rA, rB) {
  const users = (await storage.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_grupos:${u.alias}`
    const list = (await storage.get(key)) || []
    const p = list.find(x => x.matchId === matchId)
    if (p) { p.puntos = calcularPuntosGrupos(p.pronosticoA, p.pronosticoB, rA, rB); await storage.set(key, list) }
  }
  await recomputeUserTotals()
}

export async function recomputeSlotForAllUsers(slotId, equipoClasificado) {
  const users = (await storage.get('users')) || []
  for (const u of users) {
    const key = `pronosticos_eliminatorias:${u.alias}`
    const list = (await storage.get(key)) || []
    const p = list.find(x => x.slotId === slotId)
    if (p) { p.puntos = calcularPuntosEliminatoria(p.equipoElegido, equipoClasificado); await storage.set(key, list) }
  }
  await recomputeUserTotals()
}

export async function recomputeUserTotals() {
  const users = (await storage.get('users')) || []
  for (const u of users) {
    const g = (await storage.get(`pronosticos_grupos:${u.alias}`)) || []
    const e = (await storage.get(`pronosticos_eliminatorias:${u.alias}`)) || []
    u.puntosGrupos = g.reduce((s, p) => s + (p.puntos || 0), 0)
    u.puntosEliminatorias = e.reduce((s, p) => s + (p.puntos || 0), 0)
    u.totalPuntos = u.puntosGrupos + u.puntosEliminatorias
  }
  await storage.set('users', users)
  return users
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- recalc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recalc.js tests/recalc.test.js && git commit -m "feat: global point recalculation engine"
```

---

## Task 9: Config + source parsers + sync orchestrator

**Files:**
- Create: `src/config.js`, `src/lib/sources/promiedos.js`, `src/lib/sources/apiFootball.js`, `src/lib/sources/footballData.js`, `src/lib/sources/index.js`, `tests/sync.test.js`

- [ ] **Step 1: `src/config.js`**

```js
export const DATA_CONFIG = {
  primarySource: 'promiedos',
  corsProxy: 'https://corsproxy.io/?',
  promiedosUrl: 'https://www.promiedos.com.ar/league/fifa-world-cup/fjda',
  apiFootballKey: 'TU_API_KEY_AQUI',
  footballDataKey: 'TU_API_KEY_AQUI',
  syncIntervalHours: 24,
  livePollSeconds: 60,
}
```

- [ ] **Step 2: Failing test for orchestrator fallback** — `tests/sync.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { syncWithSources } from '../src/lib/sources/index.js'

describe('syncWithSources fallback chain', () => {
  it('falls back to next source when primary returns null', async () => {
    const primary = vi.fn().mockResolvedValue(null)
    const fallback = vi.fn().mockResolvedValue([{ promiedosId:'a', status:'finished', rA:1, rB:0 }])
    const out = await syncWithSources([primary, fallback])
    expect(primary).toHaveBeenCalled()
    expect(fallback).toHaveBeenCalled()
    expect(out).toHaveLength(1)
  })
  it('returns null if all sources fail', async () => {
    expect(await syncWithSources([vi.fn().mockResolvedValue(null), vi.fn().mockRejectedValue(new Error('x'))])).toBeNull()
  })
})
```

- [ ] **Step 3: Run, verify fail**

Run: `npm test -- sync`
Expected: FAIL.

- [ ] **Step 4: Implement orchestrator** — `src/lib/sources/index.js`

```js
import { DATA_CONFIG } from '../../config.js'
import { fetchPromiedos } from './promiedos.js'
import { fetchApiFootball } from './apiFootball.js'
import { fetchFootballData } from './footballData.js'

// Each source returns: Array<{ promiedosId, status, rA, rB, minuto, eventos, ... }> | null
export async function syncWithSources(sources) {
  for (const src of sources) {
    try { const r = await src(); if (r) return r } catch (e) { /* degrade silently */ }
  }
  return null
}

export function defaultSources() {
  const map = { promiedos: fetchPromiedos, 'api-football': fetchApiFootball, 'football-data': fetchFootballData }
  const order = [DATA_CONFIG.primarySource, 'promiedos', 'api-football', 'football-data']
  return [...new Set(order)].map(k => map[k]).filter(Boolean)
}
```

- [ ] **Step 5: Implement the three source modules**

`promiedos.js`: `fetchPromiedos()` — fetch `corsProxy + encodeURIComponent(promiedosUrl)`, `DOMParser` the HTML, extract per-match status/score/minute/events; return mapped array or `null` on any failure. Parser must be defensive (try/catch, optional chaining) per spec — return `null` rather than throw so the chain degrades.

`apiFootball.js`: `fetchApiFootball()` — GET `v3.football.api-sports.io/fixtures?league=1&season=2026` with `x-apisports-key`; also `/fixtures/events?fixture={id}` for events; map status (`FT`→finished, live codes→live) to the common shape; `null` if no key/failure.

`footballData.js`: `fetchFootballData()` — GET `/competitions/WC/matches` with `X-Auth-Token`; map to common shape; `null` if no key/failure.

- [ ] **Step 6: Run, verify pass**

Run: `npm test -- sync`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/lib/sources tests/sync.test.js && git commit -m "feat: data sources + sync fallback orchestrator"
```

---

## Task 10: Apply-sync engine (TDD) — states, locking, points

**Files:**
- Create: `src/lib/applySync.js`, `tests/applySync.test.js`

- [ ] **Step 1: Failing test** — `tests/applySync.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { applySync } from '../src/lib/applySync.js'

beforeEach(() => storage._resetForTests())

describe('applySync', () => {
  it('marks live match locked and records finished match + awards points', async () => {
    await storage.set('matches', [
      { id:'m1', promiedosId:'p1', equipoA:'A', equipoB:'B', resultadoA:null, resultadoB:null, estado:'programado', minuto:null },
      { id:'m2', promiedosId:'p2', equipoA:'C', equipoB:'D', resultadoA:null, resultadoB:null, estado:'programado', minuto:null },
    ])
    await storage.set('users', [{ alias:'Ana', puntosGrupos:0, puntosEliminatorias:0 }])
    await storage.set('pronosticos_grupos:Ana', [{ matchId:'m2', pronosticoA:2, pronosticoB:1, puntos:null }])

    const updates = [
      { promiedosId:'p1', status:'live', rA:1, rB:0, minuto:35, eventos:[] },
      { promiedosId:'p2', status:'finished', rA:2, rB:1, minuto:90, eventos:[{tipo:'gol'}] },
    ]
    const { live } = await applySync(updates)

    const matches = await storage.get('matches')
    expect(matches.find(m => m.id==='m1').estado).toBe('en_vivo')
    expect(matches.find(m => m.id==='m2').estado).toBe('finalizado')
    expect(live).toBe(1)
    const users = await storage.get('users')
    expect(users[0].puntosGrupos).toBe(10)
    expect(await storage.get('eventos_partido:m2')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- applySync`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/lib/applySync.js`

```js
import { storage } from './storage.js'
import { recomputeGroupMatchForAllUsers } from './recalc.js'

// updates: common-shape array from syncWithSources. Returns { live: number, finished: number }.
export async function applySync(updates) {
  if (!updates) return { live: 0, finished: 0 }
  const matches = (await storage.get('matches')) || []
  const byPid = Object.fromEntries(matches.map(m => [m.promiedosId, m]))
  let live = 0, finished = 0

  for (const u of updates) {
    const m = byPid[u.promiedosId]
    if (!m) continue
    if (u.status === 'live') {
      m.estado = 'en_vivo'; m.resultadoA = u.rA; m.resultadoB = u.rB; m.minuto = u.minuto
      if (u.eventos) await storage.set(`eventos_partido:${m.id}`, u.eventos)
      live++
    } else if (u.status === 'finished') {
      const wasProcessed = m.estado === 'finalizado'
      m.estado = 'finalizado'; m.resultadoA = u.rA; m.resultadoB = u.rB; m.minuto = u.minuto
      if (u.eventos) await storage.set(`eventos_partido:${m.id}`, u.eventos)
      finished++
      if (!wasProcessed) await recomputeGroupMatchForAllUsers(m.id, u.rA, u.rB)
    }
  }
  await storage.set('matches', matches)
  await storage.set('last_sync', new Date().toISOString())
  return { live, finished }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- applySync`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/applySync.js tests/applySync.test.js && git commit -m "feat: apply-sync engine (lock live, record finished, award points)"
```

---

## Task 11: Sync hook with adaptive live polling

**Files:**
- Create: `src/hooks/useSync.js`

- [ ] **Step 1: Implement** — `src/hooks/useSync.js`

```js
import { useEffect, useState, useCallback, useRef } from 'react'
import { DATA_CONFIG } from '../config.js'
import { syncWithSources, defaultSources } from '../lib/sources/index.js'
import { applySync } from '../lib/applySync.js'
import { storage } from '../lib/storage.js'

export function useSync() {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [tick, setTick] = useState(0) // bump to signal consumers to re-read storage
  const liveTimer = useRef(null)

  const runSync = useCallback(async () => {
    setSyncing(true)
    try {
      const updates = await syncWithSources(defaultSources())
      const { live } = await applySync(updates)
      setLastSync(await storage.get('last_sync'))
      setTick(t => t + 1)
      // adaptive: poll fast only while something is live
      clearTimeout(liveTimer.current)
      if (live > 0) liveTimer.current = setTimeout(runSync, DATA_CONFIG.livePollSeconds * 1000)
    } finally { setSyncing(false) }
  }, [])

  useEffect(() => {
    runSync() // on mount, before showing stale data downstream gates on `tick`
    const onFocus = () => { if (document.visibilityState === 'visible') runSync() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    const daily = setInterval(runSync, DATA_CONFIG.syncIntervalHours * 3600 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      clearInterval(daily); clearTimeout(liveTimer.current)
    }
  }, [runSync])

  return { syncing, lastSync, tick, runSync }
}
```

- [ ] **Step 2: Manual sanity (no unit test for timers)** — verified via app run in Task 18.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSync.js && git commit -m "feat: useSync hook with adaptive live polling"
```

---

## Task 12: Current-user hook (alias register/select/change)

**Files:**
- Create: `src/hooks/useCurrentUser.js`, `tests/userFlow.test.js`

- [ ] **Step 1: Failing test** — `tests/userFlow.test.js`

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { registerOrSelectAlias, aliasExists } from '../src/hooks/useCurrentUser.js'

beforeEach(() => storage._resetForTests())

describe('alias flow', () => {
  it('creates a new user and sets current_user', async () => {
    const u = await registerOrSelectAlias('Nico')
    expect(u.alias).toBe('Nico')
    expect(await storage.get('current_user')).toBe('Nico')
    expect((await storage.get('users')).length).toBe(1)
  })
  it('selecting an existing alias does not duplicate', async () => {
    await registerOrSelectAlias('Nico')
    await registerOrSelectAlias('Nico')
    expect((await storage.get('users')).length).toBe(1)
  })
  it('aliasExists detects registered aliases case-insensitively', async () => {
    await registerOrSelectAlias('Nico')
    expect(await aliasExists('nico')).toBe(true)
    expect(await aliasExists('Otro')).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- userFlow`
Expected: FAIL.

- [ ] **Step 3: Implement** — `src/hooks/useCurrentUser.js`

```js
import { useEffect, useState } from 'react'
import { storage } from '../lib/storage.js'

export async function aliasExists(alias) {
  const users = (await storage.get('users')) || []
  return users.some(u => u.alias.toLowerCase() === alias.trim().toLowerCase())
}

export async function registerOrSelectAlias(alias) {
  const name = alias.trim()
  const users = (await storage.get('users')) || []
  let user = users.find(u => u.alias.toLowerCase() === name.toLowerCase())
  if (!user) {
    user = { alias: name, puntosGrupos: 0, puntosEliminatorias: 0, totalPuntos: 0, fechaRegistro: new Date().toISOString() }
    users.push(user); await storage.set('users', users)
  }
  await storage.set('current_user', user.alias)
  return user
}

export function useCurrentUser() {
  const [alias, setAlias] = useState(undefined) // undefined = loading, null = none
  useEffect(() => { storage.get('current_user').then(a => setAlias(a ?? null)) }, [])
  const register = async (a) => { const u = await registerOrSelectAlias(a); setAlias(u.alias); return u }
  const change = async () => { await storage.set('current_user', null); setAlias(null) }
  return { alias, register, change }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- userFlow`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCurrentUser.js tests/userFlow.test.js && git commit -m "feat: alias register/select hook with dedupe"
```

---

## Task 13: Shared UI components

**Files:**
- Create: `src/components/LiveBadge.jsx`, `src/components/Skeleton.jsx`, `src/components/ScoreInput.jsx`, `src/components/MatchCard.jsx`, `src/components/MatchDetail.jsx`, `src/components/BottomNav.jsx`

- [ ] **Step 1: `LiveBadge.jsx`** — pulsing badge

```jsx
export default function LiveBadge({ minuto }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger">
      <span className="animate-live h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
      EN VIVO{minuto != null ? ` ${minuto}'` : ''}
    </span>
  )
}
```

- [ ] **Step 2: `Skeleton.jsx`**

```jsx
export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />
}
```

- [ ] **Step 3: `ScoreInput.jsx`** — number inputs, disabled when locked, 44px min

```jsx
export default function ScoreInput({ value, onChange, disabled, label }) {
  return (
    <input type="number" inputMode="numeric" min="0" aria-label={label}
      className="h-11 w-11 rounded-lg bg-bg text-center text-lg font-head font-semibold
                 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-pitch"
      value={value ?? ''} disabled={disabled}
      onChange={e => onChange(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0))} />
  )
}
```

- [ ] **Step 4: `MatchCard.jsx`** — uses framer-motion, shows flags, score/inputs, state. Props: `{ match, teams, prediction, onPredict, onOpen }`. Shows `LiveBadge` when `estado==='en_vivo'`, final score + "+N pts" when `finalizado`, `ScoreInput`s (disabled per `isBloqueado`) otherwise. State chip color per estado. `motion.button whileTap={{ scale: 0.97 }}` wrapper for `onOpen`.

- [ ] **Step 5: `MatchDetail.jsx`** — modal (framer-motion `AnimatePresence`, scale+fade from center, scrim 50% black, Escape/close button). Lists goals (`⚽ jugador minuto' · equipo`), yellow (🟨) and red (🟥) cards from `eventos_partido:{matchId}`, plus the user's prediction and points.

- [ ] **Step 6: `BottomNav.jsx`** — 5 lucide icons + labels (Home/Trophy-Grupos/ListOrdered-FaseGrupos/GitBranch-Llaves/BarChart3-Ranking), active highlight, `pb-[env(safe-area-inset-bottom)]`, fixed bottom, 44px targets.

- [ ] **Step 7: Commit**

```bash
git add src/components && git commit -m "feat: shared UI components (live badge, match card/detail, nav, inputs)"
```

---

## Task 14: Onboarding view (alias + autocomplete + dedupe)

**Files:**
- Create: `src/views/Onboarding.jsx`

- [ ] **Step 1: Implement** — welcome screen with alias `<input>` + `<datalist>` of existing `users`. As the user types, query `users` for suggestions. On submit: if alias exists → select it; if typing an existing alias is detected, show the spec message ("Este alias ya está en uso. Si es tuyo, seleccionalo de la lista. Si querés uno nuevo, elegí otro nombre.") and require either selecting it or choosing an unused name. Calls `register(alias)` from `useCurrentUser`. Animated entrance (framer-motion fade/slide-up).

- [ ] **Step 2: Commit**

```bash
git add src/views/Onboarding.jsx && git commit -m "feat: onboarding with alias autocomplete + dedupe"
```

---

## Task 15: Home, FaseGrupos, GruposStandings, Bracket, Ranking views

**Files:**
- Create: `src/views/Home.jsx`, `src/views/FaseGrupos.jsx`, `src/views/GruposStandings.jsx`, `src/views/Bracket.jsx`, `src/views/Ranking.jsx`

- [ ] **Step 1: `Home.jsx`** — "Partidos de hoy" (filter `matches` by device date). For each: scheduled → time + teams + quick-predict; live → live score + `LiveBadge`; finished → final score + events summary + points. Empty → "No hay partidos hoy" + next match countdown. "Última actualización: hace X" from `last_sync`. Tap a match → `MatchDetail`. Staggered list entrance (30-50ms).

- [ ] **Step 2: `FaseGrupos.jsx`** — group tabs A–L; each match as `MatchCard`; predictions saved to `pronosticos_grupos:{alias}` on change (only when `!isBloqueado`). State chips ⬜🟡🔴🟢.

- [ ] **Step 3: `GruposStandings.jsx`** — group tabs A–L; per group render `computeStandings(GRUPOS[g], matchesOfGroup)` as table (Pos/Equipo/PJ/G/E/P/GF/GC/DG/PTS), tabular-nums; highlight top 2 green, best-thirds boundary amber.

- [ ] **Step 4: `Bracket.jsx`** — horizontal columns Dieciseisavos→Octavos→Cuartos→Semis→Final→🏆. Each slot: dropdown to pick a team (drag-and-drop optional enhancement; dropdown is the required path per a11y `gesture-alternative`). Save to `pronosticos_eliminatorias:{alias}`. Slot state ⬜🟡🟢🔴 vs `equipoClasificado`.

- [ ] **Step 5: `Ranking.jsx`** — `buildRanking(users)` table (Pos/Alias/Grupos/Elim/Total); highlight current user's row; framer-motion `layout` on rows for animated reordering.

- [ ] **Step 6: Commit**

```bash
git add src/views && git commit -m "feat: Home, FaseGrupos, GruposStandings, Bracket, Ranking views"
```

---

## Task 16: App shell wiring

**Files:**
- Modify: `src/App.jsx`, `src/main.jsx`

- [ ] **Step 1: Implement `App.jsx`** — `useCurrentUser()`: while `alias===undefined` show full-screen `Skeleton`; if `null` show `Onboarding`; else render shell. `useSync()` provides `{ syncing, lastSync, tick }`. Gate first paint of data views on `tick>0` (show skeletons until first sync resolves) so users never act on stale data. Tab state for the 5 views + `BottomNav`. Pass `tick` down so views re-read storage after each sync. "Cambiar alias" entry (with the data-loss-on-this-device warning) calls `change()`.

- [ ] **Step 2: Verify build + tests green**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx src/main.jsx && git commit -m "feat: app shell — onboarding gate, sync bootstrap, tab nav"
```

---

## Task 17: README + run instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** — project summary, stack, `npm install` / `npm run dev` / `npm test` / `npm run build`, note about `window.storage` adapter (real artifact vs dev shim) and where to set API keys (`src/config.js`). Link the two spec docs.

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: add README with setup and run instructions"
```

---

## Task 18: Manual verification (app run)

- [ ] **Step 1: Run** `npm run dev`, open the local URL.
- [ ] **Step 2: Verify** onboarding dedupe + autocomplete; tab nav across 5 views; entering a group prediction saves and persists on reload (dev shim); standings render; bracket pick saves; ranking shows the user highlighted; skeletons show during first load; reduced-motion disables animations.
- [ ] **Step 3:** Note any defects as follow-up tasks; fix trivial ones and commit.

---

## Task 19: Publish to GitHub

- [ ] **Step 1: Create repo and push**

```bash
gh repo create prode-mundial-2026 --public --source=. --remote=origin --description "Prode Mundial 2026 — World Cup prediction pool (React + Tailwind)" --push
```

- [ ] **Step 2: Verify**

Run: `gh repo view --web` (or `git remote -v` + `git log --oneline -5`)
Expected: remote `origin` set, all commits pushed.

---

## Self-Review

**Spec coverage (master + iteration spec):**
- Alias register/autocomplete/dedupe → Task 12, 14 ✓
- Group predictions, auto-save, lock when result loaded → Task 13 (ScoreInput/MatchCard), 15 (FaseGrupos), 10 (lock) ✓
- 48 teams / 12 groups / fixtures / bracket hardcoded → Task 7 ✓
- Scoring (group exclusive-upward, knockout all-or-nothing) → Task 2 ✓
- Recompute all users on finished match → Task 8, 10 ✓
- Sources Promiedos→API-Football→football-data, silent degradation, CORS proxy → Task 9 ✓
- Three states + live lock + live score → Task 3, 10, 13 ✓
- On-entry sync before showing stale data + adaptive polling → Task 11, 16 ✓
- Events (goals/cards) stored + shown → Task 10 (store), 13 MatchDetail (show) ✓
- Home today + detail + last-updated → Task 15 ✓
- Group standings daily-updated → Task 4, 15 ✓
- Ranking with isolation (only alias+points shown) → Task 5, 15 ✓
- UI/UX system (palette, Barlow, bottom nav, animations, states, a11y) → Task 1, 13, 15 ✓
- Storage keys + shared/local model → Task 6 ✓

**Placeholder scan:** Data-heavy steps (Task 7 fixtures/teams) describe exact shapes and constraints with a generation rule rather than 104 literal rows — acceptable as the data is mechanical and validated by Task 7 tests. UI component steps (Tasks 13-15) give concrete code for primitives and precise prop/behavior specs for composite views. No "TBD"/"handle edge cases" left.

**Type consistency:** Common update shape `{ promiedosId, status:'live'|'finished', rA, rB, minuto, eventos }` is consistent across Task 9 (sources), Task 10 (applySync). `estado` values `programado|en_vivo|finalizado` consistent across Tasks 3,7,10,13,15. Storage keys match `prode-mundial.md`. `puntosGrupos`/`puntosEliminatorias`/`totalPuntos` consistent across Tasks 5,8,12.

**Gaps:** Knockout `equipoClasificado` confirmation from sync (recomputeSlotForAllUsers exists in Task 8 but isn't wired into applySync, since group fixtures are the live focus and bracket results depend on knockout fixtures not in the hardcoded group set). Noted as acceptable for this iteration — bracket points recompute when slots are confirmed; wiring knockout-result detection is a follow-up when knockout fixtures are added.
