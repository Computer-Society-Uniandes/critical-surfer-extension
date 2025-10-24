// background.js - StudyBuddy AI

// Importar módulos de estudio
importScripts("study-modules/note-processor.js");
importScripts("study-modules/quiz-generator.js");

// StudyBuddy AI components
let noteProcessor = null;
let quizGenerator = null;

// ===================================================================
// CHROME BUILT-IN AI API UTILITIES (2025)
// ===================================================================

// Check API availability
async function checkAPIAvailability(apiName) {
  try {
    if (!self.ai) {
      console.log("Chrome Built-in AI not available");
      return null;
    }

    const api = self.ai[apiName];
    if (!api || typeof api.availability !== "function") {
      console.log(`${apiName} API not found`);
      return null;
    }

    const availability = await api.availability();
    console.log(`${apiName} availability:`, availability);

    return availability === "readily" || availability === "after-download"
      ? availability
      : null;
  } catch (e) {
    console.error(`Error checking ${apiName} availability:`, e);
    return null;
  }
}

// Create API session
async function createAPISession(apiName, options = {}) {
  try {
    const availability = await checkAPIAvailability(apiName);
    if (!availability) return null;

    const api = self.ai[apiName];
    const session = await api.create(options);
    console.log(`${apiName} session created`);
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

    // Obtener notas existentes y agregar la nueva
    const allNotes = (await getStudyData("allNotes")) || [];
    allNotes.push(processedNotes);

    // Guardar en storage local
    await saveStudyData("allNotes", allNotes);
    await saveStudyData("processedNotes", processedNotes); // Mantener compatibilidad

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

// Manejar eliminación de nota
async function handleDeleteNote(request, sendResponse) {
  try {
    const { noteId } = request;

    if (!noteId) {
      throw new Error("Se requiere un noteId");
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
      throw new Error("Se requiere quizData");
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
