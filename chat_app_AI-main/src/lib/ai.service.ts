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
You are an executive-level corporate communications specialist. Your goal is to preserve the *intent* of the message while completely purging all unprofessionalism, aggression, and informalities.

CRITICAL INSTRUCTIONS:
1. **TOTAL REWRITE REQUIRED**: Do NOT just swap words. If a sentence is aggressive (e.g., "Are you out of your mind?"), rewrite the ENTIRE sentence to be a professional inquiry (e.g., "I would appreciate some clarification on this approach.").
2. **PURGE INSULTS**: Completely remove or transform insults into professional identifiers (e.g., "idiot" -> "colleague").
3. **TONE SHIFT**: Change "Why can't you..." to "I would appreciate it if you could...".
4. **NO AGGRESSION**: If the original is angry, the result must be calm, measured, and corporate.
5. **EMAILS/PHONES**: Mask as: [XREX@mail.com](mailto:XREX@mail.com) and "contact through this platform".

BUSINESS VOCABULARY:
- help -> support | start -> commencement | do -> execute | bad -> suboptimal

RULE: Output ONLY the final professional text. No explanations.

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

                console.log(`🤖 AI: Using ULTIMATE_EXECUTIVE_PROMPT on model ${modelName}`);

                const result = await model.generateContent(`ORIGINAL MESSAGE TO REWRITE: ${text}`);
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
     * Bulletproof Regex Guardrails - Aligned with EXECUTIVE_PROMPT
     * Handles common aggressive phrases and concatenated insults.
     */
    private ruleBasedTransform(text: string): string {
        const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{10,14}\b/g;
        const gmailRegex = /([a-zA-Z0-9._%+-]+)@gmail\.com/gi;
        const generalEmailRegex = /[a-zA-Z0-9._%+-]+@(?!(?:mail\.com))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        let result = text
            // 1. Specific Aggressive Phrases (TOTAL REPLACEMENT)
            .replace(/are you (?:out of your mind|crazy|insane|stupid|idiat|idiot)/gi, 'could we please re-evaluate this approach?')
            .replace(/what the (?:hell|fuck|fck|heck)/gi, 'I am concerned about')
            .replace(/control yourself/gi, 'maintain professional standards')

            // 2. Insults & common misspellings (including concatenated like 'helloidiot')
            .replace(/\b(?:hello|hey)?(?:idiot|idiat|coward|loser|looser|junior|jr)\b/gi, 'colleague')
            .replace(/\b(stupid|dumb)\b/gi, 'uninformed')
            .replace(/\b(failure)\b/gi, 'opportunity')

            // 3. Vocabulary Upgrades
            .replace(/\b(help|assist)\b/gi, 'support')
            .replace(/\b(start)\b/gi, 'commence')
            .replace(/\b(do)\b/gi, 'execute')
            .replace(/\b(good)\b/gi, 'excellent')
            .replace(/\b(bad)\b/gi, 'suboptimal')

            // 4. Aggressive Phrases
            .replace(/why (?:cant|can't) you/gi, 'could you please')

            // 5. Slang & Casual
            .replace(/\b(yo|hey|sup)\b/gi, 'Hello')
            .replace(/\bwassup\b/gi, 'How may I assist?')
            .replace(/\blol\b/gi, "That's amusing")
            .replace(/\b(brb|gtg|ttyl)\b/gi, 'I will return shortly')
            .replace(/\b(dude|bro|man|mate)\b/gi, 'team member')

            // 6. Contacts
            .replace(phoneRegex, 'contact through this platform')
            .replace(gmailRegex, '[$1@mail.com](mailto:$1@mail.com)')
            .replace(generalEmailRegex, 'the professional contact channel')
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
