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

// 用户管理
const userToggle = document.getElementById('user-toggle');
const userDropdown = document.getElementById('user-dropdown');
const currentUserAvatar = document.getElementById('current-user-avatar');
const userCards = document.querySelectorAll('.user-card');
const userListContainer = document.getElementById('user-list-container');
const btnAddProfile = document.getElementById('btn-add-profile');
const modalOverlay = document.getElementById('profile-modal');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const tagsContainer = document.getElementById('tags-container');

let latestRequest = null;

const DARK_ICON = '\u263D';
const LIGHT_ICON = '\u2600';

// 用户配置:不同用户的隐藏关键词
const USER_PROFILES = {
  cv: {
    name: 'Dr. Chen',
    displayName: 'Dr. Chen',
    avatar: 'CV',
    role: '计算机视觉',
    fullRole: '计算机视觉研究员',
    hiddenKeywords: ['computer vision', 'image processing', 'visual recognition', 'image understanding'],
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  nlp: {
    name: 'Dr. Wang',
    displayName: 'Dr. Wang',
    avatar: 'NLP',
    role: '自然语言处理',
    fullRole: '自然语言处理专家',
    hiddenKeywords: ['natural language processing', 'text analysis', 'linguistic', 'language model'],
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  robot: {
    name: 'Dr. Liu',
    displayName: 'Dr. Liu',
    avatar: 'EM',
    role: '具身智能',
    fullRole: '具身智能专家',
    hiddenKeywords: ['embodied intelligence', 'embodied AI', 'robotics', 'autonomous systems'],
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  }
};

// 预设用户 (不可删除)
const DEFAULT_PROFILES = {
  cv: {
    id: 'cv',
    name: 'Dr. Chen',
    roleType: 'expert',
    roleLabel: 'CV 专家',
    avatar: 'CV',
    tags: ['Computer Vision'],
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  nlp: {
    id: 'nlp',
    name: 'Dr. Wang',
    roleType: 'expert',
    roleLabel: 'NLP 专家',
    avatar: 'NLP',
    tags: ['NLP', 'Transformers / LLM'],
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  robot: {
    id: 'robot',
    name: 'Dr. Liu',
    roleType: 'expert',
    roleLabel: '具身智能专家',
    avatar: 'EM',
    tags: ['Robotics'],
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  }
};

// 系统预设标签池：前端展示名称 -> 后端搜索 Hidden Keywords
const AVAILABLE_TAGS = [
  { label: 'Computer Vision', keywords: 'computer vision image analysis visual recognition' },
  { label: 'NLP', keywords: 'natural language processing text analysis linguistic' },
  { label: 'Robotics', keywords: 'robotics embodied intelligence control systems' },
  { label: 'Medical AI', keywords: 'medical imaging healthcare diagnosis ai4science' },
  { label: 'Reinforcement Learning', keywords: 'reinforcement learning decision making agent' },
  { label: 'Transformers / LLM', keywords: 'transformer large language model attention mechanism' },
  { label: 'Multimodal', keywords: 'multimodal audio-visual vision-language' }
];

// 获取当前用户
const getCurrentUser = () => {
  return localStorage.getItem('paper-agent-user') || 'cv';
};

// 设置当前用户
const setCurrentUser = (userId) => {
  localStorage.setItem('paper-agent-user', userId);
  const profile = USER_PROFILES[userId];
  if (profile) {
    currentUserAvatar.textContent = profile.avatar;
    currentUserAvatar.style.background = profile.gradient;
  }
  // 更新激活状态
  userCards.forEach(card => {
    card.classList.toggle('active', card.dataset.user === userId);
  });
};

// 初始化用户
const initUser = () => {
  switchUser(localStorage.getItem('paper-agent-user') || 'cv'); // 确保加载时有默认用户
  renderUserList(); // 初始化时渲染用户列表
};

// 用户菜单切换
userToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  userToggle.classList.toggle('active');
  userDropdown.classList.toggle('hidden');
});

// 点击外部关闭菜单
document.addEventListener('click', (e) => {
  if (!userToggle.contains(e.target) && !userDropdown.contains(e.target)) {
    userToggle.classList.remove('active');
    userDropdown.classList.add('hidden');
  }
});

// 用户选项点击
userCards.forEach(card => {
  card.addEventListener('click', () => {
    const userId = card.dataset.user;
    const profile = USER_PROFILES[userId];
    setCurrentUser(userId);
    userToggle.classList.remove('active');
    userDropdown.classList.add('hidden');
    // 显示提示
    setStatus(`已切换到 ${profile.displayName} 的研究视角 - ${profile.fullRole}`, 'success');
  });
});

// 获取所有 Profile (预设 + 本地存储)
const getAllProfiles = () => {
  const custom = JSON.parse(localStorage.getItem('paper-agent-custom-profiles') || '{}');
  return { ...DEFAULT_PROFILES, ...custom };
};

// 保存自定义 Profile
const saveCustomProfile = (profileData) => {
  const custom = JSON.parse(localStorage.getItem('paper-agent-custom-profiles') || '{}');
  const id = `custom_${Date.now()}`; // 简单生成唯一ID
  custom[id] = {
    id: id,
    ...profileData,
    avatar: profileData.name.slice(0, 2).toUpperCase(),
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' // 自定义用户统一蓝色系，可优化
  };
  localStorage.setItem('paper-agent-custom-profiles', JSON.stringify(custom));
  return id;
};

// 获取当前选中用户的完整信息
const getCurrentUserProfile = () => {
  const currentId = localStorage.getItem('paper-agent-user') || 'cv';
  const profiles = getAllProfiles();
  return profiles[currentId] || DEFAULT_PROFILES.cv; // Fallback
};

// 根据标签生成 Hidden Keywords
const getHiddenKeywordsFromTags = (tagLabels) => {
  let keywords = [];
  tagLabels.forEach(label => {
    const tagDef = AVAILABLE_TAGS.find(t => t.label === label);
    if (tagDef) {
      keywords.push(tagDef.keywords);
    }
  });
  return keywords.join(' ');
};

// 渲染用户下拉列表
const renderUserList = () => {
  const profiles = getAllProfiles();
  const currentId = localStorage.getItem('paper-agent-user') || 'cv';
  
  console.log('📋 renderUserList called');
  console.log('   Profiles:', Object.keys(profiles));
  console.log('   Current ID:', currentId);
  
  if (!userListContainer) {
    console.error('❌ userListContainer element not found!');
    return;
  }
  
  userListContainer.innerHTML = '';
  
  Object.values(profiles).forEach(p => {
    const btn = document.createElement('button');
    btn.className = `user-card ${p.id === currentId ? 'active' : ''}`;
    btn.onclick = () => switchUser(p.id);
    
    // 生成标签的小徽章 HTML
    const tagsHtml = p.tags.slice(0, 2).map(t => `<span class="focus-tag">${t}</span>`).join('');
    
    btn.innerHTML = `
      <div class="user-card-avatar" style="background: ${p.gradient}">${p.avatar}</div>
      <div class="user-card-info">
        <div class="user-card-name">${p.name}</div>
        <div class="user-card-role">${p.roleLabel}</div>
        <div class="user-card-focus">${tagsHtml}</div>
      </div>
      ${p.id === currentId ? '<div class="user-status-dot" style="position:relative;right:auto;border:none;"></div>' : ''}
    `;
    userListContainer.appendChild(btn);
    console.log('   ✅ Added user card:', p.name);
  });
  
  console.log(`✅ Rendered ${Object.keys(profiles).length} user profiles successfully`);
};

const switchUser = (userId) => {
  localStorage.setItem('paper-agent-user', userId);
  const profile = getCurrentUserProfile();
  
  // 更新 Header 头像
  currentUserAvatar.textContent = profile.avatar;
  currentUserAvatar.style.background = profile.gradient;
  
  // UI 反馈
  userDropdown.classList.add('hidden');
  userToggle.classList.remove('active');
  renderUserList(); // 重新渲染以更新选中态
  
  setStatus(`已切换身份: ${profile.name} (${profile.tags.join(', ')})`, 'success');
};

// 打开模态框
const openModal = () => {
  modalOverlay.classList.add('open');
  renderTagSelection(); // 渲染标签选择器
  userDropdown.classList.add('hidden'); // 关闭下拉
};

// 关闭模态框
const closeModal = () => {
  modalOverlay.classList.remove('open');
  document.getElementById('profile-form').reset();
};

// 渲染模态框里的标签选择 Chips
const renderTagSelection = () => {
  tagsContainer.innerHTML = '';
  AVAILABLE_TAGS.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.textContent = tag.label;
    chip.onclick = () => chip.classList.toggle('selected');
    tagsContainer.appendChild(chip);
  });
};

