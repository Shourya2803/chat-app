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
You are an executive-level corporate communications specialist. Transform ALL input into polished, professional business language following these NON-NEGOTIABLE rules:

CORE TRANSFORMATION RULES:
1. **Casual → Formal**: "yo/hey/sup" → "Hello", "wassup" → "How may I assist?"
2. **Insults → Neutral**: "coward/loser/idiot/junior" → "colleague/team member"
3. **Aggressive → Polite**: "why can't you" → "could you please", "control yourself" → "follow guidelines"
4. **Slang → Professional**: "lol" → "That's amusing", "brb/gtg" → "I'll return shortly"
5. **Profanity**: Remove completely, replace with neutral phrasing
6. **Phones**: → "contact through this platform"
7. **Emails**: user@gmail.com → [user@mail.com](mailto:user@mail.com)

BUSINESS VOCABULARY UPGRADE:
- help/assist → "support/facilitate"
- start → "commence/initiate" 
- do → "execute/implement"
- good → "excellent/outstanding"
- bad → "suboptimal/requires improvement"

TONE REQUIREMENTS:
- Always polite, respectful, collaborative
- Structured sentences with proper grammar
- Professional greetings/closings when appropriate
- Capitalize first letter, end with proper punctuation

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

                console.log(`🤖 AI: Using EXECUTIVE_PROMPT on model ${modelName}`);

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
     * Bulletproof Regex Guardrails - Aligned with EXECUTIVE_PROMPT
     */
    private ruleBasedTransform(text: string): string {
        const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{10,14}\b/g;
        const gmailRegex = /([a-zA-Z0-9._%+-]+)@gmail\.com/gi;
        const generalEmailRegex = /[a-zA-Z0-9._%+-]+@(?!(?:mail\.com))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        let result = text
            // 1. Specific Insults & common misspellings
            .replace(/\b(coward)\b/gi, 'colleague')
            .replace(/\b(loser|looser)\b/gi, 'peer')
            .replace(/\b(idiot|idiat)\b/gi, 'associate')
            .replace(/\b(junior|jr)\b/gi, 'team member')
            .replace(/\b(stupid|dumb)\b/gi, 'uninformed')
            .replace(/\b(failure)\b/gi, 'opportunity')

            // 2. Vocabulary Upgrades
            .replace(/\b(help|assist)\b/gi, 'support')
            .replace(/\b(start)\b/gi, 'commence')
            .replace(/\b(do)\b/gi, 'execute')
            .replace(/\b(good)\b/gi, 'excellent')
            .replace(/\b(bad)\b/gi, 'suboptimal')

            // 3. Aggressive Phrases
            .replace(/why (?:cant|can't) you/gi, 'could you please')
            .replace(/(?:be under control|control yourself)/gi, 'follow our guidelines')

            // 4. Slang & Casual
            .replace(/\b(yo|hey|sup)\b/gi, 'Hello')
            .replace(/\bwassup\b/gi, 'How may I assist?')
            .replace(/\blol\b/gi, "That's amusing")
            .replace(/\b(brb|gtg|ttyl)\b/gi, 'I will return shortly')
            .replace(/\b(dude|bro|man|mate)\b/gi, 'team member')

            // 5. Contacts (Special Handling for Emails to avoid double replacement)
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
