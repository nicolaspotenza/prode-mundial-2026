# Prode Mundial 2026 — Especificación del Proyecto

## Visión General

Aplicación web de prode (quiniela) para el Mundial 2026, donde cualquier persona puede registrarse con un alias, ingresar sus pronósticos partido a partido, y competir con amigos en un ranking global. Los datos deben persistir entre sesiones para todos los usuarios.

---

## Stack Tecnológico

- **Frontend:** React (SPA) con Tailwind CSS
- **Persistencia:** `window.storage` API del artifact de Claude (storage compartido entre usuarios con `shared: true`)
- **Sin backend propio:** toda la lógica vive en el cliente

> ⚠️ Usar `window.storage` con `shared: true` para que los datos sean visibles entre todos los usuarios que abran la app. NUNCA usar `localStorage` nativo del browser.

---

## Estructura de la App

La app tiene tres secciones principales accesibles por tabs/navegación:

1. **Fase de Grupos** — pronósticos de los 48 partidos de la fase grupal
2. **Eliminatorias** — bracket visual interactivo desde Octavos hasta la Final
3. **Ranking** — tabla de posiciones con puntos de todos los jugadores

---

## Flujo de Usuario

### 1. Registro / Identificación
- Al abrir la app, si el usuario tiene un alias guardado localmente (`current_user`, `shared: false`), entra **directamente a la app sin ningún paso previo**
- Si no tiene alias guardado, se le muestra una pantalla de bienvenida con un campo para escribir su alias
- **Autocompletado de alias:** a medida que el usuario escribe, la app consulta la lista `users` (shared: true) y muestra sugerencias de aliases ya registrados que coincidan (tipo `<datalist>` HTML o dropdown personalizado). Esto permite que un usuario que ya se registró desde otro dispositivo encuentre su alias fácilmente
- **Validación al registrar alias nuevo:** cuando el usuario termina de escribir un alias que ya existe en `users`, la app muestra: _"Este alias ya está en uso. Si es tuyo, seleccionalo de la lista. Si querés uno nuevo, elegí otro nombre."_ No se puede crear un alias duplicado — solo seleccionar uno existente o escribir uno que aún no exista
- Una vez ingresado o seleccionado el alias, se guarda localmente (`current_user`, `shared: false`) y no se vuelve a preguntar en ese dispositivo
- Hay un botón "Cambiar alias" accesible desde la app (menú o perfil), con advertencia de que perderán el acceso local a sus datos desde ese dispositivo (los datos en el storage compartido no se borran)
- Los pronósticos y puntos de cada jugador se almacenan bajo su alias en el storage compartido (`shared: true`), de forma que **cada jugador conserva sus propios datos** y otro jugador que entre desde otro dispositivo no los pisa

### 2. Ingreso de Pronósticos — Fase de Grupos
- Se muestran los **48 partidos** de la fase de grupos organizados por **fecha y grupo**
- Cada partido muestra: Equipo A 🏳️ `[input]` — `[input]` 🏳️ Equipo B
- El usuario ingresa el marcador que predice (ej: 2 — 1)
- Los pronósticos se guardan automáticamente al cambiar el input
- Un partido sin pronóstico no suma ni resta puntos
- Se puede modificar un pronóstico **hasta que se cargue el resultado oficial**

### 3. Actualización Automática de Resultados (via Promiedos + fallback)
- La app **consulta automáticamente** resultados cada vez que se abre y una vez por día mientras está activa (polling cada 24hs o al recuperar foco de ventana)
- **Fuente principal: Promiedos** (`promiedos.com.ar`) — sitio argentino muy completo con datos del Mundial 2026. Dado que Promiedos no expone una API pública oficial con CORS habilitado, Claude Code debe implementar **web scraping del HTML** de la página del Mundial: `https://www.promiedos.com.ar/league/fifa-world-cup/fjda`. Se debe parsear el HTML para extraer resultados de partidos finalizados.
  - ⚠️ **Limitación importante:** el scraping directo desde el browser puede ser bloqueado por CORS. En ese caso, Claude Code debe usar un proxy CORS público como `https://corsproxy.io/?` o `https://api.allorigins.win/get?url=` para realizar el fetch
  - Si el scraping falla o cambia la estructura del HTML, el sistema debe degradar silenciosamente al fallback
