(() => {
  const existing = window.__PAPER_AGENT_CONFIG__ || {};
  const guess = window.location.hostname.endsWith('github.io')
    ? 'https://inhalc.github.io/ARC/'
    : 'http://localhost:8000';
  const apiBase = (existing.apiBase || guess).replace(/\/$/, '');
  window.__PAPER_AGENT_CONFIG__ = {
    ...existing,
    apiBase,
  };
})();
