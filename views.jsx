/* global React, PRACTICE_TAGS, INTENSITY, TIPS, CALENDAR_2026, SEED_NEWS */
const { useState: useS1, useMemo: useM1, useEffect: useE1, useRef: useR1 } = React;

// ============== TODAY / DASHBOARD ==============

function DonutChart({ value, max, centerLabel }) {
  const r = 42, cx = 56, cy = 56;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = pct * circ;
  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10"/>
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="var(--accent)" strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{transition:'stroke-dasharray 0.6s ease'}}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
        fill="var(--ink)" fontSize="22" fontWeight="700" fontFamily="var(--sans)"
      >{value}</text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        fill="var(--ink-3)" fontSize="8" fontFamily="var(--mono)" letterSpacing="1.2"
      >{centerLabel.toUpperCase()}</text>
    </svg>
  );
}

function ActivityChart({ entries }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const mins = entries.filter(e => e.date.slice(0, 10) === iso).reduce((a, e) => a + (e.duration || 60), 0);
    days.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), mins });
  }
  const maxMins = Math.max(...days.map(d => d.mins), 60);
  const W = 260, H = 72, padX = 12, padY = 8;
  const pts = days.map((d, i) => {
    const x = padX + (i / 6) * (W - 2 * padX);
    const y = H - padY - (d.mins / maxMins) * (H - 2 * padY);
    return { x, y, mins: d.mins, label: d.label };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H} ` + polyline + ` ${pts[pts.length - 1].x},${H}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{overflow:'visible', display:'block'}}>
      <defs>
        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#actGrad)"/>
      <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <g key={i}>
          {p.mins > 0 && <circle cx={p.x} cy={p.y} r={3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5"/>}
          <text x={p.x} y={H + 16} textAnchor="middle" fill="var(--ink-3)" fontSize="8" fontFamily="var(--mono)" letterSpacing="0.6">{p.label.toUpperCase()}</text>
        </g>
      ))}
    </svg>
  );
}

