/* Unit — pa-agent.js Markdown renderer (safe-subset).
 *
 * The PA Agent chat renders agent replies through `renderMarkdown()` instead of
 * raw esc() so Markdown (**bold**, | tables |, `code`, lists, quotes, hr) shows
 * as real markup. This guards two things:
 *   1. The supported syntax actually renders (no literal ** or | left behind).
 *   2. The renderer escapes HTML — it must NOT be an XSS vector.
 *
 * It extracts the real functions from app/static/js/pa-agent.js and exercises
 * them in Node; no DOM required.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "app", "static", "js", "pa-agent.js");
const src = fs.readFileSync(SRC, "utf8");

const escLine = src.match(/const esc = v =>[^\n]+/)[0];
const fns = src.slice(src.indexOf("function renderInline"), src.indexOf("// 狀態列"));
if (!escLine || !fns) {
  console.error("FAIL: could not extract renderer from pa-agent.js");
  process.exit(1);
}
const renderMarkdown = new Function(escLine + "\n" + fns + "\nreturn renderMarkdown;")();

const checks = [];
const add = (name, ok) => checks.push([name, !!ok]);

// 1. Bold
const bold = renderMarkdown("**粗體**");
add("bold -> <strong>", bold.includes("<strong>粗體</strong>") && !bold.includes("**"));

// 2. Horizontal rule
const hr = renderMarkdown("a\n\n---\n\nb");
add("hr -> <hr>", hr.includes("pa-md-hr") && !hr.includes("---"));

// 3. Table
const table = renderMarkdown("| # | 階段 | 動作 |\n|---|------|------|\n| 1 | 盤點 | lspci |");
add("table -> <table>", table.includes("<table") && table.includes("<th>#</th>") && table.includes("<td>盤點</td>"));
add("table: no literal pipe", !table.replace(/<[^>]+>/g, "").includes("|"));

// 4. Inline code
const code = renderMarkdown("執行 `lspci -nn` 指令");
add("inline code -> <code>", code.includes("<code>lspci -nn</code>") && !code.includes("`"));

// 5. Unordered / ordered list
const ul = renderMarkdown("- 甲\n- 乙");
add("ul -> <ul><li>", ul.includes("<ul") && ul.includes("<li>甲</li>") && ul.includes("<li>乙</li>"));
const ol = renderMarkdown("1. 一\n2. 二");
add("ol -> <ol><li>", ol.includes("<ol") && ol.includes("<li>一</li>"));

// 6. Blockquote
const q = renderMarkdown("> 唯讀風險");
add("blockquote -> <blockquote>", q.includes("<blockquote") && q.includes("唯讀風險") && !q.includes("&gt;"));

// 7. Heading
const h = renderMarkdown("## 標題");
add("heading -> <h2>", h.includes("<h2") && h.includes("標題") && !h.includes("##"));

// 8. Fenced code block
const fence = renderMarkdown("```\nrm -rf /\n```");
add("fenced code -> <pre><code>", fence.includes("pa-md-pre") && fence.includes("rm -rf /"));

// 9. CRITICAL security: HTML must be escaped, never injected
const xss = renderMarkdown('惡意 <img src=x onerror=alert(1)> 與 <script>alert(2)</script>');
add("XSS: <img> escaped", xss.includes("&lt;img") && !xss.includes("<img"));
add("XSS: <script> escaped", !xss.includes("<script") && xss.includes("&lt;script&gt;"));

// 10. javascript: link must not become an anchor
const badLink = renderMarkdown("[click](javascript:alert(1))");
add("XSS: javascript: link not anchored", !badLink.includes("javascript:alert(1)\">") || !badLink.includes("<a "));

let pass = 0;
for (const [name, ok] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) pass++;
}
console.log(`\nRESULT: ${pass === checks.length ? "PASS" : "FAIL"} (${pass}/${checks.length})`);
process.exit(pass === checks.length ? 0 : 1);
