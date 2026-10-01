import type {
  ActionType,
  CompletedSet,
  MatchConfig,
  PlayerIndex,
  PointClosure,
  PointEvent,
  PointRecord,
  ReplayError,
  ReplayResult,
  ScoreState,
} from './types';
import { ACTION_LABELS } from './labels';

export const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

const ACTOR_WINS: ReadonlySet<ActionType> = new Set(['winner', 'ace', 'won']);
export const SERVE_ACTIONS: ReadonlySet<ActionType> = new Set(['ace', 'doubleFault']);
export const ALL_ACTIONS: readonly ActionType[] = [
  'winner',
  'ace',
  'unforced',
  'forced',
  'error',
  'doubleFault',
  'won',
];

/** Winner, ace y punto sin detalle suman al que ejecuta; errores y doble falta, al rival. */
export function pointWinnerOf(event: Pick<PointEvent, 'actor' | 'action'>): PlayerIndex {
  return ACTOR_WINS.has(event.action) ? event.actor : other(event.actor);
}

export function initialState(config: MatchConfig): ScoreState {
  return {
    sets: [],
    setsWon: [0, 0],
    games: [0, 0],
    points: [0, 0],
    phase: 'game',
    server: config.firstServer,
    tiebreakFirstServer: null,
    winner: null,
  };
}

/**
 * Sacador del punto n (0-based) de un tie-break:
 * el primero saca 1 punto, luego bloques de 2 alternados.
 */
export function tiebreakServer(first: PlayerIndex, pointsPlayed: number): PlayerIndex {
  if (pointsPlayed === 0) return first;
  return Math.floor((pointsPlayed - 1) / 2) % 2 === 0 ? other(first) : first;
}

function cloneState(s: ScoreState): ScoreState {
  return {
    ...s,
    sets: s.sets.map((set) => ({
      ...set,
      games: [...set.games] as [number, number],
      tiebreak: set.tiebreak ? ([...set.tiebreak] as [number, number]) : undefined,
    })),
    setsWon: [...s.setsWon] as [number, number],
    games: [...s.games] as [number, number],
    points: [...s.points] as [number, number],
  };
}

export function setsToWin(config: MatchConfig): number {
  return config.format === 'single' ? 1 : 2;
}

/** Aplica un punto ganado por `w` y devuelve el nuevo estado y qué se cerró. */
export function applyPoint(
  prev: ScoreState,
  config: MatchConfig,
  w: PlayerIndex,
): { state: ScoreState; closure: PointClosure } {
  if (prev.winner !== null) throw new Error('El partido ya terminó');
  const s = cloneState(prev);
  const l = other(w);
  const closure: PointClosure = {};

  const finishSet = (set: CompletedSet, nextServer: PlayerIndex) => {
    s.sets.push(set);
    s.setsWon[w] += 1;
    closure.set = { winner: w, set, setNumber: s.sets.length };
    s.games = [0, 0];
    s.points = [0, 0];
    s.tiebreakFirstServer = null;
    s.server = nextServer;
    if (s.setsWon[w] >= setsToWin(config)) {
      s.winner = w;
      s.phase = 'game';
      closure.match = { winner: w, setsWon: [...s.setsWon] as [number, number] };
      return;
    }
    if (
      config.format === 'bestOf3' &&
      config.decidingSet === 'superTiebreak' &&
      s.setsWon[0] === 1 &&
      s.setsWon[1] === 1
    ) {
      s.phase = 'superTiebreak';
      s.tiebreakFirstServer = nextServer;
    } else {
      s.phase = 'game';
    }
  };

  if (s.phase === 'game') {
    s.points[w] += 1;
    const golden = config.gameScoring === 'goldenPoint';
    const won = s.points[w] >= 4 && (golden || s.points[w] - s.points[l] >= 2);
    if (!won) return { state: s, closure };

    s.games[w] += 1;
    s.points = [0, 0];
    closure.game = { winner: w, games: [...s.games] as [number, number] };
    const nextServer = other(s.server);

    if (s.games[w] >= 6 && s.games[w] - s.games[l] >= 2) {
      finishSet({ games: [...s.games] as [number, number], winner: w }, nextServer);
    } else if (s.games[0] === 6 && s.games[1] === 6) {
      s.phase = 'tiebreak';
      s.tiebreakFirstServer = nextServer;
      s.server = nextServer;
    } else {
      s.server = nextServer;
    }
    return { state: s, closure };
  }

  // Tie-break o super tie-break
  const first = s.tiebreakFirstServer ?? s.server;
  s.points[w] += 1;
  const target = s.phase === 'tiebreak' ? 7 : 10;
  if (s.points[w] >= target && s.points[w] - s.points[l] >= 2) {
    const tb = [...s.points] as [number, number];
    // El primer restador del tie-break saca el set siguiente.
    const nextServer = other(first);
    if (s.phase === 'tiebreak') {
      s.games[w] += 1;
      closure.game = { winner: w, games: [...s.games] as [number, number] };
      finishSet({ games: [...s.games] as [number, number], tiebreak: tb, winner: w }, nextServer);
    } else {
      const games: [number, number] = [0, 0];
      games[w] = 1;
      finishSet({ games, tiebreak: tb, superTiebreak: true, winner: w }, nextServer);
    }
    return { state: s, closure };
  }
  s.server = tiebreakServer(first, s.points[0] + s.points[1]);
  return { state: s, closure };
}

