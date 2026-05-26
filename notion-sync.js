/* global React */
/**
 * Loads latest reflection from Notion (API when configured) or notion-data.json fallback.
 */
const NOTION_SYNC_STORAGE_KEY = 'tennis-notion-sync-v1';

function formatNotionNotes(payload) {
  if (payload?.notesDraft) return payload.notesDraft;
  const d = payload?.latestDaily;
  if (!d) return '';
  const lines = [`Context: ${d.context || 'Practice session'}`];
  if (d.good?.length) {
    lines.push('', 'Good:');
    d.good.forEach((g) => lines.push(`- ${g}`));
  }
  const needs = [...(d.bad || []), ...(d.learning || [])];
  if (needs.length) {
    lines.push('', 'Needs work:');
    needs.forEach((n) => lines.push(`- ${n}`));
  }
  if (payload.weeklyPriorities?.length) {
    lines.push('', 'Weekly focus (from Notion):');
    payload.weeklyPriorities.forEach((p) => lines.push(`- ${p}`));
  }
  return lines.join('\n');
}

function loadNotionSyncMeta() {
  try {
    const raw = localStorage.getItem(NOTION_SYNC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveNotionSyncMeta(meta) {
  try {
    localStorage.setItem(NOTION_SYNC_STORAGE_KEY, JSON.stringify(meta));
  } catch (e) {}
}

async function fetchNotionInsights() {
  try {
    const res = await fetch('/api/notion-insights', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.latestDaily || data?.notesDraft) return { ...data, source: data.source || 'api' };
    }
  } catch (e) {
    /* fallback below */
  }
  const fallback = await fetch('notion-data.json', { cache: 'no-store' });
  if (!fallback.ok) throw new Error('Could not load Notion insights');
  const data = await fallback.json();
  return { ...data, source: 'snapshot' };
}

function useNotionInsights() {
  const [payload, setPayload] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotionInsights();
      setPayload(data);
      saveNotionSyncMeta({
        updatedAt: data.updatedAt,
        importedAt: new Date().toISOString(),
        source: data.source,
      });
      return data;
    } catch (e) {
      setError(e.message || 'Sync failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const isNewerThanLastImport = React.useMemo(() => {
    if (!payload?.updatedAt) return false;
    const meta = loadNotionSyncMeta();
    if (!meta?.importedAt) return true;
    return new Date(payload.updatedAt) > new Date(meta.importedAt);
  }, [payload]);

  return {
    payload,
    loading,
    error,
    refresh,
    notesDraft: payload ? formatNotionNotes(payload) : '',
    isNewerThanLastImport,
    weeklyPriorities: payload?.weeklyPriorities || [],
  };
}

window.useNotionInsights = useNotionInsights;
window.formatNotionNotes = formatNotionNotes;
window.fetchNotionInsights = fetchNotionInsights;
