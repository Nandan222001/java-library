import { useEffect, useState } from 'react';
import { api } from '../lib/supabase.js';

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/gamification/leaderboard').then(setRows).catch(e => setErr(e.message));
  }, []);

  if (err) return <div className="container"><div className="errbox">{err}</div></div>;
  if (!rows) return <div className="container loading-block"><div className="spin"/><span>Loading leaderboard…</span></div>;

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1>Leaderboard 🏆</h1>
      <p className="muted" style={{ marginTop: -6 }}>Top readers by points earned in practice quizzes.</p>
      {rows.length === 0
        ? <div className="infobox">No one's on the board yet — be the first to take a practice quiz!</div>
        : <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map(row => (
              <div key={row.rank} className="leaderboard-row">
                <span className="leaderboard-rank">#{row.rank}</span>
                <span className="leaderboard-name">{row.display_name}</span>
                {row.current_streak > 0 && <span className="chip free">🔥 {row.current_streak}d</span>}
                <span className="leaderboard-points">{row.points} pts</span>
              </div>
            ))}
          </div>}
    </div>
  );
}
