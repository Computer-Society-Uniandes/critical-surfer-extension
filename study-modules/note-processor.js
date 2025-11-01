// study-modules/note-processor.js
// NoteProcessor: Procesa notas de estudio usando Chrome Built-in AI APIs

class NoteProcessor {
  constructor() {
    this.apiManager = null;
    this.processedNotes = new Map(); // Cache de notas procesadas
  }

  // Inicializar el procesador con el API Manager
  async initialize(apiManager) {
    this.apiManager = apiManager;
    console.log("NoteProcessor initialized");
  }

  // Procesar notas de texto usando Summarizer API
  async processTextNotes(textContent, options = {}) {
    try {
      if (!textContent || textContent.trim().length < 50) {
        throw new Error("Notes are too short. Minimum 50 characters required.");
      }

      const {
        originalText,
        sourceLanguage,
        targetLanguage,
        translation,
        metadata,
      } = options;

      const truncatedText = textContent.trim().slice(0, 6000);

      console.log("Processing text notes...", { length: truncatedText.length });

      const summary = await this.apiManager.summarizeContent(truncatedText, {
        context: metadata?.context,
        metadata,
      });

      if (!summary) {
        throw new Error("Unable to generate a summary from the notes");
      }

      // Usar Prompt API para estructurar los conceptos
      const conceptResult = await this.apiManager.extractConcepts(summary);
      const concepts = Array.isArray(conceptResult?.concepts)
        ? conceptResult.concepts
        : Array.isArray(conceptResult)
        ? conceptResult
        : [];
      const conceptInsights = conceptResult?.insights || {};

      const processedData = {
        id: this.generateId(),
        originalText: originalText || truncatedText,
        summary: summary,
        concepts: concepts,
        conceptInsights,
        processedAt: Date.now(),
        type: "text",
        sourceLanguage: sourceLanguage || "en",
        targetLanguage: targetLanguage || sourceLanguage || "en",
        translation: translation || null,
        metadata: metadata || null,
      };

      // Guardar en cache
      this.processedNotes.set(processedData.id, processedData);

      console.log("Notes processed successfully:", processedData);
      return processedData;
    } catch (error) {
      console.error("Error processing text notes:", error);
      throw error;
    }
  }

  // Procesar notas de imagen usando Prompt API multimodal
  async processImageNotes(imageData, options = {}) {
    try {
      if (!imageData) {
        throw new Error("No image was provided");
      }

      console.log("Processing image notes...");

      // Usar Prompt API multimodal para extraer texto de la imagen
      const extractedText = await this.apiManager.extractTextFromImage(
        imageData,
        options
      );

      if (!extractedText) {
        throw new Error("Unable to extract text from the image");
      }

      // Procesar el texto extraído como notas de texto
      const processedData = await this.processTextNotes(extractedText, options);
      processedData.type = "image";
      processedData.imageData = imageData;

      console.log("Image notes processed successfully:", processedData);
      return processedData;
    } catch (error) {
      console.error("Error processing image notes:", error);
      throw error;
    }
  }

  // Obtener notas procesadas por ID
  getProcessedNotes(noteId) {
    return this.processedNotes.get(noteId);
  }

  // Obtener todas las notas procesadas
  getAllProcessedNotes() {
    return Array.from(this.processedNotes.values());
  }

  // Limpiar cache de notas procesadas
  clearCache() {
    this.processedNotes.clear();
    console.log("NoteProcessor cache cleared");
  }

  // Generar ID único para las notas
  generateId() {
    return "note_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  // Validar si el texto es adecuado para procesamiento
  validateTextContent(text) {
    if (!text || typeof text !== "string") {
      return { valid: false, error: "The text must be a valid string" };
    }

    const trimmed = text.trim();
    if (trimmed.length < 50) {
      return {
        valid: false,
        error: "Notes are too short. Minimum 50 characters required.",
      };
    }

    if (trimmed.length > 50000) {
      return { valid: false, error: "The text is too long (maximum 50,000 characters)" };
    }

    return { valid: true };
  }

  // Obtener estadísticas del procesador
  getStats() {
    const notes = this.getAllProcessedNotes();
    return {
      totalNotes: notes.length,
      textNotes: notes.filter((n) => n.type === "text").length,
      imageNotes: notes.filter((n) => n.type === "image").length,
      averageConcepts:
        notes.reduce((sum, n) => sum + (n.concepts?.length || 0), 0) /
          notes.length || 0,
      lastProcessed:
        notes.length > 0 ? Math.max(...notes.map((n) => n.processedAt)) : null,
    };
  }
}

// Exportar para uso en otros módulos
if (typeof module !== "undefined" && module.exports) {
  module.exports = NoteProcessor;
} else if (typeof self !== "undefined") {
  self.NoteProcessor = NoteProcessor;
}
