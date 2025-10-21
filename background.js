// background.js

// In-memory store mapping tabId -> array of questions (latest analysis)
const pageAnalysisResults = {};

// Utility: create an AI API instance if available (2025 self.* entry points)
async function createIfAvailable(Cls) {
  try {
    if (Cls && typeof Cls.availability === 'function') {
      const availability = await Cls.availability();
      if (availability && availability.status === 'available' && typeof Cls.create === 'function') {
        return await Cls.create();
      }
    }
  } catch (e) {
    // Ignore and fallback to heuristics
  }
  return null;
}

// ===================================================================
// FEATURE 1: PROACTIVE PAGE ANALYZER
// ===================================================================
async function analyzePageContent(pageText, tabId) {
  try {
    const truncated = (pageText || '').trim().slice(0, 60000);
    let result;

    try {
      // Summarize content to reduce token load
      const summarizer = await createIfAvailable(typeof self !== 'undefined' ? self.Summarizer : undefined);
      if (summarizer) {
        const summary = await summarizer.execute({ input: truncated, options: { length: 'short' } });

        const promptText = `
          Based on the following summary of a webpage, identify potential red flags for a young user.
          Red flags include: strong emotional language (fear, anger), urgent calls to action, claims without evidence, or a heavily biased perspective.
          Then, generate exactly 3 short, simple critical thinking questions to help the user evaluate the content.
          Return the response as a JSON object with two keys: "hasRedFlags" (boolean) and "questions" (an array of strings).

          Summary: "${summary}"
        `;

        const promptApi = await createIfAvailable(typeof self !== 'undefined' ? self.Prompt : undefined);
        if (promptApi) {
          const response = await promptApi.execute({ input: promptText });
          try {
            result = JSON.parse(response);
          } catch (parseErr) {
            // Fallback to heuristic JSON if parsing fails
            result = heuristicPageAnalysis(truncated);
          }
        } else {
          // Prompt API not available
          result = heuristicPageAnalysis(truncated);
        }
      } else {
        // Summarizer not available
        result = heuristicPageAnalysis(truncated);
      }
    } catch (aiErr) {
      // Any AI errors -> heuristic analysis
      result = heuristicPageAnalysis(truncated);
    }

    // Persist and update UI
    pageAnalysisResults[tabId] = Array.isArray(result.questions) && result.questions.length > 0
      ? result.questions.slice(0, 3)
      : [
          'What evidence supports the main claims?',
          'Is the language emotional or neutral?',
          "Can you find a source with an opposing view?"
        ];

    await updateIconAndBadge(tabId, !!result.hasRedFlags);
  } catch (error) {
    console.error('Critical Surfer: Page analysis failed.', error);
    await updateIconAndBadge(tabId, false);
  }
}

function heuristicPageAnalysis(text) {
  const emotionalWords = [
    'shocking','unbelievable','disaster','scandal','ruined','destroyed','furious','rage','terrified','panic',
    'urgent','now','immediately','must','exposed','secret','banned','outrage','humiliated','crushed'
  ];
  const clickbaitPhrases = [
    "you won't believe","what happens next","before it's too late","the truth about","nobody talks about",
    'shocking truth','goes viral','breaks the internet','mind-blowing','jaw-dropping','click here','free!!!'
  ];

  const lower = (text || '').toLowerCase();
  const emotionalCount = emotionalWords.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
  const clickbaitCount = clickbaitPhrases.reduce((acc, p) => acc + (lower.includes(p) ? 1 : 0), 0);

  const exclamations = (text.match(/!+/g) || []).length;
  const allCapsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;

  const hasRedFlags = emotionalCount + clickbaitCount + (exclamations > 2 ? 1 : 0) + (allCapsWords > 5 ? 1 : 0) >= 2;

  const questions = [
    'What specific evidence or sources back these claims?',
    'Is the language trying to trigger a strong emotion?',
    'What might be the author\'s goal in sharing this?'
  ];

  return { hasRedFlags, questions };
}

