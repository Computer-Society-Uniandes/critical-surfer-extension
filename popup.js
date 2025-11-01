// popup.js - StudyBuddy AI (client-side orchestration)

const STORAGE_KEYS = {
  processedNotes: "processedNotes",
  allNotes: "allNotes",
  generatedQuiz: "generatedQuiz",
  quizHistory: "quizHistory",
  studyProgress: "studyProgress",
  lastStudyPack: "lastStudyPack",
  studyPackHistory: "studyPackHistory",
};

const MAX_STORED_NOTES = 50;
const MAX_STUDY_PACK_HISTORY = 15;
const MIN_TEXT_LENGTH = 50;
const DEFAULT_TARGET_LANGUAGE = "en";

let currentTab = "pack";
let processedNotes = null;
let currentQuiz = null;
let currentQuestionIndex = 0;
let quizAnswers = [];
let currentStudyPack = null;
let studyPackHistory = [];

let apiManager = null;
let noteProcessorInstance = null;
let quizGeneratorInstance = null;
let aiInitializationPromise = null;

// DOM references
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const uploadArea = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");
const processBtn = document.getElementById("process-btn");
const uploadMessage = document.getElementById("upload-message");
const generatePackBtn = document.getElementById("generate-pack-btn");
const packMessage = document.getElementById("pack-message");
const packLoading = document.getElementById("pack-loading");
const packResult = document.getElementById("pack-result");
const packSourceTitle = document.getElementById("pack-source-title");
const packSourceUrl = document.getElementById("pack-source-url");
const packCapturedAt = document.getElementById("pack-captured-at");
const packReadingTime = document.getElementById("pack-reading-time");
const packConceptCount = document.getElementById("pack-concept-count");
const packWordCount = document.getElementById("pack-word-count");
const packSummaryText = document.getElementById("pack-summary-text");
const packTakeaways = document.getElementById("pack-takeaways");
const packQuestions = document.getElementById("pack-questions");
const packFlashcards = document.getElementById("pack-flashcards");
const packActionSteps = document.getElementById("pack-action-steps");
const packBreakdownWarmup = document.getElementById("pack-breakdown-warmup");
const packBreakdownDeepDive = document.getElementById("pack-breakdown-deepdive");
const packBreakdownReview = document.getElementById("pack-breakdown-review");
const packQuizPreview = document.getElementById("pack-quiz-preview");
const launchQuizBtn = document.getElementById("launch-quiz-btn");
const copySummaryBtn = document.getElementById("copy-summary-btn");
const refreshPackHistoryBtn = document.getElementById("refresh-pack-history-btn");
const studyPackHistoryContainer = document.getElementById("study-pack-history");

const quizLoading = document.getElementById("quiz-loading");
const quizContent = document.getElementById("quiz-content");
const quizQuestions = document.getElementById("quiz-questions");
const quizProgress = document.getElementById("quiz-progress");
const progressFill = document.getElementById("progress-fill");
const nextBtn = document.getElementById("next-btn");
const finishBtn = document.getElementById("finish-btn");
const quizMessage = document.getElementById("quiz-message");
const manualQuizBtn = document.getElementById("generate-quiz-btn");

const progressMessage = document.getElementById("progress-message");
const totalNotes = document.getElementById("total-notes");
const totalQuizzes = document.getElementById("total-quizzes");
const avgScore = document.getElementById("avg-score");
const totalConcepts = document.getElementById("total-concepts");
const notesList = document.getElementById("notes-list");
const notesCount = document.getElementById("notes-count");
const quizHistoryContainer = document.getElementById("quiz-history");
const quizCount = document.getElementById("quiz-count");
const performanceChart = document.getElementById("performance-chart");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupEventListeners();
  await loadInitialState();
  updateUI();

  if (currentStudyPack) {
    renderStudyPack(currentStudyPack);
  }
}

function setupEventListeners() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  if (generatePackBtn) {
    generatePackBtn.addEventListener("click", generateStudyPack);
  }

  if (refreshPackHistoryBtn) {
    refreshPackHistoryBtn.addEventListener("click", loadStudyPackHistory);
  }

  if (launchQuizBtn) {
    launchQuizBtn.addEventListener("click", launchQuizFromPack);
  }

  if (copySummaryBtn) {
    copySummaryBtn.addEventListener("click", copyStudyPackSummary);
  }

  if (uploadArea) {
    uploadArea.addEventListener("click", () => fileInput?.click());
  uploadArea.addEventListener("dragover", handleDragOver);
  uploadArea.addEventListener("dragleave", handleDragLeave);
  uploadArea.addEventListener("drop", handleDrop);
  }

  if (fileInput) {
  fileInput.addEventListener("change", handleFileSelect);
  }

  if (textInput) {
  textInput.addEventListener("input", handleTextInput);
  }

  if (processBtn) {
  processBtn.addEventListener("click", () => processNotes("text"));
  }

  if (nextBtn) {
  nextBtn.addEventListener("click", nextQuestion);
  }

  if (finishBtn) {
  finishBtn.addEventListener("click", finishQuiz);
}

  if (manualQuizBtn) {
    manualQuizBtn.addEventListener("click", generateQuiz);
  }
}

async function loadInitialState() {
  try {
    const stored = await storageGet([
      STORAGE_KEYS.processedNotes,
      STORAGE_KEYS.generatedQuiz,
      STORAGE_KEYS.lastStudyPack,
      STORAGE_KEYS.studyPackHistory,
    ]);

    processedNotes = stored[STORAGE_KEYS.processedNotes] || null;
    currentStudyPack = stored[STORAGE_KEYS.lastStudyPack] || null;
    studyPackHistory = stored[STORAGE_KEYS.studyPackHistory] || [];
    const generatedQuiz = stored[STORAGE_KEYS.generatedQuiz];
    if (generatedQuiz) {
      currentQuiz = generatedQuiz;
      currentQuestionIndex = 0;
      quizAnswers = [];
    }
  } catch (error) {
    console.error("Error loading initial state:", error);
  }
}

