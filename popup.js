// popup.js - StudyBuddy AI

// Estado de la aplicación
let currentTab = "upload";
let processedNotes = null;
let currentQuiz = null;
let currentQuestionIndex = 0;
let quizAnswers = [];

// Elementos del DOM
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const uploadArea = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");
const processBtn = document.getElementById("process-btn");
const uploadMessage = document.getElementById("upload-message");
const quizLoading = document.getElementById("quiz-loading");
const quizContent = document.getElementById("quiz-content");
const quizQuestions = document.getElementById("quiz-questions");
const quizProgress = document.getElementById("quiz-progress");
const progressFill = document.getElementById("progress-fill");
const nextBtn = document.getElementById("next-btn");
const finishBtn = document.getElementById("finish-btn");
const quizMessage = document.getElementById("quiz-message");
const progressMessage = document.getElementById("progress-message");
const totalNotes = document.getElementById("total-notes");
const totalQuizzes = document.getElementById("total-quizzes");
const avgScore = document.getElementById("avg-score");
const totalConcepts = document.getElementById("total-concepts");
const notesList = document.getElementById("notes-list");
const notesCount = document.getElementById("notes-count");
const quizHistory = document.getElementById("quiz-history");
const quizCount = document.getElementById("quiz-count");
const performanceChart = document.getElementById("performance-chart");

// Inicialización
document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupEventListeners();
  await loadStudyData();
  updateUI();
}

// Configurar event listeners
function setupEventListeners() {
  // Tabs
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Upload area
  uploadArea.addEventListener("click", () => fileInput.click());
  uploadArea.addEventListener("dragover", handleDragOver);
  uploadArea.addEventListener("dragleave", handleDragLeave);
  uploadArea.addEventListener("drop", handleDrop);

  // File input
  fileInput.addEventListener("change", handleFileSelect);

  // Text input
  textInput.addEventListener("input", handleTextInput);

  // Buttons
  processBtn.addEventListener("click", () => processNotes("text"));
  nextBtn.addEventListener("click", nextQuestion);
  finishBtn.addEventListener("click", finishQuiz);
}

// Cambiar de tab
function switchTab(tabName) {
  currentTab = tabName;

  // Actualizar tabs
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  // Actualizar contenido
  tabContents.forEach((content) => {
    content.classList.toggle("active", content.id === `${tabName}-tab`);
  });

  // Cargar datos específicos del tab
  if (tabName === "progress") {
    loadProgressData();
  } else if (tabName === "quiz" && processedNotes && !currentQuiz) {
    generateQuiz();
  }
}

// Manejar drag over
function handleDragOver(e) {
  e.preventDefault();
  uploadArea.classList.add("dragover");
}

// Manejar drag leave
function handleDragLeave(e) {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
}

// Manejar drop
function handleDrop(e) {
  e.preventDefault();
  uploadArea.classList.remove("dragover");

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

// Manejar selección de archivo
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
}

// Manejar archivo
async function handleFile(file) {
  try {
    if (file.type.startsWith("image/")) {
      // Procesar imagen
      const imageData = await readImageAsDataURL(file);
      await processNotes("image", imageData);
    } else if (
      file.type === "text/plain" ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md")
    ) {
      // Procesar archivo de texto
      const text = await readTextFile(file);
      textInput.value = text;
      handleTextInput();
    } else {
      showMessage(
        uploadMessage,
        "Solo se soportan archivos de texto (.txt, .md) e imágenes",
        "error"
      );
    }
  } catch (error) {
    console.error("Error handling file:", error);
    showMessage(uploadMessage, "Error al procesar el archivo", "error");
  }
}

// Leer imagen como DataURL
function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Leer archivo de texto
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Manejar input de texto
function handleTextInput() {
  const hasText = textInput.value.trim().length >= 50;
  processBtn.disabled = !hasText;
}

