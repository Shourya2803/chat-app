/**
 * AI Service - Google Gemini Integration for Next.js
 * ==================================================
 * This service handles tone conversion for chat messages using Google's Gemini AI.
 * Ported from backend to work in Next.js API routes.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY not set - AI tone conversion will be disabled');
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
    async convertTone(
        text: string,
        tone: ToneType = 'professional'
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
            const toneInstruction: Record<ToneType, string> = {
                professional: "Use a standard professional corporate tone.",
                polite: "Use a professional tone with additional courtesy such as please and thank you.",
                formal: "Use formal business language with structured and traditional phrasing.",
                auto: "Automatically choose the most appropriate professional tone based on context.",
            };

            const modelsToTry = [
                "gemini-2.0-flash-exp",
                "gemini-1.5-flash",
                "gemini-1.5-pro"
            ];
            let lastError = "";

            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });

                    const result = await model.generateContent(
                        `${SYSTEM_RULES}\n\n${toneInstruction[tone]}\n\nRewrite the following message to be more professional but maintain approximately the same length:\n\n${text}`
                    );

                    const convertedText = result.response.text()?.trim();

                    if (convertedText && convertedText.length > 0) {
                        console.log(`✅ AI: Tone conversion successful with [${modelName}]`);
                        return {
                            success: true,
                            convertedText,
                            originalText: text,
                            tone,
                        };
                    }
                } catch (err: any) {
                    lastError = err.message || "Unknown error";
                    console.warn(`⚠️ AI: Model [${modelName}] failed: ${lastError}`);

                    if (lastError.includes("429") || lastError.includes("401") || lastError.includes("403")) {
                        throw err;
                    }
                }
            }

            return {
                success: false,
                originalText: text,
                tone,
                error: `All models failed. Last error: ${lastError}`,
            };
        } catch (error: any) {
            console.error("❌ Tone conversion failed:", error.message);
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
