importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// This service worker waits for the main thread to provide configuration
let initialized = false;

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SET_CONFIG') {
        const config = event.data.config;
        if (!initialized && config && config.apiKey && config.apiKey !== 'REPLACE_WITH_YOUR_KEY') {
            try {
                firebase.initializeApp(config);
                const messaging = firebase.messaging();

                messaging.onBackgroundMessage((payload) => {
                    console.log('[sw] Background message received:', payload);
                    const notificationTitle = payload.notification?.title || 'New Message';
                    const notificationOptions = {
                        body: payload.notification?.body || 'You have a new message',
                        icon: payload.notification?.icon || '/icon.png',
                        data: payload.data
                    };
                    self.registration.showNotification(notificationTitle, notificationOptions);
                });

                initialized = true;
                console.log('[sw] Firebase Messaging initialized dynamically');
            } catch (error) {
                console.error('[sw] Firebase initialization failed:', error);
            }
        }
    }
});

// Fallback initialization (if values were manually replaced)
try {
    firebase.initializeApp({
        apiKey: "REPLACE_WITH_YOUR_KEY",
        authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
        projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
        storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
        messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
        appId: "REPLACE_WITH_YOUR_APP_ID",
    });
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
        // ... fallback handler
    });
} catch (e) {
    // Expected if placeholders not replaced
}
