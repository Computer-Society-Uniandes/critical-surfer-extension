// content.js

// ===================================================================
// FEATURE 1: PROACTIVE PAGE ANALYZER (runs on page load)
// ===================================================================
function runPageAnalysis() {
  try {
    const mainContent = (document.body?.innerText || '').trim();
    if (!mainContent) return;
    chrome.runtime.sendMessage({ action: 'analyzePage', content: mainContent });
  } catch (e) {
    // Ignore
  }
}

window.addEventListener('load', runPageAnalysis, { once: true });

// ===================================================================
// FEATURE 2: REACTIVE COMMUNICATION ASSISTANT (runs on user input)
// ===================================================================
let csSuggestionEl = null;
let csCurrentTarget = null;
let csLastAnalyzedText = '';

function ensureSuggestionUI() {
  if (csSuggestionEl) return csSuggestionEl;
  csSuggestionEl = document.createElement('div');
  csSuggestionEl.id = 'cs-suggestion-box';
  csSuggestionEl.innerHTML = `
    <div class="cs-header">Constructive suggestion</div>
    <div class="cs-body"><div class="cs-suggestion-text">Analyzing…</div></div>
    <div class="cs-actions">
      <button class="cs-apply">Apply</button>
      <button class="cs-dismiss">Dismiss</button>
    </div>
  `;
  document.documentElement.appendChild(csSuggestionEl);

  csSuggestionEl.querySelector('.cs-dismiss').addEventListener('click', () => hideSuggestion());
  csSuggestionEl.querySelector('.cs-apply').addEventListener('click', () => applySuggestion());
  return csSuggestionEl;
}

function hideSuggestion() {
  if (csSuggestionEl) csSuggestionEl.style.display = 'none';
  csCurrentTarget = null;
}

function applySuggestion() {
  if (!csCurrentTarget || !csSuggestionEl) return;
  const text = csSuggestionEl.querySelector('.cs-suggestion-text')?.textContent || '';
  setElementText(csCurrentTarget, text);
  hideSuggestion();
}

function getElementText(el) {
  if (!el) return '';
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) return el.value;
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return el.innerText;
  return '';
}

function setElementText(el, text) {
  if (!el) return;
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) {
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    el.innerText = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function debounce(fn, wait) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const analyzeInputDebounced = debounce(() => {
  if (!csCurrentTarget) return;
  const text = getElementText(csCurrentTarget).trim();
  if (!text || text.length < 12) { hideSuggestion(); return; }
  if (text === csLastAnalyzedText) return;
  csLastAnalyzedText = text;

  chrome.runtime.sendMessage({ action: 'analyzeTextForRewrite', text }, (res) => {
    const suggestion = res && res.suggestion ? `${res.suggestion}`.trim() : '';
    if (!suggestion) { hideSuggestion(); return; }
    const box = ensureSuggestionUI();
    box.querySelector('.cs-suggestion-text').textContent = suggestion;
    positionSuggestionBox(csCurrentTarget, box);
    box.style.display = 'block';
  });
}, 600);

function positionSuggestionBox(target, box) {
  if (!target || !box) return;
  const rect = target.getBoundingClientRect();
  const top = Math.max(8, rect.bottom + window.scrollY + 6);
  const left = Math.max(8, rect.left + window.scrollX);
  box.style.top = `${top}px`;
  box.style.left = `${left}px`;
}

function isEditable(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT' && el.type === 'text') return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute('role');
  if (role && role.toLowerCase() === 'textbox') return true;
  return false;
}

function attachInputListeners(root) {
  root.addEventListener('focusin', (e) => {
    const t = e.target;
    if (isEditable(t)) {
      csCurrentTarget = t;
      analyzeInputDebounced();
    }
  });

  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t === csCurrentTarget && isEditable(t)) analyzeInputDebounced();
  });

  window.addEventListener('scroll', () => {
    if (csCurrentTarget && csSuggestionEl && csSuggestionEl.style.display === 'block') {
      positionSuggestionBox(csCurrentTarget, csSuggestionEl);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (csCurrentTarget && csSuggestionEl && csSuggestionEl.style.display === 'block') {
      positionSuggestionBox(csCurrentTarget, csSuggestionEl);
    }
  });
}

// Observe dynamic apps (SPAs) for new editors
const mo = new MutationObserver((mList) => {
  for (const m of mList) {
    for (const node of m.addedNodes) {
      if (node.nodeType === 1) {
        // If a new editable appears, we can immediately bind by relying on bubbling
        // No per-node listeners needed because we already listen on document
      }
    }
  }
});
mo.observe(document.documentElement, { childList: true, subtree: true });

attachInputListeners(document);


