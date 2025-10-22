// study-modules/quiz-generator.js
// QuizGenerator: Genera quizzes usando Chrome Built-in AI APIs

class QuizGenerator {
  constructor() {
    this.apiManager = null;
    this.generatedQuizzes = new Map(); // Cache de quizzes generados
    this.questionTemplates = {
      multipleChoice: {
        prompt:
          "Generate a multiple choice question with 4 options (A, B, C, D) based on this concept: {concept}. Include the correct answer marked with [CORRECT].",
        format: "multiple_choice",
      },
      trueFalse: {
        prompt:
          "Generate a true/false question based on this concept: {concept}. Mark the correct answer with [TRUE] or [FALSE].",
        format: "true_false",
      },
      shortAnswer: {
        prompt:
          "Generate a short answer question based on this concept: {concept}. Provide a brief answer key.",
        format: "short_answer",
      },
    };
  }

  // Inicializar el generador con el API Manager
  async initialize(apiManager) {
    this.apiManager = apiManager;
    console.log("QuizGenerator initialized");
  }

  // Generar quiz completo basado en conceptos procesados
  async generateQuiz(processedNotes, options = {}) {
    try {
      if (
        !processedNotes ||
        !processedNotes.concepts ||
        processedNotes.concepts.length === 0
      ) {
        throw new Error("No hay conceptos válidos para generar el quiz");
      }

      const {
        questionCount = 5,
        difficulty = "medium",
        questionTypes = ["multipleChoice", "trueFalse", "shortAnswer"],
      } = options;

      console.log("Generating quiz...", {
        concepts: processedNotes.concepts.length,
        questionCount,
        difficulty,
      });

      const quiz = {
        id: this.generateId(),
        sourceNoteId: processedNotes.id,
        title:
          `Quiz - ${processedNotes.summary?.slice(0, 50)}...` ||
          "Quiz de Estudio",
        questions: [],
        difficulty: difficulty,
        createdAt: Date.now(),
        completedAt: null,
        score: null,
      };

      // Generar preguntas para cada concepto
      const conceptsToUse = this.selectConceptsForQuiz(
        processedNotes.concepts,
        questionCount
      );

      console.log("Concepts to use for quiz:", conceptsToUse);

      for (let i = 0; i < conceptsToUse.length; i++) {
        const concept = conceptsToUse[i];
        const questionType = this.selectQuestionType(questionTypes, i);

        console.log(
          `Generating question ${
            i + 1
          } for concept: ${concept}, type: ${questionType}`
        );

        try {
          // USAR DIRECTAMENTE GENERACIÓN LOCAL - SIN APIs
          console.log(`🚀 DIRECT LOCAL GENERATION for concept: ${concept}`);
          const question = this.generateLocalQuestion(
            concept,
            questionType,
            difficulty
          );
          console.log("✅ Direct local question generated:", question);

          if (question) {
            quiz.questions.push({
              id: `q_${i + 1}`,
              ...question,
              concept: concept,
            });
          } else {
            console.warn(`No question generated for concept: ${concept}`);
          }
        } catch (error) {
          console.warn(
            `Error generating question for concept: ${concept}`,
            error
          );
          // Continuar con el siguiente concepto
        }
      }

      if (quiz.questions.length === 0) {
        throw new Error("No se pudieron generar preguntas válidas");
      }

      // Guardar en cache
      this.generatedQuizzes.set(quiz.id, quiz);

      console.log("Quiz generated successfully:", quiz);
      return quiz;
    } catch (error) {
      console.error("Error generating quiz:", error);
      throw error;
    }
  }

