(() => {
  const existing = window.__PAPER_AGENT_CONFIG__ || {};
  const guess = window.location.hostname.endsWith('github.io')
    ? 'https://YOUR-BACKEND-DOMAIN.example.com'
    : 'http://localhost:8000';
  const apiBase = (existing.apiBase || guess).replace(/\/$/, '');
  window.__PAPER_AGENT_CONFIG__ = {
    ...existing,
    apiBase,
  };
})();
