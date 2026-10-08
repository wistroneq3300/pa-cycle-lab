const USER_GUIDE = (() => {
  let win, bar, content, search, body, grip;
  let dragOffset = null, resizeStart = null, lastNormal = null, inited = false;
  let templatePromise = null;
  let opener = null;

  async function loadTemplate() {
    const r = await fetch('/static/userguide_template.html?v=20261008-director-guide1', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let t = (await r.text());
    // 檔案是被 <script type="text/userguide-html"> 包住的內嵌模板，取裡面的 HTML
    const m = t.match(/<script[^>]*id="guide-tpl"[^>]*>([\s\S]*?)<\/script>/);
    if (m) t = m[1];
    t = t.trim();
    if (!t) throw new Error('說明內容是空的');
    return t;
  }
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function markRequestedOpen() {
    try {
      const st = JSON.parse(localStorage.getItem("ug-state") || "{}");
      st.closed = false;
      st.min = false;
      localStorage.setItem("ug-state", JSON.stringify(st));
    } catch (e) {}
  }

  function renderLoadError(error) {
    body.removeAttribute("aria-busy");
    const state = el("section", "ug-load-state");
    state.setAttribute("role", "alert");
    state.appendChild(el("h2", "", "使用手冊暫時無法載入"));
    const help = document.createElement("p");
    help.textContent = "請確認連線後重試；這次失敗不會被保存。";
    const detail = document.createElement("p");
    detail.className = "ug-hint";
    detail.textContent = "原因：" + (error && error.message ? error.message : String(error || "未知錯誤"));
    const retry = el("button", "btn", "重新載入手冊");
    retry.type = "button";
    retry.dataset.ugRetry = "";
    retry.addEventListener("click", () => loadGuideBody());
    state.append(help, detail, retry);
    body.replaceChildren(state);
    retry.focus({ preventScroll: true });
  }

  async function loadGuideBody() {
    if (templatePromise) return templatePromise;
    body.setAttribute("aria-busy", "true");
    body.innerHTML = '<p class="ug-load-state" role="status">正在載入使用手冊…</p>';
    templatePromise = loadTemplate().then(template => {
      window.__ugTpl = template;
      body.removeAttribute("aria-busy");
      body.innerHTML = template;
      filterSearch();
      search.querySelector("input").focus({ preventScroll: true });
      return template;
    }).catch(error => {
      // 失敗內容不寫入 __ugTpl；重開視窗或按重試都會重新請求。
      renderLoadError(error);
      return null;
    }).finally(() => { templatePromise = null; });
    return templatePromise;
  }

  async function open() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && (!win || !win.contains(active))) opener = active;
    markRequestedOpen();
    if (inited) {
      win.style.display = "";
      restore();
      search.querySelector("input").focus({ preventScroll: true });
      if (!window.__ugTpl) await loadGuideBody();
      return;
    }
    inited = true;
    win = el("div", "ug-window");
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "false");
    win.setAttribute("aria-labelledby", "ug-title");
    bar = el("div", "ug-bar");
    bar.innerHTML =
      '<span class="ug-title" id="ug-title">📖 使用手冊</span>' +
      '<button class="ug-btn" data-act="min" title="最小化" aria-label="最小化使用手冊" aria-expanded="true">–</button>' +
      '<button class="ug-btn" data-act="max" title="最大化 / 縮小">□</button>' +
      '<button class="ug-btn ug-close" data-act="close" title="關閉">✕</button>';
    content = el("div", "ug-content");
    search = el("div", "ug-search");
    const si = el("input", "input");
    si.placeholder = "搜尋功能或問題（OS Slot、檢查 IP、CDU…）";
    si.setAttribute("aria-label", "\u641c\u5c0b\u4f7f\u7528\u624b\u518a");
    search.appendChild(si);
    body = el("div", "ug-body");
    content.appendChild(search);
    content.appendChild(body);
    win.appendChild(bar);
    win.appendChild(content);
    grip = el("div", "ug-grip");
    grip.title = "拖動以縮放視窗";
    win.appendChild(grip);
    const root = document.getElementById("guide-root");
    root.appendChild(win);
    bind();
    restore();
    si.focus({ preventScroll: true });
    if (window.__ugTpl) body.innerHTML = window.__ugTpl;
    else await loadGuideBody();
  }

  function bind() {
    bar.addEventListener("mousedown", startDrag);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest(".ug-btn"); if (!b) return;
      const a = b.dataset.act;
      if (a === "close") closeAll();
      else if (a === "min") toggleMinimize();
      else if (a === "max") toggleMax();
    });
    const si = search.querySelector("input");
    si.addEventListener("input", filterSearch);
    body.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#ug-"]'); if (!a) return;
      e.preventDefault();
      const t = body.querySelector(a.getAttribute("href"));
      if (t) { si.value = ""; filterSearch(); t.scrollIntoView({ behavior: "smooth", block: "start" }); t.classList.add("ug-flash"); setTimeout(() => t.classList.remove("ug-flash"), 1500); }
    });
    win.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      closeAll();
    });
    grip.addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      resizeStart = { x: e.clientX, y: e.clientY, w: win.offsetWidth, h: win.offsetHeight };
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeEnd);
    });
    window.addEventListener("resize", clampToViewport);
  }

  function startDrag(e) {
    if (e.target.closest(".ug-btn")) return;
    if (win.classList.contains("ug-minimized")) { win.classList.remove("ug-minimized"); syncMinControl(); persist(); }
    if (win.classList.contains("ug-maxed")) return;
    dragOffset = { x: e.clientX - win.offsetLeft, y: e.clientY - win.offsetTop };
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
  }
  function onDragMove(e) {
    if (!dragOffset) return;
    let x = e.clientX - dragOffset.x, y = e.clientY - dragOffset.y;
    x = Math.max(-win.offsetWidth + 80, Math.min(x, window.innerWidth - 80));
    y = Math.max(0, Math.min(y, window.innerHeight - 40));
    win.style.left = x + "px"; win.style.top = y + "px";
  }
  function onDragEnd() {
    dragOffset = null;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    persist();
  }
  function onResizeMove(e) {
    if (!resizeStart) return;
    let w = Math.max(340, Math.min(window.innerWidth - 8, resizeStart.w + (e.clientX - resizeStart.x)));
    let h = Math.max(240, Math.min(window.innerHeight - 8, resizeStart.h + (e.clientY - resizeStart.y)));
    win.style.width = w + "px"; win.style.height = h + "px";
  }
  function onResizeEnd() {
    resizeStart = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    persist();
  }

  function toggleMax() {
    if (!win.classList.contains("ug-maxed")) {
      lastNormal = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
      win.classList.add("ug-maxed");
    } else {
      win.classList.remove("ug-maxed");
      if (lastNormal) Object.assign(win.style, { left: lastNormal.l, top: lastNormal.t, width: lastNormal.w, height: lastNormal.h });
      clampToViewport();
    }
    persist();
  }
  function syncMinControl() {
    const button = bar.querySelector('[data-act="min"]');
    const minimized = win.classList.contains("ug-minimized");
    button.setAttribute("aria-expanded", String(!minimized));
    button.setAttribute("aria-label", minimized ? "還原使用手冊" : "最小化使用手冊");
    button.title = minimized ? "還原" : "最小化";
  }
  function toggleMinimize() {
    win.classList.toggle("ug-minimized");
    syncMinControl();
    persist();
  }
  function closeAll() {
    win.style.display = "none";
    persist();
    const target = opener?.isConnected ? opener : document.getElementById("guide-btn");
    opener = null;
    target?.focus({ preventScroll: true });
  }
  function clampToViewport() {
    if (!win || win.style.display === "none" || win.classList.contains("ug-maxed")) return;
    const rect = win.getBoundingClientRect();
    const inset = 8;
    const maxX = Math.max(inset, window.innerWidth - rect.width - inset);
    const maxY = Math.max(inset, window.innerHeight - rect.height - inset);
    win.style.left = Math.max(inset, Math.min(rect.left, maxX)) + "px";
    win.style.top = Math.max(inset, Math.min(rect.top, maxY)) + "px";
  }
  function restore() {
    let st = {};
    try { st = JSON.parse(localStorage.getItem("ug-state") || "{}"); } catch (e) {}
    if (st.closed) { win.style.display = "none"; return; }
    win.style.display = "";
    win.style.left = st.x || "calc(50vw - 320px)";
    win.style.top = st.y || "14vh";
    win.style.width = st.w || "640px";
    win.style.height = st.h || "70vh";
    win.classList.toggle("ug-minimized", !!st.min);
    win.classList.toggle("ug-maxed", !!st.max);
    syncMinControl();
    if (st.min || st.max) return;
    clampToViewport();
  }

  function filterSearch() {
    const q = (search.querySelector("input").value || "").toLowerCase().trim();
    const secs = Array.from(body.querySelectorAll("section.ug-sec"));
    let shown = 0;
    secs.forEach(s => {
      const hit = !q || s.textContent.toLowerCase().includes(q);
      s.style.display = hit ? "" : "none";
      if (hit) shown++;
    });
    const badge = body.querySelector(".ug-hint-search");
    if (badge) badge.textContent = q ? (shown ? "符合 " + shown + " 段" : "沒有找到相關段落") : "";
  }

  function persist() {
    try {
      localStorage.setItem("ug-state", JSON.stringify({
        x: win.style.left, y: win.style.top, w: win.style.width, h: win.style.height,
        min: win.classList.contains("ug-minimized"),
        max: win.classList.contains("ug-maxed"),
        closed: win.style.display === "none"
      }));
    } catch (e) {}
  }

  return { open };
})();

function guideShortcutBlocked(event) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return true;
  const target = event.target instanceof Element ? event.target : document.activeElement;
  if (target instanceof Element && target.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])')) return true;
  if (target instanceof Element && target.closest('#term-modal, #bc-modal, #kvm-overlay, .xterm')) return true;
  return ['term-modal', 'bc-modal', 'kvm-overlay'].some(id => {
    const surface = document.getElementById(id);
    return !!surface && surface.getClientRects().length > 0;
  });
}

// 頁面載入後綁定：頂列 📖 圖示 + 鍵盤 ? 快速開啟
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("guide-btn");
  if (btn) {
    btn.addEventListener("click", (e) => { e.preventDefault(); USER_GUIDE.open().catch(err => alert("載入說明失敗：" + err)); });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "?" && !guideShortcutBlocked(e)) {
      e.preventDefault(); USER_GUIDE.open().catch(err => alert("載入說明失敗：" + err));
    }
  });
});
