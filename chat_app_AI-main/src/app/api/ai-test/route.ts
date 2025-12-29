import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai.service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        console.log('🧪 AI Test: Starting diagnostic run...');
        const testText = "Quick test of the professional tone engine.";

        const result = await aiService.convertTone(testText, 'professional');

        const key = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim();

        return NextResponse.json({
            status: 'diagnostic_complete',
            input: testText,
            success: result.success,
            converted: result.convertedText || null,
            error: result.error || null,
            diagnostics: {
                has_key: !!key,
                key_suffix: key ? `...${key.slice(-4)}` : 'N/A',
                is_server: typeof window === 'undefined'
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'fatal_error',
            message: error.message,
            stack: error.stack?.split('\n')[0]
        }, { status: 500 });
    }
}
