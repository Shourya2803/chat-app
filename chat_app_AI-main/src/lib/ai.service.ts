import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const rawKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');

if (!cleanKey) {
    console.error('❌ AI: GEMINI_API_KEY missing - using fallback only');
}

const genAI = cleanKey ? new GoogleGenerativeAI(cleanKey) : null;

export type ToneType = "professional" | "polite" | "formal" | "auto";

interface ToneConversionResult {
    success: boolean;
    convertedText?: string;
    originalText: string;
    tone: ToneType;
    error?: string;
}

export class AIService {
    async convertTone(
        text: string,
        tone: ToneType = 'professional',
        systemPromptOverride?: string
    ): Promise<ToneConversionResult> {
        console.log(`🤖 AI: Starting conversion for "${text.slice(0, 30)}..."`);

        // ✅ IMMEDIATE FALLBACK (works 100% locally even without internet/API)
        const fallback = this.ruleBasedTransform(text);
        console.log(`🔄 Rule-Based Fallback Generated: "${fallback}"`);

        // Skip AI if no key
        if (!genAI) {
            console.warn('⚠️ AI: No API Key found, using Rule-Based fallback.');
            return { success: true, convertedText: fallback, originalText: text, tone };
        }

        // ✅ CORRECT 2025 MODELS + EXPERIMENTAL FREE TIER
        const models = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-pro",
        ];

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // 3. Process with Models (Gemini Flash/Pro)
        for (const modelName of models) {
            try {
                const systemRules = systemPromptOverride || `Rewrite to be exceptionally professional and corporate. Output ONLY the rewritten text.`;

                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemRules, // Native system instruction for better enforcement
                    generationConfig: {
                        temperature: 0.1,
                        topK: 1,
                        topP: 0.8,
                        maxOutputTokens: 256,
                    },
                    safetySettings
                });

                console.log(`🤖 AI: Using ${systemPromptOverride ? 'CUSTOM' : 'DEFAULT'} rules on model ${modelName}`);

                const result = await model.generateContent(text); // No more rules prepended to user text
                const response = result.response.text()?.trim();

                if (response && response.length > 0) {
                    // ✅ DYNAMIC SUCCESS: If Admin provided a prompt, we trust the AI output 100%
                    // We DO NOT override with local regex if the model returned a result.
                    console.log(`✅ AI SUCCESS (${modelName}): "${response}" ${systemPromptOverride ? '[Dynamic Mode Active]' : '[Default Mode]'}`);
                    return { success: true, convertedText: response, originalText: text, tone };
                }
            } catch (error: any) {
                const errorMsg = error.message || error.toString();
                console.warn(`⚠️ AI: ${modelName} failed: ${errorMsg.slice(0, 100)}...`);

                if (errorMsg.includes('429') || errorMsg.includes('quota')) {
                    console.error('❌ AI: QUOTA EXCEEDED. Using Regex Guardrails.');
                    break;
                }
            }
        }

        // Default to our hardcoded professional rules if everything else fails
        return { success: true, convertedText: fallback, originalText: text, tone };
    }

    /**
     * Bulletproof Regex Guardrails
     * Enforces privacy protocols even if AI is offline/quota-hit.
     */
    private ruleBasedTransform(text: string): string {
        // 🛡️ REFINED DETECT AND PROTECT: Phone Numbers & Contact Details
        // Pattern 1: Structured numbers like +1 555-123-4567 or 0091-8439241516
        const structuredPhoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;

        // Pattern 2: Raw digit sequences (10-13 digits) common in mobile numbers
        const rawDigitRegex = /\b\d{10,14}\b/g;

        // Pattern 3: Common messaging obfuscation
        const waLinkRegex = /(?:wa\.me\/|whatsapp\.com\/send\?phone=)\d+/gi;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        let result = text
            .replace(structuredPhoneRegex, 'my contact details')
            .replace(rawDigitRegex, 'my direct line')
            .replace(waLinkRegex, 'the provided messaging link')
            .replace(emailRegex, 'the professional contact channel')
            // Tone transformation
            .replace(/\b(yo|hey|sup|wassup)\b/gi, 'Hello')
            .replace(/\b(looser|luser|idiot|stupid)\b/gi, 'valued colleague')
            .replace(/\b(dude|bro|man|mate)\b/gi, 'team member')
            .replace(/\blol\b/gi, 'I appreciate the humor')
            .replace(/\bbrb|gtg|ttyl|bbl\b/gi, 'I will return shortly')
            .replace(/\bu r\b/gi, 'you are')
            .replace(/\bpls\b/gi, 'please')
            .replace(/\bthx\b/gi, 'thank you')
            .replace(/\b(bad|ugly|hate|sucks)\b/gi, 'suboptimal')
            .trim();

        console.log(`🛡️ Guardrail Final Result: "${result}"`);

        // Ensure capitalization and punctuation
        if (!result) return text;
        return result.charAt(0).toUpperCase() + result.slice(1) + (/[.!?]$/.test(result) ? '' : '.');
    }
}

export const aiService = new AIService();
