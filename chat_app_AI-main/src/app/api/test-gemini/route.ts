import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const rawKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');

    if (!cleanKey) {
        return NextResponse.json({
            success: false,
            error: "GEMINI_API_KEY is missing from .env.local"
        }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(cleanKey);

    try {
        // We use the experimental flash model which often has higher rate limits for free tier
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Respond with only the word 'ACTIVE' if you are working.");
        const response = result.response.text();

        return NextResponse.json({
            success: true,
            status: response.trim(),
            diagnostics: {
                key_suffix: `...${cleanKey.slice(-4)}`,
                model_used: "gemini-1.5-flash"
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            diagnostics: {
                key_suffix: `...${cleanKey.slice(-4)}`,
                full_error: error
            }
        }, { status: 500 });
    }
}
