import { useEffect, useRef, useState } from 'react';
import {
  ACTION_LABELS,
  ALL_ACTIONS,
  describeClosure,
  describeLocation,
  editPoint,
  explainPoint,
  formatScoreLine,
  SERVE_ACTIONS,
  SHOT_LABELS,
  SHOTS,
  type ActionType,
  type MatchConfig,
  type PlayerIndex,
  type PointEvent,
  type PointRecord,
  type ShotType,
} from '../engine';
import { Icon, Modal } from './ui';

const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

export function HistoryPanel({
  records,
  config,
  onEdit,
}: {
  records: PointRecord[];
  config: MatchConfig;
  onEdit: (index: number) => void;
}) {
  if (records.length === 0) return <p className="empty">Todavía no hay puntos registrados.</p>;
  const list = [...records].reverse();
  return (
    <ol className="history" aria-label="Historial de puntos (más reciente primero)">
      {list.map((r) => {
        const closures = describeClosure(r, config);
        const ev = r.event;
        return (
          <li key={ev.id} className="card point">
            <div className="point-head">
              <span className="point-num">#{r.number}</span>
              <span className="point-loc">{describeLocation(r)}</span>
              <time className="muted small" dateTime={ev.timestamp}>
                {timeFmt.format(new Date(ev.timestamp))}
              </time>
              <button className="btn small-btn" onClick={() => onEdit(r.number - 1)}>
                <Icon name="edit" /> Editar
              </button>
            </div>
            <dl className="point-grid">
              <dt>Saca</dt>
              <dd>{config.players[r.server]}</dd>
              <dt>Gana</dt>
              <dd>
                <strong>{config.players[r.pointWinner]}</strong>
              </dd>
              <dt>Acción</dt>
              <dd>
                {ACTION_LABELS[ev.action]} de {config.players[ev.actor]}
                {SERVE_ACTIONS.has(ev.action) ? ' · Saque' : ev.shot ? ` · ${SHOT_LABELS[ev.shot]}` : ''}
              </dd>
              <dt>Marcador</dt>
              <dd className="mono">
                {formatScoreLine(r.before, config)} <span aria-label="pasa a">→</span>{' '}
                {formatScoreLine(r.after, config)}
              </dd>
            </dl>
            <Closures texts={closures} />
          </li>
        );
      })}
    </ol>
  );
}

/** Cierres de game / set / partido como etiquetas. */
export function Closures({ texts }: { texts: string[] }) {
  if (texts.length === 0) return null;
  return (
    <div className="closures">
      {texts.map((c) => (
        <span key={c} className={`closure ${c.startsWith('Partido') ? 'match' : c.startsWith('Game') ? 'game' : 'set'}`}>
          {c}
        </span>
      ))}
    </div>
  );
}

export function EditPointDialog({
  index,
  events,
  records,
  config,
  onSave,
  onClose,
}: {
  index: number;
  events: PointEvent[];
  records: PointRecord[];
  config: MatchConfig;
  onSave: (events: PointEvent[]) => void;
  onClose: () => void;
}) {
  const original = events[index];
  const record = records[index];
  const [actor, setActor] = useState<PlayerIndex>(original.actor);
  const [action, setAction] = useState<ActionType>(original.action);
  const [shot, setShotState] = useState<ShotType | null>(original.shot ?? null);
  const [conflict, setConflict] = useState<string | null>(null);
  const conflictRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conflict) conflictRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [conflict]);

  const serveAction = SERVE_ACTIONS.has(action);
  const changed = actor !== original.actor || action !== original.action || (serveAction ? false : shot !== (original.shot ?? null));

  const save = () => {
    const res = editPoint(config, events, index, { actor, action, shot: serveAction ? null : shot });
    if (!res.ok) {
      setConflict(res.message);
      return;
    }
    onSave(res.events);
  };

  return (
    <Modal
      title={`Corregir punto ${index + 1}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} disabled={!changed}>
            Guardar corrección
          </button>
        </>
      }
    >
      {record && (
        <p className="muted small">
          {describeLocation(record)} · Sacaba {config.players[record.server]} · Marcador antes:{' '}
          <span className="mono">{formatScoreLine(record.before, config)}</span>
        </p>
      )}

      <fieldset className="field">
        <legend>Jugador que ejecutó la acción</legend>
        <div className="segmented">
          {([0, 1] as PlayerIndex[]).map((p) => (
            <button
              key={p}
              className={`seg ${actor === p ? 'on' : ''}`}
              aria-pressed={actor === p}
              onClick={() => {
                setActor(p);
                setConflict(null);
              }}
            >
              {actor === p && <Icon name="check" className="seg-check" />}
              <span className="seg-label">{config.players[p]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Acción</legend>
        <div className="edit-actions">
          {ALL_ACTIONS.map((a) => (
            <button
              key={a}
              className={`seg ${action === a ? 'on' : ''}`}
              aria-pressed={action === a}
              onClick={() => {
                setAction(a);
                setConflict(null);
              }}
            >
              {action === a && <Icon name="check" className="seg-check" />}
              <span className="seg-label">{ACTION_LABELS[a]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Golpe (opcional)</legend>
        {serveAction ? (
          <p className="muted small">Ace y doble falta corresponden al saque.</p>
        ) : (
          <div className="chips">
            {SHOTS.map((s) => (
              <button
                key={s}
                className={`chip ${shot === s ? 'on' : ''}`}
                aria-pressed={shot === s}
                onClick={() => setShotState(shot === s ? null : s)}
              >
                {SHOT_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <p className="alert info">{explainPoint(config, { actor, action })}</p>
      {conflict && (
        <div className="alert error" role="alert" ref={conflictRef}>
          <strong>No se aplicó la corrección.</strong> {conflict}
        </div>
      )}
    </Modal>
  );
}