async function updateIconAndBadge(tabId, hasRedFlags) {
  try {
    // Badge fallback so MVP works even without custom icons
    await chrome.action.setBadgeBackgroundColor({ color: hasRedFlags ? '#f59e0b' : '#00000000', tabId });
    await chrome.action.setBadgeText({ text: hasRedFlags ? '!' : '', tabId });
  } catch (e) {
    // Ignore
  }

  // Try to set icon if assets are present (non-fatal if missing)
  const iconPath = hasRedFlags ? 'icons/icon_warning128.png' : 'icons/icon128.png';
  try {
    await chrome.action.setIcon({ tabId, path: iconPath });
  } catch (e) {
    // Ignore — badge already communicates state
  }
}

// ===================================================================
// FEATURE 2: REACTIVE COMMUNICATION ASSISTANT
// ===================================================================
async function getConstructiveRewrite(text) {
  const input = (text || '').trim();
  if (!input) return null;

  try {
    try {
      const promptApi = await createIfAvailable(typeof self !== 'undefined' ? self.Prompt : undefined);
      if (promptApi) {
        const toneCheck = await promptApi.execute({ input: `Is this text aggressive or non-constructive? Respond YES or NO.\n\n${input}` });
        if ((toneCheck || '').trim().toUpperCase() === 'YES') {
          const rewriterApi = await createIfAvailable(typeof self !== 'undefined' ? self.Rewriter : undefined);
          if (rewriterApi) {
            const rewrite = await rewriterApi.execute({ input, options: { tone: 'constructive' } });
            return (rewrite || '').trim() || null;
          }
        }
      }
    } catch (aiErr) {
      // Fall through to heuristic path
    }
    // Heuristic tone check and rewrite
    const flagged = heuristicIsAggressive(input);
    if (!flagged) return null;
    return heuristicConstructiveRewrite(input);
  } catch (error) {
    console.error('Critical Surfer: Rewrite failed.', error);
    return null;
  }
}

function heuristicIsAggressive(text) {
  const lower = text.toLowerCase();
  const insults = ['idiot','stupid','dumb','trash','garbage','shut up','hate you','loser','moron','worthless'];
  const insultHit = insults.some(w => lower.includes(w));

  const exclamations = (text.match(/!+/g) || []).length > 2;
  const allCapsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length > 2;

  return insultHit || exclamations || allCapsWords;
}

function titleCase(word) {
  return word.length ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;
}

function heuristicConstructiveRewrite(text) {
  // Replace common insults with neutral phrasing
  const replacements = [
    [/\bidiot\b/gi, 'person'],
    [/\bstupid\b/gi, 'unhelpful'],
    [/\bdumb\b/gi, 'not clear'],
    [/\btrash\b/gi, 'not useful'],
    [/\bgarbage\b/gi, 'not accurate'],
    [/\bmoron\b/gi, 'person'],
    [/\bworthless\b/gi, 'not helpful']
  ];

  let out = text;
  for (const [pattern, repl] of replacements) out = out.replace(pattern, repl);

  // Reduce shouting and punctuation
  out = out.replace(/!{2,}/g, '!');
  out = out.replace(/\?{2,}/g, '?');
  out = out.replace(/\b([A-Z]{4,})\b/g, (m) => titleCase(m));

  // Convert some "you" accusations into "I" statements
  out = out.replace(/\byou\s+are\b/gi, 'I feel');
  out = out.replace(/\byou\s+should\b/gi, 'I suggest we');

  // Add a softener if missing
  if (!/^\s*(i\s+(feel|think|suggest|believe)|let\'s)\b/i.test(out)) {
    out = `I think ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
  }

  return out.trim();
}

// ===================================================================
// MESSAGE LISTENERS
// ===================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'analyzePage') {
    const tabId = sender?.tab?.id;
    if (typeof tabId === 'number') analyzePageContent(request.content, tabId);
  } else if (request && request.action === 'analyzeTextForRewrite') {
    getConstructiveRewrite(request.text).then((suggestion) => sendResponse({ suggestion }));
    return true; // keep the message channel open for async response
  } else if (request && request.action === 'getAnalysisForPopup') {
    const questions = pageAnalysisResults[request.tabId] || [
      'No specific insights for this page. Always remember to think critically!'
    ];
    sendResponse({ questions });
  }
});

// Initialize: clear badge by default
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});