function updateUI() {
  handleTextInput();

  if (currentTab === "progress") {
    loadProgressData();
  }

  if (currentTab === "pack" && currentStudyPack) {
    renderStudyPack(currentStudyPack);
  }
}

function switchTab(tabName) {
  currentTab = tabName;

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  tabContents.forEach((content) => {
    content.classList.toggle("active", content.id === `${tabName}-tab`);
  });

  if (tabName === "progress") {
    loadProgressData();
  } else if (tabName === "quiz" && processedNotes && !currentQuiz) {
    generateQuiz();
  } else if (tabName === "pack" && currentStudyPack) {
    renderStudyPack(currentStudyPack);
  }
}

function handleDragOver(event) {
  event.preventDefault();
  uploadArea?.classList.add("dragover");
}

function handleDragLeave(event) {
  event.preventDefault();
  uploadArea?.classList.remove("dragover");
}

function handleDrop(event) {
  event.preventDefault();
  uploadArea?.classList.remove("dragover");

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (file) {
    handleFile(file);
  }
}

async function handleFile(file) {
  try {
    if (file.type.startsWith("image/")) {
      const imageData = await readImageAsDataURL(file);
      await processNotes("image", imageData);
    } else if (
      file.type === "text/plain" ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md")
    ) {
      const text = await readTextFile(file);
      textInput.value = text;
      handleTextInput();
      showMessage(uploadMessage, "Paste looks good! Click Process Notes when ready.", "success");
    } else {
      showMessage(
        uploadMessage,
        "Only plain text (.txt, .md) and image files are supported.",
        "error"
      );
    }
  } catch (error) {
    console.error("Error handling file:", error);
    showMessage(uploadMessage, "Failed to read the selected file.", "error");
  }
}

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function handleTextInput() {
  const hasText = textInput?.value.trim().length >= MIN_TEXT_LENGTH;
  if (processBtn) {
  processBtn.disabled = !hasText;
  }
}

async function processNotes(type = "text", imageData = null) {
  try {
    if (processBtn) {
    processBtn.disabled = true;
    processBtn.textContent = "Processing...";
    }

    await ensureAIComponentsReady();

    let note;
    if (type === "image" && imageData) {
      note = await processImageNotesLocal(imageData);
    } else {
      const textContent = textInput.value.trim();
      if (textContent.length < MIN_TEXT_LENGTH) {
        throw new Error("Please provide at least 50 characters of text.");
      }
      note = await processTextNotesLocal(textContent);
    }

    processedNotes = note;
    await persistProcessedNotes(note);

    showMessage(uploadMessage, "Notes processed successfully!", "success");

      setTimeout(() => {
        switchTab("quiz");
        generateQuiz();
    }, 800);
  } catch (error) {
    console.error("Error processing notes:", error);
    showMessage(uploadMessage, error.message || "Failed to process notes", "error");
  } finally {
    if (processBtn) {
    processBtn.disabled = false;
    processBtn.textContent = "Process Notes";
    }
  }
}

async function processTextNotesLocal(originalText) {
  const detection = await detectLanguageSafe(originalText);
  const note = await processTextNotesWithOptions(originalText, {
    detection,
    metadata: {
      context: {
        source: "user-text",
      },
    },
  });
  return note;
}

async function processImageNotesLocal(imageData) {
  const extractedText = await apiManager.extractTextFromImage(imageData);

  if (!extractedText || extractedText.trim().length < MIN_TEXT_LENGTH) {
    throw new Error("The extracted text is too short to analyze. Try a clearer photo.");
  }

  const detection = await detectLanguageSafe(extractedText);
  const note = await processTextNotesWithOptions(extractedText, {
    detection,
    metadata: {
      context: {
        source: "image",
      },
    },
  });

  note.type = "image";
  note.imageData = imageData;
  return note;
}

async function processTextNotesWithOptions(originalText, { detection, metadata } = {}) {
  let workingText = originalText;
  let sourceLanguage = detection?.language || DEFAULT_TARGET_LANGUAGE;
  let translationInfo = null;

  if (metadata?.context?.snippets?.length) {
    workingText = metadata.context.snippets.join("\n\n").slice(0, 6000);
  } else {
    workingText = workingText.slice(0, 6000);
  }

  if (sourceLanguage !== DEFAULT_TARGET_LANGUAGE) {
    try {
      const translated = await apiManager.translateText(workingText, DEFAULT_TARGET_LANGUAGE, sourceLanguage);
      if (translated) {
        translationInfo = {
          from: sourceLanguage,
          to: DEFAULT_TARGET_LANGUAGE,
          confidence: detection?.confidence ?? null,
          engine: "chrome-translator",
          preview: translated.slice(0, 220),
        };
        workingText = translated;
      }
    } catch (error) {
      console.warn("Translation unavailable, continuing with original text", error);
    }
  }

  const note = await noteProcessorInstance.processTextNotes(workingText, {
    originalText,
    sourceLanguage,
    targetLanguage: DEFAULT_TARGET_LANGUAGE,
    translation: translationInfo,
    metadata: {
      ...(metadata || {}),
      detection,
    },
  });

  return note;
}

async function ensureAIComponentsReady(languageHint = DEFAULT_TARGET_LANGUAGE) {
  if (noteProcessorInstance && quizGeneratorInstance && apiManager) {
    return;
  }

  if (!aiInitializationPromise) {
    aiInitializationPromise = (async () => {
      if (navigator.userActivation && !navigator.userActivation.isActive) {
        console.debug("User activation is recommended before initializing AI models.");
      }

      apiManager = new StudyBuddyAPIManager({
        onDownloadProgress: handleDownloadProgress,
      });

      apiManager.setLanguagePreferences({
        input: [languageHint, DEFAULT_TARGET_LANGUAGE],
        output: DEFAULT_TARGET_LANGUAGE,
        context: [DEFAULT_TARGET_LANGUAGE],
      });

      await apiManager.initialize();

      noteProcessorInstance = new NoteProcessor();
      await noteProcessorInstance.initialize(apiManager);

      quizGeneratorInstance = new QuizGenerator();
      await quizGeneratorInstance.initialize(apiManager);
    })();
  }

  try {
    await aiInitializationPromise;
  } catch (error) {
    aiInitializationPromise = null;
    throw error;
  }
}

