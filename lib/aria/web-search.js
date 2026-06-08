async function webKnowledge(message) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx) {
    return {
      source: 'local-fallback',
      answer: 'Web search is ready but not configured. Add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to `.env` to enable it.',
      links: []
    };
  }
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cx);
  url.searchParams.set('q', message);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Google search failed: ${response.status}`);
  const data = await response.json();
  const items = (data.items || []).slice(0, 5);
  return {
    source: 'google-custom-search',
    answer: items.map((item, index) => `${index + 1}. ${item.title}: ${item.snippet}`).join('\n'),
    links: items.map(item => ({ title: item.title, url: item.link }))
  };
}

module.exports = { webKnowledge };
