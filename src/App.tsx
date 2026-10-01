import { useCallback, useState } from 'react';
import { exportMatch, newId, parseMatchFile, type MatchConfig, type PointEvent, type StoredMatch } from './engine';
import { deleteMatch, lastOpen, loadMatches, rememberLastOpen, saveMatch } from './storage/matches';
import { Home } from './components/Home';
import { Setup } from './components/Setup';
import { MatchView } from './components/MatchView';

type View = { screen: 'home' } | { screen: 'setup' } | { screen: 'match'; id: string };

function download(match: StoredMatch) {
  const blob = new Blob([exportMatch(match)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = `${match.config.players[0]}-vs-${match.config.players[1]}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `punto-a-punto_${slug}_${match.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const initial = loadMatches();

export default function App() {
  const [matches, setMatches] = useState<StoredMatch[]>(initial.matches);
  const [problems, setProblems] = useState<string[]>(initial.problems);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => {
    const id = lastOpen();
    return id && initial.matches.some((m) => m.id === id) ? { screen: 'match', id } : { screen: 'home' };
  });

  const go = useCallback((v: View) => {
    setView(v);
    rememberLastOpen(v.screen === 'match' ? v.id : null);
    window.scrollTo(0, 0);
  }, []);

  const persist = (m: StoredMatch) => {
    const res = saveMatch(m);
    setSaveError(res.ok ? null : res.error);
  };

  const create = (config: MatchConfig) => {
    const now = new Date().toISOString();
    const m: StoredMatch = { id: newId(), createdAt: now, updatedAt: now, config, events: [] };
    setMatches((ms) => [m, ...ms]);
    persist(m);
    go({ screen: 'match', id: m.id });
  };

  const updateEvents = (id: string, events: PointEvent[]) => {
    const m = matches.find((x) => x.id === id);
    if (!m) return;
    const next = { ...m, events, updatedAt: new Date().toISOString() };
    setMatches((ms) => ms.map((x) => (x.id === id ? next : x)));
    persist(next);
  };

  const importText = (text: string) => {
    const res = parseMatchFile(text);
    if (!res.ok) {
      setFlash(`No se importó: ${res.error}`);
      return;
    }
    let m = res.match;
    let note = '';
    if (matches.some((x) => x.id === m.id)) {
      m = { ...m, id: newId() };
      note = ' Ya existía un partido con ese identificador: se importó como copia.';
    }
    setMatches((ms) => [m, ...ms]);
    persist(m);
    setFlash(`Partido importado: ${m.config.players[0]} vs ${m.config.players[1]} (${m.events.length} puntos).${note}`);
  };

  const current = view.screen === 'match' ? matches.find((m) => m.id === view.id) : undefined;

  return (
    <div className="app">
      {(saveError || problems.length > 0) && (
        <div className="storage-alert" role="alert">
          {saveError && <p>⚠ {saveError}</p>}
          {problems.map((p) => (
            <p key={p}>⚠ {p}</p>
          ))}
          {problems.length > 0 && (
            <button className="btn small-btn" onClick={() => setProblems([])}>
              Entendido
            </button>
          )}
        </div>
      )}

      {view.screen === 'setup' && <Setup onCreate={create} onCancel={() => go({ screen: 'home' })} />}

      {view.screen === 'match' && current && (
        <MatchView
          key={current.id}
          match={current}
          onEvents={(e) => updateEvents(current.id, e)}
          onBack={() => go({ screen: 'home' })}
          onExport={() => download(current)}
        />
      )}

      {(view.screen === 'home' || (view.screen === 'match' && !current)) && (
        <>
          {flash && (
            <p className="alert info flash" role="status">
              {flash}{' '}
              <button className="link" onClick={() => setFlash(null)}>
                Cerrar
              </button>
            </p>
          )}
          <Home
            matches={matches}
            onNew={() => go({ screen: 'setup' })}
            onOpen={(id) => go({ screen: 'match', id })}
            onExport={download}
            onImport={importText}
            onDelete={(id) => {
              const res = deleteMatch(id);
              if (!res.ok) {
                setSaveError(res.error);
                return;
              }
              setMatches((ms) => ms.filter((m) => m.id !== id));
            }}
          />
        </>
      )}
    </div>
  );
}
