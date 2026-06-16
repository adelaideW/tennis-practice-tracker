/* global React, PRACTICE_TAGS, INTENSITY, TIPS, CALENDAR_2026, SEED_NEWS, TOUR_RESULTS_WEEK */
const { useState: useS1, useMemo: useM1, useEffect: useE1, useRef: useR1, useCallback: useC1 } = React;

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

function formatActivityDuration(mins) {
  if (!mins || mins <= 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  return Number.isInteger(hrs) ? `${hrs} hrs` : `${hrs.toFixed(1)} hrs`;
}

function formatActivityTooltip(iso, mins, range) {
  const dateStr = iso
    ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: range === 'all' ? 'numeric' : undefined,
      })
    : '';
  if (!mins) return `${dateStr} · No practice logged`;
  return `${dateStr} · ${formatActivityDuration(mins)} played`;
}

function getActivityTooltipStyle(clientX, clientY) {
  const margin = 12;
  const tooltipHalf = 72;
  let x = clientX;
  let y = clientY;
  let transform = 'translate(-50%, calc(-100% - 10px))';

  if (x < margin + tooltipHalf) {
    x = margin;
    transform = 'translate(0, calc(-100% - 10px))';
  } else if (x > window.innerWidth - margin - tooltipHalf) {
    x = window.innerWidth - margin;
    transform = 'translate(-100%, calc(-100% - 10px))';
  }

  return {
    position: 'fixed',
    left: x,
    top: y,
    transform,
  };
}

