import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { logger } from "../utils/logger";

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

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
  async convertTone(
    text: string,
    tone: ToneType
  ): Promise<ToneConversionResult> {
    try {
      const toneInstruction: Record<ToneType, string> = {
        professional: "Use a standard professional corporate tone.",
        polite:
          "Use a professional tone with additional courtesy such as please and thank you.",
        formal:
          "Use formal business language with structured and traditional phrasing.",
        auto:
          "Automatically choose the most appropriate professional tone based on context.",
      };

      // Create model with system instruction (using v1 API compatible model)
      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        systemInstruction: SYSTEM_RULES,
      });

      const result = await model.generateContent(`${toneInstruction[tone]}

Rewrite the following message:

"""
${text}
"""`);

      const convertedText = result.response.text()?.trim();

      if (!convertedText) {
        throw new Error("Empty response from AI");
      }

      return {
        success: true,
        convertedText,
        originalText: text,
        tone,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown AI conversion error";
      
      logger.error("Tone conversion failed", error);
      console.error("❌ Gemini API Error:", errorMessage);
      console.log("⚠️  Falling back to original message without tone conversion");

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
