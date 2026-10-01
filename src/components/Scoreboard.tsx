import { formatPoints, type MatchConfig, type PlayerIndex, type ScoreState } from '../engine';
import { ServeBall } from './ui';

export function Scoreboard({ state, config }: { state: ScoreState; config: MatchConfig }) {
  const finished = state.winner !== null;
  const { values, note } = formatPoints(state, config);
  const liveLabel = state.phase === 'superTiebreak' ? 'STB' : 'Games';
  const pointsLabel = state.phase === 'game' ? 'Puntos' : state.phase === 'tiebreak' ? 'TB' : 'Puntos';

  return (
    <section className="scoreboard" aria-label="Marcador">
      <table>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Jugador
            </th>
            {state.sets.map((s, i) => (
              <th key={i} scope="col" className="col-set">
                {s.superTiebreak ? 'STB' : `S${i + 1}`}
              </th>
            ))}
            {!finished && (
              <>
                {state.phase !== 'superTiebreak' && (
                  <th scope="col" className="col-games">
                    {liveLabel}
                  </th>
                )}
                <th scope="col" className="col-points">
                  {pointsLabel}
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {([0, 1] as PlayerIndex[]).map((p) => (
            <tr key={p} className={`${state.winner === p ? 'winner' : ''} ${!finished && state.server === p ? 'serving' : ''}`}>
              <th scope="row" className="player">
                <span className="serve-slot">{!finished && state.server === p && <ServeBall />}</span>
                <span className="player-name">{config.players[p]}</span>
                {state.winner === p && <span className="trophy">Ganador</span>}
              </th>
              {state.sets.map((s, i) => (
                <td key={i} className={`col-set ${s.winner === p ? 'set-won' : ''}`}>
                  {s.superTiebreak ? s.tiebreak![p] : s.games[p]}
                  {s.tiebreak && !s.superTiebreak && s.winner !== p && <sup>{s.tiebreak[p]}</sup>}
                </td>
              ))}
              {!finished && (
                <>
                  {state.phase !== 'superTiebreak' && <td className="col-games">{state.games[p]}</td>}
                  <td className="col-points">{values[p]}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="score-foot" aria-live="polite">
        {finished ? (
          <strong>Partido terminado · Ganó {config.players[state.winner!]}</strong>
        ) : (
          <>
            <span>
              Saca <strong>{config.players[state.server]}</strong>
            </span>
            {note && <span className="note">{note}</span>}
          </>
        )}
      </div>
    </section>
  );
}
