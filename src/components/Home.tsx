import { useRef, useState } from 'react';
import { formatMatchSummary, replay, type StoredMatch } from '../engine';
import { ConfirmDialog } from './ui';

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function Home({
  matches,
  onNew,
  onOpen,
  onDelete,
  onExport,
  onImport,
}: {
  matches: StoredMatch[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (m: StoredMatch) => void;
  onImport: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<StoredMatch | null>(null);

  return (
    <div className="page home">
      <header className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <h1>Punto a Punto</h1>
          <p className="muted">Registro de partidos de tenis singles</p>
        </div>
      </header>

      <button className="btn primary block big" onClick={onNew}>
        + Nuevo partido
      </button>

      <section aria-labelledby="saved-title">
        <div className="section-head">
          <h2 id="saved-title">Partidos guardados</h2>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            Importar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-input"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onImport(await f.text());
            }}
          />
        </div>

        {matches.length === 0 ? (
          <p className="empty">Todavía no hay partidos. Creá uno o importá un archivo exportado.</p>
        ) : (
          <ul className="match-list">
            {matches.map((m) => {
              const r = replay(m.config, m.events);
              const st = r.state;
              const done = st.winner !== null;
              const summary = formatMatchSummary(st);
              return (
                <li key={m.id} className="card match-item">
                  <button className="match-main" onClick={() => onOpen(m.id)}>
                    <span className="match-names">
                      {m.config.players[0]} <span className="vs">vs</span> {m.config.players[1]}
                    </span>
                    <span className="match-meta">
                      <span className={`tag ${done ? 'done' : 'live'}`}>{done ? 'Finalizado' : 'En curso'}</span>
                      {summary && <span className="mono">{summary}</span>}
                      {!done && (
                        <span className="mono">
                          {st.phase === 'superTiebreak' ? 'STB' : `${st.games[0]}–${st.games[1]}`}
                        </span>
                      )}
                    </span>
                    <span className="muted small">
                      {m.events.length} puntos · {dateFmt.format(new Date(m.updatedAt))}
                      {done && ` · Ganó ${m.config.players[st.winner!]}`}
                    </span>
                  </button>
                  <div className="match-actions">
                    <button className="btn" onClick={() => onOpen(m.id)}>
                      {done ? 'Ver' : 'Retomar'}
                    </button>
                    <button className="btn ghost" onClick={() => onExport(m)}>
                      Exportar
                    </button>
                    <button className="btn ghost danger-text" onClick={() => setToDelete(m)}>
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Eliminar partido"
          danger
          confirmLabel="Eliminar"
          message={
            <>
              ¿Eliminar {toDelete.config.players[0]} vs {toDelete.config.players[1]} ({toDelete.events.length}{' '}
              puntos)? No se puede deshacer. Si querés conservarlo, exportalo antes.
            </>
          }
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            onDelete(toDelete.id);
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