// 保存新用户
modalSave.onclick = () => {
  const name = document.getElementById('p-name').value.trim();
  const roleType = document.getElementById('p-role').value;
  const roleLabelText = document.getElementById('p-role').options[document.getElementById('p-role').selectedIndex].text;
  
  // 获取选中的标签
  const selectedTags = Array.from(tagsContainer.querySelectorAll('.tag-chip.selected')).map(el => el.textContent);
  
  if (!name) {
    alert('请输入显示名称');
    return;
  }
  if (selectedTags.length === 0) {
    alert('请至少选择一个感兴趣的领域标签');
    return;
  }

  const newId = saveCustomProfile({
    name: name,
    roleType: roleType,
    roleLabel: roleLabelText, // e.g. "研究员 / Scholar"
    tags: selectedTags
  });
  
  switchUser(newId);
  closeModal();
};

// 事件绑定
if (btnAddProfile) {
  btnAddProfile.onclick = (e) => {
    e.stopPropagation();
    console.log('Opening modal...');
    openModal();
  };
  console.log('✅ btnAddProfile event bound');
} else {
  console.error('❌ btnAddProfile element not found!');
}

if (modalClose) {
  modalClose.onclick = closeModal;
  console.log('✅ modalClose event bound');
}

if (modalCancel) {
  modalCancel.onclick = closeModal;
  console.log('✅ modalCancel event bound');
}

