import { describe, expect, it } from 'vitest';
import {
  addPoint,
  computeStats,
  editPoint,
  exportMatch,
  formatPoints,
  formatScoreLine,
  parseMatchFile,
  pointWinnerOf,
  replay,
  undoLast,
  validateMatch,
  type ActionType,
  type MatchConfig,
  type PlayerIndex,
  type PointEvent,
  type StoredMatch,
} from './index';

const base: MatchConfig = {
  players: ['Ana', 'Bea'],
  format: 'bestOf3',
  firstServer: 0,
  gameScoring: 'advantage',
  decidingSet: 'fullSet',
};

let seq = 0;
const ev = (actor: PlayerIndex, action: ActionType = 'won'): PointEvent => ({
  id: `e${++seq}`,
  timestamp: new Date(2026, 0, 1, 10, 0, seq).toISOString(),
  actor,
  action,
});

/** Puntos ganados por `p`, uno tras otro. */
const pts = (p: PlayerIndex, n: number) => Array.from({ length: n }, () => ev(p));
const game = (p: PlayerIndex) => pts(p, 4);
/** Games alternados según una secuencia de ganadores. */
const games = (...winners: PlayerIndex[]) => winners.flatMap(game);
/** Llega a 6–6 alternando games. */
const toSixAll = () => games(0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1);

const run = (events: PointEvent[], cfg: MatchConfig = base) => {
  const r = replay(cfg, events);
  if (!r.ok) throw new Error(r.error?.message);
  return r;
};

describe('games: deuce, ventajas y punto de oro', () => {
  it('muestra deuce y ventaja con games con ventaja', () => {
    const e = [...pts(0, 3), ...pts(1, 3)];
    let r = run(e);
    expect(formatPoints(r.state, base)).toEqual({ values: ['40', '40'], note: 'Deuce' });

    r = run([...e, ev(1)]);
    expect(formatPoints(r.state, base).values).toEqual(['40', 'AD']);
    expect(formatPoints(r.state, base).note).toBe('Ventaja Bea');

    r = run([...e, ev(1), ev(0)]); // vuelve a deuce
    expect(r.state.games).toEqual([0, 0]);
    expect(formatPoints(r.state, base).note).toBe('Deuce');

    r = run([...e, ev(0), ev(0)]); // ventaja y game
    expect(r.state.games).toEqual([1, 0]);
    expect(r.records.at(-1)!.closure.game).toEqual({ winner: 0, games: [1, 0] });
  });

  it('con punto de oro el punto en 40–40 define el game', () => {
    const cfg: MatchConfig = { ...base, gameScoring: 'goldenPoint' };
    let r = run([...pts(0, 3), ...pts(1, 3)], cfg);
    expect(formatPoints(r.state, cfg).note).toBe('Punto de oro');
    r = run([...pts(0, 3), ...pts(1, 3), ev(1)], cfg);
    expect(r.state.games).toEqual([0, 1]);
    expect(r.state.points).toEqual([0, 0]);
  });
});

describe('sets', () => {
  it('set 6–4', () => {
    const r1 = run(games(0, 1, 0, 1, 0, 1, 0, 1, 0));
    expect(r1.state.games).toEqual([5, 4]);
    expect(r1.state.sets).toHaveLength(0);
    const r2 = run(games(0, 1, 0, 1, 0, 1, 0, 1, 0, 0));
    expect(r2.state.sets[0]).toEqual({ games: [6, 4], winner: 0 });
    expect(r2.state.setsWon).toEqual([1, 0]);
    expect(r2.state.games).toEqual([0, 0]);
  });

  it('5–5 sigue, 7–5 cierra y 6–6 va a tie-break', () => {
    const r = run(games(0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0));
    expect(r.state.sets[0].games).toEqual([7, 5]);
    const t = run(toSixAll());
    expect(t.state.phase).toBe('tiebreak');
    expect(t.state.sets).toHaveLength(0);
  });
});

describe('tie-break y super tie-break', () => {
  it('tie-break a 7 con diferencia de dos', () => {
    let r = run([...toSixAll(), ...pts(0, 6), ...pts(1, 6)]);
    expect(r.state.phase).toBe('tiebreak');
    r = run([...toSixAll(), ...pts(0, 6), ...pts(1, 6), ev(0)]); // 7–6 no alcanza
    expect(r.state.sets).toHaveLength(0);
    r = run([...toSixAll(), ...pts(0, 6), ...pts(1, 6), ev(0), ev(0)]); // 8–6
    expect(r.state.sets[0]).toEqual({ games: [7, 6], tiebreak: [8, 6], winner: 0 });
    expect(formatScoreLine(r.state, base).startsWith('7–6(6)')).toBe(true);
  });

  it('tie-break 7–0 cierra enseguida', () => {
    const r = run([...toSixAll(), ...pts(1, 7)]);
    expect(r.state.sets[0]).toEqual({ games: [6, 7], tiebreak: [0, 7], winner: 1 });
  });

  it('super tie-break a 10 con diferencia de dos en lugar del tercer set', () => {
    const cfg: MatchConfig = { ...base, decidingSet: 'superTiebreak' };
    const setA = games(0, 0, 0, 0, 0, 0);
    const setB = games(1, 1, 1, 1, 1, 1);
    let r = run([...setA, ...setB], cfg);
    expect(r.state.phase).toBe('superTiebreak');
    r = run([...setA, ...setB, ...pts(0, 9), ...pts(1, 9), ev(0)], cfg); // 10–9
    expect(r.state.winner).toBeNull();
    r = run([...setA, ...setB, ...pts(0, 9), ...pts(1, 9), ev(0), ev(0)], cfg); // 11–9
    expect(r.state.winner).toBe(0);
    expect(r.state.sets[2]).toEqual({ games: [1, 0], tiebreak: [11, 9], superTiebreak: true, winner: 0 });
  });

  it('sin super tie-break, el tercer set es normal', () => {
    const r = run([...games(0, 0, 0, 0, 0, 0), ...games(1, 1, 1, 1, 1, 1)]);
    expect(r.state.phase).toBe('game');
    expect(r.state.winner).toBeNull();
  });
});

