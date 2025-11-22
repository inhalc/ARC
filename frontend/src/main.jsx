import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { Search, Sun, Moon, Check, Tag, ChevronRight, Activity, Settings, Plus, Trash2, X, Sparkles, Layers, BookOpen, Star, Quote } from "lucide-react";

const firebaseConfig = (() => {
  try {
    if (typeof window !== "undefined" && window.__firebase_config) return JSON.parse(window.__firebase_config);
    if (typeof __firebase_config !== "undefined") return JSON.parse(__firebase_config);
  } catch (e) {
    console.warn("Invalid firebase config, using empty config");
  }
  return {};
})();

const appId = typeof window !== "undefined" && window.__app_id ? window.__app_id : "related-paper-agent";
const hasFirebaseConfig = firebaseConfig && firebaseConfig.apiKey;
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = hasFirebaseConfig ? getAuth(app) : null;
const db = hasFirebaseConfig ? getFirestore(app) : null;

const generateMockData = (keyword, userContext) => {
  const { tags } = userContext;
  const contextTags = tags && tags.length > 0 ? tags : ["AI", "Data"];
  const nodes = [];
  const links = [];
  nodes.push({ id: "root", title: `Query Focus: ${keyword}`, author: "User Query", year: 2025, source: "Search", type: "root", score: 1, tags: [keyword], abstract: `Central theme for "${keyword}". Connected nodes reflect citation or semantic similarity.`, whyRelated: "Origin of search.", difference: "-" });
  const count = 12 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i += 1) {
    const id = `node-${i}`;
    const score = 0.5 + Math.random() * 0.49;
    const isHighQuality = score > 0.85;
    const randomTag = contextTags[Math.floor(Math.random() * contextTags.length)];
    nodes.push({
      id,
      title: isHighQuality ? `Highly Cited: Advanced ${keyword} in ${randomTag}` : `Study on ${keyword} application in ${randomTag}`,
      author: `Dr. ${String.fromCharCode(65 + i)}. Scientist`,
      year: 2020 + Math.floor(Math.random() * 5),
      source: Math.random() > 0.5 ? "arXiv" : "OpenAlex",
      type: isHighQuality ? "star" : "normal",
      score,
      tags: [randomTag, keyword],
      abstract: isHighQuality ? `This seminal paper introduces a novel framework for ${keyword} that outperforms state-of-the-art by 15%.` : `A study exploring practical applications of ${keyword}; lightweight model trades slight accuracy for speed.`,
      whyRelated: `Relevance Score: ${(score * 100).toFixed(0)}%. Aligns with ${randomTag}.`,
      difference: `Proposes a ${isHighQuality ? "robust" : "lightweight"} solution compared to traditional methods.`,
    });
    links.push({ source: "root", target: id });
    if (i > 2 && Math.random() > 0.6) links.push({ source: id, target: `node-${i - 1}` });
  }
  return { nodes, links };
};
const ForceGraph = ({ data, onNodeClick, isDarkMode, selectedNodeId }) => {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const frameRef = useRef();
  const selectedRef = useRef(null);
  const drawRoundRect = (ctx, x, y, w, h, r) => {
    const radius = Math.max(r, 0);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const theme = useMemo(
    () => ({
      bg: isDarkMode ? "#0B1121" : "#F8FAFC",
      nodeRoot: isDarkMode ? "rgba(255,255,255,0.9)" : "#2563EB",
      nodeStar: isDarkMode ? "rgba(244,114,182,0.9)" : "#DB2777",
      nodeNormal: isDarkMode ? "rgba(96,165,250,0.8)" : "#60A5FA",
      lineColor: isDarkMode ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)",
      lineHighlight: isDarkMode ? "rgba(96,165,250,0.5)" : "rgba(37,99,235,0.4)",
      textMain: isDarkMode ? "#F1F5F9" : "#1E293B",
      labelBg: isDarkMode ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.85)",
      labelBorder: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    }),
    [isDarkMode],
  );

  useEffect(() => {
    selectedRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    if (!data || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let view = canvas.getBoundingClientRect();
    const resizeCanvas = () => {
      const next = canvas.getBoundingClientRect();
      const ratioX = next.width / view.width || 1;
      const ratioY = next.height / view.height || 1;
      // scale node positions to new viewport to keep interactions
      nodesRef.current.forEach((n) => {
        n.x *= ratioX;
        n.y *= ratioY;
      });
      view = next;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = view.width * dpr;
      canvas.height = view.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    const nodes = data.nodes.map((n) => {
      let baseR = 4;
      if (n.type === "root") baseR = 14;
      else if (n.type === "star") baseR = 8 + n.score * 4;
      else baseR = 4 + n.score * 3;
      return {
        ...n,
        x: view.width / 2 + (Math.random() - 0.5) * 120,
        y: view.height / 2 + (Math.random() - 0.5) * 120,
        vx: 0,
        vy: 0,
        baseRadius: baseR,
        drawRadius: baseR,
        hoverScale: 0,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    });
    const links = data.links.map((l) => ({ ...l }));
    nodesRef.current = nodes;

    const animate = () => {
      const width = view.width;
      const height = view.height;
      const k = 0.015;
      const repulsion = 520;
      const damping = 0.86;
      const centerForce = 0.009;

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 420) {
            const force = repulsion / (dist * dist + 50);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
          }
        }
      }

      links.forEach((link) => {
        const source = nodes.find((n) => n.id === link.source);
        const target = nodes.find((n) => n.id === link.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetLen = (source.score + target.score) * 110;
          const force = (dist - targetLen) * k;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }
      });

      nodes.forEach((node) => {
        node.vx += (width / 2 - node.x) * centerForce;
        node.vy += (height / 2 - node.y) * centerForce;
        node.vx *= damping;
        node.vy *= damping;
        const speed = Math.sqrt(node.vx ** 2 + node.vy ** 2);
        if (speed > 2) {
          node.vx = (node.vx / speed) * 2;
          node.vy = (node.vy / speed) * 2;
        }
        node.x += node.vx;
        node.y += node.vy;
      });

      const mouse = mouseRef.current;
      let hoveredNode = null;
      let minHoverDist = 28;
      nodes.forEach((node) => {
        const dx = node.x - mouse.x;
        const dy = node.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minHoverDist) {
          minHoverDist = dist;
          hoveredNode = node;
        }
        const influence = Math.max(0, 1 - dist / 160);
        node.hoverScale += ((hoveredNode === node ? 1 : 0) - node.hoverScale) * 0.2;
        node.drawRadius = node.baseRadius * (1 + influence * 0.6 + node.hoverScale * 0.4);
      });

      canvas.style.cursor = hoveredNode ? "pointer" : "default";

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, width, height);

      const hoveredId = hoveredNode ? hoveredNode.id : null;
      const selectedId = selectedRef.current;

      const baseLinks = [];
      const hoverLinks = [];
      const selectedLinks = [];
      links.forEach((l) => {
        const isSel = l.source === selectedId || l.target === selectedId;
        const isHov = l.source === hoveredId || l.target === hoveredId;
        if (isSel) selectedLinks.push(l);
        else if (isHov) hoverLinks.push(l);
        else baseLinks.push(l);
      });

      const time = Date.now() * 0.002;
      const baseNodes = [];
      const focusNodes = [];
      const baseLabels = [];
      const focusLabels = [];

      const pushNode = (node, isFocus) => {
        const { x, y } = node;
        const r = node.drawRadius;
        let color = theme.nodeNormal;
        if (node.type === "root") color = theme.nodeRoot;
        else if (node.type === "star") color = theme.nodeStar;
        const showGlow = node.type === "star" || node.type === "root" || node.hoverScale > 0.1 || isFocus;
        const showRing = node.hoverScale > 0.01 || node.type === "star" || isFocus;
        if (showGlow) {
          const glowR = r * (1.4 + Math.sin(time + node.pulsePhase) * 0.1);
          const glow = ctx.createRadialGradient(x, y, r, x, y, glowR);
          glow.addColorStop(0, color);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.globalAlpha = isFocus ? 0.3 : 0.18;
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        if (showRing) {
          ctx.strokeStyle = color;
          ctx.lineWidth = isFocus ? 2.8 : 1;
          ctx.globalAlpha = isFocus ? 1 : 0.6;
          ctx.beginPath();
          const ringR = r + 3 + node.hoverScale * 3;
          ctx.arc(x, y, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        const shouldShowText = node.type === "root" || node.type === "star" || node.hoverScale > 0.12 || isFocus;
        if (shouldShowText) {
          const text = node.title.length > 32 ? `${node.title.slice(0, 30)}...` : node.title;
          let labelY = y - r - 16;
          if (labelY < 20) labelY = y + r + 18;
          ctx.font = "600 12px -apple-system, sans-serif";
          const textWidth = ctx.measureText(text).width;
          const entry = { x, labelY, text, textWidth, color, focus: isFocus };
          (isFocus ? focusLabels : baseLabels).push(entry);
        }
      };

      nodes.forEach((node) => {
        const isFocus = node.id === hoveredId || node.id === selectedId;
        (isFocus ? focusNodes : baseNodes).push(node);
      });

      const drawLinks = (linkList, mode) => {
        linkList.forEach((link) => {
          const source = nodes.find((n) => n.id === link.source);
          const target = nodes.find((n) => n.id === link.target);
          if (!source || !target) return;
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          let stroke = theme.lineColor;
          let width = 1;
          let alpha = 0.5;
          if (mode === "hover") {
            stroke = theme.lineHighlight;
            width = 2;
            alpha = 0.9;
          } else if (mode === "selected") {
            stroke = "rgba(56,189,248,0.95)";
            width = 2.4;
            alpha = 1;
          }
          ctx.strokeStyle = stroke;
          ctx.lineWidth = width;
          ctx.globalAlpha = alpha;
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      };

      // Layering: all links first (base -> hover -> selected) -> nodes (base -> focus) -> labels (base -> focus)
      drawLinks(baseLinks, "base");
      drawLinks(hoverLinks, "hover");
      drawLinks(selectedLinks, "selected");
      baseNodes.forEach((n) => pushNode(n, false));
      focusNodes.forEach((n) => pushNode(n, true));

      const drawLabels = (labels) => {
        labels.forEach(({ x, labelY, text, textWidth, color, focus }) => {
          ctx.font = "600 12px -apple-system, sans-serif";
          const paddingX = 8;
          const paddingY = 4;
          ctx.fillStyle = theme.labelBg;
          ctx.strokeStyle = focus ? color : theme.labelBorder;
          ctx.lineWidth = focus ? 2 : 1;
          const rx = x - textWidth / 2 - paddingX;
          const ry = labelY - 8 - paddingY;
          const rw = textWidth + paddingX * 2;
          const rh = 16 + paddingY;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.15)";
          ctx.shadowBlur = focus ? 10 : 6;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, 6);
          } else {
            drawRoundRect(ctx, rx, ry, rw, rh, 6);
          }
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = theme.textMain;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowBlur = 0;
          ctx.fillText(text, x, labelY);
        });
      };

      drawLabels(baseLabels);
      drawLabels(focusLabels);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [data, theme]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let target = null;
    let minDist = 999;
    nodesRef.current.forEach((node) => {
      const dist = Math.hypot(x - node.x, y - node.y);
      if (dist < node.drawRadius + 10 && dist < minDist) {
        minDist = dist;
        target = node;
      }
    });
    if (target) onNodeClick(target);
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block touch-none select-none relative z-10"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={() => {
        mouseRef.current = { x: -9999, y: -9999 };
      }}
    />
  );
};

