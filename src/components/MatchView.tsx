import { useEffect, useMemo, useState } from 'react';
import { ACTION_LABELS, replay, undoLast, type PointEvent, type StoredMatch } from '../engine';
import { Scoreboard } from './Scoreboard';
import { RecordPanel } from './RecordPanel';
import { EditPointDialog, HistoryPanel } from './History';
import { StatsPanel } from './Stats';

type Tab = 'record' | 'history' | 'stats';

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}

export function MatchView({
  match,
  onEvents,
  onBack,
  onExport,
}: {
  match: StoredMatch;
  onEvents: (events: PointEvent[]) => void;
  onBack: () => void;
  onExport: () => void;
}) {
  const wide = useMediaQuery('(min-width: 960px)');
  const [tab, setTab] = useState<Tab>('record');
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { config, events } = match;
  const result = useMemo(() => replay(config, events), [config, events]);
  const { state, records } = result;
  const last = records.at(-1);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const undo = () => {
    if (!last) return;
    onEvents(undoLast(events));
    setNotice(`Se deshizo el punto ${last.number} (${ACTION_LABELS[last.event.action].toLowerCase()} de ${config.players[last.event.actor]}).`);
  };

  const sideTab: Tab = wide && tab === 'record' ? 'history' : tab;
  const tabs: { id: Tab; label: string }[] = wide
    ? [
        { id: 'history', label: `Historial (${records.length})` },
        { id: 'stats', label: 'Estadísticas' },
      ]
    : [
        { id: 'record', label: 'Registro' },
        { id: 'history', label: 'Historial' },
        { id: 'stats', label: 'Estadísticas' },
      ];

  const record = (
    <RecordPanel
      config={config}
      events={events}
      state={state}
      lastRecord={last}
      onEvents={(e) => {
        setNotice(null);
        onEvents(e);
      }}
    />
  );
  const side = (t: Tab) =>
    t === 'history' ? (
      <HistoryPanel records={records} config={config} onEdit={setEditing} />
    ) : t === 'stats' ? (
      <StatsPanel records={records} config={config} />
    ) : (
      record
    );

  return (
    <div className="page match">
      <header className="page-head">
        <button className="btn ghost" onClick={onBack}>
          ← Partidos
        </button>
        <h1 className="match-title">
          {config.players[0]} <span className="vs">vs</span> {config.players[1]}
        </h1>
        <button className="btn ghost" onClick={onExport}>
          Exportar
        </button>
      </header>

      {!result.ok && (
        <p className="alert error" role="alert">
          El historial tiene un problema: {result.error?.message}
        </p>
      )}

      <div className={wide ? 'match-layout' : ''}>
        <div className="main-col">
          <Scoreboard state={state} config={config} />
          {wide && record}
        </div>

        <div className="side-col">
          <nav className="tabs" role="tablist" aria-label="Secciones">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={sideTab === t.id}
                className={`tab ${sideTab === t.id ? 'on' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div role="tabpanel">{side(sideTab)}</div>
        </div>
      </div>

      <div className="bottom-bar">
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <div className="bottom-actions">
          <button className="btn" onClick={undo} disabled={!last}>
            ↶ Deshacer
          </button>
          <button className="btn" onClick={() => last && setEditing(last.number - 1)} disabled={!last}>
            ✎ Corregir último
          </button>
        </div>
      </div>

      {editing !== null && events[editing] && (
        <EditPointDialog
          key={editing}
          index={editing}
          events={events}
          records={records}
          config={config}
          onClose={() => setEditing(null)}
          onSave={(e) => {
            onEvents(e);
            setEditing(null);
            setNotice(`Punto ${editing + 1} corregido. Se recalculó el partido.`);
          }}
        />
      )}
    </div>
  );
}
