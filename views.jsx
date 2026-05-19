/* global React, PRACTICE_TAGS, INTENSITY, TIPS, CALENDAR_2026, SEED_NEWS */
const { useState: useS1, useMemo: useM1, useEffect: useE1, useRef: useR1 } = React;

// ============== TODAY / DASHBOARD ==============
function Today({ state, setRoute, setFocus }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const week = useM1(() => {
    const out = [];
    const d0 = new Date(today);
    const day = d0.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    d0.setDate(d0.getDate() + offset);
    for (let i = 0; i < 7; i++) {
      const d = new Date(d0); d.setDate(d0.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const done = state.entries.some(e => e.date.slice(0, 10) === iso);
      out.push({
        d: d.getDate(),
        l: d.toLocaleDateString('en-US', { weekday: 'short' }),
        done,
        isToday: iso === today.toISOString().slice(0, 10),
      });
    }
    return out;
  }, [state.entries]);

  const totalSessions = state.entries.length;
  const totalMinutes = state.entries.reduce((a, e) => a + (e.duration || 60), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const streak = useM1(() => {
    const days = new Set(state.entries.map(e => e.date.slice(0, 10)));
    if (!days.size) return 0;
    let s = 0;
    let probe = new Date();
    while (days.has(probe.toISOString().slice(0, 10))) {
      s++; probe.setDate(probe.getDate() - 1);
    }
    return s;
  }, [state.entries]);

  const [loading, setLoading] = useS1(false);
  const focus = state.focus;

  const generateFocus = async () => {
    if (!state.entries.length) {
      setFocus({
        cues: ['Loose grip, audible exhale on contact', 'Recover one step behind the baseline', 'One cue word per point'],
        body: 'No sessions logged yet — start with a clean warm-up. Focus on hitting your first 20 balls 3 feet inside the baseline before opening up the pace.',
        generated: new Date().toISOString(),
      });
      return;
    }
    setLoading(true);
    try {
      const recent = state.entries.slice(0, 6).map(e => {
        const tagLabels = (e.tags || []).map(k => (PRACTICE_TAGS.find(p => p.k === k) || {}).l).filter(Boolean).join(', ');
        return `Date: ${e.date.slice(0, 10)} · Intensity: ${e.intensity || 'n/a'} · Worked on: ${tagLabels} · Notes: ${e.notes || '(none)'}`;
      }).join('\n');
      const prompt = `You are a tennis coach analyzing a player's recent practice journal. Based on the entries below, write a SHORT pre-session focus brief (max 90 words).

Output format — return ONLY valid JSON, no markdown fence:
{"body": "1-2 sentences of context on what to focus on today based on recent patterns", "cues": ["short imperative cue 1", "short imperative cue 2", "short imperative cue 3"]}

Cues must be punchy imperatives, max 10 words each. Tone: a sharp, encouraging coach. No filler.

Recent entries:
${recent}`;
      const txt = await window.claude.complete(prompt);
      let parsed;
      try { parsed = JSON.parse(txt.replace(/```json|```/g, '').trim()); }
      catch (e) { parsed = { body: txt, cues: [] }; }
      setFocus({ ...parsed, generated: new Date().toISOString() });
    } catch (e) {
      setFocus({
        body: 'Could not generate brief right now. Pick one cue word for the session and commit to it on every point.',
        cues: ['Stay loose', 'Watch contact', 'Recover behind baseline'],
        generated: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">{todayStr}</div>
          <h1>Good day for <em>tennis.</em></h1>
        </div>
        <div className="meta">
          {streak > 0 ? `${streak}-day streak` : 'No active streak'}<br />
          {totalSessions} sessions logged
        </div>
      </div>

      <div className="today-grid mb-28">
        <div className="focus-card">
          <div className="ball-deco" aria-hidden="true"></div>
          <div className="kicker">Today's Focus · AI brief</div>
          <h2>{focus ? '"' + (focus.cues?.[0] || 'Stay loose and present') + '"' : 'Generate your focus brief'}</h2>
          <div className="focus-body">
            {focus ? (
              <>
                <div>{focus.body}</div>
                {focus.cues?.length > 0 && (
                  <ul>
                    {focus.cues.slice(0, 4).map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}
              </>
            ) : (
              <div>Generate a personalized focus brief based on your recent practice notes. Three cues to lock in before you step on court.</div>
            )}
          </div>
          <div className="focus-cta">
            <button className="btn-primary" onClick={generateFocus} disabled={loading}>
              {loading && <span className="spinner"></span>}
              {focus ? 'Regenerate' : 'Generate brief'}
            </button>
            <button className="btn-ghost" onClick={() => setRoute('log')}>Log a session →</button>
          </div>
        </div>

        <div className="stat-stack">
          <div className="stat">
            <div className="num">{totalSessions}</div>
            <div className="lbl">Sessions <span className="sub">all-time</span></div>
          </div>
          <div className="stat">
            <div className="num">{totalHours}</div>
            <div className="lbl">Hours <span className="sub">on court</span></div>
          </div>
          <div className="stat">
            <div className="num">{streak}</div>
            <div className="lbl">Day streak <span className="sub">{streak > 0 ? 'keep it going' : 'play today'}</span></div>
          </div>
        </div>
      </div>

      <div className="section-title">This week</div>
      <div className="week-strip mb-28">
        {week.map((w, i) => (
          <div key={i} className={`day-cell ${w.done ? 'done' : ''} ${w.isToday ? 'today' : ''}`}>
            <span>{w.l}</span>
            <span className="d">{w.d}</span>
            <span>{w.done ? 'Played' : '—'}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Quick links</div>
      <div className="today-grid">
        <div className="card" style={{cursor: 'pointer'}} onClick={() => setRoute('tips')}>
          <h3>Practice Tips →</h3>
          <p className="muted" style={{margin: 0}}>26 coach-grade tips across volleys, overheads, ground strokes & the mental game.</p>
        </div>
        <div className="card" style={{cursor: 'pointer'}} onClick={() => setRoute('calendar')}>
          <h3>Tour Calendar →</h3>
          <p className="muted" style={{margin: 0}}>Grand Slams, Masters 1000s, Rome results & Roland-Garros live tracker.</p>
        </div>
      </div>
    </>
  );
}

// ============== TIPS ==============
function Tips() {
  const [cat, setCat] = useS1('groundstrokes');
  const order = ['groundstrokes', 'volley', 'overhead', 'mental'];
  const data = TIPS[cat];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Practice Library · 26 tips</div>
          <h1>Sharpen <em>the craft.</em></h1>
        </div>
        <div className="meta">Updated for<br />2026 season</div>
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
          <div key={i} className="tip-card">
            <div className="num">No. {String(i + 1).padStart(2, '0')}</div>
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
                        <a className="tourney-link" href={ytUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{color:'#cc0000', background:'rgba(255,0,0,0.06)', borderColor:'rgba(255,0,0,0.18)'}}>
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

// ============== PRACTICE LOG ==============
function Log({ state, addEntry, deleteEntry }) {
  const [tags, setTags] = useS1([]);
  const [intensity, setIntensity] = useS1(2);
  const [duration, setDuration] = useS1(60);
  const [notes, setNotes] = useS1('');
  const [aiSummary, setAiSummary] = useS1(null);
  const [aiLoading, setAiLoading] = useS1(false);

  const toggle = (k) => {
    setTags(t => t.includes(k) ? t.filter(x => x !== k) : [...t, k]);
  };

  const submit = () => {
    if (!tags.length && !notes.trim()) return;
    addEntry({ tags, intensity, duration, notes });
    setTags([]); setNotes(''); setIntensity(2); setDuration(60);
  };

  const generateSummary = async () => {
    if (!state.entries.length) return;
    setAiLoading(true);
    try {
      const recent = state.entries.slice(0, 10).map((e, i) => {
        const tagLabels = (e.tags || []).map(k => (PRACTICE_TAGS.find(p => p.k === k) || {}).l).filter(Boolean).join(', ');
        return `[${i + 1}] ${e.date.slice(0, 10)} · ${INTENSITY[e.intensity] || 'Moderate'} intensity · Worked on: ${tagLabels} · Notes: "${e.notes || '(no notes)'}"`;
      }).join('\n');
      const prompt = `You are a tennis coach reviewing a player's recent practice journal. Write a 110-150 word AI summary in this exact structure:

PATTERN: One paragraph identifying what they've been practicing most and any patterns you notice in their notes.

WATCH-OUT: One sentence calling out a weakness or area being neglected.

NEXT SESSION FOCUS: 2-3 specific things to lock in before their next practice — punchy, imperative.

Tone: experienced coach, direct, encouraging. Use plain text only, no markdown.

Recent entries (newest first):
${recent}`;
      const txt = await window.claude.complete(prompt);
      setAiSummary(txt);
    } catch (e) {
      setAiSummary('Could not generate summary right now. Try again in a moment.');
    } finally { setAiLoading(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Practice Log · {state.entries.length} entries</div>
          <h1>What did you <em>work on?</em></h1>
        </div>
        <div className="meta">Auto-saved<br />to this device</div>
      </div>

      <div className="log-grid mb-28">
        <div className="card">
          <div className="section-title" style={{margin: '0 0 14px'}}>Today's Checklist</div>
          <div className="checklist">
            {PRACTICE_TAGS.map(t => (
              <div
                key={t.k}
                className={`check ${tags.includes(t.k) ? 'on' : ''}`}
                onClick={() => toggle(t.k)}
              >
                <div className="box"></div>
                <div className="lab">{t.l}</div>
                <div className="ct">{t.est}</div>
              </div>
            ))}
          </div>

          <div className="mt-20">
            <div className="intensity-row">
              <span className="lab">Intensity</span>
              {INTENSITY.map((iv, i) => (
                <div
                  key={i}
                  className={`pip ${intensity === i ? 'on' : ''}`}
                  onClick={() => setIntensity(i)}
                >{iv}</div>
              ))}
            </div>
            <div className="row gap-8 mb-12" style={{alignItems: 'center'}}>
              <span className="mono-small">Duration</span>
              <input
                type="range"
                min="15" max="180" step="5"
                value={duration}
                onChange={e => setDuration(+e.target.value)}
                style={{flex: 1}}
              />
              <span className="mono-small" style={{minWidth: 60, textAlign: 'right', color: 'var(--ink)'}}>{duration} min</span>
            </div>
          </div>

          <textarea
            className="notes mt-12"
            placeholder="How did it feel? What worked, what didn't? Anything to remember for next time..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />

          <div className="row gap-8 mt-12">
            <button className="btn-primary" onClick={submit}>Save session</button>
            <button className="btn-secondary" onClick={() => { setTags([]); setNotes(''); }}>Clear</button>
          </div>
        </div>

        <div>
          <div className="ai-card mb-20">
            <div className="kicker">AI Coach · Pre-Session Brief</div>
            <h3>What to focus on next time</h3>
            {aiSummary ? (
              <div className="summary">{aiSummary}</div>
            ) : (
              <div className="empty">
                {state.entries.length === 0
                  ? 'Log a few sessions first — the AI coach reads your notes to surface patterns and recommend next-session focus.'
                  : 'Click below to analyze your recent notes and generate a focused brief for your next practice.'}
              </div>
            )}
            <button
              className="btn-primary mt-12"
              onClick={generateSummary}
              disabled={aiLoading || !state.entries.length}
              style={{background: 'var(--clay)', borderColor: 'var(--clay)'}}
            >
              {aiLoading && <span className="spinner" style={{borderColor: 'white', borderTopColor: 'transparent'}}></span>}
              {aiSummary ? 'Regenerate brief' : 'Generate AI brief'}
            </button>
          </div>

          <div className="section-title">Recent Sessions</div>
          {state.entries.length === 0 ? (
            <div className="card" style={{textAlign: 'center', padding: '32px 20px', color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 16}}>
              No sessions yet. Save your first one to start a streak.
            </div>
          ) : (
            state.entries.slice(0, 5).map(e => (
              <div key={e.id} className="entry">
                <div className="when">
                  <span className="dot"></span>
                  {new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  · {INTENSITY[e.intensity] || 'Moderate'}
                  · {e.duration || 60} min
                  <button
                    onClick={() => deleteEntry(e.id)}
                    style={{marginLeft: 'auto', background: 'none', border: 0, color: 'var(--ink-3)', cursor: 'pointer', fontSize: 11}}
                  >× delete</button>
                </div>
                <div className="what">
                  {(e.tags || []).map(k => {
                    const t = PRACTICE_TAGS.find(p => p.k === k);
                    return t ? <span key={k} className="tag">{t.l}</span> : null;
                  })}
                </div>
                {e.notes && <div className="note">{e.notes}</div>}
              </div>
            ))
          )}
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
window.Log = Log;
window.Toolkit = Toolkit;