function Today({ state, setRoute, syncFromNotion }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const totalSessions = state.entries.length;
  const totalMinutes = state.entries.reduce((a, e) => a + (e.duration || 60), 0);
  const totalHours = parseFloat((totalMinutes / 60).toFixed(1));

  const streak = useM1(() => {
    const days = new Set(state.entries.map(e => e.date.slice(0, 10)));
    if (!days.size) return 0;
    let s = 0;
    const probe = new Date();
    while (days.has(probe.toISOString().slice(0, 10))) {
      s++;
      probe.setDate(probe.getDate() - 1);
    }
    return s;
  }, [state.entries]);

  const topSkills = useM1(() => {
    const counts = {};
    state.entries.forEach((e) => (e.tags || []).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const max = sorted[0]?.[1] || 1;
    const COLORS = ['var(--accent)', 'var(--teal)', '#e87d32', '#c87de8'];
    return sorted.map(([k, count], i) => ({
      label: (PRACTICE_TAGS.find((p) => p.k === k) || {}).l || k,
      pct: Math.round((count / max) * 100),
      color: COLORS[i],
    }));
  }, [state.entries]);

  const recentSessions = state.entries.slice(0, 3);
  const focus = state.focus;
  const notionPage = window.NOTION_INSIGHTS_PAGE;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">{todayStr}</div>
          <h1>Good day for <em>tennis.</em></h1>
        </div>
        <div className="meta">
          {state.notionLoading ? (
            <>Syncing from Notion…</>
          ) : (
            <>
              {streak > 0 ? `${streak}-day streak` : 'Play today to extend streak'}<br />
              {totalSessions} sessions from Notion
            </>
          )}
        </div>
      </div>

      <div className="dash-grid mb-28">

        {/* Overview card */}
        <div className="overview-card">
          <div className="overview-card-title">
            Practice Overview
            <span className="overview-week-badge">From Notion</span>
          </div>
          <div className="overview-body">
            <div className="overview-sessions">
              <div className="big-num">{totalSessions}</div>
              <div className="big-label">Sessions tracked</div>
              <div className="big-delta">{streak > 0 ? `↑ ${streak}-day streak` : 'Start a streak today'}</div>
            </div>
            <div className="overview-donut">
              <DonutChart value={totalHours} max={Math.max(totalHours, 20)} centerLabel="hrs" />
            </div>
          </div>
        </div>

        {/* Top skills card */}
        <div className="skills-card">
          <div className="skills-card-title">Top Skills Practiced</div>
          {topSkills.length === 0 ? (
            <div style={{color:'var(--ink-3)',fontStyle:'italic',fontSize:13}}>Add daily reflections in Notion to populate skills.</div>
          ) : (
            topSkills.map((s, i) => (
              <div key={i} className="skill-row">
                <div className="skill-left">
                  <div className="skill-dot" style={{background: s.color}}></div>
                  <div className="skill-name">{s.label}</div>
                </div>
                <div className="skill-bar-wrap">
                  <div className="skill-bar" style={{width: s.pct + '%', background: s.color}}></div>
                </div>
                <div className="skill-pct">{s.pct}%</div>
              </div>
            ))
          )}
        </div>

        {/* Activity chart card */}
        <div className="activity-card">
          <div className="activity-card-title">7-Day Activity</div>
          <ActivityChart entries={state.entries} />
        </div>

        {/* Recent sessions card */}
        <div className="recent-card">
          <div className="recent-card-title">Recent Sessions</div>
          {recentSessions.length === 0 ? (
            <div style={{color:'var(--ink-3)',fontStyle:'italic',fontSize:13}}>
              {state.notionLoading ? 'Loading sessions from Notion…' : 'No daily reflections found in Notion yet.'}
            </div>
          ) : (
            recentSessions.map((e, i) => (
              <div key={e.id} className="recent-row">
                <div className="recent-dot">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                  </svg>
                </div>
                <div className="recent-info">
                  <div className="recent-date">{new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  <div className="recent-tags">
                    {e.context || (e.tags || []).slice(0, 3).map(k => (PRACTICE_TAGS.find(p => p.k === k) || {}).l).filter(Boolean).join(' · ') || 'Practice session'}
                  </div>
                </div>
                <div className="recent-dur">{e.duration || 60}m</div>
              </div>
            ))
          )}
          {notionPage && (
            <a
              href={notionPage}
              target="_blank"
              rel="noopener noreferrer"
              style={{marginTop:12,display:'inline-block',color:'var(--accent)',fontSize:12,fontFamily:'var(--mono)',letterSpacing:'0.1em',textTransform:'uppercase',textDecoration:'none'}}
            >
              Open Notion journal ↗
            </a>
          )}
        </div>
      </div>

      {/* AI Focus Brief */}
      <div className="focus-card mb-28">
        <div className="ball-deco" aria-hidden="true"></div>
        <div className="kicker">Today&apos;s Focus · From Notion</div>
        <h2>
          {state.notionLoading
            ? 'Syncing your brief…'
            : `"${focus?.headline || focus?.cues?.[0] || 'Stay loose and present'}"`}
        </h2>
        <div className="focus-body">
          {state.notionError ? (
            <div>{state.notionError}</div>
          ) : focus ? (
            <>
              <div>{focus.body}</div>
              {focus.cues?.length > 0 && (
                <ul>{focus.cues.slice(0, 4).map((c, i) => <li key={i}>{c}</li>)}</ul>
              )}
            </>
          ) : (
            <div>Your focus brief loads from weekly priorities and the latest daily reflection in Notion.</div>
          )}
        </div>
        <div className="focus-cta">
          <button className="btn-primary" onClick={syncFromNotion} disabled={state.notionLoading}>
            {state.notionLoading && <span className="spinner"></span>}
            {state.notionLoading ? 'Syncing…' : 'Refresh from Notion'}
          </button>
          {notionPage && (
            <a className="btn-ghost notion-open" href={notionPage} target="_blank" rel="noopener noreferrer">
              Open Notion page ↗
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ============== TIPS ==============
function Tips() {
  const [cat, setCat] = useS1('groundstrokes');
  const order = ['groundstrokes', 'serve', 'volley', 'overhead', 'mental'];
  const data = TIPS[cat];
  const tipCount = order.reduce((n, k) => n + (TIPS[k]?.items?.length || 0), 0);
  const notionPage = window.NOTION_INSIGHTS_PAGE;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Practice Library · {tipCount} tips · from Notion</div>
          <h1>Sharpen <em>the craft.</em></h1>
        </div>
        <div className="meta">
          {notionPage ? (
            <a href={notionPage} target="_blank" rel="noopener noreferrer" className="notion-link">
              Tennis practice insights ↗
            </a>
          ) : (
            <>Updated for<br />2026 season</>
          )}
        </div>
      </div>

      <div className="tip-tabs">
        {order.map(k => (
          <button
            key={k}
            className={`tip-tab ${cat === k ? 'active' : ''}`}
            onClick={() => setCat(k)}
          >
            {TIPS[k].title}
            <span className="ct">{String(TIPS[k].items.length).padStart(2, '0')}</span>
          </button>
        ))}
      </div>

      <div className="tip-hero">
        <div>
          <div className="mono-small mb-12">Category · {data.title}</div>
          <h2><em>{data.title.split(' ')[0]}</em> {data.title.split(' ').slice(1).join(' ')}</h2>
          <p className="muted">{data.blurb}</p>
        </div>
        <div className="pic">{data.title} · Visual coming</div>
      </div>

      <div className="tip-grid">
        {data.items.map((tip, i) => (
          <div key={i} className={`tip-card ${tip.priority ? 'priority' : ''}`}>
            <div className="num">
              No. {String(i + 1).padStart(2, '0')}
              {tip.priority && <span className="priority-pill">Notion focus</span>}
            </div>
            <h4>{tip.h}</h4>
            <p>{tip.p}</p>
            <div className="drill"><b>Drill:</b> {tip.drill}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ============== CALENDAR & NEWS ==============

const TOURNEY_URLS = {
  'Australian Open':        'https://ausopen.com',
  'Dubai / Acapulco / Santiago': 'https://www.dubaidutyfreetennischampionships.com',
  'Indian Wells Masters':   'https://bnpparibasopen.com',
  'Miami Open':             'https://miamiopen.com',
  'Monte-Carlo Masters':    'https://www.montecarlomasters.mc',
  'Madrid Open':            'https://www.mutuamadridopen.com',
  'Italian Open · Rome':    'https://www.internazionalibnlditalia.it',
  'Roland-Garros':          'https://www.rolandgarros.com',
  "Queen's Club / Halle":   'https://www.queensclub.co.uk',
  'Wimbledon':              'https://www.wimbledon.com',
  'Canadian Open · Toronto':'https://rogerscup.com',
  'Cincinnati Open':        'https://www.wsopen.com',
  'US Open':                'https://www.usopen.org',
  'ATP Finals · Turin':     'https://www.nittoatpfinals.com',
};

const TOURNEY_YOUTUBE = {
  'Australian Open':      'https://www.youtube.com/results?search_query=Australian+Open+2026+final+highlights',
  'Indian Wells Masters': 'https://www.youtube.com/results?search_query=BNP+Paribas+Open+Indian+Wells+2026+final+highlights',
  'Miami Open':           'https://www.youtube.com/results?search_query=Miami+Open+2026+final+highlights',
  'Monte-Carlo Masters':  'https://www.youtube.com/results?search_query=Monte+Carlo+Masters+2026+final+highlights',
  'Madrid Open':          'https://www.youtube.com/results?search_query=Mutua+Madrid+Open+2026+final+highlights',
  'Italian Open · Rome':  'https://www.youtube.com/results?search_query=Internazionali+BNL+Italia+2026+final+highlights',
};

const ROME_2026 = {
  men: {
    qf: [
      { w: 'A. Zverev',  wSub: 'GER',  l: 'C. Alcaraz',         lSub: 'ESP', score: '6—3  7—5' },
      { w: 'J. Sinner',  wSub: 'ITA',  l: 'H. Hurkacz',         lSub: 'POL', score: '7—6(4)  6—4' },
      { w: 'C. Ruud',    wSub: 'NOR',  l: 'A. de Minaur',       lSub: 'AUS', score: '6—4  6—2' },
      { w: 'T. Paul',    wSub: 'USA',  l: 'F. Auger-Aliassime', lSub: 'CAN', score: '6—7(3)  7—5  6—3' },
    ],
    sf: [
      { w: 'A. Zverev', wSub: 'GER', l: 'C. Ruud',    lSub: 'NOR', score: '6—4  6—3' },
      { w: 'J. Sinner', wSub: 'ITA', l: 'T. Paul',    lSub: 'USA', score: '6—3  6—4' },
    ],
    final: { w: 'A. Zverev', wSub: 'GER · #4 seed', l: 'J. Sinner', lSub: 'ITA · #1 seed', score: '6—3  4—6  6—2' },
    youtube: 'https://www.youtube.com/results?search_query=Internazionali+BNL+Italia+2026+men+final+Zverev+Sinner+highlights',
  },
  women: {
    sf: [
      { w: 'I. Świątek',   wSub: 'POL', l: 'C. Gauff',     lSub: 'USA', score: '6—3  6—1' },
      { w: 'A. Sabalenka', wSub: 'BLR', l: 'M. Keys',      lSub: 'USA', score: '7—5  6—4' },
    ],
    final: { w: 'I. Świątek', wSub: 'POL · #1 seed', l: 'A. Sabalenka', lSub: 'BLR · #2 seed', score: '6—2  6—3' },
    youtube: 'https://www.youtube.com/results?search_query=Internazionali+BNL+Italia+2026+women+final+Swiatek+highlights',
  },
};

function RomeModal({ onClose }) {
  useE1(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const MatchRow = ({ round, w, wSub, l, lSub, score }) => (
    <div className="match-row">
      <div className="match-round-badge">{round}</div>
      <div className={`match-player winner`}>{w}<br/><span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>{wSub}</span></div>
      <div className="match-score">{score}</div>
      <div className={`match-player loser`}>{l}<br/><span style={{fontFamily:'var(--mono)',fontSize:'9px',color:'var(--ink-3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>{lSub}</span></div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="deco" aria-hidden="true"></div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          <div className="kicker">Masters 1000 · Concluded</div>
          <h2>Italian Open · Rome 2026</h2>
          <div className="modal-meta">May 6–17 · Foro Italico, Rome · Clay · Prize $7,250,000</div>
        </div>

        <div className="modal-body">

          {/* Men's draw */}
          <div className="modal-section">
            <div className="modal-section-title">Men's Singles · Champion</div>
            <div className="final-box">
              <div className="final-finalist champion">
                <div className="f-name">A. Zverev</div>
                <div className="f-sub">GER · #4 seed</div>
                <div style={{marginTop:8}}><span className="trophy-pill">🏆 Champion</span></div>
              </div>
              <div className="final-vs">
                <div className="final-score-sets">6—3  4—6  6—2</div>
                <div className="final-score-label">Final</div>
              </div>
              <div className="final-finalist">
                <div className="f-name" style={{color:'var(--ink-3)'}}>J. Sinner</div>
                <div className="f-sub">ITA · #1 seed</div>
              </div>
            </div>

            <div className="modal-section-title" style={{marginTop:16}}>Men's Draw Results</div>
            {ROME_2026.men.sf.map((m, i) => <MatchRow key={i} round="SF" {...m} />)}
            {ROME_2026.men.qf.map((m, i) => <MatchRow key={i} round="QF" {...m} />)}

            <div className="yt-row" style={{marginTop:14}}>
              <a className="yt-btn" href={ROME_2026.men.youtube} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-2.75 12.42 12.42 0 00-5.64-1.28A11.67 11.67 0 002 14.07a11.67 11.67 0 0011.86 7.27 4.76 4.76 0 003.77-2.68 12.54 12.54 0 004.37-5.86 4.76 4.76 0 00-2.41-6.11zM10 15V9l5 3-5 3z"/></svg>
                Men's Final Highlights
              </a>
            </div>
          </div>

          {/* Women's draw */}
          <div className="modal-section">
            <div className="modal-section-title">Women's Singles · Champion</div>
            <div className="final-box">
              <div className="final-finalist champion">
                <div className="f-name">I. Świątek</div>
                <div className="f-sub">POL · #1 seed</div>
                <div style={{marginTop:8}}><span className="trophy-pill">🏆 Champion</span></div>
              </div>
              <div className="final-vs">
                <div className="final-score-sets">6—2  6—3</div>
                <div className="final-score-label">Final</div>
              </div>
              <div className="final-finalist">
                <div className="f-name" style={{color:'var(--ink-3)'}}>A. Sabalenka</div>
                <div className="f-sub">BLR · #2 seed</div>
              </div>
            </div>

            <div className="modal-section-title" style={{marginTop:16}}>Women's Draw Results</div>
            {ROME_2026.women.sf.map((m, i) => <MatchRow key={i} round="SF" {...m} />)}

            <div className="yt-row" style={{marginTop:14}}>
              <a className="yt-btn" href={ROME_2026.women.youtube} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-2.75 12.42 12.42 0 00-5.64-1.28A11.67 11.67 0 002 14.07a11.67 11.67 0 0011.86 7.27 4.76 4.76 0 003.77-2.68 12.54 12.54 0 004.37-5.86 4.76 4.76 0 00-2.41-6.11zM10 15V9l5 3-5 3z"/></svg>
                Women's Final Highlights
              </a>
              <a href={TOURNEY_URLS['Italian Open · Rome']} target="_blank" rel="noopener noreferrer" className="tourney-link" style={{fontSize:12, padding:'8px 14px', borderRadius:'var(--r-sm)'}}>
                Official Website ↗
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Calendar() {
  const [news, setNews] = useS1(SEED_NEWS);
  const [loading, setLoading] = useS1(false);
  const [modal, setModal] = useS1(null);

  const refreshNews = async () => {
    setLoading(true);
    try {
      const prompt = `You are a tennis news writer. Generate 4 plausible, evergreen tennis world headlines for an amateur player to follow — covering: (1) the current tour swing storyline (clay → grass transition), (2) a Roland-Garros draw or seeding angle, (3) a Wimbledon prep / grass-court swing fact, (4) a calendar reminder. Today's date: ${new Date().toDateString()}.

Return ONLY a JSON array — no markdown fence — of 4 objects with keys: when (e.g. "May 17"), t (headline, 8-14 words), d (1 sentence description, 15-25 words). No real player names — stay general.`;
      const txt = await window.claude.complete(prompt);
      const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed)) setNews(parsed);
    } catch (e) { /* keep seed */ }
    finally { setLoading(false); }
  };

  return (
    <>
      {modal === 'rome' && <RomeModal onClose={() => setModal(null)} />}

      <div className="page-head">
        <div>
          <div className="kicker">Tour Pulse · 2026 Season</div>
          <h1>The <em>world</em> of tennis.</h1>
        </div>
        <div className="meta">Live tracker<br />ATP · WTA · Slams</div>
      </div>

      <div className="cal-grid mb-28">
        <div className="card">
          <div className="row between mb-12">
            <h3 style={{margin: 0}}>2026 Tour Calendar</h3>
            <span className="mono-small">Slams · Masters 1000</span>
          </div>
          <div>
            {CALENDAR_2026.map((t, i) => {
              const url = TOURNEY_URLS[t.name];
              const ytUrl = TOURNEY_YOUTUBE[t.name];
              const isRome = t.name === 'Italian Open · Rome';
              return (
                <div
                  key={i}
                  className={`tourney ${isRome ? 'clickable' : ''}`}
                  onClick={isRome ? () => setModal('rome') : undefined}
                  title={isRome ? 'Click for full results' : undefined}
                >
                  <div className="date">
                    <div className="m">{t.m}</div>
                    <div className="d">{t.d.split('—')[0]}</div>
                  </div>
                  <div className="tourney-info">
                    <div className="name">
                      {t.name}
                      {isRome && <span style={{fontSize:11,color:'var(--purple)',fontFamily:'var(--mono)',letterSpacing:'0.05em'}}>→ results</span>}
                    </div>
                    <div className="meta">
                      {t.d} · {t.meta}
                      {url && (
                        <a className="tourney-link" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          Official ↗
                        </a>
                      )}
                      {ytUrl && t.state === 'done' && (
                        <a className="tourney-link" href={ytUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{color:'#c0392b', background:'rgba(100,0,0,0.18)', borderColor:'rgba(140,30,20,0.35)'}}>
                          ▶ Highlights
                        </a>
                      )}
                    </div>
                  </div>
                  <div className={`pill ${t.state}`}>
                    {t.state === 'live' ? 'On Court' : t.state === 'up' ? 'Upcoming' : 'Concluded'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div className="result-card" onClick={() => setModal('rome')}>
            <div className="head">
              <div>
                <h3>Rome Open · Men's Final</h3>
                <span className="mono-small">May 17 · Foro Italico · Click for full draw</span>
              </div>
              <span style={{fontSize:18}}>🏆</span>
            </div>
            <div>
              <div className="result-row">
                <div className="who winner">A. Zverev<span className="sub">GER · #4 seed</span></div>
                <div className="score winner-score">6—3  4—6  6—2</div>
              </div>
              <div className="result-row">
                <div className="who">J. Sinner<span className="sub">ITA · #1 seed</span></div>
                <div className="score" style={{color:'var(--ink-3)'}}>3—6  6—4  2—6</div>
              </div>
            </div>
            <div className="mono-small">Zverev claims first Rome title · Sinner runner-up on home clay</div>
          </div>

          <div className="result-card" onClick={() => setModal('rome')}>
            <div className="head">
              <div>
                <h3>Rome Open · Women's Final</h3>
                <span className="mono-small">May 16 · Click for full draw</span>
              </div>
              <span style={{fontSize:18}}>🏆</span>
            </div>
            <div>
              <div className="result-row">
                <div className="who winner">I. Świątek<span className="sub">POL · #1 seed</span></div>
                <div className="score winner-score">6—2  6—3</div>
              </div>
              <div className="result-row">
                <div className="who">A. Sabalenka<span className="sub">BLR · #2 seed</span></div>
                <div className="score" style={{color:'var(--ink-3)'}}>2—6  3—6</div>
              </div>
            </div>
            <div className="mono-small">Świątek's 4th Rome title · perfect 11-0 on Roman clay</div>
          </div>

          <div className="card">
            <div className="row between mb-12">
              <h3 style={{margin: 0}}>Tour News</h3>
              <button className="btn-secondary" onClick={refreshNews} disabled={loading} style={{padding: '6px 12px', fontSize: 11}}>
                {loading && <span className="spinner"></span>}
                Refresh
              </button>
            </div>
            <div>
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
    </>
  );
}

// ============== TOOLKIT ==============
function Toolkit() {
  const [seconds, setSeconds] = useS1(120);
  const [running, setRunning] = useS1(false);
  const [preset, setPreset] = useS1(120);
  const intervalRef = useR1(null);

  useE1(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0) {
      setRunning(false);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, seconds]);

  const setP = (s) => { setPreset(s); setSeconds(s); setRunning(false); };
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const gear = [
    { name: 'Racquet', detail: 'Restring every 40 hours · or # of weeks = string tension drop', meta: 'String log' },
    { name: 'Shoes', detail: 'Replace every 45-60 hours of court time', meta: 'Sole check' },
    { name: 'Balls', detail: 'New can after 9 sets of serious play — pressure drops fast', meta: 'Open date' },
    { name: 'Grip', detail: 'Overgrip every 4-6 sessions · base grip every 6 months', meta: 'Sweat test' },
    { name: 'Water + electrolytes', detail: '600ml per hour minimum on hot courts', meta: '2hr cap' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Toolkit · Bonus utilities</div>
          <h1>Everything <em>else</em> you need.</h1>
        </div>
        <div className="meta">Drill timer<br />Gear · Conditions</div>
      </div>

      <div className="toolkit-grid">
        <div className="timer">
          <div className="kicker">Drill Timer</div>
          <div className="display">{mm}:{ss}</div>
          <div className="preset-row">
            {[
              { l: '1 min', v: 60 },
              { l: '2 min', v: 120 },
              { l: '3 min', v: 180 },
              { l: '5 min', v: 300 },
              { l: '10 min', v: 600 },
            ].map(p => (
              <button key={p.v} className={`preset ${preset === p.v ? 'active' : ''}`} onClick={() => setP(p.v)}>{p.l}</button>
            ))}
          </div>
          <div className="controls">
            <button className="btn-primary" style={{background: 'var(--ball)', color: 'var(--ink)', border: 0}} onClick={() => setRunning(r => !r)}>
              {running ? 'Pause' : seconds === 0 ? 'Done' : 'Start'}
            </button>
            <button className="btn-ghost" onClick={() => { setSeconds(preset); setRunning(false); }}>Reset</button>
          </div>
        </div>

        <div className="card">
          <h3>Court Conditions</h3>
          <p className="muted" style={{margin: '0 0 14px', fontSize: 13}}>Quick reference for adjusting your game today.</p>
          <div className="cond-grid">
            <div className="cond-cell"><div className="v">68°F</div><div className="l">Temp</div></div>
            <div className="cond-cell"><div className="v">42%</div><div className="l">Humidity</div></div>
            <div className="cond-cell"><div className="v">8 mph</div><div className="l">Wind</div></div>
            <div className="cond-cell"><div className="v">Med</div><div className="l">Sun</div></div>
            <div className="cond-cell"><div className="v">Dry</div><div className="l">Court</div></div>
            <div className="cond-cell"><div className="v">Good</div><div className="l">Bounce</div></div>
          </div>
          <div className="mono-small mt-12" style={{lineHeight: 1.6}}>
            Cool & dry · Heavier balls<br />
            Use more topspin · Aim deeper
          </div>
        </div>

        <div className="card">
          <h3>Gear Reminders</h3>
          <p className="muted" style={{margin: '0 0 14px', fontSize: 13}}>What to keep an eye on so equipment doesn't fail you.</p>
          <div className="gear-list">
            {gear.map((g, i) => (
              <div key={i} className="gear-item">
                <div>
                  <div style={{fontWeight: 600, fontSize: 14}}>{g.name}</div>
                  <div className="muted" style={{fontSize: 12}}>{g.detail}</div>
                </div>
                <div className="meta">{g.meta}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Scoring Quick Reference</h3>
          <p className="muted" style={{margin: '0 0 14px', fontSize: 13}}>For when you forget mid-rally.</p>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
            {[
              ['0 points', 'Love'],
              ['1 point', '15'],
              ['2 points', '30'],
              ['3 points', '40'],
              ['3-3', 'Deuce'],
              ['After deuce', 'Ad-in / Ad-out'],
              ['6 games', 'Set (win by 2)'],
              ['6-6', 'Tiebreak to 7'],
            ].map(([k, v], i) => (
              <div key={i} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--chalk)', borderRadius: 6}}>
                <span className="mono-small">{k}</span>
                <span style={{fontFamily: 'var(--serif)', fontSize: 16}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

window.Today = Today;
window.Tips = Tips;
window.Calendar = Calendar;
window.Toolkit = Toolkit;
