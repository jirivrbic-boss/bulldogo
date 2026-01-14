// Jednotný hash modal hook pro synchronizaci hash navigace
// Zajišťuje konzistentní otevírání/zavírání modalů přes hash v URL

let hashModalInitialized = false;
let currentModalType = null;

/**
 * Inicializuje hash modal systém
 * Musí být voláno po načtení auth.js
 */
function initHashModal() {
    if (hashModalInitialized) {
        console.log('[HASH MODAL] ⚠️ Hash modal již inicializován');
        return;
    }

    console.log('[HASH MODAL] 🔧 Inicializuji hash modal systém...');

    // 1. Zpracovat initial hash (když přijdu rovnou s hashem v URL)
    function processInitialHash() {
        const hash = window.location.hash;
        if (hash === '#prihlaseni' || hash === '#registrace') {
            const type = hash === '#prihlaseni' ? 'login' : 'register';
            console.log('[HASH MODAL] 📍 Initial hash detekován:', hash, '→ otevírám', type);
            
            // Počkat na načtení auth.js
            waitForAuthJS(() => {
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal(type);
                    currentModalType = type;
                } else {
                    console.error('[HASH MODAL] ❌ showAuthModal není dostupná');
                }
            });
        }
    }

    // 2. Listener pro změny hash
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        console.log('[HASH MODAL] 🔄 Hash změněn:', hash);

        if (hash === '#prihlaseni') {
            waitForAuthJS(() => {
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal('login');
                    currentModalType = 'login';
                }
            });
        } else if (hash === '#registrace') {
            waitForAuthJS(() => {
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal('register');
                    currentModalType = 'register';
                }
            });
        } else {
            // Pokud hash není přihlášení/registrace, zavřít modal
            if (currentModalType) {
                console.log('[HASH MODAL] 🚪 Zavírám modal (hash odstraněn)');
                if (typeof window.closeAuthModal === 'function') {
                    window.closeAuthModal();
                }
                currentModalType = null;
            }
        }
    }, false);

    // 3. Zpracovat initial hash po načtení
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(processInitialHash, 100);
        });
    } else {
        setTimeout(processInitialHash, 100);
    }

    hashModalInitialized = true;
    console.log('[HASH MODAL] ✅ Hash modal systém inicializován');
}

/**
 * Čeká na načtení auth.js a pak zavolá callback
 */
function waitForAuthJS(callback, maxWait = 5000) {
    if (typeof window.showAuthModal === 'function') {
        callback();
        return;
    }

    let waited = 0;
    const checkInterval = setInterval(() => {
        waited += 100;
        if (typeof window.showAuthModal === 'function') {
            clearInterval(checkInterval);
            callback();
        } else if (waited >= maxWait) {
            clearInterval(checkInterval);
            console.error('[HASH MODAL] ❌ Timeout čekání na auth.js');
        }
    }, 100);
}

/**
 * Otevře auth modal a přidá hash do URL
 * @param {string} type - 'login' nebo 'register'
 */
function openAuthModal(type) {
    const hash = type === 'register' ? '#registrace' : '#prihlaseni';
    console.log('[HASH MODAL] 🔓 Otevírám modal:', type, '→ přidávám hash:', hash);
    
    // Přidat hash do URL bez reloadu
    try {
        const newUrl = window.location.pathname + window.location.search + hash;
        window.history.replaceState(null, '', newUrl);
        currentModalType = type;
    } catch (e) {
        console.warn('[HASH MODAL] ⚠️ Nepodařilo se přidat hash do URL:', e);
    }

    // Otevřít modal
    waitForAuthJS(() => {
        if (typeof window.showAuthModal === 'function') {
            window.showAuthModal(type);
        } else {
            console.error('[HASH MODAL] ❌ showAuthModal není dostupná');
        }
    });
}

/**
 * Zavře auth modal a odstraní hash z URL
 */
function closeAuthModalWithHash() {
    console.log('[HASH MODAL] 🚪 Zavírám modal a odstraňuji hash');
    
    // Zavřít modal
    if (typeof window.closeAuthModal === 'function') {
        window.closeAuthModal();
    }
    
    // Odstranit hash z URL bez reloadu
    try {
        const newUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', newUrl);
        currentModalType = null;
    } catch (e) {
        console.warn('[HASH MODAL] ⚠️ Nepodařilo se odstranit hash z URL:', e);
    }
}

// Export pro ES moduly i globální použití (kompatibilita)
export {
    initHashModal,
    openAuthModal,
    closeAuthModalWithHash
};

if (typeof window !== 'undefined') {
    window.hashModal = {
        init: initHashModal,
        open: openAuthModal,
        close: closeAuthModalWithHash
    };
    
    // Hard diagnostika při načtení
    console.log('[BOOT] hashModal loaded:', {
        init: typeof initHashModal,
        open: typeof openAuthModal,
        close: typeof closeAuthModalWithHash
    });
}

// Auto-inicializace po načtení DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => initHashModal(), 200);
    });
} else {
    setTimeout(() => initHashModal(), 200);
}
