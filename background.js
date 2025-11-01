// background.js - StudyBuddy AI (lightweight service worker)

chrome.runtime.onInstalled.addListener(() => {
  console.log("StudyBuddy AI installed successfully!");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // All AI-related work now runs in the popup (document context)
  // to comply with the latest built-in AI API requirements.
  sendResponse({
    success: false,
    error:
      "StudyBuddy's background worker no longer handles AI requests. " +
      "Trigger actions from the popup to activate built-in models.",
  });
  return true;
});
// background.js - StudyBuddy AI

// Importar módulos de estudio
importScripts("study-modules/note-processor.js");
importScripts("study-modules/quiz-generator.js");

// ===================================================================
// GLOBAL HELPERS & CONSTANTS
// ===================================================================

const AI_API_CANDIDATES = {
  summarizer: ["Summarizer", "summarizer"],
  languageModel: ["LanguageModel", "languageModel", "Prompt", "prompt"],
  writer: ["Writer", "writer"],
  rewriter: ["Rewriter", "rewriter"],
  languageDetector: ["LanguageDetector", "languageDetector"],
  translator: ["Translator", "translator"],
};

const MAX_STORED_NOTES = 50;
const MAX_STUDY_PACK_HISTORY = 15;

function logDownloadProgress(apiName, event) {
  if (!event) return;
  const percent = typeof event.loaded === "number" && event.loaded <= 1
    ? event.loaded * 100
    : typeof event.loaded === "number" && typeof event.total === "number" && event.total > 0
      ? (event.loaded / event.total) * 100
      : NaN;
  if (!Number.isNaN(percent)) {
    console.log(`[${apiName}] model download ${percent.toFixed(1)}%`);
  }
}

function withDownloadMonitor(apiName, options = {}) {
  if (!options || typeof options !== "object") {
    return options;
  }

  if (typeof options.monitor === "function") {
    return options;
  }

  return {
    ...options,
    monitor(controller) {
      try {
        controller?.addEventListener?.("downloadprogress", (event) =>
          logDownloadProgress(apiName, event)
        );
      } catch (error) {
        console.warn(`[${apiName}] monitor registration failed`, error);
      }
    },
  };
}

function normalizeLanguageCode(code) {
  if (!code || typeof code !== "string") return null;
  return code.trim().toLowerCase();
}

function guessLanguageFromText(text) {
  if (!text || typeof text !== "string") {
    return "unknown";
  }
  const trimmed = text.trim();
  if (trimmed.length < 16) {
    return "unknown";
  }
  if (/[áéíóúñü¿¡]/i.test(trimmed)) return "es";
  if (/[àèìòùâêîôûç]/i.test(trimmed)) return "fr";
  if (/[äöüß]/i.test(trimmed)) return "de";
  if (/[а-яё]/i.test(trimmed)) return "ru";
  if (/[日本語]/.test(trimmed)) return "ja";
  if (/[韩한국]/.test(trimmed)) return "ko";
  if (/[中文汉字]/.test(trimmed)) return "zh";
  return "unknown";
}

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

function sanitizeJSONResponse(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/```$/, "")
    .replace(/```json/gi, "")
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

// StudyBuddy AI components
let noteProcessor = null;
let quizGenerator = null;

// ===================================================================
// CHROME BUILT-IN AI API UTILITIES (2025)
// ===================================================================

// Check API availability
async function checkAPIAvailability(apiName, availabilityOptions) {
  try {
    const apiEntry = resolveChromeAIEntry(apiName);
    if (!apiEntry) {
      console.log(`${apiName} API not available on global scope`);
      return null;
    }

    const availabilityFn = apiEntry.availability || apiEntry.Availability;
    if (typeof availabilityFn !== "function") {
      console.log(`${apiName} availability() not found`);
      return null;
    }

    const availability =
      availabilityOptions !== undefined
        ? await availabilityFn.call(apiEntry, availabilityOptions)
        : await availabilityFn.call(apiEntry);

    const availabilityStateRaw =
      typeof availability === "string"
        ? availability
        : availability?.state || availability?.availability || availability?.status || null;

    const availabilityState =
      typeof availabilityStateRaw === "string"
        ? availabilityStateRaw.toLowerCase()
        : null;

    console.log(`${apiName} availability:`, availabilityState || availability);

    const allowedStates = new Set([
      "readily",
      "after-download",
      "available",
      "downloadable",
      "downloading",
      "ready",
    ]);

    return availabilityState && allowedStates.has(availabilityState)
      ? { state: availabilityState, detail: availability }
      : null;
  } catch (e) {
    console.error(`Error checking ${apiName} availability:`, e);
    return null;
  }
}