const VALID_ACTIONS = new Set<string>(ALL_ACTIONS);
const VALID_SHOTS = new Set<string>(['forehand', 'backhand', 'volley', 'smash', 'drop', 'lob']);

export function isValidEventShape(e: unknown): e is PointEvent {
  if (!e || typeof e !== 'object') return false;
  const ev = e as Record<string, unknown>;
  return (
    typeof ev.id === 'string' &&
    ev.id.length > 0 &&
    typeof ev.timestamp === 'string' &&
    !Number.isNaN(Date.parse(ev.timestamp)) &&
    (ev.actor === 0 || ev.actor === 1) &&
    typeof ev.action === 'string' &&
    VALID_ACTIONS.has(ev.action) &&
    (ev.shot === undefined || (typeof ev.shot === 'string' && VALID_SHOTS.has(ev.shot)))
  );
}

/**
 * Recalcula todo el partido desde los eventos. Se detiene en el primer evento
 * inválido y lo informa; nunca corrige ni descarta datos por su cuenta.
 */
export function replay(config: MatchConfig, events: readonly PointEvent[]): ReplayResult {
  let state = initialState(config);
  const records: PointRecord[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const fail = (error: ReplayError): ReplayResult => ({ ok: false, records, state, error });

    if (!isValidEventShape(event)) {
      return fail({ index: i, code: 'INVALID_EVENT', message: `Punto ${i + 1}: datos inválidos.` });
    }
    if (state.winner !== null) {
      const lastPoint = records.length;
      return fail({
        index: i,
        code: 'AFTER_MATCH_END',
        message:
          `El partido terminaría en el punto ${lastPoint} (gana ${config.players[state.winner]}), ` +
          `pero hay ${events.length - i} punto(s) registrados después. ` +
          `Deshacé o corregí esos puntos antes de aplicar este cambio.`,
      });
    }
    if (SERVE_ACTIONS.has(event.action) && event.actor !== state.server) {
      return fail({
        index: i,
        code: 'SERVE_ACTION_BY_RECEIVER',
        message:
          `Punto ${i + 1}: ${ACTION_LABELS[event.action].toLowerCase()} atribuido a ` +
          `${config.players[event.actor]}, pero en ese punto saca ${config.players[state.server]}.`,
      });
    }

    const before = state;
    const w = pointWinnerOf(event);
    const { state: after, closure } = applyPoint(before, config, w);
    records.push({
      number: i + 1,
      event,
      setNumber: before.sets.length + 1,
      gameNumber: before.phase === 'superTiebreak' ? 1 : before.games[0] + before.games[1] + 1,
      phase: before.phase,
      server: before.server,
      pointWinner: w,
      before,
      after,
      closure,
    });
    state = after;
  }
  return { ok: true, records, state };
}
