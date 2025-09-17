
const config = window.__PAPER_AGENT_CONFIG__ || { apiBase: '' };
const API_BASE = (typeof config.apiBase === 'string' ? config.apiBase : '').replace(/\/$/, '');

const form = document.getElementById('search-form');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const downloadMdBtn = document.getElementById('download-md');
const downloadCsvBtn = document.getElementById('download-csv');
const toggleDark = document.getElementById('toggle-dark');
const template = document.getElementById('result-template');
const backToTopBtn = document.getElementById('back-to-top');

let latestRequest = null;

const DARK_ICON = '\u263D';
const LIGHT_ICON = '\u2600';

const setStatus = (message, tone = 'info') => {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
};

const applyTheme = (mode) => {
  document.body.classList.toggle('dark', mode === 'dark');
  localStorage.setItem('paper-agent-theme', mode);
  toggleDark.textContent = mode === 'dark' ? '🌙' : '☀️';
};

const initTheme = () => {
  const saved = localStorage.getItem('paper-agent-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
};

initTheme();

toggleDark.addEventListener('click', () => {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(next);
});

const progress = (() => {
  const container = document.getElementById('progress-indicator');
  if (!container) {
    return { start() {}, complete() {}, fail() {} };
  }
  const fill = container.querySelector('.progress-fill');
  const steps = Array.from(container.querySelectorAll('[data-step]'));
  const sequence = steps.map((step) => step.dataset.step);
  let timers = [];
  let currentIndex = -1;

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  };

  const resetSteps = () => {
    steps.forEach((el) => {
      el.classList.remove('active', 'done');
    });
  };

  const setFill = (value) => {
    if (fill) {
      fill.style.width = `${value}%`;
    }
  };

  const showContainer = () => {
    container.classList.remove('hidden', 'error');
    container.classList.add('show');
  };

  const hideContainer = () => {
    container.classList.remove('show', 'error');
    container.classList.add('hidden');
    setFill(8);
    resetSteps();
    currentIndex = -1;
  };

  const activateStep = (index) => {
    if (index < 0 || index >= steps.length) return;
    if (currentIndex !== -1 && steps[currentIndex]) {
      steps[currentIndex].classList.remove('active');
      steps[currentIndex].classList.add('done');
    }
    steps[index].classList.add('active');
    currentIndex = index;
    const ratio = (index + 1) / (sequence.length + 0.25);
    setFill(Math.min(90, Math.max(15, ratio * 100)));
  };

  return {
    start() {
      clearTimers();
      resetSteps();
      showContainer();
      setFill(10);
      sequence.forEach((_, idx) => {
        const timer = setTimeout(() => activateStep(idx), 350 * idx + 200);
        timers.push(timer);
      });
    },
    complete() {
      clearTimers();
      if (!container.classList.contains('show')) return;
      if (currentIndex !== -1 && steps[currentIndex]) {
        steps[currentIndex].classList.remove('active');
        steps[currentIndex].classList.add('done');
      }
      steps.forEach((el) => el.classList.add('done'));
      setFill(100);
      setTimeout(hideContainer, 600);
    },
    fail() {
      clearTimers();
      container.classList.add('error');
      setFill(95);
      setTimeout(hideContainer, 1200);
    },
  };
})();

const updateBackToTop = () => {
  if (!backToTopBtn) return;
  const shouldShow = window.scrollY > 320;
  backToTopBtn.classList.toggle('show', shouldShow);
};

if (backToTopBtn) {
  window.addEventListener('scroll', updateBackToTop);
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  updateBackToTop();
}

const buildRequest = () => {
  const formData = new FormData(form);
  return {
    query: formData.get('query')?.trim(),
    categories: formData.getAll('category'),
    openalex_limit: Number(formData.get('openalex')),
    arxiv_limit: Number(formData.get('arxiv')),
    top_k: Number(formData.get('top')),
    summarise: true,
  };
};

const normaliseSource = (source = '') => {
  const key = String(source).toLowerCase();
  if (key.includes('openalex')) return 'OpenAlex';
  if (key.includes('arxiv')) return 'arXiv';
  return source || '未知来源';
};

const formatMeta = (item) => {
  const parts = [];
  parts.push(`${normaliseSource(item.source)} 数据源`);
  if (item.authors_brief) {
    parts.push(item.authors_brief);
  }
  if (item.venue) {
    parts.push(item.venue);
  }
  if (item.year) {
    parts.push(String(item.year));
  }
  return parts.join(' · ');
};