function handleDownloadProgress(apiName, event) {
  const percent = Math.round((event.loaded || 0) * 100);
  console.debug(`Downloading ${apiName} model: ${percent}%`);
}

async function detectLanguageSafe(text) {
  if (!text || text.length < MIN_TEXT_LENGTH || !apiManager) {
    return null;
  }

  try {
    return await apiManager.detectLanguage(text);
  } catch (error) {
    console.warn("Language detection failed", error);
    return null;
  }
}

async function persistProcessedNotes(note) {
  const stored = await storageGet([STORAGE_KEYS.allNotes]);
  const allNotes = stored[STORAGE_KEYS.allNotes] || [];

  const filtered = allNotes.filter((existing) => existing.id !== note.id);
  filtered.unshift(note);

  if (filtered.length > MAX_STORED_NOTES) {
    filtered.length = MAX_STORED_NOTES;
  }

  await storageSet({
    [STORAGE_KEYS.allNotes]: filtered,
    [STORAGE_KEYS.processedNotes]: note,
  });
}

async function generateQuiz() {
  try {
    if (!processedNotes) {
      showMessage(
        quizMessage,
        "Process some notes or generate a study pack first.",
        "error"
      );
      return;
    }

    toggleHidden(quizLoading, false);
    toggleHidden(quizContent, true);
    quizMessage.innerHTML = "";

    await ensureAIComponentsReady(processedNotes.sourceLanguage || DEFAULT_TARGET_LANGUAGE);

    const { initialQuiz, source, upgradePromise } = await createQuizWithFastFallback(
      processedNotes
    );

    currentQuiz = initialQuiz;
      currentQuestionIndex = 0;
      quizAnswers = [];

    await storageSet({ [STORAGE_KEYS.generatedQuiz]: currentQuiz });

    const sourceLabel = source === "ai" ? "AI" : "instant";
      showMessage(
        quizMessage,
      `${sourceLabel} quiz ready! ${currentQuiz.questions.length} questions queued.`,
        "success"
      );

      showQuiz();

    if (upgradePromise) {
      upgradePromise
        .then((upgradedQuiz) => {
          if (!upgradedQuiz || upgradedQuiz.id === currentQuiz.id) {
            return;
          }
          currentQuiz = upgradedQuiz;
          currentQuestionIndex = 0;
          quizAnswers = [];
          storageSet({ [STORAGE_KEYS.generatedQuiz]: currentQuiz });
          showQuiz();
        showMessage(
          quizMessage,
            "Quiz upgraded with on-device AI questions.",
            "success",
            6000
          );
        })
        .catch((error) => {
          console.warn("AI quiz upgrade skipped", error);
        });
    }
  } catch (error) {
    console.error("Error generating quiz:", error);
    showMessage(quizMessage, error.message || "Error generating quiz", "error");
  } finally {
    toggleHidden(quizLoading, true);
  }
}

async function createQuizWithFastFallback(notes) {
  const options = {
        questionCount: 5,
        difficulty: "medium",
        questionTypes: ["multipleChoice", "trueFalse", "shortAnswer"],
  };

  const aiPromise = quizGeneratorInstance
    .generateQuiz(notes, options)
    .then((quiz) => ({ quiz, source: "ai" }))
    .catch((error) => {
      console.warn("AI quiz generation failed", error);
      return { quiz: null, source: "ai" };
    });

  const localPromise = quizGeneratorInstance
    .generateQuizLocal(notes, options)
    .then((quiz) => ({ quiz, source: "local" }))
    .catch((error) => {
      console.warn("Local quiz generation failed", error);
      return { quiz: null, source: "local" };
    });

  let firstResolved = await Promise.race([aiPromise, localPromise]);

  if (!firstResolved.quiz) {
    const fallback = await (firstResolved.source === "ai" ? localPromise : aiPromise);
    if (!fallback.quiz) {
      throw new Error("Unable to generate questions right now. Try again after loading notes.");
    }
    firstResolved = fallback;
  }

  let upgradePromise = null;
  if (firstResolved.source === "local") {
    upgradePromise = aiPromise.then((result) => (result.quiz && result.quiz.id !== firstResolved.quiz.id ? result.quiz : null));
  }

  return { initialQuiz: firstResolved.quiz, source: firstResolved.source, upgradePromise };
}

function showQuiz() {
  toggleHidden(quizContent, false);
  showQuestion();
}

