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
        throw new Error("No valid concepts are available to build the quiz.");
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
          "Study Quiz",
        questions: [],
        difficulty: difficulty,
        createdAt: Date.now(),
        completedAt: null,
        score: null,
      };

      const insightsMap = processedNotes.conceptInsights || {};

      const conceptsToUse = this.selectConceptsForQuiz(
        processedNotes.concepts,
        questionCount
      );

      console.log("Concepts to use for quiz:", conceptsToUse);

      for (let i = 0; i < conceptsToUse.length; i++) {
        const concept = conceptsToUse[i];
        const conceptInsight = insightsMap[concept] || insightsMap[concept?.trim()] || null;
        const questionType = this.selectQuestionType(questionTypes, i);

        console.log(
          `Generating question ${
            i + 1
          } for concept: ${concept}, type: ${questionType}`
        );

        try {
          console.log(`🚀 AI-POWERED GENERATION for concept: ${concept}`);
          const question = await this.generateQuestion(
            concept,
            questionType,
            difficulty,
            conceptInsight
          );
          console.log("✅ AI question generated:", question);

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
        }
      }

      if (quiz.questions.length === 0) {
        throw new Error("No valid questions could be generated.");
      }

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
        throw new Error("No valid concepts are available to build the quiz.");
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
          `Local Quiz - ${processedNotes.summary?.slice(0, 50)}...` ||
          "Study Quiz (Local)",
        questions: [],
        difficulty: difficulty,
        createdAt: Date.now(),
        completedAt: null,
        score: null,
        isLocal: true, // Mark as generated locally
      };

      const insightsMap = processedNotes.conceptInsights || {};

      // Generar preguntas para cada concepto usando solo lógica local
      const conceptsToUse = this.selectConceptsForQuiz(
        processedNotes.concepts,
        questionCount
      );

      console.log("Concepts to use for LOCAL quiz:", conceptsToUse);

      for (let i = 0; i < conceptsToUse.length; i++) {
        const concept = conceptsToUse[i];
        const conceptInsight = insightsMap[concept] || insightsMap[concept?.trim()] || null;
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
            difficulty,
            conceptInsight
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
        throw new Error("Unable to generate valid questions locally");
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

  // Generar una pregunta individual usando Chrome Built-in AI
  async generateQuestion(concept, questionType, difficulty, conceptInsight) {
    console.log(
      `🚀 GENERATING AI-POWERED QUESTION for concept: ${concept}, type: ${questionType}`
    );

    try {
      if (this.apiManager && this.apiManager.languageModelSession) {
        console.log("Using Language Model API for question generation");
        const aiQuestion = await this.generateQuestionWithAIInternal(
          concept,
          questionType,
          difficulty,
          conceptInsight
        );
        if (aiQuestion) {
          console.log("✅ AI question generated:", aiQuestion);
          return aiQuestion;
        }
      }

      console.log("Falling back to local question generation");
      const localQuestion = this.generateLocalQuestion(
        concept,
        questionType,
        difficulty,
        conceptInsight
      );
      console.log("✅ Local question generated:", localQuestion);
      return localQuestion;
    } catch (error) {
      console.error("❌ Error in question generation:", error);
      return {
        type: "short_answer",
        question: `Explain the core idea behind ${concept}.`,
        answerKey: conceptInsight?.keyFact || `Describe why ${concept} matters in this context.`,
        explanation: conceptInsight?.questionCue || `Concept focus: ${concept}`,
      };
    }
  }

  async generateQuestionWithAI(concept, questionType, difficulty) {
    console.log(
      `🚀 GENERATING AI-POWERED QUESTION for concept: ${concept}, type: ${questionType}`
    );

    try {
      if (this.apiManager && this.apiManager.languageModelSession) {
        console.log("Using Language Model API for question generation");
        const aiQuestion = await this.generateQuestionWithAIInternal(
          concept,
          questionType,
          difficulty
        );
        if (aiQuestion) {
          console.log("✅ AI question generated:", aiQuestion);
          return aiQuestion;
        }
      }

      console.log("Falling back to local question generation");
      const localQuestion = this.generateLocalQuestion(
        concept,
        questionType,
        difficulty
      );
      console.log("✅ Local question generated:", localQuestion);
      return localQuestion;
    } catch (error) {
      console.error("❌ Error in question generation:", error);
      return {
        type: "short_answer",
        question: `Explain why ${concept} matters in this context.`,
        answerKey: `Describe the impact or importance of ${concept}.`,
        explanation: `Concept focus: ${concept}`,
      };
    }
  }

  async generateQuestionWithAIInternal(concept, questionType, difficulty, conceptInsight) {
    try {
      const contextLine = conceptInsight?.keyFact
        ? `Key fact: ${conceptInsight.keyFact}.`
        : "";
      const cueLine = conceptInsight?.questionCue
        ? `Assessment focus: ${conceptInsight.questionCue}.`
        : "";

      const prompts = {
        multipleChoice: `You are an instructional designer preparing mastery quizzes for advanced learners.

Create a challenging multiple-choice question (four options labelled A–D) about "${concept}".
${contextLine}
${cueLine}
- The question must require comprehension or application, not recall.
- Provide one correct option and three plausible distractors.
- Respond strictly in English.

Return your answer as JSON with keys:
{
  "question": string,
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correctAnswer": "A/B/C/D",
  "explanation": "Why the answer is correct"
}
Do not include any additional commentary.`,

        trueFalse: `You are an instructional designer preparing mastery quizzes for advanced learners.

Using the following insight, create a precise true/false statement about "${concept}" that tests understanding, not trivia.
${contextLine}
${cueLine}
- Respond strictly in English.

Return JSON with keys:
{
  "question": string,
  "correctAnswer": "true" | "false",
  "explanation": string
}`,

        shortAnswer: `You are an instructional designer preparing mastery quizzes for advanced learners.

Write a short-answer question about "${concept}" that prompts a thoughtful response.
${contextLine}
${cueLine}
- Provide a concise answer key highlighting the expected ideas.
- Respond strictly in English.

Return JSON with keys:
{
  "question": string,
  "answerKey": string,
  "explanation": string
}`,
      };

      const prompt = prompts[questionType] || prompts.multipleChoice;
      const response = await this.apiManager.languageModelSession.prompt(prompt);

      const cleanResponse = response.trim().replace(/```json\n?|```/g, "");
      const parsedQuestion = JSON.parse(cleanResponse);

      return {
        type: this.convertQuestionType(questionType),
        ...parsedQuestion,
      };
    } catch (error) {
      console.error("Error generating AI question:", error);
      return null;
    }
  }

  // Convert question type format
  convertQuestionType(type) {
    const typeMap = {
      multipleChoice: "multiple_choice",
      trueFalse: "true_false",
      shortAnswer: "short_answer",
    };
    return typeMap[type] || type;
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
          throw new Error(`Unsupported format: ${format}`);
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
      lines[0] || `What is the most relevant attribute of: ${concept}?`;

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

    // If we still lack enough choices, pad with generic distractors
    while (options.length < 4) {
      options.push(`Option ${options.length + 1}`);
    }

    return {
      type: "multiple_choice",
      question: question,
      options: options.slice(0, 4),
      correctAnswer: correctAnswer,
      explanation: `Concept focus: ${concept}`,
    };
  }

  // Parse true/false question
  parseTrueFalse(response, concept) {
    const lines = response.split("\n").filter((line) => line.trim());
    const question =
      lines[0] || `Is the following statement about ${concept} accurate?`;

    let correctAnswer = "true";
    if (response.includes("[FALSE]")) {
      correctAnswer = "false";
    }

    return {
      type: "true_false",
      question: question,
      correctAnswer: correctAnswer,
      explanation: `Concept focus: ${concept}`,
    };
  }

  // Parsear pregunta de respuesta corta
  parseShortAnswer(response, concept) {
    const lines = response.split("\n").filter((line) => line.trim());
    const question = lines[0] || `Explain briefly: ${concept}`;

    const answerKey =
      lines.slice(1).join(" ").trim() ||
      `Answer related to: ${concept}`;

    return {
      type: "short_answer",
      question: question,
      answerKey: answerKey,
      explanation: `Concept focus: ${concept}`,
    };
  }

  // Generar pregunta usando lógica local (sin APIs)
  generateLocalQuestion(concept, questionType, difficulty, conceptInsight) {
    console.log(
      `Generating local question for concept: ${concept}, type: ${questionType}, difficulty: ${difficulty}`
    );

    const detail = conceptInsight?.keyFact || `Understand the relevance of ${concept}.`;
    const cue = conceptInsight?.questionCue || `Explain why ${concept} matters.`;

    const questionTemplates = this.getLocalQuestionTemplates(
      concept,
      detail,
      cue,
      difficulty
    );
    const template = questionTemplates[questionType];

    if (!template) {
      console.warn(`No local template for ${questionType}, using fallback`);
      return this.createFallbackQuestion(
        concept,
        detail,
        cue,
        this.getFormatFromType(questionType)
      );
    }

    return template;
  }

  // Obtener plantillas de preguntas locales
  getLocalQuestionTemplates(concept, detail, cue, difficulty) {
    const difficultyModifiers = {
      easy: {
        multipleChoice: {
          question: `Which statement best reflects the idea of ${concept}?`,
          options: [
            detail,
            `An unrelated fact about ${concept}.`,
            `A vague opinion on ${concept}.`,
            `A misinterpretation of ${concept}.`,
          ],
          correctAnswer: "A",
        },
        trueFalse: {
          question: `${detail}`,
          correctAnswer: "true",
        },
        shortAnswer: {
          question: `Summarize the idea behind ${concept}.`,
          answerKey: detail,
        },
      },
      medium: {
        multipleChoice: {
          question: `What best captures the role of ${concept}?`,
          options: [
            detail,
            `A superficial benefit of ${concept}.`,
            `A secondary topic unrelated to ${concept}.`,
            `A historical remark about ${concept}.`,
          ],
          correctAnswer: "A",
        },
        trueFalse: {
          question: `${detail}`,
          correctAnswer: "true",
        },
        shortAnswer: {
          question: `Explain why ${concept} matters according to the text.`,
          answerKey: `${detail} ${cue}`,
        },
      },
      hard: {
        multipleChoice: {
          question: `Which option reflects the deeper significance of ${concept}?`,
          options: [
            `${detail} ${cue}`,
            `A generic description of ${concept}.`,
            `An advantage unrelated to ${concept}.`,
            `A short-term effect not tied to ${concept}.`,
          ],
          correctAnswer: "A",
        },
        trueFalse: {
          question: `${cue}`,
          correctAnswer: "true",
        },
        shortAnswer: {
          question: `Discuss the impact of ${concept} in your own words.`,
          answerKey: `${detail} ${cue}`,
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
        explanation: detail,
      },
      trueFalse: {
        type: "true_false",
        question: modifiers.trueFalse.question,
        correctAnswer: modifiers.trueFalse.correctAnswer,
        explanation: detail,
      },
      shortAnswer: {
        type: "short_answer",
        question: modifiers.shortAnswer.question,
        answerKey: modifiers.shortAnswer.answerKey,
        explanation: detail,
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
  createFallbackQuestion(concept, detail, cue, format) {
    console.log(
      `Creating fallback question for concept: ${concept}, format: ${format}`
    );
    const fallbackDetail = detail || `Explain the significance of ${concept}.`;
    const fallbacks = {
      multiple_choice: {
        type: "multiple_choice",
        question: `Which best summarizes ${concept}?`,
        options: [
          fallbackDetail,
          `A misconception about ${concept}.`,
          `An unrelated idea to ${concept}.`,
          `A vague statement about ${concept}.`,
        ],
        correctAnswer: "A",
        explanation: fallbackDetail,
      },
      true_false: {
        type: "true_false",
        question: `${fallbackDetail}`,
        correctAnswer: "true",
        explanation: fallbackDetail,
      },
      short_answer: {
        type: "short_answer",
        question: `Explain why ${concept} matters.`,
        answerKey: `${fallbackDetail} ${cue || ""}`.trim(),
        explanation: fallbackDetail,
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
