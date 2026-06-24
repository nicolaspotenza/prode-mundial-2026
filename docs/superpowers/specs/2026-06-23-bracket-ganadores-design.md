# Cuadro de eliminatorias con ganadores que avanzan — Diseño

Fecha: 2026-06-23

## Objetivo

Reformar la sección **Llaves** para que sea un cuadro de eliminación real, al estilo
del bracket clásico de Mundial (ver imagen de referencia del usuario): cruces
iniciales de **Dieciseisavos (R32) fijos e iguales para todos**, donde el usuario
elige el ganador de cada cruce y ese ganador **avanza** a la ronda siguiente,
encadenándose hasta el campeón.

**Puntaje: 20 puntos por cada ganador acertado** (en cualquier ronda, incluida la
final).

## Decisiones tomadas (brainstorming)

1. **Cruces R32 hardcodeados y fijos para todos.** No se derivan de predicciones de
   grupos. Detectados de la imagen de referencia; todos los equipos coinciden con
   `GRUPOS`.
2. **Cascada por predicciones propias.** Desde Octavos en adelante, cada cruce se
   arma con los ganadores que el propio usuario eligió en los dos cruces hijos. El
   usuario solo puede elegir entre lo que él mismo fue formando.
3. **Se elimina la sub-pestaña "Clasificados"** y el modelo viejo de slots
   (`pos_*` / `ko_*`). "Llaves" pasa a ser únicamente el cuadro de ganadores.
4. **Los pronósticos de eliminatorias del modelo viejo se descartan** (incompatibles).
   Los pronósticos de grupos NO se tocan.

## Restricción dura

**No se toca ningún dato almacenado de pronósticos de partidos de grupos ni sus
puntos.** Todos los cambios son exclusivamente sobre la sección de llaves
(eliminatorias): `pronosticos_eliminatorias:{alias}`, `elimination_matches` y su
scoring/recalc. Las claves `pronosticos_grupos:{alias}`, `matches` (resultados de
grupos) y los campos `puntosGrupos` de cada usuario quedan intactos. El recálculo de
`totalPuntos` solo cambia por el nuevo puntaje de eliminatorias; la parte de grupos
se conserva tal cual.

## Estructura del cuadro

Árbol de 5 rondas. El **orden** de los 16 cruces de R32 define todo el árbol: el
partido de la ronda *N+1* número *i* enfrenta a los ganadores de los partidos *2i-1*
y *2i* de la ronda *N*. Mitad izquierda = cruces 1–8, mitad derecha = cruces 9–16;
se cruzan en la final.

| Ronda          | id ronda       | Partidos | Ganadores a elegir |
|----------------|----------------|----------|--------------------|
| Dieciseisavos  | `dieciseisavos`| 16       | 16                 |
| Octavos        | `octavos`      | 8        | 8                  |
| Cuartos        | `cuartos`      | 4        | 4                  |
| Semifinales    | `semis`        | 2        | 2                  |
| Final          | `final`        | 1        | 1 (= campeón)      |

Total: **31 picks** × 20 = **620 puntos** máximos en llaves.

### Cruces hardcodeados de R32 (orden = árbol)

Mitad izquierda:
1. Alemania vs Escocia
2. Francia vs Suecia
3. República de Corea vs Suiza
4. Países Bajos vs Marruecos
5. Colombia vs Ghana
6. España vs Austria
7. Estados Unidos vs Argelia
8. Egipto vs Chequia

Mitad derecha:
9. Brasil vs Japón
10. Costa de Marfil vs Noruega
11. México vs Cabo Verde
12. Inglaterra vs DR Congo
13. Argentina vs Uruguay
14. Australia vs Irán
15. Canadá vs Bélgica
16. Portugal vs Paraguay

Todos los nombres deben coincidir exactamente con los de `GRUPOS` (es lo que espera
`Flag`).

## Modelo de datos

### `src/data/bracket.js` (reescrito)

- `DIECISEISAVOS`: array de 16 objetos `{ id, teamA, teamB }` con los cruces de arriba.
  - ids: `ko_dieciseisavos_1` … `ko_dieciseisavos_16`.
- `KO_RONDAS = ['dieciseisavos', 'octavos', 'cuartos', 'semis', 'final']`.
- `RONDA_LABELS`: etiquetas en español (Dieciseisavos, Octavos, Cuartos,
  Semifinales, Final).
- `KO_MATCHES`: lista derivada de **todos** los partidos del árbol con su id, ronda,
  índice, y para R32 los `teamA`/`teamB` fijos. Para rondas superiores `teamA`/`teamB`
  son `null` (se derivan en runtime de los ganadores del usuario). Se incluye además
  el mapeo padre→hijos (qué dos partidos alimentan a cada partido) para la cascada.
  - ids de rondas superiores: `ko_octavos_1..8`, `ko_cuartos_1..4`, `ko_semis_1..2`,
    `ko_final_1`.
