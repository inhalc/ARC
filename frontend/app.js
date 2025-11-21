// ARC frontend logic — clean rebuild (ASCII-safe)
const config = window.__PAPER_AGENT_CONFIG__ || { apiBase: '' };
const API_BASE = (typeof config.apiBase === 'string' ? config.apiBase : '').replace(/\/$/, '');

// ===== DOM Refs =====
const form = document.getElementById('search-form');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const downloadMdBtn = document.getElementById('download-md');
const downloadCsvBtn = document.getElementById('download-csv');
const toggleDark = document.getElementById('toggle-dark');
const template = document.getElementById('result-template');
const backToTopBtn = document.getElementById('back-to-top');

const userToggle = document.getElementById('user-toggle');
const userDropdown = document.getElementById('user-dropdown');
const currentUserAvatar = document.getElementById('current-user-avatar');
const userListContainer = document.getElementById('user-list-container');
const btnAddProfile = document.getElementById('btn-add-profile');
const settingsBtn = document.getElementById('btn-settings');
const modalOverlay = document.getElementById('profile-modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const modalDelete = document.getElementById('modal-delete');
const tagsContainer = document.getElementById('tags-container');

let latestRequest = null;
let editingProfileId = null;
let graphInstance = null;
let currentItems = [];

// ===== Presets =====
const DEFAULT_PROFILES = {
  cv: {
    id: 'cv',
    name: 'Dr. Chen',
    roleType: 'expert',
    roleLabel: 'CV Expert',
    avatar: 'CV',
    tags: ['Computer Vision', 'Deep Learning'],
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  nlp: {
    id: 'nlp',
    name: 'Dr. Wang',
    roleType: 'expert',
    roleLabel: 'NLP Expert',
    avatar: 'NLP',
    tags: ['NLP', 'Transformers / LLM'],
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  robot: {
    id: 'robot',
    name: 'Dr. Liu',
    roleType: 'expert',
    roleLabel: 'Embodied AI Expert',
    avatar: 'EM',
    tags: ['Robotics', 'Reinforcement Learning'],
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  beginner: {
    id: 'beginner',
    name: 'A',
    roleType: 'novice',
    roleLabel: 'Beginner',
    avatar: 'A',
    tags: ['Medical AI'],
    gradient: 'linear-gradient(135deg, #70c3ff 0%, #42e0ff 100%)',
  },
};

const AVAILABLE_TAGS = [
  { label: 'Computer Vision', keywords: 'computer vision image analysis visual recognition detection segmentation' },
  { label: 'Deep Learning', keywords: 'deep learning neural networks representation learning' },
  { label: 'NLP', keywords: 'natural language processing text analysis linguistics language modeling' },
  { label: 'Robotics', keywords: 'robotics embodied intelligence control systems navigation manipulation' },
  { label: 'Medical AI', keywords: 'medical imaging healthcare diagnosis ai4science biomedical' },
  { label: 'Reinforcement Learning', keywords: 'reinforcement learning decision making agent planning' },
  { label: 'Transformers / LLM', keywords: 'transformer large language model attention mechanism foundation model' },
  { label: 'Multimodal', keywords: 'multimodal audio visual language fusion' },
  { label: 'Graph Learning', keywords: 'graph neural network gnn message passing knowledge graph' },
  { label: 'Optimization', keywords: 'optimization convex non convex gradient descent' },
];

const TAG_KEYWORDS_MAP = Object.fromEntries(AVAILABLE_TAGS.map((t) => [t.label, t.keywords]));

// ===== Utils =====
const getHiddenKeywordsFromTags = (tags = []) => {
  const keywords = tags.map((t) => TAG_KEYWORDS_MAP[t]).filter(Boolean);
  return keywords.length ? keywords.join(' ') : '';
};

const getCurrentUser = () => localStorage.getItem('paper-agent-user') || 'cv';
const getAllProfiles = () => {
  const custom = JSON.parse(localStorage.getItem('paper-agent-custom-profiles') || '{}');
  return { ...DEFAULT_PROFILES, ...custom };
};
const getCurrentUserProfile = () => {
  const currentId = getCurrentUser();
  const profiles = getAllProfiles();
  return profiles[currentId] || DEFAULT_PROFILES.cv;
};

const updateHeaderAvatar = (profile) => {
  if (!profile) return;
  currentUserAvatar.textContent = profile.avatar;
  currentUserAvatar.style.background = profile.gradient;
};

const renderUserList = () => {
  const profiles = getAllProfiles();
  const currentId = getCurrentUser();
  userListContainer.innerHTML = '';
  Object.values(profiles).forEach((p) => {
    const btn = document.createElement('button');
    btn.className = `user-card ${p.id === currentId ? 'active' : ''}`;
    btn.onclick = () => switchUser(p.id);

    const tagsToShow = p.tags.slice(0, 2);
    const remaining = Math.max(0, p.tags.length - tagsToShow.length);
    const tagsHtml = [
      ...tagsToShow.map((t) => `<span class="focus-tag">${t}</span>`),
      remaining > 0 ? `<span class="focus-tag more">+${remaining}</span>` : '',
    ].join('');

    btn.innerHTML = `
      <div class="user-card-avatar" style="background: ${p.gradient}">${p.avatar}</div>
      <div class="user-card-info">
        <div class="user-card-name">${p.name}</div>
        <div class="user-card-role">${p.roleLabel}</div>
        <div class="user-card-focus">${tagsHtml}</div>
      </div>
    `;
    userListContainer.appendChild(btn);
  });
};

const switchUser = (userId) => {
  localStorage.setItem('paper-agent-user', userId);
  const profile = getCurrentUserProfile();
  updateHeaderAvatar(profile);
  userDropdown.classList.add('hidden');
  userToggle.classList.remove('active');
  renderUserList();
  const tagSummary = Array.isArray(profile.tags) ? profile.tags.join(', ') : '';
  setStatus(`Switched to ${profile.name}${tagSummary ? ` (${tagSummary})` : ''}`, 'success');
};

const initUser = () => {
  const profiles = getAllProfiles();
  const saved = localStorage.getItem('paper-agent-user');
  const initialId = saved && profiles[saved] ? saved : 'cv';
  localStorage.setItem('paper-agent-user', initialId);
  updateHeaderAvatar(profiles[initialId]);
  renderUserList();
};

const renderTagSelection = (selectedTags = []) => {
  tagsContainer.innerHTML = '';
  AVAILABLE_TAGS.forEach((tag) => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.textContent = tag.label;
    if (selectedTags.includes(tag.label)) chip.classList.add('selected');
    chip.onclick = () => chip.classList.toggle('selected');
    tagsContainer.appendChild(chip);
  });
};

const deleteCustomProfile = (id) => {
  const custom = JSON.parse(localStorage.getItem('paper-agent-custom-profiles') || '{}');
  if (!custom[id]) return false;
  delete custom[id];
  localStorage.setItem('paper-agent-custom-profiles', JSON.stringify(custom));
  return true;
};

const updateCustomProfile = (id, profileData) => {
  const custom = JSON.parse(localStorage.getItem('paper-agent-custom-profiles') || '{}');
  if (!custom[id]) return false;
  custom[id] = { ...custom[id], ...profileData, avatar: profileData.name.slice(0, 2).toUpperCase() };
  localStorage.setItem('paper-agent-custom-profiles', JSON.stringify(custom));
  return true;
};

const saveCustomProfile = (profileData) => {
  const custom = JSON.parse(localStorage.getItem('paper-agent-custom-profiles') || '{}');
  const id = `custom_${Date.now()}`;
  custom[id] = {
    id,
    ...profileData,
    avatar: profileData.name.slice(0, 2).toUpperCase(),
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  };
  localStorage.setItem('paper-agent-custom-profiles', JSON.stringify(custom));
  return id;
};

const openModal = (mode = 'new', profile = null) => {
  const isEdit = mode === 'edit';
  modalOverlay.dataset.mode = isEdit ? 'edit' : 'new';
  editingProfileId = isEdit && profile ? profile.id : null;
  document.getElementById('profile-form').reset();
  const target = isEdit && profile ? profile : { name: '', roleType: 'scholar', tags: [] };
  document.getElementById('p-name').value = target.name || '';
  document.getElementById('p-role').value = target.roleType || 'scholar';
  renderTagSelection(target.tags || []);
  modalTitle.textContent = isEdit ? 'Manage account' : 'Create account';
  modalSave.textContent = isEdit ? 'Save changes' : 'Save & switch';
  const canDelete = isEdit;
  modalDelete.style.display = canDelete ? 'inline-flex' : 'none';
  modalOverlay.classList.add('open');
  userDropdown.classList.add('hidden');
};

const closeModal = () => {
  modalOverlay.classList.remove('open');
  editingProfileId = null;
  document.getElementById('profile-form').reset();
};

modalSave.onclick = () => {
  const name = document.getElementById('p-name').value.trim();
  const roleType = document.getElementById('p-role').value;
  const roleLabelText = document.getElementById('p-role').options[document.getElementById('p-role').selectedIndex].text;
  const selectedTags = Array.from(tagsContainer.querySelectorAll('.tag-chip.selected')).map((el) => el.textContent);
  if (!name) {
    alert('Please enter a display name.');
    return;
  }
  if (!selectedTags.length) {
    alert('Select at least one interest tag.');
    return;
  }
  const isEditMode = modalOverlay.dataset.mode === 'edit';
  if (isEditMode && editingProfileId && editingProfileId.startsWith('custom_')) {
    updateCustomProfile(editingProfileId, { name, roleType, roleLabel: roleLabelText, tags: selectedTags });
    switchUser(editingProfileId);
  } else {
    const newId = saveCustomProfile({ name, roleType, roleLabel: roleLabelText, tags: selectedTags });
    switchUser(newId);
  }
  closeModal();
};

btnAddProfile.onclick = () => openModal('new');
settingsBtn.onclick = () => openModal('edit', getCurrentUserProfile());
modalClose.onclick = closeModal;
modalCancel.onclick = closeModal;
modalDelete.onclick = () => {
  if (!editingProfileId || !editingProfileId.startsWith('custom_')) {
    alert('Only custom accounts can be deleted.');
    return;
  }
  if (confirm('Delete this account?')) {
    deleteCustomProfile(editingProfileId);
    localStorage.setItem('paper-agent-user', 'cv');
    closeModal();
    initUser();
    setStatus('Custom account removed. Switched to default.', 'success');
  }
};

// dropdown toggling
if (userToggle) {
  userToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!userDropdown) return;
    userDropdown.classList.toggle('hidden');
    userToggle.classList.toggle('active');
  });
}

