import { useState, type FormEvent } from 'react';
import type { DecidingSet, GameScoring, MatchConfig, PlayerIndex, SetFormat } from '../engine';
import { Segmented } from './ui';

export function Setup({ onCreate, onCancel }: { onCreate: (c: MatchConfig) => void; onCancel: () => void }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [format, setFormat] = useState<SetFormat>('bestOf3');
  const [firstServer, setFirstServer] = useState<PlayerIndex>(0);
  const [gameScoring, setGameScoring] = useState<GameScoring>('advantage');
  const [decidingSet, setDecidingSet] = useState<DecidingSet>('fullSet');
  const [touched, setTouched] = useState(false);

  const n1 = p1.trim();
  const n2 = p2.trim();
  const errors: string[] = [];
  if (!n1 || !n2) errors.push('Completá los dos nombres.');
  else if (n1.toLocaleLowerCase() === n2.toLocaleLowerCase()) errors.push('Usá nombres distintos para cada jugador.');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (errors.length) return;
    onCreate({ players: [n1, n2], format, firstServer, gameScoring, decidingSet });
  };

  return (
    <form className="page setup" onSubmit={submit} noValidate>
      <header className="page-head">
        <button type="button" className="btn ghost" onClick={onCancel}>
          ← Volver
        </button>
        <h1>Nuevo partido</h1>
      </header>

      <div className="card">
        <label className="field">
          <span className="field-label">Jugador 1</span>
          <input
            className="input"
            value={p1}
            maxLength={40}
            autoComplete="off"
            placeholder="Nombre"
            onChange={(e) => setP1(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Jugador 2</span>
          <input
            className="input"
            value={p2}
            maxLength={40}
            autoComplete="off"
            placeholder="Nombre"
            onChange={(e) => setP2(e.target.value)}
          />
        </label>

        <Segmented<PlayerIndex>
          name="server"
          label="Primer sacador"
          value={firstServer}
          onChange={setFirstServer}
          options={[
            { value: 0, label: n1 || 'Jugador 1' },
            { value: 1, label: n2 || 'Jugador 2' },
          ]}
        />
      </div>

      <div className="card">
        <Segmented<SetFormat>
          name="format"
          label="Sets"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'single', label: 'Un set' },
            { value: 'bestOf3', label: 'Al mejor de 3' },
          ]}
        />
        {format === 'bestOf3' && (
          <Segmented<DecidingSet>
            name="deciding"
            label="Si quedan 1–1 en sets"
            value={decidingSet}
            onChange={setDecidingSet}
            options={[
              { value: 'fullSet', label: 'Tercer set', hint: 'Normal, tie-break en 6–6' },
              { value: 'superTiebreak', label: 'Super tie-break', hint: 'A 10, diferencia de 2' },
            ]}
          />
        )}
        <Segmented<GameScoring>
          name="scoring"
          label="Games"
          value={gameScoring}
          onChange={setGameScoring}
          options={[
            { value: 'advantage', label: 'Con ventaja' },
            { value: 'goldenPoint', label: 'Punto de oro', hint: 'En 40–40 define un punto' },
          ]}
        />
        <p className="muted small">Sets con tie-break a 7 en 6–6, con diferencia de dos.</p>
      </div>

      {touched && errors.length > 0 && (
        <p className="alert error" role="alert">
          {errors[0]}
        </p>
      )}
      <button type="submit" className="btn primary block big">
        Empezar partido
      </button>
    </form>
  );
}