  // Generar quiz usando solo lógica local (sin APIs)
  async generateQuizLocal(processedNotes, options = {}) {
    try {
      if (
        !processedNotes ||
        !processedNotes.concepts ||
        processedNotes.concepts.length === 0
      ) {
        throw new Error("No hay conceptos válidos para generar el quiz");
      }

      const {
        questionCount = 5,
        difficulty = "medium",
        questionTypes = ["multipleChoice", "trueFalse", "shortAnswer"],
      } = options;

      console.log("Generating LOCAL quiz...", {
        concepts: processedNotes.concepts.length,
        questionCount,
        difficulty,
      });

      const quiz = {
        id: this.generateId(),
        sourceNoteId: processedNotes.id,
        title:
          `Quiz Local - ${processedNotes.summary?.slice(0, 50)}...` ||
          "Quiz de Estudio (Local)",
        questions: [],
        difficulty: difficulty,
        createdAt: Date.now(),
        completedAt: null,
        score: null,
        isLocal: true, // Marcar como generado localmente
      };

      // Generar preguntas para cada concepto usando solo lógica local
      const conceptsToUse = this.selectConceptsForQuiz(
        processedNotes.concepts,
        questionCount
      );

      console.log("Concepts to use for LOCAL quiz:", conceptsToUse);

      for (let i = 0; i < conceptsToUse.length; i++) {
        const concept = conceptsToUse[i];
        const questionType = this.selectQuestionType(questionTypes, i);

        console.log(
          `Generating LOCAL question ${
            i + 1
          } for concept: ${concept}, type: ${questionType}`
        );

        try {
          // USAR DIRECTAMENTE GENERACIÓN LOCAL - SIN APIs
          console.log(
            `🚀 DIRECT LOCAL GENERATION (LOCAL MODE) for concept: ${concept}`
          );
          const question = this.generateLocalQuestion(
            concept,
            questionType,
            difficulty
          );
          console.log("✅ Direct LOCAL question generated:", question);

          if (question) {
            quiz.questions.push({
              id: `q_${i + 1}`,
              ...question,
              concept: concept,
            });
          } else {
            console.warn(`No LOCAL question generated for concept: ${concept}`);
          }
        } catch (error) {
          console.warn(
            `Error generating LOCAL question for concept: ${concept}`,
            error
          );
          // Continuar con el siguiente concepto
        }
      }

      if (quiz.questions.length === 0) {
        throw new Error("No se pudieron generar preguntas válidas localmente");
      }

      // Guardar en cache
      this.generatedQuizzes.set(quiz.id, quiz);

      console.log("LOCAL Quiz generated successfully:", quiz);
      return quiz;
    } catch (error) {
      console.error("Error generating LOCAL quiz:", error);
      throw error;
    }
  }

  // Generar una pregunta individual - SOLO GENERACIÓN LOCAL
  async generateQuestion(concept, questionType, difficulty) {
    console.log(
      `🔧 GENERATING LOCAL QUESTION for concept: ${concept}, type: ${questionType}`
    );

    try {
      const localQuestion = this.generateLocalQuestion(
        concept,
        questionType,
        difficulty
      );
      console.log("✅ Generated local question:", localQuestion);
      return localQuestion;
    } catch (error) {
      console.error("❌ Error in local generation:", error);
      // Fallback de emergencia
      return {
        type: "short_answer",
        question: `Explica: ${concept}`,
        answerKey: `Respuesta relacionada con: ${concept}`,
        explanation: `Concepto: ${concept}`,
      };
    }
  }

  // Mejorar el prompt según la dificultad
  enhancePromptForDifficulty(prompt, difficulty) {
    const difficultyModifiers = {
      easy: "Make this question straightforward and basic. Use simple language.",
      medium: "Make this question moderately challenging. Include some nuance.",
      hard: "Make this question challenging and thought-provoking. Test deep understanding.",
    };

    return `${prompt}\n\nDifficulty level: ${
      difficultyModifiers[difficulty] || difficultyModifiers.medium
    }`;
  }

  // Parsear la respuesta de la API según el formato
  parseQuestionResponse(response, format, concept) {
    try {
      switch (format) {
        case "multiple_choice":
          return this.parseMultipleChoice(response, concept);
        case "true_false":
          return this.parseTrueFalse(response, concept);
        case "short_answer":
          return this.parseShortAnswer(response, concept);
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }
    } catch (error) {
      console.error("Error parsing question response:", error);
      // Fallback a pregunta simple
      return this.createFallbackQuestion(concept, format);
    }
  }