function clampActivityZoom(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function detectPanelBodyOverflow(body) {
  if (!body) return false;
  if (body.scrollHeight > body.clientHeight + 2) return true;

  const chartScroll = body.querySelector('.activity-chart-scroll');
  if (chartScroll) {
    const svg = chartScroll.querySelector('svg');
    if (svg && svg.getBoundingClientRect().height > chartScroll.clientHeight + 2) return true;
    if (chartScroll.scrollHeight > chartScroll.clientHeight + 2) return true;
  }

  return false;
}

function ActivityChart({ entries, range = '7d', panelExpanded = false }) {
  const [hoverIdx, setHoverIdx] = useS1(null);
  const [tooltipPos, setTooltipPos] = useS1(null);
  const [zoom, setZoom] = useS1(1);
  const [scrollMaxH, setScrollMaxH] = useS1(0);
  const [containerW, setContainerW] = useS1(0);
  const wrapRef = useR1(null);
  const scrollRef = useR1(null);
  const zoomPendingScrollRef = useR1(null);
  const lastZoomPointerRef = useR1(null);

  const updateTooltipPos = useC1((e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const clearHover = useC1(() => {
    setHoverIdx(null);
    setTooltipPos(null);
  }, []);

  useE1(() => {
    setZoom(1);
    setHoverIdx(null);
    setTooltipPos(null);
    zoomPendingScrollRef.current = null;
    const scroll = scrollRef.current;
    if (scroll) scroll.scrollLeft = 0;
  }, [range]);

  useE1(() => {
    const wrap = wrapRef.current;
    const scroll = scrollRef.current;
    if (!wrap || !scroll || typeof ResizeObserver === 'undefined') return undefined;

    const measure = () => {
      const head = wrap.querySelector('.activity-chart-head');
      const headH = head ? head.offsetHeight : 0;
      if (!panelExpanded) {
        setScrollMaxH(Math.max(52, wrap.clientHeight - headH));
      }
      setContainerW(scroll.clientWidth);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(scroll);
    const svg = scroll.querySelector('svg');
    if (svg) ro.observe(svg);
    return () => ro.disconnect();
  }, [range, panelExpanded]);

  const getBasePlotH = useC1(() => (range === '7d' ? 40 : 36), [range]);

  const getMaxZoom = useC1(() => {
    const chartFootprint = getBasePlotH() + 14 + 4;
    return scrollMaxH > 0 ? Math.max(1, scrollMaxH / chartFootprint) : 2.4;
  }, [getBasePlotH, scrollMaxH]);

  useE1(() => {
    const mz = getMaxZoom();
    setZoom((prev) => clampActivityZoom(prev, 1, mz));
  }, [range, getMaxZoom]);

  const bumpZoomAt = useC1((delta, clientX, clientY) => {
    const scroll = scrollRef.current;
    const prevZ = zoom;
    const nextZ = clampActivityZoom(prevZ + delta, 1, getMaxZoom());
    if (nextZ === prevZ) return;

    if (scroll) {
      const rect = scroll.getBoundingClientRect();
      const pointerX = typeof clientX === 'number' ? clientX - rect.left : scroll.clientWidth / 2;
      const contentX = scroll.scrollLeft + pointerX;
      zoomPendingScrollRef.current = {
        contentX,
        pointerX,
        scale: nextZ / prevZ,
      };
    }
    setZoom(nextZ);
  }, [zoom, getMaxZoom]);

  const bumpZoomFromControl = useC1((delta) => {
    const p = lastZoomPointerRef.current;
    bumpZoomAt(delta, p?.x, p?.y);
  }, [bumpZoomAt]);

  const handleWheel = useC1((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    bumpZoomAt(e.deltaY > 0 ? -0.12 : 0.12, e.clientX, e.clientY);
  }, [bumpZoomAt]);

  useE1(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const days = useM1(() => {
    const minutesOnDate = (iso) => entries
      .filter((e) => e.date.slice(0, 10) === iso)
      .reduce((a, e) => a + (e.duration || 60), 0);

    if (range === 'all') {
      const byDay = new Map();
      entries.forEach((e) => {
        const iso = e.date?.slice(0, 10);
        if (!iso || iso.length < 10) return;
        byDay.set(iso, (byDay.get(iso) || 0) + (e.duration || 60));
      });

      const sorted = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      if (!sorted.length) {
        return [{
          iso: '',
          label: '',
          mins: 0,
          tooltip: 'No sessions logged in Notion yet',
        }];
      }
      const labelEvery = sorted.length <= 10 ? 1 : Math.max(1, Math.ceil(sorted.length / 8));

      return sorted.map(([iso, mins], i) => {
        const d = new Date(`${iso}T12:00:00`);
        const showLabel = i === 0 || i === sorted.length - 1 || i % labelEvery === 0;
        return {
          iso,
          label: showLabel
            ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '',
          mins,
          tooltip: formatActivityTooltip(iso, mins, range),
        };
      });
    }

    if (range === '30d') {
      const out = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const mins = minutesOnDate(iso);
        const showLabel = i % 5 === 0 || i === 0 || i === 29;
        out.push({
          iso,
          label: showLabel
            ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '',
          mins,
          tooltip: formatActivityTooltip(iso, mins, range),
        });
      }
      return out;
    }

    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const mins = minutesOnDate(iso);
      out.push({
        iso,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        mins,
        tooltip: formatActivityTooltip(iso, mins, range),
      });
    }
    return out;
  }, [entries, range]);

  const totalMins = days.reduce((a, d) => a + d.mins, 0);
  const totalHrs = (totalMins / 60).toFixed(1);
  const n = Math.max(days.length, 1);
  const maxMins = Math.max(...days.map((d) => d.mins), 60);

  const basePlotH = getBasePlotH();
  const labelH = 14;
  const maxZoom = getMaxZoom();
  const zoomLevel = clampActivityZoom(zoom, 1, maxZoom);

  const fallbackW = range === '30d' ? 440 : range === 'all' ? Math.max(280, n * 11) : 320;
  const fitW = containerW > 0 ? containerW : fallbackW;
  const baseW = range === 'all' ? Math.max(fitW, Math.max(280, n * 11)) : fitW;
  const W = baseW * zoomLevel;
  const H = basePlotH * zoomLevel;
  const padX = 12;
  const padY = range === '7d' ? 6 : 8;
  const pts = days.map((d, i) => {
    const x = padX + (n <= 1 ? 0 : i / (n - 1)) * (W - 2 * padX);
    const y = H - padY - (d.mins / maxMins) * (H - 2 * padY);
    return { x, y, mins: d.mins, label: d.label, tooltip: d.tooltip };
  });
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H} ${polyline} ${pts[pts.length - 1].x},${H}`;
  const gradId = `actGrad-${range}`;
  const chartHeight = H + labelH + 4;
  const hoverPt = hoverIdx != null ? pts[hoverIdx] : null;
  const hitR = range === '7d' ? 9 : range === '30d' ? 10 : 12;
  const dotR = hoverIdx != null ? 4.5 : range === '7d' ? 3 : range === '30d' || range === 'all' ? 2.8 : 3.5;
  const labelSize = range === '7d' ? 7 : 8;
  const strokeW = range === '7d' ? 1.9 : 2.2;

  useE1(() => {
    const scroll = scrollRef.current;
    const pending = zoomPendingScrollRef.current;
    if (!scroll || !pending) return undefined;
    zoomPendingScrollRef.current = null;
    const rafId = requestAnimationFrame(() => {
      scroll.scrollLeft = Math.max(0, pending.contentX * pending.scale - pending.pointerX);
    });
    return () => cancelAnimationFrame(rafId);
  }, [zoomLevel]);

  return (
    <div
      ref={wrapRef}
      className="activity-chart-wrap is-zoomable"
      onMouseLeave={clearHover}
    >
      <div className="activity-chart-head">
        <div className="activity-total">{totalHrs} hrs played</div>
        <div className="activity-chart-zoom" role="group" aria-label="Chart zoom">
          <button
            type="button"
            className="activity-zoom-btn"
            aria-label="Zoom out"
            disabled={zoomLevel <= 1}
            onClick={() => bumpZoomFromControl(-0.2)}
          >
            −
          </button>
          <span className="activity-zoom-label">{Math.round(zoomLevel * 100)}%</span>
          <button
            type="button"
            className="activity-zoom-btn"
            aria-label="Zoom in"
            disabled={zoomLevel >= maxZoom - 0.01}
            onClick={() => bumpZoomFromControl(0.2)}
          >
            +
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className={`activity-chart-scroll${panelExpanded ? ' is-expanded' : ''}`}
        style={!panelExpanded && scrollMaxH > 0 ? { maxHeight: scrollMaxH, minHeight: scrollMaxH } : undefined}
        onMouseMove={(e) => { lastZoomPointerRef.current = { x: e.clientX, y: e.clientY }; }}
      >
        <svg
          width={W}
          height={chartHeight}
          viewBox={`0 0 ${W} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ minWidth: W, display: 'block', marginInline: 'auto' }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gradId})`} />
          <polyline points={polyline} fill="none" stroke="var(--chart-1)" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hitR}
                fill="transparent"
                onMouseEnter={(e) => {
                  setHoverIdx(i);
                  updateTooltipPos(e);
                }}
                onMouseMove={updateTooltipPos}
                aria-label={p.tooltip}
              />
              {(p.mins > 0 || range === '7d') && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={dotR}
                  fill={hoverIdx === i ? 'var(--accent)' : 'var(--chart-1)'}
                  stroke="var(--surface)"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              )}
              {p.label && (
                <text x={p.x} y={H + labelH} textAnchor="middle" fill="var(--ink-3)" fontSize={labelSize} fontFamily="var(--mono)" letterSpacing="0.6" pointerEvents="none">
                  {p.label.toUpperCase()}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {hoverPt && tooltipPos && (
        <div
          className="activity-tooltip"
          style={getActivityTooltipStyle(tooltipPos.x, tooltipPos.y)}
          role="status"
        >
          {hoverPt.tooltip}
        </div>
      )}
    </div>
  );
}

function Today({ state, setRoute, syncFromNotion, notionPayload }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const [refreshSeed, setRefreshSeed] = useS1(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useS1(null);
  const [activityRange, setActivityRange] = useS1('7d');

  const todayDashboard = useM1(() => {
    if (notionPayload && window.applyNotionPayload) {
      return window.applyNotionPayload({ ...notionPayload, _refreshSeed: refreshSeed });
    }
    return null;
  }, [notionPayload, refreshSeed]);
  const todayEntries = todayDashboard?.entries?.length ? todayDashboard.entries : state.entries;

  const totalSessions = todayEntries.length;
  const totalMinutes = todayEntries.reduce((a, e) => a + (e.duration || 60), 0);
  const totalHours = parseFloat((totalMinutes / 60).toFixed(1));

  const streak = useM1(() => {
    const days = new Set(todayEntries.map(e => e.date.slice(0, 10)));
    if (!days.size) return 0;
    let s = 0;
    const probe = new Date();
    while (days.has(probe.toISOString().slice(0, 10))) {
      s++;
      probe.setDate(probe.getDate() - 1);
    }
    return s;
  }, [todayEntries]);

  const topSkills = useM1(() => {
    const scored = window.computeTopSkillsFromEntries
      ? window.computeTopSkillsFromEntries(todayEntries, { limit: 4 })
      : [];
    return scored.map((s) => ({
      label: (PRACTICE_TAGS.find((p) => p.k === s.key) || {}).l || s.key,
      pct: s.pct,
      minutes: s.minutes,
    }));
  }, [todayEntries]);

  const recentSessions = useM1(() => {
    const pool = window.filterEntriesLastDays
      ? window.filterEntriesLastDays(todayEntries, 7)
      : todayEntries;
    return window.groupEntriesByDate
      ? window.groupEntriesByDate(pool, 7)
      : pool.slice(0, 7);
  }, [todayEntries]);
  const focus = useM1(() => {
    if (notionPayload && window.buildFocusFromNotion) {
      return window.buildFocusFromNotion({ ...notionPayload, _refreshSeed: refreshSeed });
    }
    return state.focus;
  }, [notionPayload, state.focus, refreshSeed]);
  const notionPage = window.NOTION_INSIGHTS_PAGE;
  const focusBody = focus?.body || '';
  const focusCues = focus?.cues || [];
  const focusSections = focus?.sections || [];
  const refreshedIso = lastRefreshedAt || state.notionUpdatedAt || notionPayload?.updatedAt || null;
  const refreshedLabel = refreshedIso
    ? new Date(refreshedIso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const handleRefresh = async () => {
    setRefreshSeed((n) => n + 1);
    if (syncFromNotion) {
      const data = await syncFromNotion({ force: true });
      if (data) setLastRefreshedAt(new Date().toISOString());
    }
  };

  const focusContentKey = `${focusBody}|${focusCues.join('¦')}|${focusSections.map((s) => `${s.title}:${s.items.join('¦')}`).join('§')}`;

  const todayGrid = useDraggableDashboardGrid({
    storageKey: TODAY_LAYOUT_STORAGE,
    loadLayout: loadTodayLayout,
    makeDefaultLayout: makeDefaultTodayLayout,
  });

  const renderTodayCard = (id, item) => {
    switch (id) {
      case 'focus':
        return (
          <div className="today-focus-inner" key={focusContentKey}>
            <h2 className="today-focus-headline">
              {state.notionLoading
                ? 'Syncing your brief…'
                : `"${focus?.headline || 'Weekly focus from Notion'}"`}
            </h2>
            <div className="focus-body">
              {state.notionError ? (
                <div>{state.notionError}</div>
              ) : focus ? (
                <>
                  <div className="focus-detail-text">{focusBody}</div>
                  {focusSections.map((section, i) => (
                    <div key={i} className="focus-section">
                      <div className="focus-section-label">{section.title}</div>
                      <ul>{section.items.map((item, j) => <li key={j}>{item}</li>)}</ul>
                    </div>
                  ))}
                </>
              ) : (
                <div>Your weekly focus loads from Needs improvement and Things to do/try in last week&apos;s Notion log.</div>
              )}
            </div>
          </div>
        );
      case 'conditions':
        return <ToolkitConditionsContent />;
      case 'overview':
        return (
          <div className="overview-card-inner">
            <span className="overview-week-badge">From Notion</span>
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
        );
      case 'skills':
        return topSkills.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13 }}>Add daily reflections in Notion to populate skills.</div>
        ) : (
          <div className="skills-card-inner">
            {topSkills.map((s, i) => (
              <div key={i} className={`skill-row skill-series skill-series-${i}`}>
                <div className="skill-left">
                  <div className="skill-dot"></div>
                  <div className="skill-name">{s.label}</div>
                </div>
                <div className="skill-bar-wrap">
                  <div className="skill-bar" style={{ width: `${s.pct}%` }}></div>
                </div>
                <div className="skill-pct">{s.pct}%</div>
              </div>
            ))}
          </div>
        );
      case 'activity':
        return (
          <div className="activity-card-inner">
            <div className="activity-tabs activity-tabs-in-panel" role="tablist" aria-label="Activity range">
              {[
                { k: '7d', l: '7 days' },
                { k: '30d', l: '30 days' },
                { k: 'all', l: 'All time' },
              ].map((tab) => (
                <button
                  key={tab.k}
                  type="button"
                  role="tab"
                  aria-selected={activityRange === tab.k}
                  className={`activity-tab ${activityRange === tab.k ? 'active' : ''}`}
                  onClick={() => setActivityRange(tab.k)}
                >
                  {tab.l}
                </button>
              ))}
            </div>
            <ActivityChart entries={todayEntries} range={activityRange} panelExpanded={!!item?.expanded} />
          </div>
        );
      case 'recent':
        return recentSessions.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13 }}>
            {state.notionLoading ? 'Loading sessions from Notion…' : 'No daily reflections found in Notion yet.'}
          </div>
        ) : (
          <div className="recent-card-inner recent-card-scroll">
            {recentSessions.map((e) => (
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
                    {e.context || (e.tags || []).slice(0, 3).map((k) => (PRACTICE_TAGS.find((p) => p.k === k) || {}).l).filter(Boolean).join(' · ') || 'Practice session'}
                  </div>
                </div>
                <div className="recent-dur">{e.duration || 60}m</div>
              </div>
            ))}
            {notionPage && (
              <a
                href={notionPage}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 12, display: 'inline-block', color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--mono)', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}
              >
                Open Notion journal ↗
              </a>
            )}
          </div>
        );
      default:
        return null;
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
          {state.notionLoading ? (
            <>Syncing from Notion…</>
          ) : (
            <>
              {streak > 0 ? `${streak}-day streak` : 'Play today to extend streak'}<br />
              {totalSessions} sessions from Notion
            </>
          )}
          <br />
          Drag to rearrange · Resize panels
        </div>
      </div>

      <div className={`today-dashboard${todayGrid.layout.mode === 'dashboard' ? ' today-dashboard--positioned' : ''}`}>
        <div className="today-dashboard-bar">
          <div className="today-dashboard-bar-meta">
            {refreshedLabel ? (
              <span className="mono-small">Last refreshed {refreshedLabel}</span>
            ) : (
              <span className="mono-small muted">Notion sync</span>
            )}
          </div>
          <div className="today-dashboard-bar-actions">
            <button
              type="button"
              className="today-bar-btn today-bar-btn--primary"
              onClick={handleRefresh}
              disabled={state.notionLoading}
            >
              {state.notionLoading && <span className="spinner"></span>}
              {state.notionLoading ? 'Syncing…' : 'Refresh from Notion'}
            </button>
            {notionPage && (
              <a
                className="today-bar-btn today-bar-btn--ghost"
                href={notionPage}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Notion page ↗
              </a>
            )}
            <button
              type="button"
              className="today-bar-btn today-bar-btn--icon"
              onClick={todayGrid.resetLayout}
              aria-label="Reset card layout to default"
              title="Reset layout"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>

        <DashboardGrid
          {...todayGrid}
          cardTitles={TODAY_CARD_TITLES}
          renderCardContent={renderTodayCard}
          getPanelVariant={(id) => {
            if (id === 'focus') return 'toolkit-panel--focus';
            if (id === 'activity') return 'toolkit-panel--activity';
            return '';
          }}
        />
      </div>
    </>
  );
}

// ============== TIPS ==============
function Tips({ notionPayload, syncFromNotion, notionLoading, notionUpdatedAt, notionError }) {
  const [refreshSeed, setRefreshSeed] = useS1(0);
  const [lastSyncedAt, setLastSyncedAt] = useS1(null);
  const [showLibrary, setShowLibrary] = useS1(false);
  const [cat, setCat] = useS1('groundstrokes');
  const order = ['groundstrokes', 'serve', 'volley', 'overhead', 'mental'];
  const notionPage = window.NOTION_INSIGHTS_PAGE;
  const payloadRevision = window.notionPayloadRevision
    ? window.notionPayloadRevision(notionPayload)
    : notionPayload?.updatedAt;

  const sharpen = useM1(
    () => (notionPayload && window.buildSharpenFromNotion
      ? window.buildSharpenFromNotion(notionPayload, TIPS, refreshSeed)
      : { areas: [], generatedAt: null, source: null, sessionCount: 0 }),
    [notionPayload, payloadRevision, notionUpdatedAt, refreshSeed],
  );

  const refreshedIso = lastSyncedAt || notionUpdatedAt || sharpen.generatedAt || null;
  const refreshedLabel = refreshedIso
    ? new Date(refreshedIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const handleRefresh = async () => {
    if (!syncFromNotion) return;
    const data = await syncFromNotion({ force: true });
    if (data) {
      setLastSyncedAt(new Date().toISOString());
      setRefreshSeed((n) => n + 1);
    }
  };

  const libraryData = TIPS[cat];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">
            Top 5 from Notion · {sharpen.sessionCount || 0} sessions analyzed
            {notionPayload?.weeklySource === 'notion' ? ' · weekly priorities live' : ''}
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
          {(notionError || notionPayload?.syncWarning) && (
            <span className="notion-new-badge">{notionError || notionPayload.syncWarning}</span>
          )}
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
                      {tip.fromNotion
                        ? <span className="match-chip">Notion</span>
                        : tip.priority && <span className="match-chip">Match</span>}
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
function GameCheatNoteColumn({ playerName, columnKey, label, items, emptyLabel }) {
  return (
    <div className="game-cheat-col">
      <span className="mono-small">{label}</span>
      {items.length ? (
        <ul className="game-cheat-bullets">
          {items.map((line, index) => (
            <li key={`${playerName}-${columnKey}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : (
        <ul className="game-cheat-bullets">
          <li className="muted">{emptyLabel}</li>
        </ul>
      )}
    </div>
  );
}

