# Baseline · Tennis Practice Tracker

Practice tips and session notes sync from [Tennis practice insights](https://www.notion.so/Tennis-practice-insights-32470a7de7e0803e9f3ad8904cf25efe) on Notion.

## Notion sync

- **Today dashboard** loads sessions, stats, charts, and focus brief from Notion — no manual logging.
- Add **Daily reflection** entries in Notion; use **Refresh from Notion** on the dashboard to pull updates.
- **Sharpen the craft** ranks your **top 5 improvement areas** from all Notion notes (weekly priorities + every daily reflection), with matched tips, drills, and YouTube/article links. Use **Refresh from Notion** after you log new notes.

### Live API (optional)

On Vercel, set:

- `NOTION_TOKEN` — integration token with read access to the insights page
- `NOTION_PAGE_ID` — optional; defaults to `32470a7de7e0803e9f3ad8904cf25efe`

Without a token, the app uses `notion-data.json` (update this snapshot after editing Notion).

## Local preview

```bash
npx serve .
```

Open the Today tab to verify sessions and focus brief load from Notion.
