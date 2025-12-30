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

        // ✅ IMMEDIATE FALLBACK (matches ULTIMATE_PROMPT rules)
        const fallback = this.ruleBasedTransform(text);
        console.log(`🔄 Rule-Based Fallback Generated: "${fallback}"`);

        // Skip AI if no key
        if (!genAI) {
            console.warn('⚠️ AI: No API Key found, using Rule-Based fallback.');
            return { success: true, convertedText: fallback, originalText: text, tone };
        }

        const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // 3. Process with ULTIMATE_PROMPT
        for (const modelName of models) {
            try {
                const systemRules = `
You are a corporate communications AI with NON-NEGOTIABLE rules that ALWAYS apply:

CRITICAL TRANSFORMATION RULES (NEVER SKIP):
1. **INSULTS → PROFESSIONAL**: 
   coward → colleague | junior → team member | idiot → associate
   stupid → uninformed | loser → peer | failure → opportunity
2. **PROFANITY → NEUTRAL**: Remove ALL swearing completely
3. **AGGRESSIVE → POLITE**: 
   "why cant you" → "could you please"
   "be under control" → "follow our guidelines"
4. **PHONES → "contact through this platform"
5. **Gmail → [XREX@mail.com](mailto:XREX@mail.com)

EXACT EXAMPLES (FOLLOW THESE):
- "hello coward junior why cant you be under control" 
  → "Hello colleague, could you please follow our guidelines?"

- "yo loser idiot call 555-1234 john@gmail.com"
  → "Hello colleague, please contact me through this platform: [john@mail.com](mailto:john@mail.com)"

RULE: Output ONLY final professional text. NO explanations.

${systemPromptOverride ? `ADDITIONAL ADMIN RULES: ${systemPromptOverride}` : ''}
`;

                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: systemRules,
                    generationConfig: {
                        temperature: 0.1,
                        topK: 1,
                        topP: 0.8,
                        maxOutputTokens: 256,
                    },
                    safetySettings
                });

                console.log(`🤖 AI: Using ULTIMATE_PROMPT on model ${modelName}`);

                const result = await model.generateContent(`ORIGINAL: ${text}`);
                const response = result.response.text()?.trim();

                if (response && response.length > 0) {
                    console.log(`✅ AI SUCCESS (${modelName}): "${response}"`);
                    return { success: true, convertedText: response, originalText: text, tone };
                }
            } catch (error: any) {
                const errorMsg = error.message || error.toString();
                console.warn(`⚠️ AI: ${modelName} failed: ${errorMsg.slice(0, 100)}...`);
            }
        }

        return { success: true, convertedText: fallback, originalText: text, tone };
    }

    /**
     * Bulletproof Regex Guardrails - Aligned with ULTIMATE_PROMPT
     */
    private ruleBasedTransform(text: string): string {
        const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{10,14}\b/g;
        const emailRegex = /[a-zA-Z0-9._%+-]+@gmail\.com/gi;
        const generalEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        let result = text
            // 1. Specific Insults
            .replace(/\bcoward\b/gi, 'colleague')
            .replace(/\bjunior\b/gi, 'team member')
            .replace(/\bidiot\b/gi, 'associate')
            .replace(/\bstupid\b/gi, 'uninformed')
            .replace(/\bloser\b/gi, 'peer')
            .replace(/\bfailure\b/gi, 'opportunity')

            // 2. Aggressive Phrases
            .replace(/why (?:cant|can't) you/gi, 'could you please')
            .replace(/be under control/gi, 'follow our guidelines')

            // 3. Contacts
            .replace(phoneRegex, 'contact through this platform')
            .replace(emailRegex, '[XREX@mail.com](mailto:XREX@mail.com)')
            .replace(generalEmailRegex, 'the professional contact channel')

            // 4. General Tone
            .replace(/\b(yo|hey|sup|wassup)\b/gi, 'Hello')
            .replace(/\b(dude|bro|man|mate)\b/gi, 'team member')
            .trim();

        if (!result) return text;

        // Ensure sentence structure
        result = result.charAt(0).toUpperCase() + result.slice(1);
        if (!/[.!?]$/.test(result)) {
            result += '.';
        }

        return result;
    }
}

export const aiService = new AIService();
