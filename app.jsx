/* global React */
const { useState, useEffect, useMemo, useRef } = React;

// ============== DATA ==============
const TIPS = {
  groundstrokes: {
    title: 'Ground Strokes',
    blurb: 'The bread and butter. Build a rally engine that holds up under pressure with depth, shape, and recovery.',
    items: [
      { h: 'Hit the back fence on warm-up', p: 'Spend the first 10 minutes aiming everything 3 feet inside the baseline. Depth is the most undertrained shot at the amateur level — it buys you time and pushes your opponent back.', drill: '10-Ball Depth — 10 in a row past service line' },
      { h: 'Load, don\'t arm it', p: 'Power comes from the legs and core, not the arm. Bend the back knee, turn the hips, then let the racquet lag behind before unloading. If your shoulder is sore tomorrow, you swung with the wrong muscles.', drill: 'Shadow swings — 20 reps with eyes closed' },
      { h: 'Recover behind the baseline', p: 'After every shot, split-step a half-meter behind the line. Camping on the baseline is how unforced errors happen — you have less time to read the ball.', drill: 'Cross-court rally + tap the back curtain each shot' },
      { h: 'Heavy crosscourt, flat down-the-line', p: 'Crosscourt has more court — load it with topspin. Down-the-line is shorter — flatten it out and aim 4 feet inside the sideline. Mixing shapes is what separates 3.5s from 4.0s.', drill: '8-ball pattern: 3 CC topspin → 1 DTL flat' },
      { h: 'Hit through, not at, the ball', p: 'Pick a target 3 feet beyond contact and swing toward it. The ball is on your strings for less than 5 milliseconds — you can\'t steer it, you can only direct your swing path.', drill: 'Cone target drill — extend through to a cone' },
      { h: 'Backhand = front shoulder', p: 'For one-handers and two-handers alike, the front shoulder finishes pointing at your target. If your shoulders open early, you spray balls wide.', drill: 'Closed-stance backhand reps, 25 each side' },
    ],
  },
  volley: {
    title: 'Volley',
    blurb: 'Net play wins points the modern baseliner never sees coming. Punch, don\'t swing.',
    items: [
      { h: 'Punch, don\'t swing', p: 'A volley is a short, firm jab — no backswing. If your racquet goes behind your ear, you\'re late and the ball is going long. Imagine catching the ball with the strings.', drill: 'No-backswing volley — partner feeds, you punch' },
      { h: 'Get the racquet up before the split-step', p: 'At the net, the racquet head should be at eye level before your opponent contacts the ball. Reaction time is brutal up there; you can\'t prepare AND react.', drill: 'Ready-position holds — coach calls "now," you volley' },
      { h: 'Slight slice on every volley', p: 'A continental grip with a slight open face creates underspin that floats the ball low and keeps it from sitting up. Pure flat volleys often launch.', drill: 'Bounce-it-twice drill — make the volley die' },
      { h: 'Move forward through the shot', p: 'A planted volley is a defensive volley. Step into the ball with your opposite foot — the body weight does the work, not the arm.', drill: 'Approach-volley-volley pattern, 10 sets' },
      { h: 'Low ball = bend knees, not the back', p: 'When the ball is at your shoetops, get your eyes at ball-level. Bending at the waist sends low volleys into the net every time.', drill: 'Knee-bend volleys — touch knee with non-dom hand' },
      { h: 'Drop volley needs a soft grip', p: 'Loosen your grip to about 3/10 right at contact to absorb pace. Stiff hands = popped-up sitter for your opponent.', drill: 'Drop volleys into the service box, 8 in a row' },
    ],
  },
  overhead: {
    title: 'Overhead',
    blurb: 'The shot that finishes points — or loses them dramatically. Footwork first, swing second.',
    items: [
      { h: 'Point at the ball with your off-hand', p: 'As soon as you read the lob, get the non-dominant arm up and point at the ball. This loads the shoulder turn and tracks the ball — pros do it on every smash.', drill: 'Lob feeds — finger always on the ball' },
      { h: 'Sidestep, never backpedal', p: 'Backpedaling is how you sprain an ankle. Turn sideways and shuffle back so you stay balanced and can push UP into the shot.', drill: 'Cone shuffle — coach lobs, you sidestep then smash' },
      { h: 'Contact ball in front, not over head', p: 'Most missed overheads come from letting the ball drift behind. Strike it slightly in front of your hitting shoulder — like you\'re serving.', drill: 'Tossed overheads — catch the ball if it\'s behind' },
      { h: 'Bounce it if it\'s a deep lob', p: 'On any lob that\'s pushing you past the baseline, let it bounce. The ball slows down and you reset the point — way better than a desperate jump-smash.', drill: 'Decision drill — call "hit" or "bounce" on each lob' },
      { h: 'Pronate at contact', p: 'Snap the wrist and rotate the forearm just like a serve. This adds pace and angle. Without pronation you\'re just patting the ball.', drill: 'Serve-motion smashes — 20 reps focusing on snap' },
      { h: 'Aim for the open court, not the line', p: 'Don\'t be a hero. 80% pace into the open court wins more points than 100% pace painting a sideline.', drill: 'Smash to cones placed 4ft inside the lines' },
    ],
  },
  mental: {
    title: 'Mental Strategy',
    blurb: 'The match between your ears. What pros call "the inner game" — and amateurs ignore at their peril.',
    items: [
      { h: 'Have one cue word per point', p: 'Pick a word before each point — "loose," "early," "deep" — and say it under your breath. It narrows focus and starves the noisy inner critic.', drill: 'Practice match — one cue word per point, all set' },
      { h: 'The 16-second routine between points', p: 'Walk away, breathe, plan, then approach. Pros use the towel and string-pluck as anchors. Rushing between points is how 40-15 becomes deuce.', drill: 'Time yourself: 4s release, 8s plan, 4s ritual' },
      { h: 'Play patterns, not points', p: 'Have 2-3 favorite patterns ("serve wide-deuce, forehand into open court"). When tight, fall back on patterns — your brain doesn\'t have to decide mid-point.', drill: 'Play a set: every point must start with your pattern' },
      { h: 'Lose the point in 3 seconds', p: 'After an error, you get 3 seconds of frustration. Then it\'s gone. The point you\'re about to play is the only one that matters — the last one is unfixable.', drill: 'Snap fingers after every error to reset' },
      { h: 'Win the next point after a winner', p: 'Letdown after a great shot is the most common amateur leak. Stay locked in — the next point is when opponents try to steal momentum back.', drill: 'Track post-winner points in your next match' },
      { h: 'Breathe out on contact', p: 'Audible exhale on every strike — even Federer does it. It releases tension in the shoulder and stabilizes your contact under pressure.', drill: 'Loud exhale rally — 50 balls, every one vocal' },
      { h: 'Stop trying to win — play to commit', p: 'The athletes who choke are the ones thinking about the scoreboard. Commit to one shot at a time. Outcome will follow process.', drill: 'Mental scrimmage — 30 minutes, no score tracked' },
    ],
  },
};

