const config = window.__PAPER_AGENT_CONFIG__ || { apiBase: "http://localhost:8000" };
const form = document.getElementById("search-form");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const downloadMdBtn = document.getElementById("download-md");
const downloadCsvBtn = document.getElementById("download-csv");
const toggleDark = document.getElementById("toggle-dark");
const template = document.getElementById("result-template");
const backToTopBtn = document.getElementById("back-to-top");

let latestRequest = null;

const setStatus = (message, tone = "info") => {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
};

const applyTheme = (mode) => {
  document.body.classList.toggle("dark", mode === "dark");
  localStorage.setItem("paper-agent-theme", mode);
};

const initTheme = () => {
  const saved = localStorage.getItem("paper-agent-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
};

initTheme();

toggleDark.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
});

const progress = (() => {
  const container = document.getElementById("progress-indicator");
  if (!container) {
    return { start() {}, complete() {}, fail() {} };
  }
  const fill = container.querySelector(".progress-fill");
  const steps = Array.from(container.querySelectorAll("[data-step]"));
  const sequence = steps.map((step) => step.dataset.step);
  let timers = [];
  let currentIndex = -1;

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  };

  const resetSteps = () => {
    steps.forEach((el) => {
      el.classList.remove("active", "done");
    });
  };

  const setFill = (value) => {
    if (fill) {
      fill.style.width = ${value}%;
    }
  };

  const showContainer = () => {
    container.classList.remove("hidden", "error");
    container.classList.add("show");
  };

  const hideContainer = () => {
    container.classList.remove("show", "error");
    container.classList.add("hidden");
    setFill(8);
    resetSteps();
    currentIndex = -1;
  };

  const activateStep = (index) => {
    if (index < 0 || index >= steps.length) return;
    if (currentIndex !== -1 && steps[currentIndex]) {
      steps[currentIndex].classList.remove("active");
      steps[currentIndex].classList.add("done");
    }
    steps[index].classList.add("active");
    currentIndex = index;
    const progressRatio = (index + 1) / (sequence.length + 0.25);
    setFill(Math.min(90, Math.max(15, progressRatio * 100)));
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
      if (!container.classList.contains("show")) return;
      if (currentIndex !== -1 && steps[currentIndex]) {
        steps[currentIndex].classList.remove("active");
        steps[currentIndex].classList.add("done");
      }
      steps.forEach((el) => el.classList.add("done"));
      setFill(100);
      setTimeout(hideContainer, 600);
    },
    fail() {
      clearTimers();
      container.classList.add("error");
      setFill(95);
      setTimeout(hideContainer, 1200);
    },
  };
})();

const updateBackToTop = () => {
  if (!backToTopBtn) return;
  const shouldShow = window.scrollY > 320;
  backToTopBtn.classList.toggle("show", shouldShow);
};

if (backToTopBtn) {
  window.addEventListener("scroll", updateBackToTop);
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  updateBackToTop();
}

const buildRequest = () => {
  const formData = new FormData(form);
  const categories = formData.getAll("category");
  const query = formData.get("query")?.trim();
  const openalex = Number(formData.get("openalex"));
  const arxiv = Number(formData.get("arxiv"));
  const top = Number(formData.get("top"));
  const summarise = formData.get("summary") !== null;
  return {
    query,
    categories,
    openalex_limit: openalex,
    arxiv_limit: arxiv,
    top_k: top,
    summarise,
  };
};

const formatMeta = (item) => {
  const parts = [];
  parts.push(${item.source.toUpperCase()} · 分数 );
  if (item.authors_brief) {
    parts.push(作者 );
  }
  if (item.venue) {
    parts.push(${item.venue} ());
  } else if (item.year) {
    parts.push(年份 );
  }
  if (item.doi) {
    parts.push(DOI );
  }
  return parts.join(" ｜ ");
};

const renderResults = (payload) => {
  resultsEl.innerHTML = "";
  if (!payload.items.length) {
    setStatus("未找到结果，可以尝试换个关键词或缩小分类范围。", "warning");
    downloadMdBtn.disabled = true;
    downloadCsvBtn.disabled = true;
    progress.complete();
    return;
  }

  setStatus(共获取  篇候选，展示 Top  篇。, "success");
  downloadMdBtn.disabled = false;
  downloadCsvBtn.disabled = false;

  payload.items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".title").textContent = item.title;
    fragment.querySelector(".meta").textContent = formatMeta(item);
    fragment.querySelector(".summary").textContent = item.summary || "暂无摘要精炼，可展开原始摘要查看详情。";
    fragment.querySelector(".why").textContent = Why Related：;
    fragment.querySelector(".difference").textContent = Difference：;
    fragment.querySelector(".abstract").textContent = item.abstract || "摘要缺失";
    const linkEl = fragment.querySelector(".link");
    if (item.url) {
      linkEl.href = item.url;
      linkEl.textContent = "查看原文";
    } else {
      linkEl.remove();
    }
    resultsEl.appendChild(fragment);
  });

  progress.complete();
};

const fetchJSON = async (endpoint, body) => {
  const res = await fetch(${config.apiBase}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(请求失败： );
  }
  return res.json();
};

const download = async (type) => {
  if (!latestRequest) return;
  const endpoint = type === "markdown" ? "/api/export/markdown" : "/api/export/csv";
  const fileName = type === "markdown" ? "related-papers.md" : "related-papers.csv";
  const res = await fetch(${config.apiBase}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(latestRequest),
  });
  if (!res.ok) {
    const text = await res.text();
    alert(导出失败： );
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = buildRequest();
  if (!request.query) {
    setStatus("请输入检索关键词。", "warning");
    return;
  }
  latestRequest = request;
  setStatus("正在检索相关论文，请稍候…", "loading");
  progress.start();
  resultsEl.innerHTML = "";
  downloadMdBtn.disabled = true;
  downloadCsvBtn.disabled = true;
  try {
    const payload = await fetchJSON("/api/search", request);
    renderResults(payload);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "检索失败，请稍后重试。", "error");
    progress.fail();
  }
});

downloadMdBtn.addEventListener("click", () => download("markdown"));
downloadCsvBtn.addEventListener("click", () => download("csv"));
