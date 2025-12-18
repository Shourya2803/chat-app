/**
 * AI Service - Google Gemini Integration
 * =======================================
 * This service handles tone conversion for chat messages using Google's Gemini AI.
 * 
 * Supported tones:
 * - professional: Standard corporate professional tone
 * - polite: Professional with extra courtesy
 * - formal: Formal business language
 * - auto: AI chooses the best professional tone
 * 
 * BACKEND ONLY - Contains sensitive API keys
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  logger.warn('⚠️ GEMINI_API_KEY not set - AI tone conversion will be disabled');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
logger.info(`🤖 [PRO-VER: 1.7] AI Service initialized. Key present: ${!!GEMINI_API_KEY} (Prefix: ${GEMINI_API_KEY.substring(0, 4)}...)`);

export type ToneType = "professional" | "polite" | "formal" | "auto";

interface ToneConversionResult {
  success: boolean;
  convertedText?: string;
  originalText: string;
  tone: ToneType;
  error?: string;
}

const SYSTEM_RULES = `
You are an AI assistant embedded inside an internal company messaging system.

STRICT RULES:
- Remove insults, profanity, harassment, and aggressive language
- Replace them with factual, respectful phrasing
- Preserve original intent
- Do NOT invent facts, deadlines, or commitments
- Output ONLY the rewritten message text
- Never explain or reference the transformation
- Respond in the same language as the input
`;

export class AIService {
  /**
   * Count words in a text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Convert message tone using Google Gemini AI
   * Maintains approximately the same word count (90-100% of original)
   */
  async convertTone(
    text: string,
    tone: ToneType
  ): Promise<ToneConversionResult> {
    if (!GEMINI_API_KEY) {
      return {
        success: false,
        originalText: text,
        tone,
        error: 'Gemini API key not configured',
      };
    }

    try {
      const wordCount = this.countWords(text);
      const minWords = Math.floor(wordCount * 0.9); // 90% of original
      const maxWords = wordCount; // 100% of original

      const toneInstruction: Record<ToneType, string> = {
        professional: "Use a standard professional corporate tone.",
        polite:
          "Use a professional tone with additional courtesy such as please and thank you.",
        formal:
          "Use formal business language with structured and traditional phrasing.",
        auto:
          "Automatically choose the most appropriate professional tone based on context.",
      };

      // Create model with system instruction
      const modelsToTry = ["gemini-flash-latest", "gemini-1.5-flash", "gemini-pro"];
      let lastError = "";

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: SYSTEM_RULES,
          });

          logger.info(`🤖 [PRO-VER: 1.7] Trying model: ${modelName} for tone: ${tone}`);

          const result = await model.generateContent(`${toneInstruction[tone]}

IMPORTANT: The original message has ${wordCount} words. Your rewritten message MUST be between ${minWords} and ${maxWords} words (90-100% of the original length). Keep it concise and maintain the same message length.

Rewrite the following message:

${text}`);

          const response = await result.response;
          const convertedText = response.text().trim();

          if (convertedText) {
            logger.info(`✅ AI tone conversion successful with model: ${modelName}`);
            return {
              success: true,
              convertedText,
              originalText: text,
              tone,
            };
          }
        } catch (err: any) {
          lastError = err.message || "Unknown error";
          if (lastError.includes("404") || lastError.includes("not found")) {
            logger.warn(`⚠️ Model ${modelName} not found, trying next...`);
            continue;
          }
          throw err; // Re-throw other errors (like auth/quota)
        }
      }

      return {
        success: false,
        originalText: text,
        tone,
        error: `All models failed. Last error: ${lastError}`,
      };
    } catch (error: any) {
      logger.error("❌ Tone conversion failed:", {
        error: error.message,
        text: text.substring(0, 50),
      });
      return {
        success: false,
        originalText: text,
        tone,
        error: error.message,
      };
    }
  }
}

export const aiService = new AIService();
