from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root/'app/static/js/app.js'; text=path.read_text(encoding='utf-8')
needle='      <td style="white-space:nowrap">\n        <button class="btn small" onclick="editProjectStart('
assert needle in text
replacement='      <td style="white-space:nowrap">\n        <button class="btn small" data-cycle-project="${encodeURIComponent(p.name)}">Cycle Test</button>\n        <button class="btn small" onclick="editProjectStart('
text=text.replace(needle,replacement)
path.write_text(text,encoding='utf-8')
path=root/'app/static/index.html'; text=path.read_text(encoding='utf-8')
text=text.replace('</head>','<link rel="stylesheet" href="/static/css/cycle.css">\n</head>')
text=text.replace('</body>','<script src="/static/js/cycle.js"></script>\n</body>')
text=text.replace('<title>Wistron PA Server Manager</title>','<title>PA Cycle Lab</title>')
text=text.replace('(location.hostname === "127.0.0.1" && "https://portal.lab.example.internal/api/kvm/launch") ||','')
path.write_text(text,encoding='utf-8')
