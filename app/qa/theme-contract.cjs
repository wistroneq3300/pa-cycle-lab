/* Portable, dependency-free static / adapter contract tests.
 * Run: node qa/theme-contract.cjs
 * These checks are intentionally NOT a browser screenshot or complete WCAG
 * audit. They guard selector isolation, sampled material/text contrasts and the
 * real theme adapter in a tiny VM, without launching Chrome or a web server. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const css = read('static/css/wistron-light.css');
const html = read('static/index.html');
const cinematic = read('static/js/cinematic.js');
const app = read('static/js/app.js');
const scope = ':root[data-theme="light"]';
const checks = [];
function check(name, fn) {
  const detail = fn(); checks.push({ name, status:'passed', ...(detail ? {detail} : {}) });
  console.log('PASS ' + name);
}
function splitTopLevel(text, delimiter) {
  let quote = '', escaped = false, round = 0, square = 0, start = 0;
  const parts = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') round++;
    if (ch === ')') round--;
    if (ch === '[') square++;
    if (ch === ']') square--;
    assert.ok(round >= 0 && square >= 0, 'Unbalanced CSS parentheses/brackets');
    if (ch === delimiter && !round && !square) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  assert.equal(quote, '', 'Unclosed CSS string');
  assert.equal(round, 0, 'Unclosed CSS function');
  assert.equal(square, 0, 'Unclosed CSS attribute');
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}
const normalized = text => text.trim().replace(/\s+/g, ' ');
function parseStylesheet(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  function block(value) {
    let cursor = 0;
    while (cursor < value.length) {
      while (/\s/.test(value[cursor] || '') && cursor < value.length) cursor++;
      if (cursor === value.length) break;
      const open = value.indexOf('{', cursor);
      assert.ok(open >= 0, 'Unexpected CSS outside a block: ' + value.slice(cursor));
      const selector = value.slice(cursor, open).trim();
      assert.ok(selector && !selector.includes('}'), 'Missing or malformed CSS selector');
      let depth = 1, end = open + 1, quote = '', escaped = false;
      for (; end < value.length && depth; end++) {
        const ch = value[end];
        if (quote) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      assert.equal(depth, 0, 'Unclosed CSS rule: ' + selector);
      const body = value.slice(open + 1, end - 1);
      if (selector.startsWith('@')) {
        assert.match(selector, /^@media\s*\(/, 'Only scoped media groups allowed in light overrides');
        block(body);
      } else {
        const selectors = splitTopLevel(selector, ',').map(normalized);
        const declarations = {};
        for (const declaration of splitTopLevel(body, ';')) {
          const colon = declaration.indexOf(':');
          assert.ok(colon > 0, 'Malformed CSS declaration: ' + declaration);
          const key = declaration.slice(0, colon).trim();
          const val = declaration.slice(colon + 1).trim();
          assert.match(key, /^(?:--)?[a-z][a-z0-9-]*$/, 'Invalid CSS property');
          assert.ok(val, 'Missing CSS value for ' + key);
          assert.ok(!/[{}]/.test(val), 'Unexpected nesting in declaration');
          declarations[key] = val.replace(/\s*!important\s*$/, '');
        }
        rules.push({ selectors, declarations });
      }
      cursor = end;
    }
  }
  block(text);
  return rules;
}
const rules = parseStylesheet(css);
const tokenRule = rules.find(rule => rule.selectors.includes(scope));
const tokens = tokenRule.declarations;
function declaration(selector, key) {
  const qualified = selector ? scope + ' ' + selector : scope;
  let value;
  for (const rule of rules) if (rule.selectors.includes(qualified) && rule.declarations[key] !== undefined) value = rule.declarations[key];
  assert.ok(value, 'Missing scoped declaration: ' + qualified + ' / ' + key);
  return value;
}
function rgb(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i, 'Opaque sRGB hex expected, got ' + hex);
  return hex.slice(1).match(/../g).map(pair => parseInt(pair, 16) / 255);
}
function luminance(hex) {
  return rgb(hex).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((total, component, i) => total + component * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

check('01 Light CSS has balanced declarations and every selector is light-scoped', () => {
  assert.ok(rules.length > 200, 'Expected complete workspace theme coverage');
  for (const rule of rules) for (const selector of rule.selectors) {
    assert.ok(selector === scope || selector.startsWith(scope + ' '), 'Unscoped rule can change Dark: ' + selector);
  }
  assert.ok(!/@import|url\s*\(/i.test(css), 'Theme may not introduce remote images, fonts or imports');
  assert.ok(!/\b(?:display|position|width|height|transform|grid-template-columns)\s*:/i.test(css), 'Theme must not alter workflow layout');
  return { rules:rules.length, mode:'Light only' };
});

check('02 Pearl Light has distinct light surfaces and retained Wistron brand anchors', () => {
  assert.equal(tokens['color-scheme'], 'light');
  assert.equal(tokens['--p-accent'], '#006c93');
  assert.equal(tokens['--p-lime'], '#a1cc56');
  assert.ok(luminance(tokens['--p-bg']) > 0.8, 'Light background must actually be light');
  assert.ok(luminance(tokens['--p-panel']) > luminance(tokens['--p-bg']), 'Panel should rise above the worktop');
  assert.notEqual(tokens['--p-bg'], tokens['--p-panel']);
  assert.notEqual(tokens['--p-bg'], '#ffffff', 'Avoid a featureless all-white canvas');
  const stage = declaration('.cine-stage', 'background');
  assert.ok(stage.includes('#d5e1e4') && stage.includes('gradient'), 'Preserve pearl / silver stage hierarchy');
  return { background:tokens['--p-bg'], panel:tokens['--p-panel'], accent:tokens['--p-accent'] };
});

check('03 Sampled text and small 3D controls meet 4.5:1 on their opaque material bases', () => {
  // #d5e1e4 is the darkest solid stop in the hero stage. White highlights only
  // increase these ratios. This does not sample pixels over 3D geometry.
  const stage = '#d5e1e4';
  const samples = [
    ['normal text', tokens['--p-text'], tokens['--p-panel']],
    ['muted text', tokens['--p-muted'], tokens['--p-bg']],
    ['muted on stage', tokens['--p-muted'], stage],
    ['brand link', tokens['--p-accent'], tokens['--p-bg']],
    ['hero description', declaration('.cine-description', 'color'), stage],
    ['hero top label', declaration('.cine-stage-top', 'color'), stage],
    ['hero edition', declaration('.cine-stage-top .cine-edition', 'color'), stage],
    ['hero chapter', declaration('.cine-chapter', 'color'), stage],
    ['hero metrics', declaration('.cine-live-summary', 'color'), stage],
    ['object title', declaration('.cine-object-label', 'color'), stage],
    ['object caption', declaration('.cine-object-label small', 'color'), stage],
    ['drag and keyboard help', declaration('.cine-core-tools', 'color'), stage],
    ['scene footer', declaration('.cine-stage-bottom', 'color'), stage],
    ['scene buttons', declaration('.cine-core-tools button', 'color'), '#e0ebee'],
    ['primary CTA', declaration('.btn.primary', 'color'), '#a1cc56'],
    ['regular control', declaration('.btn', 'color'), '#e3eaea'],
    ['table value', declaration('.proj-card table.t td', 'color'), '#f8faf7'],
    ['hardware value', declaration('.pd-workspace .pd-original-section .hw-item', 'color'), '#e9f0ef'],
  ];
  return samples.map(([name, foreground, background]) => {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= 4.5, name + ' contrast ' + ratio.toFixed(2) + ':1 < 4.5:1');
    return {name, foreground, background, ratio:Number(ratio.toFixed(2))};
  });
});

check('04 Light palette precedes token-based shared workspace layers', () => {
  const styles = [...html.matchAll(/<link\b[^>]*href="([^"]+\.css(?:\?[^"]*)?)"[^>]*>/g)].map(match => match[1].split('?')[0]);
  assert.equal(styles.filter(item => item === '/static/css/wistron-light.css').length, 1);
  assert.equal(styles.at(-1), '/static/css/workspace-ux.css');
  for(const layer of ['workspace-reliability','equipment-workspace','engineering-ux','operations-ux','workspace-ux']) {
    assert.ok(styles.indexOf('/static/css/'+layer+'.css') > styles.indexOf('/static/css/wistron-light.css'));
  }
  assert.ok(styles.indexOf('/static/css/workspace-cinematic.css') < styles.indexOf('/static/css/wistron-light.css'));
  assert.match(app, /root\.dataset\.theme\s*=\s*t/);
  assert.match(app, /localStorage\.setItem\("pa_theme",\s*t\)/);
  assert.match(app, /theme-toggle[\s\S]*?addEventListener\("click",\s*\(\)\s*=>\s*applyTheme\(root\.dataset\.theme\s*===\s*"dark"\s*\?\s*"light"\s*:\s*"dark"\)/);
  return { stylesheet:styles.at(-1), persistence:'original pa_theme contract' };
});

check('05 Actual theme adapter updates labels, accessible state, charts and scene event', () => {
  const from = cinematic.indexOf("  const savedTheme = localStorage.getItem('pa_theme');");
  const to = cinematic.indexOf('  const two = ', from);
  assert.ok(from >= 0 && to > from, 'Theme adapter section was not found');
  const store = new Map([['pa_theme','dark']]), events = [], plugins = [], updates = [];
  const button = { attributes:{}, setAttribute(name, value) { this.attributes[name] = value; } };
  const root = {dataset:{theme:'dark'}};
  const chart = {canvas:{isConnected:true}, config:{options:{plugins:{legend:{labels:{}},title:{}},scales:{x:{ticks:{},grid:{},title:{}}}}},
    update(mode) { updates.push(mode); plugins.forEach(plugin => plugin.beforeUpdate(this)); }};
  const context = {
    localStorage:{getItem:key => store.get(key),setItem:(key,value) => store.set(key,value)},
    document:{documentElement:root,getElementById:id => id === 'theme-toggle' ? button : null},
    Chart:{defaults:{},instances:{chart,detached:{canvas:{isConnected:false},update(){throw Error('Detached chart must not update');}}},register:plugin=>plugins.push(plugin)},
    CustomEvent:function(type,init){this.type=type;this.detail=init.detail;},
    dispatchEvent:event => events.push(event),
    applyTheme:theme => {root.dataset.theme = theme;store.set('pa_theme',theme);},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(cinematic.slice(from,to), context, {timeout:1000});
  for (const theme of ['light','dark','light']) {
    context.applyTheme(theme);
    assert.equal(root.dataset.theme, theme);
    assert.equal(store.get('pa_theme'), theme);
    assert.equal(button.attributes['aria-pressed'], String(theme === 'light'));
    assert.equal(button.attributes['aria-label'], button.title);
    assert.ok(button.innerHTML.includes(theme === 'light' ? 'Light' : 'Dark'));
    assert.ok(button.title.includes(theme === 'light' ? 'Pearl Light' : 'Graphite Dark'));
    const color = theme === 'light' ? '#46616e' : '#a3b3c1';
    assert.equal(context.Chart.defaults.color, color);
    assert.equal(chart.config.options.color, color);
    assert.equal(chart.config.options.plugins.legend.labels.color, color);
    assert.equal(chart.config.options.scales.x.ticks.color, color);
    assert.equal(chart.config.options.scales.x.title.color, color);
    assert.equal(events.at(-1).type, 'pa-theme-change');
    assert.equal(events.at(-1).detail.theme, theme);
  }
  assert.deepEqual(updates, ['none','none','none']);
  assert.ok(contrast('#46616e', '#e9f0ef') >= 4.5, 'Light chart labels need sufficient contrast');
  assert.match(cinematic, /scene\?\.setTheme\?\.\(document\.documentElement\.dataset\.theme\)/);
  assert.match(cinematic, /scene\?\.setTheme\?\.\(event\.detail\.theme\)/);
  assert.match(cinematic, /addEventListener\('pa-theme-change',\s*onTheme\)/);
  assert.match(cinematic, /removeEventListener\('pa-theme-change',\s*onTheme\)/);
  return { transitions:'Dark → Light → Dark → Light', chartUpdates:updates.length, sceneListeners:'initial, change and cleanup' };
});

console.log(JSON.stringify({suite:'Wistron theme contract',passed:checks.length,checks,limitation:'Static representative contrast checks plus theme adapter VM; not a substitute for desktop visual / browser acceptance.'},null,2));
