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
- Rewrite the message to be strictly professional, corporate, and formal
- Remove casual slang, abbreviations, and informalities
- If the message is already professional, enhance its vocabulary to be more sophisticated
- Remove insults, profanity, harassment, and aggressive language
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

            // ✅ CORRECT MODELS (Confirmed via API list)
            // The user's key only has access to these specific newer/experimental models
            const modelsToTry = [
                "gemini-flash-latest",
                "gemini-2.0-flash",
                "gemini-pro-latest"
            ];

            let lastError = "";

            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });

                    console.log(`🤖 AI: Trying model: ${modelName}`);

                    // ✅ FIXED: Proper content array format
                    const result = await model.generateContent({
                        contents: [{
                            role: "user",
                            parts: [{
                                text: `${SYSTEM_RULES}

${toneInstruction[tone]}

ORIGINAL MESSAGE:
${text}`
                            }]
                        }]
                    });

                    // ✅ FIXED: Correct response extraction
                    const responseText = result.response.text();
                    const convertedText = responseText?.trim();

                    console.log(`📝 AI Response raw: "${responseText?.substring(0, 100)}..."`);

                    if (convertedText && convertedText.length > 0) {
                        console.log(`✅ AI: SUCCESS with [${modelName}] → "${convertedText}"`);
                        return {
                            success: true,
                            convertedText,
                            originalText: text,
                            tone,
                        };
                    }
                } catch (err: any) {
                    lastError = err.message || "Unknown error";
                    console.warn(`⚠️ AI: [${modelName}] FAILED: ${lastError}`);

                    if (lastError.includes("429") || lastError.includes("401") || lastError.includes("403")) {
                        throw err;
                    }
                }
            }

            console.error(`❌ All models failed. Last error: ${lastError}`);
            return {
                success: false,
                originalText: text,
                tone,
                error: `All models failed: ${lastError}`,
            };

        } catch (error: any) {
            console.error("❌ CRITICAL AI failure:", error);
            return {
                success: false,
                originalText: text,
                tone,
                error: error.message || "Unknown error",
            };
        }
    }
}

export const aiService = new AIService();