- `ELIMINATION_MATCHES`: lo que se siembra en storage (`elimination_matches`), un
  registro por partido con `{ id, ronda, indice, teamA, teamB, ganador: null }`.
  `ganador` es el ganador **real** (se completa luego, igual que hoy se completaba
  `equipoClasificado`; el cableado del scraper de KO queda fuera de alcance).

Se eliminan `QUALIFIER_SLOTS`, `KO_SLOTS`, `POSICION_LABELS`, `ELIMINATION_SLOTS`.

### Predicción del usuario

`pronosticos_eliminatorias:{alias}` (mismo storage key, `shared: true`): array de
`{ userId, matchId, ganador, puntos }`. `ganador` es el equipo que el usuario hace
avanzar en ese partido.

### Storage keys

- Renombrar `elimination_slots` → `elimination_matches` (`shared: true`).
- Subir `SEED_VERSION` para re-sembrar `matches` y `elimination_matches`.

## Lógica de cascada

Función pura (testeable, en `src/lib/bracket.js` nuevo):

`resolveBracket(preds)` → dado el array de predicciones del usuario, devuelve para
cada partido del árbol sus `teamA`/`teamB` efectivos y el ganador elegido:

- R32: `teamA`/`teamB` vienen de `DIECISEISAVOS`.
- Ronda superior: `teamA` = ganador elegido por el usuario en el primer hijo (o
  `null` si no eligió), `teamB` = ganador del segundo hijo.
- Un partido solo es "elegible" si ambos lados están definidos.

`setBracketPick(preds, matchId, ganador)` → función pura que setea el ganador de un
partido y **propaga**: si el equipo que sale de ese partido cambia, invalida (pone
`ganador = null`) cualquier pick aguas arriba que ya no sea consistente (el equipo
elegido en el padre ya no participa de ese cruce). Devuelve la nueva lista.

`src/lib/predictions.js`:
- `getKnockoutPredictions(alias)` se mantiene.
- `setKnockoutPrediction` pasa a usar `setBracketPick` (set + propagación) y persiste.

## Scoring

`src/lib/scoring.js`:
- Reemplazar `calcularPuntosEliminatoria(elegido, clasificado)` por
  `calcularPuntosEliminatoria(ganadorElegido, ganadorReal)` que devuelve `20` si
  coinciden (y no son null), si no `0`.

`src/lib/recalc.js`:
- `recomputeSlotForAllUsers(slotId, equipoClasificado)` →
  `recomputeMatchForAllUsers(matchId, ganadorReal)`: recorre usuarios, ubica el pick
  por `matchId`, recalcula `puntos` con el nuevo scoring.
- `recomputeUserTotals` no cambia.

## UI — `src/views/Bracket.jsx` (reescrito)

- Se elimina el toggle de sub-pestañas; "Llaves" muestra directamente el cuadro.
- Layout estilo imagen: columnas por ronda (Dieciseisavos → Final) con **scroll
  horizontal** en mobile (se reúsa el patrón actual de `overflow-x-auto`).
- Cada cruce = tarjeta con los dos equipos (bandera + nombre vía `Flag`). **Tocás un
  equipo para hacerlo avanzar**; el elegido queda resaltado. Lados "A definir"
  cuando el usuario aún no completó el hijo correspondiente.
- Resultado real (si `ganador` del partido está cargado): 🟢 acierto / 🔴 fallo.
- Columna final con 🏆 y el campeón elegido.
- Estado: lee `elimination_matches` (para `ganador` real) + predicciones del alias;
  deriva el árbol con `resolveBracket`.

## Migración / limpieza

- `ensureSeeded` (`src/lib/seed.js`): siembra `elimination_matches` desde
  `ELIMINATION_MATCHES`; sube `SEED_VERSION`.
- Los pronósticos de eliminatorias viejos (estructura `slotId`) se descartan: al
  recalcular totales, los picks con `slotId` (sin `matchId`) se ignoran. Para evitar
  arrastrar basura, en el primer arranque con la versión nueva se puede limpiar
  `pronosticos_eliminatorias:{alias}` que no tengan `matchId`. Los de grupos intactos.
- `src/lib/migrate.js`: el merge de eliminatorias pasa a usar `matchId` como clave
  (en vez de `slotId`).

## Tests (TDD)

- `tests/scoring.test.js`: actualizar eliminatorias → 20/0.
- `tests/bracket.test.js` (nuevo): `resolveBracket` y `setBracketPick`
  (derivación de cruces, propagación e invalidación aguas arriba, campeón).
- Revisar `tests/migrate.test.js` por el cambio de clave `slotId`→`matchId`.

## Fuera de alcance

- Cablear el scraper/sync para llenar `ganador` real de cada cruce de KO
  (hoy tampoco está automatizado para slots). Se llena por el mismo mecanismo actual.
- Tercer puesto (no aparece en la imagen).
