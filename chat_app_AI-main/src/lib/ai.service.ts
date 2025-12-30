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

        const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // 3. Process with ULTIMATE_EXECUTIVE_PROMPT
        for (const modelName of models) {
            try {
                const systemRules = `
You are an executive-level corporate communications specialist. Your goal is to preserve the *intent* of the message while completely purging all unprofessionalism, aggression, and informalities.

CRITICAL INSTRUCTIONS:
1. **TOTAL REWRITE REQUIRED**: Rewrite the entire message into polished, professional English business language.
2. **MULTI-LANGUAGE & SLANG**: If the input is in Hinglish (e.g., "Abe oye", "tere baap ka"), Hindi, or contains regional slang, convert the entire message into standard, high-level English business correspondence.
3. **TONE & VOCABULARY**: Use sophisticated corporate vocabulary. 
4. **INSULT TRANSFORMATION**: Purge all insults. 
   - "coward/loser/idiot/junior" → "colleague/team member"
5. **CONTACT MASKING**: 
   - Phones → "contact through this platform"
   - Emails (especially @gmail.com) → [user@mail.com](mailto:user@mail.com)
6. **BUSINESS UPGRADES**:
   - help/assist → "support/facilitate" | start → "commence/initiate" | do → "execute/implement" | good → "excellent" | bad → "suboptimal"

RULE: Output ONLY the final professional English text. NO explanations or intro text.

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

                console.log(`🤖 AI: Attempting conversion with ${modelName}...`);

                const result = await model.generateContent(`REWRITE THIS PROFESSIONALLY IN ENGLISH: ${text}`);
                const response = result.response.text()?.trim();

                if (response && response.length > 0) {
                    console.log(`✅ AI SUCCESS (${modelName}): "${response}"`);
                    return { success: true, convertedText: response, originalText: text, tone };
                }
            } catch (error: any) {
                console.error(`❌ AI ERROR DETAILS (${modelName}):`, JSON.stringify(error, null, 2));
                const errorMsg = error.message || error.toString();
                console.warn(`⚠️ AI: ${modelName} failed. Reason: ${errorMsg}`);

                if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
                    console.error('🌐 CONNECTION ERROR: Server cannot reach Google Generative AI servers. Check billing, API key, or network/VPN restrictions.');
                }
            }
        }

        return { success: true, convertedText: fallback, originalText: text, tone };
    }

    private ruleBasedTransform(text: string): string {
        // 1. DETECT INTENT FIRST
        const isAggressive = /\b(?:shut|fuck|get\s+lost|tere\s+baap|bc|mc|abe|oye)\b/i.test(text);
        const isQuestion = /\?$/.test(text) || text.includes('kya') || text.includes('kaun');
        const isCommand = /\b(?:kar|do|stop|shut)\b/i.test(text);

        let professionalTone = '';

        // 2. INTENT → PROFESSIONAL STRUCTURE
        if (isAggressive) {
            professionalTone = 'Could you please clarify your position?';
        } else if (isQuestion) {
            professionalTone = 'Could you please provide more details?';
        } else if (isCommand) {
            professionalTone = 'Please follow the established guidelines.';
        } else {
            professionalTone = 'Thank you for your input. Let me review this.';
        }

        // 3. PHONE/EMAIL MASKING (keep separate)
        // We preserve masking logic but ensure it's applied correctly if we ever append info
        professionalTone = professionalTone
            .replace(/\b\d{10}\b|\b(?:\+91)?[6-9]\d{9}\b/g, 'contact through this platform')
            .replace(/([a-zA-Z0-9._%+-]{1,4})@gmail\.com/gi, '[user@mail.com](mailto:$1@mail.com)');

        return professionalTone.charAt(0).toUpperCase() + professionalTone.slice(1);
    }
}

export const aiService = new AIService();
