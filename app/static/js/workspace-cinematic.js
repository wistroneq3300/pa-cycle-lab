/* Presentation-only workspace enhancement. No API, fixture or data changes. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dialogState = new WeakMap();
  let currentDialog = null;
  const visible = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const focusables = root => [...root.querySelectorAll('button:not(:disabled),[href],input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(visible);

  function bindStage(stage) {
    if (stage.dataset.wcBound) return;
    stage.dataset.wcBound = 'true';
    stage.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const rect = stage.getBoundingClientRect();
      stage.style.setProperty('--wc-x', `${((event.clientX - rect.left) / rect.width - .5) * 9}px`);
      stage.style.setProperty('--wc-y', `${((event.clientY - rect.top) / rect.height - .5) * 6}px`);
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
      stage.style.setProperty('--wc-x', '0px');
      stage.style.setProperty('--wc-y', '0px');
    });
  }

  function enhanceModalContent(modal) {
    const heading = modal.querySelector('.modal-title');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (heading) {
      if (!heading.id) heading.id = `${modal.closest('.modal-backdrop')?.id || 'workspace'}-heading`;
      modal.setAttribute('aria-labelledby', heading.id);
    }
    modal.querySelectorAll('.assign-sheet-card').forEach(card => {
      if (card.dataset.wcBound) return;
      card.dataset.wcBound = 'true';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
    });
    modal.querySelectorAll('.icon-btn').forEach(button => {
      if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', button.title || (button.textContent.trim() === '×' ? '關閉' : button.textContent.trim()));
    });
    const tools = modal.querySelector('.p-kvm-tools');
    const grid = modal.querySelector('.p-kvm-grid');
    if (tools && grid && !tools.dataset.wcBound) {
      tools.dataset.wcBound = 'true';
      const note = document.createElement('p');
      note.className = 'wc-preview-sync';
      note.setAttribute('role', 'status');
      grid.after(note);
      const toggles = [...tools.querySelectorAll('input[type=checkbox]')];
      const sync = () => {
        grid.dataset.keyboardSync = String(!!toggles[0]?.checked);
        grid.dataset.mouseSync = String(!!toggles[1]?.checked);
        const enabled = [toggles[0]?.checked && '鍵盤', toggles[1]?.checked && '滑鼠'].filter(Boolean);
        note.textContent = enabled.length ? `預覽同步模式：${enabled.join(' + ')} · 此預覽不傳送裝置輸入` : '預覽同步模式：未啟用 · 此預覽不傳送裝置輸入';
      };
      toggles.forEach(toggle => toggle.addEventListener('change', sync));
      sync();
    }
  }

  function bindDialog(backdrop) {
    if (dialogState.has(backdrop)) return;
    const modal = backdrop.querySelector('.modal');
    if (!modal) return;
    const entry = { open: false, opener: null, queued: false };
    dialogState.set(backdrop, entry);
    const updateVisibility = () => {
      const open = visible(backdrop);
      if (open && !entry.open) {
        entry.opener = document.activeElement;
        currentDialog = backdrop;
        enhanceModalContent(modal);
        requestAnimationFrame(() => {
          if (!visible(backdrop) || modal.contains(document.activeElement)) return;
          const first = modal.querySelector('input:not([type=hidden]):not(:disabled),select:not(:disabled),.modal-body button:not(:disabled),.modal-foot button:not(:disabled)') || focusables(modal)[0];
          first?.focus({ preventScroll: true });
        });
      } else if (!open && entry.open) {
        if (currentDialog === backdrop) currentDialog = null;
        if (entry.opener?.isConnected && visible(entry.opener)) entry.opener.focus({ preventScroll: true });
      }
      entry.open = open;
      modal.setAttribute('aria-hidden', String(!open));
    };
    new MutationObserver(updateVisibility).observe(backdrop, { attributes: true, attributeFilter: ['style', 'class'] });
    new MutationObserver(records => {
      if (entry.queued || !records.some(record => !record.target.closest?.('.xterm'))) return;
      entry.queued = true;
      requestAnimationFrame(() => { entry.queued = false; enhanceModalContent(modal); });
    }).observe(modal, { childList: true, subtree: true });
    enhanceModalContent(modal);
    updateVisibility();
  }

  // Existing test search recreates its input on every keystroke. Keep the caret and focus.
  const originalShowDialog = showDialog;
  showDialog = function(...args) {
    const focused = document.activeElement;
    const searchId = focused?.closest('.modal') && focused.matches('input[type=text],input:not([type]),textarea') ? focused.id : '';
    const selection = searchId ? [focused.selectionStart, focused.selectionEnd] : null;
    originalShowDialog(...args);
    const backdrop = document.getElementById('rm-dialog');
    if (backdrop) {
      bindDialog(backdrop);
      const modal = backdrop.querySelector('.modal');
      if (modal) enhanceModalContent(modal);
    }
    if (searchId) {
      const replacement = document.getElementById(searchId);
      if (replacement && visible(replacement)) {
        replacement.focus({ preventScroll: true });
        if (selection[0] != null) replacement.setSelectionRange(...selection);
      }
    }
  };

  document.addEventListener('keydown', event => {
    if (!currentDialog || !visible(currentDialog)) currentDialog=[...document.querySelectorAll('.modal-backdrop')].filter(visible).at(-1);
    if (!currentDialog) return;
    const modal = currentDialog.querySelector('.modal');
    if (!modal) return;
    if (event.key === 'Tab') {
      const items = focusables(modal);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
  });

  window.cinematicWorkspaceAfterRender = () => {
    document.querySelectorAll('.pd-showcase').forEach(bindStage);
    document.querySelectorAll('.modal-backdrop').forEach(bindDialog);
  };
  document.addEventListener('DOMContentLoaded', () => {
    window.cinematicWorkspaceAfterRender();
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && node.matches?.('.modal-backdrop')))) window.cinematicWorkspaceAfterRender();
    }).observe(document.body, { childList: true });
  });
})();