  // Parsear pregunta de opción múltiple
  parseMultipleChoice(response, concept) {
    const lines = response.split("\n").filter((line) => line.trim());
    const question =
      lines[0] || `¿Cuál es la característica principal de: ${concept}?`;

    const options = [];
    let correctAnswer = "A";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("[CORRECT]")) {
        correctAnswer = String.fromCharCode(65 + options.length); // A, B, C, D
        options.push(line.replace("[CORRECT]", "").trim());
      } else if (line.match(/^[A-D]\)/)) {
        options.push(line.substring(3).trim());
      }
    }

    // Si no hay suficientes opciones, generar fallbacks
    while (options.length < 4) {
      options.push(`Opción ${options.length + 1}`);
    }

    return {
      type: "multiple_choice",
      question: question,
      options: options.slice(0, 4),
      correctAnswer: correctAnswer,
      explanation: `Concepto: ${concept}`,
    };
  }

  // Parsear pregunta verdadero/falso
  parseTrueFalse(response, concept) {
    const lines = response.split("\n").filter((line) => line.trim());
    const question =
      lines[0] || `¿Es correcto el siguiente concepto: ${concept}?`;

    let correctAnswer = "true";
    if (response.includes("[FALSE]")) {
      correctAnswer = "false";
    }

    return {
      type: "true_false",
      question: question,
      correctAnswer: correctAnswer,
      explanation: `Concepto: ${concept}`,
    };
  }

  // Parsear pregunta de respuesta corta
  parseShortAnswer(response, concept) {
    const lines = response.split("\n").filter((line) => line.trim());
    const question = lines[0] || `Explica brevemente: ${concept}`;

    const answerKey =
      lines.slice(1).join(" ").trim() ||
      `Respuesta relacionada con: ${concept}`;

    return {
      type: "short_answer",
      question: question,
      answerKey: answerKey,
      explanation: `Concepto: ${concept}`,
    };
  }

  // Generar pregunta usando lógica local (sin APIs)
  generateLocalQuestion(concept, questionType, difficulty) {
    console.log(
      `Generating local question for concept: ${concept}, type: ${questionType}, difficulty: ${difficulty}`
    );

    const questionTemplates = this.getLocalQuestionTemplates(
      concept,
      difficulty
    );
    const template = questionTemplates[questionType];

    if (!template) {
      console.warn(`No local template for ${questionType}, using fallback`);
      return this.createFallbackQuestion(
        concept,
        this.getFormatFromType(questionType)
      );
    }

    return template;
  }

  // Obtener plantillas de preguntas locales
  getLocalQuestionTemplates(concept, difficulty) {
    const difficultyModifiers = {
      easy: {
        multipleChoice: {
          question: `¿Cuál es la definición básica de ${concept}?`,
          options: [
            `Una característica importante de ${concept}`,
            `Un proceso relacionado con ${concept}`,
            `Un ejemplo de ${concept}`,
            `Una aplicación de ${concept}`,
          ],
          correctAnswer: "A",
        },
        trueFalse: {
          question: `¿Es ${concept} un concepto importante?`,
          correctAnswer: "true",
        },
        shortAnswer: {
          question: `Define brevemente: ${concept}`,
          answerKey: `Definición relacionada con ${concept}`,
        },
      },
      medium: {
        multipleChoice: {
          question: `¿Cuál es la característica más relevante de ${concept}?`,
          options: [
            `Aspecto fundamental de ${concept}`,
            `Proceso principal en ${concept}`,
            `Beneficio clave de ${concept}`,
            `Aplicación práctica de ${concept}`,
          ],
          correctAnswer: "A",
        },
        trueFalse: {
          question: `¿${concept} requiere comprensión profunda?`,
          correctAnswer: "true",
        },
        shortAnswer: {
          question: `Explica la importancia de ${concept}`,
          answerKey: `Explicación sobre la importancia de ${concept}`,
        },
      },
      hard: {
        multipleChoice: {
          question: `¿Cuál es el aspecto más complejo de ${concept}?`,
          options: [
            `Mecanismo interno de ${concept}`,
            `Implicaciones avanzadas de ${concept}`,
            `Conexiones complejas de ${concept}`,
            `Aplicaciones especializadas de ${concept}`,
          ],
          correctAnswer: "A",
        },
        trueFalse: {
          question: `¿${concept} involucra múltiples factores interconectados?`,
          correctAnswer: "true",
        },
        shortAnswer: {
          question: `Analiza críticamente: ${concept}`,
          answerKey: `Análisis crítico de ${concept}`,
        },
      },
    };

    const modifiers =
      difficultyModifiers[difficulty] || difficultyModifiers.medium;

    return {
      multipleChoice: {
        type: "multiple_choice",
        question: modifiers.multipleChoice.question,
        options: modifiers.multipleChoice.options,
        correctAnswer: modifiers.multipleChoice.correctAnswer,
        explanation: `Concepto: ${concept} (Dificultad: ${difficulty})`,
      },
      trueFalse: {
        type: "true_false",
        question: modifiers.trueFalse.question,
        correctAnswer: modifiers.trueFalse.correctAnswer,
        explanation: `Concepto: ${concept} (Dificultad: ${difficulty})`,
      },
      shortAnswer: {
        type: "short_answer",
        question: modifiers.shortAnswer.question,
        answerKey: modifiers.shortAnswer.answerKey,
        explanation: `Concepto: ${concept} (Dificultad: ${difficulty})`,
      },
    };
  }

  // Convertir tipo de pregunta a formato
  getFormatFromType(questionType) {
    const typeMap = {
      multipleChoice: "multiple_choice",
      trueFalse: "true_false",
      shortAnswer: "short_answer",
    };
    return typeMap[questionType] || "short_answer";
  }

  // Crear pregunta de fallback si el parsing falla
  createFallbackQuestion(concept, format) {
    console.log(
      `Creating fallback question for concept: ${concept}, format: ${format}`
    );
    const fallbacks = {
      multiple_choice: {
        type: "multiple_choice",
        question: `¿Qué característica es más importante en: ${concept}?`,
        options: [
          "Característica A",
          "Característica B",
          "Característica C",
          "Característica D",
        ],
        correctAnswer: "A",
        explanation: `Concepto: ${concept}`,
      },
      true_false: {
        type: "true_false",
        question: `¿Es importante entender: ${concept}?`,
        correctAnswer: "true",
        explanation: `Concepto: ${concept}`,
      },
      short_answer: {
        type: "short_answer",
        question: `Explica: ${concept}`,
        answerKey: `Respuesta relacionada con: ${concept}`,
        explanation: `Concepto: ${concept}`,
      },
    };

    return fallbacks[format] || fallbacks.short_answer;
  }

  // Seleccionar conceptos para el quiz
  selectConceptsForQuiz(concepts, questionCount) {
    if (concepts.length <= questionCount) {
      return concepts;
    }

    // Seleccionar conceptos de manera aleatoria pero balanceada
    const shuffled = [...concepts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, questionCount);
  }

  // Seleccionar tipo de pregunta
  selectQuestionType(availableTypes, index) {
    const types = Array.isArray(availableTypes)
      ? availableTypes
      : ["multipleChoice", "trueFalse", "shortAnswer"];
    return types[index % types.length];
  }

  // Obtener quiz por ID
  getQuiz(quizId) {
    return this.generatedQuizzes.get(quizId);
  }

  // Obtener todos los quizzes generados
  getAllQuizzes() {
    return Array.from(this.generatedQuizzes.values());
  }

  // Generar ID único para quizzes
  generateId() {
    return "quiz_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  // Limpiar cache de quizzes
  clearCache() {
    this.generatedQuizzes.clear();
    console.log("QuizGenerator cache cleared");
  }

  // Obtener estadísticas del generador
  getStats() {
    const quizzes = this.getAllQuizzes();
    return {
      totalQuizzes: quizzes.length,
      totalQuestions: quizzes.reduce((sum, q) => sum + q.questions.length, 0),
      averageQuestionsPerQuiz:
        quizzes.length > 0
          ? quizzes.reduce((sum, q) => sum + q.questions.length, 0) /
            quizzes.length
          : 0,
      completedQuizzes: quizzes.filter((q) => q.completedAt).length,
      lastGenerated:
        quizzes.length > 0
          ? Math.max(...quizzes.map((q) => q.createdAt))
          : null,
    };
  }
}

// Exportar para uso en otros módulos
if (typeof module !== "undefined" && module.exports) {
  module.exports = QuizGenerator;
} else if (typeof self !== "undefined") {
  self.QuizGenerator = QuizGenerator;
}
