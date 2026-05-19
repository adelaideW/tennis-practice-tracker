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
      const iso = d.toISOString().slice(0,10);
      const done = state.entries.some(e => e.date.slice(0,10) === iso);
      out.push({
        d: d.getDate(),
        l: d.toLocaleDateString('en-US', { weekday: 'short' }),
        done,
        isToday: iso === today.toISOString().slice(0,10),
        future: d.toISOString().slice(0,10) > today.toISOString().slice(0,10),
      });
    }
    return out;
  }, [state.entries]);

  const totalSessions = state.entries.length;
  const totalMinutes = state.entries.reduce((a, e) => a + (e.duration || 60), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const streak = useM1(() => {
    if (!state.entries.length) return 0;
    let s = 0;
    let probe = new Date(today.toISOString().slice(0,10) + 'T00:00:00');
    const days = new Set(state.entries.map(e => e.date.slice(0,10)));
    while (days.has(probe.toISOString().slice(0,10))) {
      s++; probe.setDate(probe.getDate() - 1);
    }
    if (s === 0) {
      probe.setDate(probe.getDate() - 1);
      // tolerate one day gap (yesterday)
      let probe2 = new Date(today); probe2.setDate(probe2.getDate() - 1);
      while (days.has(probe2.toISOString().slice(0,10))) {
        s++; probe2.setDate(probe2.getDate() - 1);
      }
    }
    return s;
  }, [state.entries]);

  const [loading, setLoading] = useS1(false);
  const focus = state.focus;

  const generateFocus = async () => {
    if (!state.entries.length) {
      setFocus({
        headline: 'First session — start with the basics',
        bullets: [
          'Spend 10 minutes on warm-up rallies, hitting past the service line on every ball.',
          'Pick ONE technical cue today — your tip card below has one ready.',
          'Track your session in the Practice Log when you finish.',
        ],
        when: new Date().toISOString(),
      });
      return;
    }
    setLoading(true);
    const ctx = state.entries.slice(0, 6).map(e => {
      const tagLabels = (e.tags || [])
        .map(k => (PRACTICE_TAGS.find(p => p.k === k) || {}).l)
        .filter(Boolean).join(', ');
      const dt = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `Session ${dt} (intensity ${e.intensity || '?'}/5, ${e.duration || 60}min): worked on ${tagLabels || 'general practice'}.${e.notes ? ` Notes: "${e.notes}"` : ''}`;
    }).join('\n');

    const prompt = `You are a thoughtful tennis coach for an amateur player. Below are the player's recent practice sessions. Write a short, focused brief for them to read BEFORE their next session. Be specific, warm, and direct — like a coach who knows them.

Recent sessions:
${ctx}

Respond with a JSON object only (no markdown fence), with these fields:
- "headline": a short italic-style focus line (under 12 words), like a mantra
- "bullets": an array of 3 concrete things to focus on today, each under 22 words, drawing on patterns from the sessions

Example:
{"headline":"Today is about depth, not power.","bullets":["...","...","..."]}`;

    try {
      const res = await window.claude.complete(prompt);
      const cleaned = res.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      setFocus({ ...parsed, when: new Date().toISOString() });
    } catch (e) {
      setFocus({
        headline: 'Stay loose, hit deep, breathe out on contact.',
        bullets: [
          'Pick one technical cue from your last entry and commit to it for the first 20 minutes.',
          'Get to your split-step before every ball — feet first, hands second.',
          'No score tracking today — quality of contact over outcome.',
        ],
        when: new Date().toISOString(),
        fallback: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="kicker">{todayStr}</div>
          <h1>Good <em>practice.</em></h1>
        </div>
        <div className="meta">
          {state.entries.length === 0
            ? <span>No sessions yet · log your first below</span>
            : <span>Last session<br/>{new Date(state.entries[0].date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
        </div>
      </div>

      <div className="today-grid">
        <div className="focus-card">
          <div className="ball-deco" aria-hidden="true"></div>
          <div className="kicker">Today's Focus</div>
          {focus ? (
            <>
              <h2>"{focus.headline}"</h2>
              <div className="focus-body">
                <ul>
                  {focus.bullets.map((b,i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
              <div className="focus-cta">
                <button className="btn-primary" onClick={() => setRoute('log')}>Log a session</button>
                <button className="btn-ghost" onClick={generateFocus} disabled={loading}>
                  {loading ? <><span className="spinner"></span>Re-thinking…</> : 'Regenerate'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>"What did the last session teach you?"</h2>
              <div className="focus-body">
                Tap below and I'll build today's focus by reading your recent practice log. The more sessions you log, the sharper the brief gets.
              </div>
              <div className="focus-cta">
                <button className="btn-primary" onClick={generateFocus} disabled={loading}>
                  {loading ? <><span className="spinner"></span>Thinking…</> : 'Generate today\'s focus'}
                </button>
                <button className="btn-ghost" onClick={() => setRoute('tips')}>Browse tips</button>
              </div>
            </>
          )}
        </div>

        <div className="stat-stack">
          <div className="stat">
            <span className="num">{streak}</span>
            <span className="lbl">Day Streak<span className="sub">{streak > 0 ? 'Keep it alive' : 'Start today'}</span></span>
          </div>
          <div className="stat">
            <span className="num">{totalSessions}</span>
            <span className="lbl">Sessions logged<span className="sub">{totalHours} hours total</span></span>
          </div>
          <div className="stat">
            <span className="num">{state.entries.filter(e => (e.tags||[]).includes('serve')).length}</span>
            <span className="lbl">Serve days<span className="sub">{state.entries.filter(e => (e.tags||[]).includes('volley')).length} volley · {state.entries.filter(e => (e.tags||[]).includes('point')).length} match</span></span>
          </div>
        </div>
      </div>

      <h3 className="section-title mt-20" style={{marginTop: 32}}>This Week</h3>
      <div className="week-strip">
        {week.map((w,i) => (
          <div key={i} className={`day-cell ${w.done ? 'done' : ''} ${w.isToday ? 'today' : ''} ${w.future ? 'rest' : ''}`}>
            {w.l}
            <span className="d">{w.d}</span>
            {w.done ? 'practiced' : w.future ? 'upcoming' : w.isToday ? 'today' : 'rest'}
          </div>
        ))}
      </div>

      <h3 className="section-title" style={{marginTop: 32}}>Quick Drill — Pick One</h3>
      <div className="tip-grid">
        {[
          { cat: 'groundstrokes', i: 0 },
          { cat: 'volley', i: 0 },
          { cat: 'mental', i: 1 },
          { cat: 'overhead', i: 0 },
        ].map(({cat, i}) => {
          const t = TIPS[cat].items[i];
          return (
            <div key={cat} className="tip-card">
              <span className="num">{TIPS[cat].title}</span>
              <h4>{t.h}</h4>
              <p>{t.p}</p>
              <div className="drill"><b>Drill →</b> {t.drill}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.Today = Today;