const renderWithHighlights = (element, text, fallback) => {
  element.textContent = '';
  const content = text && text.trim();
  if (!content) {
    element.textContent = fallback;
    return;
  }
  const pattern = /(论文聚焦于|论文来自)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      element.appendChild(document.createTextNode(content.slice(lastIndex, match.index)));
    }
    const span = document.createElement('span');
    const rest = content.slice(match.index + match[0].length);
    let highlightKey = '';
    if (rest.startsWith('相关领域')) {
      highlightKey = '相关领域';
    } else if (rest.startsWith('该领域')) {
      highlightKey = '该领域';
    }
    const baseClass = match[0] === '论文聚焦于' ? 'badge-focus' : 'badge-origin';
    const fieldClass = match[0] === '论文聚焦于' ? 'badge-focus-field' : 'badge-origin-field';
    if (highlightKey) {
      span.textContent = match[0] === '论文聚焦于' ? '聚焦于' : '来自';
      span.className = baseClass;
      element.appendChild(span);
      element.appendChild(document.createTextNode(' '));
      const fieldSpan = document.createElement('span');
      fieldSpan.textContent = highlightKey;
      fieldSpan.className = fieldClass;
      element.appendChild(fieldSpan);
      lastIndex = match.index + match[0].length + highlightKey.length;
    } else {
      span.textContent = match[0];
      span.className = baseClass;
      element.appendChild(span);
      lastIndex = match.index + match[0].length;
    }
  }
  if (lastIndex < content.length) {
    element.appendChild(document.createTextNode(content.slice(lastIndex)));
  }
};

const renderResults = (payload) => {
  resultsEl.innerHTML = '';
  if (!payload.items.length) {
    setStatus('未找到相关结果，可尝试精简关键词或调整分类。', 'warning');
    downloadMdBtn.disabled = true;
    downloadCsvBtn.disabled = true;
    progress.complete();
    return;
  }

  setStatus(`检索完成，共获取 ${payload.items.length} 条候选。`, 'success');
  downloadMdBtn.disabled = false;
  downloadCsvBtn.disabled = false;

  payload.items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.title').textContent = item.title;
    fragment.querySelector('.meta').textContent = formatMeta(item);

    const summaryEl = fragment.querySelector('.summary');
    renderWithHighlights(summaryEl, item.summary, '暂无摘要精炼，可展开原始摘要查看详情。');

    const whyEl = fragment.querySelector('.why');
    renderWithHighlights(whyEl, item.why_related, '未生成 Why Related 内容。');

    const diffEl = fragment.querySelector('.difference');
    renderWithHighlights(diffEl, item.difference, '未生成 Difference 内容。');

    const detailsEl = fragment.querySelector('.abstract-panel');
    const abstractEl = fragment.querySelector('.abstract');
    if (item.abstract && item.abstract.trim()) {
      abstractEl.textContent = item.abstract.trim();
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'abstract-missing';
      placeholder.textContent = '数据源未提供原始摘要。';
      detailsEl.replaceWith(placeholder);
    }

    const linkEl = fragment.querySelector('.primary-link');
    if (item.url) {
      linkEl.href = item.url;
    } else {
      linkEl.textContent = '暂无可用链接';
      linkEl.setAttribute('aria-disabled', 'true');
      linkEl.classList.add('disabled');
      linkEl.removeAttribute('href');
    }

    resultsEl.appendChild(fragment);
  });

  progress.complete();
};

const fetchJSON = async (endpoint, body) => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`请求失败：${response.status} ${text}`);
  }
  return response.json();
};

const download = async (type) => {
  if (!latestRequest) return;
  const endpoint = type === 'markdown' ? '/api/export/markdown' : '/api/export/csv';
  const fileName = type === 'markdown' ? 'related-papers.md' : 'related-papers.csv';
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(latestRequest),
  });
  if (!response.ok) {
    const text = await response.text();
    alert(`导出失败：${response.status} ${text}`);
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const request = buildRequest();
  if (!request.query) {
    setStatus('请先输入关键词。', 'warning');
    return;
  }
  latestRequest = request;
  setStatus('正在检索相关论文，请稍候…', 'loading');
  progress.start();
  resultsEl.innerHTML = '';
  downloadMdBtn.disabled = true;
  downloadCsvBtn.disabled = true;
  try {
    const payload = await fetchJSON('/api/search', request);
    renderResults(payload);
  } catch (error) {
    console.error(error);
    setStatus(error.message || '检索失败，请稍后再试。', 'error');
    progress.fail();
  }
});

downloadMdBtn.addEventListener('click', () => download('markdown'));
downloadCsvBtn.addEventListener('click', () => download('csv'));