// 绑定"账户设置"按钮
const settingsBtnEl = document.getElementById('settings-btn');
if (settingsBtnEl) {
  settingsBtnEl.onclick = (e) => {
    e.stopPropagation();
    alert('账户设置功能即将推出！\n\n当前可用功能：\n- 切换研究视角\n- 新建自定义身份\n- 选择兴趣标签');
  };
  console.log('✅ settings button event bound');
}

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
  const userQuery = formData.get('query')?.trim();
  
  // 获取当前用户配置
  const profile = getCurrentUserProfile();
  
  // 核心逻辑：将 Profile 中的 Tags 转换为 Hidden Keywords
  const hiddenKeywords = getHiddenKeywordsFromTags(profile.tags);
  
  // 组合查询词
  const enhancedQuery = hiddenKeywords 
    ? `${userQuery} ${hiddenKeywords}`
    : userQuery;
  
  // 可以在这里打印一下，方便调试
  console.log(`[User: ${profile.name}] Raw Query: "${userQuery}" -> Enhanced: "${enhancedQuery}"`);
  
  return {
    query: enhancedQuery,
    categories: formData.getAll('category'),
    openalex_limit: Number(formData.get('openalex')),
    arxiv_limit: Number(formData.get('arxiv')),
    top_k: Number(formData.get('top')),
    summarise: true,
    // Optional: 传给后端用户的身份类型，如果后端需要据此调整 Prompt 语气
    user_role: profile.roleType 
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

// === 关联网状图逻辑 ===
let graphInstance = null;

class RelationGraph {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.nodes = [];
    this.edges = [];
    this.isDragging = false;
    this.selectedNode = null;
    this.offset = { x: 0, y: 0 };
    this.zoom = 1;
    
    this.initCanvas();
    this.bindEvents();
  }
  
  initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }
  
  bindEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
  }
  
  calculateSimilarity(item1, item2) {
    // 简单的相似度计算：基于标题和摘要的文本重叠
    const text1 = (item1.title + ' ' + item1.abstract).toLowerCase();
    const text2 = (item2.title + ' ' + item2.abstract).toLowerCase();
    
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  buildGraph(papers) {
    this.nodes = [];
    this.edges = [];
    
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(rect.width, rect.height) / 3;
    
    // 创建节点
    papers.forEach((paper, index) => {
      const angle = (index / papers.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      this.nodes.push({
        id: index,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        paper: paper,
        radius: 8,
        type: index === 0 ? 'current' : 'related'
      });
    });
    
    // 创建边（基于相似度）
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const similarity = this.calculateSimilarity(
          this.nodes[i].paper,
          this.nodes[j].paper
        );
        
        if (similarity > 0.3) { // 阈值
          this.edges.push({
            source: this.nodes[i],
            target: this.nodes[j],
            similarity: similarity
          });
        }
      }
    }
    
    // 更新统计数据
    document.getElementById('stat-total').textContent = this.nodes.length;
    document.getElementById('stat-connections').textContent = this.edges.length;
    document.getElementById('stat-clusters').textContent = Math.ceil(this.nodes.length / 5);
    
    this.simulate();
  }
  
  simulate() {
    // 简单的力导向布局
    for (let i = 0; i < 100; i++) {
      // 斥力
      for (let j = 0; j < this.nodes.length; j++) {
        for (let k = j + 1; k < this.nodes.length; k++) {
          const dx = this.nodes[k].x - this.nodes[j].x;
          const dy = this.nodes[k].y - this.nodes[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const force = 1000 / (distance * distance);
            this.nodes[j].vx -= (dx / distance) * force;
            this.nodes[j].vy -= (dy / distance) * force;
            this.nodes[k].vx += (dx / distance) * force;
            this.nodes[k].vy += (dy / distance) * force;
          }
        }
      }
      
      // 引力（通过边）
      this.edges.forEach(edge => {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const force = distance * 0.01 * edge.similarity;
        
        edge.source.vx += (dx / distance) * force;
        edge.source.vy += (dy / distance) * force;
        edge.target.vx -= (dx / distance) * force;
        edge.target.vy -= (dy / distance) * force;
      });
      
      // 更新位置
      this.nodes.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.9; // 阻尼
        node.vy *= 0.9;
      });
    }
    
    this.render();
  }
  
  render() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    
    // 绘制边
    this.edges.forEach(edge => {
      const alpha = Math.min(1, edge.similarity * 1.5);
      this.ctx.strokeStyle = edge.similarity > 0.8 
        ? `rgba(16, 185, 129, ${alpha})`
        : edge.similarity > 0.6
        ? `rgba(245, 158, 11, ${alpha})`
        : `rgba(148, 163, 184, ${alpha})`;
      this.ctx.lineWidth = edge.similarity * 3;
      this.ctx.beginPath();
      this.ctx.moveTo(edge.source.x, edge.source.y);
      this.ctx.lineTo(edge.target.x, edge.target.y);
      this.ctx.stroke();
    });
    
    // 绘制节点
    this.nodes.forEach(node => {
      const color = node.type === 'current' 
        ? '#3b82f6'
        : this.getNodeColor(node);
      
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // 节点边框
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });
  }
  
  getNodeColor(node) {
    // 根据与查询的相似度着色
    const querySimilarity = this.calculateSimilarity(node.paper, this.nodes[0].paper);
    if (querySimilarity > 0.8) return '#10b981';
    if (querySimilarity > 0.6) return '#f59e0b';
    return '#94a3b8';
  }
  
  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    this.selectedNode = this.nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < node.radius;
    });
    
    if (this.selectedNode) {
      this.isDragging = true;
      this.offset = {
        x: x - this.selectedNode.x,
        y: y - this.selectedNode.y
      };
    }
  }
  
  onMouseMove(e) {
    if (this.isDragging && this.selectedNode) {
      const rect = this.canvas.getBoundingClientRect();
      this.selectedNode.x = e.clientX - rect.left - this.offset.x;
      this.selectedNode.y = e.clientY - rect.top - this.offset.y;
      this.render();
    }
  }
  
  onMouseUp() {
    this.isDragging = false;
    this.selectedNode = null;
  }
  
  onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom *= delta;
    this.zoom = Math.max(0.5, Math.min(2, this.zoom));
  }
  
  reset() {
    this.zoom = 1;
    this.buildGraph(this.nodes.map(n => n.paper));
  }
  
  exportImage() {
    const link = document.createElement('a');
    link.download = 'relation-graph.png';
    link.href = this.canvas.toDataURL();
    link.click();
  }
}

