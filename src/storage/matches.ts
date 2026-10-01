// Persistencia local. Separada del motor: el motor no sabe nada de localStorage.
import { validateMatch, type StoredMatch } from '../engine';

const PREFIX = 'punto-a-punto.v1';
const INDEX_KEY = `${PREFIX}.index`;
const matchKey = (id: string) => `${PREFIX}.match.${id}`;

export type StorageResult = { ok: true } | { ok: false; error: string };

function getStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = `${PREFIX}.probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function describe(e: unknown): string {
  if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
    return 'El almacenamiento del navegador está lleno. Exportá y eliminá partidos viejos.';
  }
  return 'No se pudo guardar en este navegador (¿modo privado o almacenamiento bloqueado?). Exportá el partido para no perderlo.';
}

function readIndex(s: Storage): string[] {
  try {
    const raw = s.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function loadMatches(): { matches: StoredMatch[]; problems: string[]; available: boolean } {
  const s = getStorage();
  if (!s) {
    return {
      matches: [],
      problems: ['El almacenamiento local no está disponible: los partidos no se van a guardar al recargar.'],
      available: false,
    };
  }
  const problems: string[] = [];
  const matches: StoredMatch[] = [];
  for (const id of readIndex(s)) {
    const raw = s.getItem(matchKey(id));
    if (!raw) continue;
    try {
      const res = validateMatch(JSON.parse(raw));
      if (res.ok) matches.push(res.match);
      else problems.push(`Un partido guardado no se pudo restaurar: ${res.error}`);
    } catch {
      problems.push('Un partido guardado está dañado y no se pudo leer.');
    }
  }
  matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { matches, problems, available: true };
}

export function saveMatch(match: StoredMatch): StorageResult {
  const s = getStorage();
  if (!s) return { ok: false, error: describe(null) };
  try {
    s.setItem(matchKey(match.id), JSON.stringify(match));
    const index = readIndex(s);
    if (!index.includes(match.id)) {
      index.push(match.id);
      s.setItem(INDEX_KEY, JSON.stringify(index));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

export function deleteMatch(id: string): StorageResult {
  const s = getStorage();
  if (!s) return { ok: false, error: describe(null) };
  try {
    s.removeItem(matchKey(id));
    s.setItem(INDEX_KEY, JSON.stringify(readIndex(s).filter((x) => x !== id)));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

const LAST_KEY = `${PREFIX}.lastOpen`;
export function rememberLastOpen(id: string | null) {
  try {
    if (id) window.localStorage.setItem(LAST_KEY, id);
    else window.localStorage.removeItem(LAST_KEY);
  } catch {
    /* no crítico */
  }
}
export function lastOpen(): string | null {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
