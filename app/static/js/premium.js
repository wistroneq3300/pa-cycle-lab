// ============================================================
// PREMIUM LAYER (rollback-safe: remove <script> in index.html)
// Emoji->SVG icons / topbar pills / Cmd+K / Toast / ESC extra
// dashboard health + alerts / machine banner / KPI chips / clock
// ============================================================
(function () {
  "use strict";
  var ICONS = {
    "folder": "<path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"/>",
    "server": "<rect x=\"2\" y=\"3\" width=\"20\" height=\"7\" rx=\"2\"/><rect x=\"2\" y=\"14\" width=\"20\" height=\"7\" rx=\"2\"/><line x1=\"6\" y1=\"6.5\" x2=\"6.01\" y2=\"6.5\"/><line x1=\"6\" y1=\"17.5\" x2=\"6.01\" y2=\"17.5\"/>",
    "drive": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M21 12c0 1.66-4 3-9 3s-9-1.34-9-3\"/><path d=\"M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5\"/>",
    "warn": "<path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>",
    "bot": "<rect x=\"4\" y=\"8\" width=\"16\" height=\"12\" rx=\"2\"/><path d=\"M12 8V4\"/><circle cx=\"12\" cy=\"3\" r=\"1\"/><path d=\"M8 14h.01M16 14h.01M8 18h.01M16 18h.01\"/>",
    "refresh": "<polyline points=\"23 4 23 10 17 10\"/><polyline points=\"1 20 1 14 7 14\"/><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"/>",
    "play": "<polygon points=\"6 3 20 12 6 21 6 3\"/>",
    "sliders": "<line x1=\"21\" y1=\"4\" x2=\"14\" y2=\"4\"/><line x1=\"10\" y1=\"4\" x2=\"3\" y2=\"4\"/><line x1=\"21\" y1=\"12\" x2=\"12\" y2=\"12\"/><line x1=\"8\" y1=\"12\" x2=\"3\" y2=\"12\"/><line x1=\"21\" y1=\"20\" x2=\"16\" y2=\"20\"/><line x1=\"12\" y1=\"20\" x2=\"3\" y2=\"20\"/><line x1=\"14\" y1=\"2\" x2=\"14\" y2=\"6\"/><line x1=\"8\" y1=\"10\" x2=\"8\" y2=\"14\"/><line x1=\"16\" y1=\"18\" x2=\"16\" y2=\"22\"/>",
    "trash": "<polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>",
    "plus": "<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>",
    "radio": "<path d=\"M4.9 19.1C1 15.2 1 8.8 4.9 4.9\"/><path d=\"M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5\"/><path d=\"M19.1 4.9C23 8.8 23 15.2 19.1 19.1\"/>",
    "down": "<polyline points=\"23 18 13.5 8.5 8.5 13.5 1 6\"/><polyline points=\"17 18 23 18 23 12\"/>",
    "activity": "<polyline points=\"22 12 18 12 15 21 9 3 6 12 2 12\"/>",
    "maximize": "<polyline points=\"15 3 21 3 21 9\"/><polyline points=\"9 21 3 21 3 15\"/><line x1=\"21\" y1=\"3\" x2=\"14\" y2=\"10\"/><line x1=\"3\" y1=\"21\" x2=\"10\" y2=\"14\"/>",
    "x": "<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>",
    "columns": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"21\"/>",
    "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"/>",
    "book": "<path d=\"M4 19.5A2.5 2.5 0 0 1 6.5 17H20\"/><path d=\"M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z\"/>",
    "cpu": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\"/><path d=\"M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3\"/>"
  };
  function ic(key, size) {
    size = size || 16;
    return '<svg class="pm-ic" xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[key] || "") + "</svg>";
  }
  var EMO = {
    "\ud83d\udcc1": "folder",
    "\ud83d\udda5": "server",
    "\ud83d\uddc4": "drive",
    "\u26a0": "warn",
    "\ud83e\udd16": "bot",
    "\u27f3": "refresh",
    "\u25b6": "play",
    "\u2699": "sliders",
    "\ud83d\uddd1": "trash",
    "\uff0b": "plus",
    "\ud83d\udce1": "radio",
    "\ud83d\udcc9": "down",
    "\ud83e\ude7a": "activity",
    "\u26f6": "maximize",
    "\u2715": "x",
    "\u25eb": "columns",
    "\ud83d\udd0d": "search",
    "\ud83d\udcda": "book",
    "\ud83d\udcbb": "cpu"
  };
  var EMO_RE = new RegExp(Object.keys(EMO).join("|"), "gu");
  var SWAP_SEL = ".nav,.topbar,.section-h,.card-title,.dash-proj-head,.stat,.mach-toolbar,.t,.badge,.lvl-tabs,.btn,.rack-cop-head,.modal,.rm-modal,.ug-window,.ar-window,.empty";
  function swapRoot(el) {
    var targets = (el.matches && el.matches(SWAP_SEL)) ? [el] : [];
    if (!targets.length && el.querySelectorAll) {
      var q = el.querySelectorAll(SWAP_SEL);
      for (var t = 0; t < q.length; t++) targets.push(q[t]);
    }
    for (var t = 0; t < targets.length; t++) swapIn(targets[t]);
  }
  function swapIn(container) {
    var text = container && container.textContent;
    if (!text || !EMO_RE.test(text)) return;
    EMO_RE.lastIndex = 0;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var tmp;
    while ((tmp = walker.nextNode())) nodes.push(tmp);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var val = n.nodeValue;
      if (!val || !EMO_RE.test(val)) continue;
      EMO_RE.lastIndex = 0;
      var frag = (n.ownerDocument || document).createDocumentFragment();
      var last = 0;
      var m, text = "";
      while ((m = EMO_RE.exec(val)) !== null) {
        if (m.index > last) frag.appendChild(n.ownerDocument.createTextNode(val.slice(last, m.index)));
        var key = EMO[m[0]];
        if (key) {
          var span = n.ownerDocument.createElement("span");
          span.className = "pm-swap";
          span.setAttribute("aria-hidden", "true");
          span.innerHTML = ic(key, 15);
          frag.appendChild(span);
        } else {
          frag.appendChild(n.ownerDocument.createTextNode(m[0]));
        }
        last = m.index + m[0].length;
      }
      if (last < val.length) frag.appendChild(n.ownerDocument.createTextNode(val.slice(last)));
      n.parentNode.replaceChild(frag, n);
    }
  }
  function ensureToastRoot() {
    var root = document.getElementById("pm-toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "pm-toast-root";
      document.body.appendChild(root);
    }
    return root;
  }
  function toast(msg, type, dur) {
    type = type || "info"; dur = dur || 3500;
    var box = ensureToastRoot();
    var t = document.createElement("div");
    t.className = "pm-toast " + type;
    t.innerHTML = '<span class="pm-toast-msg"></span><button class="pm-close" title="\u95dc\u9589">&times;</button>';
    t.querySelector(".pm-toast-msg").textContent = String(msg);
    t.querySelector(".pm-close").onclick = function () { t.remove(); };
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, dur);
  }

  // ---- Topbar global pills (managed / online / offline / power) ----
  function renderPills() {
    var root = document.getElementById("pm-globalpills");
    if (!root) return;
    var total = machines.length;
    var racks = machines.filter(function (m) { return (window.isRackItem ? isRackItem(m) : m.level === "rack"); }).length;
    var sys = total - racks;
    var pwrOn = machines.filter(function (m) { return m.power === "ON"; }).length;
    var pwrOff = machines.filter(function (m) { return m.power === "OFF"; }).length;
    var defs = [
      { cls: "pill p-num", dot: "#38bdf8", txt: "\u53d7\u7ba1 " + total },
      { cls: "pill p-on", dot: "#22c55e", txt: "\u6a5f\u6ac3 " + racks },
      { cls: "pill p-off", dot: "#f43f5e", txt: "\u7cfb\u7d71 " + sys },
      { cls: "pill p-pwr", dot: "#f59e0b", txt: "\u96fb\u6e90 " + pwrOn + "/" + pwrOff }
    ];
    root.innerHTML = defs.map(function (d) {
      return '<span class="' + d.cls + '" title="' + d.txt + '">' +
        '<span class="dot" style="background:' + d.dot + '"></span>' + d.txt + "</span>";
    }).join("");
  }

  // ---- Dashboard: health bar + alerts ----
  function renderHealth() {
    var content = document.getElementById("content");
    if (!content || content.querySelector("[data-pm-health]")) return;
    var host = content.querySelector(".dash-mid, .dash-kpis, .dm-hero");
    if (!host) return;
    var ms = machines || [];
    var total = ms.length;
    var on = ms.filter(function (m) { return m.os_alive === true; }).length;
    var off = total - on;
    var pct = total ? Math.round(on / total * 100) : 0;
    var bar = '<span style="width:' + pct + '%;background:var(--green)" title="\u5728\u7dda ' + on + '"></span>' +
      '<span style="width:' + (total ? Math.round(off / total * 100) : 0) + '%;background:var(--amber)" title="\u5176\u4ed6 ' + off + '"></span>';
    var bad = ms.filter(function (m) { return m.os_ip && m.os_alive === false; });
    var alerts = bad.slice(0, 5).map(function (m) {
      var n = String(m.name || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      return '<div class="pm-alert err" data-name="' + n + '" onclick="openMachineFromAlert(this.dataset.name)"><span class="dot" style="background:var(--err)"></span><b>' + n + '</b><span style="margin-left:auto;font-size:11px">\u96e2\u7dda</span></div>';
    }).join("");
    var div = document.createElement("div");
    div.setAttribute("data-pm-health", "1");
    div.id = "pm-health";
    div.innerHTML = '<div class="pm-health-bar">' + bar + "</div>" + (bad.length ? '<div class="pm-alerts">' + alerts + "</div>" : "");
    host.parentNode.insertBefore(div, host);
  }

  // ---- Machine detail: status banner ----
  function renderMachBanner() {
    if ((state || {}).view !== "machine") return;
    var name = _activeMachine;
    var m = (machines || []).find(function (x) { return x.name === name; });
    if (!m) return;
    var content = document.getElementById("content");
    if (!content || content.querySelector(".pm-mach-status")) return;
    var osSt = m.os_alive === true ? "\u5728\u7dda" : (m.os_alive === false ? "\u96e2\u7dda" : "\u672a\u77e5");
    var tiles = [
      { k: "OS IP", v: m.os_ip || "\u2014" },
      { k: "BMC IP", v: m.bmc_ip || "\u2014" },
      { k: "OS \u72c0\u614b", v: osSt },
      { k: "BMC \u96fb\u6e90", v: m.power || "\u2014" },
      { k: "\u5c64\u7d1a", v: m.level || "\u2014" }
    ];
    var div = document.createElement("div");
    div.className = "pm-mach-status";
    div.innerHTML = tiles.map(function (t) {
      return '<div class="pm-mach-tile"><div class="k">' + t.k + '</div><div class="v">' + String(t.v).replace(/</g, "&lt;") + "</div></div>";
    }).join("");
    content.insertBefore(div, content.firstChild);
  }
  // ---- Cmd+K palette ----
  function buildCmdk() {
    var d = document.getElementById("pm-cmdk");
    if (d) return;
    d = document.createElement("div");
    d.id = "pm-cmdk";
    d.innerHTML = '<div id="pm-cmdk-box"><input id="pm-cmdk-input" placeholder="\u8f38\u5165\u4ee5\u641c\u5c0b\u2026" autocomplete="off"><div id="pm-cmdk-list"></div><div class="pm-cmdk-hint">\u2191\u2193 \u9078\u64c7 \u00b7 Enter \u9032\u5165 \u00b7 Esc \u95dc\u9589</div></div>';
    d.addEventListener("mousedown", function (e) { if (e.target === d) closeCmdk(); });
    document.body.appendChild(d);
    var input = document.getElementById("pm-cmdk-input");
    input.addEventListener("input", renderCmdk);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var items = document.querySelectorAll("#pm-cmdk-list .pm-cmdk-item[data-i]");
        if (!items.length) return;
        var cur = -1;
        items.forEach(function (elwd) { if (elwd.classList.contains("sel")) cur = parseInt(elwd.getAttribute("data-i"), 10); });
        cur += (e.key === "ArrowDown" ? 1 : -1);
        if (cur < 0 || cur >= items.length) cur = (cur < 0) ? items.length - 1 : 0;
        items.forEach(function (elwd) { elwd.classList.remove("sel"); });
        var hit = document.querySelector('#pm-cmdk-list .pm-cmdk-item[data-i="' + cur + '"]');
        if (hit) { hit.classList.add("sel"); try { hit.scrollIntoView({ block: "nearest" }); } catch (_) {} }
      } else if (e.key === "Enter") {
        e.preventDefault();
        var sel = document.querySelector("#pm-cmdk-list .pm-cmdk-item.sel");
        if (sel) sel.click();
      }
    });
  }
  function cmdkItems() {
    var items = [];
    (machines || []).forEach(function (m) {
      var n = String(m.name || "");
      items.push({ label: n + "  " + (m.os_ip || ""), cat: "system", go: function () { if (viewMachine) viewMachine(n); } });
    });
    (projects || []).forEach(function (p) {
      var nm = String(p.name || "");
      items.push({ label: nm, cat: "project", go: function () { if (viewProject) viewProject(nm); } });
    });
    var navs = [
      { label: "\u4e3b\u63a7\u81fa\u8868 Dashboard", cat: "view", go: function () { setView("dashboard"); } },
      { label: "\u7cfb\u7d71\u7ba1\u7406 Systems", cat: "view", go: function () { setView("systems"); } },
      { label: "Rack \u6a5f\u6ac3", cat: "view", go: function () { setView("rack"); } },
      { label: "\u5c08\u6848 Projects", cat: "view", go: function () { setView("projects"); } }
    ];
    navs.forEach(function (n) { items.push(n); });
    return items;
  }
  function renderCmdk() {
    var input = document.getElementById("pm-cmdk-input");
    var list = document.getElementById("pm-cmdk-list");
    if (!input || !list) return;
    var q = input.value.trim().toLowerCase();
    var items = cmdkItems().filter(function (i) { return !q || i.label.toLowerCase().indexOf(q) !== -1; }).slice(0, 40);
    list.innerHTML = items.map(function (it, idx) {
      var icon = it.cat === "project" ? "folder" : (it.cat === "view" ? "columns" : "server");
      return '<div class="pm-cmdk-item" data-i="' + idx + '"><span class="k">' + ic(icon, 14) + '</span><span>' + String(it.label).replace(/</g, "&lt;") + '</span><span class="cat">' + it.cat + "</span></div>";
    }).join("");
    list.querySelectorAll(".pm-cmdk-item[data-i]").forEach(function (elwd) {
      elwd.addEventListener("click", function () {
        var idx = parseInt(elwd.getAttribute("data-i"), 10);
        var it = items[idx];
        if (it) { closeCmdk(); it.go(); }
      });
    });
  }
  function toggleCmdk() {
    var d = document.getElementById("pm-cmdk");
    if (d && d.classList.contains("open")) { closeCmdk(); return; }
    buildCmdk();
    document.getElementById("pm-cmdk").classList.add("open");
    var inp = document.getElementById("pm-cmdk-input");
    inp.value = ""; renderCmdk();
    setTimeout(function () { inp.focus(); }, 30);
  }
  function closeCmdk() { var d = document.getElementById("pm-cmdk"); if (d) d.classList.remove("open"); }
  function extraEsc() {
    var tm = document.getElementById("term-modal");
    if (tm && tm.style.display === "flex" && closeTerm) { closeTerm(); return; }
    var bm = document.getElementById("bc-modal");
    if (bm && bm.style.display === "flex" && closeBroadcast) { closeBroadcast(); return; }
  }
  function openMachineFromAlert(name) {
    if (viewMachine) viewMachine(name);
  }

  var timer = null;
  function onMut() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      var content = document.getElementById("content");
      if (content) swapRoot(content);
      renderPills(); renderMachBanner();
    }, 80);
  }
  try { new MutationObserver(onMut).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  window.toast = toast;
  window.pm = { ic: ic, swapRoot: swapRoot, toggleCmdk: toggleCmdk, closeCmdk: closeCmdk };
  window.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toggleCmdk(); }
    else if (e.key === "Escape") {
      var d = document.getElementById("pm-cmdk");
      if (d && d.classList.contains("open")) closeCmdk();
      else extraEsc();
    }
  });
  function injectPills() {
    var tb = document.querySelector(".topbar");
    var existing = document.getElementById("pm-globalpills");
    if (!tb || existing) return;
    var root = document.createElement("div");
    root.id = "pm-globalpills";
    tb.insertBefore(root, tb.querySelector(".user") || tb.firstChild);
  }
  injectPills();
  setTimeout(function () {
    swapRoot(document.body); renderPills(); renderMachBanner();
  }, 700);
  setInterval(renderPills, 10000);
  setTimeout(function(){ renderPills(); }, 3000);

  // ---- Layer2: topbar live clock (pulsing green dot) ----
  (function initClock() {
    var el = null;
    function make() {
      if (el && document.body.contains(el)) return el;
      el = document.createElement("span");
      el.className = "pm-clock";
      var tb = document.querySelector(".topbar");
      if (!tb) return null;
      tb.insertBefore(el, tb.querySelector(".user") || tb.firstChild);
      return el;
    }
    function tick() {
      var e = make(); if (!e) return;
      e.textContent = new Date().toLocaleString("zh-TW", { hour12: false }).replace("/", "-").replace("/", "-");
    }
    tick(); setInterval(tick, 1000);
  })();

  // ---- Layer2: KPI stat card icon chips + count-up ----
  var KPI_META = {
    "\u53d7\u7ba1\u7cfb\u7d71": "server",
    "Rack / L11": "columns",
    "System / L10": "cpu",
    "\u96e2\u7dda": "warn"
  };
  function kpiTone(k) {
    if (/Rack/.test(k) || /L11/.test(k)) return "#38bdf8";
    if (/L10/.test(k)) return "#34d399";
    if (/\u53d7\u7ba1/.test(k)) return "#818cf8";
    return "#f43f5e";
  }
  function decorateKpis() {
    var stats = document.querySelectorAll(".dash-kpis .stat");
    for (var i = 0; i < stats.length; i++) {
      var s = stats[i];
      if (s.querySelector(".pm-kpi-ic")) continue;
      var kEl = s.querySelector(".k");
      var key = kEl ? kEl.textContent.trim() : "";
      var color = kpiTone(key);
      var chip = document.createElement("span");
      chip.className = "pm-kpi-ic";
      chip.style.color = color;
      chip.style.background = "color-mix(in srgb, " + color + "14%, transparent)";
      chip.style.boxShadow = "inset 0 0 0 1px color-mix(in srgb, " + color + "28%, transparent)";
      chip.innerHTML = ic(KPI_META[key] || "activity", 15);
      s.appendChild(chip);
      var vEl = s.querySelector(".v");
      if (vEl && /^\d+/.test(vEl.textContent)) {
        var target = parseInt(vEl.textContent, 10);
        var v0 = vEl.textContent;
        var t0 = null;
        function step(ts) {
          if (!t0) t0 = ts;
          var pr = Math.min(1, (ts - t0) / 600);
          var eased = 1 - Math.pow(1 - pr, 3);
          vEl.textContent = v0.replace(/^\d+/, String(Math.round(target * eased)));
          if (pr < 1) requestAnimationFrame(step);
        }
        try { requestAnimationFrame(step); } catch (e) {}
      }
    }
  }
  var kpiTimer = null;
  function onKpiTimer() {
    if (kpiTimer) clearTimeout(kpiTimer);
    kpiTimer = setTimeout(decorateKpis, 120);
  }
  var kpiObs = null;
  try {
    kpiObs = new MutationObserver(onKpiTimer);
    kpiObs.observe(document.getElementById("content"), { childList: true, subtree: true });
  } catch (e) {}
  setTimeout(decorateKpis, 900);
})();

