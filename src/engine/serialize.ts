import type { MatchConfig, StoredMatch } from './types';
import { isValidEventShape, replay } from './scoring';

export const SCHEMA_ID = 'punto-a-punto/match';
export const SCHEMA_VERSION = 1;

export interface MatchFile {
  schema: typeof SCHEMA_ID;
  schemaVersion: number;
  exportedAt: string;
  match: StoredMatch;
}

export type ParseResult = { ok: true; match: StoredMatch } | { ok: false; error: string };

export function exportMatch(match: StoredMatch, now = new Date()): string {
  const file: MatchFile = {
    schema: SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    match,
  };
  return JSON.stringify(file, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isDate = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function validateConfig(c: unknown): string | null {
  if (!isObj(c)) return 'Falta la configuración del partido.';
  const players = c.players;
  if (
    !Array.isArray(players) ||
    players.length !== 2 ||
    players.some((p) => typeof p !== 'string' || p.trim().length === 0 || p.length > 40)
  ) {
    return 'Los nombres de los jugadores son inválidos.';
  }
  if (c.format !== 'single' && c.format !== 'bestOf3') return 'Formato de sets inválido.';
  if (c.firstServer !== 0 && c.firstServer !== 1) return 'Primer sacador inválido.';
  if (c.gameScoring !== 'advantage' && c.gameScoring !== 'goldenPoint') return 'Tipo de game inválido.';
  if (c.decidingSet !== 'fullSet' && c.decidingSet !== 'superTiebreak') return 'Tercer set inválido.';
  return null;
}

/** Valida estructura + historial completo (reglas de tenis). */
export function validateMatch(m: unknown): ParseResult {
  if (!isObj(m)) return { ok: false, error: 'No contiene un partido.' };
  if (typeof m.id !== 'string' || !m.id) return { ok: false, error: 'Falta el identificador del partido.' };
  if (!isDate(m.createdAt) || !isDate(m.updatedAt)) return { ok: false, error: 'Fechas del partido inválidas.' };
  const cfgError = validateConfig(m.config);
  if (cfgError) return { ok: false, error: cfgError };
  if (!Array.isArray(m.events)) return { ok: false, error: 'Falta la lista de puntos.' };
  const ids = new Set<string>();
  for (let i = 0; i < m.events.length; i++) {
    const e = m.events[i];
    if (!isValidEventShape(e)) return { ok: false, error: `Punto ${i + 1}: datos inválidos.` };
    if (ids.has(e.id)) return { ok: false, error: `Punto ${i + 1}: identificador repetido.` };
    ids.add(e.id);
  }
  const config = m.config as unknown as MatchConfig;
  const r = replay(config, m.events);
  if (!r.ok) return { ok: false, error: `Historial inconsistente. ${r.error!.message}` };

  // Copia limpia: descarta campos desconocidos.
  const match: StoredMatch = {
    id: m.id,
    createdAt: m.createdAt as string,
    updatedAt: m.updatedAt as string,
    config: {
      players: [config.players[0].trim(), config.players[1].trim()],
      format: config.format,
      firstServer: config.firstServer,
      gameScoring: config.gameScoring,
      decidingSet: config.decidingSet,
    },
    events: r.records.map(({ event }) => {
      const e = { id: event.id, timestamp: event.timestamp, actor: event.actor, action: event.action } as StoredMatch['events'][number];
      if (event.shot) e.shot = event.shot;
      return e;
    }),
  };
  return { ok: true, match };
}

export function parseMatchFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es JSON válido.' };
  }
  if (!isObj(data) || data.schema !== SCHEMA_ID) {
    return { ok: false, error: 'El archivo no es un partido de Punto a Punto.' };
  }
  if (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion)) {
    return { ok: false, error: 'Falta la versión de esquema.' };
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `El archivo usa la versión de esquema ${data.schemaVersion}; esta app entiende hasta la ${SCHEMA_VERSION}.`,
    };
  }
  if (data.schemaVersion < 1) return { ok: false, error: 'Versión de esquema desconocida.' };
  return validateMatch(data.match);
}