- **Fallback: API-Football (RapidAPI)** — `https://v3.football.api-sports.io/fixtures?league=1&season=2026`. Requiere API key gratuita (100 req/día). Soporta el Mundial 2026 con `league=1&season=2026`
- **Fallback secundario: football-data.org** — endpoint `/competitions/WC/matches`, requiere API key gratuita
- La configuración de fuente y API keys debe estar como constante editable al inicio del archivo:

```javascript
const DATA_CONFIG = {
  primarySource: 'promiedos', // 'promiedos' | 'api-football' | 'football-data'
  corsProxy: 'https://corsproxy.io/?',
  promiedosUrl: 'https://www.promiedos.com.ar/league/fifa-world-cup/fjda',
  apiFootballKey: 'TU_API_KEY_AQUI',
  footballDataKey: 'TU_API_KEY_AQUI',
  syncIntervalHours: 24,
};
```

- Cuando se obtiene un resultado oficial para un partido:
  1. Se guarda el resultado en storage compartido (`matches`, `shared: true`)
  2. Se marca el partido como **bloqueado** (no se pueden modificar más pronósticos)
  3. Se recorren **todos los usuarios registrados** y se calculan sus puntos para ese partido
  4. Los puntos se actualizan en el storage de cada usuario
- Si ninguna fuente está disponible, la app funciona igual sin error crítico (indicador visual "última actualización: hace X horas")

### 4. Eliminatorias — Bracket Interactivo
- Sección visual con el bracket completo: **Octavos → Cuartos → Semis → Final → 🏆 Campeón**
- Inicialmente **todos los slots están vacíos**
- Debajo del bracket hay una lista de los **48 equipos** (o los clasificados confirmados si ya terminó la fase de grupos)
- El usuario puede **arrastrar y soltar** (drag & drop) o **seleccionar de un dropdown** cada equipo en cada posición del bracket, prediciendo quién avanza en cada llave
- **No se predicen marcadores en eliminatorias**, solo qué equipo avanza en cada cruce
- **Sistema de puntos de eliminatorias:** +10 puntos si el equipo que el usuario puso en un slot es el mismo que avanzó realmente. En caso contrario, 0 puntos. No hay puntos parciales.
- La actualización automática (Promiedos o fallback) también detecta clasificados de eliminatorias: cuando se confirma el equipo que avanzó en un cruce, se compara con lo predicho por cada usuario y se otorgan los puntos

---

## Sistema de Puntos

### Fase de Grupos

| Acierto | Puntos |
|---|---|
| Resultado exacto (marcador completo) | +10 |
| Ganador o empate acertado (sin importar los goles) | +5 |
| Goles de UN equipo acertados (aunque no se acierte el ganador) | +2 por equipo |

### Reglas de aplicación (fase de grupos):
- Los puntos son **excluyentes hacia arriba**: si acertás el resultado exacto, sumás **solo +10** (no acumula con +5 ni +2)
- Si acertás el ganador pero no el marcador exacto, sumás **solo +5** (no acumula con +2)
- Si no acertaste ni resultado exacto ni ganador/empate, pero sí los goles de uno o ambos equipos: **+2 por cada equipo cuyo marcador acertaste**
- Ejemplo: Argentina gana 3-0, pronóstico era Argentina 3-1 → **+5** (ganador acertado)
- Ejemplo: Argentina gana 3-0, pronóstico era 0-0 → **+2** (solo goles de Argentina acertados)
- Ejemplo: Argentina gana 3-0, pronóstico era Argentina 3-0 → **+10** (resultado exacto)

### Fase Eliminatoria

| Acierto | Puntos |
|---|---|
| Equipo correcto avanza al siguiente cruce | +10 |
| Equipo incorrecto o sin pronóstico | +0 |

- En eliminatorias **no se predicen marcadores**, solo el equipo que avanza
- +10 por cada slot del bracket donde el usuario acertó el equipo clasificado
- Cada ronda tiene el mismo valor por acierto (+10), independientemente de si es Octavos, Semis o Final

