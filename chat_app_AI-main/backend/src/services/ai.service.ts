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
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
        systemInstruction: SYSTEM_RULES,
      });

      const result = await model.generateContent(`${toneInstruction[tone]}

IMPORTANT: The original message has ${wordCount} words. Your rewritten message MUST be between ${minWords} and ${maxWords} words (90-100% of the original length). Keep it concise and maintain the same message length.

Rewrite the following message:

"""
${text}
"""`);

      const convertedText = result.response.text()?.trim();

      if (!convertedText) {
        throw new Error("Empty response from AI");
      }

      const convertedWordCount = this.countWords(convertedText);
      logger.info(`✅ Tone conversion successful (${tone}) - Original: ${wordCount} words → Converted: ${convertedWordCount} words`);

      return {
        success: true,
        convertedText,
        originalText: text,
        tone,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown AI conversion error";
      
      logger.error("❌ Tone conversion failed:", errorMessage);

      return {
        success: false,
        originalText: text,
        tone,
        error: errorMessage,
      };
    }
  }
}

export const aiService = new AIService();
