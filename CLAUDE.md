# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

This repo currently contains **only a specification** (`prode-mundial.md`, in Spanish). No code, build tooling, or git history exists yet. The first implementation task is to build the app described by that spec. Read `prode-mundial.md` as the source of truth — this file only summarizes the architecture and the constraints that are easy to get wrong.

## What is being built

"Prode Mundial 2026" — a web prediction/pool app for the 2026 World Cup. Users register with an alias, predict match scores and a knockout bracket, and compete on a global ranking. There is **no backend** — all logic runs in the client, and data persists across users via Claude artifact storage.

## Hard Constraints (these are non-negotiable per the spec)

- **Single-file React `.jsx` deliverable.** Everything — components, hardcoded fixtures, scraping, point logic — lives in one file.
- **Persistence is `window.storage` (the Claude artifact storage API), NOT browser `localStorage`.** Native `localStorage` is explicitly forbidden. Shared data uses `shared: true`; only the device-local current alias uses `shared: false`.
- **Stack: React SPA + Tailwind CSS, mobile-first.** Friends use it from phones.

## Architecture

Three to five views toggled by tabs (no router needed): **Home/today**, **Group Stage** (48 group predictions), **Groups standings table**, **Knockouts** (interactive bracket), **Ranking**.

### Data flow
1. Group fixtures and the 12 groups are **hardcoded constants** at the top of the file (see `GRUPOS_MUNDIAL_2026` in the spec). Bracket slots are hardcoded too.
2. A `syncResultados()` routine runs on app open, on window focus, and every `syncIntervalHours` (24h). It fetches official results, match events (goals/cards), and group standings.
3. When a match finishes: store the result, **lock the match** (predictions become read-only for everyone), then **recompute points for every registered user** in `users`, not just the current one.
4. Ranking is derived dynamically from shared storage.

### Data sources (with silent degradation)
Config lives in an editable `DATA_CONFIG` constant at the top of the file. Order: **Promiedos (primary, HTML scraping)** → **API-Football (RapidAPI)** → **football-data.org**.
- Promiedos has no public API: scrape `https://www.promiedos.com.ar/league/fifa-world-cup/fjda` with `DOMParser`. Browser CORS will likely block direct fetch — route through a CORS proxy (`corsProxy` in config, e.g. `https://corsproxy.io/?`).
- The scraper must be robust: if the HTML structure changes or any source fails, degrade silently to the next fallback. The app must keep working with no critical error if all sources are down (show "last updated X ago").

### Storage keys (`window.storage`)
- `matches`, `elimination_slots`, `users`, `last_sync`, `eventos_partido:{matchId}` — all `shared: true`
- `pronosticos_grupos:{alias}`, `pronosticos_eliminatorias:{alias}` — per-user, `shared: true`
- `current_user` — `shared: false` (device-local alias only)

## Domain rules that are easy to get wrong

- **Group-stage scoring is exclusive-upward, not additive:** exact score = +10 only; correct winner/draw = +5 only (no +2 stacking); otherwise +2 per team whose goal count was correct. See `calcularPuntosGrupos` in the spec for the canonical implementation.
- **Knockout scoring:** +10 if the predicted team is the one that actually advanced, else 0. No partial credit, no score prediction in knockouts — only which team advances.
- **A match with no prediction scores nothing** (no penalty).
- **Privacy/isolation:** each user sees only their own predictions; the Ranking is the only place other users' data (alias + points) appears.
- **Alias registration:** autocomplete from the shared `users` list; duplicates are rejected (a user must select an existing alias or pick an unused one — never create a duplicate).
- **2026 format note:** 48 teams, 12 groups (A–L), and a **Round of 32 (Dieciseisavos)** before the Round of 16 — top 2 per group + 8 best third-place teams.
