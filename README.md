# StudyBuddy AI – Chrome Built-in AI Challenge 2025

> AI GROUP · Computer Society UNIANDES Bogotá, Colombia

StudyBuddy AI is a Chrome extension that turns any web page or personal note into a tailored learning kit in seconds. Powered entirely by Chrome’s on-device Gemini Nano APIs, the extension delivers summaries, key takeaways, flashcards, and adaptive quizzes on the fly—no cloud round-trips, no data leaks.

GitHub repository: https://github.com/Computer-Society-Uniandes/critical-surfer-extension

## Why it wins

- **High-impact use case:** transforms passive reading into active learning moments, ideal for students, knowledge workers, and lifelong learners.
- **Hybrid AI execution:** instant fallbacks render immediately while Gemini Nano upgrades flow in asynchronously, proving a best-in-class on-device experience.
- **Polished futuristic UX:** dark neon interface crafted for the demo video, fully in English, responsive, and accessible.
- **Battle-tested prompts:** curated instructional-design prompts keep all generated content on-topic, rigorous, and consistently English.
- **Concept intelligence:** Gemini Nano now returns key facts + question cues per concept, powering higher quality quizzes and flashcards.

## Feature tour

| Surface | What happens | Gemini Nano APIs |
| ------- | ------------- | ---------------- |
| **Study Pack** | Captures the active tab, produces a high-signal summary, key takeaways, study questions, flashcards, and focus plan. Fallback pack appears instantly; AI upgrade replaces it seconds later. | `Summarizer`, `Prompt` (LanguageModel), `Translator`, `LanguageDetector` |
| **Quick Quiz** | Generates five mastery-level questions (MCQ, T/F, short answer). Fast local quiz appears in <<1 s, then auto-upgrades when Gemini Nano finishes. | `Prompt` |
| **Upload Notes** | Accepts pasted text, .txt/.md/image notes. Applies OCR, translation to English, summarization, and quiz generation. | `Prompt` (multimodal image), `Translator`, `LanguageDetector`, `Summarizer` |
| **Progress Dashboard** | Tracks packs, quizzes, scores, and concepts learned with blazing-fast storage reads. | Chrome `storage.local` |

## Latency playbook

1. **Instant fallbacks:** all flows return local results immediately; on-device AI responses “upgrade” the UI asynchronously.
2. **Model reuse:** summarizer/writer/rewriter sessions are cached and warmed once per popup lifecycle.
3. **Payload trim:** every AI request is capped at 6 000 chars to keep inference snappy and on-device.
4. **Smart context capture:** DOM heuristics cherry-pick the highest-signal paragraphs before hitting the APIs.
5. **Prompt discipline:** explicit English-only, JSON-only prompts remove retries and parsing overhead.
6. **Pre-flight downloads:** judges can preload the Gemini Nano bundles, eliminating first-use waits (see setup).

## Chrome setup checklist

1. **Use Chrome 138+ desktop** on Windows 10/11, macOS 13+, Linux, or Chromebook Plus.
2. Visit `chrome://flags` and enable:
   - `Prompt API for Gemini Nano`
   - `Summarizer API for Gemini Nano`
   - `Writer API for Gemini Nano`
   - `Rewriter API for Gemini Nano`
   - `Language Detector API for Gemini Nano`
   - `Translator API for Gemini Nano`
   Relaunch Chrome when prompted.
3. Go to `chrome://on-device-internals` and click **Install** for the Gemini Nano model packages to preload them.
4. (Optional) Join the **Chrome Built-in AI Early Preview Program** for bleeding-edge builds and lower latency.

## Local installation

```bash
# clone the repo
git clone https://github.com/Computer-Society-Uniandes/critical-surfer-extension.git
cd critical-surfer-extension
```

Load the extension:
1. Open `chrome://extensions`.
2. Toggle **Developer mode** on.
3. Click **Load unpacked** and select the project directory.

## Architecture snapshot

```
popup.html  →  popup.js orchestrates UX + performance fallbacks
                ├─ study-modules/api-manager.js  (session cache + prompt hygiene)
                ├─ study-modules/note-processor.js (summaries, concepts, OCR)
                └─ study-modules/quiz-generator.js (AI + local quiz engine)
background.js → minimal logger; all heavy lifting stays in the document world
```

## Final prep for judges

- Review `docs/demo-instructions.md` for the full demo script, packaging steps, and submission checklist.
- Confirm the MIT license included in `LICENSE` aligns with Devpost requirements.
- Record the final walkthrough in English and link it alongside the GitHub repo in the Devpost form.

## Team

AI GROUP · Computer Society UNIANDES Bogotá, Colombia  
Built for the **Google Chrome Built-in AI Challenge 2025**