---

## Modelo de Datos

### Partidos de grupos (hardcodeados en el código)
```json
{
  "id": "match_001",
  "fase": "grupos",
  "grupo": "A",
  "fecha": "2026-06-11",
  "equipoA": "México",
  "equipoB": "Canadá",
  "resultadoA": null,
  "resultadoB": null,
  "bloqueado": false,
  "promiedosId": "mexico-canada"
}
```

### Slots de eliminatorias (hardcodeados en el código)
```json
{
  "id": "r16_1",
  "fase": "eliminatorias",
  "ronda": "octavos",
  "posicion": 1,
  "equipoClasificado": null,
  "bloqueado": false
}
```

### Pronóstico de grupos de un usuario
```json
{
  "userId": "alias_del_usuario",
  "matchId": "match_001",
  "pronosticoA": 2,
  "pronosticoB": 1,
  "puntos": null
}
```

### Pronóstico de eliminatorias de un usuario
```json
{
  "userId": "alias_del_usuario",
  "slotId": "r16_1",
  "equipoElegido": "Argentina",
  "puntos": null
}
```

### Usuario
```json
{
  "alias": "Rodrigo",
  "puntosGrupos": 0,
  "puntosEliminatorias": 0,
  "totalPuntos": 0,
  "fechaRegistro": "2026-06-11T10:00:00Z"
}
```

### Storage keys (con `window.storage`)
- `matches` (shared: true) — lista de partidos de grupos con resultados oficiales
- `elimination_slots` (shared: true) — bracket de eliminatorias con clasificados reales
- `pronosticos_grupos:{alias}` (shared: true) — pronósticos de grupos de cada usuario
- `pronosticos_eliminatorias:{alias}` (shared: true) — pronósticos del bracket de cada usuario
- `users` (shared: true) — lista de todos los usuarios registrados con sus puntos totales
- `current_user` (shared: false) — alias del usuario actual en este dispositivo
- `last_sync` (shared: true) — timestamp de la última sincronización exitosa con la fuente de datos

---

## Integración con Fuente de Datos — Promiedos

### Estrategia de scraping
Promiedos es la fuente principal por ser el sitio de referencia futbolística en Argentina y tener datos del Mundial 2026 en tiempo real. Al no tener API pública, se hace scraping del HTML:

```javascript
async function fetchResultadosPromiedos() {
  const proxyUrl = DATA_CONFIG.corsProxy;
  const targetUrl = DATA_CONFIG.promiedosUrl;
  
  try {
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
    const html = await response.text();
    // Parsear HTML con DOMParser para extraer resultados
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Buscar elementos con resultados de partidos finalizados
    // La estructura puede cambiar — hacer el parser robusto y con fallback
    return parsearPartidosDesdeHTML(doc);
  } catch (err) {
    console.warn('Promiedos no disponible, intentando fallback...', err);
    return null;
  }
}
```

### Fallback: API-Football
```javascript
async function fetchResultadosAPIFootball() {
  const res = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
    headers: { 'x-apisports-key': DATA_CONFIG.apiFootballKey }
  });
  const data = await res.json();
  return data.response.map(mapearPartidoAPIFootball);
}
```

### Lógica de sincronización principal
```javascript
async function syncResultados() {
  let resultados = await fetchResultadosPromiedos();
  if (!resultados) resultados = await fetchResultadosAPIFootball();
  if (!resultados) return; // Sin datos disponibles, no hacer nada

  for (const resultado of resultados) {
    if (resultado.finalizado && !resultado.bloqueado) {
      await guardarResultadoYCalcularPuntos(resultado);
    }
  }
  await window.storage.set('last_sync', new Date().toISOString(), true);
}

// Ejecutar al iniciar y cada 24hs
useEffect(() => {
  syncResultados();
  const interval = setInterval(syncResultados, DATA_CONFIG.syncIntervalHours * 3600 * 1000);
  return () => clearInterval(interval);
}, []);
```

---

## Partidos — Fase de Grupos Mundial 2026

