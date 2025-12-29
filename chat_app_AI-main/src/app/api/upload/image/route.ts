import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { cloudinary } from '@/lib/cloudinary';
import { getAdminFirestore } from '@/lib/firebase-admin';

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

        if (!cloudName || !apiKey || !apiSecret) {
            console.error('📂 [UPLOAD] Missing Cloudinary environment variables');
            return NextResponse.json({ error: 'Cloudinary configuration missing' }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert file to buffer for Cloudinary
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        console.log('📂 [UPLOAD] Uploading to Cloudinary...');
        const result: any = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'chat_app',
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(buffer);
        });

        console.log('📂 [UPLOAD] Saving to Firestore (Migrated from Prisma)...');
        try {
            const db = await getAdminFirestore();
            const mediaRef = await db.collection('media').add({
                url: result.secure_url,
                publicId: result.public_id,
                type: result.resource_type,
                size: result.bytes,
                uploaderId: userId,
                createdAt: new Date().toISOString(),
            });
            console.log('📂 [UPLOAD] Media record created in Firestore:', mediaRef.id);

            return NextResponse.json({
                success: true,
                data: {
                    url: result.secure_url,
                    mediaId: mediaRef.id,
                    width: result.width,
                    height: result.height,
                    format: result.format
                },
            });
        } catch (dbError: any) {
            console.error('📂 [UPLOAD] Firestore error saving media:', dbError);
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