const DEFAULT_ACCOUNTS = [
  {
    id: "u1",
    name: "Alice Researcher",
    email: "alice@lab.edu",
    level: "Beginner",
    // hidden boost keywords
    tags: ["computer vision", "image recognition", "object detection"],
  },
  {
    id: "u2",
    name: "Dr. Bob Smith",
    email: "bob@uni.edu",
    level: "Intermediate",
    tags: ["nlp", "language model", "transformers"],
  },
  {
    id: "u3",
    name: "Prof. Carol",
    email: "carol@inst.org",
    level: "Expert",
    tags: ["robotics", "planning", "control"],
  },
];
function App() {
  const [user, setUser] = useState(null);
  const [currentAccount, setCurrentAccount] = useState(DEFAULT_ACCOUNTS[0]);
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("idle");
  const [graphData, setGraphData] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [history, setHistory] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showManageAccounts, setShowManageAccounts] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountLevel, setNewAccountLevel] = useState("Beginner");
  const [newAccountTags, setNewAccountTags] = useState("");
  const [localHistory, setLocalHistory] = useState(() => {
    try {
      const raw = localStorage.getItem("paper-agent-history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const userBtnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const updatePos = () => {
      if (!showUserMenu || !userBtnRef.current) return;
      const rect = userBtnRef.current.getBoundingClientRect();
      const width = 288; // 72 * 4 px
      const left = Math.max(12, rect.right + window.scrollX - width);
      const top = rect.bottom + window.scrollY + 12;
      setMenuPos({ top, left });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [showUserMenu]);

  useEffect(() => {
    if (!auth) {
      setUser({ uid: "mock" });
      return undefined;
    }
    signInAnonymously(auth).catch((e) => console.error(e));
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setHistory(localHistory.slice(0, 6));
      return undefined;
    }
    const q = query(
      collection(db, "artifacts", appId, "users", user.uid, `history_${currentAccount.id}`),
      orderBy("timestamp", "desc"),
      limit(6),
    );
    const unsub = onSnapshot(q, (snap) => setHistory(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, [user, currentAccount.id, db, appId, localHistory]);

  const handleSearch = async ({ addHistory = true, query: overrideQuery } = {}) => {
    const q = overrideQuery !== undefined ? overrideQuery : searchQuery;
    if (!q.trim()) return;
    if (overrideQuery !== undefined) setSearchQuery(overrideQuery);
    setSearchStatus("searching");
    setSelectedPaper(null);
    const boostedQuery =
      currentAccount.tags && currentAccount.tags.length
        ? `${q} ${currentAccount.tags.join(" ")}`
        : q;
    try {
      if (addHistory && user && db) {
        addDoc(collection(db, "artifacts", appId, "users", user.uid, `history_${currentAccount.id}`), {
          query: q,
          timestamp: serverTimestamp(),
        }).catch(() => {});
      }
      // local history fallback
      if (addHistory) {
        const newHist = [{ id: Date.now().toString(), query: q }, ...localHistory].slice(0, 6);
        setLocalHistory(newHist);
        try {
          localStorage.setItem("paper-agent-history", JSON.stringify(newHist));
        } catch {}
      }

      if (typeof fetch !== "undefined") {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: boostedQuery, user: currentAccount }),
        });
        if (!res.ok) throw new Error("fallback to mock");
        const json = await res.json();
        const items = Array.isArray(json.items) ? json.items : generateMockData(q, currentAccount).nodes;
        const nodes = items.slice(0, 16).map((item, idx) => ({
          id: idx === 0 ? "root" : `node-${idx}`,
          title: item.title || `Paper ${idx}`,
          author: item.authors_brief || "Unknown",
          year: item.year || 2024,
          source: item.source || "OpenAlex",
          type: idx === 0 ? "root" : idx % 3 === 0 ? "star" : "normal",
          score: 0.6 + Math.random() * 0.3,
          abstract: item.abstract || item.summary || "No abstract",
          whyRelated: item.why_related || "No reason provided",
          difference: item.difference || "N/A",
          url: item.url || item.link || item.primary_url || "",
        }));
        const baseLinks = nodes.slice(1).map((n) => ({ source: "root", target: n.id }));
        const extras = [];
        const others = nodes.slice(1);
        const linkSet = new Set();
        const pushLink = (s, t) => {
          if (!s || !t || s === t) return;
          const key = `${s}->${t}`;
          const rev = `${t}->${s}`;
          if (linkSet.has(key) || linkSet.has(rev)) return;
          linkSet.add(key);
          extras.push({ source: s, target: t });
        };
        baseLinks.forEach((l) => linkSet.add(`${l.source}->${l.target}`));
        for (let i = 0; i < others.length - 1; i += 1) {
          pushLink(others[i].id, others[i + 1].id);
        }
        for (let i = 0; i < others.length; i += 1) {
          if (Math.random() > 0.55) {
            const target = others[Math.floor(Math.random() * others.length)];
            pushLink(others[i].id, target.id);
          }
          if (Math.random() > 0.7) {
            const target = others[Math.floor(Math.random() * others.length)];
            pushLink("root", target.id);
          }
        }
        const links = [...baseLinks, ...extras];
        setGraphData({ nodes, links });
        if (nodes.length > 1) setSelectedPaper(nodes[1]);
      } else {
        throw new Error("fetch not available");
      }
    } catch (e) {
      const data = generateMockData(boostedQuery, currentAccount);
      setGraphData(data);
      if (data.nodes.length > 1) setSelectedPaper(data.nodes[1]);
    } finally {
      setSearchStatus("results");
    }
  };
  const handleHistoryClick = (query) => {
    handleSearch({ addHistory: false, query });
  };

  const handleReadFullPaper = () => {
    if (!selectedPaper) return;
    if (selectedPaper.url) {
      window.open(selectedPaper.url, "_blank");
    } else {
      alert("No external link available. Please review the abstract and summary.");
    }
  };

  const toggleTheme = () => setIsDarkMode((v) => !v);

  const handleAddAccount = (e) => {
    e.preventDefault();
    const newAcc = {
      id: `u${Date.now()}`,
      name: newAccountName || "New User",
      email: `${(newAccountName || "user").toLowerCase().replace(/\s/g, ".")}@lab.edu`,
      level: newAccountLevel,
      tags: newAccountTags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    setAccounts([...accounts, newAcc]);
    setCurrentAccount(newAcc);
    setShowAddAccount(false);
    setNewAccountName("");
    setNewAccountTags("");
  };

  const handleDeleteAccount = (id) => {
    if (accounts.length <= 1) return;
    const newAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(newAccounts);
    if (currentAccount.id === id) setCurrentAccount(newAccounts[0]);
  };

  const themeStyles = isDarkMode
    ? {
        bg: "bg-[#0a0f1c]",
        text: "text-slate-100",
        glass: "backdrop-blur-xl bg-[#111827]/80 border border-white/10 shadow-2xl",
        panel: "bg-[#111827]",
        input: "bg-[#1f2937] border-transparent text-white placeholder-slate-500 focus:bg-[#374151] focus:ring-2 focus:ring-blue-500/50",
        sidebar: "border-r border-white/5 bg-[#0a0f1c]/90",
        accentGradient: "from-sky-500 to-blue-600",
        modal: "bg-[#111827] border-white/10 text-white",
      }
    : {
        bg: "bg-[#f8fafc]",
        text: "text-slate-800",
        glass: "backdrop-blur-xl bg-white/90 border border-slate-200 shadow-xl",
        panel: "bg-white",
        input: "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
        sidebar: "border-r border-slate-200 bg-white/80",
        accentGradient: "from-blue-500 to-indigo-600",
        modal: "bg-white border-slate-100 text-slate-800",
      };

  const controlBtnClass = isDarkMode
    ? "h-10 px-3 rounded-full border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 transition-all active:scale-95 flex items-center gap-2 shadow-sm"
    : "h-10 px-3 rounded-full border border-slate-200 bg-white text-slate-700 hover:border-slate-300 transition-all active:scale-95 flex items-center gap-2 shadow-sm";
  return (
    <div className={`w-full h-screen relative flex flex-col overflow-hidden transition-colors duration-500 ${themeStyles.bg} ${themeStyles.text} font-sans`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {isDarkMode && <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/20 to-transparent opacity-50" />}
      </div>

      <header className={`relative z-30 border-b transition-colors ${isDarkMode ? "border-white/5 bg-[#0a0f1c]/80" : "border-slate-200 bg-white/80"} backdrop-blur-md`}>
        <div className="w-full px-4 md:px-6 py-2.5 flex items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${themeStyles.accentGradient} flex items-center justify-center shadow-lg shadow-blue-500/20`}>
              <Activity className="text-white w-4 h-4" />
            </div>
            <span className="text-base font-bold tracking-tight">Paper Agent</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                ref={userBtnRef}
                className={`flex items-center space-x-3 pl-4 pr-2 py-1.5 rounded-full border transition-all duration-200 active:scale-95 group ${isDarkMode ? "bg-white/5 border-white/5 hover:border-white/20" : "bg-white border-slate-200 hover:border-slate-300"}`}
              >
                <div className="flex flex-col items-end mr-1">
                  <span className="text-xs font-bold leading-none">{currentAccount.name}</span>
                  <span className="text-[10px] opacity-50 font-medium">{currentAccount.level}</span>
                </div>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-tr ${themeStyles.accentGradient} text-white text-[10px] font-bold shadow-md`}>
                  {currentAccount.name[0]}
                </div>
              </button>

              {showUserMenu && (
                <div
                  className={`fixed w-72 p-1.5 rounded-2xl border shadow-2xl z-50 origin-top-right animate-menu-enter overflow-hidden isolate ${themeStyles.glass}`}
                  style={{
                    top: menuPos.top,
                    left: menuPos.left,
                    backdropFilter: "blur(30px) saturate(220%) brightness(1.02)",
                    WebkitBackdropFilter: "blur(30px) saturate(220%) brightness(1.02)",
                    backgroundColor: isDarkMode ? "rgba(10,16,28,0.92)" : "rgba(255,255,255,0.92)",
                    boxShadow: "0 24px 70px rgba(0,0,0,0.2)",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none opacity-25"
                    style={{
                      background: isDarkMode
                        ? "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(236,72,153,0.25), transparent 35%)"
                        : "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.18), transparent 40%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.15), transparent 35%)",
                    }}
                  />
                  <div className="px-3 py-2 mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2">Switch Account</p>
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          setCurrentAccount(acc);
                          setShowUserMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all mb-1 ${currentAccount.id === acc.id ? "bg-blue-500/10 text-blue-500" : "hover:bg-current/5"}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentAccount.id === acc.id ? "bg-blue-500 text-white" : "bg-gray-500/20 opacity-70"}`}>{acc.name[0]}</div>
                          <div className="text-left">
                            <div className="text-xs font-bold leading-none">{acc.name}</div>
                            <div className="text-[10px] opacity-60">{acc.level}</div>
                          </div>
                        </div>
                        {currentAccount.id === acc.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  <div className="h-[1px] bg-gradient-to-r from-transparent via-current to-transparent opacity-10 my-1" />
                  <div className="flex p-1">
                    <button
                      onClick={() => {
                        setShowAddAccount(true);
                        setShowUserMenu(false);
                      }}
                      className="flex-1 flex items-center justify-center py-2 rounded-lg hover:bg-current/5 transition text-[10px] font-bold opacity-70"
                    >
                      <Plus size={14} className="mr-1" /> Add
                    </button>
                    <button
                      onClick={() => {
                      setShowManageAccounts(true);
                        setShowUserMenu(false);
                      }}
                      className="flex-1 flex items-center justify-center py-2 rounded-lg hover:bg-current/5 transition text-[10px] font-bold opacity-70"
                    >
                      <Settings size={14} className="mr-1" /> Manage
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className={controlBtnClass}>
              {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <a
              href="https://github.com/inhalc/ARC"
              target="_blank"
              rel="noreferrer"
              className={`${controlBtnClass} hidden sm:inline-flex text-sm font-semibold`}
            >
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 relative z-20 flex overflow-hidden">
        <div className={`w-72 flex-shrink-0 flex flex-col backdrop-blur-xl transition-all ${themeStyles.sidebar}`}>
          <div className="p-5">
            <div className="relative group">
              <input
                type="text"
                placeholder="Research Topic..."
                className={`w-full pl-4 pr-10 py-3 rounded-xl outline-none text-sm font-medium shadow-sm transition-all ${themeStyles.input}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-gradient-to-br ${themeStyles.accentGradient} text-white shadow-md hover:scale-105 transition-transform active:scale-95`}
              >
                <Search size={14} />
              </button>
            </div>
          </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              <div className="px-2 mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider opacity-40">Recent</h3>
              </div>
              <div className="space-y-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      handleHistoryClick(item.query);
                    }}
                    className={`px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center space-x-3 group ${isDarkMode ? "hover:bg-white/5" : "hover:bg-white hover:shadow-sm"}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? "bg-blue-500" : "bg-blue-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate opacity-80 group-hover:opacity-100 transition-opacity">{item.query}</div>
                    </div>
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-30 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] bg-[length:32px_32px]" />
          <ForceGraph data={graphData} onNodeClick={setSelectedPaper} isDarkMode={isDarkMode} selectedNodeId={selectedPaper?.id} />
          {searchStatus === "searching" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/20 backdrop-blur-[1px]">
              <div className="w-10 h-10 rounded-full border-[3px] border-blue-500/30 border-t-blue-500 animate-spin mb-3" />
              <p className="text-[10px] font-bold tracking-widest uppercase opacity-80">Analysing Citation Graph...</p>
            </div>
          )}
          {searchStatus === "results" && !selectedPaper && (
            <div
              className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full border backdrop-blur-md shadow-lg z-20 animate-menu-enter flex items-center space-x-2 pointer-events-none select-none ${isDarkMode ? "bg-slate-900/80 border-white/10" : "bg-white/80 border-slate-200"}`}
            >
              <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Pink nodes indicate high impact papers</span>
            </div>
          )}
        </div>
        <div
          className={`absolute right-4 top-4 bottom-4 w-[400px] rounded-[24px] shadow-2xl border backdrop-blur-2xl z-50 flex flex-col transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) ${isDarkMode ? "bg-[#0f172a]/95 border-white/10" : "bg-white/95 border-slate-200"} ${selectedPaper ? "translate-x-0" : "translate-x-[110%]"}`}
        >
          {selectedPaper && (
            <>
              <div className="p-6 pb-2 border-b border-white/5 flex-shrink-0">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        selectedPaper.source === "arXiv"
                          ? "bg-red-500/10 border-red-500/20 text-red-500"
                          : "bg-green-500/10 border-green-500/20 text-green-500"
                      }`}
                    >
                      {selectedPaper.source}
                    </span>
                    {selectedPaper.type === "star" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-pink-500/10 border-pink-500/20 text-pink-500 flex items-center">
                        <Star size={10} className="mr-1 fill-current" /> Top Rated
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedPaper(null)} className="p-1.5 rounded-full hover:bg-black/5 transition hover:rotate-90 active:scale-90">
                    <X size={18} />
                  </button>
                </div>
                <h2 className="text-xl font-bold leading-snug mb-2">{selectedPaper.title}</h2>
                <div className="flex items-center space-x-2 text-xs font-medium opacity-60 mb-4">
                  <span>{selectedPaper.author}</span>
                  <span>?</span>
                  <span>{selectedPaper.year}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className={`p-4 rounded-xl border transition-all ${isDarkMode ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center space-x-2 mb-2 opacity-80">
                    <Quote size={14} />
                    <h3 className="font-bold text-[10px] uppercase tracking-wider">Abstract Summary</h3>
                  </div>
                  <p className="text-sm leading-relaxed opacity-90 italic">"{selectedPaper.abstract}"</p>
                </div>

                <div className={`p-4 rounded-xl border transition-all ${isDarkMode ? "bg-blue-500/5 border-blue-500/10" : "bg-blue-50 border-blue-100"}`}>
                  <div className="flex items-center space-x-2 mb-2 text-blue-500">
                    <Sparkles size={14} />
                    <h3 className="font-bold text-[10px] uppercase tracking-wider">Why Related</h3>
                  </div>
                  <p className="text-sm leading-relaxed opacity-80">{selectedPaper.whyRelated}</p>
                </div>

                <div className={`p-4 rounded-xl border transition-all ${isDarkMode ? "bg-purple-500/5 border-purple-500/10" : "bg-purple-50 border-purple-100"}`}>
                  <div className="flex items-center space-x-2 mb-2 text-purple-500">
                    <Layers size={14} />
                    <h3 className="font-bold text-[10px] uppercase tracking-wider">Difference</h3>
                  </div>
                  <p className="text-sm leading-relaxed opacity-80">{selectedPaper.difference}</p>
                </div>
              </div>

              <div className="p-6 pt-2 border-t border-white/5 flex-shrink-0">
                <button
                  onClick={handleReadFullPaper}
                  className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2 bg-gradient-to-r ${themeStyles.accentGradient} text-white relative overflow-hidden group`}
                >
                  <BookOpen size={16} />
                  <span>Read Full Paper</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showAddAccount && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-menu-enter">
          <div className={`w-full max-w-xs rounded-2xl shadow-2xl p-6 border ${themeStyles.modal}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">New Identity</h3>
              <button onClick={() => setShowAddAccount(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="space-y-3">
              <input required value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none border ${themeStyles.input}`} placeholder="Name" />
              <div className="relative">
                <select value={newAccountLevel} onChange={(e) => setNewAccountLevel(e.target.value)} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none border appearance-none ${themeStyles.input}`} style={{ backgroundColor: isDarkMode ? "#1f2937" : "#fff" }}>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Expert">Expert</option>
                </select>
                <ChevronRight size={14} className="absolute right-3 top-3 opacity-50 rotate-90 pointer-events-none" />
              </div>
              <input value={newAccountTags} onChange={(e) => setNewAccountTags(e.target.value)} className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none border ${themeStyles.input}`} placeholder="Tags (comma sep)" />
              <button type="submit" className={`w-full py-2.5 rounded-lg font-bold text-sm text-white bg-gradient-to-r ${themeStyles.accentGradient}`}>
                Create Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {showManageAccounts && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-menu-enter">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 border ${themeStyles.modal}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Manage Accounts</h3>
              <button onClick={() => setShowManageAccounts(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {accounts.map((acc) => (
                <div key={acc.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? "bg-white/5 border-white/5" : "bg-slate-50 border-slate-100"}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentAccount.id === acc.id ? "bg-blue-500 text-white" : "bg-gray-500/20 opacity-70"}`}>{acc.name[0]}</div>
                    <div>
                      <div className="font-bold text-sm">{acc.name}</div>
                      <div className="text-[10px] opacity-60">{acc.level}</div>
                    </div>
                  </div>
                  {accounts.length > 1 && (
                    <button onClick={() => handleDeleteAccount(acc.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setShowManageAccounts(false); setShowAddAccount(true); }} className="w-full py-2.5 mt-4 rounded-lg border border-dashed border-current/20 text-sm font-bold opacity-60 hover:opacity-100">
              Add Another Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