const PRACTICE_TAGS = [
  { k: 'warmup', l: 'Warm-up + Dynamic Stretch', est: '10 min' },
  { k: 'ground', l: 'Ground Strokes', est: '25 min' },
  { k: 'volley', l: 'Volleys', est: '15 min' },
  { k: 'overhead', l: 'Overheads', est: '10 min' },
  { k: 'serve', l: 'Serves', est: '20 min' },
  { k: 'return', l: 'Return of Serve', est: '10 min' },
  { k: 'footwork', l: 'Footwork / Ladder', est: '10 min' },
  { k: 'point', l: 'Point Play / Match Sets', est: '30 min' },
  { k: 'mental', l: 'Mental Reps (visualization)', est: '5 min' },
  { k: 'cool', l: 'Cool-down + Hydration', est: '5 min' },
];

const INTENSITY = ['Easy', 'Light', 'Moderate', 'Hard', 'All-out'];

// 2026 calendar — Grand Slams + Masters 1000 (stable annual fixtures)
const CALENDAR_2026 = [
  { m: 'Jan', d: '19—Feb 1', name: 'Australian Open', meta: 'Melbourne · Hard · Grand Slam', state: 'done' },
  { m: 'Feb', d: '24—Mar 1', name: 'Dubai / Acapulco / Santiago', meta: 'ATP 500 swing', state: 'done' },
  { m: 'Mar', d: '04—15', name: 'Indian Wells Masters', meta: 'BNP Paribas · Hard · 1000', state: 'done' },
  { m: 'Mar', d: '18—29', name: 'Miami Open', meta: 'Hard · Masters 1000', state: 'done' },
  { m: 'Apr', d: '11—19', name: 'Monte-Carlo Masters', meta: 'Clay · Masters 1000', state: 'done' },
  { m: 'Apr', d: '25—May 3', name: 'Madrid Open', meta: 'Clay · Masters 1000', state: 'done' },
  { m: 'May', d: '06—17', name: 'Italian Open · Rome', meta: 'Foro Italico · Clay · 1000', state: 'done', highlight: true },
  { m: 'May', d: '24—Jun 7', name: 'Roland-Garros', meta: 'Paris · Clay · Grand Slam', state: 'live' },
  { m: 'Jun', d: '15—21', name: 'Queen\'s Club / Halle', meta: 'Grass · ATP 500', state: 'up' },
  { m: 'Jun', d: '29—Jul 12', name: 'Wimbledon', meta: 'London · Grass · Grand Slam', state: 'up' },
  { m: 'Aug', d: '02—09', name: 'Canadian Open · Toronto', meta: 'Hard · Masters 1000', state: 'up' },
  { m: 'Aug', d: '10—16', name: 'Cincinnati Open', meta: 'Hard · Masters 1000', state: 'up' },
  { m: 'Aug', d: '31—Sep 13', name: 'US Open', meta: 'New York · Hard · Grand Slam', state: 'up' },
  { m: 'Oct', d: '07—13', name: 'Shanghai Masters', meta: 'Hard · Masters 1000', state: 'up' },
  { m: 'Oct', d: '26—Nov 1', name: 'Paris Masters', meta: 'Indoor Hard · 1000', state: 'up' },
  { m: 'Nov', d: '08—15', name: 'ATP Finals · Turin', meta: 'Year-end · Indoor', state: 'up' },
];

