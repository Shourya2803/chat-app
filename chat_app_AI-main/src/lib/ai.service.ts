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
    tone: ToneType = "professional",
    systemPromptOverride?: string
  ): Promise<ToneConversionResult> {
    console.log(`🤖 AI: Starting conversion for "${text.slice(0, 30)}..."`);

    // ✅ RULE-BASED FALLBACK (context-preserving where possible)
    const fallback = this.ruleBasedTransform(text);
    console.log(`🔄 Rule-Based Fallback Generated: "${fallback}"`);

    // Skip AI if no key
    if (!genAI) {
      console.warn("⚠️ AI: No API Key found, using Rule-Based fallback.");
      return { success: true, convertedText: fallback, originalText: text, tone };
    }

    const models = [
      "gemini-1.5-flash",
      "gemini-flash-latest",
    ];

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // Unified system rules with strong context-preservation + typo/grammar fixing
    const systemRules = `${systemPromptOverride ? `IMPORTANT: THE FOLLOWING ADMIN RULES TAKE ABSOLUTE PRECEDENCE OVER ALL OTHER INSTRUCTIONS:
${systemPromptOverride}
---
` : ""}

You are an executive-level corporate communications specialist embedded in an internal company messaging system.

Your goal is to rewrite messages into polished, professional business language while STRICTLY preserving the original meaning, intent, and context.

ABSOLUTE CONTEXT RULES (HIGHEST PRIORITY):
1. PRESERVE MEANING & INTENT:
   - Do NOT change the core message, intent, or context.
   - Do NOT change who is doing what to whom (no subject/object flips).
   - Do NOT remove questions, requests, complaints, or decisions.
2. PRESERVE FACTS:
   - Do NOT add new facts, promises, deadlines, or threats.
   - Do NOT remove concrete details like dates, amounts, names, links, or steps.
3. PRESERVE URGENCY:
   - Keep the same level of urgency and seriousness (no weakening or exaggerating).

TEXT QUALITY RULES (WITHOUT CHANGING MEANING):
4. Correct spelling mistakes, typos, and obvious grammatical errors.
5. Fix capitalization and punctuation where needed.
6. Do NOT change the meaning, intent, or context while correcting these.

TONE & SAFETY RULES (APPLY WITHOUT BREAKING CONTEXT ABOVE):
7. Remove or neutralize profanity, slurs, and explicit harassment.
8. If the input is aggressive or toxic, SOFTEN the wording but keep the same complaint or disagreement.
9. Use sophisticated corporate vocabulary (e.g., "help" → "support", "do" → "execute"), without changing meaning.
10. Aim to keep the rewritten message approximately the same length as the original.

CONTACT MASKING:
11. Phone numbers → "contact through this platform".
12. Emails (especially @gmail.com) → [user@mail.com](mailto:user@mail.com).

OUTPUT RULES:
- Output ONLY the final rewritten message text, with no explanations.
- Respond in the same language as the input text.
`;

    const toneInstruction: Record<ToneType, string> = {
      professional: "Use a standard professional corporate tone.",
      polite: "Use a professional tone with additional courtesy, such as 'please' and 'thank you', while keeping the same meaning and intent.",
      formal: "Use formal business language with structured and traditional phrasing, without changing the message's meaning or intent.",
      auto: "Automatically choose the most appropriate professional tone based on the input, while preserving meaning and intent.",
    };

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemRules,
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 256,
          },
          safetySettings,
        });

        console.log(`🤖 AI: Attempting conversion with ${modelName}...`);

        const prompt = `
Rewrite the following message for internal company communication.

Tone guideline:
${toneInstruction[tone]}

STRICT REQUIREMENTS:
- Keep the same meaning, intent, and context.
- Do NOT remove any questions, requests, complaints, or important details.
- Do NOT add any new information, promises, or accusations.
- Correct all spelling mistakes, typos, and basic grammar issues.
- Only change wording and tone to make it professional and clear.

Original message:
"""
${text}
"""
`;

        const result = await model.generateContent(prompt);
        const response = result.response.text()?.trim();

        if (response && response.length > 0) {
          console.log(`✅ AI SUCCESS(${modelName}): "${response}"`);
          return { success: true, convertedText: response, originalText: text, tone };
        }
      } catch (error: any) {
        console.error(`❌ AI ERROR DETAILS(${modelName}): `, JSON.stringify(error, null, 2));
        const errorMsg = error.message || error.toString();
        console.warn(`⚠️ AI: ${modelName} failed. Reason: ${errorMsg}`);

        if (errorMsg.includes("fetch") || errorMsg.includes("network")) {
          console.error(
            "🌐 CONNECTION ERROR: Server cannot reach Google Generative AI servers. Check billing, API key, or network/VPN restrictions."
          );
        }
      }
    }

    // If all models fail, use rule-based fallback
    return { success: true, convertedText: fallback, originalText: text, tone };
  }

  // Fallback tries to keep meaning while cleaning tone (no AI key or AI failure)
  private ruleBasedTransform(text: string): string {
    const isAggressive = /\b(?:shut\s+up|be\s+quiet|stop\s+talking|control\s+yourself)\b/i.test(text);
    const isToxic = /\b(?:fuck|get\s+lost|tere\s+baap|bc|mc|abe|oye|idiot|looser|loser|coward|stupid)\b/i.test(text);
    const isQuestion = /\?$/i.test(text) || /kya\b/i.test(text) || /kaun\b/i.test(text);
    const isCommand = /\b(?:kar|do|stop|shut)\b/i.test(text);

    // If toxic/aggressive: soften but keep general intent (complaint/disagreement)
    if (isToxic || isAggressive) {
      if (isQuestion) return "Could you please clarify your position?";
      if (isCommand) return "Please follow the established guidelines.";
      return "I would appreciate a more professional approach to this discussion.";
    }

    // For neutral text: light normalization, try not to change meaning
    let result = text
      .replace(/\b(yo|hey|sup|hi)\b/gi, "Hello")
      .replace(/\bwassup\b/gi, "How may I assist?")
      .replace(/\blol\b/gi, "That is noted with interest")
      .replace(/\b(brb|gtg|ttyl)\b/gi, "I will return shortly")
      .replace(/\b(dude|bro|man|mate)\b/gi, "colleague")
      .replace(/\bhelp\b/gi, "support")
      .replace(/\bassist\b/gi, "facilitate")
      .replace(/\bstart\b/gi, "commence")
      .replace(/\bdo\b/gi, "execute")
      .trim();

    // Mask phones/emails but keep rest intact
    result = result
      .replace(/\b\d{10}\b|\b(?:\+91)?[6-9]\d{9}\b/g, "contact through this platform")
      .replace(/([a-zA-Z0-9._%+-]{1,4})@gmail\.com/gi, "[user@mail.com](mailto:$1@mail.com)");

    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}

export const aiService = new AIService();