// Create API session
async function createAPISession(apiName, options = {}, availabilityOptions) {
  try {
    const availability = await checkAPIAvailability(apiName, availabilityOptions);
    if (!availability) return null;

    const apiEntry = resolveChromeAIEntry(apiName);
    if (!apiEntry || typeof apiEntry.create !== "function") {
      console.log(`${apiName} create() not available`);
      return null;
    }

    const session = await apiEntry.create(withDownloadMonitor(apiName, options));
    console.log(`${apiName} session created`, availability.state ? `(${availability.state})` : "");
    return session;
  } catch (e) {
    console.error(`${apiName} session creation failed:`, e);
    return null;
  }
}

// ===================================================================
// STUDYBUDDY AI API MANAGER
// ===================================================================
class StudyBuddyAPIManager {
  constructor() {
    this.summarizerSession = null;
    this.languageModelSession = null;
    this.writerSession = null;
    this.rewriterSession = null;
    this.languageDetectorSession = null;
    this.translatorSessions = new Map();
  }

  async initialize() {
    try {
      console.log("Initializing StudyBuddy API Manager (Chrome Built-in AI 2025)...");

      // Initialize Language Model (Prompt API)
      this.languageModelSession = await createAPISession("languageModel", {
        temperature: 0.8,
        topK: 3,
      });

      // Initialize Summarizer
      this.summarizerSession = await createAPISession("summarizer", {
        type: "key-points",
        format: "markdown",
        length: "medium",
      });

      // Initialize Writer
      this.writerSession = await createAPISession("writer", {
        tone: "neutral",
        format: "plain-text",
        length: "medium",
      });

      // Initialize Rewriter
      this.rewriterSession = await createAPISession("rewriter", {
        tone: "more-formal",
        format: "plain-text",
        length: "as-is",
      });

      console.log("StudyBuddy APIs initialized:", {
        languageModel: !!this.languageModelSession,
        summarizer: !!this.summarizerSession,
        writer: !!this.writerSession,
        rewriter: !!this.rewriterSession,
      });

      return true;
    } catch (error) {
      console.error("Error initializing StudyBuddy APIs:", error);
      return false;
    }
  }

  // Resumir contenido usando Summarizer API
  async summarizeContent(text) {
    try {
      if (this.summarizerSession) {
        const result = await this.summarizerSession.summarize(text);
        return result;
      }
      // Fallback: resumen simple
      return this.createSimpleSummary(text);
    } catch (error) {
      console.error("Error summarizing content:", error);
      return this.createSimpleSummary(text);
    }
  }

  // Extraer conceptos usando Prompt API (Language Model)
  async extractConcepts(summary) {
    try {
      console.log("Extracting concepts from summary:", summary);
      if (this.languageModelSession) {
        const promptText = `Extract the main concepts and key points from this summary.
Return them as a JSON array of strings, with each concept being a short phrase (2-5 words).

Summary: "${summary}"

Return ONLY the JSON array, nothing else. Format: ["concept1", "concept2", "concept3"]`;

        const response = await this.languageModelSession.prompt(promptText);
        console.log("Language Model response for concepts:", response);
        try {
          // Limpiar la respuesta
          const cleanResponse = response.trim().replace(/```json\n?|\n?```/g, "");
          const concepts = JSON.parse(cleanResponse);
          console.log("Parsed concepts:", concepts);
          return Array.isArray(concepts)
            ? concepts
            : this.extractConceptsFallback(summary);
        } catch (parseError) {
          console.warn("Failed to parse concepts JSON, using fallback");
          return this.extractConceptsFallback(summary);
        }
      }
      console.warn("Language Model not available, using fallback for concepts");
      return this.extractConceptsFallback(summary);
    } catch (error) {
      console.error("Error extracting concepts:", error);
      return this.extractConceptsFallback(summary);
    }
  }

