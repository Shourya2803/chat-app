import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { cloudinary } from '@/lib/cloudinary';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    console.log('📂 [UPLOAD] Request received at', new Date().toISOString());
    try {
        const { userId } = auth();
        console.log('📂 [UPLOAD] Auth User ID:', userId);
        if (!userId) {
            console.warn('📂 [UPLOAD] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        console.log('📂 [UPLOAD] Env Check:', {
            hasCloudName: !!cloudName,
            isCloudNameEmpty: cloudName === '',
            hasApiKey: !!apiKey,
            isApiKeyEmpty: apiKey === '',
            hasApiSecret: !!apiSecret,
            isApiSecretEmpty: apiSecret === '',
        });

        if (!cloudName || !apiKey || !apiSecret) {
            console.error('📂 [UPLOAD] Missing or empty Cloudinary environment variables');
            return NextResponse.json({
                error: 'Cloudinary configuration missing or incomplete',
                details: 'Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set to NON-EMPTY values in your .env file.',
                missing: {
                    cloudName: !cloudName,
                    apiKey: !apiKey,
                    apiSecret: !apiSecret
                }
            }, { status: 500 });
        }

        const formData = await req.formData();
        console.log('📂 [UPLOAD] FormData keys:', Array.from(formData.keys()));
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert file to buffer for Cloudinary
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        console.log('📂 [UPLOAD] Uploading to Cloudinary...');
        // Upload to Cloudinary
        const result: any = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'chat_app', // Consistent folder
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) {
                        console.error('📂 [UPLOAD] Cloudinary error:', error);
                        reject(error);
                    } else {
                        console.log('📂 [UPLOAD] Cloudinary success');
                        resolve(result);
                    }
                }
            );
            uploadStream.end(buffer);
        });

        console.log('📂 [UPLOAD] Saving to Media table...');
        try {
            const mediaObject = (prisma as any).media;
            if (!mediaObject) {
                console.warn('📂 [UPLOAD] prisma.media not found on client - falling back');
                throw new Error('prisma.media not initialized');
            }
            const mediaRecord = await mediaObject.create({
                data: {
                    url: result.secure_url,
                    publicId: result.public_id,
                    type: result.resource_type,
                    size: result.bytes,
                }
            });
            console.log('📂 [UPLOAD] Media record created:', mediaRecord.id);

            return NextResponse.json({
                success: true,
                data: {
                    url: result.secure_url,
                    mediaId: mediaRecord.id,
                    width: result.width,
                    height: result.height,
                    format: result.format
                },
            });
        } catch (dbError: any) {
            console.error('📂 [UPLOAD] DB error saving media:', dbError);
            // Even if DB save fails, we return the URL so the chat can continue
            return NextResponse.json({
                success: true,
                data: {
                    url: result.secure_url,
                },
            });
        }
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload image', details: error.message },
            { status: 500 }
        );
    }
}
