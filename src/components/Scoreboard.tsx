import { useState, type CSSProperties } from 'react';
import { formatMatchSummary, formatPoints, type MatchConfig, type PlayerIndex, type ScoreState } from '../engine';
import { ServeBall } from './ui';

type Tone = 'dark' | 'light' | 'set';

/**
 * Una placa del tablero. Cuando cambia su valor, solo esa placa hace el giro
 * (la cara nueva se monta con otra key); el valor ya está visible desde el
 * primer fotograma, así que la animación nunca demora la lectura ni los toques.
 */
function Plate({ value, tone, span = 1, won }: { value: string; tone: Tone; span?: number; won?: boolean }) {
  const [shown, setShown] = useState({ value, flip: false });
  if (shown.value !== value) setShown({ value, flip: true });
  const style: CSSProperties | undefined = span > 1 ? { gridColumn: `span ${span}` } : undefined;
  return (
    <span className={`plate plate-${tone}${won ? ' won' : ''}`} style={style} aria-hidden="true">
      <span key={value} className={`plate-face${shown.flip ? ' flip' : ''}`}>
        {value}
      </span>
    </span>
  );
}

/**
 * Puntos con una placa por carácter ("30" → 3 | 0). En un game, un valor de un
 * carácter ("0") ocupa todas las placas; en tie-breaks los números se alinean a
 * la derecha con placas en blanco, como un tablero de dígitos.
 */
function PointPlates({ value, slots, numeric }: { value: string; slots: number; numeric: boolean }) {
  const chars = [...value];
  if (chars.length === 1 && !numeric) return <Plate value={value} tone="light" span={slots} />;
  const padded = [...Array<string>(Math.max(0, slots - chars.length)).fill(''), ...chars];
  return (
    <>
      {padded.map((c, i) => (
        <Plate key={i} value={c} tone="light" />
      ))}
    </>
  );
}

function boardTitle(state: ScoreState, config: MatchConfig): string {
  const format = config.format === 'single' ? 'Un set' : 'Al mejor de 3';
  if (state.winner !== null) return `Partido terminado · ${format}`;
  if (state.phase === 'superTiebreak') return `Super tie-break · ${format}`;
  const set = `Set ${state.sets.length + 1}`;
  return state.phase === 'tiebreak' ? `${set} · Tie-break` : `${set} · ${format}`;
}

export function Scoreboard({ state, config }: { state: ScoreState; config: MatchConfig }) {
  const finished = state.winner !== null;
  const { values, note } = formatPoints(state, config);
  const showGames = !finished && state.phase !== 'superTiebreak';
  const showPoints = !finished;
  const pointsLabel = state.phase === 'tiebreak' ? 'Tie-break' : state.phase === 'superTiebreak' ? 'Super TB' : 'Puntos';
  const slots = Math.max(2, ...values.map((v) => [...v].length));

  const cols = [
    'minmax(0, 1fr)',
    ...state.sets.map(() => 'var(--set-w)'),
    ...(showGames ? ['var(--game-w)'] : []),
    ...(showPoints ? [`calc(${slots} * var(--pt-w) + ${slots - 1} * var(--pt-gap))`] : []),
  ].join(' ');
  const boardStyle = { '--sb-cols': cols, '--slots': slots } as CSSProperties;

  return (
    <section className={`scoreboard${finished ? ' finished' : ''}`} aria-label="Marcador" style={boardStyle}>
      <p className="sb-title">
        <span>{boardTitle(state, config)}</span>
      </p>

      <div className="sb-grid" role="table" aria-label="Marcador del partido">
        <div className="sb-row sb-head" role="row">
          <span role="columnheader" className="sb-h-player">
            Jugador
          </span>
          {state.sets.map((s, i) => (
            <span key={i} role="columnheader" className="sb-h-set">
              {s.superTiebreak ? 'STB' : `S${i + 1}`}
            </span>
          ))}
          {showGames && (
            <span role="columnheader" className="sb-h-games">
              Games
            </span>
          )}
          {showPoints && (
            <span role="columnheader" className="sb-h-points">
              {pointsLabel}
            </span>
          )}
        </div>

        {([0, 1] as PlayerIndex[]).map((p) => {
          const serving = !finished && state.server === p;
          return (
            <div
              key={p}
              role="row"
              className={`sb-row sb-player${state.winner === p ? ' winner' : ''}${serving ? ' serving' : ''}`}
            >
              <span role="rowheader" className="sb-name">
                <span className="sb-name-text">{config.players[p]}</span>
                {serving && (
                  <span className="sb-serve">
                    <ServeBall title="Saca" />
                  </span>
                )}
                {state.winner === p && <span className="trophy">Ganador</span>}
              </span>

              {state.sets.map((s, i) => {
                const v = String(s.superTiebreak ? s.tiebreak![p] : s.games[p]);
                const tb = s.tiebreak && !s.superTiebreak && s.winner !== p ? s.tiebreak[p] : null;
                return (
                  <span key={i} role="cell" className="sb-set" data-value={v}>
                    <span className="sr-only">
                      {v}
                      {tb !== null && ` (tie-break ${tb})`}
                    </span>
                    <span className={`plate plate-set${s.winner === p ? ' won' : ''}`} aria-hidden="true">
                      <span className="plate-face">
                        {v}
                        {tb !== null && <sup>{tb}</sup>}
                      </span>
                    </span>
                  </span>
                );
              })}

              {showGames && (
                <span role="cell" className="sb-games" data-value={state.games[p]}>
                  <span className="sr-only">{state.games[p]}</span>
                  <Plate value={String(state.games[p])} tone="dark" />
                </span>
              )}

              {showPoints && (
                <span role="cell" className="sb-points" data-value={values[p]}>
                  <span className="sr-only">{values[p]}</span>
                  <PointPlates value={values[p]} slots={slots} numeric={state.phase !== 'game'} />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="score-foot" aria-live="polite">
        {finished ? (
          <strong className="sb-result">
            Partido terminado · Ganó {config.players[state.winner!]}
            <span className="sb-result-sets"> · {formatMatchSummary(state)}</span>
          </strong>
        ) : (
          <>
            <span className="sb-serving">
              <ServeBall decorative />
              <span>
                Saca <strong>{config.players[state.server]}</strong>
              </span>
            </span>
            {note && <span className="note">{note}</span>}
          </>
        )}
      </div>
    </section>
  );
}