document.addEventListener('click', (e) => {
  if (!userDropdown) return;
  if (!userDropdown.contains(e.target) && !userToggle.contains(e.target)) {
    userDropdown.classList.add('hidden');
    userToggle.classList.remove('active');
  }
});

if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
}

// Status & theme
const setStatus = (message, tone = 'info') => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
};

const applyTheme = (mode) => {
  document.body.classList.toggle('dark', mode === 'dark');
  localStorage.setItem('paper-agent-theme', mode);
  if (toggleDark) {
    toggleDark.textContent = mode === 'dark' ? '🌙' : '☀';
    toggleDark.setAttribute('aria-label', mode === 'dark' ? '切换到浅色' : '切换到深色');
  }
};

const initTheme = () => {
  const saved = localStorage.getItem('paper-agent-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
};

initTheme();

if (toggleDark) {
  toggleDark.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark');
  });
}

// Progress indicator
const progress = (() => {
  const container = document.getElementById('progress-indicator');
  if (!container) return { start() {}, complete() {}, fail() {} };
  const fill = container.querySelector('.progress-fill');
  const steps = Array.from(container.querySelectorAll('[data-step]'));
  const sequence = steps.map((step) => step.dataset.step);
  let timers = [];
  let currentIndex = -1;

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  };

  const resetSteps = () => steps.forEach((el) => el.classList.remove('active', 'done'));
  const setFill = (value) => {
    if (fill) fill.style.width = `${value}%`;
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
    const ratio = (index + 1) / (sequence.length + 0.2);
    setFill(Math.min(90, Math.max(15, ratio * 100)));
  };

  return {
    start() {
      clearTimers();
      resetSteps();
      showContainer();
      setFill(10);
      sequence.forEach((_, idx) => timers.push(setTimeout(() => activateStep(idx), 350 * idx + 180)));
    },
    complete() {
      clearTimers();
      if (currentIndex !== -1 && steps[currentIndex]) {
        steps[currentIndex].classList.remove('active');
        steps[currentIndex].classList.add('done');
      }
      steps.forEach((el) => el.classList.add('done'));
      setFill(100);
      setTimeout(hideContainer, 650);
    },
    fail() {
      clearTimers();
      container.classList.add('error');
      setFill(95);
      setTimeout(hideContainer, 1200);
    },
  };
})();

