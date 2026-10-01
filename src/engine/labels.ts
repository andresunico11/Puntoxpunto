import type {
  ActionType,
  CompletedSet,
  MatchConfig,
  PointEvent,
  PointRecord,
  ScoreState,
  ShotType,
} from './types';

export const ACTION_LABELS: Record<ActionType, string> = {
  winner: 'Golpe ganador',
  ace: 'Ace',
  won: 'Punto ganado sin detalle',
  unforced: 'Error no forzado',
  forced: 'Error forzado',
  error: 'Error sin clasificar',
  doubleFault: 'Doble falta',
};

export const SHOT_LABELS: Record<ShotType, string> = {
  forehand: 'Derecha',
  backhand: 'Revés',
  volley: 'Volea',
  smash: 'Smash',
  drop: 'Drop',
  lob: 'Globo',
};

export const SHOTS: readonly ShotType[] = ['forehand', 'backhand', 'volley', 'smash', 'drop', 'lob'];

const GAME_POINTS = ['0', '15', '30', '40'];

/** Puntaje del game / tie-break en curso, por jugador, más una nota (Deuce, Ventaja…). */
export function formatPoints(
  state: ScoreState,
  config: MatchConfig,
): { values: [string, string]; note: string | null } {
  const [a, b] = state.points;
  if (state.phase !== 'game') {
    return {
      values: [String(a), String(b)],
      note: state.phase === 'tiebreak' ? 'Tie-break' : 'Super tie-break',
    };
  }
  if (a >= 3 && b >= 3) {
    if (a === b) {
      return {
        values: ['40', '40'],
        note: config.gameScoring === 'goldenPoint' ? 'Punto de oro' : 'Deuce',
      };
    }
    const leader = a > b ? 0 : 1;
    const values: [string, string] = ['40', '40'];
    values[leader] = 'AD';
    return { values, note: `Ventaja ${config.players[leader]}` };
  }
  return { values: [GAME_POINTS[a], GAME_POINTS[b]], note: null };
}

export function formatSet(set: CompletedSet): string {
  if (set.superTiebreak && set.tiebreak) return `[${set.tiebreak[0]}–${set.tiebreak[1]}]`;
  const base = `${set.games[0]}–${set.games[1]}`;
  if (set.tiebreak) {
    const loserPts = Math.min(set.tiebreak[0], set.tiebreak[1]);
    return `${base}(${loserPts})`;
  }
  return base;
}

/** Línea compacta: sets cerrados · games · puntos. Ej.: "6–4 · 3–2 · 30–15". */
export function formatScoreLine(state: ScoreState, config: MatchConfig): string {
  const parts = state.sets.map(formatSet);
  if (state.winner !== null) return parts.join(' · ') || '—';
  const { values } = formatPoints(state, config);
  if (state.phase === 'superTiebreak') {
    parts.push(`STB ${values[0]}–${values[1]}`);
  } else {
    parts.push(`${state.games[0]}–${state.games[1]}`);
    parts.push(state.phase === 'tiebreak' ? `TB ${values[0]}–${values[1]}` : `${values[0]}–${values[1]}`);
  }
  return parts.join(' · ');
}

export function explainPoint(config: MatchConfig, event: Pick<PointEvent, 'actor' | 'action'>): string {
  const actor = config.players[event.actor];
  const rival = config.players[event.actor === 0 ? 1 : 0];
  switch (event.action) {
    case 'winner':
      return `Punto para ${actor}: golpe ganador.`;
    case 'ace':
      return `Punto para ${actor}: ace.`;
    case 'won':
      return `Punto para ${actor}.`;
    case 'unforced':
      return `Punto para ${rival}: error no forzado de ${actor}.`;
    case 'forced':
      return `Punto para ${rival}: error forzado de ${actor}.`;
    case 'error':
      return `Punto para ${rival}: error de ${actor}.`;
    case 'doubleFault':
      return `Punto para ${rival}: doble falta de ${actor}.`;
  }
}

export function describeLocation(r: PointRecord): string {
  if (r.phase === 'superTiebreak') return `Super tie-break`;
  if (r.phase === 'tiebreak') return `Set ${r.setNumber} · Tie-break`;
  return `Set ${r.setNumber} · Game ${r.gameNumber}`;
}

/** Texto explícito de cierre de game / set / partido para el historial. */
export function describeClosure(r: PointRecord, config: MatchConfig): string[] {
  const out: string[] = [];
  const { closure } = r;
  if (closure.game && r.phase === 'game') {
    out.push(
      `Game para ${config.players[closure.game.winner]} (${closure.game.games[0]}–${closure.game.games[1]})`,
    );
  }
  if (closure.set) {
    const label = closure.set.set.superTiebreak ? 'Super tie-break' : `Set ${closure.set.setNumber}`;
    out.push(`${label} para ${config.players[closure.set.winner]} ${formatSet(closure.set.set)}`);
  }
  if (closure.match) {
    out.push(`Partido para ${config.players[closure.match.winner]}`);
  }
  return out;
}

export function formatMatchSummary(state: ScoreState): string {
  return state.sets.map(formatSet).join(' ');
}
