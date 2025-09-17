(() => {
  const existing = window.__PAPER_AGENT_CONFIG__ || {};
  const guess = window.location.hostname.endsWith('github.io')
    ? 'https://inhalc.github.io/ARC'
    : '';
  const candidate = existing.apiBase == null ? guess : existing.apiBase;
  const apiBase = String(candidate).replace(/\/$/, '');
  window.__PAPER_AGENT_CONFIG__ = {
    ...existing,
    apiBase,
  };
})();
