// Tipos del motor de tenis. Sin dependencias de React ni del navegador.

export type PlayerIndex = 0 | 1;

export type ActionType =
  | 'winner' // golpe ganador → suma al que ejecuta
  | 'ace' // ace → suma al que ejecuta (debe ser el sacador)
  | 'won' // punto ganado sin detalle → suma al que ejecuta
  | 'unforced' // error no forzado → suma al rival
  | 'forced' // error forzado → suma al rival
  | 'error' // error sin clasificar → suma al rival
  | 'doubleFault'; // doble falta → suma al rival (debe ser el sacador)

export type ShotType = 'forehand' | 'backhand' | 'volley' | 'smash' | 'drop' | 'lob';

export type SetFormat = 'single' | 'bestOf3';
export type GameScoring = 'advantage' | 'goldenPoint';
export type DecidingSet = 'fullSet' | 'superTiebreak';

export interface MatchConfig {
  players: [string, string];
  format: SetFormat;
  firstServer: PlayerIndex;
  gameScoring: GameScoring;
  /** Solo aplica a bestOf3: tercer set normal o super tie-break a 10. */
  decidingSet: DecidingSet;
}

export interface PointEvent {
  id: string;
  /** ISO 8601 */
  timestamp: string;
  /** Jugador que ejecutó la acción (no necesariamente quien gana el punto). */
  actor: PlayerIndex;
  action: ActionType;
  /** Saque para ace/doble falta; opcional para el resto. */
  shot?: ShotType;
}

export type Phase = 'game' | 'tiebreak' | 'superTiebreak';

export interface CompletedSet {
  games: [number, number];
  /** Puntos del tie-break o super tie-break, si hubo. */
  tiebreak?: [number, number];
  /** true si el "set" fue un super tie-break en lugar del tercer set. */
  superTiebreak?: boolean;
  winner: PlayerIndex;
}

export interface ScoreState {
  sets: CompletedSet[];
  setsWon: [number, number];
  /** Games del set en curso. */
  games: [number, number];
  /** Puntos del game / tie-break en curso (numéricos). */
  points: [number, number];
  phase: Phase;
  server: PlayerIndex;
  /** Quién sacó el primer punto del tie-break en curso (si hay). */
  tiebreakFirstServer: PlayerIndex | null;
  winner: PlayerIndex | null;
}

export interface PointClosure {
  game?: { winner: PlayerIndex; games: [number, number] };
  set?: { winner: PlayerIndex; set: CompletedSet; setNumber: number };
  match?: { winner: PlayerIndex; setsWon: [number, number] };
}

export interface PointRecord {
  /** 1-based */
  number: number;
  event: PointEvent;
  setNumber: number;
  /** Número de game dentro del set (1-based). En tie-break, 13. */
  gameNumber: number;
  phase: Phase;
  server: PlayerIndex;
  pointWinner: PlayerIndex;
  before: ScoreState;
  after: ScoreState;
  closure: PointClosure;
}

export interface ReplayError {
  /** Índice 0-based del evento que falla. */
  index: number;
  code: 'AFTER_MATCH_END' | 'SERVE_ACTION_BY_RECEIVER' | 'INVALID_EVENT';
  message: string;
}

export interface ReplayResult {
  ok: boolean;
  records: PointRecord[];
  /** Estado tras el último evento válido. */
  state: ScoreState;
  error?: ReplayError;
}

export interface StoredMatch {
  id: string;
  createdAt: string;
  updatedAt: string;
  config: MatchConfig;
  events: PointEvent[];
}