El Mundial 2026 se juega en Estados Unidos, México y Canadá. Son **48 equipos** divididos en **12 grupos de 4** (grupos A al L). 104 partidos en total.

Al implementar: hardcodear los 48 partidos de la fase de grupos con equipos, fechas y grupos reales. Tomar la fixture oficial del sorteo del Mundial 2026.

**Equipos clasificados confirmados:** Argentina, Brasil, Francia, Inglaterra, Alemania, España, Portugal, Países Bajos, Uruguay, México, Estados Unidos, Canadá, Japón, Corea del Sur, Australia, Marruecos, Senegal, Nigeria, Costa de Marfil, Egipto, Arabia Saudita, Irán, Ecuador, Colombia, entre otros (verificar lista completa de 48 equipos al implementar).

---

## Pantallas / Vistas

### Vista: Fase de Grupos
- Tabs por grupo (A, B, C... L) o scroll vertical con separadores
- Cada partido: nombre del equipo + bandera emoji + input de goles
- Estado visual: ⬜ sin pronóstico | 🟡 pronóstico ingresado | 🟢 resultado oficial + puntos obtenidos
- Mostrar puntos ganados en cada partido una vez que haya resultado
- Indicador de última sincronización ("Actualizado hace X horas")

### Vista: Eliminatorias
- Bracket tipo "árbol de torneo" horizontal
- Columnas: Octavos (16) → Cuartos (8) → Semis (4) → Final (1) → 🏆 Campeón
- Cada slot: recuadro con selector de equipo (dropdown o drag & drop)
- Lista de los 48 equipos disponibles debajo del bracket o en sidebar
- Estado visual por slot: ⬜ vacío | 🟡 equipo elegido | 🟢 acertó | 🔴 falló

### Vista: Ranking
- Tabla ordenada por puntos totales (descendente)
- Columnas: Posición | Alias | Puntos Grupos | Puntos Eliminatorias | Total
- Resaltar la fila del usuario actual
- Se actualiza automáticamente tras cada sincronización

---

## Comportamiento de Bloqueo y Privacidad

### Bloqueo automático por sincronización
- Cuando la sincronización detecta que un partido terminó, ese partido queda **bloqueado automáticamente** para todos
- Los pronósticos de partidos bloqueados se vuelven **solo lectura** en todos los dispositivos
- Los puntos se calculan y actualizan en el storage de cada usuario inmediatamente

### Aislamiento de datos por usuario
- Cada jugador ve **solo sus propios pronósticos** en las vistas de Grupos y Eliminatorias
- El **Ranking** es el único lugar donde se ven datos de otros jugadores (alias + puntos, sin pronósticos)
- Los pronósticos de un usuario nunca son visibles para otro usuario

---

## UI / UX

- Diseño temático: colores de mundial (verde cancha, blanco, dorado)
- **Mobile-first:** la app debe verse bien en celular (los amigos la van a usar desde el teléfono)
- Banderas: usar emojis de banderas (🇦🇷 🇧🇷 🇫🇷) para cada equipo
- Indicadores visuales claros para cada estado: sin pronóstico, ingresado, bloqueado, puntos obtenidos

---

## Consideraciones de Implementación

1. **Un solo archivo React** (`.jsx`) con todo el código
2. Usar `window.storage` (API del artifact de Claude) — **NUNCA `localStorage` nativo**
3. Todos los partidos de grupos hardcodeados como constante al inicio del archivo
4. El scraping de Promiedos debe ser robusto: si cambia el HTML, degradar silenciosamente al fallback
5. Al sincronizar un resultado, recalcular puntos de **TODOS los usuarios** registrados en `users`
6. El ranking se recalcula dinámicamente desde el storage

---

## Funciones de Cálculo de Puntos

### Fase de grupos
```javascript
function calcularPuntosGrupos(pA, pB, rA, rB) {
  if (pA === rA && pB === rB) return 10; // Resultado exacto
  
  const ganadorP = pA > pB ? 'A' : pA < pB ? 'B' : 'empate';
  const ganadorR = rA > rB ? 'A' : rA < rB ? 'B' : 'empate';
  if (ganadorP === ganadorR) return 5; // Ganador/empate acertado
  
  let puntos = 0;
  if (pA === rA) puntos += 2; // Goles equipo A acertados
  if (pB === rB) puntos += 2; // Goles equipo B acertados
  return puntos;
}
```

