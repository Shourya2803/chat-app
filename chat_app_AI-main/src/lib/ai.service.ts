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

        const models = [
            "gemini-1.5-flash",
            "gemini-flash-latest"

        ];
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // 3. Process with ULTIMATE_EXECUTIVE_PROMPT
        for (const modelName of models) {
            try {
                const systemRules = `${systemPromptOverride ? `IMPORTANT: THE FOLLOWING ADMIN RULES TAKE ABSOLUTE PRECEDENCE OVER ALL OTHER INSTRUCTIONS:
${systemPromptOverride}
---
` : ''}

You are an executive-level corporate communications specialist. Your goal is to rewrite the message into polished, professional business language while STRICTLY adhering to these constraints:

CONSTRAINTS:
1. **PRESERVE MEANING**: Do NOT change the core message or intent. If someone says "hello", the result must be a greeting.
2. **LENGTH CONSISTENCY**: Keep the rewritten message approximately the same length as the original. 
3. **TOTAL REWRITE (When Needed)**: If the input is aggressive, toxic, or Hinglish slang, rewrite it completely into a calm, professional inquiry in English.
4. **VOCABULARY**: Use sophisticated corporate vocabulary (e.g., "help" → "support", "do" → "execute").
5. **CONTACT MASKING**: 
   - Phones → "contact through this platform"
   - Emails (especially @gmail.com) → [user@mail.com](mailto:user@mail.com)

RULE: Output ONLY the final professional text. NO explanations or intro text.`;

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

                const result = await model.generateContent(`REWRITE PROFESSIONALLY(PRESERVE MEANING & LENGTH): ${text} `);
                const response = result.response.text()?.trim();

                if (response && response.length > 0) {
                    console.log(`✅ AI SUCCESS(${modelName}): "${response}"`);
                    return { success: true, convertedText: response, originalText: text, tone };
                }
            } catch (error: any) {
                console.error(`❌ AI ERROR DETAILS(${modelName}): `, JSON.stringify(error, null, 2));
                const errorMsg = error.message || error.toString();
                console.warn(`⚠️ AI: ${modelName} failed.Reason: ${errorMsg} `);

                if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
                    console.error('🌐 CONNECTION ERROR: Server cannot reach Google Generative AI servers. Check billing, API key, or network/VPN restrictions.');
                }
            }
        }

        return { success: true, convertedText: fallback, originalText: text, tone };
    }

    private ruleBasedTransform(text: string): string {
        // 1. PHASE 1: DETECT TOXICITY/AGGRESSION
        const isAggressive = /\b(?:shut\s+up|be\s+quiet|stop\s+talking|control\s+yourself)\b/i.test(text);
        const isToxic = /\b(?:fuck|get\s+lost|tere\s+baap|bc|mc|abe|oye|idiot|looser|loser|coward|stupid)\b/i.test(text);
        const isQuestion = /\?$/.test(text) || text.includes('kya') || text.includes('kaun');
        const isCommand = /\b(?:kar|do|stop|shut)\b/i.test(text);

        // 2. IF TOXIC/AGGRESSIVE -> USE TOTAL SENTENCE REPLACEMENT
        if (isToxic || isAggressive) {
            if (isQuestion) return 'Could you please clarify your position?';
            if (isCommand) return 'Please follow the established guidelines.';
            return 'I would appreciate a more professional approach to this discussion.';
        }

        // 3. IF NEUTRAL -> PRESERVE MEANING & LENGTH
        let result = text
            .replace(/\b(yo|hey|sup|hi)\b/gi, 'Hello')
            .replace(/\bwassup\b/gi, 'How may I assist?')
            .replace(/\blol\b/gi, "That is noted with interest")
            .replace(/\b(brb|gtg|ttyl)\b/gi, 'I will return shortly')
            .replace(/\b(dude|bro|man|mate)\b/gi, 'colleague')
            .replace(/\bhelp\b/gi, 'support')
            .replace(/\bassist\b/gi, 'facilitate')
            .replace(/\bstart\b/gi, 'commence')
            .replace(/\bdo\b/gi, 'execute')
            .trim();

        // 3. PHONE/EMAIL MASKING (keep separate)
        // We preserve masking logic but ensure it's applied correctly if we ever append info
        result = result
            .replace(/\b\d{10}\b|\b(?:\+91)?[6-9]\d{9}\b/g, 'contact through this platform')
            .replace(/([a-zA-Z0-9._%+-]{1,4})@gmail\.com/gi, '[user@mail.com](mailto:$1@mail.com)');

        return result.charAt(0).toUpperCase() + result.slice(1);
    }
}

export const aiService = new AIService();