  // Extraer texto de imagen usando Prompt API multimodal
  async extractTextFromImage(imageData) {
    try {
      // Crear sesión multimodal específica para imágenes
      const multimodalSession = await createAPISession("languageModel", {
        temperature: 0.3,
        topK: 1,
      });

      if (multimodalSession) {
        // Convertir data URL a Blob si es necesario
        const imageBlob = await this.dataURLtoBlob(imageData);

        const promptText = `Extract all text from this image of study notes.
Return the text exactly as written, maintaining the structure and organization.
If there are diagrams or non-text elements, describe them briefly.`;

        const response = await multimodalSession.prompt(promptText, {
          image: imageBlob,
        });

        await multimodalSession.destroy();
        return response;
      }
      throw new Error("Language Model not available for image processing");
    } catch (error) {
      console.error("Error extracting text from image:", error);
      throw error;
    }
  }

  // Convertir dataURL a Blob
  async dataURLtoBlob(dataURL) {
    try {
      const response = await fetch(dataURL);
      return await response.blob();
    } catch (error) {
      console.error("Error converting data URL to Blob:", error);
      throw error;
    }
  }

  // Generar contenido usando Writer API
  async generateContent(prompt) {
    console.log("generateContent called, writer available:", !!this.writerSession);
    try {
      if (this.writerSession) {
        try {
          console.log("Attempting to use Writer API...");
          const result = await this.writerSession.write(prompt);
          console.log("Writer API success:", !!result);
          return result;
        } catch (apiError) {
          console.warn(
            "Writer API execution failed, using fallback:",
            apiError.message
          );
          return null;
        }
      }
      console.log("No writer available, using fallback");
      return null;
    } catch (error) {
      console.error("Error generating content:", error);
      return null;
    }
  }

  async promptLanguageModel(prompt, { attachments = null, sessionOptions = null } = {}) {
    try {
      if (!this.languageModelSession) {
        this.languageModelSession = await createAPISession(
          "languageModel",
          sessionOptions || {
            temperature: 0.7,
            topK: 3,
          }
        );
      }

      if (this.languageModelSession?.prompt) {
        return await this.languageModelSession.prompt(prompt, attachments);
      }

      return null;
    } catch (error) {
      console.error("Error prompting language model:", error);
      return null;
    }
  }

  async requestStructuredJSON(prompt, fallbackFactory) {
    try {
      const writerResponse = await this.generateContent(prompt);
      const lmResponse = writerResponse
        ? null
        : await this.promptLanguageModel(prompt);

      const responseText = writerResponse || lmResponse;
      if (!responseText) {
        return typeof fallbackFactory === "function" ? fallbackFactory() : fallbackFactory;
      }

      const sanitized = sanitizeJSONResponse(responseText);
      const parsed = safeJSONParse(
        sanitized,
        typeof fallbackFactory === "function" ? fallbackFactory() : fallbackFactory
      );

      return parsed;
    } catch (error) {
      console.error("Error requesting structured JSON:", error);
      return typeof fallbackFactory === "function" ? fallbackFactory() : fallbackFactory;
    }
  }

  // Reescribir contenido usando Rewriter API
  async rewriteContent(text, options = {}) {
    try {
      if (this.rewriterSession) {
        const result = await this.rewriterSession.rewrite(text, options);
        return result;
      }
      return text; // Fallback: devolver texto original
    } catch (error) {
      console.error("Error rewriting content:", error);
      return text;
    }
  }

  // Fallback: crear resumen simple
  createSimpleSummary(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const summaryLength = Math.min(3, Math.ceil(sentences.length / 3));
    return sentences.slice(0, summaryLength).join(". ") + ".";
  }

  // Fallback: extraer conceptos simples
  extractConceptsFallback(summary) {
    const words = summary
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const wordCount = {};
    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.keys(wordCount)
      .sort((a, b) => wordCount[b] - wordCount[a])
      .slice(0, 5)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  }
}

// Inicializar API Manager
const apiManager = new StudyBuddyAPIManager();

