/* global React, TIPS */
const { useState: useS2 } = React;

function Tips() {
  const [tab, setTab] = useS2('groundstrokes');
  const cat = TIPS[tab];

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="kicker">The Library</div>
          <h1>Practice <em>tips.</em></h1>
        </div>
        <div className="meta">
          {Object.values(TIPS).reduce((a, c) => a + c.items.length, 0)} cues<br/>across 4 categories
        </div>
      </div>

      <div className="tip-tabs">
        {Object.entries(TIPS).map(([k, t]) => (
          <button key={k}
            className={`tip-tab ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k)}>
            {t.title}
            <span className="ct">{t.items.length}</span>
          </button>
        ))}
      </div>

      <div className="tip-hero">
        <div>
          <h2><em>{cat.title}</em></h2>
          <p>{cat.blurb}</p>
        </div>
        <div className="pic">
          {tab === 'groundstrokes' && <CourtArt mode="rally"/>}
          {tab === 'volley' && <CourtArt mode="net"/>}
          {tab === 'overhead' && <CourtArt mode="smash"/>}
          {tab === 'mental' && <CourtArt mode="focus"/>}
        </div>
      </div>

      <div className="tip-grid">
        {cat.items.map((t, i) => (
          <div key={i} className="tip-card">
            <span className="num">№ {String(i + 1).padStart(2, '0')}</span>
            <h4>{t.h}</h4>
            <p>{t.p}</p>
            <div className="drill"><b>Drill →</b> {t.drill}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourtArt({ mode }) {
  // Tiny SVG diagram per category, drawn from court markings (no clip-art slop)
  return (
    <svg viewBox="0 0 200 160" style={{width: '100%', height: '100%', maxHeight: 200, padding: 12}} aria-hidden="true">
      <rect x="20" y="20" width="160" height="120" fill="none" stroke="#3D4540" strokeWidth="1.4"/>
      <line x1="100" y1="20" x2="100" y2="140" stroke="#3D4540" strokeWidth="1" strokeDasharray="3 2"/>
      <line x1="20" y1="80" x2="180" y2="80" stroke="#3D4540" strokeWidth="1.4"/>
      <line x1="50" y1="50" x2="150" y2="50" stroke="#3D4540" strokeWidth="0.8"/>
      <line x1="50" y1="110" x2="150" y2="110" stroke="#3D4540" strokeWidth="0.8"/>
      <line x1="50" y1="50" x2="50" y2="110" stroke="#3D4540" strokeWidth="0.8"/>
      <line x1="150" y1="50" x2="150" y2="110" stroke="#3D4540" strokeWidth="0.8"/>
      {mode === 'rally' && (
        <>
          <path d="M 40 130 Q 100 30 160 130" fill="none" stroke="#B95E3B" strokeWidth="1.6"/>
          <path d="M 160 130 Q 100 30 40 130" fill="none" stroke="#B95E3B" strokeWidth="1.6" strokeDasharray="4 3"/>
          <circle cx="40" cy="130" r="3" fill="#E6D04A" stroke="#1A1F1B" strokeWidth="0.8"/>
          <circle cx="160" cy="130" r="3" fill="#E6D04A" stroke="#1A1F1B" strokeWidth="0.8"/>
        </>
      )}
      {mode === 'net' && (
        <>
          <line x1="20" y1="80" x2="180" y2="80" stroke="#B95E3B" strokeWidth="2.4"/>
          <circle cx="100" cy="75" r="4" fill="#1A1F1B"/>
          <path d="M 70 60 L 100 75 L 130 60" fill="none" stroke="#B95E3B" strokeWidth="1.2"/>
          <path d="M 75 95 L 100 75 L 125 95" fill="none" stroke="#1A1F1B" strokeWidth="1" strokeDasharray="2 2"/>
        </>
      )}
      {mode === 'smash' && (
        <>
          <path d="M 100 130 Q 70 20 100 35" fill="none" stroke="#B95E3B" strokeWidth="1.6"/>
          <path d="M 100 35 L 160 110" stroke="#1A1F1B" strokeWidth="1.6" markerEnd="url(#arrow)"/>
          <circle cx="100" cy="35" r="4" fill="#E6D04A" stroke="#1A1F1B" strokeWidth="0.8"/>
          <circle cx="100" cy="130" r="3" fill="#1A1F1B"/>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1A1F1B"/>
            </marker>
          </defs>
        </>
      )}
      {mode === 'focus' && (
        <>
          <circle cx="100" cy="80" r="34" fill="none" stroke="#B95E3B" strokeWidth="1.2"/>
          <circle cx="100" cy="80" r="22" fill="none" stroke="#B95E3B" strokeWidth="1.2" strokeDasharray="3 2"/>
          <circle cx="100" cy="80" r="6" fill="#E6D04A" stroke="#1A1F1B" strokeWidth="1"/>
          <line x1="60" y1="80" x2="140" y2="80" stroke="#3D4540" strokeWidth="0.6" strokeDasharray="2 3"/>
          <line x1="100" y1="40" x2="100" y2="120" stroke="#3D4540" strokeWidth="0.6" strokeDasharray="2 3"/>
        </>
      )}
    </svg>
  );
}

window.Tips = Tips;
