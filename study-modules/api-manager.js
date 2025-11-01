// study-modules/api-manager.js
// Shared AI session manager for StudyBuddy surfaces (popup, background, offscreen)

const AI_API_CANDIDATES = {
  summarizer: ["Summarizer", "summarizer"],
  languageModel: ["LanguageModel", "languageModel", "Prompt", "prompt"],
  writer: ["Writer", "writer"],
  rewriter: ["Rewriter", "rewriter"],
  languageDetector: ["LanguageDetector", "languageDetector"],
  translator: ["Translator", "translator"],
};

function resolveChromeAIEntry(apiName) {
  const candidates = AI_API_CANDIDATES[apiName] || [apiName];

  for (const candidate of candidates) {
    if (typeof globalThis[candidate] !== "undefined") {
      return globalThis[candidate];
    }
    if (globalThis.ai && typeof globalThis.ai[candidate] !== "undefined") {
      return globalThis.ai[candidate];
    }
  }

  if (globalThis.ai && typeof globalThis.ai[apiName] !== "undefined") {
    return globalThis.ai[apiName];
  }

  if (typeof globalThis[apiName] !== "undefined") {
    return globalThis[apiName];
  }

  return null;
}

function sanitizeAvailabilityOptions(options) {
  if (!options) return undefined;

  // Shallow clone to avoid mutating caller state.
  const sanitized = Array.isArray(options) ? options.map((item) => ({ ...item })) : { ...options };

  if (!sanitized || typeof sanitized !== "object") {
    return undefined;
  }

  delete sanitized.monitor;
  delete sanitized.signal;
  delete sanitized.initialPrompts;

  if (sanitized.expectedInputs) {
    sanitized.expectedInputs = sanitized.expectedInputs.map((entry) => ({ ...entry, monitor: undefined }));
  }

  if (sanitized.expectedOutputs) {
    sanitized.expectedOutputs = sanitized.expectedOutputs.map((entry) => ({ ...entry, monitor: undefined }));
  }

  return sanitized;
}

async function checkAPIAvailability(apiName, options) {
  try {
    const apiEntry = resolveChromeAIEntry(apiName);
    if (!apiEntry) {
      console.warn(`${apiName} API is unavailable in this execution context.`);
      return null;
    }

    const availabilityFn = apiEntry.availability || apiEntry.Availability;
    if (typeof availabilityFn !== "function") {
      console.warn(`${apiName} availability() is not exposed.`);
      return null;
    }

    const availabilityOptions = sanitizeAvailabilityOptions(options);
    const availability = availabilityOptions
      ? await availabilityFn.call(apiEntry, availabilityOptions)
      : await availabilityFn.call(apiEntry);

    const availabilityState =
      typeof availability === "string"
        ? availability
        : availability?.state || availability?.availability || null;

    if (!availabilityState) {
      return null;
    }

    if (availabilityState === "unavailable") {
      return null;
    }

    return availabilityState;
  } catch (error) {
    console.error(`Error while checking availability for ${apiName}:`, error);
    return null;
  }
}

async function createAPISession(apiName, createOptions = {}, availabilityOptions) {
  try {
    const availabilityState = await checkAPIAvailability(apiName, availabilityOptions ?? createOptions);

    if (!availabilityState) {
      return null;
    }

    const apiEntry = resolveChromeAIEntry(apiName);
    if (!apiEntry || typeof apiEntry.create !== "function") {
      console.warn(`${apiName} create() not available in this context.`);
      return null;
    }

    const session = await apiEntry.create(createOptions);
    return session;
  } catch (error) {
    console.error(`${apiName} session creation failed:`, error);
    return null;
  }
}