// Procesar notas
async function processNotes(type = "text", imageData = null) {
  try {
    processBtn.disabled = true;
    processBtn.textContent = "Processing...";

    const textContent = type === "text" ? textInput.value.trim() : null;

    if (!textContent && !imageData) {
      throw new Error("No se proporcionó contenido para procesar");
    }

    console.log("Processing notes with:", {
      type,
      textContent: textContent?.length,
      imageData: !!imageData,
    });

    const response = await sendMessage({
      action: "processNotes",
      textContent,
      imageData,
      type,
    });

    if (response.success) {
      processedNotes = response.data;
      showMessage(uploadMessage, "¡Notas procesadas exitosamente!", "success");

      // Cambiar al tab de quiz
      setTimeout(() => {
        switchTab("quiz");
        generateQuiz();
      }, 1000);
    } else {
      throw new Error(response.error || "Error al procesar las notas");
    }
  } catch (error) {
    console.error("Error processing notes:", error);
    showMessage(uploadMessage, error.message, "error");
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "Process Notes";
  }
}

// Generar quiz
async function generateQuiz() {
  try {
    if (!processedNotes) {
      showMessage(
        quizMessage,
        "No hay notas procesadas. Ve al tab Upload primero.",
        "error"
      );
      return;
    }

    quizLoading.style.display = "block";
    quizContent.style.display = "none";
    quizMessage.innerHTML = ""; // Limpiar mensajes anteriores

    const response = await sendMessage({
      action: "generateQuiz",
      processedNotes,
      options: {
        questionCount: 5,
        difficulty: "medium",
        questionTypes: ["multipleChoice", "trueFalse", "shortAnswer"],
      },
    });

    if (response.success) {
      currentQuiz = response.data;
      currentQuestionIndex = 0;
      quizAnswers = [];

      // Verificar que el quiz tenga preguntas válidas
      if (!currentQuiz.questions || currentQuiz.questions.length === 0) {
        throw new Error(
          "No se pudieron generar preguntas válidas para el quiz"
        );
      }

      showMessage(
        quizMessage,
        `¡Quiz generado exitosamente! ${currentQuiz.questions.length} preguntas listas.`,
        "success"
      );
      showQuiz();
    } else {
      throw new Error(response.error || "Error al generar el quiz");
    }
  } catch (error) {
    console.error("Error generating quiz:", error);

    // Mensajes de error más específicos
    let errorMessage = "Error al generar el quiz";
    if (error.message.includes("Writer API not available")) {
      errorMessage =
        "Las APIs de Chrome no están disponibles. Usando generación local...";
      // Intentar generar con fallback local
      setTimeout(() => {
        showMessage(
          quizMessage,
          "Generando quiz con sistema local...",
          "success"
        );
        generateQuizWithFallback();
      }, 1000);
      return;
    } else if (
      error.message.includes("No se pudieron generar preguntas válidas")
    ) {
      errorMessage =
        "No se pudieron generar preguntas. Intenta con notas más detalladas.";
    } else if (error.message.includes("No hay conceptos válidos")) {
      errorMessage =
        "Las notas no contienen conceptos suficientes. Intenta con contenido más extenso.";
    }

    showMessage(quizMessage, errorMessage, "error");
  } finally {
    quizLoading.style.display = "none";
  }
}

// Generar quiz con fallback local
async function generateQuizWithFallback() {
  try {
    // Forzar generación local sin APIs
    const response = await sendMessage({
      action: "generateQuizLocal",
      processedNotes,
      options: {
        questionCount: 5,
        difficulty: "medium",
        questionTypes: ["multipleChoice", "trueFalse", "shortAnswer"],
        forceLocal: true,
      },
    });

    if (response.success) {
      currentQuiz = response.data;
      currentQuestionIndex = 0;
      quizAnswers = [];
      showQuiz();
    } else {
      throw new Error("Error en generación local");
    }
  } catch (error) {
    console.error("Error in local quiz generation:", error);
    showMessage(quizMessage, "Error al generar el quiz localmente", "error");
  }
}

// Mostrar quiz
function showQuiz() {
  quizContent.style.display = "block";
  showQuestion();
}

