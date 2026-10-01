import type { ActionType, MatchConfig, PlayerIndex, PointEvent, ShotType } from './types';
import { replay, SERVE_ACTIONS } from './scoring';

export type EditResult =
  | { ok: true; events: PointEvent[] }
  | { ok: false; message: string; index?: number };

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Agrega un punto al final validando contra el estado actual del partido. */
export function addPoint(
  config: MatchConfig,
  events: readonly PointEvent[],
  actor: PlayerIndex,
  action: ActionType,
  opts: { id?: string; timestamp?: string } = {},
): EditResult {
  const event: PointEvent = {
    id: opts.id ?? newId(),
    timestamp: opts.timestamp ?? new Date().toISOString(),
    actor,
    action,
  };
  return validated(config, [...events, event]);
}

export function undoLast(events: readonly PointEvent[]): PointEvent[] {
  return events.slice(0, -1);
}

/**
 * Reemplaza el punto `index` y valida el historial completo.
 * Si algo deja de ser válido, no modifica nada y explica el conflicto.
 */
export function editPoint(
  config: MatchConfig,
  events: readonly PointEvent[],
  index: number,
  patch: { actor?: PlayerIndex; action?: ActionType; shot?: ShotType | null },
): EditResult {
  if (index < 0 || index >= events.length) return { ok: false, message: 'Ese punto no existe.' };
  const prev = events[index];
  const next: PointEvent = {
    ...prev,
    actor: patch.actor ?? prev.actor,
    action: patch.action ?? prev.action,
  };
  const shot = patch.shot === undefined ? prev.shot : patch.shot ?? undefined;
  if (shot && !SERVE_ACTIONS.has(next.action)) next.shot = shot;
  else delete next.shot;
  const copy = events.slice();
  copy[index] = next;
  return validated(config, copy);
}

export function setShot(
  config: MatchConfig,
  events: readonly PointEvent[],
  index: number,
  shot: ShotType | null,
): EditResult {
  const ev = events[index];
  if (!ev) return { ok: false, message: 'Ese punto no existe.' };
  if (shot && SERVE_ACTIONS.has(ev.action)) {
    return { ok: false, message: 'Ace y doble falta ya corresponden al saque.' };
  }
  return editPoint(config, events, index, { shot });
}

function validated(config: MatchConfig, events: PointEvent[]): EditResult {
  const r = replay(config, events);
  if (!r.ok) return { ok: false, message: r.error!.message, index: r.error!.index };
  return { ok: true, events };
}