### Fase eliminatoria
```javascript
function calcularPuntosEliminatoria(equipoElegido, equipoClasificado) {
  return equipoElegido === equipoClasificado ? 10 : 0;
}
```

### Recálculo global al sincronizar un resultado
```javascript
async function recalcularPuntosUsuarios(matchId, resultadoA, resultadoB) {
  const usersData = await window.storage.get('users', true);
  const users = usersData ? JSON.parse(usersData.value) : [];
  
  for (const user of users) {
    const key = `pronosticos_grupos:${user.alias}`;
    const data = await window.storage.get(key, true);
    if (!data) continue;
    const pronosticos = JSON.parse(data.value);
    const pronostico = pronosticos.find(p => p.matchId === matchId);
    if (pronostico && pronostico.puntos === null) {
      pronostico.puntos = calcularPuntosGrupos(
        pronostico.pronosticoA, pronostico.pronosticoB, resultadoA, resultadoB
      );
      await window.storage.set(key, JSON.stringify(pronosticos), true);
    }
  }
  await actualizarTotalesUsuarios();
}
```

---

## Entregable Esperado

Un **único archivo `.jsx`** que:
- Funcione como SPA completa con las 3 vistas (Grupos, Eliminatorias, Ranking)
- Tenga todos los 48 partidos de la fase de grupos hardcodeados con datos reales del sorteo
- Implemente scraping de Promiedos como fuente principal de resultados, con fallback a API-Football
- Use `window.storage` con `shared: true` para datos compartidos entre usuarios
- Implemente autocompletado de alias en el registro y validación de alias duplicado
- Sea responsive y mobile-first
- No requiera ningún backend ni base de datos externa

---

## Vista: Inicio / Pantalla Principal (HOME)

La pantalla principal es lo primero que ve el usuario al entrar (si ya tiene alias guardado). Debe ser un resumen dinámico del día:

### Sección "Partidos de hoy"
- Muestra todos los partidos del día actual (fecha del dispositivo)
- Para cada partido:
  - Si **aún no se jugó**: muestra hora del partido + equipos + banderas. Si el usuario tiene pronóstico cargado, lo muestra al lado (en gris/tenue). Si no tiene pronóstico, muestra un botón rápido "Cargar pronóstico"
  - Si **ya se jugó o está en curso**: muestra el resultado oficial con marcador destacado. Si terminó, muestra los goles por equipo (quién los hizo, en qué minuto), tarjetas amarillas y rojas
  - Si **no hay partidos hoy**: muestra mensaje "No hay partidos hoy" + próximo partido con cuenta regresiva

