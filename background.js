// background.js - StudyBuddy AI

// Importar módulos de estudio
importScripts("study-modules/note-processor.js");
importScripts("study-modules/quiz-generator.js");

// In-memory store mapping tabId -> array of questions (latest analysis)
const pageAnalysisResults = {};

// StudyBuddy AI components
let noteProcessor = null;
let quizGenerator = null;
let studySessionManager = null;

// Utility: create an AI API instance if available (2025 self.* entry points)
async function createIfAvailable(Cls) {
  try {
    if (Cls && typeof Cls.availability === "function") {
      const availability = await Cls.availability();
      if (
        availability &&
        availability.status === "available" &&
        typeof Cls.create === "function"
      ) {
        return await Cls.create();
      }
    }
  } catch (e) {
    // Ignore and fallback to heuristics
  }
  return null;
}

// ===================================================================
// STUDYBUDDY AI API MANAGER
// ===================================================================
class StudyBuddyAPIManager {
  constructor() {
    this.summarizer = null;
    this.prompt = null;
    this.writer = null;
    this.rewriter = null;
    this.translator = null;
    this.proofreader = null;
  }

  async initialize() {
    try {
      console.log("Initializing StudyBuddy API Manager...");

      // Inicializar todas las APIs disponibles
      this.summarizer = await createIfAvailable(
        typeof self !== "undefined" ? self.Summarizer : undefined
      );
      this.prompt = await createIfAvailable(
        typeof self !== "undefined" ? self.Prompt : undefined
      );
      this.writer = await createIfAvailable(
        typeof self !== "undefined" ? self.Writer : undefined
      );
      this.rewriter = await createIfAvailable(
        typeof self !== "undefined" ? self.Rewriter : undefined
      );
      this.translator = await createIfAvailable(
        typeof self !== "undefined" ? self.Translator : undefined
      );
      this.proofreader = await createIfAvailable(
        typeof self !== "undefined" ? self.Proofreader : undefined
      );

      console.log("StudyBuddy APIs initialized:", {
        summarizer: !!this.summarizer,
        prompt: !!this.prompt,
        writer: !!this.writer,
        rewriter: !!this.rewriter,
        translator: !!this.translator,
        proofreader: !!this.proofreader,
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
      if (this.summarizer) {
        const result = await this.summarizer.execute({
          input: text,
          options: { length: "medium" },
        });
        return result;
      }
      // Fallback: resumen simple
      return this.createSimpleSummary(text);
    } catch (error) {
      console.error("Error summarizing content:", error);
      return this.createSimpleSummary(text);
    }
  }

  // Extraer conceptos usando Prompt API
  async extractConcepts(summary) {
    try {
      console.log("Extracting concepts from summary:", summary);
      if (this.prompt) {
        const prompt = `
          Extract the main concepts and key points from this summary. 
          Return them as a JSON array of strings, with each concept being a short phrase (2-5 words).
          
          Summary: "${summary}"
          
          Return format: ["concept1", "concept2", "concept3", ...]
        `;

        const response = await this.prompt.execute({ input: prompt });
        console.log("Prompt API response for concepts:", response);
        try {
          const concepts = JSON.parse(response);
          console.log("Parsed concepts:", concepts);
          return Array.isArray(concepts)
            ? concepts
            : this.extractConceptsFallback(summary);
        } catch (parseError) {
          console.warn("Failed to parse concepts JSON, using fallback");
          return this.extractConceptsFallback(summary);
        }
      }
      console.warn("Prompt API not available, using fallback for concepts");
      return this.extractConceptsFallback(summary);
    } catch (error) {
      console.error("Error extracting concepts:", error);
      return this.extractConceptsFallback(summary);
    }
  }

  // Extraer texto de imagen usando Prompt API multimodal
  async extractTextFromImage(imageData) {
    try {
      if (this.prompt) {
        const prompt = `
          Extract all text from this image of study notes. 
          Return the text exactly as written, maintaining the structure and organization.
          If there are diagrams or non-text elements, describe them briefly.
        `;

        const response = await this.prompt.execute({
          input: prompt,
          multimodal: true,
          image: imageData,
        });
        return response;
      }
      throw new Error("Prompt API not available for image processing");
    } catch (error) {
      console.error("Error extracting text from image:", error);
      throw error;
    }
  }

  // Generar contenido usando Writer API
  async generateContent(prompt) {
    console.log("generateContent called, writer available:", !!this.writer);
    try {
      if (this.writer) {
        try {
          console.log("Attempting to use Writer API...");
          const result = await this.writer.execute({ input: prompt });
          console.log("Writer API success:", !!result);
          return result;
        } catch (apiError) {
          console.warn(
            "Writer API execution failed, using fallback:",
            apiError.message
          );
          return null; // Devolver null en lugar de lanzar error
        }
      }
      console.log("No writer available, using fallback");
      return null; // Devolver null si no hay writer disponible
    } catch (error) {
      console.error("Error generating content:", error);
      return null; // Devolver null en caso de error
    }
  }

  // Reescribir contenido usando Rewriter API
  async rewriteContent(text, options = {}) {
    try {
      if (this.rewriter) {
        const result = await this.rewriter.execute({
          input: text,
          options: options,
        });
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
// FEATURE 1: PROACTIVE PAGE ANALYZER
// ===================================================================
async function analyzePageContent(pageText, tabId) {
  try {
    const truncated = (pageText || "").trim().slice(0, 60000);
    let result;

    try {
      // Summarize content to reduce token load
      const summarizer = await createIfAvailable(
        typeof self !== "undefined" ? self.Summarizer : undefined
      );
      if (summarizer) {
        const summary = await summarizer.execute({
          input: truncated,
          options: { length: "short" },
        });

        const promptText = `
          Based on the following summary of a webpage, identify potential red flags for a young user.
          Red flags include: strong emotional language (fear, anger), urgent calls to action, claims without evidence, or a heavily biased perspective.
          Then, generate exactly 3 short, simple critical thinking questions to help the user evaluate the content.
          Return the response as a JSON object with two keys: "hasRedFlags" (boolean) and "questions" (an array of strings).

          Summary: "${summary}"
        `;

        const promptApi = await createIfAvailable(
          typeof self !== "undefined" ? self.Prompt : undefined
        );
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
    pageAnalysisResults[tabId] =
      Array.isArray(result.questions) && result.questions.length > 0
        ? result.questions.slice(0, 3)
        : [
            "What evidence supports the main claims?",
            "Is the language emotional or neutral?",
            "Can you find a source with an opposing view?",
          ];

    await updateIconAndBadge(tabId, !!result.hasRedFlags);
  } catch (error) {
    console.error("Critical Surfer: Page analysis failed.", error);
    await updateIconAndBadge(tabId, false);
  }
}

function heuristicPageAnalysis(text) {
  const emotionalWords = [
    "shocking",
    "unbelievable",
    "disaster",
    "scandal",
    "ruined",
    "destroyed",
    "furious",
    "rage",
    "terrified",
    "panic",
    "urgent",
    "now",
    "immediately",
    "must",
    "exposed",
    "secret",
    "banned",
    "outrage",
    "humiliated",
    "crushed",
  ];
  const clickbaitPhrases = [
    "you won't believe",
    "what happens next",
    "before it's too late",
    "the truth about",
    "nobody talks about",
    "shocking truth",
    "goes viral",
    "breaks the internet",
    "mind-blowing",
    "jaw-dropping",
    "click here",
    "free!!!",
  ];

  const lower = (text || "").toLowerCase();
  const emotionalCount = emotionalWords.reduce(
    (acc, w) => acc + (lower.includes(w) ? 1 : 0),
    0
  );
  const clickbaitCount = clickbaitPhrases.reduce(
    (acc, p) => acc + (lower.includes(p) ? 1 : 0),
    0
  );

  const exclamations = (text.match(/!+/g) || []).length;
  const allCapsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;

  const hasRedFlags =
    emotionalCount +
      clickbaitCount +
      (exclamations > 2 ? 1 : 0) +
      (allCapsWords > 5 ? 1 : 0) >=
    2;

  const questions = [
    "What specific evidence or sources back these claims?",
    "Is the language trying to trigger a strong emotion?",
    "What might be the author's goal in sharing this?",
  ];

  return { hasRedFlags, questions };
}

async function updateIconAndBadge(tabId, hasRedFlags) {
  try {
    // Badge fallback so MVP works even without custom icons
    await chrome.action.setBadgeBackgroundColor({
      color: hasRedFlags ? "#f59e0b" : "#00000000",
      tabId,
    });
    await chrome.action.setBadgeText({ text: hasRedFlags ? "!" : "", tabId });
  } catch (e) {
    // Ignore
  }

  // Try to set icon if assets are present (non-fatal if missing)
  const iconPath = hasRedFlags
    ? "icons/icon_warning128.png"
    : "icons/icon128.png";
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
  const input = (text || "").trim();
  if (!input) return null;

  try {
    try {
      const promptApi = await createIfAvailable(
        typeof self !== "undefined" ? self.Prompt : undefined
      );
      if (promptApi) {
        const toneCheck = await promptApi.execute({
          input: `Is this text aggressive or non-constructive? Respond YES or NO.\n\n${input}`,
        });
        if ((toneCheck || "").trim().toUpperCase() === "YES") {
          const rewriterApi = await createIfAvailable(
            typeof self !== "undefined" ? self.Rewriter : undefined
          );
          if (rewriterApi) {
            const rewrite = await rewriterApi.execute({
              input,
              options: { tone: "constructive" },
            });
            return (rewrite || "").trim() || null;
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
    console.error("Critical Surfer: Rewrite failed.", error);
    return null;
  }
}

function heuristicIsAggressive(text) {
  const lower = text.toLowerCase();
  const insults = [
    "idiot",
    "stupid",
    "dumb",
    "trash",
    "garbage",
    "shut up",
    "hate you",
    "loser",
    "moron",
    "worthless",
  ];
  const insultHit = insults.some((w) => lower.includes(w));

  const exclamations = (text.match(/!+/g) || []).length > 2;
  const allCapsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length > 2;

  return insultHit || exclamations || allCapsWords;
}

function titleCase(word) {
  return word.length
    ? word[0].toUpperCase() + word.slice(1).toLowerCase()
    : word;
}

function heuristicConstructiveRewrite(text) {
  // Replace common insults with neutral phrasing
  const replacements = [
    [/\bidiot\b/gi, "person"],
    [/\bstupid\b/gi, "unhelpful"],
    [/\bdumb\b/gi, "not clear"],
    [/\btrash\b/gi, "not useful"],
    [/\bgarbage\b/gi, "not accurate"],
    [/\bmoron\b/gi, "person"],
    [/\bworthless\b/gi, "not helpful"],
  ];

  let out = text;
  for (const [pattern, repl] of replacements) out = out.replace(pattern, repl);

  // Reduce shouting and punctuation
  out = out.replace(/!{2,}/g, "!");
  out = out.replace(/\?{2,}/g, "?");
  out = out.replace(/\b([A-Z]{4,})\b/g, (m) => titleCase(m));

  // Convert some "you" accusations into "I" statements
  out = out.replace(/\byou\s+are\b/gi, "I feel");
  out = out.replace(/\byou\s+should\b/gi, "I suggest we");

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
  if (request && request.action === "analyzePage") {
    const tabId = sender?.tab?.id;
    if (typeof tabId === "number") analyzePageContent(request.content, tabId);
  } else if (request && request.action === "analyzeTextForRewrite") {
    getConstructiveRewrite(request.text).then((suggestion) =>
      sendResponse({ suggestion })
    );
    return true; // keep the message channel open for async response
  } else if (request && request.action === "getAnalysisForPopup") {
    const questions = pageAnalysisResults[request.tabId] || [
      "No specific insights for this page. Always remember to think critically!",
    ];
    sendResponse({ questions });
  }
  // ===================================================================
  // STUDYBUDDY AI MESSAGE HANDLERS
  // ===================================================================
  else if (request && request.action === "processNotes") {
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

// Manejar procesamiento de notas
async function handleProcessNotes(request, sendResponse) {
  try {
    console.log("handleProcessNotes called with:", request);

    if (!noteProcessor) {
      await initializeStudyBuddyComponents();
    }

    const { textContent, imageData, type } = request;
    console.log("Extracted data:", {
      textContent: textContent?.length,
      imageData: !!imageData,
      type,
    });

    let processedNotes;
    if (type === "image" && imageData) {
      processedNotes = await noteProcessor.processImageNotes(imageData);
    } else if (textContent) {
      processedNotes = await noteProcessor.processTextNotes(textContent);
    } else {
      throw new Error("No se proporcionó contenido válido para procesar");
    }

    // Guardar en storage local
    await saveStudyData("processedNotes", processedNotes);

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
      throw new Error("No se proporcionaron notas procesadas");
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
      throw new Error("No se proporcionaron notas procesadas");
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
    const { dataType } = request;

    let data;
    switch (dataType) {
      case "processedNotes":
        data = await getStudyData("processedNotes");
        break;
      case "generatedQuiz":
        data = await getStudyData("generatedQuiz");
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
      throw new Error("Quiz no encontrado");
    }

    // Encontrar la pregunta
    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error("Pregunta no encontrada");
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
    const keys = ["processedNotes", "generatedQuiz", "studyProgress"];
    const result = await chrome.storage.local.get(keys);
    return result;
  } catch (error) {
    console.error("Error getting all study data:", error);
    return {};
  }
}

// Initialize: clear badge by default
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});
