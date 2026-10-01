import type { ActionType, PlayerIndex, PointRecord, ShotType } from './types';
import { SHOTS } from './labels';

export interface PlayerStats {
  pointsWon: number;
  pointsWonPct: number;
  /** Golpes ganadores (sin contar aces). */
  winners: number;
  aces: number;
  unforcedErrors: number;
  forcedErrors: number;
  unclassifiedErrors: number;
  doubleFaults: number;
  /** Puntos que ganó marcados "sin detalle". */
  undetailedWon: number;
  servePointsPlayed: number;
  servePointsWon: number;
  returnPointsPlayed: number;
  returnPointsWon: number;
  /** Solo golpes con detalle cargado, por acción del jugador que ejecutó. */
  byShot: Partial<Record<ShotType, Partial<Record<ActionType, number>>>>;
}

export interface MatchStats {
  totalPoints: number;
  players: [PlayerStats, PlayerStats];
}

const empty = (): PlayerStats => ({
  pointsWon: 0,
  pointsWonPct: 0,
  winners: 0,
  aces: 0,
  unforcedErrors: 0,
  forcedErrors: 0,
  unclassifiedErrors: 0,
  doubleFaults: 0,
  undetailedWon: 0,
  servePointsPlayed: 0,
  servePointsWon: 0,
  returnPointsPlayed: 0,
  returnPointsWon: 0,
  byShot: {},
});

export const pct = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 1000) / 10;

export function computeStats(records: readonly PointRecord[]): MatchStats {
  const players: [PlayerStats, PlayerStats] = [empty(), empty()];
  for (const r of records) {
    const { actor, action, shot } = r.event;
    const winner = r.pointWinner;
    const server = r.server;
    const receiver: PlayerIndex = server === 0 ? 1 : 0;
    const a = players[actor];

    players[winner].pointsWon += 1;
    players[server].servePointsPlayed += 1;
    players[receiver].returnPointsPlayed += 1;
    if (winner === server) players[server].servePointsWon += 1;
    else players[receiver].returnPointsWon += 1;

    switch (action) {
      case 'winner':
        a.winners += 1;
        break;
      case 'ace':
        a.aces += 1;
        break;
      case 'won':
        a.undetailedWon += 1;
        break;
      case 'unforced':
        a.unforcedErrors += 1;
        break;
      case 'forced':
        a.forcedErrors += 1;
        break;
      case 'error':
        a.unclassifiedErrors += 1;
        break;
      case 'doubleFault':
        a.doubleFaults += 1;
        break;
    }

    if (shot) {
      const row = (a.byShot[shot] ??= {});
      row[action] = (row[action] ?? 0) + 1;
    }
  }
  const total = records.length;
  for (const p of players) p.pointsWonPct = pct(p.pointsWon, total);
  return { totalPoints: total, players };
}

/** Golpes con al menos un registro, en orden fijo. */
export function shotsWithData(stats: MatchStats): ShotType[] {
  return SHOTS.filter((s) => stats.players.some((p) => p.byShot[s]));
}