// Back to top
const updateBackToTop = () => {
  if (!backToTopBtn) return;
  backToTopBtn.classList.toggle('show', window.scrollY > 320);
};

if (backToTopBtn) {
  window.addEventListener('scroll', updateBackToTop);
  backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  updateBackToTop();
}

// Build request
const buildRequest = () => {
  const formData = new FormData(form);
  const userQueryRaw = formData.get('query');
  const userQuery = userQueryRaw ? userQueryRaw.trim() : '';
  const profile = getCurrentUserProfile();
  const hiddenKeywords = getHiddenKeywordsFromTags(profile.tags);
  const enhancedQuery = hiddenKeywords ? `${userQuery} ${hiddenKeywords}` : userQuery;
  return {
    query: enhancedQuery,
    categories: formData.getAll('category'),
    openalex_limit: Number(formData.get('openalex')),
    arxiv_limit: Number(formData.get('arxiv')),
    top_k: Number(formData.get('top')),
    summarise: true,
    user_role: profile.roleType,
  };
};

const normaliseSource = (source = '') => {
  const key = String(source).toLowerCase();
  if (key.includes('openalex')) return 'OpenAlex';
  if (key.includes('arxiv')) return 'arXiv';
  return source || 'Unknown source';
};

const formatMeta = (item) => {
  const parts = [];
  parts.push(`${normaliseSource(item.source)} data`);
  if (item.authors_brief) parts.push(item.authors_brief);
  if (item.venue) parts.push(item.venue);
  if (item.year) parts.push(String(item.year));
  return parts.join(' | ');
};