class StudyBuddyAPIManager {
  constructor({ onDownloadProgress } = {}) {
    this.summarizerSession = null;
    this.languageModelSession = null;
    this.writerSession = null;
    this.rewriterSession = null;
    this.languageDetectorSession = null;
    this.translatorSessions = new Map();

    this.onDownloadProgress = onDownloadProgress;

    this.sessionCacheKey = {
      summarizer: null,
      languageModel: null,
      writer: null,
      rewriter: null,
      languageDetector: null,
    };

    this.languagePreferences = {
      input: ["en"],
      output: "en",
      context: ["en"],
    };
  }

  setLanguagePreferences({ input, output, context } = {}) {
    if (input && input.length) {
      this.languagePreferences.input = Array.from(new Set(input));
    }
    if (output) {
      this.languagePreferences.output = output;
    }
    if (context && context.length) {
      this.languagePreferences.context = Array.from(new Set(context));
    }
  }

  createMonitor(apiName) {
    if (typeof this.onDownloadProgress !== "function") {
      return undefined;
    }

    return (monitor) => {
      monitor.addEventListener("downloadprogress", (event) => {
        try {
          this.onDownloadProgress(apiName, event);
        } catch (error) {
          console.warn(`Download progress callback failed for ${apiName}:`, error);
        }
      });
    };
  }

  async initialize(options = {}) {
    const {
      summarizer = {},
      languageModel = {},
      writer = {},
      rewriter = {},
      languageDetector = {},
      languages = {},
    } = options;

    this.setLanguagePreferences(languages);

    await this.ensureLanguageDetector(languageDetector);
    await this.ensureSummarizer(summarizer);
    await this.ensureLanguageModel(languageModel);

    // Writer & Rewriter require an origin trial. They may remain unavailable.
    await this.ensureWriter(writer);
    await this.ensureRewriter(rewriter);
  }

  async destroy() {
    await Promise.all([
      this.destroySession("summarizer"),
      this.destroySession("languageModel"),
      this.destroySession("writer"),
      this.destroySession("rewriter"),
      this.destroySession("languageDetector"),
    ]);

    for (const [key, session] of this.translatorSessions.entries()) {
      try {
        session?.destroy?.();
      } catch (error) {
        console.warn(`Failed to destroy translator session ${key}`, error);
      }
    }
    this.translatorSessions.clear();
  }

  async destroySession(sessionName) {
    const propertyName = `${sessionName}Session`;
    const session = this[propertyName];
    if (session && typeof session.destroy === "function") {
      try {
        await session.destroy();
      } catch (error) {
        console.warn(`Failed to destroy ${sessionName} session`, error);
      }
    }
    this[propertyName] = null;
    this.sessionCacheKey[sessionName] = null;
  }

  getCacheKey(sessionName, options) {
    return JSON.stringify({ sessionName, options });
  }

  normalizeSummarizerOptions(options = {}) {
    const expectedInput = Array.from(
      new Set([...(options.expectedInputLanguages || []), ...this.languagePreferences.input, "en"])
    );

    const createOptions = {
      type: options.type || "key-points",
      format: options.format || "markdown",
      length: options.length || "medium",
      expectedInputLanguages: expectedInput,
      expectedContextLanguages: options.expectedContextLanguages || this.languagePreferences.context,
      outputLanguage: options.outputLanguage || "en",
      sharedContext: options.sharedContext,
      monitor: this.createMonitor("summarizer"),
    };

    const availabilityOptions = {
      type: createOptions.type,
      format: createOptions.format,
      length: createOptions.length,
      expectedInputLanguages: createOptions.expectedInputLanguages,
      expectedContextLanguages: createOptions.expectedContextLanguages,
      outputLanguage: createOptions.outputLanguage,
    };

    const cacheKey = this.getCacheKey("summarizer", availabilityOptions);

    return { createOptions, availabilityOptions, cacheKey };
  }