function showQuestion() {
  if (!currentQuiz || currentQuestionIndex >= currentQuiz.questions.length) {
    finishQuiz();
    return;
  }

  const question = currentQuiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;

  progressFill.style.width = `${progress}%`;
  quizProgress.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}`;

  quizQuestions.innerHTML = createQuestionHTML(question);

  nextBtn.disabled = true;
  nextBtn.classList.toggle("hidden", currentQuestionIndex >= currentQuiz.questions.length - 1);
  finishBtn.classList.toggle("hidden", currentQuestionIndex < currentQuiz.questions.length - 1);

  setupQuestionListeners(question);
}

function createQuestionHTML(question) {
  let html = `<div class="quiz-question">
    <div class="question-text">${question.question}</div>`;

  if (question.type === "multiple_choice") {
    html += '<div class="options">';
    question.options.forEach((option, index) => {
      const letter = String.fromCharCode(65 + index);
      html += `<button class="option" data-answer="${letter}">${letter}) ${option}</button>`;
    });
    html += "</div>";
  } else if (question.type === "true_false") {
    html += `<div class="options">
      <button class="option" data-answer="true">True</button>
      <button class="option" data-answer="false">False</button>
    </div>`;
  } else {
    html += `<div class="options">
      <textarea class="text-input" id="short-answer" placeholder="Type your answer here..." style="min-height: 60px;"></textarea>
    </div>`;
  }

  html += "</div>";
  return html;
}

function setupQuestionListeners(question) {
  const options = document.querySelectorAll(".option");
  const shortAnswer = document.getElementById("short-answer");

  if (question.type === "short_answer" && shortAnswer) {
    shortAnswer.addEventListener("input", () => {
      nextBtn.disabled = !shortAnswer.value.trim();
    });
  } else {
    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        nextBtn.disabled = false;
      });
    });
  }
}

function nextQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];
  let answer;

  if (question.type === "short_answer") {
    answer = document.getElementById("short-answer")?.value.trim();
  } else {
    answer = document.querySelector(".option.selected")?.dataset.answer;
  }

  if (!answer) {
    showMessage(quizMessage, "Choose an answer before moving on.", "error");
    return;
  }

  quizAnswers.push({
    questionId: question.id,
    answer,
    timeSpent: 0,
  });

  currentQuestionIndex += 1;
  showQuestion();
}

async function finishQuiz() {
  try {
    if (!currentQuiz || !quizAnswers.length) {
      return;
    }

    let correctAnswers = 0;

    for (let i = 0; i < quizAnswers.length; i += 1) {
      const answer = quizAnswers[i];
      const question = currentQuiz.questions.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const isCorrect = evaluateAnswer(question, answer.answer);
      if (isCorrect) {
        correctAnswers += 1;
      }

      await updateQuizProgress(
        currentQuiz.id,
        question.id,
        isCorrect,
        answer.timeSpent
      );
    }

    const score = Math.round((correctAnswers / quizAnswers.length) * 100);

    await saveQuizToHistory({
        id: currentQuiz.id,
      score,
      correctAnswers,
        totalQuestions: quizAnswers.length,
        completedAt: Date.now(),
      timeSpent: quizAnswers.reduce((sum, item) => sum + (item.timeSpent || 0), 0),
    });

    quizQuestions.innerHTML = `
      <div class="quiz-question">
        <div class="question-text">🎉 Quiz completed!</div>
        <div style="text-align: center; margin: 20px 0;">
          <div style="font-size: 32px; font-weight: bold; color: #2563eb;">${score}%</div>
          <div style="color: #64748b;">${correctAnswers} out of ${quizAnswers.length} correct</div>
        </div>
      </div>
    `;

    nextBtn.classList.add("hidden");
    finishBtn.classList.add("hidden");

    showMessage(quizMessage, `Great job! You scored ${score}%.`, "success");

    await loadProgressData();
  } catch (error) {
    console.error("Error finishing quiz:", error);
    showMessage(quizMessage, "We couldn't finalise the quiz.", "error");
  }
}

function evaluateAnswer(question, userAnswer) {
  switch (question.type) {
    case "multiple_choice":
      return userAnswer === question.correctAnswer;
    case "true_false":
      return userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
    case "short_answer": {
      const userWords = userAnswer.toLowerCase().split(/\s+/);
      const keyWords = question.answerKey.toLowerCase().split(/\s+/);
      const commonWords = userWords.filter((word) => keyWords.includes(word));
      return commonWords.length >= Math.min(2, keyWords.length * 0.3);
    }
    default:
      return false;
  }
}

async function updateQuizProgress(quizId, questionId, isCorrect, timeSpent) {
  const stored = await storageGet([STORAGE_KEYS.studyProgress]);
  const progress = stored[STORAGE_KEYS.studyProgress] || {};

  const quizProgress = progress[quizId] || {
    quizId,
    totalQuestions: 0,
    correctAnswers: 0,
    totalTimeSpent: 0,
    questionsAnswered: 0,
    startedAt: Date.now(),
  };

  quizProgress.questionsAnswered += 1;
  quizProgress.totalTimeSpent += timeSpent || 0;
  if (isCorrect) {
    quizProgress.correctAnswers += 1;
  }

  progress[quizId] = quizProgress;
  await storageSet({ [STORAGE_KEYS.studyProgress]: progress });

  return quizProgress;
}

async function saveQuizToHistory(entry) {
  const stored = await storageGet([STORAGE_KEYS.quizHistory]);
  const quizHistory = stored[STORAGE_KEYS.quizHistory] || [];

  quizHistory.push(entry);
  await storageSet({ [STORAGE_KEYS.quizHistory]: quizHistory });
}

async function generateStudyPack() {
  try {
    await ensureAIComponentsReady();

    toggleHidden(packLoading, false);
    showMessage(packMessage, "Capturing the current page...", "success", 3000);

    const pageContext = await captureActiveTabContext();
    if (!pageContext || !pageContext.textContent || pageContext.textContent.length < MIN_TEXT_LENGTH) {
      throw new Error("We couldn't capture enough readable text on this page.");
    }

    const detection = await detectLanguageSafe(pageContext.textContent);
    pageContext.detectedLanguage = detection?.language || pageContext.language;
    pageContext.detectionConfidence = detection?.confidence ?? null;

    const note = await processTextNotesWithOptions(pageContext.textContent, {
      detection,
      metadata: {
        context: {
          source: "web-page",
          url: pageContext.url,
          snippets: pageContext.snippets || [],
        },
        page: {
          headings: pageContext.headings,
          selectionPreview: pageContext.selectionPreview,
          metaDescription: pageContext.metaDescription,
        },
      },
    });

    note.type = "web";
    note.source = {
      title: pageContext.title,
      url: pageContext.url,
      capturedAt: Date.now(),
      language: pageContext.detectedLanguage,
      confidence: pageContext.detectionConfidence,
    };

    processedNotes = note;
    await persistProcessedNotes(note);

    const { studyPack, upgradePromise } = await buildStudyPack(note, pageContext);
    currentStudyPack = studyPack;

    await persistStudyPack(studyPack);
    await loadStudyPackHistory();

    renderStudyPack(studyPack);

    showMessage(packMessage, "Study pack ready! Explore the insights below.", "success");

    if (upgradePromise) {
      upgradePromise
        .then(async (upgradedArtifacts) => {
          if (!upgradedArtifacts) {
            return;
          }
          const upgradedPack = {
            ...currentStudyPack,
            artifacts: upgradedArtifacts,
          };
          currentStudyPack = upgradedPack;
          await persistStudyPack(upgradedPack);
          renderStudyPackHistory(studyPackHistory);
          renderStudyPack(upgradedPack);
          showMessage(
            packMessage,
            "Study pack enriched with Gemini Nano insights.",
            "success",
            6000
          );
        })
        .catch((error) => {
          console.warn("Study pack upgrade skipped", error);
        });
    }
  } catch (error) {
    console.error("generateStudyPack error", error);
    showMessage(packMessage, error.message || "Unable to generate a study pack", "error");
  } finally {
    toggleHidden(packLoading, true);
  }
}

async function captureActiveTabContext() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab || !activeTab.id) {
    throw new Error("Active tab could not be located");
  }

  if (!activeTab.url || /^(chrome|edge|about|file|chrome-extension):/i.test(activeTab.url)) {
    throw new Error("This page cannot be analysed by the extension");
  }

  const [result] = await chrome.scripting.executeScript({
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

        const BLOCK_SELECTOR = "p, li, blockquote";
        const blocks = Array.from(candidate.querySelectorAll(BLOCK_SELECTOR))
          .map((node) => node.innerText.replace(/\s+/g, " ").trim())
          .filter((text) => text.length >= 80);

        const topBlocks = blocks.slice(0, 20);
        const primaryText = topBlocks.join("\n\n");

        const rawText = (candidate?.innerText || "").replace(/\s+/g, " ").trim();

        const chosenText = cleanedSelection && cleanedSelection.length >= 200 ? cleanedSelection : primaryText || rawText;

        const truncated = clamp(chosenText, 8000);

        const snippets = topBlocks.slice(0, 6);

        const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
          .map((heading) => heading.innerText.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 8);

        const metaDescription = document
          .querySelector("meta[name='description']")
          ?.getAttribute("content");

        const language = document.documentElement.lang || navigator.language || "en";
        const wordCount = truncated ? truncated.split(/\s+/).filter(Boolean).length : 0;

        return {
          title: document.title || "Untitled Page",
          url: location.href,
          textContent: truncated,
          selectionText: clamp(cleanedSelection, 1200),
          selectionPreview: clamp(cleanedSelection, 280),
          headings,
          snippets,
          metaDescription: clamp(metaDescription, 500),
          language,
          wordCount,
        };
      } catch (error) {
        return { error: error?.message || "Unknown capture error" };
      }
    },
  });

  if (!result || result.result?.error) {
    throw new Error(result?.result?.error || "No analyseable content detected on this page");
  }

  return {
    ...result.result,
    tabId: activeTab.id,
  };
}

async function buildStudyPack(note, pageContext) {
  const fallbackArtifacts = createFallbackStudyArtifacts(note, pageContext);

  const basePack = {
    id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: Date.now(),
    noteId: note.id,
    summary: note.summary,
    concepts: note.concepts,
    metrics: {
      extractedWordCount: pageContext.wordCount || 0,
      estimatedReadingTimeMinutes: Math.max(1, Math.round((pageContext.wordCount || 0) / 200)),
    },
    source: {
      title: pageContext.title,
      url: pageContext.url,
      language: pageContext.detectedLanguage || pageContext.language,
      detectionConfidence: pageContext.detectionConfidence,
      headings: pageContext.headings,
      metaDescription: pageContext.metaDescription,
      selectionPreview: pageContext.selectionPreview,
      capturedAt: Date.now(),
    },
    artifacts: fallbackArtifacts,
  };

  const upgradePromise = apiManager
    .requestStructuredJSON(
      buildStudyPackPromptPayload(note, pageContext),
      fallbackArtifacts,
      {}
    )
    .then((artifacts) => {
      if (!artifacts) {
        return null;
      }
      return normalizeStudyPackArtifacts(artifacts, fallbackArtifacts);
    })
    .catch((error) => {
      console.warn("Study pack artifact upgrade failed", error);
      return null;
    });

  return { studyPack: basePack, upgradePromise };
}

function buildStudyPackPromptPayload(note, pageContext) {
  const payload = {
    summary: note.summary,
    concepts: note.concepts,
    pageTitle: pageContext.title,
    headings: pageContext.headings,
    metaDescription: pageContext.metaDescription,
    language: pageContext.detectedLanguage || pageContext.language,
  };

  return `You are StudyBuddy, an academic coach creating concise learning aids.
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
${JSON.stringify(payload)}
`;
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

  normalized.recommendedBreakdown = normalized.recommendedBreakdown && typeof normalized.recommendedBreakdown === "object"
      ? {
          warmUp: normalized.recommendedBreakdown.warmUp || fallbackArtifacts.recommendedBreakdown.warmUp,
          deepDive: normalized.recommendedBreakdown.deepDive || fallbackArtifacts.recommendedBreakdown.deepDive,
          review: normalized.recommendedBreakdown.review || fallbackArtifacts.recommendedBreakdown.review,
        }
      : fallbackArtifacts.recommendedBreakdown;

  return normalized;
}

function createFallbackStudyArtifacts(note, pageContext) {
  const concepts = Array.isArray(note?.concepts) ? note.concepts.slice(0, 5) : [];

  const summaryLines = (note?.summary || "")
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
    studyQuestions: fallbackTakeaways
      .slice(0, 4)
      .map((item) => `Why is ${item.title} important in this context?`),
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
  const stored = await storageGet([STORAGE_KEYS.studyPackHistory]);
  const history = stored[STORAGE_KEYS.studyPackHistory] || [];

  history.unshift(studyPack);
  const deduped = history.reduce((acc, item) => {
    if (!acc.find((existing) => existing.id === item.id)) {
      acc.push(item);
    }
    return acc;
  }, []);

  if (deduped.length > MAX_STUDY_PACK_HISTORY) {
    deduped.length = MAX_STUDY_PACK_HISTORY;
  }

  await storageSet({
    [STORAGE_KEYS.lastStudyPack]: studyPack,
    [STORAGE_KEYS.studyPackHistory]: deduped,
  });

  studyPackHistory = deduped;
}

async function loadStudyPackHistory() {
  try {
    const stored = await storageGet([STORAGE_KEYS.studyPackHistory]);
    studyPackHistory = stored[STORAGE_KEYS.studyPackHistory] || [];
    renderStudyPackHistory(studyPackHistory);
  } catch (error) {
    console.error("Error loading study pack history", error);
  }
}

async function loadProgressData() {
  try {
    const stored = await storageGet([
      STORAGE_KEYS.allNotes,
      STORAGE_KEYS.quizHistory,
      STORAGE_KEYS.studyPackHistory,
    ]);

    const notes = stored[STORAGE_KEYS.allNotes] || [];
    const quizzes = stored[STORAGE_KEYS.quizHistory] || [];
    studyPackHistory = stored[STORAGE_KEYS.studyPackHistory] || [];

    updateStats(notes, quizzes, null);
    renderNotes(notes);
    renderQuizHistory(quizzes);
    renderPerformanceChart(quizzes);
    renderStudyPackHistory(studyPackHistory);
  } catch (error) {
    console.error("Error loading progress data:", error);
    showMessage(progressMessage, "Unable to refresh progress right now.", "error");
  }
}

async function loadStudyData() {
  try {
    const stored = await storageGet([STORAGE_KEYS.processedNotes]);
    processedNotes = stored[STORAGE_KEYS.processedNotes] || null;
  } catch (error) {
    console.error("Error loading study data:", error);
  }
}

async function deleteNote(noteId) {
  if (!confirm("Delete this note permanently?")) {
    return;
  }

  try {
    const stored = await storageGet([STORAGE_KEYS.allNotes]);
    const allNotes = stored[STORAGE_KEYS.allNotes] || [];
    const filteredNotes = allNotes.filter((note) => note.id !== noteId);

    await storageSet({ [STORAGE_KEYS.allNotes]: filteredNotes });

    if (processedNotes?.id === noteId) {
      processedNotes = null;
      await storageRemove(STORAGE_KEYS.processedNotes);
    }

    showMessage(progressMessage, "Note deleted successfully.", "success");
    await loadProgressData();
  } catch (error) {
    console.error("Error deleting note:", error);
    showMessage(progressMessage, "Could not delete the note.", "error");
  }
}

async function relaunchQuizFromNote(noteId) {
  try {
    const stored = await storageGet([STORAGE_KEYS.allNotes]);
    const allNotes = stored[STORAGE_KEYS.allNotes] || [];
    const note = allNotes.find((item) => item.id === noteId);

    if (!note) {
      throw new Error("Unable to load that note.");
    }

    processedNotes = note;
    await storageSet({ [STORAGE_KEYS.processedNotes]: note });
    switchTab("quiz");
    generateQuiz();
  } catch (error) {
    console.error("relaunchQuizFromNote error", error);
    showMessage(progressMessage, error.message, "error");
  }
}

async function copyStudyPackSummary() {
  if (!currentStudyPack?.summary) {
    showMessage(packMessage, "There is no summary to copy yet.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(currentStudyPack.summary);
    showMessage(packMessage, "Summary copied to clipboard.", "success");
  } catch (error) {
    console.warn("Clipboard copy failed", error);
    showMessage(packMessage, "Unable to access the clipboard.", "error");
  }
}

async function launchQuizFromPack() {
  if (!currentStudyPack?.noteId) {
    showMessage(packMessage, "Generate a study pack first to unlock the quiz.", "error");
    return;
  }

  try {
    const stored = await storageGet([STORAGE_KEYS.allNotes]);
    const allNotes = stored[STORAGE_KEYS.allNotes] || [];
    const note = allNotes.find((item) => item.id === currentStudyPack.noteId);

    if (!note) {
      throw new Error("Unable to load processed notes for this pack.");
    }

    processedNotes = note;
    await storageSet({ [STORAGE_KEYS.processedNotes]: note });

    currentQuiz = null;
    quizAnswers = [];
    currentQuestionIndex = 0;

    switchTab("quiz");
    generateQuiz();
  } catch (error) {
    console.error("launchQuizFromPack error", error);
    showMessage(packMessage, error.message, "error");
  }
}

function renderStudyPack(studyPack) {
  if (!studyPack) {
    toggleHidden(packResult, true);
    return;
  }

  toggleHidden(packResult, false);

  const metadataContainer = document.querySelector(".pack-metadata");
  if (metadataContainer) {
    metadataContainer.innerHTML = "";

    const metaItems = [
      {
        label: "Source",
        value: studyPack.source?.title || "Untitled",
      },
      {
        label: "URL",
        value: formatDisplayUrl(studyPack.source?.url),
      },
      {
        label: "Captured",
        value: formatRelativeTimestamp(studyPack.source?.capturedAt),
      },
    ];

    if (studyPack.source?.language) {
      const langLabel = studyPack.source.language.toUpperCase();
      const translation = processedNotes?.translation;
      const value = translation
        ? `${langLabel} → ${translation.to?.toUpperCase?.() || DEFAULT_TARGET_LANGUAGE.toUpperCase()}`
        : langLabel;
      metaItems.push({ label: "Language", value });
    }

    metaItems.forEach((item) => {
      const pill = document.createElement("div");
      pill.className = "meta-pill";
      pill.innerHTML = `<span>${item.label}</span><strong>${item.value || "—"}</strong>`;
      metadataContainer.appendChild(pill);
    });
  }

  packSourceTitle.textContent = studyPack.source?.title || "Untitled page";
  packSourceUrl.textContent = formatDisplayUrl(studyPack.source?.url);
  packSourceUrl.title = studyPack.source?.url || "";
  if (studyPack.source?.url) {
    packSourceUrl.href = studyPack.source.url;
  }
  packCapturedAt.textContent = formatRelativeTimestamp(studyPack.source?.capturedAt);
  packReadingTime.textContent = formatReadingTime(studyPack.metrics);
  packConceptCount.textContent = (studyPack.concepts || []).length.toString();
  packWordCount.textContent = (studyPack.metrics?.extractedWordCount || 0).toString();

  packSummaryText.textContent = studyPack.summary || "No summary available.";

  renderTakeaways(studyPack.artifacts?.takeaways);
  renderStringList(packQuestions, studyPack.artifacts?.studyQuestions, {
    emptyMessage: "Add more detailed content to receive targeted study questions.",
  });
  renderFlashcards(studyPack.artifacts?.flashcards);
  renderStringList(packActionSteps, studyPack.artifacts?.actionSteps, {
    emptyMessage: "No action steps generated. Try regenerating the pack.",
  });

  const breakdown = studyPack.artifacts?.recommendedBreakdown || {};
  packBreakdownWarmup.textContent = breakdown.warmUp || "Review the summary for a focused warm-up.";
  packBreakdownDeepDive.textContent = breakdown.deepDive || "Read the original section and expand the key takeaways.";
  packBreakdownReview.textContent = breakdown.review || "Test yourself with the flashcards and quiz.";

  if (launchQuizBtn) {
    launchQuizBtn.disabled = !processedNotes;
  }

  renderMiniQuizPreview(studyPack.microQuiz);
}

function renderTakeaways(takeaways = []) {
  if (!takeaways.length) {
    packTakeaways.innerHTML = `<div class="bullet-item"><span>No key takeaways were generated.</span></div>`;
    return;
  }

  packTakeaways.innerHTML = takeaways
    .slice(0, 5)
    .map(
      (item) => `
        <div class="bullet-item">
          <strong>${item.title || "Key insight"}</strong>
          <span>${item.detail || "Review this concept in context."}</span>
          <span style="color: #1d4ed8; font-weight: 500;">${
            item.whyItMatters || "Clarify why this concept matters to the topic."
          }</span>
        </div>
      `
    )
    .join("");
}

function renderStringList(container, values = [], { emptyMessage } = {}) {
  if (!container) {
    return;
  }

  if (!values || values.length === 0) {
    container.innerHTML = emptyMessage
      ? `<div class="bullet-item"><span>${emptyMessage}</span></div>`
      : "";
    return;
  }

  container.innerHTML = values
    .map(
      (value) => `
        <div class="bullet-item">
          <span>${value}</span>
        </div>
      `
    )
    .join("");
}

function renderFlashcards(cards = []) {
  if (!cards.length) {
    packFlashcards.innerHTML = `
      <div class="flashcard">
        <div class="flashcard-front">No flashcards generated</div>
        <div class="flashcard-back">Try regenerating once more detailed content is available.</div>
      </div>
    `;
    return;
  }

  packFlashcards.innerHTML = cards
    .slice(0, 6)
    .map(
      (card) => `
        <div class="flashcard">
          <div class="flashcard-front">${card.front || "Front"}</div>
          <div class="flashcard-back">${card.back || "Back"}</div>
        </div>
      `
    )
    .join("");
}

function renderMiniQuizPreview(microQuiz) {
  if (!packQuizPreview) {
    return;
  }

  if (!microQuiz || !Array.isArray(microQuiz.questions) || !microQuiz.questions.length) {
    packQuizPreview.innerHTML = `
      <div class="mini-quiz-question">
        No quick questions yet. Launch the full quiz to practise with AI-generated questions.
      </div>
    `;
    return;
  }

  packQuizPreview.innerHTML = microQuiz.questions
    .slice(0, 3)
    .map(
      (question, index) => `
        <div class="mini-quiz-question">
          <strong>Q${index + 1}:</strong> ${question.question || "Question preview unavailable."}
        </div>
      `
    )
    .join("");
}

function renderStudyPackHistory(history) {
  if (!studyPackHistoryContainer) {
    return;
  }

  if (!history || history.length === 0) {
    studyPackHistoryContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✨</div>
        <div>No study packs yet. Generate one to see it here.</div>
      </div>
    `;
    return;
  }

  studyPackHistoryContainer.innerHTML = history
    .map((pack) => {
      const sourceTitle = pack.source?.title || "Untitled page";
      const generatedAt = formatRelativeTimestamp(pack.generatedAt);
      const conceptCount = (pack.concepts || []).length;

      const languageLabel = pack.source?.language
        ? pack.source.language.toUpperCase()
        : "EN";

      return `
        <div class="pack-history-item">
          <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
            <div style="font-weight:600; font-size:13px;">${sourceTitle}</div>
            <button class="btn btn-secondary" data-view-pack="${pack.id}">Open</button>
          </div>
          <div style="font-size:12px; color:#475569; display:flex; justify-content:space-between;">
            <span>${generatedAt}</span>
            <span>${formatReadingTime(pack.metrics)} • ${conceptCount} concepts • ${languageLabel}</span>
          </div>
        </div>
      `;
    })
    .join("");

  studyPackHistoryContainer.querySelectorAll('[data-view-pack]').forEach((button) => {
    button.addEventListener("click", async () => {
      const packId = button.getAttribute("data-view-pack");
      const pack = studyPackHistory.find((item) => item.id === packId);
      if (!pack) return;

      currentStudyPack = pack;
      await storageSet({ [STORAGE_KEYS.lastStudyPack]: pack });
      renderStudyPack(pack);
      switchTab("pack");
    });
  });
}

