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
    // Use environment variable or valid fallback structure (if env is missing, it will be undefined)
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL,
};

// Only initialize if we have at least an API key to avoid empty config errors
const app = (firebaseConfig.apiKey && getApps().length === 0) ? initializeApp(firebaseConfig) : (getApps().length > 0 ? getApp() : undefined);
export const db = app ? getDatabase(app) : undefined;
if (!app) console.warn('⚠️ Firebase Client not initialized (missing config)');

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
        if (typeof window === 'undefined') return null;

        const hasSupport = await isSupported().catch(() => false);
        if (!hasSupport) {
            console.warn('FCM: Messaging is not supported in this browser');
            return null;
        }

        const messaging = getFirebaseMessaging();
        if (!messaging) {
            console.error('FCM: Messaging instance could not be initialized');
            return null;
        }

        // Web Push requires permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('FCM: Notification permission not granted:', permission);
            return null;
        }

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error('FCM: NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing in environment variables');
            return null;
        }

        console.log('FCM: Requesting token...');

        // 1. Wait for Service Worker to be ready
        let registration;
        if ('serviceWorker' in navigator) {
            console.log('FCM: Waiting for Service Worker ready...');
            registration = await navigator.serviceWorker.ready;

            // 2. Send config to SW
            if (registration.active) {
                registration.active.postMessage({
                    type: 'SET_CONFIG',
                    config: firebaseConfig
                });
                console.log('FCM: Sent config to active SW');
            }
        }

        // 3. Get token with explicit registration
        const currentToken = await getToken(messaging, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: registration
        });

        if (currentToken) {
            console.log('FCM: Token generated successfully');
            return currentToken;
        } else {
            console.warn('FCM: No registration token available.');
            return null;
        }
    } catch (err: any) {
        console.error('FCM: Error retrieving token. Specific error:', err);
        if (err.code === 'messaging/permission-blocked') {
            console.error('FCM: Please unblock notifications in your browser settings.');
        } else if (err.message?.includes('vapidKey')) {
            console.error('FCM: VAPID Key mismatch or invalid format.');
        } else if (err.name === 'AbortError') {
            console.error('FCM: Registration aborted. This often means the service worker is not initialized yet or VAPID key is wrong.');
        }
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
