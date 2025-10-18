// popup.js

function getActiveTabId() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs && tabs[0] ? tabs[0].id : undefined;
        resolve(tabId);
      });
    } catch (e) {
      resolve(undefined);
    }
  });
}

async function init() {
  const listEl = document.getElementById('critical-questions');
  const loadingEl = document.getElementById('loading');
  const tabId = await getActiveTabId();

  if (!tabId) {
    loadingEl.textContent = 'No active tab.';
    return;
  }

  chrome.runtime.sendMessage({ action: 'getAnalysisForPopup', tabId }, (res) => {
    loadingEl.style.display = 'none';
    const questions = (res && res.questions) || [];
    listEl.innerHTML = '';
    for (const q of questions) {
      const li = document.createElement('li');
      li.textContent = q;
      listEl.appendChild(li);
    }
    if (!questions.length) {
      const li = document.createElement('li');
      li.textContent = 'No specific insights for this page. Always remember to think critically!';
      listEl.appendChild(li);
    }
  });
}

document.addEventListener('DOMContentLoaded', init);