  normalizeLanguageModelOptions(options = {}) {
    const expectedInputLanguages = Array.from(
      new Set([...(options.expectedInputLanguages || []), ...this.languagePreferences.input, "en"])
    );
    const expectedOutputLanguages = Array.from(
      new Set([...(options.expectedOutputLanguages || []), this.languagePreferences.output || "en", "en"])
    );

    const createOptions = {
      temperature: typeof options.temperature === "number" ? options.temperature : 0.7,
      topK: typeof options.topK === "number" ? options.topK : 3,
      expectedInputs: options.expectedInputs || [
        {
          type: "text",
          languages: expectedInputLanguages,
        },
      ],
      expectedOutputs: options.expectedOutputs || [
        {
          type: "text",
          languages: expectedOutputLanguages,
        },
      ],
      monitor: this.createMonitor("languageModel"),
      initialPrompts: options.initialPrompts,
    };

    const availabilityOptions = {
      temperature: createOptions.temperature,
      topK: createOptions.topK,
      expectedInputs: createOptions.expectedInputs,
      expectedOutputs: createOptions.expectedOutputs,
    };

    const cacheKey = this.getCacheKey("languageModel", availabilityOptions);

    return { createOptions, availabilityOptions, cacheKey };
  }

  normalizeWriterOptions(options = {}) {
    const createOptions = {
      tone: options.tone || "neutral",
      format: options.format || "plain-text",
      length: options.length || "medium",
      expectedInputLanguages: Array.from(
        new Set([...(options.expectedInputLanguages || []), ...this.languagePreferences.input, "en"])
      ),
      expectedContextLanguages: Array.from(
        new Set([...(options.expectedContextLanguages || []), ...this.languagePreferences.context, "en"])
      ),
      outputLanguage: options.outputLanguage || "en",
      sharedContext: options.sharedContext,
      monitor: this.createMonitor("writer"),
    };

    const availabilityOptions = {
      tone: createOptions.tone,
      format: createOptions.format,
      length: createOptions.length,
      expectedInputLanguages: createOptions.expectedInputLanguages,
      expectedContextLanguages: createOptions.expectedContextLanguages,
      outputLanguage: createOptions.outputLanguage,
    };

    const cacheKey = this.getCacheKey("writer", availabilityOptions);

    return { createOptions, availabilityOptions, cacheKey };
  }

  normalizeRewriterOptions(options = {}) {
    const createOptions = {
      tone: options.tone || "more-formal",
      format: options.format || "plain-text",
      length: options.length || "as-is",
      expectedInputLanguages: Array.from(
        new Set([...(options.expectedInputLanguages || []), ...this.languagePreferences.input, "en"])
      ),
      expectedContextLanguages: Array.from(
        new Set([...(options.expectedContextLanguages || []), ...this.languagePreferences.context, "en"])
      ),
      outputLanguage: options.outputLanguage || "en",
      sharedContext: options.sharedContext,
      monitor: this.createMonitor("rewriter"),
    };

    const availabilityOptions = {
      tone: createOptions.tone,
      format: createOptions.format,
      length: createOptions.length,
      expectedInputLanguages: createOptions.expectedInputLanguages,
      expectedContextLanguages: createOptions.expectedContextLanguages,
      outputLanguage: createOptions.outputLanguage,
    };

    const cacheKey = this.getCacheKey("rewriter", availabilityOptions);

    return { createOptions, availabilityOptions, cacheKey };
  }

  normalizeLanguageDetectorOptions(options = {}) {
    const createOptions = {
      expectedInputLanguages: options.expectedInputLanguages || undefined,
      monitor: this.createMonitor("languageDetector"),
    };

    const availabilityOptions = {
      expectedInputLanguages: createOptions.expectedInputLanguages,
    };

    const cacheKey = this.getCacheKey("languageDetector", availabilityOptions);

    return { createOptions, availabilityOptions, cacheKey };
  }

  async ensureSummarizer(options = {}) {
    const { createOptions, availabilityOptions, cacheKey } = this.normalizeSummarizerOptions(options);

    if (this.summarizerSession && this.sessionCacheKey.summarizer === cacheKey) {
      return this.summarizerSession;
    }

    await this.destroySession("summarizer");

    const session = await createAPISession("summarizer", createOptions, availabilityOptions);
    if (session) {
      this.summarizerSession = session;
      this.sessionCacheKey.summarizer = cacheKey;
    }
    return this.summarizerSession;
  }