const renderWithHighlights = (element, text, fallback) => {
  element.textContent = '';
  const content = text && text.trim();
  element.textContent = content || fallback;
};

// ===== Graph =====
class RelationGraph {
  constructor(canvasId, onSelect) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.onSelect = onSelect;
    this.nodes = [];
    this.edges = [];
    this.highlightId = null;
    this.hoverId = null;
    this.hoverPos = null;
    this.baseRadius = 14;
    this.magnifyRadius = 160;
    this.resize = this.resize.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    if (this.canvas) {
      this.canvas.addEventListener('click', this.handleClick);
      this.canvas.addEventListener('mousemove', this.handleMouseMove);
      this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
      window.addEventListener('resize', this.resize);
    }
    this.resize();
  }

  resize() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * ratio;
    this.canvas.height = Math.max(360, rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw();
  }

  getColor(similarity) {
    if (similarity >= 0.8) return '#2ecc71';
    if (similarity >= 0.6) return '#5c7cfa';
    return '#a0aec0';
  }

  buildGraph(items = []) {
    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 500;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 60;

    this.nodes = items.map((item, idx) => {
      if (idx === 0) {
        return { id: idx, x: centerX, y: centerY, label: item.title, similarity: 1, itemIndex: idx };
      }
      const angle = (idx / items.length) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 40;
      const r = radius * (0.8 + Math.random() * 0.25);
      return {
        id: idx,
        x: centerX + Math.cos(angle) * r + jitter,
        y: centerY + Math.sin(angle) * r + jitter,
        label: item.title,
        similarity: 0.55 + Math.random() * 0.4,
        itemIndex: idx,
      };
    });

    const edges = [];
    for (let i = 1; i < this.nodes.length; i++) {
      edges.push({ from: 0, to: i, weight: this.nodes[i].similarity });
    }
    const extra = Math.min(6, Math.max(1, Math.floor(items.length / 2)));
    for (let i = 0; i < extra; i++) {
      const a = 1 + Math.floor(Math.random() * (this.nodes.length - 1));
      const b = 1 + Math.floor(Math.random() * (this.nodes.length - 1));
      if (a !== b) edges.push({ from: a, to: b, weight: 0.4 + Math.random() * 0.4 });
    }
    this.edges = edges;
    this.updateStats();
    this.draw();
  }

  drawEdge(edge) {
    const { ctx } = this;
    const from = this.nodes[edge.from];
    const to = this.nodes[edge.to];
    if (!from || !to) return;
    const active = this.hoverId === from.id || this.hoverId === to.id || this.highlightId === from.id || this.highlightId === to.id;
    ctx.save();
    ctx.lineWidth = active ? 3 : 2.4;
    ctx.strokeStyle = this.getColor(edge.weight);
    ctx.globalAlpha = active ? 1 : 0.9;
    ctx.shadowColor = 'rgba(80, 120, 255, 0.25)';
    ctx.shadowBlur = active ? 10 : 6;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  drawNode(node) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    const isHover = this.hoverId === node.id;
    const isActive = this.highlightId === node.id;
    let radius = this.baseRadius;
    if (this.hoverPos) {
      const dist = Math.hypot(node.x - this.hoverPos.x, node.y - this.hoverPos.y);
      const influence = Math.max(0, 1 - dist / this.magnifyRadius);
      radius = this.baseRadius + influence * 10;
    }
    if (isHover || isActive) radius += 4;
    const gradient = ctx.createLinearGradient(node.x - radius, node.y - radius, node.x + radius, node.y + radius);
    gradient.addColorStop(0, '#6ea8ff');
    gradient.addColorStop(1, '#4dd0ff');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(80, 120, 255, 0.35)';
    ctx.shadowBlur = isHover ? 24 : 16;
    ctx.shadowOffsetY = 6;
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isActive ? '#1c7ed6' : '#ffffff';
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.stroke();

    const shouldShowLabel = isHover || isActive || node.id === 0;
    if (shouldShowLabel) {
      const label = node.label.length > 32 ? `${node.label.slice(0, 29)}...` : node.label;
      ctx.font = '13px "Segoe UI", "PingFang SC", sans-serif';
      const textWidth = ctx.measureText(label).width;
      const boxWidth = textWidth + 18;
      const boxHeight = 24;
      const boxX = node.x - boxWidth / 2;
      const boxY = node.y + 26;
      ctx.fillStyle = isHover ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = isHover ? 'rgba(37, 99, 235, 0.5)' : 'rgba(120, 150, 255, 0.28)';
      ctx.lineWidth = isHover ? 1.8 : 1.4;
      const radiusBox = 10;
      ctx.beginPath();
      ctx.moveTo(boxX + radiusBox, boxY);
      ctx.lineTo(boxX + boxWidth - radiusBox, boxY);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radiusBox);
      ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radiusBox);
      ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radiusBox, boxY + boxHeight);
      ctx.lineTo(boxX + radiusBox, boxY + boxHeight);
      ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radiusBox);
      ctx.lineTo(boxX, boxY + radiusBox);
      ctx.quadraticCurveTo(boxX, boxY, boxX + radiusBox, boxY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0b2c4d';
      ctx.fillText(label, node.x - textWidth / 2, boxY + boxHeight / 1.6);
    }
    ctx.restore();
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const { ctx } = this;
    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 500;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
    gradient.addColorStop(1, 'rgba(235, 243, 255, 0.92)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    this.edges.forEach((edge) => this.drawEdge(edge));
    this.nodes.forEach((node) => this.drawNode(node));
  }

  handleClick(event) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = this.pickNode(x, y);
    if (hit.node) {
      this.highlightId = hit.node.id;
      this.draw();
      if (typeof this.onSelect === 'function') this.onSelect(hit.node.itemIndex);
    }
  }

  handleMouseMove(event) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = this.pickNode(x, y);
    const nextHover = hit.node ? hit.node.id : null;
    this.hoverPos = { x, y };
    if (nextHover !== this.hoverId) {
      this.hoverId = nextHover;
      this.draw();
    } else {
      this.draw();
    }
  }

  handleMouseLeave() {
    this.hoverId = null;
    this.hoverPos = null;
    this.draw();
  }

  highlight(index) {
    this.highlightId = index;
    this.draw();
  }

  exportImage() {
    if (!this.canvas) return;
    const link = document.createElement('a');
    link.download = 'relation-graph.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  reset() {
    if (!this.nodes.length) return;
    this.nodes.forEach((node, idx) => {
      const jitter = () => (Math.random() - 0.5) * 24;
      node.x += jitter();
      node.y += jitter();
      if (idx === 0) {
        node.x = (this.canvas.clientWidth || 800) / 2;
        node.y = (this.canvas.clientHeight || 500) / 2;
      }
    });
    this.draw();
  }

  updateStats() {
    const statTotal = document.getElementById('stat-total');
    const statConn = document.getElementById('stat-connections');
    const statClusters = document.getElementById('stat-clusters');
    if (statTotal) statTotal.textContent = this.nodes.length;
    if (statConn) statConn.textContent = this.edges.length;
    if (statClusters) statClusters.textContent = Math.max(1, Math.round(this.nodes.length / 5));
  }

  pickNode(x, y) {
    return this.nodes.reduce(
      (nearest, node) => {
        const dist = Math.hypot(node.x - x, node.y - y);
        if (dist < nearest.dist) return { dist, node };
        return nearest;
      },
      { dist: Infinity, node: null },
    );
  }
}

