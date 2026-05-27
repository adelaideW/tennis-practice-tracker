/* global React, PRACTICE_TAGS, INTENSITY, TIPS, CALENDAR_2026, SEED_NEWS, TOUR_RESULTS_WEEK */
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
        stroke="var(--chart-1)" strokeWidth="10"
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
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#actGrad)"/>
      <polyline points={polyline} fill="none" stroke="var(--chart-1)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <g key={i}>
          {p.mins > 0 && <circle cx={p.x} cy={p.y} r={3.5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="1.5"/>}
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
    return sorted.map(([k, count]) => ({
      label: (PRACTICE_TAGS.find((p) => p.k === k) || {}).l || k,
      pct: Math.round((count / max) * 100),
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
              <div key={i} className={`skill-row skill-series skill-series-${i}`}>
                <div className="skill-left">
                  <div className="skill-dot"></div>
                  <div className="skill-name">{s.label}</div>
                </div>
                <div className="skill-bar-wrap">
                  <div className="skill-bar" style={{ width: s.pct + '%' }}></div>
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
    </>
  );
}

// ============== TIPS ==============
function Tips({ notionPayload, syncFromNotion, notionLoading, notionUpdatedAt, notionError }) {
  const [refreshSeed, setRefreshSeed] = useS1(0);
  const [showLibrary, setShowLibrary] = useS1(false);
  const [cat, setCat] = useS1('groundstrokes');
  const order = ['groundstrokes', 'serve', 'volley', 'overhead', 'mental'];
  const notionPage = window.NOTION_INSIGHTS_PAGE;

  const sharpen = useM1(
    () => (notionPayload && window.buildSharpenFromNotion
      ? window.buildSharpenFromNotion(notionPayload, TIPS, refreshSeed)
      : { areas: [], generatedAt: null, source: null, sessionCount: 0 }),
    [notionPayload, refreshSeed],
  );

  const refreshedLabel = sharpen.generatedAt
    ? new Date(sharpen.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const handleRefresh = async () => {
    setRefreshSeed((n) => n + 1);
    if (syncFromNotion) await syncFromNotion();
  };

  const libraryData = TIPS[cat];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">
            Top 5 from Notion · {sharpen.sessionCount || 0} sessions analyzed
          </div>
          <h1>Sharpen <em>the craft.</em></h1>
        </div>
        <div className="meta">
          {refreshedLabel && <>Tips refreshed · {refreshedLabel}<br /></>}
          {notionPage && (
            <a href={notionPage} target="_blank" rel="noopener noreferrer" className="notion-link">
              Tennis practice insights ↗
            </a>
          )}
        </div>
      </div>

      <div className="notion-sync-bar mb-28">
        <div className="notion-sync-copy">
          <div className="mono-small">Your improvement plan</div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Ranked from weekly priorities and every daily reflection in Notion — with drills and video links.
          </p>
          {notionError && <span className="notion-new-badge">{notionError}</span>}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleRefresh}
          disabled={notionLoading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {notionLoading && <span className="spinner"></span>}
          Refresh from Notion
        </button>
      </div>

      {notionLoading && !sharpen.areas.length ? (
        <div className="card mb-28">
          <p className="muted" style={{ margin: 0 }}>Loading your focus areas from Notion…</p>
        </div>
      ) : (
        <div className="sharpen-areas mb-28">
          {sharpen.areas.map((area) => (
            <section key={area.key} className="focus-area-card">
              <div className="focus-area-head">
                <span className="focus-area-rank">#{area.rank}</span>
                <div>
                  <h2>{area.title}</h2>
                  <p className="muted focus-area-summary">{area.summary}</p>
                </div>
              </div>

              {area.notionQuotes.length > 0 && (
                <ul className="notion-quote-list">
                  {area.notionQuotes.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}

              <div className="tip-grid focus-area-tips">
                {area.tips.map((tip, i) => (
                  <div key={i} className={`tip-card ${tip.priority ? 'priority' : ''}`}>
                    <div className="num">
                      Tip {String(i + 1).padStart(2, '0')}
                      {tip.priority && <span className="match-chip">Match</span>}
                    </div>
                    <h4>{tip.h}</h4>
                    <p>{tip.p}</p>
                    <div className="drill"><b>Drill:</b> {tip.drill}</div>
                  </div>
                ))}
              </div>

              {area.resources?.length > 0 && (
                <div className="tip-resources">
                  <div className="tip-resources-label">Suggested resources</div>
                  <div className="tip-resource-links">
                    {area.resources.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`tip-resource-link ${r.type === 'youtube' ? 'yt' : ''}`}
                      >
                        {r.type === 'youtube' ? '▶ ' : ''}{r.label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
          {!sharpen.areas.length && (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                Add weekly priorities or daily reflections in Notion, then tap Refresh — your top five focus areas will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="library-toggle-row mb-12">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowLibrary((v) => !v)}
        >
          {showLibrary ? 'Hide full tip library' : 'Browse full tip library'}
        </button>
      </div>

      {showLibrary && (
        <>
          <div className="tip-tabs">
            {order.map((k) => (
              <button
                key={k}
                type="button"
                className={`tip-tab ${cat === k ? 'active' : ''}`}
                onClick={() => setCat(k)}
              >
                {TIPS[k].title}
                <span className="ct">{String(TIPS[k].items.length).padStart(2, '0')}</span>
              </button>
            ))}
          </div>
          <div className="tip-hero mb-20">
            <div>
              <div className="mono-small mb-12">Category · {libraryData.title}</div>
              <h2>
                <em>{libraryData.title.split(' ')[0]}</em>{' '}
                {libraryData.title.split(' ').slice(1).join(' ')}
              </h2>
              <p className="muted">{libraryData.blurb}</p>
            </div>
          </div>
          <div className="tip-grid">
            {libraryData.items.map((tip, i) => (
              <div key={i} className={`tip-card ${tip.priority ? 'priority' : ''}`}>
                <div className="num">No. {String(i + 1).padStart(2, '0')}</div>
                <h4>{tip.h}</h4>
                <p>{tip.p}</p>
                <div className="drill"><b>Drill:</b> {tip.drill}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ============== GAME CHEAT NOTE ==============
const GAME_CHEAT_STORAGE_KEY = 'ace-game-cheat-notes-v1';

function loadGameCheatNotes() {
  try {
    const raw = localStorage.getItem(GAME_CHEAT_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.name === 'string')
      .map((item) => ({
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: item.name || '',
        goodAt: item.goodAt || '',
        badAt: item.badAt || '',
      }));
  } catch (e) {
    return [];
  }
}

function GameCheatNotes() {
  const [notes, setNotes] = useS1(loadGameCheatNotes);
  const [draft, setDraft] = useS1({ name: '', goodAt: '', badAt: '' });

  useE1(() => {
    try {
      localStorage.setItem(GAME_CHEAT_STORAGE_KEY, JSON.stringify(notes));
    } catch (e) { /* ignore */ }
  }, [notes]);

  const canAdd = draft.name.trim().length > 0;

  const addNote = () => {
    if (!canAdd) return;
    setNotes((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: draft.name.trim(),
        goodAt: draft.goodAt.trim(),
        badAt: draft.badAt.trim(),
      },
    ]);
    setDraft({ name: '', goodAt: '', badAt: '' });
  };

  const updateField = (id, key, value) => {
    setNotes((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const removeNote = (id) => {
    setNotes((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Match prep notebook</div>
          <h1>Game <em>cheat note.</em></h1>
        </div>
        <div className="meta">Track each friend’s strengths and leaks</div>
      </div>

      <div className="card game-cheat-add mb-20">
        <h3>Add player</h3>
        <div className="game-cheat-grid">
          <label className="game-cheat-field">
            <span className="mono-small">Friend name</span>
            <input
              className="title-input"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Alex"
            />
          </label>
          <label className="game-cheat-field">
            <span className="mono-small">Good at</span>
            <textarea
              className="notes game-cheat-notes-input"
              value={draft.goodAt}
              onChange={(e) => setDraft((d) => ({ ...d, goodAt: e.target.value }))}
              placeholder="Strong serve, fast at net, deep cross-court..."
            />
          </label>
          <label className="game-cheat-field">
            <span className="mono-small">Bad at</span>
            <textarea
              className="notes game-cheat-notes-input"
              value={draft.badAt}
              onChange={(e) => setDraft((d) => ({ ...d, badAt: e.target.value }))}
              placeholder="Struggles on high backhand, short second serve..."
            />
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-primary" onClick={addNote} disabled={!canAdd}>
            Add to cheat note
          </button>
        </div>
      </div>

      <div className="game-cheat-list">
        {notes.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>
              Add your first friend to build your match cheat note.
            </p>
          </div>
        ) : (
          notes.map((item) => (
            <section key={item.id} className="card game-cheat-card">
              <div className="game-cheat-head">
                <input
                  className="title-input game-cheat-name"
                  value={item.name}
                  onChange={(e) => updateField(item.id, 'name', e.target.value)}
                />
                <button type="button" className="btn-secondary" onClick={() => removeNote(item.id)}>
                  Remove
                </button>
              </div>
              <div className="game-cheat-grid">
                <label className="game-cheat-field">
                  <span className="mono-small">Good at</span>
                  <textarea
                    className="notes game-cheat-notes-input"
                    value={item.goodAt}
                    onChange={(e) => updateField(item.id, 'goodAt', e.target.value)}
                    placeholder="What this player does well..."
                  />
                </label>
                <label className="game-cheat-field">
                  <span className="mono-small">Bad at</span>
                  <textarea
                    className="notes game-cheat-notes-input"
                    value={item.badAt}
                    onChange={(e) => updateField(item.id, 'badAt', e.target.value)}
                    placeholder="Where to apply pressure..."
                  />
                </label>
              </div>
            </section>
          ))
        )}
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

const TOUR_DAILY_KEY = 'tennis-tour-daily-v1';
const TOUR_RESULTS_PREVIEW = 4;
const TOUR_RESULTS_WINDOW_DAYS = 7;

function formatResultWhen(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDailyLabel(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getResultsInPastDays(results, days = TOUR_RESULTS_WINDOW_DAYS) {
  const cut = new Date();
  cut.setDate(cut.getDate() - days);
  const cutIso = cut.toISOString().slice(0, 10);
  return results
    .filter((r) => r.date >= cutIso)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
}

function applyDailyTourRefresh(setNews, setDailyLabel) {
  const today = new Date().toISOString().slice(0, 10);
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(TOUR_DAILY_KEY) || '{}');
  } catch (_) { /* keep defaults */ }

  if (stored.date === today && Array.isArray(stored.news)) {
    setNews(stored.news);
    setDailyLabel(stored.label || formatDailyLabel(stored.refreshedAt));
    return;
  }

  const dayNum = Math.floor(Date.now() / 86400000);
  const rotated = [...SEED_NEWS];
  const shift = dayNum % rotated.length;
  const news = [...rotated.slice(shift), ...rotated.slice(0, shift)];
  const refreshedAt = new Date().toISOString();
  const label = formatDailyLabel(refreshedAt);
  localStorage.setItem(
    TOUR_DAILY_KEY,
    JSON.stringify({ date: today, news, refreshedAt, label }),
  );
  setNews(news);
  setDailyLabel(label);
}

function TourResultSnippet({ match, onOpen }) {
  const clickable = Boolean(match.modal && onOpen);
  return (
    <div
      className={`tour-result-snippet${clickable ? ' clickable' : ''}`}
      onClick={clickable ? onOpen : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onOpen(); } : undefined}
    >
      <div className="tour-result-meta">
        <span className="tour-result-when">{formatResultWhen(match.date)}</span>
        <span className={`tour-tag ${match.tour === 'WTA' ? 'wta' : 'atp'}`}>{match.tour}</span>
        <span className="tour-result-round">{match.round}</span>
      </div>
      <div className="tour-result-event">{match.tournament}</div>
      <div className="result-row">
        <div className="who winner">
          {match.winner}
          <span className="sub">{match.winnerSub}</span>
        </div>
        <div className="score winner-score">{match.score}</div>
      </div>
      <div className="result-row">
        <div className="who">
          {match.loser}
          <span className="sub">{match.loserSub}</span>
        </div>
      </div>
    </div>
  );
}

function WeekResultsModal({ results, onClose, onOpenTourney }) {
  useE1(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const byDate = useM1(() => {
    const groups = {};
    results.forEach((m) => {
      if (!groups[m.date]) groups[m.date] = [];
      groups[m.date].push(m);
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({ date, matches: groups[date] }));
  }, [results]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal week-results-modal">
        <div className="modal-header">
          <div className="deco" aria-hidden="true"></div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          <div className="kicker">Past {TOUR_RESULTS_WINDOW_DAYS} days</div>
          <h2>Week in results</h2>
          <div className="modal-meta">{results.length} matches · ATP &amp; WTA</div>
        </div>
        <div className="modal-body">
          {byDate.map(({ date, matches }) => (
            <div key={date} className="week-results-day">
              <div className="week-results-day-label">{formatResultWhen(date)}</div>
              {matches.map((m) => (
                <TourResultSnippet
                  key={m.id}
                  match={m}
                  onOpen={m.modal === 'rome' ? onOpenTourney : undefined}
                />
              ))}
            </div>
          ))}
          {!results.length && (
            <p className="mono-small" style={{ margin: 0 }}>No results in this window yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
              <a
                href={TOURNEY_URLS['Italian Open · Rome']}
                target="_blank"
                rel="noopener noreferrer"
                className="tourney-link"
              >
                Official Website ↗
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
              <a
                href={TOURNEY_URLS['Italian Open · Rome']}
                target="_blank"
                rel="noopener noreferrer"
                className="tourney-link"
              >
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
  const [showWeekResults, setShowWeekResults] = useS1(false);
  const [dailyLabel, setDailyLabel] = useS1(() => formatDailyLabel());

  const weekResults = useM1(
    () => getResultsInPastDays(TOUR_RESULTS_WEEK, TOUR_RESULTS_WINDOW_DAYS),
    [],
  );
  const recentResults = useM1(
    () => weekResults.slice(0, TOUR_RESULTS_PREVIEW),
    [weekResults],
  );

  useE1(() => {
    applyDailyTourRefresh(setNews, setDailyLabel);
  }, []);

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
      {showWeekResults && (
        <WeekResultsModal
          results={weekResults}
          onClose={() => setShowWeekResults(false)}
          onOpenTourney={() => { setShowWeekResults(false); setModal('rome'); }}
        />
      )}

      <div className="page-head">
        <div>
          <div className="kicker">Tour Pulse · 2026 Season</div>
          <h1>The <em>world</em> of tennis.</h1>
        </div>
        <div className="meta">
          Daily refresh · {dailyLabel}
          <br />
          ATP · WTA · Slams
        </div>
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
                    <div className="tourney-meta">
                      <div className="tourney-subtitle">{t.d} · {t.meta}</div>
                      {(url || (ytUrl && t.state === 'done')) && (
                        <div className="tourney-links">
                          {url && (
                            <a
                              className="tourney-link"
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Official ↗
                            </a>
                          )}
                          {url && ytUrl && t.state === 'done' && (
                            <span className="tourney-link-sep" aria-hidden="true">·</span>
                          )}
                          {ytUrl && t.state === 'done' && (
                            <a
                              className="tourney-link tourney-link-video"
                              href={ytUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              ▶ Highlights
                            </a>
                          )}
                        </div>
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
          <div className="card recent-results-card">
            <div className="row between mb-12">
              <div>
                <h3 style={{margin: 0}}>Recent Results</h3>
                <span className="mono-small">Updated {dailyLabel} · last {TOUR_RESULTS_WINDOW_DAYS} days</span>
              </div>
              <span className="daily-refresh-pill" title="Refreshes automatically each day">Daily</span>
            </div>
            <div className="recent-results-list">
              {recentResults.map((m) => (
                <TourResultSnippet
                  key={m.id}
                  match={m}
                  onOpen={m.modal === 'rome' ? () => setModal('rome') : undefined}
                />
              ))}
              {!recentResults.length && (
                <p className="mono-small" style={{margin: 0}}>No results in the past week.</p>
              )}
            </div>
            {weekResults.length > 0 && (
              <button
                type="button"
                className="btn-secondary see-more-results"
                onClick={() => setShowWeekResults(true)}
              >
                {weekResults.length > TOUR_RESULTS_PREVIEW
                  ? `See more · ${weekResults.length} matches this week`
                  : `See all ${weekResults.length} matches this week`}
              </button>
            )}
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

// Glossary excerpts from USTA “Tennis Terms & Words to Know” (national tips & instruction).
const USTA_TERMS_CARD_URL = 'https://www.usta.com/en/home/improve/tips-and-instruction/national/tennis-terms-definitions.html';
const USTA_TERMS = [
  ['ACE', 'A ball that is served so well the opponent cannot touch it with their racquet.'],
  ['AD', 'Short for Advantage — the point scored after deuce. If the serving side scores, it is Ad-in; if the receiving side scores, Ad-out.'],
  ['ALL', 'An even score (e.g. 30-all, 3-all).'],
  ['ALLEY', 'The area between the singles and doubles sideline — the singles court widens for doubles by adding the alley.'],
  ['APPROACH', 'The shot hit just before a player moves forward to the net.'],
  ['BACKCOURT', 'The area around the baseline.'],
  ['BACKHAND', 'Stroke to return balls on the non-dominant side — one- or two-handed.'],
  ['BASELINE', 'The court’s back line, parallel to the net.'],
  ['DEUCE', 'A score of 40-all — tied with each side having won at least three points in the game.'],
  ['DEUCE COURT', 'The right side of the court; on deuce, the serve starts from here.'],
  ['DOUBLE FAULT', 'Fault on both service attempts — server loses the point.'],
  ['DOUBLES', 'Four players, two per team.'],
  ['DROP SHOT', 'Soft shot with plenty of backspin that lands barely past the net.'],
  ['FAULT', 'A serve that does not land in the correct service box.'],
  ['FOOT FAULT', 'Fault for stepping on or over the baseline during the serve motion.'],
  ['FOREHAND', 'Stroke on the dominant side of the body, usually one-handed.'],
  ['GAME', 'Unit of a set: first to four points and ahead by two, or two straight points after deuce.'],
  ['GROUND STROKE', 'A stroke after the ball has bounced — forehand or backhand.'],
  ['HALF-VOLLEY', 'Hitting the ball right after it touches the ground — typically a low, short hop.'],
  ['LET', 'Point replayed because of interference, or a serve that clips the net but is otherwise good (serve again).'],
  ['LOB', 'High shot, often over an opponent at the net.'],
  ['MATCH', 'The full contest, often best two of three sets.'],
  ['NO-AD', 'First to four points wins the game; at 3-all, the next point decides it.'],
  ["NO MAN'S LAND", 'Slang for the area between the service line and baseline.'],
  ['OUT', 'Ball landing outside the court lines.'],
  ['OVERHEAD', 'Stroke made above the head, similar in shape to a serve.'],
  ['POACH', 'In doubles, intercepting at the net a ball your partner would normally take.'],
  ['POINT', 'The smallest unit of scoring.'],
  ['RALLY', 'A series of successful shots in a point; also casual warm-up hitting.'],
  ['RECEIVER', 'The player returning serve (returner).'],
  ['SERVE', 'Putting the ball into play to start each point.'],
  ['SERVER', 'The player who serves.'],
  ['SERVICE BREAK', 'A game won by the returner against serve.'],
  ['SET', 'Won by reaching six games with a two-game lead, or 6-plus with a tiebreak at 6-all (format-dependent).'],
  ['SLICE', 'Shot with heavy backspin, high-to-low racquet path.'],
  ['SMASH', 'Aggressive overhead.'],
  ['SPIN', 'Rotation on the ball (e.g. topspin or slice).'],
  ['STROKE', 'Contact with the racquet.'],
  ['TIEBREAK', 'Played at 6-all in traditional formats to settle the set.'],
  ['TOPSPIN', 'Forward spin from a low-to-high swing.'],
  ['VOLLEY', 'Hit before the bounce at the net during a point.'],
];

const TOOLKIT_LAYOUT_STORAGE = 'ace-toolkit-layout';
const TERMS_LAYOUT_STORAGE = 'ace-toolkit-terms-layout';
const TOOLKIT_CARD_IDS = ['timer', 'conditions', 'gear', 'terms'];
const DEFAULT_CARD_H = 280;
const EXPANDED_TERMS_H = 480;
const TERMS_GRID_H = 6;
const TERMS_GRID_H_EXPANDED = 10;
const DEFAULT_GRID_H = 6;
const TGL = typeof window !== 'undefined' ? window.ToolkitGridLayout : null;

const TOOLKIT_CARD_TITLES = {
  timer: 'Drill Timer',
  conditions: 'Court Conditions',
  gear: 'Gear Reminders',
  terms: 'Tennis terms & words',
};

function getToolkitGridConfig(containerWidth) {
  const isMobile = containerWidth <= 920;
  return {
    cols: isMobile ? 6 : 12,
    rowHeight: 30,
    margin: [24, 24],
    containerPadding: [0, 0],
  };
}

function makeDefaultItems(cols) {
  if (cols <= 6) {
    return [
      { i: 'timer', x: 0, y: 0, w: 6, h: DEFAULT_GRID_H },
      { i: 'conditions', x: 0, y: DEFAULT_GRID_H, w: 6, h: DEFAULT_GRID_H },
      { i: 'gear', x: 0, y: DEFAULT_GRID_H * 2, w: 6, h: DEFAULT_GRID_H },
      { i: 'terms', x: 0, y: DEFAULT_GRID_H * 3, w: 6, h: TERMS_GRID_H, expanded: false },
    ];
  }
  return [
    { i: 'timer', x: 0, y: 0, w: 6, h: DEFAULT_GRID_H },
    { i: 'conditions', x: 6, y: 0, w: 6, h: DEFAULT_GRID_H },
    { i: 'gear', x: 0, y: DEFAULT_GRID_H, w: 6, h: DEFAULT_GRID_H },
    { i: 'terms', x: 6, y: DEFAULT_GRID_H, w: 6, h: TERMS_GRID_H, expanded: false },
  ];
}

function normalizeToolkitItem(raw, cols) {
  const item = {
    i: raw.i,
    x: typeof raw.x === 'number' ? raw.x : 0,
    y: typeof raw.y === 'number' ? raw.y : 0,
    w: TGL ? TGL.clamp(typeof raw.w === 'number' ? raw.w : 6, 1, cols) : 6,
    h: TGL ? TGL.clamp(typeof raw.h === 'number' ? raw.h : DEFAULT_GRID_H, 1, 24) : DEFAULT_GRID_H,
  };
  if (raw.i === 'terms') {
    item.expanded = !!raw.expanded;
    if (item.expanded && item.h <= TERMS_GRID_H) item.h = TERMS_GRID_H_EXPANDED;
  }
  item.x = TGL ? TGL.clamp(item.x, 0, Math.max(0, cols - item.w)) : item.x;
  item.y = Math.max(0, item.y);
  return item;
}

function makeDefaultToolkitLayout(containerWidth) {
  const cols = containerWidth <= 920 ? 6 : 12;
  return { mode: 'grid', items: makeDefaultItems(cols) };
}

function loadToolkitLayout() {
  const fallbackWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  try {
    const raw = localStorage.getItem(TOOLKIT_LAYOUT_STORAGE);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j.items) && j.items.length === 4
        && TOOLKIT_CARD_IDS.every((id) => j.items.some((it) => it.i === id))) {
        const cols = fallbackWidth <= 920 ? 6 : 12;
        const items = TOOLKIT_CARD_IDS.map((id) => {
          const found = j.items.find((it) => it.i === id);
          return normalizeToolkitItem(found || { i: id, x: 0, y: 0, w: 6, h: DEFAULT_GRID_H }, cols);
        });
        return { mode: j.mode === 'dashboard' ? 'dashboard' : 'grid', items };
      }
      if ((j.mode === 'dashboard' || j.mode === 'grid') && j.cards
        && TOOLKIT_CARD_IDS.every((id) => j.cards[id])) {
        const termsCard = j.cards.terms || {};
        const cols = fallbackWidth <= 920 ? 6 : 12;
        const items = makeDefaultItems(cols);
        const termsItem = items.find((it) => it.i === 'terms');
        if (termsItem && termsCard.expanded) {
          termsItem.expanded = true;
          termsItem.h = TERMS_GRID_H_EXPANDED;
        }
        return { mode: j.mode === 'dashboard' ? 'dashboard' : 'grid', items };
      }
      if (Array.isArray(j.order) && j.order.length === 4 && j.sizes) {
        const cols = fallbackWidth <= 920 ? 6 : 12;
        const items = makeDefaultItems(cols);
        const termsItem = items.find((it) => it.i === 'terms');
        const s = j.sizes.terms || {};
        if (termsItem && typeof s.minHeight === 'number' && s.minHeight > 300) {
          termsItem.expanded = true;
          termsItem.h = TERMS_GRID_H_EXPANDED;
        }
        return { mode: 'grid', items };
      }
    }
    const oldRaw = localStorage.getItem(TERMS_LAYOUT_STORAGE);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      if (typeof old.h === 'number') {
        const layout = makeDefaultToolkitLayout(fallbackWidth);
        const termsItem = layout.items.find((it) => it.i === 'terms');
        if (termsItem && old.h > 300) {
          termsItem.expanded = true;
          termsItem.h = TERMS_GRID_H_EXPANDED;
        }
        return layout;
      }
    }
  } catch (e) { /* keep default */ }
  return makeDefaultToolkitLayout(fallbackWidth);
}

function captureGridAsDashboardItems(wrapEl, layout, config) {
  if (!TGL || !wrapEl) return layout;
  const wrapRect = wrapEl.getBoundingClientRect();
  const items = layout.items.map((item) => {
    const el = wrapEl.querySelector(`[data-toolkit-id="${item.i}"]`);
    if (!el) return { ...item };
    const r = el.getBoundingClientRect();
    const grid = TGL.pixelsToGridItem(r, wrapRect, config);
    return { ...item, ...grid };
  });
  return { ...layout, mode: 'dashboard', items: TGL.compactVertical(items, config.cols) };
}

function getItemById(items, id) {
  return items.find((it) => it.i === id) || { i: id, x: 0, y: 0, w: 6, h: DEFAULT_GRID_H };
}

function getToolkitPanelHeight(id, item, mode) {
  if (mode === 'grid') {
    if (id === 'terms' && item.expanded) return EXPANDED_TERMS_H;
    return DEFAULT_CARD_H;
  }
  return null;
}

function ToolkitPanel({
  id,
  title,
  mode,
  item,
  pixelStyle,
  isDragging,
  showExpand,
  expanded,
  onDragStart,
  onResizeStart,
  onToggleExpand,
  children,
}) {
  const gridHeight = getToolkitPanelHeight(id, item, mode);
  const panelStyle = mode === 'dashboard' && pixelStyle
    ? {
        left: pixelStyle.left,
        top: pixelStyle.top,
        width: pixelStyle.width,
        height: pixelStyle.height,
      }
    : { '--panel-min-h': `${gridHeight}px` };

  return (
    <div
      data-toolkit-id={id}
      className={`toolkit-panel card drag-handle${mode === 'dashboard' ? ' is-dashboard' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={panelStyle}
      role="region"
      aria-label={title}
    >
      <div
        className="toolkit-panel-header"
        onPointerDown={(ev) => onDragStart(id, ev)}
        title="Drag to move"
      >
        <span className="toolkit-panel-title">{title}</span>
        <div className="toolkit-panel-header-actions">
          {showExpand && (
            <button
              type="button"
              className="toolkit-panel-expand"
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => { ev.stopPropagation(); onToggleExpand(id); }}
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <span className="toolkit-panel-grip" aria-hidden="true">⠿</span>
        </div>
      </div>
      <div className="toolkit-panel-body">{children}</div>
      <button
        type="button"
        className="toolkit-panel-resize"
        onPointerDown={(ev) => onResizeStart(id, ev)}
        aria-label="Resize panel"
      />
    </div>
  );
}

function ToolkitTimerContent({ seconds, running, preset, setP, setRunning, setSeconds }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div className="toolkit-timer-inner">
      <div className="display">{mm}:{ss}</div>
      <div className="preset-row">
        {[
          { l: '1 min', v: 60 },
          { l: '2 min', v: 120 },
          { l: '3 min', v: 180 },
          { l: '5 min', v: 300 },
          { l: '10 min', v: 600 },
        ].map((p) => (
          <button key={p.v} type="button" className={`preset ${preset === p.v ? 'active' : ''}`} onClick={() => setP(p.v)}>{p.l}</button>
        ))}
      </div>
      <div className="controls">
        <button type="button" className="btn-primary" onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause' : seconds === 0 ? 'Done' : 'Start'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setSeconds(preset); setRunning(false); }}>Reset</button>
      </div>
    </div>
  );
}

function ToolkitConditionsContent() {
  return (
    <>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>Quick reference for adjusting your game today.</p>
      <div className="cond-grid">
        <div className="cond-cell"><div className="v">68°F</div><div className="l">Temp</div></div>
        <div className="cond-cell"><div className="v">42%</div><div className="l">Humidity</div></div>
        <div className="cond-cell"><div className="v">8 mph</div><div className="l">Wind</div></div>
        <div className="cond-cell"><div className="v">Med</div><div className="l">Sun</div></div>
        <div className="cond-cell"><div className="v">Dry</div><div className="l">Court</div></div>
        <div className="cond-cell"><div className="v">Good</div><div className="l">Bounce</div></div>
      </div>
      <div className="mono-small mt-12" style={{ lineHeight: 1.6 }}>
        Cool & dry · Heavier balls<br />
        Use more topspin · Aim deeper
      </div>
    </>
  );
}

function ToolkitGearContent({ gear }) {
  return (
    <>
      <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>What to keep an eye on so equipment doesn't fail you.</p>
      <div className="gear-list">
        {gear.map((g, i) => (
          <div key={i} className="gear-item">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{g.detail}</div>
            </div>
            <div className="meta">{g.meta}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ToolkitTermsContent() {
  return (
    <>
      <p className="muted toolkit-terms-lede" style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5 }}>
        Handy terminology for the court — definitions from{' '}
        <a href={USTA_TERMS_CARD_URL} target="_blank" rel="noopener noreferrer">USTA · Tennis Terms & Words to Know</a>.
      </p>
      <dl className="toolkit-terms-list">
        {USTA_TERMS.map(([term, def], i) => (
          <div key={i} className="toolkit-terms-row">
            <dt className="toolkit-terms-term">{term}</dt>
            <dd className="toolkit-terms-def">{def}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

// ============== TOOLKIT ==============
function Toolkit() {
  const [seconds, setSeconds] = useS1(120);
  const [running, setRunning] = useS1(false);
  const [preset, setPreset] = useS1(120);
  const intervalRef = useR1(null);

  const [layout, setLayout] = useS1(loadToolkitLayout);
  const [draggingId, setDraggingId] = useS1(null);
  const [dropSlot, setDropSlot] = useS1(null);
  const dropSlotRef = useR1(null);
  const [resizingId, setResizingId] = useS1(null);
  const [containerWidth, setContainerWidth] = useS1(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const layoutRef = useR1(layout);
  const wrapRef = useR1(null);
  const dashboardRef = useR1(null);

  useE1(() => { layoutRef.current = layout; }, [layout]);
  useE1(() => { dropSlotRef.current = dropSlot; }, [dropSlot]);

  const getDashboardRect = React.useCallback(() => {
    const el = dashboardRef.current || wrapRef.current;
    return el ? el.getBoundingClientRect() : null;
  }, []);

  const gridConfig = useM1(() => getToolkitGridConfig(containerWidth), [containerWidth]);

  useE1(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const persistLayout = React.useCallback((next) => {
    try {
      localStorage.setItem(TOOLKIT_LAYOUT_STORAGE, JSON.stringify(next));
    } catch (e) { /* ignore */ }
  }, []);

  const updateLayout = React.useCallback((updater) => {
    setLayout((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      layoutRef.current = next;
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const ensureDashboardMode = React.useCallback(() => {
    if (layoutRef.current.mode === 'dashboard') return layoutRef.current;
    const wrap = wrapRef.current;
    if (!wrap || !TGL) return layoutRef.current;
    const next = captureGridAsDashboardItems(wrap, layoutRef.current, gridConfig);
    layoutRef.current = next;
    setLayout(next);
    persistLayout(next);
    return next;
  }, [gridConfig, persistLayout]);

  useE1(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else if (seconds === 0) {
      setRunning(false);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, seconds]);

  const setP = (s) => { setPreset(s); setSeconds(s); setRunning(false); };

  const gear = [
    { name: 'Racquet', detail: 'Restring every 40 hours · or # of weeks = string tension drop', meta: 'String log' },
    { name: 'Shoes', detail: 'Replace every 45-60 hours of court time', meta: 'Sole check' },
    { name: 'Balls', detail: 'New can after 9 sets of serious play — pressure drops fast', meta: 'Open date' },
    { name: 'Grip', detail: 'Overgrip every 4-6 sessions · base grip every 6 months', meta: 'Sweat test' },
    { name: 'Water + electrolytes', detail: '600ml per hour minimum on hot courts', meta: '2hr cap' },
  ];

  const dashboardLayout = useM1(() => {
    if (!TGL || layout.mode !== 'dashboard') return layout.items;
    if (!draggingId || !dropSlot) return layout.items;
    return TGL.applyDropSlot(layout.items, draggingId, dropSlot);
  }, [layout.mode, layout.items, draggingId, dropSlot]);

  const canvasHeight = useM1(() => {
    if (!TGL || layout.mode !== 'dashboard') return null;
    const preview = draggingId && dropSlot
      ? TGL.applyDropSlot(layout.items, draggingId, dropSlot)
      : layout.items;
    return TGL.calcContainerHeight(preview, gridConfig);
  }, [layout.mode, layout.items, draggingId, dropSlot, gridConfig]);

  const attachDrag = React.useCallback((cardId, ev) => {
    if (!TGL) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    const headerEl = ev.currentTarget;
    if (headerEl.setPointerCapture) headerEl.setPointerCapture(ev.pointerId);

    let current = layoutRef.current;
    if (current.mode === 'grid') {
      current = ensureDashboardMode();
    }

    const containerRect = getDashboardRect();
    const dragItem = getItemById(current.items, cardId);
    const initialSlot = { i: cardId, x: dragItem.x, y: dragItem.y, w: dragItem.w, h: dragItem.h };

    setDraggingId(cardId);
    setDropSlot(initialSlot);
    dropSlotRef.current = initialSlot;

    let rafId = null;
    let pendingSlot = null;

    const commitSlot = () => {
      rafId = null;
      if (!pendingSlot) return;
      setDropSlot(pendingSlot);
      dropSlotRef.current = pendingSlot;
      pendingSlot = null;
    };

    const scheduleCommit = () => {
      if (rafId) return;
      rafId = (typeof window !== 'undefined' && window.requestAnimationFrame)
        ? window.requestAnimationFrame(commitSlot)
        : commitSlot();
    };

    const onMove = (e) => {
      const rect = getDashboardRect();
      if (!rect) return;
      const slot = TGL.getDropSlot(layoutRef.current.items, cardId, e.clientX, e.clientY, rect, gridConfig);
      if (slot) {
        pendingSlot = slot;
        scheduleCommit();
      }
    };

    const onUp = () => {
      if (headerEl.releasePointerCapture) headerEl.releasePointerCapture(ev.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);

      if (rafId && typeof window !== 'undefined' && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      commitSlot();

      const slot = dropSlotRef.current || initialSlot;
      setLayout((prev) => {
        const placed = TGL.applyDropSlot(prev.items, cardId, slot);
        const compacted = TGL.compactVertical(placed, gridConfig.cols);
        const next = { ...prev, mode: 'dashboard', items: compacted };
        layoutRef.current = next;
        persistLayout(next);
        return next;
      });

      setDraggingId(null);
      setDropSlot(null);
      dropSlotRef.current = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [ensureDashboardMode, getDashboardRect, gridConfig, persistLayout]);

  const attachResize = React.useCallback((cardId, ev) => {
    if (!TGL) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const el = ev.currentTarget;
    if (el.setPointerCapture) el.setPointerCapture(ev.pointerId);

    if (layoutRef.current.mode === 'grid') {
      ensureDashboardMode();
    }

    const startItem = getItemById(layoutRef.current.items, cardId);
    const startX = ev.clientX;
    const startY = ev.clientY;
    const startW = startItem.w;
    const startH = startItem.h;

    setResizingId(cardId);

    const onMove = (e) => {
      const delta = TGL.pixelsDeltaToGrid(
        e.clientX - startX,
        e.clientY - startY,
        gridConfig,
        containerWidth
      );
      setLayout((prev) => {
        const resized = TGL.resizeItemGrid(
          prev.items,
          cardId,
          startW + delta.dw,
          startH + delta.dh,
          gridConfig.cols
        );
        const next = { ...prev, mode: 'dashboard', items: resized };
        layoutRef.current = next;
        return next;
      });
    };

    const onUp = () => {
      if (el.releasePointerCapture) el.releasePointerCapture(ev.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      setLayout((prev) => {
        const compacted = TGL.compactVertical(prev.items, gridConfig.cols);
        const next = { ...prev, items: compacted };
        layoutRef.current = next;
        persistLayout(next);
        return next;
      });
      setResizingId(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }, [containerWidth, ensureDashboardMode, gridConfig, persistLayout]);

  const toggleExpand = React.useCallback((cardId) => {
    updateLayout((prev) => {
      const items = prev.items.map((item) => {
        if (item.i !== cardId) return item;
        const expanded = !item.expanded;
        const h = expanded ? TERMS_GRID_H_EXPANDED : TERMS_GRID_H;
        return { ...item, expanded, h };
      });
      const compacted = TGL ? TGL.compactVertical(items, gridConfig.cols) : items;
      return { ...prev, items: compacted };
    });
  }, [gridConfig.cols, updateLayout]);

  const renderCardContent = (id) => {
    switch (id) {
      case 'timer':
        return (
          <ToolkitTimerContent
            seconds={seconds}
            running={running}
            preset={preset}
            setP={setP}
            setRunning={setRunning}
            setSeconds={setSeconds}
          />
        );
      case 'conditions':
        return <ToolkitConditionsContent />;
      case 'gear':
        return <ToolkitGearContent gear={gear} />;
      case 'terms':
        return <ToolkitTermsContent />;
      default:
        return null;
    }
  };

  const placeholderStyle = useM1(() => {
    if (!TGL || !dropSlot || layout.mode !== 'dashboard') return null;
    return TGL.calcPosition(dropSlot, gridConfig, containerWidth);
  }, [dropSlot, layout.mode, gridConfig, containerWidth]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Toolkit · Bonus utilities</div>
          <h1>Everything <em>else</em> you need.</h1>
        </div>
        <div className="meta">Drag to rearrange · Expand terms for full glossary</div>
      </div>

      <div
        ref={wrapRef}
        className={`toolkit-grid-wrap${layout.mode === 'dashboard' ? ' is-dashboard-mode' : ''}${draggingId ? ' is-dragging-active' : ''}${resizingId ? ' is-resizing-active' : ''}`}
      >
        <div
          ref={dashboardRef}
          className={layout.mode === 'dashboard' ? 'toolkit-dashboard' : 'toolkit-grid'}
          style={layout.mode === 'dashboard' && canvasHeight ? { height: canvasHeight } : undefined}
        >
          {layout.mode === 'dashboard' && placeholderStyle && draggingId && (
            <div
              className="toolkit-panel-placeholder"
              style={{
                left: placeholderStyle.left,
                top: placeholderStyle.top,
                width: placeholderStyle.width,
                height: placeholderStyle.height,
              }}
              aria-hidden="true"
            />
          )}
          {(layout.mode === 'dashboard' ? dashboardLayout : layout.items).map((item) => {
            const pixelStyle = layout.mode === 'dashboard' && TGL
              ? TGL.calcPosition(item, gridConfig, containerWidth)
              : null;
            return (
              <ToolkitPanel
                key={item.i}
                id={item.i}
                title={TOOLKIT_CARD_TITLES[item.i]}
                mode={layout.mode}
                item={item}
                pixelStyle={pixelStyle}
                isDragging={draggingId === item.i}
                showExpand={item.i === 'terms'}
                expanded={!!item.expanded}
                onDragStart={attachDrag}
                onResizeStart={attachResize}
                onToggleExpand={toggleExpand}
              >
                {renderCardContent(item.i)}
              </ToolkitPanel>
            );
          })}
        </div>
      </div>
    </>
  );
}

window.Today = Today;
window.Tips = Tips;
window.GameCheatNotes = GameCheatNotes;
window.Calendar = Calendar;
window.Toolkit = Toolkit;
