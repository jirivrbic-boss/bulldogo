// Helper funkce pro robustní importy Firebase modulů s cache a retry mechanismem
// Tento soubor řeší problémy s kompatibilitou dynamických importů napříč prohlížeči

(function() {
    'use strict';
    
    // Cache pro Firebase moduly
    const moduleCache = {
        auth: null,
        firestore: null,
        storage: null,
        appCheck: null
    };
    
    // Retry konfigurace
    const RETRY_CONFIG = {
        maxRetries: 3,
        retryDelay: 500, // ms
        timeout: 10000 // ms
    };
    
    /**
     * Robustní import Firebase Auth modulu s cache a retry
     */
    window.importFirebaseAuth = async function() {
        if (moduleCache.auth) {
            return moduleCache.auth;
        }
        
        const url = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
        let lastError;
        
        for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const module = await Promise.race([
                    import(url),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Import timeout')), RETRY_CONFIG.timeout)
                    )
                ]);
                
                moduleCache.auth = module;
                return module;
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Pokus ${attempt}/${RETRY_CONFIG.maxRetries} o import Firebase Auth selhal:`, error.message || error);
                
                if (attempt < RETRY_CONFIG.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.retryDelay * attempt));
                }
            }
        }
        
        console.error('❌ Všechny pokusy o import Firebase Auth selhaly:', lastError);
        throw lastError || new Error('Firebase Auth modul není dostupný');
    };
    
    /**
     * Robustní import Firebase Firestore modulu s cache a retry
     */
    window.importFirebaseFirestore = async function() {
        if (moduleCache.firestore) {
            return moduleCache.firestore;
        }
        
        const url = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
        let lastError;
        
        for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const module = await Promise.race([
                    import(url),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Import timeout')), RETRY_CONFIG.timeout)
                    )
                ]);
                
                moduleCache.firestore = module;
                // Také cache pro zpětnou kompatibilitu
                window.firestoreModuleCache = module;
                return module;
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Pokus ${attempt}/${RETRY_CONFIG.maxRetries} o import Firebase Firestore selhal:`, error.message || error);
                
                if (attempt < RETRY_CONFIG.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.retryDelay * attempt));
                }
            }
        }
        
        console.error('❌ Všechny pokusy o import Firebase Firestore selhaly:', lastError);
        throw lastError || new Error('Firebase Firestore modul není dostupný');
    };
    
    /**
     * Robustní import Firebase Storage modulu s cache a retry
     */
    window.importFirebaseStorage = async function() {
        if (moduleCache.storage) {
            return moduleCache.storage;
        }
        
        const url = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
        let lastError;
        
        for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const module = await Promise.race([
                    import(url),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Import timeout')), RETRY_CONFIG.timeout)
                    )
                ]);
                
                moduleCache.storage = module;
                return module;
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Pokus ${attempt}/${RETRY_CONFIG.maxRetries} o import Firebase Storage selhal:`, error.message || error);
                
                if (attempt < RETRY_CONFIG.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.retryDelay * attempt));
                }
            }
        }
        
        console.error('❌ Všechny pokusy o import Firebase Storage selhaly:', lastError);
        throw lastError || new Error('Firebase Storage modul není dostupný');
    };
    
    /**
     * Vymazat cache (užitečné pro testování nebo při problémech)
     */
    window.clearFirebaseModuleCache = function() {
        moduleCache.auth = null;
        moduleCache.firestore = null;
        moduleCache.storage = null;
        moduleCache.appCheck = null;
        window.firestoreModuleCache = null;
        console.log('✅ Firebase modul cache vymazán');
    };
    
    console.log('✅ Firebase import helper funkce načteny');
})();
