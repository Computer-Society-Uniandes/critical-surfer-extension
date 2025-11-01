# StudyBuddy AI Demo & Submission Guide

This file keeps everything the judges need to replay the demo and verify the extension.

## 1. Environment prep

1. Use Chrome 138 or newer on Windows, macOS, Linux, or Chromebook Plus.
2. Visit `chrome://flags` and enable:
   - Prompt API for Gemini Nano
   - Summarizer API for Gemini Nano
   - Writer API for Gemini Nano
   - Rewriter API for Gemini Nano
   - Language Detector API for Gemini Nano
   - Translator API for Gemini Nano
3. Relaunch Chrome.
4. Go to `chrome://on-device-internals` and click **Install** for the Gemini Nano packages so the models are ready offline.

## 2. Install the extension locally

1. Clone the repo: `git clone https://github.com/Computer-Society-Uniandes/critical-surfer-extension.git`.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick the project folder.
3. Pin the extension so the icon is visible.

## 3. Demo flow (≤3 minutes)

1. **Intro (10s)** – State project, team, and challenge.
2. **Study Pack (60s)** – Open a medium article, click the extension, hit **Generate from this page**. Narrate the instant fallback and the upgraded AI artifacts (summary, takeaways, flashcards).
3. **Quiz (40s)** – Switch to the Quiz tab, tap **Regenerate quiz**, answer one MCQ to show explanations.
4. **Upload (35s)** – Paste or drop a short note or image, press **Process Notes**, then **Generate Quiz**.
5. **Progress (20s)** – Open the Progress tab to highlight saved packs, quiz stats, and concept counts.
6. **Closing (15s)** – Emphasize on-device Gemini Nano, privacy, and the dark futuristic UX.

## 4. Packaging for Devpost

1. Update `manifest.json` version (already set to 1.2.0).
2. In `chrome://extensions`, click **Pack extension** → select the project folder → keep the generated `.zip` for the submission.
3. Upload the `.zip`, the public repo link, and the video link to Devpost.

## 5. Submission checklist

- [x] README references the public GitHub repo.
- [x] LICENSE file included (MIT).
- [x] Demo video script ready (see section 3).
- [x] Repo contains all source files judges need.
- [ ] Record and publish the demo video on YouTube/Vimeo.
- [ ] Submit Devpost form with video URL, GitHub URL, `.zip`, and feature description.

