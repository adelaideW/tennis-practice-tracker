# Baseline · Tennis Practice Tracker

Practice tips and session notes sync from [Tennis practice insights](https://www.notion.so/Tennis-practice-insights-32470a7de7e0803e9f3ad8904cf25efe) on Notion.

## Notion sync

- **Practice Log** auto-imports the latest daily reflection when notes are empty or when Notion has newer content.
- **Import from Notion** pulls the latest reflection on demand.
- **Practice Tips** are curated from your weekly priorities in Notion (items marked **Notion focus**).

### Live API (optional)

On Vercel, set:

- `NOTION_TOKEN` — integration token with read access to the insights page
- `NOTION_PAGE_ID` — optional; defaults to `32470a7de7e0803e9f3ad8904cf25efe`

Without a token, the app uses `notion-data.json` (update this snapshot after editing Notion).

## Local preview

```bash
npx serve .
```

Open the Practice Log tab to verify Notion notes import.
