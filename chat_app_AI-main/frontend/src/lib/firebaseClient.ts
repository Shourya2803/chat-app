'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const getFirebaseMessaging = () => {
    try {
        if (typeof window !== 'undefined' && app) {
            return getMessaging(app);
        }
    } catch (error) {
        console.error('Firebase messaging init failed:', error);
    }
    return null;
};

export const requestForToken = async () => {
    try {
        const hasSupport = await isSupported().catch(() => false);
        if (!hasSupport) {
            console.log('FCM not supported in this browser');
            return null;
        }

        const messaging = getFirebaseMessaging();
        if (!messaging) return null;

        const currentToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        });

        if (currentToken) {
            return currentToken;
        } else {
            console.log('No registration token available. Request permission to generate one.');
            return null;
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
        return null;
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        isSupported().then((hasSupport: boolean) => {
            if (hasSupport) {
                const messaging = getFirebaseMessaging();
                if (messaging) {
                    // @ts-ignore
                    onMessage(messaging, (payload) => {
                        resolve(payload);
                    });
                }
            }
        }).catch(() => console.log('FCM not allowed'));
    });
