import {
  computeStats,
  pct,
  shotsWithData,
  SHOT_LABELS,
  type MatchConfig,
  type PlayerStats,
  type PointRecord,
} from '../engine';

type Row = { label: string; get: (p: PlayerStats) => string; sub?: boolean };

const ratio = (won: number, played: number) => (played === 0 ? '—' : `${won}/${played} (${pct(won, played)}%)`);

const ROWS: Row[] = [
  { label: 'Puntos ganados', get: (p) => `${p.pointsWon} (${p.pointsWonPct}%)` },
  { label: 'Winners + aces', get: (p) => String(p.winners + p.aces) },
  { label: 'Golpes ganadores', get: (p) => String(p.winners), sub: true },
  { label: 'Aces', get: (p) => String(p.aces), sub: true },
  { label: 'Errores no forzados', get: (p) => String(p.unforcedErrors) },
  { label: 'Errores forzados', get: (p) => String(p.forcedErrors) },
  { label: 'Errores sin clasificar', get: (p) => String(p.unclassifiedErrors) },
  { label: 'Dobles faltas', get: (p) => String(p.doubleFaults) },
  { label: 'Puntos ganados sin detalle', get: (p) => String(p.undetailedWon) },
  { label: 'Ganados al saque', get: (p) => ratio(p.servePointsWon, p.servePointsPlayed) },
  { label: 'Ganados a la devolución', get: (p) => ratio(p.returnPointsWon, p.returnPointsPlayed) },
];

export function StatsPanel({ records, config }: { records: PointRecord[]; config: MatchConfig }) {
  if (records.length === 0) return <p className="empty">Las estadísticas aparecen al cargar puntos.</p>;
  const stats = computeStats(records);
  const shots = shotsWithData(stats);
  const [a, b] = config.players;

  return (
    <div className="stats">
      <div className="card">
        <table className="stats-table">
          <caption>{stats.totalPoints} puntos jugados</caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{a}</th>
              <th scope="col">{b}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className={r.sub ? 'sub' : ''}>
                <th scope="row">{r.label}</th>
                <td>{r.get(stats.players[0])}</td>
                <td>{r.get(stats.players[1])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Por golpe</h3>
        {shots.length === 0 ? (
          <p className="muted small">Todavía no se cargó el tipo de golpe en ningún punto.</p>
        ) : (
          ([0, 1] as const).map((pi) => {
            const p = stats.players[pi];
            const rows = shots.filter((s) => p.byShot[s]);
            if (!rows.length) return null;
            return (
              <table key={pi} className="stats-table shots">
                <caption>{config.players[pi]}</caption>
                <thead>
                  <tr>
                    <th scope="col">Golpe</th>
                    <th scope="col" title="Golpes ganadores">Gan.</th>
                    <th scope="col" title="Errores no forzados">ENF</th>
                    <th scope="col" title="Errores forzados">EF</th>
                    <th scope="col" title="Errores sin clasificar">Err.</th>
                    <th scope="col" title="Punto ganado sin detalle">S/D</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const c = p.byShot[s]!;
                    return (
                      <tr key={s}>
                        <th scope="row">{SHOT_LABELS[s]}</th>
                        <td>{c.winner ?? 0}</td>
                        <td>{c.unforced ?? 0}</td>
                        <td>{c.forced ?? 0}</td>
                        <td>{c.error ?? 0}</td>
                        <td>{c.won ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })
        )}
        <p className="muted small">
          Gan. = golpes ganadores · ENF = errores no forzados · EF = errores forzados · Err. = errores sin
          clasificar · S/D = puntos ganados sin detalle. Solo cuenta puntos con golpe cargado.
        </p>
      </div>

      <p className="muted small">
        Esta versión no registra primer saque, duración del peloteo ni ubicación de los golpes, por eso no hay
        estadísticas de eso.
      </p>
    </div>
  );
}
