# Punto a Punto

Web app para que un observador registre un partido de tenis singles punto a punto desde el celular.
React + TypeScript + Vite. Sin backend ni login: todo se guarda en el navegador (localStorage).

## Ejecutar

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # pruebas del motor (Vitest)
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

Para probar desde el celular en la misma red Wi-Fi: `npm run dev -- --host` y abrí la IP que muestra Vite.

## Desplegar

`npm run build` genera un sitio estático en `dist/`. Cualquier hosting estático sirve; no hace falta configurar rutas (la app no usa URLs internas).

- **Vercel**: importá el repo → framework "Vite" (build `npm run build`, output `dist`). O desde la terminal: `npx vercel --prod`.
- **Netlify**: build `npm run build`, publish `dist`. O arrastrá la carpeta `dist/` en app.netlify.com/drop.
- **GitHub Pages**: si se publica en un subpath (`usuario.github.io/punto-a-punto/`), agregá `base: '/punto-a-punto/'` en `vite.config.ts` antes de buildear.

Los datos viven en el navegador de cada dispositivo y dominio: cambiar de dominio o borrar datos del sitio los pierde. Usá **Exportar** para respaldar o pasar un partido a otro dispositivo.

## Estructura

```
src/
  engine/            Motor de tenis puro (sin React ni navegador) — reutilizable
    types.ts         Config, eventos, estado
    scoring.ts       replay(): recalcula todo desde los eventos; reglas de saque y tie-break
    history.ts       addPoint / editPoint / setShot / undoLast con validación completa
    stats.ts         Estadísticas por jugador
    serialize.ts     Export/import JSON con versión de esquema y validación
    labels.ts        Textos en español y formato de marcador
    engine.test.ts   25 pruebas
  storage/matches.ts Persistencia en localStorage con aviso de errores
  components/        UI (Inicio, Configuración, Marcador, Registro, Historial, Estadísticas)
e2e/verificar.py     Verificación en navegador (Playwright, viewport de celular)
```

### Modelo de datos

Lo único que se guarda es la configuración y la lista de eventos. Marcador, ganador de cada punto y sacador **se derivan** siempre recalculando desde el primer evento, así una corrección en el punto 3 se propaga sola.

```ts
PointEvent = { id, timestamp, actor: 0 | 1, action, shot? }
// action: winner | ace | won | unforced | forced | error | doubleFault
// shot:   forehand | backhand | volley | smash | drop | lob
```

- `winner`, `ace`, `won` → punto para `actor`. Errores y doble falta → punto para el rival.
- Ace y doble falta solo son válidos si `actor` es el sacador de ese punto, y no llevan golpe (corresponden al saque).

Archivo exportado:

```json
{ "schema": "punto-a-punto/match", "schemaVersion": 1, "exportedAt": "…", "match": { "id", "createdAt", "updatedAt", "config", "events" } }
```

Al importar se valida el JSON, el esquema, la versión, la configuración, cada evento, ids únicos y **el historial completo contra las reglas**. Si el id ya existe se importa como copia (nunca se pisa un partido).

## Reglas implementadas

- Games con ventaja (deuce / ventaja) o punto de oro (en 40–40 define un punto).
- Sets a 6 con diferencia de 2; en 6–6, tie-break a 7 con diferencia de 2.
- Un set o al mejor de tres; opcional super tie-break a 10 con diferencia de 2 en lugar del tercer set.
- Saque: alterna cada game (también entre sets). En tie-break y super tie-break, el primer sacador saca 1 punto y después bloques de 2. El primer restador del tie-break saca el primer game del set siguiente. El super tie-break lo arranca quien sigue en la rotación.
- Al terminar el partido no se aceptan puntos nuevos; deshacer y corregir siguen disponibles.

## Correcciones

Cualquier punto se puede editar (jugador, acción, golpe) desde el Historial; el último, también con "Corregir último". Antes de aceptar se recalcula el partido completo. Si el cambio:

- hace que el partido termine antes de puntos ya cargados, o
- deja un ace/doble falta atribuido a quien ahora resulta restador,

la corrección **no se aplica** y se explica el conflicto (ej.: "Punto 6: ace atribuido a Bea, pero en ese punto saca Ana."). No se borra ni reasigna nada automáticamente.

## Verificaciones realizadas

**Pruebas del motor** (`npm test`, 25 casos, todas pasan): deuce/ventaja/punto de oro; set 6–4, 7–5 y llegada a tie-break en 6–6; tie-break 8–6 y 7–0; super tie-break 11–9 (10–9 no alcanza); tercer set normal sin super tie-break; rotación de saque entre games, en tie-break (1-2-2) y después del tie-break; orden en super tie-break; atribución de cada acción; ace/doble falta del restador rechazados; final de partido bloquea puntos; deshacer el punto final reabre; correcciones que cambian game y sacador; corrección rechazada por ace inválido y por final anticipado; estadísticas; export→import sin pérdida; JSON roto, esquema ajeno, versión futura, historial inválido, ids duplicados y nombres vacíos rechazados; restauración del marcador desde eventos.

**Navegador** (`e2e/verificar.py`, Chromium 390×844 táctil + 1280×860, 23 chequeos, todos pasan): inicio vacío sin datos de demo → validación de nombres → crear partido → ace/doble falta deshabilitados para el restador → cargar puntos → agregar golpe después → game 1–0 y cambio de saque → historial con cierre "Game para Ana (1–0)" → corregir último punto y recálculo → corrección conflictiva rechazada sin tocar datos → deshacer → **recargar la página** y restaurar → volver, listar y retomar → estadísticas verificadas contra valores esperados → exportar JSON → eliminar con confirmación → importar inválido (rechazado), válido y duplicado (copia) → partido a un set hasta tie-break con orden de saque 1-2-2 → final de partido bloquea el registro → deshacer el punto final reabre → layout de escritorio → aviso cuando localStorage falla → todos los botones visibles ≥ 48 px → sin errores de JavaScript.

## Limitaciones pendientes

- Sin sincronización entre dispositivos: los datos quedan en el navegador. Exportar/importar es el respaldo.
- No se registran primer/segundo saque, duración del peloteo ni ubicación de golpes (y por eso no hay estadísticas de eso).
- Sin "rehacer" después de deshacer.
- Una corrección en conflicto se rechaza; para aplicarla hay que deshacer o corregir primero los puntos posteriores (no hay opción de recortar el historial automáticamente).
- Sets siempre a 6 games con tie-break en 6–6: no hay sets largos sin tie-break, pro-sets ni dobles.
- No es PWA instalable ni funciona offline sin haber cargado la página antes (se puede sumar con `vite-plugin-pwa`).
- Probado en Chromium; no se probó en Safari iOS real.

## Deploy en Vercel

El repo incluye `vercel.json` listo para usar:

1. En [vercel.com/new](https://vercel.com/new) importá el repositorio `Puntoxpunto`.
2. Vercel detecta Vite automáticamente (build: `npm run build`, salida: `dist`). No hace falta configurar variables de entorno.
3. Cada push a la rama principal publica en producción; las demás ramas generan previews.

Requiere Node 22.12 o superior (el default de Vercel ya lo cumple).

## Diseño

Estética de marcador analógico de club: tablero verde con placas intercambiables, bisagras y remaches hechos con CSS (sin imágenes). El tema está centralizado en variables CSS al inicio de `src/index.css`. Las fuentes (Barlow y Barlow Condensed, licencia SIL OFL) se sirven localmente desde `src/assets/fonts`. Al cambiar un valor, solo gira esa placa (~190 ms); con `prefers-reduced-motion` no hay animación.

`e2e/visual.py` revisa el tablero a 360, 390, 430 y 1280 px en estados normal, deuce, ventaja, tie-break, super tie-break y final, y guarda capturas en `e2e/capturas/`.
