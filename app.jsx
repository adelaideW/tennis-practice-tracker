/* global React */
const { useState, useEffect, useMemo, useRef } = React;

// ============== DATA ==============
/** Synced from Notion: Tennis practice insights */
const NOTION_INSIGHTS_PAGE =
  'https://www.notion.so/Tennis-practice-insights-32470a7de7e0803e9f3ad8904cf25efe';

const TIPS = {
  groundstrokes: {
    title: 'Ground Strokes',
    blurb: 'Depth, corners, and variety — especially when lobs and high balls push you off rhythm.',
    items: [
      { h: 'Corner aiming with margin', p: 'Aim inside the corner, not the line. Your weekly focus is better accuracy on corner winners — build the pattern crosscourt ×2, then attack the open side.', drill: 'Cone in each corner — 8 CC then 1 DTL inside the cone', priority: true },
      { h: 'Forehand slice — learn the shape', p: 'You flagged forehand slice as a new weapon. Open the face, swing low-to-high under the ball, and finish toward your target — stability before speed.', drill: '20 slice forehands to the deuce service box', priority: true },
      { h: 'High balls: racket up early', p: 'On lobs and high forehands, prepare higher so you do not dump the ball long. On backhand highs, take it on the rise before the contact point disappears.', drill: 'Partner feeds high — 10 FH high prep, 10 BH on rise' },
      { h: 'Change pace on heavy topspin', p: 'When opponents loop deep, you do not have to match pace. Mix height, slice, and slower balls to break their rhythm instead of blasting into the fence.', drill: 'Rally — every 4th ball change pace or height' },
      { h: 'Lower center of gravity', p: 'Bend knees before contact, especially when pushed wide. A lower base helped your crosscourt passing shots — keep it on every ball you attack.', drill: 'Split-step + knee touch before each rally ball' },
      { h: 'Recover behind the baseline', p: 'After every shot, split-step a half-meter behind the line. Camping on the baseline is how unforced errors happen — you have less time to read the ball.', drill: 'Cross-court rally + tap the back curtain each shot' },
    ],
  },
  serve: {
    title: 'Serve',
    blurb: 'First serve angle is improving — the leak is second-serve consistency under pressure.',
    items: [
      { h: '2nd serve: spin in, not hero pace', p: 'Topspin + sidespin only works if it lands in. Your priority is success rate first, then add speed. Kick wide to pull opponents off court.', drill: '20 second serves — count ins before adding mph', priority: true },
      { h: 'Same toss, different serve', p: 'Keep toss height and placement consistent; change grip and swing path for kick vs flat. Bend knees on look-up, not on the toss itself.', drill: '10 tosses without hit — mark landing spot each time' },
      { h: 'Return position on slow serves', p: 'Stand inside the baseline for short or slow second serves. You have been returning with better direction when you take the ball early.', drill: 'Return drill — 15 slow serves, call target before split-step' },
      { h: 'Serve + first volley is a pattern', p: 'After a good first serve, come in immediately — do not camp in no-man\'s land. First volley is placement deep, not a winner.', drill: 'Serve wide → approach → deep volley to backhand', priority: true },
    ],
  },
  volley: {
    title: 'Volley',
    blurb: 'Net game is improving — backhand volley and feet are the current ceiling.',
    items: [
      { h: 'Backhand volley: level face, active feet', p: 'Stop tilting the racket head on backhand volleys. Continental grip, firm wrist, and small adjustment steps — do not reach with the upper body only.', drill: 'Ball-machine BH volleys — 30 with no cross-over step', priority: true },
      { h: 'Fast ball = slice, slower swing', p: 'When pace comes in hot, add backspin and shorten the swing. Trying to block through fast balls is why volleys sail long.', drill: 'Feeder speeds up — 10 volleys with audible slice finish' },
      { h: 'First volley deep, not flashy', p: 'On approach points, aim the service box deep and expect a reply. Your job is to stay at the net after a deep first volley, not paint a winner.', drill: 'Approach → volley to deep middle → hold position', priority: true },
      { h: 'Move forward through the shot', p: 'A planted volley is a defensive volley. Step into the ball with your opposite foot — body weight does the work, not the arm.', drill: 'Approach-volley-volley pattern, 10 sets' },
      { h: 'Low ball = bend knees, not the back', p: 'When the ball is at your shoetops, get your eyes at ball-level. Bending at the waist sends low volleys into the net every time.', drill: 'Knee-bend volleys — touch knee with non-dom hand' },
      { h: 'Doubles: follow the ball, not the player', p: 'At net in doubles, track the ball path and cover the alley when partner is pulled wide. Anticipate that the ball is coming to you.', drill: 'Doubles points — call "mine/yours" every ball' },
    ],
  },
  overhead: {
    title: 'Overhead',
    blurb: 'Sweet-spot contact is improving — footwork behind the ball is still the main fix.',
    items: [
      { h: 'Run behind, then come forward', p: 'Do not plant under the lob. Sidestep around and behind the ball, let it drop slightly, lift the racket, then move forward into contact.', drill: 'Lob feeds — call "around" before every smash', priority: true },
      { h: 'Sidestep, never backpedal', p: 'Backpedaling is how you sprain an ankle. Turn sideways and shuffle so you stay balanced and can push up into the shot.', drill: 'Cone shuffle — coach lobs, sidestep then smash' },
      { h: 'Contact in front, not above you', p: 'Most missed overheads come from letting the ball drift behind. Strike slightly in front of the hitting shoulder — same feel as a serve.', drill: 'Tossed overheads — catch the ball if it is behind' },
      { h: 'Hit the sweet spot for direction', p: 'You are finding better direction when contact is clean. Prioritize stable contact over max pace until footwork is automatic.', drill: '10 smashes — rate contact 1–3 before adding speed' },
      { h: 'Bounce it if it\'s a deep lob', p: 'On any lob pushing you past the baseline, let it bounce. Reset the point instead of a desperate jump-smash.', drill: 'Decision drill — call "hit" or "bounce" on each lob' },
      { h: 'Aim for the open court', p: '80% pace into the open court wins more points than 100% pace at the line.', drill: 'Smash to cones placed 4ft inside the lines' },
    ],
  },
  mental: {
    title: 'Mental Strategy',
    blurb: 'Court position, commitment, and one clear goal per session.',
    items: [
      { h: 'Never camp in no-man\'s zone', p: 'After you attack, move forward to the net or recover to baseline — do not retreat into the service-box dead zone. Hesitation there costs game points.', drill: 'Shadow: approach → service line hold → or full recovery', priority: true },
      { h: 'Approach: anticipate, prepare, move', p: 'Read the speed first, prepare the swing, then move to the ball. On slow/high approachers, aim service-box deep and commit to the first volley.', drill: 'Coach feeds slow ball — 10 approaches with written cue', priority: true },
      { h: 'One goal per session', p: 'Pick a single focus before you play (e.g. "BH volley feet") and tell your partner or coach. Align expectations so practice matches the goal.', drill: 'Write goal on wristband — review after 45 min' },
      { h: 'Have one cue word per point', p: 'Pick a word before each point — "loose," "early," "deep" — and say it under your breath. It narrows focus and quiets the inner critic.', drill: 'Practice match — one cue word per point, all set' },
      { h: 'Lose the point in 3 seconds', p: 'After an error, you get 3 seconds of frustration. Then it is gone. The next point is the only one that matters.', drill: 'Snap fingers after every error to reset' },
      { h: 'Breathe out on contact', p: 'Audible exhale on every strike releases shoulder tension and stabilizes contact under pressure.', drill: 'Loud exhale rally — 50 balls, every one vocal' },
      { h: 'Commit on easy balls', p: 'You miss too many game points by playing safe on sitters. Make the ball in first, then add angle — confidence follows contact.', drill: 'Short-ball drill — must finish 8/10 inside the court' },
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

/** Rolling tour results — dates within the past 7 days (May 2026 clay swing). */
const TOUR_RESULTS_WEEK = [
  { id: 'rg-m-1', date: '2026-05-24', tournament: 'Roland-Garros', round: 'R128', tour: 'ATP', winner: 'C. Alcaraz', winnerSub: 'ESP · #2', loser: 'J. Halys', loserSub: 'FRA', score: '6—1  6—2  6—2' },
  { id: 'rg-w-1', date: '2026-05-24', tournament: 'Roland-Garros', round: 'R128', tour: 'WTA', winner: 'I. Świątek', winnerSub: 'POL · #1', loser: 'C. Gauff', loserSub: 'USA · #3', score: '6—4  6—2' },
  { id: 'rg-m-2', date: '2026-05-23', tournament: 'Roland-Garros', round: 'R128', tour: 'ATP', winner: 'J. Sinner', winnerSub: 'ITA · #1', loser: 'R. Bautista Agut', loserSub: 'ESP', score: '6—3  6—4  6—2' },
  { id: 'rg-w-2', date: '2026-05-23', tournament: 'Roland-Garros', round: 'R128', tour: 'WTA', winner: 'A. Sabalenka', winnerSub: 'BLR · #2', loser: 'B. Krejcikova', loserSub: 'CZE', score: '7—5  6—3' },
  { id: 'rg-m-3', date: '2026-05-22', tournament: 'Roland-Garros', round: 'R128', tour: 'ATP', winner: 'A. Zverev', winnerSub: 'GER · #4', loser: 'D. Medvedev', loserSub: 'RUS', score: '6—4  6—7(5)  6—3' },
  { id: 'rg-w-3', date: '2026-05-22', tournament: 'Roland-Garros', round: 'R128', tour: 'WTA', winner: 'E. Rybakina', winnerSub: 'KAZ · #4', loser: 'M. Sakkari', loserSub: 'GRE', score: '6—2  6—4' },
  { id: 'rg-m-4', date: '2026-05-21', tournament: 'Roland-Garros', round: 'R64', tour: 'ATP', winner: 'C. Ruud', winnerSub: 'NOR · #8', loser: 'F. Cerundolo', loserSub: 'ARG', score: '6—3  6—4  6—2' },
  { id: 'rg-w-4', date: '2026-05-21', tournament: 'Roland-Garros', round: 'R64', tour: 'WTA', winner: 'J. Pegula', winnerSub: 'USA · #5', loser: 'S. Stephens', loserSub: 'USA', score: '6—1  6—4' },
];

// Sample recent stories — clearly framed as "feed" to make the refresh button feel earned
const SEED_NEWS = [
  { when: 'May 17', t: 'Rome Open wraps on the Foro Italico clay', d: 'Final-weekend storylines closed out a packed two weeks of high-quality clay-court tennis heading into Roland-Garros.' },
  { when: 'May 16', t: 'Roland-Garros draw ceremony approaches', d: 'Seedings for the year\'s second Grand Slam will be confirmed this week; main draw begins Sun May 24.' },
  { when: 'May 15', t: 'Clay swing form guide', d: 'Players who reached the late rounds in Monte-Carlo, Madrid, and Rome historically convert at a higher rate in Paris.' },
  { when: 'May 12', t: 'Wimbledon qualifying schedule released', d: 'Roehampton qualifying will run Jun 22—26 ahead of the Championships starting Jun 29.' },
];

// ============== STATE ==============
function saveState(s) {
  try {
    localStorage.setItem(
      'tennis-tracker-v1',
      JSON.stringify({ focus: s.focus, notionUpdatedAt: s.notionUpdatedAt }),
    );
  } catch (e) {}
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#15803D",
  "density": "comfy"
}/*EDITMODE-END*/;

const ACCENT_PALETTE = {
  '#15803D': { color: '#16A34A', deep: '#15803D', name: 'Green' },
  '#16A34A': { color: '#22C55E', deep: '#16A34A', name: 'Green bright' },
  '#E6D04A': { color: 'oklch(0.88 0.16 110)', deep: 'oklch(0.78 0.18 105)', name: 'Ball' },
  '#B95E3B': { color: 'oklch(0.58 0.13 35)',  deep: 'oklch(0.50 0.13 35)',  name: 'Clay' },
  '#4F7656': { color: 'oklch(0.45 0.08 150)', deep: 'oklch(0.38 0.08 150)', name: 'Court' },
};

/** Light 6:00–19:59 local; dark otherwise. */
function getThemeFromLocalTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= 6 && hour < 20 ? 'light' : 'dark';
}

function themeToggleLabel(theme, themeLocked) {
  if (themeLocked) {
    return theme === 'dark' ? 'Locked dark — click for auto' : 'Locked light — click for auto';
  }
  return theme === 'dark' ? 'Auto dark (night) — click to lock' : 'Auto light (day) — click to lock';
}

// ============== APP ==============
function App() {
  const [route, setRoute] = useState('today');
  const [state, setState] = useState({
    entries: [],
    lastSession: null,
    focus: null,
    notionUpdatedAt: null,
    notionSource: null,
    notionLoading: true,
    notionError: null,
  });
  const [notionPayload, setNotionPayload] = useState(null);
  const [themeLocked, setThemeLocked] = useState(false);
  const [lockedTheme, setLockedTheme] = useState('dark');
  const [theme, setTheme] = useState(() => getThemeFromLocalTime());
  const t = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const [tweaks, setTweak] = t;

  const syncFromNotion = React.useCallback(async () => {
    setState((s) => ({ ...s, notionLoading: true, notionError: null }));
    try {
      const data = await window.fetchNotionInsights();
      const applied = window.applyNotionPayload(data);
      setNotionPayload(data);
      setState((s) => ({
        ...s,
        ...applied,
        notionUpdatedAt: data.updatedAt,
        notionSource: data.source,
        notionLoading: false,
        notionError: null,
      }));
      return data;
    } catch (e) {
      setState((s) => ({
        ...s,
        notionLoading: false,
        notionError: e.message || 'Could not sync from Notion',
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    syncFromNotion();
  }, [syncFromNotion]);

  useEffect(() => {
    if (!state.notionLoading) saveState(state);
  }, [state.focus, state.notionUpdatedAt, state.notionLoading]);

  useEffect(() => {
    const apply = () => {
      const next = themeLocked ? lockedTheme : getThemeFromLocalTime();
      setTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    apply();
    if (themeLocked) return undefined;
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [themeLocked, lockedTheme]);

  const toggleTheme = () => {
    if (themeLocked) {
      setThemeLocked(false);
      return;
    }
    const auto = getThemeFromLocalTime();
    setLockedTheme(auto === 'dark' ? 'light' : 'dark');
    setThemeLocked(true);
  };

  // Apply accent tweak
  useEffect(() => {
    const root = document.documentElement;
    const pal = ACCENT_PALETTE[tweaks.accent] || ACCENT_PALETTE['#15803D'];
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
    cheat: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2"/>
        <line x1="7" y1="9" x2="17" y2="9"/>
        <line x1="7" y1="13" x2="17" y2="13"/>
        <line x1="7" y1="17" x2="14" y2="17"/>
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </>
    ),
    toolkit: <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>,
  };
  const pages = {
    today:    { l: 'Today' },
    tips:     { l: 'Practice Tips' },
    cheat:    { l: 'Game Cheat Note' },
    calendar: { l: 'Calendar & News' },
    toolkit:  { l: 'Toolkit' },
  };

  return (
    <div className="app" data-screen-label={`00 ${pages[route].l}`}>
      <aside className="rail">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <img
              src="https://img.magnific.com/premium-vector/cartoonish-tennis-ball-vector-illustration-icon_722324-273.jpg"
              alt="Ace logo"
              loading="lazy"
            />
          </div>
        </div>

        <nav className="nav">
          {Object.entries(pages).map(([k, p]) => (
            <button key={k}
              className={`nav-item ${route === k ? 'active' : ''}`}
              onClick={() => setRoute(k)}
              aria-label={p.l}>
              <svg viewBox="0 0 24 24">{NAV_ICONS[k]}</svg>
              <span className="nav-tooltip">{p.l}</span>
            </button>
          ))}
        </nav>

        <div className="foot">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={themeToggleLabel(theme, themeLocked)}
            title={themeToggleLabel(theme, themeLocked)}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>
        </div>
      </aside>

      <main className="content" data-screen-label={pages[route].l}>
        {route === 'today' && (
          <window.Today
            state={state}
            setRoute={setRoute}
            syncFromNotion={syncFromNotion}
            notionPayload={notionPayload}
          />
        )}
        {route === 'tips' && (
          <window.Tips
            notionPayload={notionPayload}
            syncFromNotion={syncFromNotion}
            notionLoading={state.notionLoading}
            notionUpdatedAt={state.notionUpdatedAt}
            notionError={state.notionError}
          />
        )}
        {route === 'cheat' && (
          <window.GameCheatNotes
            notionPayload={notionPayload}
            syncFromNotion={syncFromNotion}
            notionLoading={state.notionLoading}
            notionError={state.notionError}
          />
        )}
        {route === 'calendar' && <window.Calendar />}
        {route === 'toolkit' && <window.Toolkit />}
      </main>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Aesthetic">
            <window.TweakColor
              label="Accent color"
              value={tweaks.accent}
              options={['#15803D', '#16A34A', '#E6D04A', '#B95E3B', '#4F7656']}
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
window.TIPS = TIPS;
window.NOTION_INSIGHTS_PAGE = NOTION_INSIGHTS_PAGE;
