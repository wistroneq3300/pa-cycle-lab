const USER_GUIDE = (() => {
  let win, bar, content, search, body, grip;
  let dragOffset = null, resizeStart = null, lastNormal = null, inited = false;

  async function loadTemplate() {
    try {
      const r = await fetch('/static/userguide_template.html?v=20260905a', { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let t = (await r.text());
      // 檔案是被 <script type="text/userguide-html"> 包住的內嵌模板，取裡面的 HTML
      const m = t.match(/<script[^>]*id="guide-tpl"[^>]*>([\s\S]*?)<\/script>/);
      if (m) t = m[1];
      return t.trim();
    } catch (e) {
      return '<p style="color:#ff8a80">載入說明內容失敗：' + (e && e.message || e) + '</p>';
    }
  }
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  async function open() {
    if (!window.__ugTpl) { window.__ugTpl = await loadTemplate(); }
    if (inited) {
      try {
        const st = JSON.parse(localStorage.getItem("ug-state") || "{}");
        st.closed = false; st.min = false;
        localStorage.setItem("ug-state", JSON.stringify(st));
      } catch (e) {}
      win.style.display = "";
      restore();
      return;
    }
    inited = true;
    win = el("div", "ug-window");
    bar = el("div", "ug-bar");
    bar.innerHTML =
      '<span class="ug-title">📖 User Guide</span>' +
      '<button class="ug-btn" data-act="min" title="最小化">–</button>' +
      '<button class="ug-btn" data-act="max" title="最大化 / 縮小">□</button>' +
      '<button class="ug-btn ug-close" data-act="close" title="關閉">✕</button>';
    content = el("div", "ug-content");
    search = el("div", "ug-search");
    const si = el("input", "input");
    si.placeholder = "🔍 搜尋…（GPU、KVM、廣播、遙測…）";
    search.appendChild(si);
    body = el("div", "ug-body");
    body.innerHTML = window.__ugTpl || '';  // 由 loadTemplate 填入
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
  }

  function bind() {
    bar.addEventListener("mousedown", startDrag);
    bar.addEventListener("click", (e) => {
      const b = e.target.closest(".ug-btn"); if (!b) return;
      const a = b.dataset.act;
      if (a === "close") closeAll();
      else if (a === "min") minimize();
      else if (a === "max") toggleMax();
    });
    const si = search.querySelector("input");
    si.addEventListener("input", filterSearch);
    body.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#ug-"]'); if (!a) return;
      e.preventDefault();
      const t = body.querySelector(a.getAttribute("href"));
      if (t) { t.scrollIntoView({ behavior: "smooth", block: "start" }); t.classList.add("ug-flash"); setTimeout(() => t.classList.remove("ug-flash"), 1500); }
    });
    grip.addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      resizeStart = { x: e.clientX, y: e.clientY, w: win.offsetWidth, h: win.offsetHeight };
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeEnd);
    });
  }

  function startDrag(e) {
    if (e.target.closest(".ug-btn") || win.classList.contains("ug-maxed")) return;
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
    }
    persist();
  }
  function minimize() { win.classList.add("ug-minimized"); persist(); }
  function closeAll() { win.style.display = "none"; persist(); }
  function restore() {
    // 恢復最小化時的還原：點頂條時先解除最小化
    bar.addEventListener("mousedown", function unmin() {
      if (win.classList.contains("ug-minimized")) { win.classList.remove("ug-minimized"); }
    }, { once: true });
    let st = {};
    try { st = JSON.parse(localStorage.getItem("ug-state") || "{}"); } catch (e) {}
    if (st.closed) { win.style.display = "none"; return; }
    win.style.display = "";
    if (st.min) { win.classList.add("ug-minimized"); return; }
    if (st.max) { win.classList.add("ug-maxed"); return; }
    win.style.left = st.x || "calc(50vw - 320px)";
    win.style.top = st.y || "14vh";
    win.style.width = st.w || "640px";
    win.style.height = st.h || "70vh";
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

// 頁面載入後綁定：頂列 📖 圖示 + 鍵盤 ? 快速開啟
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("guide-btn");
  if (btn) {
    btn.addEventListener("click", (e) => { e.preventDefault(); USER_GUIDE.open().catch(err => alert("載入說明失敗：" + err)); });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "?" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); USER_GUIDE.open().catch(err => alert("載入說明失敗：" + err));
    }
  });
});
