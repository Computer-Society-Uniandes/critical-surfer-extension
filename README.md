# Critical Surfer: Your AI Co-pilot for Digital Citizenship

Tagline: Moving beyond content blocking to build digital resilience.

This Chrome Extension acts as a two-mode "web guardian":

- Proactive Guardian: Analyzes pages on load, flags potential red flags, and surfaces 3 quick questions.
- Reactive Tutor: Suggests constructive rewrites while the user types comments.

Note: AI calls use Chrome's Built-in AI Early Preview APIs when available, and gracefully fall back to heuristics otherwise.

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the `critical-surfer-extension` folder.
4. Pin the extension. Browse to an article; if red flags are detected, the icon/badge alerts you. Click the icon to see questions.
5. Try typing a heated comment; a constructive suggestion box should appear near the editor.

## Manual Steps (Early Preview)

1. Join the Early Preview Program to access `chrome.ai.*` APIs.
2. Visit `chrome://flags` and enable Built-in AI / Web AI flags.
3. Add icons in `icons/` including `icon_warning128.png` (yellow variant).
4. Use `chrome://extensions` → background service worker console and page console for debugging.

## File Structure

```
/critical-surfer-extension
  manifest.json
  background.js
  content.js
  style.css
  popup.html
  popup.js
  /icons
    README.txt
    icon16.png
    icon48.png
    icon128.png
    icon_warning128.png
```

## How it Works

- Background: Stores per-tab analysis, switches icon/badge, provides constructive rewrites.
- Content script: Sends page text on load, observes inputs, requests rewrites, and shows a suggestion box.
- Popup: Shows the 3 critical thinking questions for the active tab.

## Judging Fit

- Purpose: Teaches meta-cognition and resilience rather than blocking.
- Functionality: Works on any site; on-device when available; heuristic fallback otherwise.
- Technical Execution: Chains Summarizer + Prompt; uses Rewriter or heuristics.
- UX: Ambient icon cue + on-demand popup + contextual assistant.

## Demo Video

Replace YOUR_YOUTUBE_VIDEO_ID in your repo landing page or docs when ready.


