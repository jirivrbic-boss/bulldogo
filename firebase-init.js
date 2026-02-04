// Centralizovaná inicializace Firebase pro celý frontend
// Načítá oficiální SDK moduly z gstatic a publikuje app/auth/db na window

console.log('🔥 firebase-init.js: Začínám načítat Firebase...');

// Pro localhost úplně vypínáme App Check - neaktivujeme debug token, protože API není povoleno
// App Check není potřeba pro lokální vývoj

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';
// App Check importujeme dynamicky pouze pro produkci

console.log('✅ Firebase moduly načteny');

// Firebase konfigurace (sjednocená)
const firebaseConfig = {
    apiKey: "AIzaSyA1FEmsY458LLKQLGcUaOVXsYr3Ii55QeQ",
    authDomain: "inzerio-inzerce.firebaseapp.com",
    projectId: "inzerio-inzerce",
    // Storage bucket (nový formát .firebasestorage.app)
    storageBucket: "inzerio-inzerce.firebasestorage.app",
    messagingSenderId: "262039290071",
    appId: "1:262039290071:web:30af0eb1c65cd75e307092",
    measurementId: "G-7VD0ZE08M3"
};

try {
    // Zajistit, že inicializujeme jen jednou na stránce
    let app;
    if (getApps().length) {
        app = getApps()[0];
        console.log('✅ Použil jsem existující Firebase app');
    } else {
        app = initializeApp(firebaseConfig);
        console.log('✅ Vytvořil jsem novou Firebase app');
    }

    const auth = getAuth(app);
    console.log('✅ Firebase Auth inicializován');

    let db;
    try {
        // Stabilnější v prohlížečích a na některých doménách (Safari/ITP/CORS)
        // Vynutit long‑polling místo WebChannel/fetch streams kvůli „Listen/channel … access control checks“
        db = initializeFirestore(app, { experimentalForceLongPolling: true, useFetchStreams: false });
        console.log('✅ Firebase Firestore inicializován s experimentalAutoDetectLongPolling');
    } catch (err) {
        console.warn('⚠️ Experimental Firestore inicializace selhala, používám standardní:', err);
        db = getFirestore(app);
        console.log('✅ Firebase Firestore inicializován standardně');
    }

    // App Check - VYPNUTO pro všechny prostředí (lokální i produkce)
    // App Check může způsobovat CORS problémy, pokud není správně nakonfigurovaný
    // Pokud potřebuješ App Check, musíš ho aktivovat v Firebase Console a nastavit reCAPTCHA
    console.log('⚠️ App Check vypnut - pokud máš CORS problémy, zkontroluj Firebase Console → App Check a vypni "Enforce App Check"');
    
    // Pokud v budoucnu budeš chtít App Check aktivovat:
    // 1. Firebase Console → App Check → nastav reCAPTCHA V3 Site Key
    // 2. Přidej do HTML: <script>window.FIREBASE_RECAPTCHA_V3_SITE_KEY = 'tvuj-site-key';</script>
    // 3. Odkomentuj kód níže
    /*
    if (typeof window !== 'undefined' && window.location && !window.location.hostname.includes('localhost')) {
        const siteKey = window.FIREBASE_RECAPTCHA_V3_SITE_KEY || '';
        if (siteKey) {
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js')
                .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
                    const appCheck = initializeAppCheck(app, {
                        provider: new ReCaptchaV3Provider(siteKey),
                        isTokenAutoRefreshEnabled: true,
                    });
                    window.firebaseAppCheck = appCheck;
                    console.log('✅ Firebase App Check inicializován (produkce)');
                })
                .catch((err) => {
                    console.warn('⚠️ App Check není k dispozici nebo selhala inicializace:', err);
                });
        }
    }
    */

    // Storage inicializace
    let storage;
    try {
        storage = getStorage(app);
        console.log('✅ Firebase Storage inicializován', {
            bucket: app.options.storageBucket || 'není nastaven',
            storage: !!storage
        });
    } catch (err) {
        console.error('❌ Chyba při inicializaci Storage:', err);
        console.warn('⚠️ Storage možná není povolené v projektu Firebase');
    }

    // Analytics (bezpečně; v některých prostředích nemusí být k dispozici)
    let analytics;
    try { 
        analytics = getAnalytics(app);
        console.log('✅ Firebase Analytics inicializován');
    } catch (err) {
        console.warn('⚠️ Analytics není k dispozici:', err);
    }

    // Publikovat globálně pro stávající kód
    window.firebaseApp = app;
    window.firebaseAuth = auth;
    window.firebaseDb = db;
    if (storage) window.firebaseStorage = storage;
    if (analytics) window.firebaseAnalytics = analytics;

    // Signalizovat, že Firebase je připraven
    window.firebaseReady = true;

    // Vyslat event, že Firebase je připraven (pro event-driven přístup)
    // Kompatibilita napříč prohlížeči - použít CustomEvent pokud je dostupné
    try {
        if (typeof window.dispatchEvent !== 'undefined') {
            // Použít CustomEvent pro lepší kompatibilitu
            const event = typeof CustomEvent !== 'undefined' 
                ? new CustomEvent('firebaseReady', { bubbles: false, cancelable: false })
                : (() => {
                    // Fallback pro starší prohlížeče
                    const evt = document.createEvent('Event');
                    evt.initEvent('firebaseReady', false, false);
                    return evt;
                })();
            window.dispatchEvent(event);
            console.log('📢 Event firebaseReady vyslán');
        }
    } catch (eventError) {
        console.warn('⚠️ Nepodařilo se vyslat firebaseReady event:', eventError);
        // Fallback - nastavit flag přímo
        window.firebaseReady = true;
    }

    console.log('✅ Firebase inicializován a připraven:', { 
        app: !!app, 
        auth: !!auth, 
        db: !!db,
        ready: !!window.firebaseReady
    });
} catch (error) {
    console.error('❌ Kritická chyba při inicializaci Firebase:', error);
    console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
    });
    window.firebaseError = error;
    window.firebaseReady = false;
    
    // Vyslat error event s fallbackem pro kompatibilitu
    try {
        if (typeof window.dispatchEvent !== 'undefined') {
            const errorEvent = typeof CustomEvent !== 'undefined'
                ? new CustomEvent('firebaseError', { detail: error, bubbles: false, cancelable: false })
                : (() => {
                    // Fallback pro starší prohlížeče
                    const evt = document.createEvent('CustomEvent');
                    evt.initCustomEvent('firebaseError', false, false, error);
                    return evt;
                })();
            window.dispatchEvent(errorEvent);
        }
    } catch (eventError) {
        console.warn('⚠️ Nepodařilo se vyslat firebaseError event:', eventError);
    }
}