// Mostrar pregunta actual
function showQuestion() {
  if (!currentQuiz || currentQuestionIndex >= currentQuiz.questions.length) {
    finishQuiz();
    return;
  }

  const question = currentQuiz.questions[currentQuestionIndex];
  const progress =
    ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;

  // Actualizar progreso
  progressFill.style.width = `${progress}%`;
  quizProgress.textContent = `Question ${currentQuestionIndex + 1} of ${
    currentQuiz.questions.length
  }`;

  // Mostrar pregunta
  quizQuestions.innerHTML = createQuestionHTML(question);

  // Configurar botones
  nextBtn.disabled = true;
  nextBtn.style.display =
    currentQuestionIndex < currentQuiz.questions.length - 1
      ? "inline-block"
      : "none";
  finishBtn.style.display =
    currentQuestionIndex >= currentQuiz.questions.length - 1
      ? "inline-block"
      : "none";

  // Configurar event listeners para opciones
  setupQuestionListeners(question);
}

// Crear HTML de pregunta
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
  } else if (question.type === "short_answer") {
    html += `<div class="options">
      <textarea class="text-input" id="short-answer" placeholder="Type your answer here..." style="min-height: 60px;"></textarea>
    </div>`;
  }

  html += "</div>";
  return html;
}

// Configurar listeners de pregunta
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
        // Remover selección anterior
        options.forEach((opt) => opt.classList.remove("selected"));

        // Seleccionar opción actual
        option.classList.add("selected");
        nextBtn.disabled = false;
      });
    });
  }
}

// Siguiente pregunta
function nextQuestion() {
  const question = currentQuiz.questions[currentQuestionIndex];
  let answer = null;

  if (question.type === "short_answer") {
    const shortAnswer = document.getElementById("short-answer");
    answer = shortAnswer ? shortAnswer.value.trim() : "";
  } else {
    const selectedOption = document.querySelector(".option.selected");
    answer = selectedOption ? selectedOption.dataset.answer : null;
  }

  if (!answer) {
    showMessage(quizMessage, "Por favor selecciona una respuesta", "error");
    return;
  }

  // Guardar respuesta
  quizAnswers.push({
    questionId: question.id,
    answer: answer,
    timeSpent: 0, // TODO: implementar timer
  });

  // Siguiente pregunta
  currentQuestionIndex++;
  showQuestion();
}

// Finalizar quiz
async function finishQuiz() {
  try {
    // Calcular puntuación
    let correctAnswers = 0;

    for (let i = 0; i < quizAnswers.length; i++) {
      const answer = quizAnswers[i];
      const question = currentQuiz.questions[i];

      const response = await sendMessage({
        action: "submitQuizAnswer",
        quizId: currentQuiz.id,
        questionId: answer.questionId,
        answer: answer.answer,
        timeSpent: answer.timeSpent,
      });

      if (response.success && response.data.isCorrect) {
        correctAnswers++;
      }
    }

    const score = Math.round((correctAnswers / quizAnswers.length) * 100);

    // Guardar quiz en el historial
    await sendMessage({
      action: "saveQuizToHistory",
      quizData: {
        id: currentQuiz.id,
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: quizAnswers.length,
        completedAt: Date.now(),
        timeSpent: quizAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0),
      },
    });

    // Mostrar resultados
    quizQuestions.innerHTML = `
      <div class="quiz-question">
        <div class="question-text">🎉 Quiz Completed!</div>
        <div style="text-align: center; margin: 20px 0;">
          <div style="font-size: 32px; font-weight: bold; color: #2563eb;">${score}%</div>
          <div style="color: #6b7280;">${correctAnswers} out of ${quizAnswers.length} correct</div>
        </div>
      </div>
    `;

    nextBtn.style.display = "none";
    finishBtn.style.display = "none";

    showMessage(
      quizMessage,
      `¡Excelente trabajo! Puntuación: ${score}%`,
      "success"
    );

    // Actualizar progreso
    await loadProgressData();
  } catch (error) {
    console.error("Error finishing quiz:", error);
    showMessage(quizMessage, "Error al finalizar el quiz", "error");
  }
}

