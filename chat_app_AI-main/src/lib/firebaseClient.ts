'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getDatabase } from 'firebase/database';

let firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getDatabase(app);

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
        if (!hasSupport) return null;

        // Try to fetch config from backend if local ones are missing or placeholders
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes('your')) {
            console.log('FCM: Fetching config from backend...');
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/config/firebase`);
                const result = await response.json();
                if (result.success && result.data) {
                    firebaseConfig = { ...firebaseConfig, ...result.data };
                    console.log('FCM: Config updated from backend');
                }
            } catch (e) {
                console.warn('FCM: Failed to fetch backend config, using defaults');
            }
        }

        const messaging = getFirebaseMessaging();
        if (!messaging) return null;

        const currentToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BFu8N-9U4U8V7X7W2R8Q1A' // Fallback VAPID or fetched one
        });

        if (currentToken) {
            // Send config to service worker
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) {
                    reg.active?.postMessage({
                        type: 'SET_CONFIG',
                        config: firebaseConfig
                    });
                }
            }
            return currentToken;
        }
        return null;
    } catch (err) {
        console.error('FCM retrieval error:', err);
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