// ===================================================================
// MESSAGE LISTENERS
// ===================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ===================================================================
  // STUDYBUDDY AI MESSAGE HANDLERS
  // ===================================================================
  if (request && request.action === "processNotes") {
    handleProcessNotes(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "generateQuiz") {
    handleGenerateQuiz(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "generateQuizLocal") {
    handleGenerateQuizLocal(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "getStudyData") {
    handleGetStudyData(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "submitQuizAnswer") {
    handleSubmitQuizAnswer(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "deleteNote") {
    handleDeleteNote(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "saveQuizToHistory") {
    handleSaveQuizToHistory(request, sendResponse);
    return true; // keep the message channel open for async response
  } else if (request && request.action === "generateStudyPack") {
    handleGenerateStudyPack(request, sender, sendResponse);
    return true;
  }
});

// ===================================================================
// STUDYBUDDY AI HANDLERS
// ===================================================================

// Inicializar componentes de StudyBuddy AI
async function initializeStudyBuddyComponents() {
  try {
    await apiManager.initialize();

    noteProcessor = new NoteProcessor();
    await noteProcessor.initialize(apiManager);

    quizGenerator = new QuizGenerator();
    await quizGenerator.initialize(apiManager);

    console.log("StudyBuddy AI components initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing StudyBuddy components:", error);
    return false;
  }
}

async function processNoteData({ textContent, imageData, type = "text", metadata = {} }) {
  if (!noteProcessor) {
    await initializeStudyBuddyComponents();
  }

  let processedNotes;

  if (type === "image" && imageData) {
    processedNotes = await noteProcessor.processImageNotes(imageData);
  } else if (textContent) {
    processedNotes = await noteProcessor.processTextNotes(textContent);
  } else {
    throw new Error("No valid content was provided for processing");
  }

  if (metadata && typeof metadata === "object" && Object.keys(metadata).length) {
    processedNotes.metadata = {
      ...(processedNotes.metadata || {}),
      ...metadata,
    };

    if (metadata.source) {
      processedNotes.source = metadata.source;
    }
  }

  const allNotes = (await getStudyData("allNotes")) || [];
  allNotes.unshift(processedNotes);

  if (allNotes.length > MAX_STORED_NOTES) {
    allNotes.length = MAX_STORED_NOTES;
  }

  await saveStudyData("allNotes", allNotes);
  await saveStudyData("processedNotes", processedNotes);

  return processedNotes;
}

// Manejar procesamiento de notas
async function handleProcessNotes(request, sendResponse) {
  try {
    console.log("handleProcessNotes called with:", request);

    const { textContent, imageData, type } = request;
    console.log("Extracted data:", {
      textContent: textContent?.length,
      imageData: !!imageData,
      type,
    });

    const processedNotes = await processNoteData({
      textContent,
      imageData,
      type,
    });

    sendResponse({
      success: true,
      data: processedNotes,
    });
  } catch (error) {
    console.error("Error processing notes:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Manejar generación de quiz
async function handleGenerateQuiz(request, sendResponse) {
  try {
    if (!quizGenerator) {
      await initializeStudyBuddyComponents();
    }

    const { processedNotes, options = {} } = request;

    if (!processedNotes) {
      throw new Error("Processed notes payload is missing");
    }

    const quiz = await quizGenerator.generateQuiz(processedNotes, options);

    // Guardar en storage local
    await saveStudyData("generatedQuiz", quiz);

    sendResponse({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Manejar generación de quiz local (sin APIs)
async function handleGenerateQuizLocal(request, sendResponse) {
  try {
    if (!quizGenerator) {
      await initializeStudyBuddyComponents();
    }

    const { processedNotes, options = {} } = request;

    if (!processedNotes) {
      throw new Error("Processed notes payload is missing");
    }

    // Forzar generación local
    const quiz = await quizGenerator.generateQuizLocal(processedNotes, options);

    // Guardar en storage local
    await saveStudyData("generatedQuiz", quiz);

    sendResponse({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("Error generating local quiz:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Manejar obtención de datos de estudio
async function handleGetStudyData(request, sendResponse) {
  try {
    const { dataType, noteId } = request;

    let data;
    switch (dataType) {
      case "processedNotes":
        data = await getStudyData("processedNotes");
        break;
      case "allNotes":
        data = (await getStudyData("allNotes")) || [];
        break;
      case "note":
        // Obtener una nota específica por ID
        const allNotes = (await getStudyData("allNotes")) || [];
        data = allNotes.find((note) => note.id === noteId);
        break;
      case "quizHistory":
        data = (await getStudyData("quizHistory")) || [];
        break;
      case "generatedQuiz":
        data = await getStudyData("generatedQuiz");
        break;
    case "lastStudyPack":
      data = await getStudyData("lastStudyPack");
      break;
    case "studyPackHistory":
      data = (await getStudyData("studyPackHistory")) || [];
      break;
      case "studyProgress":
        data = await getStudyData("studyProgress");
        break;
      case "stats":
        data = {
          noteProcessor: noteProcessor ? noteProcessor.getStats() : null,
          quizGenerator: quizGenerator ? quizGenerator.getStats() : null,
        };
        break;
      default:
        data = await getAllStudyData();
    }

    sendResponse({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error getting study data:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Manejar envío de respuesta de quiz
async function handleSubmitQuizAnswer(request, sendResponse) {
  try {
    const { quizId, questionId, answer, timeSpent } = request;

    // Obtener quiz actual
    const quiz = quizGenerator ? quizGenerator.getQuiz(quizId) : null;
    if (!quiz) {
      throw new Error("Quiz could not be found");
    }

    // Encontrar la pregunta
    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error("Question could not be found");
    }

    // Evaluar respuesta
    const isCorrect = evaluateAnswer(question, answer);

    // Actualizar progreso
    const progress = await updateQuizProgress(
      quizId,
      questionId,
      isCorrect,
      timeSpent
    );

    sendResponse({
      success: true,
      data: {
        isCorrect,
        correctAnswer: question.correctAnswer || question.answerKey,
        explanation: question.explanation,
        progress,
      },
    });
  } catch (error) {
    console.error("Error submitting quiz answer:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Evaluar respuesta del usuario
function evaluateAnswer(question, userAnswer) {
  switch (question.type) {
    case "multiple_choice":
      return userAnswer === question.correctAnswer;
    case "true_false":
      return userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
    case "short_answer":
      // Para respuestas cortas, hacer una comparación básica
      const userWords = userAnswer.toLowerCase().split(/\s+/);
      const keyWords = question.answerKey.toLowerCase().split(/\s+/);
      const commonWords = userWords.filter((word) => keyWords.includes(word));
      return commonWords.length >= Math.min(2, keyWords.length * 0.3);
    default:
      return false;
  }
}

// Actualizar progreso del quiz
async function updateQuizProgress(quizId, questionId, isCorrect, timeSpent) {
  try {
    const progress = (await getStudyData("studyProgress")) || {};
    const quizProgress = progress[quizId] || {
      quizId,
      totalQuestions: 0,
      correctAnswers: 0,
      totalTimeSpent: 0,
      questionsAnswered: 0,
      startedAt: Date.now(),
    };

    quizProgress.questionsAnswered++;
    quizProgress.totalTimeSpent += timeSpent || 0;
    if (isCorrect) {
      quizProgress.correctAnswers++;
    }

    progress[quizId] = quizProgress;
    await saveStudyData("studyProgress", progress);

    return quizProgress;
  } catch (error) {
    console.error("Error updating quiz progress:", error);
    return null;
  }
}

// Manejar eliminación de nota
async function handleDeleteNote(request, sendResponse) {
  try {
    const { noteId } = request;

    if (!noteId) {
      throw new Error("A noteId is required");
    }

    // Obtener todas las notas
    const allNotes = (await getStudyData("allNotes")) || [];

    // Filtrar la nota a eliminar
    const filteredNotes = allNotes.filter((note) => note.id !== noteId);

    // Guardar las notas actualizadas
    await saveStudyData("allNotes", filteredNotes);

    sendResponse({
      success: true,
      data: { deletedNoteId: noteId },
    });
  } catch (error) {
    console.error("Error deleting note:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Manejar guardar quiz en historial
async function handleSaveQuizToHistory(request, sendResponse) {
  try {
    const { quizData } = request;

    if (!quizData) {
      throw new Error("quizData is required");
    }

    // Obtener historial existente
    const quizHistory = (await getStudyData("quizHistory")) || [];

    // Agregar el nuevo quiz al historial
    quizHistory.push({
      id: quizData.id,
      score: quizData.score,
      correctAnswers: quizData.correctAnswers,
      totalQuestions: quizData.totalQuestions,
      completedAt: quizData.completedAt,
      timeSpent: quizData.timeSpent || 0,
    });

    // Guardar historial actualizado
    await saveStudyData("quizHistory", quizHistory);

    sendResponse({
      success: true,
      data: { saved: true },
    });
  } catch (error) {
    console.error("Error saving quiz to history:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

// Manejar generación automática de Study Pack desde la página actual
async function handleGenerateStudyPack(request, sender, sendResponse) {
  try {
    if (!noteProcessor || !quizGenerator) {
      await initializeStudyBuddyComponents();
    }

    const { context: providedContext = null, options = {} } = request || {};
    const shouldRefreshContext = options.refreshContext ?? !providedContext;

    let pageContext = providedContext;

    if (!pageContext || shouldRefreshContext) {
      pageContext = await captureActiveTabContext(options);
    }

    if (!pageContext || !pageContext.textContent || pageContext.textContent.trim().length < 50) {
      throw new Error("Unable to capture enough readable content on this page");
    }

    const processedNotes = await processNoteData({
      textContent: pageContext.textContent,
      type: "text",
      metadata: {
        source: {
          type: "web-page",
          title: pageContext.title,
          url: pageContext.url,
          capturedAt: Date.now(),
          selectionPreview: pageContext.selectionPreview,
        },
        context: pageContext,
      },
    });

    const studyPack = await buildStudyPack(processedNotes, pageContext, options);

    await persistStudyPack(studyPack);

    sendResponse({
      success: true,
      data: studyPack,
    });
  } catch (error) {
    console.error("Error generating study pack:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

async function captureActiveTabContext() {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab || !activeTab.id) {
      throw new Error("Active tab could not be located");
    }

    if (!activeTab.url || /^(chrome|edge|about|file|chrome-extension):/i.test(activeTab.url)) {
      throw new Error("This page cannot be analysed by the extension");
    }

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id, allFrames: false },
      world: "MAIN",
      func: () => {
        const clamp = (text, limit) => {
          if (!text) return "";
          return text.length > limit ? text.slice(0, limit) : text;
        };

        try {
          const selection = window.getSelection()?.toString() || "";
          const cleanedSelection = selection.replace(/\s+/g, " ").trim();

          const candidate =
            document.querySelector("article") ||
            document.querySelector("main") ||
            document.querySelector("[role='main']") ||
            document.body;

          const rawText = (candidate?.innerText || "").replace(/\s+/g, " ").trim();

          const chosenText =
            cleanedSelection && cleanedSelection.length >= 120
              ? cleanedSelection
              : rawText;

          const truncated = clamp(chosenText, 20000);

          const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
            .map((heading) => heading.innerText.replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .slice(0, 8);

          const metaDescription = document
            .querySelector("meta[name='description']")
            ?.getAttribute("content");

          const language =
            document.documentElement.lang || navigator.language || "en";

          const wordCount = truncated ? truncated.split(/\s+/).filter(Boolean).length : 0;

          return {
            title: document.title || "Untitled Page",
            url: location.href,
            textContent: truncated,
            selectionText: clamp(cleanedSelection, 1200),
            selectionPreview: clamp(cleanedSelection, 280),
            headings,
            metaDescription: clamp(metaDescription, 500),
            language,
            wordCount,
          };
        } catch (innerError) {
          return { error: innerError?.message || "Unknown capture error" };
        }
      },
    });

    if (!injectionResult) {
      throw new Error("No content could be retrieved from the active tab");
    }

    const result = injectionResult.result;

    if (!result || result.error) {
      throw new Error(result?.error || "No analysable content detected on this page");
    }

    return {
      ...result,
      tabId: activeTab.id,
    };
  } catch (error) {
    console.error("captureActiveTabContext error:", error);
    throw error;
  }
}

async function buildStudyPack(processedNotes, pageContext, options = {}) {
  const basePack = {
    id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: Date.now(),
    noteId: processedNotes.id,
    summary: processedNotes.summary,
    concepts: processedNotes.concepts,
    metrics: {
      extractedWordCount: pageContext.wordCount || 0,
      estimatedReadingTimeMinutes: Math.max(
        1,
        Math.round((pageContext.wordCount || 0) / 200)
      ),
    },
    source: {
      title: pageContext.title,
      url: pageContext.url,
      language: pageContext.language,
      headings: pageContext.headings,
      metaDescription: pageContext.metaDescription,
      selectionPreview: pageContext.selectionPreview,
      capturedAt: Date.now(),
    },
  };

  const artifacts = await generateStudyPackArtifacts(processedNotes, pageContext, options);
  basePack.artifacts = artifacts;

  let microQuiz = null;

  if (quizGenerator) {
    const quizOptions = {
      questionCount: options.questionCount || 3,
      difficulty: options.difficulty || "medium",
      questionTypes:
        options.questionTypes || ["multipleChoice", "trueFalse", "shortAnswer"],
    };

    try {
      microQuiz = await quizGenerator.generateQuiz(processedNotes, quizOptions);
    } catch (quizError) {
      console.warn("Falling back to local quiz for study pack", quizError);
      try {
        microQuiz = await quizGenerator.generateQuizLocal(processedNotes, quizOptions);
      } catch (localError) {
        console.error("Failed to generate local micro quiz", localError);
      }
    }
  }

  if (microQuiz) {
    basePack.microQuiz = {
      id: microQuiz.id,
      title: microQuiz.title,
      difficulty: microQuiz.difficulty,
      createdAt: microQuiz.createdAt,
      questions: microQuiz.questions.slice(0, 3),
    };
  }

  return basePack;
}

async function generateStudyPackArtifacts(processedNotes, pageContext, options = {}) {
  const fallbackArtifacts = () => createFallbackStudyArtifacts(processedNotes, pageContext);

  const promptPayload = {
    summary: processedNotes.summary,
    concepts: processedNotes.concepts,
    pageTitle: pageContext.title,
    headings: pageContext.headings,
    metaDescription: pageContext.metaDescription,
    language: pageContext.language,
  };

  const prompt = `You are StudyBuddy, an academic coach creating concise learning aids.
Respond strictly with valid JSON matching this schema:
{
  "headline": string,
  "takeaways": [{ "title": string, "detail": string, "whyItMatters": string }],
  "studyQuestions": [string],
  "flashcards": [{ "front": string, "back": string }],
  "actionSteps": [string],
  "recommendedBreakdown": { "warmUp": string, "deepDive": string, "review": string }
}
All strings must be in English. Keep responses concise but specific.
Use the following context JSON:
${JSON.stringify(promptPayload)}
`;

  const artifacts = await apiManager.requestStructuredJSON(prompt, fallbackArtifacts);
  return normalizeStudyPackArtifacts(artifacts, fallbackArtifacts());
}

function normalizeStudyPackArtifacts(artifacts, fallbackArtifacts) {
  if (!artifacts || typeof artifacts !== "object") {
    return fallbackArtifacts;
  }

  const normalized = { ...fallbackArtifacts, ...artifacts };

  normalized.headline =
    typeof normalized.headline === "string"
      ? normalized.headline
      : fallbackArtifacts.headline;

  normalized.takeaways = Array.isArray(normalized.takeaways)
    ? normalized.takeaways
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          title: item.title || item.topic || "Key Insight",
          detail: item.detail || item.summary || "Review this concept carefully.",
          whyItMatters:
            item.whyItMatters ||
            item.value ||
            "Clarifies why this point is important for the topic.",
        }))
        .slice(0, 5)
    : fallbackArtifacts.takeaways;

  normalized.studyQuestions = Array.isArray(normalized.studyQuestions)
    ? normalized.studyQuestions
        .filter((q) => typeof q === "string" && q.trim().length > 0)
        .slice(0, 6)
    : fallbackArtifacts.studyQuestions;

  normalized.flashcards = Array.isArray(normalized.flashcards)
    ? normalized.flashcards
        .filter((card) => card && typeof card === "object")
        .map((card) => ({
          front: card.front || card.term || "Explain this concept",
          back: card.back || card.definition || "Describe the main idea in your own words.",
        }))
        .slice(0, 6)
    : fallbackArtifacts.flashcards;

  normalized.actionSteps = Array.isArray(normalized.actionSteps)
    ? normalized.actionSteps
        .filter((step) => typeof step === "string" && step.trim().length > 0)
        .slice(0, 5)
    : fallbackArtifacts.actionSteps;

  normalized.recommendedBreakdown =
    normalized.recommendedBreakdown && typeof normalized.recommendedBreakdown === "object"
      ? {
          warmUp:
            normalized.recommendedBreakdown.warmUp ||
            fallbackArtifacts.recommendedBreakdown.warmUp,
          deepDive:
            normalized.recommendedBreakdown.deepDive ||
            fallbackArtifacts.recommendedBreakdown.deepDive,
          review:
            normalized.recommendedBreakdown.review ||
            fallbackArtifacts.recommendedBreakdown.review,
        }
      : fallbackArtifacts.recommendedBreakdown;

  return normalized;
}

function createFallbackStudyArtifacts(processedNotes, pageContext) {
  const concepts = Array.isArray(processedNotes?.concepts)
    ? processedNotes.concepts.slice(0, 5)
    : [];

  const summaryLines = (processedNotes?.summary || "")
    .split(/\n|\.\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const fallbackTakeaways = concepts.length
    ? concepts.map((concept) => ({
        title: concept,
        detail: `Understand how ${concept} fits into the topic.`,
        whyItMatters: `Helps you explain ${concept} in your own words.`,
      }))
    : summaryLines.slice(0, 3).map((line, index) => ({
        title: `Key Idea ${index + 1}`,
        detail: line,
        whyItMatters: "Supports core understanding of the article.",
      }));

  const fallbackFlashcards = (concepts.length ? concepts : summaryLines.slice(0, 3)).map(
    (item, index) => ({
      front: typeof item === "string" ? item : `Concept ${index + 1}`,
      back:
        typeof item === "string"
          ? `Explain ${item} in your own words and describe a real example.`
          : item,
    })
  );

  return {
    headline: `Study Pack for ${pageContext?.title || "your page"}`,
    takeaways: fallbackTakeaways,
    studyQuestions: fallbackTakeaways.slice(0, 4).map((item) => `Why is ${item.title} important in this context?`),
    flashcards: fallbackFlashcards.slice(0, 4),
    actionSteps: [
      "Skim the takeaways and highlight unfamiliar terms.",
      "Answer the study questions out loud or in writing.",
      "Use the flashcards after a short break to test recall.",
    ],
    recommendedBreakdown: {
      warmUp: "Review the summary and top headings for 3 minutes.",
      deepDive: "Connect each takeaway with examples from the original page for 10 minutes.",
      review: "Quiz yourself with flashcards and questions, then summarize in 2-3 sentences.",
    },
  };
}

async function persistStudyPack(studyPack) {
  try {
    await saveStudyData("lastStudyPack", studyPack);

    const history = (await getStudyData("studyPackHistory")) || [];
    history.unshift(studyPack);

    if (history.length > MAX_STUDY_PACK_HISTORY) {
      history.length = MAX_STUDY_PACK_HISTORY;
    }

    await saveStudyData("studyPackHistory", history);
  } catch (error) {
    console.error("Error persisting study pack:", error);
  }
}

// Guardar datos de estudio en storage
async function saveStudyData(key, data) {
  try {
    await chrome.storage.local.set({ [key]: data });
  } catch (error) {
    console.error("Error saving study data:", error);
  }
}

// Obtener datos de estudio del storage
async function getStudyData(key) {
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key];
  } catch (error) {
    console.error("Error getting study data:", error);
    return null;
  }
}

// Obtener todos los datos de estudio
async function getAllStudyData() {
  try {
    const keys = [
      "processedNotes",
      "allNotes",
      "generatedQuiz",
      "studyProgress",
      "quizHistory",
      "lastStudyPack",
      "studyPackHistory",
    ];
    const result = await chrome.storage.local.get(keys);
    return result;
  } catch (error) {
    console.error("Error getting all study data:", error);
    return {};
  }
}

// Initialize StudyBuddy AI on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("StudyBuddy AI installed successfully!");
});
