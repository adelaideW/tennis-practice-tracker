/* global React, CALENDAR_2026, SEED_NEWS */
const { useState: useS3, useEffect: useE3 } = React;

function Calendar() {
  const [news, setNews] = useS3(SEED_NEWS);
  const [loading, setLoading] = useS3(false);
  const [results] = useS3([
    { tour: 'ATP', event: 'Rome Open — Final', winner: 'Champion', loser: 'Finalist', score: '6—4, 7—6' },
    { tour: 'WTA', event: 'Rome Open — Final', winner: 'Champion', loser: 'Finalist', score: '7—5, 6—3' },
    { tour: 'ATP', event: 'Rome — Semifinal', winner: 'Semifinalist A', loser: 'Semifinalist B', score: '6—3, 6—4' },
    { tour: 'ATP', event: 'Rome — Semifinal', winner: 'Semifinalist C', loser: 'Semifinalist D', score: '7—6, 4—6, 6—3' },
  ]);

  const refreshNews = async () => {
    setLoading(true);
    try {
      const prompt = `You are a tennis news editor. Generate 5 short, plausible-sounding recent tennis news headlines for an amateur player's feed, dated within the last 10 days. Cover: tour results, draw news, scheduling, player notes. Be specific and journalistic but do NOT fabricate specific player names or exact match scores. Use phrases like "the world No. 1," "the Italian Open champion," "qualifying finalist," etc.

Return ONLY a JSON array (no markdown), each item with fields: when (e.g. "May 17"), t (headline, under 14 words), d (one-sentence detail).`;
      const res = await window.claude.complete(prompt);
      const cleaned = res.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) setNews(parsed);
    } catch (e) {
      // Keep seed; just shake order to feel like a refresh
      setNews(n => [...n].reverse());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="kicker">2026 Season</div>
          <h1>Calendar &amp; <em>news.</em></h1>
        </div>
        <div className="meta">
          Grand Slams · Masters 1000<br/>
          ATP Finals · Tour finals
        </div>
      </div>

      <div className="cal-grid">
        <div>
          <h3 className="section-title">Tour Schedule</h3>
          <div className="card">
            {CALENDAR_2026.map((t, i) => (
              <div key={i} className="tourney">
                <div className="date">
                  <div className="m">{t.m}</div>
                  <div className="d">{t.d.split('—')[0].trim()}</div>
                </div>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="meta">{t.meta} · {t.d}</div>
                </div>
                <span className={`pill ${t.state}`}>
                  {t.state === 'live' && '● Live now'}
                  {t.state === 'up' && 'Upcoming'}
                  {t.state === 'done' && '✓ Done'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="section-title">Rome Open · Results</h3>
          <div className="result-card mb-20">
            <div className="head">
              <h3>Italian Open '26</h3>
              <span className="mono-small">Foro Italico · Clay</span>
            </div>
            {results.map((r, i) => (
              <div key={i} className="result-row">
                <div>
                  <div className="who">{r.winner} <span style={{color:'#6E756F'}}>def.</span> {r.loser}</div>
                  <div className="who"><span className="sub">{r.tour} · {r.event}</span></div>
                </div>
                <div className="score">{r.score}</div>
              </div>
            ))}
          </div>

          <div className="row between mb-12">
            <h3 className="section-title" style={{margin:0}}>Latest News</h3>
            <button className="btn-secondary" onClick={refreshNews} disabled={loading} style={{padding:'6px 12px', fontSize:11}}>
              {loading ? <><span className="spinner"></span>Fetching…</> : '↻ Refresh feed'}
            </button>
          </div>
          <div className="card">
            {news.map((n, i) => (
              <div key={i} className="news-item">
                <div className="when">{n.when}</div>
                <div className="t">{n.t}</div>
                <div className="d">{n.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Calendar = Calendar;