  async ensureLanguageModel(options = {}) {
    const { createOptions, availabilityOptions, cacheKey } = this.normalizeLanguageModelOptions(options);

    if (this.languageModelSession && this.sessionCacheKey.languageModel === cacheKey) {
      return this.languageModelSession;
    }

    await this.destroySession("languageModel");

    const session = await createAPISession("languageModel", createOptions, availabilityOptions);
    if (session) {
      this.languageModelSession = session;
      this.sessionCacheKey.languageModel = cacheKey;
    }
    return this.languageModelSession;
  }

  async ensureWriter(options = {}) {
    const { createOptions, availabilityOptions, cacheKey } = this.normalizeWriterOptions(options);

    if (this.writerSession && this.sessionCacheKey.writer === cacheKey) {
      return this.writerSession;
    }

    await this.destroySession("writer");

    const session = await createAPISession("writer", createOptions, availabilityOptions);
    if (session) {
      this.writerSession = session;
      this.sessionCacheKey.writer = cacheKey;
    }
    return this.writerSession;
  }

  async ensureRewriter(options = {}) {
    const { createOptions, availabilityOptions, cacheKey } = this.normalizeRewriterOptions(options);

    if (this.rewriterSession && this.sessionCacheKey.rewriter === cacheKey) {
      return this.rewriterSession;
    }

    await this.destroySession("rewriter");

    const session = await createAPISession("rewriter", createOptions, availabilityOptions);
    if (session) {
      this.rewriterSession = session;
      this.sessionCacheKey.rewriter = cacheKey;
    }
    return this.rewriterSession;
  }

  async ensureLanguageDetector(options = {}) {
    const { createOptions, availabilityOptions, cacheKey } = this.normalizeLanguageDetectorOptions(options);

    if (this.languageDetectorSession && this.sessionCacheKey.languageDetector === cacheKey) {
      return this.languageDetectorSession;
    }

    await this.destroySession("languageDetector");

    const session = await createAPISession("languageDetector", createOptions, availabilityOptions);
    if (session) {
      this.languageDetectorSession = session;
      this.sessionCacheKey.languageDetector = cacheKey;
    }
    return this.languageDetectorSession;
  }

  async summarizeContent(text, options = {}) {
    if (!text || typeof text !== "string") {
      return "";
    }

    try {
      const session = await this.ensureSummarizer(options);
      if (session && typeof session.summarize === "function") {
        const summarizeOptions = {
          context: `${options.context || ""}\nRespond in English only with concise, high-signal key points. Avoid repetition.`.trim(),
        };
        const summary = await session.summarize(text, summarizeOptions);
        if (summary) {
          return summary;
        }
      }
    } catch (error) {
      console.error("Summarizer API failed, falling back to simple summary", error);
    }

    return this.createSimpleSummary(text);
  }

  createSimpleSummary(text) {
    if (!text || typeof text !== "string") {
      return "";
    }

    const sentences = text
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 10);

    if (!sentences.length) {
      return text.slice(0, 240);
    }