// Cargar datos de progreso
async function loadProgressData() {
  try {
    // Cargar todas las notas
    const notesResponse = await sendMessage({
      action: "getStudyData",
      dataType: "allNotes",
    });

    // Cargar historial de quizzes
    const quizHistoryResponse = await sendMessage({
      action: "getStudyData",
      dataType: "quizHistory",
    });

    // Cargar estadísticas
    const statsResponse = await sendMessage({
      action: "getStudyData",
      dataType: "stats",
    });

    const notes = notesResponse.success ? notesResponse.data : [];
    const quizzes = quizHistoryResponse.success ? quizHistoryResponse.data : [];
    const stats = statsResponse.success ? statsResponse.data : {};

    // Actualizar estadísticas
    updateStats(notes, quizzes, stats);

    // Renderizar notas
    renderNotes(notes);

    // Renderizar historial de quizzes
    renderQuizHistory(quizzes);

    // Renderizar gráfico de rendimiento
    renderPerformanceChart(quizzes);
  } catch (error) {
    console.error("Error loading progress data:", error);
    showMessage(
      progressMessage,
      "Error al cargar datos de progreso",
      "error"
    );
  }
}

// Actualizar estadísticas
function updateStats(notes, quizzes, stats) {
  // Total de notas
  totalNotes.textContent = notes.length || 0;

  // Total de quizzes completados
  totalQuizzes.textContent = quizzes.length || 0;

  // Calcular puntuación promedio
  if (quizzes.length > 0) {
    const totalScore = quizzes.reduce((sum, quiz) => sum + quiz.score, 0);
    const avg = Math.round(totalScore / quizzes.length);
    avgScore.textContent = `${avg}%`;
  } else {
    avgScore.textContent = "0%";
  }

  // Contar conceptos únicos
  const allConcepts = new Set();
  notes.forEach((note) => {
    if (note.concepts && Array.isArray(note.concepts)) {
      note.concepts.forEach((concept) => allConcepts.add(concept));
    }
  });
  totalConcepts.textContent = allConcepts.size;
}

// Renderizar lista de notas
function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <div>No notes yet. Upload some to get started!</div>
      </div>
    `;
    notesCount.textContent = "";
    return;
  }

  notesCount.textContent = `(${notes.length})`;

  const notesHTML = notes
    .sort((a, b) => b.processedAt - a.processedAt)
    .map((note) => {
      const date = new Date(note.processedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const preview =
        note.summary ||
        note.originalText?.substring(0, 100) ||
        "No preview available";
      const concepts = note.concepts || [];
      const maxConcepts = 3;
      const displayConcepts = concepts.slice(0, maxConcepts);

      return `
        <div class="note-item" data-note-id="${note.id}">
          <div class="note-header">
            <span class="note-type">${note.type || "text"}</span>
            <span class="note-date">${date}</span>
          </div>
          <div class="note-preview">${preview}...</div>
          ${
            displayConcepts.length > 0
              ? `
            <div class="note-concepts">
              ${displayConcepts
                .map((c) => `<span class="concept-tag">${c}</span>`)
                .join("")}
              ${concepts.length > maxConcepts ? `<span class="concept-tag">+${concepts.length - maxConcepts} more</span>` : ""}
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
          </div>
        </div>
      `;
    })
    .join("");

  notesList.innerHTML = notesHTML;

  // Agregar event listeners para botones
  notesList.querySelectorAll('[data-action="relaunch"]').forEach((btn) => {
    btn.addEventListener("click", () => relaunchQuizFromNote(btn.dataset.noteId));
  });

  notesList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => deleteNote(btn.dataset.noteId));
  });
}