function updateStats(notes, quizzes) {
  totalNotes.textContent = (notes || []).length.toString();
  totalQuizzes.textContent = (quizzes || []).length.toString();

  if (quizzes && quizzes.length) {
    const totalScore = quizzes.reduce((sum, quiz) => sum + quiz.score, 0);
    const average = Math.round(totalScore / quizzes.length);
    avgScore.textContent = `${average}%`;
  } else {
    avgScore.textContent = "0%";
  }

  const uniqueConcepts = new Set();
  (notes || []).forEach((note) => {
    (note.concepts || []).forEach((concept) => uniqueConcepts.add(concept));
  });
  totalConcepts.textContent = uniqueConcepts.size.toString();
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <div>No notes yet. Upload or capture a page to get started.</div>
      </div>
    `;
    notesCount.textContent = "";
    return;
  }

  notesCount.textContent = `(${notes.length})`;

  notesList.innerHTML = notes
    .slice()
    .sort((a, b) => b.processedAt - a.processedAt)
    .map((note) => {
      const date = new Date(note.processedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const preview = note.summary || note.originalText?.substring(0, 120) || "No preview available";
      const concepts = note.concepts || [];
      const displayConcepts = concepts.slice(0, 3);

      const languageLabel = note.sourceLanguage
        ? note.sourceLanguage.toUpperCase()
        : DEFAULT_TARGET_LANGUAGE.toUpperCase();

      return `
        <div class="note-item" data-note-id="${note.id}">
          <div class="note-header">
            <span class="note-type">${note.type || "text"}</span>
            <span class="note-date">${date}</span>
          </div>
          <div class="note-preview">${preview}...</div>
          ${
            displayConcepts.length
              ? `
            <div class="note-concepts">
              ${displayConcepts
                    .map((concept) => `<span class="concept-tag">${concept}</span>`)
                .join("")}
                  ${concepts.length > 3 ? `<span class="concept-tag">+${concepts.length - 3} more</span>` : ""}
            </div>
          `
              : ""
          }
          <div class="note-actions">
            <button class="btn-small btn-quiz" data-action="relaunch" data-note-id="${note.id}">
              🧠 Create Quiz
            </button>
            <button class="btn-small btn-delete" data-action="delete" data-note-id="${note.id}">
              🗑️ Delete
            </button>
            <span style="font-size:11px; color:#64748b; margin-left:auto;">${languageLabel}</span>
          </div>
        </div>
      `;
    })
    .join("");

  notesList.querySelectorAll('[data-action="relaunch"]').forEach((btn) => {
    btn.addEventListener("click", () => relaunchQuizFromNote(btn.dataset.noteId));
  });

  notesList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteNote(btn.dataset.noteId));
  });
}

function renderQuizHistory(quizzes) {
  if (!quizzes || quizzes.length === 0) {
    quizHistoryContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧠</div>
        <div>No quizzes completed yet.</div>
      </div>
    `;
    quizCount.textContent = "";
    return;
  }

  quizCount.textContent = `(${quizzes.length})`;

  quizHistoryContainer.innerHTML = quizzes
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt)
    .map((quiz) => {
      const date = new Date(quiz.completedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
        <div class="quiz-item">
          <div class="quiz-score-badge ${scoreBadgeClass(quiz.score)}">${quiz.score}%</div>
          <div class="quiz-details">📅 ${date}</div>
          <div class="quiz-details">✅ ${quiz.correctAnswers}/${quiz.totalQuestions} correct</div>
          ${quiz.timeSpent ? `<div class="quiz-details">⏱️ ${Math.round(quiz.timeSpent / 60)} min</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function renderPerformanceChart(quizzes) {
  if (!quizzes || quizzes.length === 0) {
    performanceChart.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div>Complete quizzes to see your progress</div>
      </div>
    `;
    return;
  }

  const recentQuizzes = quizzes
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 5)
    .reverse();

  performanceChart.innerHTML = recentQuizzes
    .map((quiz, index) => {
      const label = `Quiz ${quizzes.length - index}`;
      return `
        <div class="chart-bar">
          <div class="chart-label">${label}</div>
          <div class="chart-track">
            <div class="chart-fill" style="width:${quiz.score}%"></div>
            <div class="chart-value">${quiz.score}%</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function toggleHidden(element, shouldHide) {
  if (!element) return;
  element.classList.toggle("hidden", shouldHide);
}

function showMessage(container, message, type = "success", timeout = 5000) {
  if (!container) return;

  if (!message) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `<div class="message ${type}">${message}</div>`;

  if (timeout) {
    setTimeout(() => {
      if (container.innerHTML.includes(message)) {
        container.innerHTML = "";
      }
    }, timeout);
  }
}

function formatDisplayUrl(url) {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 1 ? parsed.pathname : "";
    const display = `${parsed.host}${path.length > 30 ? `${path.slice(0, 27)}…` : path}`;
    return display;
  } catch (error) {
    return url;
  }
}

function formatRelativeTimestamp(timestamp) {
  if (!timestamp) return "Just now";
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatReadingTime(metrics) {
  const minutes = metrics?.estimatedReadingTimeMinutes || 0;
  if (!minutes) return "~1 min";
  return `~${Math.max(1, minutes)} min`;
}

function scoreBadgeClass(score = 0) {
  if (score >= 90) return "quiz-score-excellent";
  if (score >= 75) return "quiz-score-good";
  if (score >= 60) return "quiz-score-fair";
  return "quiz-score-poor";
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(result);
      }
    });
  });
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve();
      }
    });
  });
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve();
      }
    });
  });
}