const renderResults = (payload) => {
  resultsEl.innerHTML = '';
  if (!payload.items.length) {
    setStatus('未找到相关结果，可尝试精简关键词或调整分类。', 'warning');
    downloadMdBtn.disabled = true;
    downloadCsvBtn.disabled = true;
    progress.complete();
    return;
  }

  setStatus(`检索完成,共获取 ${payload.items.length} 条候选。`, 'success');
  downloadMdBtn.disabled = false;
  downloadCsvBtn.disabled = false;
  
  // 显示并渲染关联网状图
  console.log('🔍 Attempting to show relation graph...');
  const graphContainer = document.getElementById('relation-graph');
  if (graphContainer) {
    console.log('✅ Graph container found, showing it...');
    graphContainer.style.display = 'block';
    
    // 等待DOM更新后再初始化图谱
    setTimeout(() => {
      console.log('🎨 Initializing graph with', payload.items.length, 'items');
      try {
        if (!graphInstance) {
          graphInstance = new RelationGraph('relation-canvas');
          console.log('✅ RelationGraph instance created');
        }
        graphInstance.buildGraph(payload.items);
        console.log('✅ Graph rendered successfully');
      } catch (error) {
        console.error('❌ Graph rendering failed:', error);
      }
    }, 100);
  } else {
    console.error('❌ Graph container element not found!');
  }

  payload.items.forEach((item, index) => {
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

  console.log(`Rendered ${payload.items.length} result items`);
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

// 关联图谱控制
document.getElementById('graph-reset')?.addEventListener('click', () => {
  if (graphInstance) {
    graphInstance.reset();
  }
});

document.getElementById('graph-export')?.addEventListener('click', () => {
  if (graphInstance) {
    graphInstance.exportImage();
  }
});

// 初始化
console.log('Initializing app...');
initUser();
console.log('App initialized');
