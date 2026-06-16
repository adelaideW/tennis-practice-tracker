/**
 * Vercel serverless: AI practice tips from Notion journal notes.
 * Requires ANTHROPIC_API_KEY on Vercel (optional — client falls back to heuristics).
 */

function buildPrompt(areaTitle, category, quotes, seed) {
  const quoteList = quotes.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return [
    'You are a thoughtful tennis coach for an amateur player.',
    `Focus area: ${areaTitle} (${category}).`,
    'Below are raw notes copied from their Notion practice journal.',
    'Turn each note into ONE distinct practice tip — do not copy the note verbatim as the title or body.',
    'Each tip needs a punchy headline (under 10 words), a practical body (1–2 sentences, under 220 chars), and a concrete drill (under 90 chars).',
    'Vary the advice: mechanics, footwork, tempo, targets, or mental cues as appropriate.',
    `Refresh seed ${seed} — slightly vary phrasing from prior runs.`,
    'Respond with JSON only (no markdown fence): an array of objects with keys "h", "p", "drill".',
    `Generate exactly ${quotes.length} tip(s), in the same order as the notes.`,
    'Notes:',
    quoteList,
  ].join('\n');
}

function parseTips(raw, expectedCount) {
  const cleaned = String(raw || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  const list = Array.isArray(parsed) ? parsed : parsed?.tips;
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => ({
      h: String(t.h || '').trim(),
      p: String(t.p || '').trim(),
      drill: String(t.drill || '').trim(),
    }))
    .filter((t) => t.h && t.p && t.drill)
    .slice(0, expectedCount);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI not configured', tips: [] });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const quotes = Array.isArray(body?.quotes) ? body.quotes.map(String).filter(Boolean) : [];
  if (!quotes.length) {
    return res.status(400).json({ error: 'quotes required' });
  }

  const areaTitle = String(body.areaTitle || 'Practice focus');
  const category = String(body.category || 'groundstrokes');
  const seed = Number(body.seed) || 0;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: buildPrompt(areaTitle, category, quotes, seed),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error', response.status, errText);
      return res.status(502).json({ error: 'AI request failed', tips: [] });
    }

    const data = await response.json();
    const text = data?.content?.find((c) => c.type === 'text')?.text || '';
    const tips = parseTips(text, quotes.length);

    if (!tips.length) {
      return res.status(502).json({ error: 'Could not parse AI response', tips: [] });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ tips, source: 'anthropic' });
  } catch (err) {
    console.error('generate-tip-suggestions', err);
    return res.status(500).json({ error: 'Server error', tips: [] });
  }
}