describe('orden de saque', () => {
  it('rota entre games', () => {
    const r = run(games(0, 0, 1));
    expect(r.records.map((x) => x.server)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
    expect(r.state.server).toBe(1);
  });

  it('en tie-break: 1 punto y luego bloques de 2; el primer restador saca el set siguiente', () => {
    // 12 games alternados: el game 13 lo sacaría Ana (firstServer 0).
    const r = run([...toSixAll(), ...pts(0, 7)]);
    const tb = r.records.filter((x) => x.phase === 'tiebreak').map((x) => x.server);
    expect(tb).toEqual([0, 1, 1, 0, 0, 1, 1]);
    expect(r.state.sets).toHaveLength(1);
    expect(r.state.server).toBe(1); // Bea restó primero → saca el set 2
  });

  it('super tie-break usa el mismo patrón y arranca quien sigue en la rotación', () => {
    const cfg: MatchConfig = { ...base, decidingSet: 'superTiebreak' };
    // 12 games con saque alternado (6 + 6) → el siguiente en la rotación es Ana.
    const r = run([...games(0, 0, 0, 0, 0, 0), ...games(1, 1, 1, 1, 1, 1), ...pts(1, 5)], cfg);
    const stb = r.records.filter((x) => x.phase === 'superTiebreak').map((x) => x.server);
    expect(stb).toEqual([0, 1, 1, 0, 0]);
  });
});

describe('atribución de puntos', () => {
  it('errores y doble falta suman al rival; winner, ace y sin detalle al ejecutor', () => {
    expect(pointWinnerOf({ actor: 0, action: 'winner' })).toBe(0);
    expect(pointWinnerOf({ actor: 0, action: 'ace' })).toBe(0);
    expect(pointWinnerOf({ actor: 0, action: 'won' })).toBe(0);
    expect(pointWinnerOf({ actor: 0, action: 'unforced' })).toBe(1);
    expect(pointWinnerOf({ actor: 0, action: 'forced' })).toBe(1);
    expect(pointWinnerOf({ actor: 0, action: 'error' })).toBe(1);
    expect(pointWinnerOf({ actor: 0, action: 'doubleFault' })).toBe(1);
    const r = run([ev(0, 'unforced'), ev(0, 'doubleFault'), ev(1, 'forced')]);
    expect(r.state.points).toEqual([1, 2]);
  });

  it('ace y doble falta solo del sacador', () => {
    const bad = addPoint(base, [], 1, 'ace');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toMatch(/saca Ana/);
    expect(addPoint(base, [], 1, 'doubleFault').ok).toBe(false);
    expect(addPoint(base, [], 0, 'doubleFault').ok).toBe(true);
  });
});

describe('final de partido', () => {
  const one: MatchConfig = { ...base, format: 'single' };
  const setA = games(0, 0, 0, 0, 0, 0);

  it('termina y bloquea nuevos puntos', () => {
    const r = run(setA, one);
    expect(r.state.winner).toBe(0);
    expect(r.records.at(-1)!.closure.match).toBeTruthy();
    const more = addPoint(one, setA, 0, 'won');
    expect(more.ok).toBe(false);
  });

  it('deshacer el punto final reabre el partido', () => {
    const undone = undoLast(setA);
    const r = run(undone, one);
    expect(r.state.winner).toBeNull();
    expect(r.state.games).toEqual([5, 0]);
    expect(r.state.points).toEqual([3, 0]);
    expect(addPoint(one, undone, 1, 'won').ok).toBe(true);
  });

  it('al mejor de tres termina en 2 sets', () => {
    const r = run([...setA, ...games(1, 1, 1, 1, 1, 1)]);
    expect(r.state.winner).toBeNull();
    const r2 = run([...setA, ...games(0, 0, 0, 0, 0, 0)]);
    expect(r2.state.winner).toBe(0);
  });
});

describe('correcciones', () => {
  it('cambiar un punto puede cambiar el ganador del game y el sacador siguiente', () => {
    // Ana 40–30, luego Ana gana → 1–0; saca Bea.
    const e = [...pts(0, 3), ...pts(1, 2), ev(0), ev(1)];
    let r = run(e);
    expect(r.state.games).toEqual([1, 0]);
    expect(r.state.server).toBe(1);
    // Corrijo el punto 6: fue error no forzado de Ana → 40–40, luego Bea → ventaja Bea.
    const res = editPoint(base, e, 5, { actor: 0, action: 'unforced' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    r = run(res.events);
    expect(r.state.games).toEqual([0, 0]);
    expect(r.state.server).toBe(0);
    expect(formatPoints(r.state, base).note).toBe('Ventaja Bea');
  });

  it('rechaza una corrección que invalida un ace posterior por cambio de sacador', () => {
    // Game 1: Ana gana 4 puntos. Game 2 (saca Bea): ace de Bea.
    const e = [...game(0), ev(1, 'ace')];
    // Si el 4.º punto lo gana Bea, el game 1 no termina y el ace de Bea queda al resto.
    const res = editPoint(base, e, 3, { actor: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.index).toBe(4);
      expect(res.message).toMatch(/ace atribuido a Bea, pero en ese punto saca Ana/);
    }
    expect(e[3].actor).toBe(0); // no se modificó nada
  });

  it('rechaza una corrección que termina el partido antes de puntos posteriores', () => {
    const one: MatchConfig = { ...base, format: 'single' };
    // 5–0 Ana, game 6 Bea gana 1 punto y luego Ana 4 → 6–0.
    const e = [...games(0, 0, 0, 0, 0), ev(0, 'unforced'), ...pts(0, 4)];
    expect(run(e, one).state.winner).toBe(0);
    // Si el punto 21 fuera de Ana, el partido terminaría 1 punto antes.
    const res = editPoint(one, e, 20, { action: 'winner' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/terminaría en el punto 24/);
  });

  it('cambiar el golpe no altera el marcador y ace/doble falta no aceptan golpe', () => {
    const e = [ev(0, 'winner')];
    const res = editPoint(base, e, 0, { shot: 'backhand' });
    expect(res.ok && res.events[0].shot).toBe('backhand');
    const res2 = editPoint(base, e, 0, { action: 'ace', shot: 'forehand' });
    expect(res2.ok && res2.events[0].shot).toBeUndefined();
  });
});

describe('estadísticas', () => {
  it('cuenta por jugador, saque/devolución y golpes', () => {
    const e = [
      { ...ev(0, 'ace') },
      { ...ev(0, 'doubleFault') },
      { ...ev(1, 'winner'), shot: 'backhand' as const },
      { ...ev(1, 'unforced'), shot: 'forehand' as const },
      ev(0, 'forced'),
      ev(1, 'error'),
    ];
    const s = computeStats(run(e).records);
    expect(s.totalPoints).toBe(6);
    const [a, b] = s.players;
    expect(a.pointsWon).toBe(3);
    expect(b.pointsWon).toBe(3);
    expect(a.aces).toBe(1);
    expect(a.doubleFaults).toBe(1);
    expect(b.winners).toBe(1);
    expect(b.unforcedErrors).toBe(1);
    expect(a.forcedErrors).toBe(1);
    expect(b.unclassifiedErrors).toBe(1);
    expect(a.servePointsPlayed).toBe(6);
    expect(a.servePointsWon).toBe(3);
    expect(b.returnPointsWon).toBe(3);
    expect(b.byShot.backhand).toEqual({ winner: 1 });
    expect(b.byShot.forehand).toEqual({ unforced: 1 });
    expect(a.pointsWonPct).toBe(50);
  });
});

describe('guardado, importación y validación', () => {
  const match: StoredMatch = {
    id: 'm1',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:30:00.000Z',
    config: base,
    events: [ev(0, 'ace'), { ...ev(1, 'winner'), shot: 'lob' }],
  };

  it('exporta e importa sin pérdida', () => {
    const res = parseMatchFile(exportMatch(match));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.match).toEqual(match);
  });

  it('rechaza JSON roto, esquema ajeno o versión futura', () => {
    expect(parseMatchFile('{nope').ok).toBe(false);
    expect(parseMatchFile(JSON.stringify({ foo: 1 })).ok).toBe(false);
    const future = JSON.parse(exportMatch(match));
    future.schemaVersion = 99;
    const r = parseMatchFile(JSON.stringify(future));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/versión de esquema 99/);
  });

  it('rechaza historiales que violan las reglas', () => {
    const bad = { ...match, events: [ev(1, 'ace')] };
    const r = validateMatch(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Historial inconsistente/);
    const dup = { ...match, events: [match.events[0], match.events[0]] };
    expect(validateMatch(dup).ok).toBe(false);
    const badCfg = { ...match, config: { ...base, players: ['Ana', ''] } };
    expect(validateMatch(badCfg).ok).toBe(false);
  });

  it('restaura el marcador desde los eventos guardados', () => {
    const saved = { ...match, events: [...games(0, 1, 0), ...pts(1, 2)] };
    const res = parseMatchFile(exportMatch(saved));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = run(res.match.events);
    expect(r.state.games).toEqual([2, 1]);
    expect(r.state.points).toEqual([0, 2]);
    expect(r.state.server).toBe(1);
  });
});
