import { useState } from 'react';
import {
  ACTION_LABELS,
  addPoint,
  explainPoint,
  pointWinnerOf,
  SERVE_ACTIONS,
  setShot,
  SHOT_LABELS,
  SHOTS,
  type ActionType,
  type MatchConfig,
  type PlayerIndex,
  type PointEvent,
  type PointRecord,
  type ScoreState,
  type ShotType,
} from '../engine';
import { ServeBall } from './ui';

const WIN_ACTIONS: ActionType[] = ['winner', 'ace', 'won'];
const ERR_ACTIONS: ActionType[] = ['unforced', 'forced', 'error', 'doubleFault'];

export function RecordPanel({
  config,
  events,
  state,
  lastRecord,
  onEvents,
}: {
  config: MatchConfig;
  events: PointEvent[];
  state: ScoreState;
  lastRecord: PointRecord | undefined;
  onEvents: (events: PointEvent[]) => void;
}) {
  const [selected, setSelected] = useState<PlayerIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finished = state.winner !== null;
  const activeSelected = finished ? null : selected;

  const register = (action: ActionType) => {
    if (activeSelected === null) return;
    const res = addPoint(config, events, activeSelected, action);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError(null);
    setSelected(null);
    onEvents(res.events);
  };

  const actionButton = (action: ActionType) => {
    const serveOnly = SERVE_ACTIONS.has(action);
    const notServer = activeSelected !== null && serveOnly && activeSelected !== state.server;
    const disabled = activeSelected === null || notServer;
    const beneficiary = activeSelected === null ? null : pointWinnerOf({ actor: activeSelected, action });
    return (
      <button
        key={action}
        className={`btn action ${WIN_ACTIONS.includes(action) ? 'win' : 'err'}`}
        disabled={disabled}
        onClick={() => register(action)}
      >
        <span className="action-label">{ACTION_LABELS[action]}</span>
        <span className="action-hint">
          {notServer
            ? `Solo ${config.players[state.server]} (saca)`
            : beneficiary !== null
              ? `Punto para ${config.players[beneficiary]}`
              : serveOnly
                ? 'Solo el sacador'
                : ' '}
        </span>
      </button>
    );
  };

  return (
    <section className="record" aria-label="Registrar punto">
      {finished ? (
        <p className="alert info">
          Partido terminado. No se pueden cargar más puntos; podés deshacer o corregir desde el historial.
        </p>
      ) : (
        <>
          <h2 className="step">1 · ¿Quién ejecutó la acción?</h2>
          <div className="players" role="radiogroup" aria-label="Jugador">
            {([0, 1] as PlayerIndex[]).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={activeSelected === p}
                className={`btn player-btn ${activeSelected === p ? 'on' : ''}`}
                onClick={() => {
                  setSelected(activeSelected === p ? null : p);
                  setError(null);
                }}
              >
                <span className="player-btn-name">{config.players[p]}</span>
                {state.server === p && (
                  <span className="serving-tag">
                    <ServeBall /> saca
                  </span>
                )}
              </button>
            ))}
          </div>

          <h2 className="step">2 · Acción {activeSelected === null && <span className="muted">(elegí un jugador)</span>}</h2>
          <div className="actions">
            <div className="action-group">{WIN_ACTIONS.map(actionButton)}</div>
            <div className="action-group">{ERR_ACTIONS.map(actionButton)}</div>
          </div>
        </>
      )}

      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}

      {lastRecord && (
        <LastPoint
          record={lastRecord}
          config={config}
          onShot={(shot) => {
            const res = setShot(config, events, lastRecord.number - 1, shot);
            if (res.ok) onEvents(res.events);
            else setError(res.message);
          }}
        />
      )}
    </section>
  );
}

function LastPoint({
  record,
  config,
  onShot,
}: {
  record: PointRecord;
  config: MatchConfig;
  onShot: (shot: ShotType | null) => void;
}) {
  const ev = record.event;
  const serveAction = SERVE_ACTIONS.has(ev.action);
  return (
    <div className="last-point card" aria-live="polite">
      <p className="last-title">
        <span className="muted">Punto {record.number}</span> {explainPoint(config, ev)}
      </p>
      {serveAction ? (
        <p className="muted small">Golpe: saque.</p>
      ) : (
        <>
          <p className="muted small">Golpe de {config.players[ev.actor]} (opcional):</p>
          <div className="chips">
            {SHOTS.map((s) => (
              <button
                key={s}
                className={`chip ${ev.shot === s ? 'on' : ''}`}
                aria-pressed={ev.shot === s}
                onClick={() => onShot(ev.shot === s ? null : s)}
              >
                {SHOT_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