const handleGraphSelect = (itemIndex) => {
  const target = document.getElementById(`result-${itemIndex}`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('pulse-highlight');
  setTimeout(() => target.classList.remove('pulse-highlight'), 1200);
};

// ===== Results render =====
const renderResults = (payload) => {
  resultsEl.innerHTML = '';
  if (!payload.items.length) {
    setStatus('No results found. Try fewer keywords or adjust categories.', 'warning');
    downloadMdBtn.disabled = true;
    downloadCsvBtn.disabled = true;
    payload.items = getMockItems();
    if (!payload.items.length) {
      progress.complete();
      return;
    }
  }
  currentItems = payload.items;
  setStatus(`Done. Retrieved ${payload.items.length} candidates.`, 'success');
  downloadMdBtn.disabled = false;
  downloadCsvBtn.disabled = false;

  const graphContainer = document.getElementById('relation-graph');
  if (graphContainer) graphContainer.style.display = 'block';
  if (!graphInstance) graphInstance = new RelationGraph('relation-canvas', handleGraphSelect);
  graphInstance.buildGraph(payload.items);

  payload.items.forEach((item, idx) => {
    const fragment = template.content.cloneNode(true);
    const wrapper = fragment.querySelector('article');
    if (wrapper) wrapper.id = `result-${idx}`;
    fragment.querySelector('.title').textContent = item.title;
    fragment.querySelector('.meta').textContent = formatMeta(item);
    renderWithHighlights(fragment.querySelector('.summary'), item.summary, 'No summary yet.');
    renderWithHighlights(fragment.querySelector('.why'), item.why_related, 'No Why Related notes.');
    renderWithHighlights(fragment.querySelector('.difference'), item.difference, 'No Difference notes.');

    const abstractEl = fragment.querySelector('.abstract');
    const detailsEl = fragment.querySelector('.abstract-panel');
    if (item.abstract && item.abstract.trim()) {
      abstractEl.textContent = item.abstract.trim();
    } else {
      const placeholder = document.createElement('p');
      placeholder.className = 'abstract-missing';
      placeholder.textContent = 'Source did not provide an abstract.';
      detailsEl.replaceWith(placeholder);
    }

    const linkEl = fragment.querySelector('.primary-link');
    if (item.url) {
      linkEl.href = item.url;
    } else {
      linkEl.textContent = 'No link available';
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
    throw new Error(`Request failed: ${response.status} ${text}`);
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
    alert(`Export failed: ${response.status} ${text}`);
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

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const request = buildRequest();
    if (!request.query) {
      setStatus('Enter a keyword first.', 'warning');
      return;
    }
    latestRequest = request;
    setStatus('Searching for related papers…', 'loading');
    progress.start();
    resultsEl.innerHTML = '';
    downloadMdBtn.disabled = true;
    downloadCsvBtn.disabled = true;
    try {
      const payload = await fetchJSON('/api/search', request);
      renderResults(payload);
    } catch (error) {
      console.error(error);
      setStatus(error.message || 'Search failed. Please try again later.', 'error');
      renderResults({ items: getMockItems() });
      progress.fail();
    }
  });
}

if (downloadMdBtn) downloadMdBtn.addEventListener('click', () => download('markdown'));
if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', () => download('csv'));
const graphResetBtn = document.getElementById('graph-reset');
if (graphResetBtn) graphResetBtn.addEventListener('click', () => { if (graphInstance) graphInstance.reset(); });
const graphExportBtn = document.getElementById('graph-export');
if (graphExportBtn) graphExportBtn.addEventListener('click', () => { if (graphInstance) graphInstance.exportImage(); });

// ===== Mock data fallback =====
const getMockItems = () => [
  {
    title: 'SMART-LLM: Multi-Agent Robot Task Planning using Large Language Models',
    source: 'OpenAlex',
    authors_brief: 'Shyam Sundar Kannan · Vishnunandan L. N. Venkatesh · Byung-Cheol Min',
    venue: 'ICRA',
    year: 2023,
    summary: 'Multi-agent orchestration that turns LLM instructions into structured robot task plans.',
    why_related: 'Highly relevant to embodied intelligence and planning.',
    difference: 'Compared with classic planners, adds LLM semantic reasoning and collaboration.',
    abstract: 'We present SMART-LLM, a multi-agent framework that harnesses large language models to convert high-level task instructions into executable robot task plans.',
    url: '#',
  },
  {
    title: 'Graph Neural Networks for Recommendation',
    source: 'OpenAlex',
    authors_brief: 'Zhang et al.',
    venue: 'KDD',
    year: 2022,
    summary: 'GNN-based modeling of user-item-attribute triplets for robust recommendation.',
    why_related: 'Graph modeling echoes entity linking in academic retrieval.',
    difference: 'Emphasizes graph collaborative filtering, complementary to semantic ranking.',
    abstract: 'We propose a GNN model that integrates side information for better recommendations.',
    url: '#',
  },
  {
    title: 'Diffusion Model for Text-to-Image',
    source: 'arXiv',
    authors_brief: 'Ho et al.',
    venue: 'arXiv',
    year: 2020,
    summary: 'Diffusion-based text-to-image generation for high-fidelity synthesis.',
    why_related: 'Hints at cross-modal understanding that can inspire multi-modal retrieval.',
    difference: 'Uses iterative denoising instead of classical retrieval-style methods.',
    abstract: 'Diffusion models provide a new route for text-conditioned image generation.',
    url: '#',
  },
  {
    title: 'RLHF for LLM Alignment',
    source: 'OpenAI',
    authors_brief: 'Ouyang et al.',
    venue: 'NeurIPS',
    year: 2022,
    summary: 'PPO-based pipeline to align LLMs with human preference.',
    why_related: 'Shows feedback learning that can refine summaries and tone.',
    difference: 'Adds reward modeling compared with non-aligned baselines.',
    abstract: 'Reinforcement learning from human feedback can align large models.',
    url: '#',
  },
  {
    title: 'Multimodal Fusion for Robotics',
    source: 'OpenAlex',
    authors_brief: 'Li et al.',
    venue: 'ICRA',
    year: 2023,
    summary: 'Fusion of vision, language, and action signals for robust navigation and interaction.',
    why_related: 'Matches embodied intelligence themes; good for comparison.',
    difference: 'Multisource fusion yields steadier decisions vs single modality.',
    abstract: 'We propose a fusion transformer for embodied AI tasks.',
    url: '#',
  },
  {
    title: 'Efficient LLM Serving with KV Cache',
    source: 'arXiv',
    authors_brief: 'Chen et al.',
    venue: 'arXiv',
    year: 2024,
    summary: 'KV cache reuse and speculative decoding to speed up inference.',
    why_related: 'Can accelerate the retrieval and summarization pipeline.',
    difference: 'Adds cache reuse and speculative decoding vs standard decoding.',
    abstract: 'KV cache reuse greatly speeds up transformer decoding.',
    url: '#',
  },
];

// ===== Init =====
initUser();
setStatus('Enter a keyword and start searching.', 'info');
