/**
 * Live tour results from ESPN tennis scoreboards (ATP + WTA).
 * Collects matches from every event on the current scoreboard.
 */
const ESPN_ATP = 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard';
const ESPN_WTA = 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard';
const QUALIFYING_RE = /qualifying/i;

function abbreviateRound(displayName) {
  if (!displayName) return 'R32';
  const d = displayName.trim();
  if (/^final$/i.test(d)) return 'Final';
  if (/semi/i.test(d)) return 'SF';
  if (/quarter/i.test(d)) return 'QF';
  if (/round\s*of\s*128|round\s*1\b|1st round|first round/i.test(d) && !QUALIFYING_RE.test(d)) {
    return 'R128';
  }
  if (/round\s*of\s*64|round\s*2\b|2nd round/i.test(d) && !QUALIFYING_RE.test(d)) return 'R64';
  if (/round\s*of\s*32|round\s*3\b|3rd round/i.test(d) && !QUALIFYING_RE.test(d)) return 'R32';
  if (/round\s*of\s*16|round\s*4\b|4th round/i.test(d)) return 'R16';
  if (QUALIFYING_RE.test(d)) return 'Q';
  return d.length > 12 ? d.replace(/\s+/g, ' ').slice(0, 12) : d;
}

function formatSetScore(linescores) {
  if (!Array.isArray(linescores) || !linescores.length) return '';
  return linescores
    .map((ls) => {
      const games = Math.round(Number(ls.value) || 0);
      if (ls.tiebreak != null && ls.tiebreak !== '') {
        return `${games}(${ls.tiebreak})`;
      }
      return String(games);
    })
    .join('  ')
    .replace(/-/g, '—');
}

function athleteLabel(competitor) {
  const athlete = competitor?.athlete || {};
  const name = athlete.shortName || athlete.displayName || 'Unknown';
  const country = athlete.flag?.alt || '';
  const seed = competitor?.seed || athlete.seed;
  const seedPart = seed ? ` · #${seed}` : '';
  return {
    name: name.includes('.') ? name : formatDisplayName(athlete.displayName || name),
    sub: country ? `${country}${seedPart}` : seedPart.replace(/^ · /, ''),
  };
}

function formatDisplayName(full) {
  if (!full) return 'Unknown';
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

function setsWon(linescores) {
  return (linescores || []).filter((ls) => ls.winner === true).length;
}

function resolveWinnerLoser(competitors, state) {
  let winner = competitors.find((c) => c.winner === true);
  let loser = competitors.find((c) => c.winner === false);

  if ((!winner || !loser) && state === 'post') {
    const ranked = [...competitors].sort((a, b) => setsWon(b.linescores) - setsWon(a.linescores));
    if (ranked[0] && ranked[1] && setsWon(ranked[0].linescores) > setsWon(ranked[1].linescores)) {
      winner = ranked[0];
      loser = ranked[1];
    }
  }

  if ((!winner || !loser) && state === 'in') {
    return { winner: competitors[0], loser: competitors[1], live: true };
  }

  if (!winner || !loser) return null;
  return { winner, loser, live: false };
}

function mapCompetition(competition, tour, tournamentName) {
  const competitors = (competition.competitors || []).filter(
    (c) => c.athlete?.displayName || c.athlete?.shortName,
  );
  if (competitors.length < 2) return null;

  const state = competition.status?.type?.state;
  if (state !== 'post' && state !== 'in') return null;

  const resolved = resolveWinnerLoser(competitors, state);
  if (!resolved) return null;

  const { winner, loser, live } = resolved;
  const w = athleteLabel(winner);
  const l = athleteLabel(loser);
  if (w.name === 'Unknown' || l.name === 'Unknown') return null;

  const score = live ? 'Live' : formatSetScore(winner.linescores);
  if (!score || score === '') return null;

  const dateSrc = competition.startDate || competition.date;
  const date = dateSrc ? String(dateSrc).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const round = abbreviateRound(competition.round?.displayName);

  return {
    id: `espn-${tour}-${competition.id}`,
    date,
    tournament: tournamentName,
    round,
    tour,
    winner: w.name,
    winnerSub: w.sub,
    loser: l.name,
    loserSub: l.sub,
    score,
    status: state,
    sortPriority: state === 'in' ? 0 : state === 'post' ? 1 : 2,
  };
}

function collectCompetitions(event, tour) {
  const tournamentName = event.name || event.shortName || 'Tournament';
  const out = [];

  const addList = (list, tourLabel = tour) => {
    for (const comp of list || []) {
      const row = mapCompetition(comp, tourLabel, tournamentName);
      if (row) out.push(row);
    }
  };

  if (event.groupings?.length) {
    for (const g of event.groupings) {
      const tourLabel = /women|wta/i.test(g.grouping?.slug || '') ||
        /women/i.test(g.grouping?.displayName || '')
        ? 'WTA'
        : tour;
      addList(g.competitions, tourLabel);
    }
  } else {
    addList(event.competitions);
  }

  return out;
}

function collectAllEvents(data, tour) {
  const events = data?.events || [];
  let results = [];
  for (const event of events) {
    results.push(...collectCompetitions(event, tour));
  }
  return results;
}

async function fetchScoreboard(url, tour) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ESPN ${tour} ${res.status}`);
  return res.json();
}

function sortResults(results) {
  return results.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const mainA = a.round === 'Q' ? 1 : 0;
    const mainB = b.round === 'Q' ? 1 : 0;
    if (mainA !== mainB) return mainA - mainB;
    return String(b.id).localeCompare(String(a.id));
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const [atpData, wtaData] = await Promise.all([
      fetchScoreboard(ESPN_ATP, 'ATP'),
      fetchScoreboard(ESPN_WTA, 'WTA'),
    ]);

    let results = [
      ...collectAllEvents(atpData, 'ATP'),
      ...collectAllEvents(wtaData, 'WTA'),
    ];

    results = results.filter((r) => r.status === 'post' || r.status === 'in');
    results = sortResults(results);

    const mainDraw = results.filter((r) => r.round !== 'Q');
    if (mainDraw.length) results = mainDraw;

    results = results.map(({ status, sortPriority, ...rest }) => rest);

    const seen = new Set();
    results = results.filter((r) => {
      const key = `${r.id}-${r.winner}-${r.loser}-${r.score}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    results = results.slice(0, 80);

    const tournaments = [...new Set(results.map((r) => r.tournament))];

    return res.status(200).json({
      tournaments,
      results,
      refreshedAt: new Date().toISOString(),
      source: 'espn',
    });
  } catch (e) {
    return res.status(502).json({
      error: e.message,
      tournaments: [],
      results: [],
      refreshedAt: new Date().toISOString(),
      source: 'espn',
    });
  }
}