    const summaryLength = Math.min(3, Math.ceil(sentences.length / 3));
    return sentences.slice(0, summaryLength).join(". ") + ".";
  }

  extractConceptsFallback(summary) {
    const words = summary
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const wordCount = {};
    for (const word of words) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }

    const concepts = Object.keys(wordCount)
      .sort((a, b) => wordCount[b] - wordCount[a])
      .slice(0, 5)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

    const insights = concepts.reduce((acc, concept) => {
      acc[concept] = {
        concept,
        keyFact: `Understand the core idea behind ${concept}.`,
        questionCue: `Explain why ${concept} matters in the topic.`,
      };
      return acc;
    }, {});

    return { concepts, insights };
  }

  async extractConcepts(summary, options = {}) {
    if (!summary) {
      return this.extractConceptsFallback("");
    }

    try {
      const session = await this.ensureLanguageModel(options.languageModelOptions);
      if (!session || typeof session.prompt !== "function") {
        return this.extractConceptsFallback(summary);
      }

      const promptText = `You are an expert study coach.
Analyze the summary below and return the most exam-relevant ideas in English.
Respond ONLY with JSON using this schema:
{
  "concepts": ["short English title", ...],
  "insights": [
    {
      "concept": "matching concept name",
      "keyFact": "one precise fact or definition (max 20 words)",
      "questionCue": "hint for an assessment question"
    }
  ]
}
Ensure there are between 4 and 6 concepts. Keep text concise.
Summary:
"""
${summary}
"""
JSON:`;

      const response = await session.prompt(promptText);
      const cleanResponse = sanitizeJSONResponse(response);
      if (!cleanResponse) {
        return this.extractConceptsFallback(summary);
      }

      const parsed = safeJSONParse(cleanResponse, null);
      if (!parsed || typeof parsed !== "object") {
        return this.extractConceptsFallback(summary);
      }

      const conceptList = Array.isArray(parsed.concepts)
        ? parsed.concepts
            .map((concept) => (typeof concept === "string" ? concept.trim() : ""))
            .filter(Boolean)
        : [];

      const insightsArray = Array.isArray(parsed.insights) ? parsed.insights : [];
      const insightsMap = insightsArray.reduce((acc, item) => {
        if (!item || typeof item !== "object") return acc;
        const conceptName = typeof item.concept === "string" ? item.concept.trim() : "";
        if (!conceptName) return acc;
        acc[conceptName] = {
          concept: conceptName,
          keyFact:
            typeof item.keyFact === "string"
              ? item.keyFact.trim()
              : `Key detail about ${conceptName}.`,
          questionCue:
            typeof item.questionCue === "string"
              ? item.questionCue.trim()
              : `Ask about the importance of ${conceptName}.`,
        };
        return acc;
      }, {});

      if (!conceptList.length) {
        return this.extractConceptsFallback(summary);
      }

      conceptList.forEach((concept) => {
        if (!insightsMap[concept]) {
          insightsMap[concept] = {
            concept,
            keyFact: `Understand the role of ${concept}.`,
            questionCue: `Explain why ${concept} matters in the topic.`,
          };
        }
      });

      return { concepts: conceptList, insights: insightsMap };
    } catch (error) {
      console.error("Language Model concept extraction failed", error);
      return this.extractConceptsFallback(summary);
    }
  }

  async extractTextFromImage(imageData, options = {}) {
    if (!imageData) {
      throw new Error("Image data is required");
    }

    const createOptions = {
      temperature: 0.3,
      topK: 1,
      expectedInputs: [
        {
          type: "image",
        },
      ],
      expectedOutputs: [
        {
          type: "text",
          languages: ["en"],
        },
      ],
      monitor: this.createMonitor("languageModel"),
    };

    const session = await createAPISession(
      "languageModel",
      createOptions,
      {
        temperature: createOptions.temperature,
        topK: createOptions.topK,
        expectedInputs: createOptions.expectedInputs,
        expectedOutputs: createOptions.expectedOutputs,
      }
    );

    if (!session || typeof session.prompt !== "function") {
      throw new Error("Language Model not available for image processing");
    }

    try {
      const blob = await this.dataURLtoBlob(imageData);
      const response = await session.prompt(
        options.prompt ||
          `Describe the text in this study note image.
Return only English text exactly as written.
If there are diagrams, describe them succinctly.`,
        {
          image: blob,
        }
      );
      await session.destroy?.();
      return response;
    } catch (error) {
      await session.destroy?.();
      throw error;
    }
  }

  async dataURLtoBlob(dataURL) {
    const response = await fetch(dataURL);
    return await response.blob();
  }

  async generateContent(prompt, options = {}) {
    try {
      const session = await this.ensureWriter(options.writerOptions);
      if (session && typeof session.write === "function") {
        const result = await session.write(
          `${prompt}\nRespond strictly in English.`,
          options.context ? { context: options.context } : {}
        );
        if (result) {
          return result;
        }
      }
    } catch (error) {
      console.warn("Writer API not available or failed", error);
    }
    return null;
  }

  async rewriteContent(text, options = {}) {
    try {
      const session = await this.ensureRewriter(options.rewriterOptions);
      if (session && typeof session.rewrite === "function") {
        const result = await session.rewrite(text, options.rewriterOptions);
        if (result) {
          return result;
        }
      }
    } catch (error) {
      console.warn("Rewriter API not available or failed", error);
    }
    return text;
  }

  async detectLanguage(text, options = {}) {
    if (!text || text.length < 20) {
      return null;
    }

    try {
      const session = await this.ensureLanguageDetector(options);
      if (!session || typeof session.detect !== "function") {
        return null;
      }

      const results = await session.detect(text);
      if (Array.isArray(results) && results.length) {
        return {
          language: results[0].detectedLanguage,
          confidence: results[0].confidence,
          candidates: results,
        };
      }
      return null;
    } catch (error) {
      console.warn("Language detection failed", error);
      return null;
    }
  }

  async translateText(text, targetLanguage, sourceLanguage, options = {}) {
    if (!text || !targetLanguage) {
      return null;
    }

    const source = sourceLanguage || options.sourceLanguage || undefined;
    const key = `${(source || "auto").toLowerCase()}->${targetLanguage.toLowerCase()}`;

    if (!this.translatorSessions.has(key)) {
      const createOptions = {
        sourceLanguage: source,
        targetLanguage,
        monitor: this.createMonitor("translator"),
      };

      const availabilityOptions = {
        sourceLanguage: createOptions.sourceLanguage,
        targetLanguage: createOptions.targetLanguage,
      };

      const session = await createAPISession("translator", createOptions, availabilityOptions);
      if (session) {
        this.translatorSessions.set(key, session);
      } else {
        this.translatorSessions.set(key, null);
      }
    }

    const translator = this.translatorSessions.get(key);
    if (!translator || typeof translator.translate !== "function") {
      return null;
    }

    try {
      return await translator.translate(text);
    } catch (error) {
      console.warn("Translator API failed", error);
      return null;
    }
  }

  async requestStructuredJSON(prompt, fallbackFactory, options = {}) {
    const fallbackValue = typeof fallbackFactory === "function" ? fallbackFactory() : fallbackFactory;

    try {
      const writerResult = await this.generateContent(prompt, options);
      if (writerResult) {
        const sanitizedWriter = sanitizeJSONResponse(writerResult);
        const parsedWriter = safeJSONParse(sanitizedWriter, null);
        if (parsedWriter) {
          return parsedWriter;
        }
      }
    } catch (error) {
      console.warn("Writer structured JSON fallback", error);
    }

    try {
      const session = await this.ensureLanguageModel(options.languageModelOptions);
      if (!session || typeof session.prompt !== "function") {
        return fallbackValue;
      }

      const response = await session.prompt(`${prompt}\nRespond strictly with valid JSON.`);
      const sanitized = sanitizeJSONResponse(response);
      const parsed = safeJSONParse(sanitized, fallbackValue);
      return parsed;
    } catch (error) {
      console.error("Language Model structured JSON failed", error);
      return fallbackValue;
    }
  }
}

function sanitizeJSONResponse(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  return text
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function safeJSONParse(text, fallbackValue = null) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn("safeJSONParse failed", error);
    return fallbackValue;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    StudyBuddyAPIManager,
    sanitizeJSONResponse,
    safeJSONParse,
  };
} else if (typeof self !== "undefined") {
  self.StudyBuddyAPIManager = StudyBuddyAPIManager;
  self.sanitizeJSONResponse = sanitizeJSONResponse;
  self.safeJSONParse = safeJSONParse;
}