// Sample recent stories — clearly framed as "feed" to make the refresh button feel earned
const SEED_NEWS = [
  { when: 'May 17', t: 'Rome Open wraps on the Foro Italico clay', d: 'Final-weekend storylines closed out a packed two weeks of high-quality clay-court tennis heading into Roland-Garros.' },
  { when: 'May 16', t: 'Roland-Garros draw ceremony approaches', d: 'Seedings for the year\'s second Grand Slam will be confirmed this week; main draw begins Sun May 24.' },
  { when: 'May 15', t: 'Clay swing form guide', d: 'Players who reached the late rounds in Monte-Carlo, Madrid, and Rome historically convert at a higher rate in Paris.' },
  { when: 'May 12', t: 'Wimbledon qualifying schedule released', d: 'Roehampton qualifying will run Jun 22—26 ahead of the Championships starting Jun 29.' },
];

// ============== STATE ==============
function loadState() {
  try {
    const raw = localStorage.getItem('tennis-tracker-v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
function saveState(s) {
  try { localStorage.setItem('tennis-tracker-v1', JSON.stringify(s)); } catch (e) {}
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#E6D04A",
  "density": "comfy"
}/*EDITMODE-END*/;

const ACCENT_PALETTE = {
  '#E6D04A': { color: 'oklch(0.88 0.16 110)', deep: 'oklch(0.78 0.18 105)', name: 'Ball' },
  '#B95E3B': { color: 'oklch(0.58 0.13 35)',  deep: 'oklch(0.50 0.13 35)',  name: 'Clay' },
  '#4F7656': { color: 'oklch(0.45 0.08 150)', deep: 'oklch(0.38 0.08 150)', name: 'Court' },
};

// ============== APP ==============
function App() {
  const [route, setRoute] = useState('today');
  const [state, setState] = useState(() => loadState() || {
    entries: [],
    streak: 0,
    lastSession: null,
    focus: null,
  });
  const t = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const [tweaks, setTweak] = t;

  useEffect(() => { saveState(state); }, [state]);

  // Apply accent tweak
  useEffect(() => {
    const root = document.documentElement;
    const pal = ACCENT_PALETTE[tweaks.accent] || ACCENT_PALETTE['#E6D04A'];
    root.style.setProperty('--ball', pal.color);
    root.style.setProperty('--ball-deep', pal.deep);
  }, [tweaks.accent]);

  const NAV_ICONS = {
    today: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </>
    ),
    tips: <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>,
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </>
    ),
    log: (
      <>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </>
    ),
    toolkit: <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>,
  };
  const pages = {
    today:    { l: 'Today' },
    tips:     { l: 'Practice Tips' },
    calendar: { l: 'Calendar & News' },
    log:      { l: 'Practice Log' },
    toolkit:  { l: 'Toolkit' },
  };

  const addEntry = (entry) => {
    const e = { ...entry, id: Date.now(), date: new Date().toISOString() };
    setState(s => ({ ...s, entries: [e, ...s.entries], lastSession: e.date }));
  };
  const deleteEntry = (id) => setState(s => ({ ...s, entries: s.entries.filter(e => e.id !== id) }));
  const setFocus = (focus) => setState(s => ({ ...s, focus }));

  return (
    <div className="app" data-screen-label={`00 ${pages[route].l}`}>
      <aside className="rail">
        <div className="brand" title="Baseline" aria-label="Baseline"></div>

        <nav className="nav">
          {Object.entries(pages).map(([k, p]) => (
            <button key={k}
              className={`nav-item ${route === k ? 'active' : ''}`}
              onClick={() => setRoute(k)}
              aria-label={p.l}>
              <svg viewBox="0 0 24 24">{NAV_ICONS[k]}</svg>
              <span>{p.l}</span>
            </button>
          ))}
        </nav>

        <div className="foot">
          <div className="foot-row">Stored locally</div>
          <div className="foot-row">{state.entries.length} sessions logged</div>
        </div>
      </aside>

      <main className="content" data-screen-label={pages[route].l}>
        {route === 'today' && <window.Today state={state} setRoute={setRoute} setFocus={setFocus} />}
        {route === 'tips' && <window.Tips />}
        {route === 'calendar' && <window.Calendar />}
        {route === 'log' && <window.Log state={state} addEntry={addEntry} deleteEntry={deleteEntry} />}
        {route === 'toolkit' && <window.Toolkit />}
      </main>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Aesthetic">
            <window.TweakColor
              label="Accent color"
              value={tweaks.accent}
              options={['#E6D04A', '#B95E3B', '#4F7656']}
              onChange={(v) => setTweak('accent', v)}
            />
            <window.TweakRadio
              label="Density"
              value={tweaks.density}
              options={['comfy', 'compact']}
              onChange={(v) => setTweak('density', v)}
            />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
}

window.App = App;