function GameCheatNotes({ notionPayload, syncFromNotion, notionLoading, notionError, isUnlocked, onUnlock }) {
  const notionPage = window.NOTION_INSIGHTS_PAGE;
  const [refreshSeed, setRefreshSeed] = useS1(0);
  const [lastSyncedAt, setLastSyncedAt] = useS1(null);
  const [password, setPassword] = useS1('');
  const [showPassword, setShowPassword] = useS1(false);
  const [authError, setAuthError] = useS1('');
  const [aiSummaries, setAiSummaries] = useS1({});
  const [expandedPlayers, setExpandedPlayers] = useS1(() => new Set());
  const passRef = useR1(null);
  const CHEAT_PASSWORD = 'AdelaideW';
  const SUMMARY_LINE_LIMIT = 120;

  const cheat = useM1(
    () => (notionPayload && window.buildCheatNotesFromNotion
      ? window.buildCheatNotesFromNotion(notionPayload)
      : { players: [], generatedAt: null, source: null, playerCount: 0, totalNoteCount: 0 }),
    [notionPayload, refreshSeed],
  );

  const syncModeLabel = useM1(() => {
    const src = notionPayload?.cheatNotesSource || notionPayload?.source;
    if (src === 'notion') return 'Live from Notion';
    if (src === 'notion+snapshot') return 'Live from Notion + offline merge';
    if (src === 'snapshot' || src === 'markdown-export') return 'Offline snapshot';
    return src ? String(src) : 'Notion';
  }, [notionPayload]);

  const refreshedLabel = (lastSyncedAt || cheat.generatedAt)
    ? new Date(lastSyncedAt || cheat.generatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const handleRefresh = async () => {
    setRefreshSeed((n) => n + 1);
    if (!syncFromNotion) return;
    const data = await syncFromNotion({ force: true });
    if (data) setLastSyncedAt(new Date().toISOString());
  };

  useE1(() => {
    if (!isUnlocked && passRef.current) {
      passRef.current.focus();
    }
  }, [isUnlocked]);

  const handleUnlock = () => {
    if (password.trim() === CHEAT_PASSWORD) {
      setAuthError('');
      setPassword('');
      if (onUnlock) onUnlock();
      return;
    }
    setAuthError('Incorrect password. Please try again.');
  };

  const togglePlayerExpanded = (name) => {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useE1(() => {
    let cancelled = false;
    if (!isUnlocked || !cheat.players.length || !window.claude?.complete) {
      return () => { cancelled = true; };
    }

    const summarizePlayer = async (player) => {
      const formatSummary = (raw) => {
        const base = String(raw || '')
          .replace(/```[\s\S]*?```/g, '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        const pickLine = (prefix, fallback) => {
          const found = base.find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()));
          const value = (found || `${prefix} ${fallback}`).trim();
          return value.length > SUMMARY_LINE_LIMIT ? `${value.slice(0, SUMMARY_LINE_LIMIT - 1).trim()}…` : value;
        };

        return [
          pickLine('Strengths:', 'Not enough notes yet.'),
          pickLine('Exploit:', 'Not enough notes yet.'),
          pickLine('Plan:', 'Use high-percentage patterns and discipline.'),
        ].join('\n');
      };

      const prompt = [
        'You are a tennis match strategist.',
        `Summarize opponent notes for "${player.name}" in at most 3 short lines.`,
        'Keep each line concise and practical.',
        'Each line should be under 120 characters.',
        'Format exactly as plain text with line breaks, no bullets, no markdown.',
        'Line 1 starts with "Strengths:".',
        'Line 2 starts with "Exploit:".',
        'Line 3 starts with "Plan:".',
        `Strength notes: ${(player.goodAt || []).join(' | ') || 'None'}`,
        `Exploit notes: ${(player.badAt || []).join(' | ') || 'None'}`,
      ].join('\n');

      try {
        const raw = await window.claude.complete(prompt);
        if (cancelled) return;
        const cleaned = formatSummary(raw);
        if (!cleaned) return;
        setAiSummaries((prev) => ({ ...prev, [player.name]: cleaned }));
      } catch {
        // Keep deterministic summary fallback from notion-sync.
      }
    };

    (async () => {
      for (const player of cheat.players) {
        if (cancelled) break;
        if (aiSummaries[player.name]) continue;
        // Sequential calls avoid rate spikes and preserve UI responsiveness.
        // eslint-disable-next-line no-await-in-loop
        await summarizePlayer(player);
      }
    })();

    return () => { cancelled = true; };
  }, [isUnlocked, cheat.players, aiSummaries]);

  if (!isUnlocked) {
    return (
      <div className="cheat-lock-page">
        <div className="cheat-lock-panel" role="group" aria-labelledby="cheat-lock-title">
          <div className="kicker">Protected Section</div>
          <h2 id="cheat-lock-title">Game cheat note is locked</h2>
          <p className="muted" style={{ margin: 0 }}>Enter password to view this page.</p>
          <div className="cheat-lock-form">
            <label className="mono-small" htmlFor="cheat-password-input">Password</label>
            <div className="cheat-password-row">
              <input
                id="cheat-password-input"
                ref={passRef}
                type={showPassword ? 'text' : 'password'}
                className="cheat-password-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlock();
                }}
                placeholder="Enter password"
                autoComplete="off"
              />
              <button
                type="button"
                className="cheat-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.1A9.8 9.8 0 0 1 12 4c4.7 0 8.7 3.2 10 8-0.4 1.3-1 2.5-1.9 3.5" />
                    <path d="M6.1 6.1C4.2 7.5 2.8 9.6 2 12c1.3 4.8 5.3 8 10 8 1.8 0 3.5-0.5 5-1.3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {authError && <p className="cheat-lock-error">{authError}</p>}
            <button type="button" className="btn-primary" onClick={handleUnlock}>
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">
            {cheat.totalNoteCount || 0} notes · {cheat.playerCount || 0} players · {syncModeLabel}
          </div>
          <h1>Game <em>cheat note.</em></h1>
        </div>
        <div className="meta">
          {refreshedLabel && <>Synced · {refreshedLabel}<br /></>}
          {notionPage && (
            <a href={notionPage} target="_blank" rel="noopener noreferrer" className="notion-link">
              Tennis practice insights ↗
            </a>
          )}
        </div>
      </div>

      <div className="notion-sync-bar mb-28">
        <div className="notion-sync-copy">
          <div className="mono-small">Match prep from Notion</div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Pulled from “Analysis on other Player’s style” in your Notion insights (weekly + game notes) — Good and Loophole bullets per player. Source: {syncModeLabel}.
          </p>
          {(notionError || notionPayload?.syncWarning) && (
            <span className="notion-new-badge">{notionError || notionPayload.syncWarning}</span>
          )}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleRefresh}
          disabled={notionLoading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {notionLoading && <span className="spinner"></span>}
          {notionLoading ? 'Syncing…' : 'Refresh from Notion'}
        </button>
      </div>

      {notionLoading && !cheat.players.length ? (
        <div className="card mb-28">
          <p className="muted" style={{ margin: 0 }}>Loading player cheat notes from Notion…</p>
        </div>
      ) : (
        <div className="game-cheat-list">
          {cheat.players.length === 0 ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                No player analysis found yet. Add “Analysis on other Player’s style” under Weekly insights in Notion, then refresh.
              </p>
            </div>
          ) : (
            cheat.players.map((player) => (
              <section
                key={player.name}
                className="card game-cheat-card game-cheat-card--clickable"
                onClick={() => togglePlayerExpanded(player.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePlayerExpanded(player.name);
                  }
                }}
                aria-expanded={expandedPlayers.has(player.name)}
              >
                <div className="game-cheat-head">
                  <h2 className="game-cheat-name">{player.name}</h2>
                  <div className="game-cheat-head-actions">
                    <span className="game-cheat-note-count mono-small">
                      {player.sessionCount} note{player.sessionCount === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      className="game-cheat-collapse-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayerExpanded(player.name);
                      }}
                      aria-expanded={expandedPlayers.has(player.name)}
                    >
                      {expandedPlayers.has(player.name) ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                </div>
                {(aiSummaries[player.name] || player.summary) && (
                  <p className="game-cheat-summary muted">
                    {aiSummaries[player.name] || player.summary}
                  </p>
                )}
                {expandedPlayers.has(player.name) && (
                  <div className="game-cheat-grid">
                    <GameCheatNoteColumn
                      playerName={player.name}
                      columnKey="good"
                      label="Good at"
                      items={player.goodAt}
                      emptyLabel="No strengths logged yet."
                    />
                    <GameCheatNoteColumn
                      playerName={player.name}
                      columnKey="bad"
                      label="Exploit (loophole)"
                      items={player.badAt}
                      emptyLabel="No clear leaks logged yet."
                    />
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      )}
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

const TOUR_DAILY_KEY = 'tennis-tour-news-v2';
const TOUR_RESULTS_CACHE_KEY = 'tennis-tour-results-v4';
const TOUR_RESULTS_REFRESH_MS = 6 * 60 * 60 * 1000;
const TOUR_RESULTS_PREVIEW = 5;
const TOUR_RESULTS_WINDOW_DAYS = 7;
const TOUR_SCORES_GOOGLE_URL =
  'https://www.google.com/search?q=atp+wta+tennis+scores';

const TOURNAMENT_NAME_ALIASES = {
  'Roland-Garros': [/roland[\s-]*garros/i, /french\s*open/i],
  "Queen's Club / Halle": [/queen'?s/i, /halle/i, /hsbc championships/i, /terra wortmann/i, /wortmann open/i],
  'Wimbledon': [/wimbledon/i, /all england/i],
};

function deriveCalendarState(entry, today = new Date()) {
  if (!entry.start || !entry.end) return entry.state || 'up';
  const day = today.toISOString().slice(0, 10);
  if (day < entry.start) return 'up';
  if (day > entry.end) return 'done';
  return 'live';
}

function getCalendarWithStates(today = new Date()) {
  return CALENDAR_2026.map((entry) => ({
    ...entry,
    state: deriveCalendarState(entry, today),
  }));
}

function getActiveTournaments(today = new Date()) {
  return getCalendarWithStates(today).filter((t) => t.state === 'live');
}

function getActiveTournament(today = new Date()) {
  return getActiveTournaments(today)[0] || null;
}

function getTourSeasonContext(today = new Date()) {
  const cal = getCalendarWithStates(today);
  const live = cal.filter((t) => t.state === 'live');
  const next = cal.find((t) => t.state === 'up');
  const recentDone = [...cal].reverse().find((t) => t.state === 'done');
  const liveNames = live.map((t) => t.name).join(' and ') || 'the tour';
  const summary = live.length
    ? `${liveNames} ${live.length > 1 ? 'are' : 'is'} on court. ${recentDone ? `${recentDone.name} has concluded.` : ''} Next major: ${next?.name || 'on the calendar'}.`
    : `${recentDone ? `${recentDone.name} just concluded.` : 'Between events.'} Next up: ${next?.name || 'the next stop on tour'}.`;
  return { live, next, recentDone, summary };
}

function matchesTournamentName(tournament, calendarName) {
  if (!tournament || !calendarName) return false;
  const aliases = TOURNAMENT_NAME_ALIASES[calendarName] || [
    new RegExp(calendarName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  ];
  return aliases.some((re) => re.test(tournament));
}

function filterActiveTournamentResults(results) {
  const active = getActiveTournaments();
  if (!active.length) return getResultsInPastDays(results, TOUR_RESULTS_WINDOW_DAYS);
  const filtered = results.filter((r) =>
    active.some((t) => matchesTournamentName(r.tournament, t.name)),
  );
  if (!filtered.length) return getResultsInPastDays(results, TOUR_RESULTS_WINDOW_DAYS);
  return filtered.sort(
    (a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)),
  );
}

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

function sanitizeTourResults(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && r.date && r.tournament && r.winner && r.loser && r.score)
    .map((r, i) => ({
      id: r.id || `tr-${i}-${String(r.date).slice(0, 10)}`,
      date: String(r.date).slice(0, 10),
      tournament: r.tournament,
      round: r.round || 'R32',
      tour: r.tour === 'WTA' ? 'WTA' : 'ATP',
      winner: r.winner,
      winnerSub: r.winnerSub || '',
      loser: r.loser,
      loserSub: r.loserSub || '',
      score: r.score,
      ...(r.modal ? { modal: r.modal } : {}),
    }));
}

function getFallbackTourResults() {
  const today = new Date();
  return sanitizeTourResults(
    TOUR_RESULTS_WEEK.map((r, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - Math.min(i, TOUR_RESULTS_WINDOW_DAYS - 1));
      return { ...r, date: d.toISOString().slice(0, 10) };
    }),
  );
}

function loadStoredTourNews() {
  try {
    const raw = localStorage.getItem(TOUR_DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.news) ? parsed.news : null;
  } catch (_) {
    return null;
  }
}

function saveTourNews(news) {
  const payload = { news, refreshedAt: new Date().toISOString() };
  try {
    localStorage.setItem(TOUR_DAILY_KEY, JSON.stringify(payload));
  } catch (_) { /* ignore quota */ }
  window.dispatchEvent(new CustomEvent('tour-news-updated', { detail: payload }));
  return news;
}

function buildTourNewsPrompt() {
  const ctx = getTourSeasonContext();
  return `You are a tennis news writer. Generate 4 current tennis world headlines for an amateur player to follow.

Today's date: ${new Date().toDateString()}.
Tour context: ${ctx.summary}
Do NOT write about Roland-Garros as if it is still in progress — it has concluded. Focus on the grass-court swing, Queen's/Halle, and Wimbledon prep as appropriate.

Return ONLY a JSON array — no markdown fence — of 4 objects with keys: when (e.g. "Jun 15"), t (headline, 8-14 words), d (1 sentence description, 15-25 words). Stay general — no fabricated exact scores or player names unless widely known public facts.`;
}

let tourNewsInFlight = null;

async function fetchTourNews() {
  if (tourNewsInFlight) return tourNewsInFlight;

  tourNewsInFlight = (async () => {
    if (window.claude?.complete) {
      try {
        const txt = await window.claude.complete(buildTourNewsPrompt());
        const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed) && parsed.length) return saveTourNews(parsed);
      } catch (_) { /* fall through to seed */ }
    }
    return saveTourNews(SEED_NEWS);
  })();

  try {
    return await tourNewsInFlight;
  } finally {
    tourNewsInFlight = null;
  }
}

function loadTourResultsCache() {
  try {
    const raw = localStorage.getItem(TOUR_RESULTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.results)) return null;
    return {
      results: sanitizeTourResults(parsed.results),
      refreshedAt: parsed.refreshedAt || null,
    };
  } catch (_) {
    return null;
  }
}

function isTourResultsStale(cache) {
  if (!cache?.refreshedAt) return true;
  return Date.now() - new Date(cache.refreshedAt).getTime() >= TOUR_RESULTS_REFRESH_MS;
}

function saveTourResultsCache(results, refreshedAt) {
  const payload = {
    results: sanitizeTourResults(results),
    refreshedAt: refreshedAt || new Date().toISOString(),
  };
  try {
    localStorage.setItem(TOUR_RESULTS_CACHE_KEY, JSON.stringify(payload));
  } catch (_) {
    /* ignore quota */
  }
  return payload;
}

async function fetchLiveTourResults() {
  try {
    const res = await fetch(`/api/tour-results-live?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const clean = sanitizeTourResults(data.results || []);
    return clean.length ? clean : null;
  } catch (_) {
    return null;
  }
}

async function refreshTourResultsCache({ force = false } = {}) {
  const cached = loadTourResultsCache();
  if (!force && cached && !isTourResultsStale(cached)) {
    return cached;
  }

  let results = await fetchLiveTourResults();
  if (!results?.length) {
    results = getFallbackTourResults();
  }

  return saveTourResultsCache(results);
}

function formatResultsRefreshedLabel(iso) {
  if (!iso) return 'just now';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function applyDailyTourRefresh(setNews, setDailyLabel) {
  const stored = loadStoredTourNews();
  if (stored?.length) {
    setNews(stored);
    try {
      const meta = JSON.parse(localStorage.getItem(TOUR_DAILY_KEY) || '{}');
      setDailyLabel(formatDailyLabel(meta.refreshedAt));
    } catch (_) {
      setDailyLabel(formatDailyLabel());
    }
    return;
  }
  setNews(SEED_NEWS);
  setDailyLabel(formatDailyLabel());
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

function filterResultsByTour(results, tourTab) {
  if (tourTab === 'ATP' || tourTab === 'WTA') {
    return results.filter((r) => r.tour === tourTab);
  }
  return results;
}

function WeekResultsModal({ results, onClose, onOpenTourney }) {
  const [tourTab, setTourTab] = useS1('all');
  const [query, setQuery] = useS1('');

  useE1(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredResults = useM1(() => {
    const q = query.trim().toLowerCase();
    const byTour = filterResultsByTour(results, tourTab);
    if (!q) return byTour;
    return byTour.filter((m) => {
      const dateLabel = formatResultWhen(m.date).toLowerCase();
      const rawDate = String(m.date || '').toLowerCase();
      return (
        m.winner.toLowerCase().includes(q) ||
        m.loser.toLowerCase().includes(q) ||
        m.tournament.toLowerCase().includes(q) ||
        m.round.toLowerCase().includes(q) ||
        dateLabel.includes(q) ||
        rawDate.includes(q)
      );
    });
  }, [results, tourTab, query]);

  const byDate = useM1(() => {
    const groups = {};
    filteredResults.forEach((m) => {
      if (!groups[m.date]) groups[m.date] = [];
      groups[m.date].push(m);
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({ date, matches: groups[date] }));
  }, [filteredResults]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal week-results-modal">
        <div className="modal-header">
          <div className="deco" aria-hidden="true"></div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
          <div className="kicker">Past {TOUR_RESULTS_WINDOW_DAYS} days</div>
          <h2>Week in results</h2>
          <div className="modal-meta">{filteredResults.length} matches · ATP &amp; WTA</div>
        </div>
        <div className="modal-body">
          <div className="week-results-controls">
            <div className="week-results-search-row">
              <input
                type="search"
                className="week-results-search"
                placeholder="Search player or date (e.g. May 27, 2026-05-27)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="tour-tabs week-results-tabs" role="tablist" aria-label="Result tours">
              {['all', 'ATP', 'WTA'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`btn-secondary${tourTab === tab ? ' active' : ''}`}
                  onClick={() => setTourTab(tab)}
                  style={{ padding: '6px 10px', fontSize: 11 }}
                >
                  {tab === 'all' ? 'All' : tab}
                </button>
              ))}
            </div>
          </div>
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
          {!filteredResults.length && (
            <p className="mono-small" style={{ margin: 0 }}>No matching results in this window yet.</p>
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
  const [news, setNews] = useS1(() => loadStoredTourNews() || SEED_NEWS);
  const [loading, setLoading] = useS1(false);
  const [resultsLoading, setResultsLoading] = useS1(false);
  const [modal, setModal] = useS1(null);
  const [showWeekResults, setShowWeekResults] = useS1(false);
  const [resultsTourTab, setResultsTourTab] = useS1('all');
  const [dailyLabel, setDailyLabel] = useS1(() => formatDailyLabel());
  const [tourResults, setTourResults] = useS1(() => getFallbackTourResults());
  const [resultsRefreshedAt, setResultsRefreshedAt] = useS1(null);

  const calendar = useM1(() => getCalendarWithStates(), []);
  const activeTournament = useM1(() => getActiveTournament(), []);
  const weekResults = useM1(
    () => filterActiveTournamentResults(tourResults),
    [tourResults],
  );
  const filteredWeekResults = useM1(
    () => filterResultsByTour(weekResults, resultsTourTab),
    [weekResults, resultsTourTab],
  );
  const recentResults = useM1(
    () => filteredWeekResults.slice(0, TOUR_RESULTS_PREVIEW),
    [filteredWeekResults],
  );

  const resultsRefreshedLabel = formatResultsRefreshedLabel(resultsRefreshedAt);

  const applyTourResultsCache = useC1((cache) => {
    if (cache?.results?.length) {
      setTourResults(cache.results);
      setResultsRefreshedAt(cache.refreshedAt);
    }
  }, []);

  const runResultsRefresh = useC1(async (force = false) => {
    setResultsLoading(true);
    try {
      const cache = await refreshTourResultsCache({ force });
      applyTourResultsCache(cache);
    } finally {
      setResultsLoading(false);
    }
  }, [applyTourResultsCache]);

  useE1(() => {
    applyDailyTourRefresh(setNews, setDailyLabel);

    const onNewsUpdated = (e) => {
      if (e.detail?.news?.length) {
        setNews(e.detail.news);
        setDailyLabel(formatDailyLabel(e.detail.refreshedAt));
      }
    };
    window.addEventListener('tour-news-updated', onNewsUpdated);

    const cached = loadTourResultsCache();
    if (cached && !isTourResultsStale(cached)) {
      applyTourResultsCache(cached);
    } else {
      runResultsRefresh(false);
    }

    return () => window.removeEventListener('tour-news-updated', onNewsUpdated);
  }, [applyTourResultsCache, runResultsRefresh]);

  useE1(() => {
    const intervalId = setInterval(() => {
      const cached = loadTourResultsCache();
      if (isTourResultsStale(cached)) runResultsRefresh(false);
    }, TOUR_RESULTS_REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const cached = loadTourResultsCache();
      if (isTourResultsStale(cached)) runResultsRefresh(false);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runResultsRefresh]);

  const refreshNews = async () => {
    setLoading(true);
    try {
      await fetchTourNews();
    } finally {
      setLoading(false);
    }
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
            {calendar.map((t, i) => {
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
            <div className="row between mb-12 recent-results-head">
              <div>
                <div className="recent-results-title-row">
                  <h3 style={{ margin: 0 }}>Recent Results</h3>
                  <button
                    type="button"
                    className="tour-results-refresh-btn"
                    onClick={() => runResultsRefresh(true)}
                    disabled={resultsLoading}
                    aria-label="Refresh recent results"
                    title="Refresh recent results"
                  >
                    {resultsLoading ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M21 12a9 9 0 11-2.64-6.36" />
                        <polyline points="21 3 21 9 15 9" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="mono-small">
                  {activeTournament ? `${activeTournament.name} · live scores` : `Last ${TOUR_RESULTS_WINDOW_DAYS} days`}
                  {' · '}
                  Updated {resultsRefreshedLabel} · auto every 6h
                  {' · '}
                  <a
                    className="tourney-link"
                    href={TOUR_SCORES_GOOGLE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    More on Google ↗
                  </a>
                </span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {['all', 'ATP', 'WTA'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`btn-secondary${resultsTourTab === tab ? ' active' : ''}`}
                      onClick={() => setResultsTourTab(tab)}
                      style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                      {tab === 'all' ? 'All' : tab}
                    </button>
                  ))}
                </div>
              </div>
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
                <p className="mono-small" style={{margin: 0}}>
                  {activeTournament
                    ? `No ${activeTournament.name} results yet — try refresh.`
                    : 'No recent results.'}
                </p>
              )}
            </div>
            {filteredWeekResults.length > 0 && (
              <button
                type="button"
                className="btn-secondary see-more-results"
                onClick={() => setShowWeekResults(true)}
              >
                {filteredWeekResults.length > TOUR_RESULTS_PREVIEW
                  ? `See more · ${filteredWeekResults.length} ${resultsTourTab === 'all' ? '' : resultsTourTab} matches`.trim()
                  : `See all ${filteredWeekResults.length} matches`}
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
const TODAY_LAYOUT_STORAGE = 'ace-today-layout';
const TERMS_LAYOUT_STORAGE = 'ace-toolkit-terms-layout';
const TOOLKIT_CARD_IDS = ['timer', 'gear', 'terms'];
const TODAY_CARD_IDS = ['focus', 'conditions', 'overview', 'skills', 'activity', 'recent'];
const TERMS_GRID_H = 6;
const TERMS_GRID_H_EXPANDED = 10;
const DEFAULT_GRID_H = 6;
/** ~300px at default row height + margin */
const TODAY_CARD_H_TALL = 6;
/** ~246px — closest grid fit to 240px */
const TODAY_CARD_H_SHORT = 5;
const TGL = typeof window !== 'undefined' ? window.ToolkitGridLayout : null;

function stampGridItem(item) {
  const base = { expanded: false, ...item };
  return { ...base, defaultH: base.defaultH ?? base.h };
}

function gridRowsFromPanelPx(px, config) {
  const rowHeight = config?.rowHeight ?? 30;
  const marginY = config?.margin?.[1] ?? 24;
  const rowUnit = rowHeight + marginY;
  return Math.max(1, Math.ceil((px + marginY) / rowUnit));
}

function gridRowsToPanelPx(rows, config) {
  const rowHeight = config?.rowHeight ?? 30;
  const marginY = config?.margin?.[1] ?? 24;
  return rows * rowHeight + Math.max(0, rows - 1) * marginY;
}

function measurePanelGridRows(panelEl, gridConfig, minRows) {
  panelEl.classList.add('is-measuring');
  const bodyEl = panelEl.querySelector('.toolkit-panel-body');
  if (bodyEl) bodyEl.classList.add('is-measuring');

  // Measure natural content height (expanded body uses 16px bottom padding).
  const totalPx = panelEl.offsetHeight;

  panelEl.classList.remove('is-measuring');
  if (bodyEl) bodyEl.classList.remove('is-measuring');

  return Math.max(minRows, gridRowsFromPanelPx(totalPx, gridConfig));
}

const TOOLKIT_CARD_TITLES = {
  timer: 'Drill Timer',
  gear: 'Gear Reminders',
  terms: 'Tennis terms & words',
};

const TODAY_CARD_TITLES = {
  focus: 'Weekly Focus · From Notion',
  conditions: 'Court Conditions',
  overview: 'Practice Overview',
  skills: 'Top Skills Practiced',
  activity: 'Activity',
  recent: 'Recent Sessions',
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

function makeDefaultToolkitItems(cols) {
  if (cols <= 6) {
    return [
      stampGridItem({ i: 'timer', x: 0, y: 0, w: 6, h: DEFAULT_GRID_H }),
      stampGridItem({ i: 'gear', x: 0, y: DEFAULT_GRID_H, w: 6, h: DEFAULT_GRID_H }),
      stampGridItem({ i: 'terms', x: 0, y: DEFAULT_GRID_H * 2, w: 6, h: TERMS_GRID_H }),
    ];
  }
  return [
    stampGridItem({ i: 'timer', x: 0, y: 0, w: 6, h: DEFAULT_GRID_H }),
    stampGridItem({ i: 'gear', x: 6, y: 0, w: 6, h: DEFAULT_GRID_H }),
    stampGridItem({ i: 'terms', x: 0, y: DEFAULT_GRID_H, w: 12, h: TERMS_GRID_H }),
  ];
}

function makeDefaultTodayItems(cols) {
  const focusH = DEFAULT_GRID_H;
  if (cols <= 6) {
    return [
      stampGridItem({ i: 'focus', x: 0, y: 0, w: 6, h: focusH }),
      stampGridItem({ i: 'overview', x: 0, y: focusH, w: 6, h: TODAY_CARD_H_SHORT }),
      stampGridItem({ i: 'skills', x: 0, y: focusH + TODAY_CARD_H_SHORT, w: 6, h: TODAY_CARD_H_SHORT }),
      stampGridItem({ i: 'activity', x: 0, y: focusH + TODAY_CARD_H_SHORT * 2, w: 6, h: TODAY_CARD_H_TALL }),
      stampGridItem({ i: 'recent', x: 0, y: focusH + TODAY_CARD_H_SHORT * 2 + TODAY_CARD_H_TALL, w: 6, h: TODAY_CARD_H_TALL }),
      stampGridItem({ i: 'conditions', x: 0, y: focusH + TODAY_CARD_H_SHORT * 2 + TODAY_CARD_H_TALL * 2, w: 6, h: TODAY_CARD_H_TALL }),
    ];
  }
  const row2Y = focusH;
  const row3Y = focusH + TODAY_CARD_H_SHORT;
  const row4Y = row3Y + TODAY_CARD_H_TALL;
  return [
    stampGridItem({ i: 'focus', x: 0, y: 0, w: 12, h: focusH }),
    stampGridItem({ i: 'overview', x: 0, y: row2Y, w: 4, h: TODAY_CARD_H_SHORT }),
    stampGridItem({ i: 'skills', x: 4, y: row2Y, w: 4, h: TODAY_CARD_H_SHORT }),
    stampGridItem({ i: 'activity', x: 0, y: row3Y, w: 8, h: TODAY_CARD_H_TALL }),
    stampGridItem({ i: 'recent', x: 8, y: row3Y, w: 4, h: TODAY_CARD_H_TALL }),
    stampGridItem({ i: 'conditions', x: 0, y: row4Y, w: 4, h: TODAY_CARD_H_TALL }),
  ];
}

function normalizeGridItem(raw, cols, def) {
  const defaultH = typeof raw.defaultH === 'number' ? raw.defaultH : (def?.defaultH ?? def?.h ?? DEFAULT_GRID_H);
  const item = {
    i: raw.i,
    x: typeof raw.x === 'number' ? raw.x : (def?.x ?? 0),
    y: typeof raw.y === 'number' ? raw.y : (def?.y ?? 0),
    w: TGL ? TGL.clamp(typeof raw.w === 'number' ? raw.w : (def?.w ?? 6), 1, cols) : 6,
    h: TGL ? TGL.clamp(typeof raw.h === 'number' ? raw.h : defaultH, 1, 24) : defaultH,
    defaultH,
    expanded: !!raw.expanded,
  };
  item.x = TGL ? TGL.clamp(item.x, 0, Math.max(0, cols - item.w)) : item.x;
  item.y = Math.max(0, item.y);
  return item;
}

function normalizeToolkitItem(raw, cols) {
  const def = makeDefaultToolkitItems(cols).find((it) => it.i === raw.i);
  return normalizeGridItem(raw, cols, def);
}

function normalizeTodayItem(raw, cols) {
  const def = makeDefaultTodayItems(cols).find((it) => it.i === raw.i);
  const item = normalizeGridItem(raw, cols, def);
  if (item.i === 'focus') {
    item.w = cols;
    item.x = 0;
  }
  return item;
}

function makeDefaultToolkitLayout(containerWidth) {
  const cols = containerWidth <= 920 ? 6 : 12;
  return { mode: 'grid', items: makeDefaultToolkitItems(cols) };
}

function makeDefaultTodayLayout(containerWidth) {
  const cols = containerWidth <= 920 ? 6 : 12;
  return { mode: 'grid', items: makeDefaultTodayItems(cols) };
}

function loadGridLayout({ storageKey, cardIds, makeDefaultItems, normalizeItem }) {
  const fallbackWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const cols = fallbackWidth <= 920 ? 6 : 12;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j.items) && j.items.length === cardIds.length
        && cardIds.every((id) => j.items.some((it) => it.i === id))) {
        const items = cardIds.map((id) => {
          const found = j.items.find((it) => it.i === id);
          return normalizeItem(found || { i: id, x: 0, y: 0, w: 6, h: DEFAULT_GRID_H }, cols);
        });
        return { mode: j.mode === 'dashboard' ? 'dashboard' : 'grid', items };
      }
      if ((j.mode === 'dashboard' || j.mode === 'grid') && j.cards
        && cardIds.every((id) => j.cards[id])) {
        return {
          mode: j.mode === 'dashboard' ? 'dashboard' : 'grid',
          items: makeDefaultItems(cols),
        };
      }
    }
    if (storageKey === TOOLKIT_LAYOUT_STORAGE) {
      const oldRaw = localStorage.getItem(TERMS_LAYOUT_STORAGE);
      if (oldRaw) {
        const old = JSON.parse(oldRaw);
        if (typeof old.h === 'number') {
          const layout = makeDefaultToolkitLayout(fallbackWidth);
          const termsItem = layout.items.find((it) => it.i === 'terms');
          if (termsItem && old.h > 300) {
            termsItem.expanded = true;
            termsItem.h = TERMS_GRID_H_EXPANDED;
            termsItem.defaultH = TERMS_GRID_H;
          }
          return layout;
        }
      }
    }
  } catch (e) { /* keep default */ }
  const items = makeDefaultItems(cols);
  return { mode: 'grid', items };
}

function loadToolkitLayout() {
  return loadGridLayout({
    storageKey: TOOLKIT_LAYOUT_STORAGE,
    cardIds: TOOLKIT_CARD_IDS,
    makeDefaultItems: makeDefaultToolkitItems,
    normalizeItem: normalizeToolkitItem,
  });
}

function loadTodayLayout() {
  return loadGridLayout({
    storageKey: TODAY_LAYOUT_STORAGE,
    cardIds: TODAY_CARD_IDS,
    makeDefaultItems: makeDefaultTodayItems,
    normalizeItem: normalizeTodayItem,
  });
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

function getDashboardPanelHeight(item, mode, config) {
  if (mode === 'grid') {
    return gridRowsToPanelPx(item.h, config);
  }
  return null;
}

function useDraggableDashboardGrid({ storageKey, loadLayout, makeDefaultLayout, getGridConfig }) {
  const [layout, setLayout] = useS1(loadLayout);
  const [draggingId, setDraggingId] = useS1(null);
  const [dropSlot, setDropSlot] = useS1(null);
  const dropSlotRef = useR1(null);
  const [resizingId, setResizingId] = useS1(null);
  const [containerWidth, setContainerWidth] = useS1(
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );
  const layoutRef = useR1(layout);
  const wrapRef = useR1(null);
  const dashboardRef = useR1(null);

  useE1(() => { layoutRef.current = layout; }, [layout]);
  useE1(() => { dropSlotRef.current = dropSlot; }, [dropSlot]);

  const getDashboardRect = useC1(() => {
    const el = dashboardRef.current || wrapRef.current;
    return el ? el.getBoundingClientRect() : null;
  }, []);

  const gridConfig = useM1(
    () => (getGridConfig || getToolkitGridConfig)(containerWidth),
    [containerWidth, getGridConfig],
  );

  useE1(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const persistLayout = useC1((next) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) { /* ignore */ }
  }, [storageKey]);

  const updateLayout = useC1((updater) => {
    setLayout((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      layoutRef.current = next;
      persistLayout(next);
      return next;
    });
  }, [persistLayout]);

  const ensureDashboardMode = useC1(() => {
    if (layoutRef.current.mode === 'dashboard') return layoutRef.current;
    const wrap = wrapRef.current;
    if (!wrap || !TGL) return layoutRef.current;
    const next = captureGridAsDashboardItems(wrap, layoutRef.current, gridConfig);
    layoutRef.current = next;
    setLayout(next);
    persistLayout(next);
    return next;
  }, [gridConfig, persistLayout]);

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
    const positions = TGL.calcDashboardPositions(preview, gridConfig, containerWidth);
    return TGL.calcContainerHeightFromPositions(positions, gridConfig);
  }, [layout.mode, layout.items, draggingId, dropSlot, gridConfig, containerWidth]);

  const attachDrag = useC1((cardId, ev) => {
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

  const attachResize = useC1((cardId, ev) => {
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
        containerWidth,
      );
      setLayout((prev) => {
        const resized = TGL.resizeItemGrid(
          prev.items,
          cardId,
          startW + delta.dw,
          startH + delta.dh,
          gridConfig.cols,
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

  const toggleExpand = useC1((cardId) => {
    updateLayout((prev) => {
      const items = prev.items.map((item) => {
        if (item.i !== cardId) return item;
        const expanded = !item.expanded;
        if (expanded) {
          return { ...item, expanded: true };
        }
        const defaultH = item.defaultH ?? item.h;
        return { ...item, expanded: false, h: defaultH, measuredPx: undefined };
      });
      const reflowed = TGL ? TGL.reflowPreserveLayout(items, gridConfig.cols) : items;
      return { ...prev, items: reflowed };
    });
  }, [gridConfig.cols, updateLayout]);

  const setItemGridHeight = useC1((cardId, h, measuredPx) => {
    if (!TGL) return;
    updateLayout((prev) => {
      const items = prev.items.map((item) => {
        if (item.i !== cardId) return item;
        return {
          ...item,
          h: TGL.clamp(h, 1, 24),
          measuredPx: typeof measuredPx === 'number' ? measuredPx : item.measuredPx,
        };
      });
      const reflowed = TGL.reflowPreserveLayout(items, gridConfig.cols);
      return { ...prev, items: reflowed };
    });
  }, [gridConfig.cols, updateLayout]);

  const resetLayout = useC1(() => {
    if (!makeDefaultLayout) return;
    const next = makeDefaultLayout(containerWidth);
    layoutRef.current = next;
    setLayout(next);
    persistLayout(next);
  }, [containerWidth, makeDefaultLayout, persistLayout]);

  const placeholderStyle = useM1(() => {
    if (!TGL || !dropSlot || layout.mode !== 'dashboard') return null;
    return TGL.calcPosition(dropSlot, gridConfig, containerWidth);
  }, [dropSlot, layout.mode, gridConfig, containerWidth]);

  return {
    layout,
    wrapRef,
    dashboardRef,
    draggingId,
    resizingId,
    containerWidth,
    gridConfig,
    attachDrag,
    attachResize,
    toggleExpand,
    setItemGridHeight,
    resetLayout,
    dashboardLayout,
    canvasHeight,
    placeholderStyle,
  };
}

function DashboardGrid({
  layout,
  wrapRef,
  dashboardRef,
  draggingId,
  resizingId,
  containerWidth,
  gridConfig,
  attachDrag,
  attachResize,
  toggleExpand,
  setItemGridHeight,
  dashboardLayout,
  canvasHeight,
  placeholderStyle,
  cardTitles,
  renderCardContent,
  getPanelVariant,
}) {
  const handleMeasureExpanded = useC1((cardId, panelEl) => {
    const item = layout.items.find((it) => it.i === cardId);
    const minRows = item?.defaultH ?? item?.h ?? DEFAULT_GRID_H;
    const measuredPx = panelEl.offsetHeight;
    const rows = measurePanelGridRows(panelEl, gridConfig, minRows);
    if (item && (item.h !== rows || item.measuredPx !== measuredPx)) {
      setItemGridHeight(cardId, rows, measuredPx);
    }
  }, [layout.items, gridConfig, setItemGridHeight]);

  const dashboardPositions = useM1(() => {
    if (!TGL || layout.mode !== 'dashboard') return null;
    const items = layout.mode === 'dashboard' ? dashboardLayout : layout.items;
    return TGL.calcDashboardPositions(items, gridConfig, containerWidth);
  }, [layout.mode, dashboardLayout, layout.items, gridConfig, containerWidth]);

  const positionById = useM1(() => {
    if (!dashboardPositions) return {};
    return Object.fromEntries(dashboardPositions.map((p) => [p.i, p]));
  }, [dashboardPositions]);

  return (
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
            ? (positionById[item.i] || TGL.calcPosition(item, gridConfig, containerWidth))
            : null;
          return (
            <ToolkitPanel
              key={item.i}
              id={item.i}
              title={cardTitles[item.i] || item.i}
              mode={layout.mode}
              item={item}
              pixelStyle={pixelStyle}
              isDragging={draggingId === item.i}
              expanded={!!item.expanded}
              gridConfig={gridConfig}
              onDragStart={attachDrag}
              onResizeStart={attachResize}
              onToggleExpand={toggleExpand}
              onMeasureExpanded={handleMeasureExpanded}
              variant={getPanelVariant ? getPanelVariant(item.i) : ''}
            >
              {renderCardContent(item.i, item)}
            </ToolkitPanel>
          );
        })}
      </div>
    </div>
  );
}

function ToolkitPanel({
  id,
  title,
  mode,
  item,
  pixelStyle,
  isDragging,
  expanded,
  gridConfig,
  onDragStart,
  onResizeStart,
  onToggleExpand,
  onMeasureExpanded,
  variant = '',
  children,
}) {
  const panelRef = useR1(null);
  const bodyRef = useR1(null);
  const [hasOverflow, setHasOverflow] = useS1(false);

  useE1(() => {
    const body = bodyRef.current;
    if (!body || expanded) return undefined;

    const check = () => {
      setHasOverflow(detectPanelBodyOverflow(body));
    };

    check();
    const rafId = requestAnimationFrame(check);

    let ro;
    let mo;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(check);
      ro.observe(body);
      body.querySelectorAll('*').forEach((el) => {
        try { ro.observe(el); } catch (_) { /* skip non-elements */ }
      });
    }

    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        if (ro) {
          body.querySelectorAll('*').forEach((el) => {
            try { ro.observe(el); } catch (_) { /* skip */ }
          });
        }
        check();
      });
      mo.observe(body, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [expanded, children]);

  useE1(() => {
    if (!expanded || !panelRef.current || !onMeasureExpanded) return undefined;

    let rafId = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (panelRef.current) onMeasureExpanded(id, panelRef.current);
      });
    };

    scheduleMeasure();
    const secondPass = requestAnimationFrame(scheduleMeasure);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleMeasure);
      if (panelRef.current) ro.observe(panelRef.current);
      if (bodyRef.current) ro.observe(bodyRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(secondPass);
      ro?.disconnect();
    };
  }, [expanded, children, id, onMeasureExpanded]);

  const showExpand = hasOverflow || expanded;
  const gridHeight = getDashboardPanelHeight(item, mode, gridConfig || TGL?.DEFAULT_CONFIG);
  const panelStyle = mode === 'dashboard' && pixelStyle
    ? {
        left: pixelStyle.left,
        top: pixelStyle.top,
        width: pixelStyle.width,
        height: expanded ? (item.measuredPx ?? 'auto') : pixelStyle.height,
      }
    : expanded
      ? { '--panel-min-h': `${gridHeight}px`, height: 'auto' }
      : { '--panel-min-h': `${gridHeight}px` };

  return (
    <div
      ref={panelRef}
      data-toolkit-id={id}
      className={`toolkit-panel card drag-handle${variant ? ` ${variant}` : ''}${mode === 'dashboard' ? ' is-dashboard' : ''}${isDragging ? ' is-dragging' : ''}${expanded ? ' is-panel-expanded' : ''}`}
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
      <div className="toolkit-panel-body" ref={bodyRef}>{children}</div>
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

  const toolkitGrid = useDraggableDashboardGrid({
    storageKey: TOOLKIT_LAYOUT_STORAGE,
    loadLayout: loadToolkitLayout,
  });

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

  const renderToolkitCard = (id) => {
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
      case 'gear':
        return <ToolkitGearContent gear={gear} />;
      case 'terms':
        return <ToolkitTermsContent />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Toolkit · Bonus utilities</div>
          <h1>Everything <em>else</em> you need.</h1>
        </div>
        <div className="meta">Drag to rearrange · Expand terms for full glossary</div>
      </div>

      <DashboardGrid
        {...toolkitGrid}
        cardTitles={TOOLKIT_CARD_TITLES}
        renderCardContent={renderToolkitCard}
      />
    </>
  );
}

window.Today = Today;
window.Tips = Tips;
window.GameCheatNotes = GameCheatNotes;
window.Calendar = Calendar;
window.Toolkit = Toolkit;
window.fetchTourNewsOnLoad = fetchTourNews;
window.getCalendarWithStates = getCalendarWithStates;