### Ficha detallada de partido
Al tocar cualquier partido (ya sea de la home, de Grupos o del historial), se abre una vista de detalle con:
- Resultado final o marcador en tiempo real
- **Goles:** lista con jugador, equipo y minuto (ej: ⚽ Messi 23' · Argentina)
- **Tarjetas amarillas:** jugador, equipo, minuto (🟨)
- **Tarjetas rojas:** jugador, equipo, minuto (🟥)
- Si hubo penal, indicarlo (ej: ⚽ Mbappe 78' (pen))
- El pronóstico del usuario para ese partido + los puntos que obtuvo (si ya terminó)

### Actualización de la home
- Se actualiza automáticamente al abrir la app y al recuperar foco de la ventana
- Indicador de "Última actualización: hace X minutos" en la parte superior

---

## Vista: Grupos (nueva sección)

Esta sección muestra las **posiciones oficiales de todos los grupos** del Mundial 2026, actualizadas automáticamente.

### Diseño
- Tabs o scroll por grupo (A al L), 12 grupos en total
- Cada grupo muestra una tabla con las 4 selecciones:

| Pos | Equipo | J | G | E | P | GF | GC | DIF | PTS |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 🇦🇷 Argentina | 2 | 2 | 0 | 0 | 5 | 1 | +4 | 6 |
| 2 | 🇦🇹 Austria | 2 | 1 | 0 | 1 | 2 | 2 | 0 | 3 |
| 3 | 🇩🇿 Argelia | 2 | 0 | 1 | 1 | 1 | 3 | -2 | 1 |
| 4 | 🇯🇴 Jordania | 2 | 0 | 1 | 1 | 0 | 2 | -2 | 1 |

- La actualización de posiciones viene de la misma fuente que los resultados (Promiedos / API-Football)
- Las posiciones se recalculan con cada resultado nuevo que entra
- Los equipos que clasifican (1ro y 2do) se resaltan visualmente en verde
- Los equipos en el borde de clasificar (mejores 3ros) se resaltan en amarillo

### Grupos hardcodeados del Mundial 2026

Los 12 grupos y sus equipos ya están definidos por sorteo oficial (5 de diciembre de 2025). Deben estar hardcodeados como constante en el código:

```javascript
const GRUPOS_MUNDIAL_2026 = {
  A: ['México', 'Sudáfrica', 'República de Corea', 'Chequia'],
  B: ['Canadá', 'Bosnia y Herzegovina', 'Catar', 'Suiza'],
  C: ['Brasil', 'Marruecos', 'Haití', 'Escocia'],
  D: ['Estados Unidos', 'Paraguay', 'Australia', 'Turquía'],
  E: ['Alemania', 'Curazao', 'Costa de Marfil', 'Ecuador'],
  F: ['Países Bajos', 'Japón', 'Suecia', 'Túnez'],
  G: ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
  H: ['España', 'Cabo Verde', 'Arabia Saudita', 'Uruguay'],
  I: ['Francia', 'Senegal', 'Irak', 'Noruega'],
  J: ['Argentina', 'Argelia', 'Austria', 'Jordania'],
  K: ['Portugal', 'DR Congo', 'Uzbekistán', 'Colombia'],
  L: ['Inglaterra', 'Croacia', 'Ghana', 'Panamá'],
};
```

> ⚠️ Notar que el formato del Mundial 2026 tiene una fase previa a octavos: **Dieciseisavos de final** (32 equipos). Clasifican los 2 primeros de cada grupo (24 equipos) + los 8 mejores terceros (8 equipos) = 32 en total.

---

## Modelo de Datos — Eventos de Partido (Goles y Tarjetas)

### Evento de partido
```json
{
  "matchId": "match_001",
  "tipo": "gol",
  "jugador": "Lionel Messi",
  "equipo": "Argentina",
  "minuto": 23,
  "esPenal": false
}
```

```json
{
  "matchId": "match_001",
  "tipo": "tarjeta_amarilla",
  "jugador": "Nicolás Otamendi",
  "equipo": "Argentina",
  "minuto": 45
}
```

```json
{
  "matchId": "match_001",
  "tipo": "tarjeta_roja",
  "jugador": "Nombre Jugador",
  "equipo": "Rival",
  "minuto": 78
}
```

### Storage key adicional
- `eventos_partido:{matchId}` (shared: true) — lista de eventos (goles, tarjetas) de ese partido

---

## Ampliación de la Integración con Fuente de Datos

La sincronización diaria debe obtener, además de resultados, los **eventos de cada partido finalizado**:

1. **Goles**: jugador, equipo, minuto, si fue penal
2. **Tarjetas amarillas**: jugador, equipo, minuto
3. **Tarjetas rojas**: jugador, equipo, minuto
4. **Posiciones de grupos**: J, G, E, P, GF, GC, DIF, PTS por equipo en cada grupo

### Endpoints relevantes de API-Football (fallback)
```
GET /fixtures/events?fixture={id}   → goles y tarjetas de un partido
GET /standings?league=1&season=2026  → tabla de posiciones de grupos
```

Para Promiedos (fuente principal), el scraping debe parsear:
- Página de resultados del Mundial: `https://www.promiedos.com.ar/league/fifa-world-cup/fjda`
- Incluye resultados, goles y tarjetas por partido

