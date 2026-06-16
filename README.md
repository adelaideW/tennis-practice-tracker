# Ace · Tennis Practice Tracker

Practice tips and session notes sync from [Tennis practice insights](https://www.notion.so/Tennis-practice-insights-32470a7de7e0803e9f3ad8904cf25efe) on Notion.

## Notion sync

- **Today dashboard** loads sessions, stats, charts, and focus brief from Notion — no manual logging.
- Add **Daily reflection** entries in Notion; use **Refresh from Notion** on the dashboard to pull updates.
- **Sharpen the craft** ranks your **top 5 improvement areas** from all Notion notes (latest **Weekly insights** priorities + every daily reflection), with matched tips, drills, and YouTube/article links. Use **Refresh from Notion** after you log new notes — weekly priorities and daily reflections both update live when `NOTION_TOKEN` is set on Vercel.

### Live API (optional)

On Vercel, set:

- `NOTION_TOKEN` — integration token with read access to the insights page
- `NOTION_PAGE_ID` — optional; defaults to `32470a7de7e0803e9f3ad8904cf25efe`
- `ANTHROPIC_API_KEY` — optional; powers AI tip suggestions on **Sharpen the craft** (without it, tips use smart heuristics from your notes)

Without a token, the app uses `notion-data.json` (update this snapshot after editing Notion).

```bash
# One-time: add token to Vercel (production + preview)
NOTION_TOKEN=secret_… node scripts/setup-vercel-notion-env.mjs
npx vercel deploy --prod --yes

# Refresh offline snapshot after Notion edits
NOTION_TOKEN=secret_… node scripts/sync-notion-snapshot.mjs
```

### Live tour results

Recent Results on the Calendar tab loads live matches from ESPN via `/api/tour-results-live` (refreshes every 6 hours).

## Local preview

```bash
npx serve .
```

Open the Today tab to verify sessions and focus brief load from Notion.