// Renderizar historial de quizzes
function renderQuizHistory(quizzes) {
  if (!quizzes || quizzes.length === 0) {
    quizHistory.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧠</div>
        <div>No quizzes completed yet</div>
      </div>
    `;
    quizCount.textContent = "";
    return;
  }

  quizCount.textContent = `(${quizzes.length})`;

  const quizzesHTML = quizzes
    .sort((a, b) => b.completedAt - a.completedAt)
    .map((quiz) => {
      const date = new Date(quiz.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let scoreClass = "quiz-score-poor";
      if (quiz.score >= 90) scoreClass = "quiz-score-excellent";
      else if (quiz.score >= 75) scoreClass = "quiz-score-good";
      else if (quiz.score >= 60) scoreClass = "quiz-score-fair";

      return `
        <div class="quiz-item">
          <div class="quiz-score-badge ${scoreClass}">${quiz.score}%</div>
          <div class="quiz-details">
            📅 ${date}
          </div>
          <div class="quiz-details">
            ✅ ${quiz.correctAnswers}/${quiz.totalQuestions} correct
          </div>
          ${quiz.timeSpent ? `<div class="quiz-details">⏱️ ${Math.round(quiz.timeSpent / 60)}min</div>` : ""}
        </div>
      `;
    })
    .join("");

  quizHistory.innerHTML = quizzesHTML;
}

// Renderizar gráfico de rendimiento
function renderPerformanceChart(quizzes) {
  if (!quizzes || quizzes.length === 0) {
    performanceChart.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div>Complete quizzes to see your performance</div>
      </div>
    `;
    return;
  }

  // Tomar los últimos 5 quizzes
  const recentQuizzes = quizzes
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 5)
    .reverse();

  const chartHTML = recentQuizzes
    .map((quiz, index) => {
      const label = `Quiz ${quizzes.length - index}`;
      return `
        <div class="chart-bar">
          <div class="chart-label">${label}</div>
          <div class="chart-bar-fill">
            <div class="chart-bar-value" style="width: ${quiz.score}%">
              <span class="chart-percentage">${quiz.score}%</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  performanceChart.innerHTML = chartHTML;
}

// Relanzar quiz desde una nota
async function relaunchQuizFromNote(noteId) {
  try {
    // Cargar la nota
    const response = await sendMessage({
      action: "getStudyData",
      dataType: "note",
      noteId: noteId,
    });

    if (response.success && response.data) {
      processedNotes = response.data;
      switchTab("quiz");
      generateQuiz();
    } else {
      showMessage(progressMessage, "Error al cargar la nota", "error");
    }
  } catch (error) {
    console.error("Error relaunching quiz:", error);
    showMessage(progressMessage, "Error al relanzar quiz", "error");
  }
}

// Eliminar nota
async function deleteNote(noteId) {
  if (!confirm("¿Estás seguro de que quieres eliminar esta nota?")) {
    return;
  }

  try {
    const response = await sendMessage({
      action: "deleteNote",
      noteId: noteId,
    });

    if (response.success) {
      showMessage(progressMessage, "Nota eliminada exitosamente", "success");
      await loadProgressData(); // Recargar datos
    } else {
      showMessage(progressMessage, response.error || "Error al eliminar nota", "error");
    }
  } catch (error) {
    console.error("Error deleting note:", error);
    showMessage(progressMessage, "Error al eliminar nota", "error");
  }
}

// Cargar datos de estudio
async function loadStudyData() {
  try {
    const response = await sendMessage({
      action: "getStudyData",
      dataType: "processedNotes",
    });

    if (response.success && response.data) {
      processedNotes = response.data;
    }
  } catch (error) {
    console.error("Error loading study data:", error);
  }
}

// Actualizar UI
function updateUI() {
  // Actualizar estado de botones
  handleTextInput();
}

// Mostrar mensaje
function showMessage(container, message, type) {
  container.innerHTML = `<div class="message ${type}">${message}</div>`;

  // Limpiar mensaje después de 5 segundos
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// Enviar mensaje al background script
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { success: false, error: "No response" });
    });
  });
}
