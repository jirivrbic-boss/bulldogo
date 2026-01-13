// Auth.js - Firebase Authentication funkcionality

// Debug: Zkontrolovat, jestli se auth.js načítá
// Auth.js se načítá - logy odstraněny

// Globální proměnné
let authCurrentUser = null;
let firebaseAuth = null;
let firebaseDb = null;
let recaptchaVerifier = null; // invisible reCAPTCHA instance for phone auth
let phoneConfirmationResult = null; // result holder after sending SMS

// Diagnostická funkce pro kontrolu reCAPTCHA konfigurace
async function checkRecaptchaConfig() {
    console.log('🔍 Kontrola konfigurace reCAPTCHA...');
    
    const checks = {
        firebaseAuth: false,
        firebaseDb: false,
        recaptchaContainer: false,
        recaptchaVerifier: false,
        phoneAuth: false
    };
    
    try {
        // 1. Kontrola Firebase Auth
        if (window.firebaseAuth || firebaseAuth) {
            checks.firebaseAuth = true;
            console.log('✅ Firebase Auth je dostupný');
        } else {
            console.error('❌ Firebase Auth není dostupný');
        }
        
        // 2. Kontrola Firebase DB
        if (window.firebaseDb || firebaseDb) {
            checks.firebaseDb = true;
            console.log('✅ Firebase DB je dostupný');
        } else {
            console.error('❌ Firebase DB není dostupný');
        }
        
        // 3. Kontrola reCAPTCHA kontejneru
        const container = document.getElementById('recaptcha-container');
        if (container) {
            checks.recaptchaContainer = true;
            console.log('✅ reCAPTCHA kontejner existuje v DOM');
        } else {
            console.error('❌ reCAPTCHA kontejner neexistuje v DOM');
        }
        
        // 4. Pokus o vytvoření reCAPTCHA verifieru (test)
        if (checks.firebaseAuth) {
            try {
                const auth = window.firebaseAuth || firebaseAuth;
                const authMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                const { RecaptchaVerifier } = authMod;
                
                const testContainer = document.getElementById('recaptcha-container');
                if (testContainer) {
                    // Vytvořit testovací verifier (nepoužijeme ho, jen ověříme, že to funguje)
                    const testVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                        size: 'invisible',
                        callback: () => {},
                        'expired-callback': () => {}
                    });
                    checks.recaptchaVerifier = true;
                    console.log('✅ reCAPTCHA Verifier lze vytvořit');
                    
                    // Okamžitě vyčistit testovací verifier
                    try { await testVerifier.clear(); } catch (_) {}
                }
            } catch (err) {
                console.error('❌ Nelze vytvořit reCAPTCHA Verifier:', err);
                console.error('   Důvod:', err.message);
            }
        }
        
        // 5. Kontrola Firebase konfigurace
        if (checks.firebaseAuth) {
            const auth = window.firebaseAuth || firebaseAuth;
            const config = auth.app.options;
            console.log('📋 Firebase konfigurace:');
            console.log('   Project ID:', config.projectId);
            console.log('   Auth Domain:', config.authDomain);
            console.log('   API Key:', config.apiKey ? 'nastaven' : 'chybí');
            
            if (config.projectId === 'inzerio-inzerce') {
                checks.phoneAuth = true;
                console.log('✅ Projekt ID odpovídá očekávané hodnotě');
            } else {
                console.warn('⚠️ Projekt ID neodpovídá očekávané hodnotě:', config.projectId);
            }
        }
        
        // Shrnutí
        console.log('\n📊 Shrnutí kontroly reCAPTCHA:');
        console.log('   Firebase Auth:', checks.firebaseAuth ? '✅' : '❌');
        console.log('   Firebase DB:', checks.firebaseDb ? '✅' : '❌');
        console.log('   reCAPTCHA kontejner:', checks.recaptchaContainer ? '✅' : '❌');
        console.log('   reCAPTCHA Verifier:', checks.recaptchaVerifier ? '✅' : '❌');
        console.log('   Firebase konfigurace:', checks.phoneAuth ? '✅' : '⚠️');
        
        const allPassed = Object.values(checks).every(v => v === true);
        if (allPassed) {
            console.log('\n✅ Všechny kontroly prošly! reCAPTCHA by měla fungovat.');
        } else {
            console.log('\n⚠️ Některé kontroly selhaly. Zkontrolujte Firebase Console.');
            console.log('📖 Pro více informací otevřete: RECAPTCHA_CONFIG_CHECK.md');
        }
        
        return checks;
    } catch (error) {
        console.error('❌ Chyba při kontrole reCAPTCHA konfigurace:', error);
        return checks;
    }
}

// Exportovat funkci globálně pro použití v konzoli
window.checkRecaptchaConfig = checkRecaptchaConfig;

// Diagnostická funkce pro kontrolu Phone Authentication nastavení
async function checkPhoneAuthConfig() {
    console.log('🔍 Kontrola Phone Authentication konfigurace...');
    console.log('');
    console.log('⚠️ Tato kontrola vyžaduje manuální ověření v Firebase Console:');
    console.log('');
    console.log('1. Firebase Console → Authentication → Sign-in method');
    console.log('   ✅ Phone musí být ENABLED');
    console.log('');
    console.log('2. Klikněte na Phone (telefonní ikona) a zkontrolujte:');
    console.log('   ✅ Phone number sign-in musí být Enabled');
    console.log('   ✅ reCAPTCHA by měla být automaticky nakonfigurovaná');
    console.log('');
    console.log('3. Firebase Console → Authentication → Settings → Authorized domains');
    console.log('   ✅ Musí obsahovat: localhost');
    console.log('');
    console.log('4. Google Cloud Console → APIs & Services → Enabled APIs');
    console.log('   ✅ Identity Toolkit API musí být povoleno');
    console.log('');
    console.log('📖 Pro více informací otevřete: RECAPTCHA_CONFIG_CHECK.md');
    console.log('');
    
    // Zkusit zjistit, zda můžeme testovat phone auth
    if (window.firebaseAuth || firebaseAuth) {
        const auth = window.firebaseAuth || firebaseAuth;
        console.log('✅ Firebase Auth je připraven pro telefonní autentifikaci');
        console.log('   Project ID:', auth.app.options.projectId);
        console.log('   Auth Domain:', auth.app.options.authDomain);
    } else {
        console.error('❌ Firebase Auth není dostupný');
    }
}

window.checkPhoneAuthConfig = checkPhoneAuthConfig;
console.log('💡 Pro kontrolu reCAPTCHA konfigurace zadejte: checkRecaptchaConfig()');
console.log('💡 Pro kontrolu Phone Auth nastavení zadejte: checkPhoneAuthConfig()');

// Funkce pro inicializaci auth po načtení Firebase
function initializeAuthWithFirebase() {
    if (window.firebaseAuth && window.firebaseDb) {
        console.log('✅ Firebase již dostupný');
        firebaseAuth = window.firebaseAuth;
        firebaseDb = window.firebaseDb;
        initAuth();
        return true;
    }
    return false;
}

// Inicializace po načtení Firebase
document.addEventListener('DOMContentLoaded', () => {
    // DOMContentLoaded - logy odstraněny
    
    // Okamžitě zkusit získat Firebase
    if (initializeAuthWithFirebase()) {
        return; // Firebase je připraven, pokračujeme
    }
    
    console.log('⏳ Čekám na Firebase...');
    
    // Deklarovat proměnné před použitím
    let checkFirebase = null;
    
    // Funkce pro vyčištění listenerů a intervalů
    const cleanup = () => {
        if (checkFirebase) {
            clearInterval(checkFirebase);
            checkFirebase = null;
        }
        window.removeEventListener('firebaseReady', onFirebaseReady);
    };
    
    // Poslouchat event 'firebaseReady' pokud je dostupný
    const onFirebaseReady = () => {
        console.log('📢 Obdržen event firebaseReady');
        if (initializeAuthWithFirebase()) {
            cleanup();
        }
    };
    
    if (typeof window.addEventListener !== 'undefined') {
        window.addEventListener('firebaseReady', onFirebaseReady);
        
        // Poslouchat také na chybové eventy
        window.addEventListener('firebaseError', (event) => {
            console.error('❌ Firebase Error event obdržen:', event.detail);
            cleanup();
            const errorMsg = event.detail?.message || 'Nepodařilo se načíst Firebase.';
            showMessage(`Chyba: ${errorMsg} Obnovte stránku.`, 'error');
        });
    }
    
    // Také pravidelně kontrolovat (fallback)
    checkFirebase = setInterval(() => {
        console.log('🔍 Kontroluji Firebase:', {
            firebaseReady: !!window.firebaseReady,
            firebaseAuth: !!window.firebaseAuth,
            firebaseDb: !!window.firebaseDb,
            firebaseError: !!window.firebaseError
        });
        
        // Pokud byl nastaven error, zobrazit chybu a přestat kontrolovat
        if (window.firebaseError) {
            console.error('❌ Firebase má error:', window.firebaseError);
            cleanup();
            const errorMsg = window.firebaseError?.message || 'Nepodařilo se načíst Firebase.';
            showMessage(`Chyba: ${errorMsg} Obnovte stránku.`, 'error');
            return;
        }
        
        if (initializeAuthWithFirebase()) {
            cleanup();
        }
    }, 100);
    
    // Timeout po 15 sekundách (zvýšeno z 10)
    setTimeout(() => {
        if (!firebaseAuth || !firebaseDb) {
            console.error('❌ Firebase se nenačetl během 15 sekund!');
            console.error('❌ Stav Firebase:', {
                firebaseReady: !!window.firebaseReady,
                firebaseAuth: !!window.firebaseAuth,
                firebaseDb: !!window.firebaseDb,
                firebaseApp: !!window.firebaseApp
            });
            cleanup();
            showMessage('Chyba: Firebase se nenačetl. Obnovte stránku.', 'error');
        }
    }, 15000);
});

// Univerzální delegovaný handler pro otevření auth modalu na všech stránkách
document.addEventListener('click', (e) => {
    const target = e.target.closest(
        '.btn-login, .btn-register, ' +                 // standardní tlačítka
        '[data-open-auth], [data-auth], ' +            // datové atributy
        '[onclick*="showAuthModal"], ' +               // inline onclick fallback
        'a[href="#login"], a[href="#register"]'        // hashové odkazy
    );
    if (!target) return;
    try {
        const isLogin =
            target.classList?.contains?.('btn-login') ||
            target.getAttribute?.('data-open-auth') === 'login' ||
            target.getAttribute?.('data-auth') === 'login' ||
            (target.getAttribute?.('onclick') || '').includes("showAuthModal('login'") ||
            (target.getAttribute?.('href') || '') === '#login';
        const isRegister =
            target.classList?.contains?.('btn-register') ||
            target.getAttribute?.('data-open-auth') === 'register' ||
            target.getAttribute?.('data-auth') === 'register' ||
            (target.getAttribute?.('onclick') || '').includes("showAuthModal('register'") ||
            (target.getAttribute?.('href') || '') === '#register';
        if (isLogin) {
            e.preventDefault();
            e.stopPropagation();
            try {
                showAuthModal('login');
            } catch (err) {
                console.error('showAuthModal(login) selhalo, zkouším fallback:', err);
                try {
                    if (!document.getElementById('authModal')) createAuthModal();
                    setTimeout(() => {
                        try { showAuthModal('login'); } catch (_) {}
                    }, 0);
                } catch (_) {}
            }
        } else if (isRegister) {
            e.preventDefault();
            e.stopPropagation();
            try {
                showAuthModal('register');
            } catch (err) {
                console.error('showAuthModal(register) selhalo, zkouším fallback:', err);
                try {
                    if (!document.getElementById('authModal')) createAuthModal();
                    setTimeout(() => {
                        try { showAuthModal('register'); } catch (_) {}
                    }, 0);
                } catch (_) {}
            }
        }
    } catch (_) {}
});

// Redundantní přímé navázání – kdyby delegace nestačila (některé podstránky)
function bindAuthOpeners(root = document) {
    const sel = '.btn-login, .btn-register, [data-open-auth], [data-auth], a[href="#login"], a[href="#register"]';
    root.querySelectorAll(sel).forEach(el => {
        if (el.dataset.authBound === '1') return;
        el.addEventListener('click', (e) => {
            const href = el.getAttribute('href') || '';
            const dataOpen = el.getAttribute('data-open-auth') || el.getAttribute('data-auth') || '';
            const isLogin = el.classList.contains('btn-login') || href === '#login' || dataOpen === 'login';
            const isRegister = el.classList.contains('btn-register') || href === '#register' || dataOpen === 'register';
            if (isLogin || isRegister) {
                e.preventDefault();
                e.stopPropagation();
                showAuthModal(isLogin ? 'login' : 'register');
            }
        }, { passive: false });
        el.dataset.authBound = '1';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Přímé navázání po načtení
    try { bindAuthOpeners(document); } catch (_) {}
    // Sledovat přidávání prvků dynamicky
    const mo = new MutationObserver((muts) => {
        muts.forEach(m => {
            m.addedNodes?.forEach?.(node => {
                if (node.nodeType === 1) {
                    try { bindAuthOpeners(node); } catch (_) {}
                }
            });
        });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    
    // Zkontrolovat hash v URL a otevřít modal pokud je potřeba (univerzální popup okno)
    // POZNÁMKA: Musíme počkat, až se načtou všechny skripty (včetně auth.js)
    try {
        const hash = window.location.hash;
        if (hash === '#prihlaseni' || hash === '#registrace') {
            // Počkat déle, aby se auth.js načetl a funkce byly dostupné
            setTimeout(() => {
                const type = hash === '#prihlaseni' ? 'login' : 'register';
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal(type);
                } else {
                    // Pokud showAuthModal ještě není dostupná, počkat ještě
                    const checkAuth = setInterval(() => {
                        if (typeof window.showAuthModal === 'function') {
                            clearInterval(checkAuth);
                            window.showAuthModal(type);
                        }
                    }, 100);
                    // Timeout po 3 sekundách
                    setTimeout(() => clearInterval(checkAuth), 3000);
                }
            }, 500);
        }
    } catch (e) {
        console.warn('⚠️ Chyba při kontrole hash v URL:', e);
    }
});

// Inicializace autentifikace
function initAuth() {
    // Inicializace auth s Firebase - logy odstraněny
    
    // Import Firebase funkcí dynamicky
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
        // Firebase Auth modul načten - logy odstraněny
        
        // DEV bypass pro reCAPTCHA – pouze na lokálu (nikoliv na vercel.app)
        try {
            const isDevHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            const isProd = location.hostname.endsWith('bulldogo.cz');
            if (isDevHost && !isProd && firebaseAuth?.settings) {
                // Pozor: funguje jen s testovacími čísly definovanými v Firebase Console
                firebaseAuth.settings.appVerificationDisabledForTesting = true;
                console.log('⚙️ reCAPTCHA vypnuta pro vývoj (použijte testovací čísla ve Firebase Console) – pouze localhost.');
            }
        } catch (e) {
            console.warn('⚠️ Nepodařilo se nastavit appVerificationDisabledForTesting:', e?.message || e);
        }
        // Sledování stavu přihlášení
        onAuthStateChanged(firebaseAuth, (user) => {
            // Auth state changed - logy odstraněny
            authCurrentUser = user;
            updateUI(user);
            
            // Zkontrolovat admin menu po změně auth stavu
            if (typeof window.checkAndShowAdminMenu === 'function') {
                setTimeout(() => window.checkAndShowAdminMenu(), 500);
            }
            
            // DŮLEŽITÉ: Zajistit, že uživatel má profil v Firestore (fail-safe)
            // Toto opraví i existující účty, které byly vytvořeny bez profilu
            if (user && window.userProfileService && typeof window.userProfileService.ensureUserProfile === 'function') {
                // Volat asynchronně, aby neblokovalo UI
                window.userProfileService.ensureUserProfile(user.uid, {
                    email: user.email || '',
                    phoneNumber: user.phoneNumber || '',
                    provider: user.providerData?.[0]?.providerId || 'unknown',
                    type: 'person'
                }).catch(err => {
                    console.error('[AUTH] ❌ Chyba při ensureUserProfile v onAuthStateChanged:', err);
                    console.error('[AUTH] ❌ Error details:', {
                        code: err?.code,
                        message: err?.message,
                        pathname: window.location.pathname
                    });
                });
            } else if (user && window.authService && typeof window.authService.ensureUserProfile === 'function') {
                // Fallback na starý authService
                window.authService.ensureUserProfile(user).catch(err => {
                    console.error('[AUTH] ❌ Chyba při ensureUserProfile (fallback) v onAuthStateChanged:', err);
                });
            }
            
            // Zkontrolovat, zda existuje callback po přihlášení
            // DŮLEŽITÉ: Pro registraci se callback NESMÍ volat z onAuthStateChanged,
            // protože Firestore zápis ještě nemusí být dokončen.
            // Callback se zavolá až po úspěšném dokončení registrace (v btnAuthSubmit2 handleru).
            // Tady voláme callback jen pro přihlášení (ne registraci).
            if (user && window.afterLoginCallback && !window._registrationInProgress) {
                console.log('🔄 Spouštím callback po přihlášení (ne registrace)');
                try {
                    window.afterLoginCallback();
                } catch (e) {
                    console.error('❌ Chyba při volání afterLoginCallback:', e);
                }
                // Vyčistit callback
                window.afterLoginCallback = null;
            } else if (user && window._registrationInProgress) {
                console.log('⚠️ Registrace probíhá, afterLoginCallback se zavolá po dokončení Firestore zápisu');
            } else if (user) {
                console.log('⚠️ Uživatel přihlášen, ale afterLoginCallback není nastaven');
            }
        });
    }).catch(error => {
        console.error('❌ Chyba při načítání Firebase Auth:', error);
    });
    
    // Inicializace výběru typu registrace
    setupRegistrationTypeSelection();
    
    // Nastavení event listenerů
    setupEventListeners();
    
    // Hash navigace je nyní zpracovávána v lib/hashModal.js
    // Tento listener je zachován pro kompatibilitu, ale hashModal.js má prioritu
    // (hashModal.js se inicializuje později a přepíše tento listener)
    
    // Listener pro změny hash v URL (univerzální popup okno) - DEPRECATED, použijte hashModal.js
    if (!window.hashModal || !window.hashModalInitialized) {
        window.addEventListener('hashchange', () => {
            try {
                const hash = window.location.hash;
                if (hash === '#prihlaseni') {
                    if (typeof showAuthModal === 'function') {
                        showAuthModal('login');
                    }
                } else if (hash === '#registrace') {
                    if (typeof showAuthModal === 'function') {
                        showAuthModal('register');
                    }
                } else {
                    // Pokud hash není přihlášení/registrace, zavřít modal
                    const modal = document.getElementById('authModal');
                    if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
                        if (typeof closeAuthModal === 'function') {
                            closeAuthModal();
                        }
                    }
                }
            } catch (e) {
                console.warn('⚠️ Chyba při zpracování hashchange:', e);
            }
        }, false);
    }
    
    // Listener pro změny hash v URL (univerzální popup okno) - DUPLICATE REMOVED
    window.addEventListener('hashchange', () => {
        try {
            const hash = window.location.hash;
            if (hash === '#prihlaseni') {
                if (typeof showAuthModal === 'function') {
                    showAuthModal('login');
                }
            } else if (hash === '#registrace') {
                if (typeof showAuthModal === 'function') {
                    showAuthModal('register');
                }
            } else if (hash === '' || (!hash.includes('#prihlaseni') && !hash.includes('#registrace'))) {
                // Pokud hash není přihlášení/registrace, zavřít modal
                const modal = document.getElementById('authModal');
                if (modal && modal.style.display !== 'none') {
                    if (typeof closeAuthModal === 'function') {
                        closeAuthModal();
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ Chyba při zpracování hashchange:', e);
        }
    });
    
    // Debug: Zkontrolovat elementy po načtení
    setTimeout(() => {
        const personForm = document.querySelector('.person-form');
        const companyForm = document.querySelector('.company-form');
        const typeButtons = document.querySelectorAll('.registration-type-btn');
        
        // Debug po načtení DOM - logy odstraněny pro čistší konzoli
    }, 1000);
}

// Funkce pro zablokování/odblokování polí při firemní registraci
function toggleCompanyFormFields(disabled) {
    const companyNameEl = document.getElementById('companyName');
    const authEmailEl = document.getElementById('authEmail');
    const authPasswordEl = document.getElementById('authPassword');
    const authPhoneEl = document.getElementById('authPhone');
    const btnSendPhoneCode = document.getElementById('btnSendPhoneCode');
    
    if (companyNameEl) companyNameEl.disabled = disabled;
    if (authEmailEl) authEmailEl.disabled = disabled;
    if (authPasswordEl) authPasswordEl.disabled = disabled;
    if (authPhoneEl) authPhoneEl.disabled = disabled;
    if (btnSendPhoneCode) btnSendPhoneCode.disabled = disabled;
    
    // Visual feedback
    const style = disabled ? 'cursor: not-allowed; opacity: 0.6;' : 'cursor: auto; opacity: 1;';
    if (companyNameEl) companyNameEl.style.cssText = (companyNameEl.style.cssText.replace(/cursor:[^;]+;|opacity:[^;]+;/g, '')) + style;
    if (authEmailEl) authEmailEl.style.cssText = (authEmailEl.style.cssText.replace(/cursor:[^;]+;|opacity:[^;]+;/g, '')) + style;
    if (authPasswordEl) authPasswordEl.style.cssText = (authPasswordEl.style.cssText.replace(/cursor:[^;]+;|opacity:[^;]+;/g, '')) + style;
    if (authPhoneEl) authPhoneEl.style.cssText = (authPhoneEl.style.cssText.replace(/cursor:[^;]+;|opacity:[^;]+;/g, '')) + style;
}

// Nastavení výběru typu registrace
function setupRegistrationTypeSelection() {
    const typeButtons = document.querySelectorAll('.registration-type-btn');
    const personForm = document.querySelector('.person-form');
    const companyForm = document.querySelector('.company-form');
    
    // Nastavení registračních typů
    
    typeButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Přepnutí typu registrace
            
            // Odstranit active třídu ze všech tlačítek
            typeButtons.forEach(btn => btn.classList.remove('active'));
            // Přidat active třídu na kliknuté tlačítko
            button.classList.add('active');
            
            const type = button.getAttribute('data-type');
            // Typ registrace nastaven
            
            if (type === 'person') {
                // Zobrazení formuláře pro fyzickou osobu
                personForm.style.display = 'block';
                personForm.classList.remove('hidden');
                personForm.classList.add('visible');
                companyForm.style.display = 'none';
                companyForm.classList.add('hidden');
                companyForm.classList.remove('visible');
                // required přepínač
                toggleRequired(personForm, true);
                toggleRequired(companyForm, false);
                // Odblokovat všechna pole pro osobní registraci
                toggleCompanyFormFields(false);
                // Reset IČO verifikačního flagu
                window.__icoVerified = false;
                window.__icoVerifiedValue = null;
            } else if (type === 'company') {
                // Zobrazení formuláře pro firmu
                personForm.style.display = 'none';
                personForm.classList.add('hidden');
                personForm.classList.remove('visible');
                companyForm.style.display = 'block';
                companyForm.classList.remove('hidden');
                companyForm.classList.add('visible');
                // required přepínač
                toggleRequired(personForm, false);
                toggleRequired(companyForm, true);
                // Zablokovat všechna pole kromě IČO pole (dokud není IČO ověřeno)
                toggleCompanyFormFields(true);
                // Reset IČO verifikačního flagu
                window.__icoVerified = false;
                window.__icoVerifiedValue = null;
            }
            
            // Stav formulářů - logy odstraněny
        });
    });
}

// Přepínání required atributů uvnitř kontejneru
function toggleRequired(container, isRequired) {
    if (!container) return;
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach((el) => {
        if (isRequired) {
            if (el.getAttribute('data-optional') === 'true') {
                el.required = false;
            } else {
                el.required = true;
            }
        } else {
            el.required = false;
        }
    });
}

// Normalizace telefonního čísla do E.164 (+420123456789), odstranění mezer a 00 -> +
function normalizePhone(input) {
    const raw = (input || '').toString().trim().replace(/\s+/g, '');
    if (!raw) return '';
    if (raw.startsWith('00')) return '+' + raw.slice(2);
    if (raw.startsWith('+')) return raw;
    if (raw.startsWith('420')) return '+420' + raw.slice(3);
    return raw;
}

// Ověření, zda telefon ještě není použit v žádném profilu (users/*/profile/profile)
async function isPhoneAvailable(normalizedPhone) {
    if (!normalizedPhone) return false;
    try {
        const { getDocs, query, collectionGroup, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const q = query(collectionGroup(firebaseDb, 'profile'), where('phone', '==', normalizedPhone));
        const snap = await getDocs(q);
        return snap.empty;
    } catch (error) {
        // Pokud nemůžeme zkontrolovat kvůli oprávněním, vrátíme true (telefon je dostupný)
        // aby registrace mohla pokračovat - duplicitní telefon se zachytí při vytváření profilu
        console.warn('⚠️ Nelze ověřit dostupnost telefonu:', error.code || error.message);
        if (error.code === 'permission-denied') {
            // Při chybě oprávnění považujeme telefon za dostupný
            // (duplikace se zachytí při vytváření profilu)
            return true;
        }
        // U ostatních chyb také vrátíme true, aby registrace mohla pokračovat
        return true;
    }
}

// Normalizace IČO: ponechá jen číslice a omezí na 8 znaků (CZ IČO)
function normalizeICO(input) {
    const digits = (input || '').toString().replace(/\D+/g, '');
    return digits.slice(0, 8);
}

// Ověření IČO – preferuje Firebase Function proxy (CORS-safe), fallback na přímé HlídačStátu volání
async function validateICOWithARES(ico) {
    const n = normalizeICO(ico);
    if (n.length !== 8) return { ok: false, reason: 'IČO musí mít 8 číslic.' };
    try {
        // 0) Na Vercelu využij interní serverless proxy /api/validateICO (řeší CORS)
        const isVercel = location.hostname.endsWith('.vercel.app');
        if (isVercel) {
            try {
                // Explicitně použít správný název (s velkým I)
                const proxyUrl = `/api/validateICO?ico=${encodeURIComponent(n)}`;
                const proxyRes = await fetch(proxyUrl, { 
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (proxyRes.ok) {
                    const proxyData = await proxyRes.json().catch(() => ({}));
                    if (typeof proxyData?.ok === 'boolean') return proxyData;
                } else if (proxyRes.status === 503 || proxyRes.status === 404) {
                    // Pokud proxy selže, pokračovat na Firebase Function
                    console.warn('Vercel proxy failed, trying Firebase Function');
                }
            } catch (e) {
                console.warn('Vercel proxy error:', e);
            }
        }
        // 1) Zkusit volat Firebase Function (lokálně i v produkci)
        const projectId = (window.firebaseApp && window.firebaseApp.options && window.firebaseApp.options.projectId) || 'inzerio-inzerce';
        const regions = ['us-central1', 'europe-west1'];
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        // Nejprve emulator (us-central1) na localhostu
        if (isLocal) {
            try {
                const fnUrlLocal = `http://127.0.0.1:5001/${projectId}/us-central1/validateICO?ico=${encodeURIComponent(n)}`;
                const fnResLocal = await fetch(fnUrlLocal, { method: 'GET' });
                if (fnResLocal.ok) {
                    const dataLocal = await fnResLocal.json().catch(() => ({}));
                    if (typeof dataLocal?.ok === 'boolean') {
                        if (dataLocal.ok === false && /nedostupn/i.test(dataLocal.reason || '')) {
                            throw new Error('Emulator HlídačStátu nedostupný, zkouším produkci');
                        }
                        return dataLocal;
                    }
                }
            } catch (_) {}
        }
        // Poté produkce – zkus více regionů
        for (const r of regions) {
            try {
                const prodUrl = `https://${r}-${projectId}.cloudfunctions.net/validateICO?ico=${encodeURIComponent(n)}`;
                const prodRes = await fetch(prodUrl, { method: 'GET' });
                if (prodRes.ok) {
                    const prodData = await prodRes.json().catch(() => ({}));
                    if (typeof prodData?.ok === 'boolean') {
                        return prodData;
                    }
                }
            } catch (_) {}
        }

        // 2) Fallback: přímé HlídačStátu REST volání (může selhat na CORS v prohlížeči)
        // Tento fallback obvykle selže kvůli CORS, ale zkusíme to
        // POZOR: API token by neměl být v klientském kódu, ale pro testování ho můžeme použít
        try {
            const urlV2 = `https://api.hlidacstatu.cz/api/v2/firmy/ico/${n}`;
            const res = await fetch(urlV2, { 
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Token 36a6940d34774a5c90270f60ea73130b'
                }
            });
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                // HlídačStátu API vrací FirmaDTO: { ico, jmeno, datoveSchranky, zalozena }
                if (data && data.ico && data.jmeno) {
                    return { ok: true, name: data.jmeno, seat: null };
                }
            }
        } catch (corsError) {
            // CORS error je očekávaný - prohlížeč blokuje přímé volání
            console.warn('Direct HlídačStátu call blocked by CORS (expected)');
        }
        
        // Pokud všechny metody selhaly, vrátit obecnou chybovou zprávu
        return { ok: false, reason: 'HlídačStátu je dočasně nedostupný. Zkuste to později.' };
    } catch (e) {
        return { ok: false, reason: 'HlídačStátu je dočasně nedostupný. Zkuste to později.' };
    }
}

// Registrace nového uživatele
async function register(email, password, userData) {
    try {
        console.log('📝 Pokus o registraci:', { email, userData, firebaseAuth: !!firebaseAuth, firebaseDb: !!firebaseDb });
        
        if (!firebaseAuth || !firebaseDb) {
            console.error('❌ Firebase není dostupný!', { firebaseAuth: !!firebaseAuth, firebaseDb: !!firebaseDb });
            showMessage('Chyba: Firebase není načten. Obnovte stránku.', 'error');
            return;
        }
        
        const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // Kontrola unikátnosti telefonního čísla před vytvořením účtu
        const rawPhone = userData.phone || '';
        const normalizedPhone = normalizePhone(rawPhone);
        // Pokud jde o firmu, ověřit IČO přes HlídačStátu
        if (userData.type === 'company') {
            const icoCheck = await validateICOWithARES(userData.ico || '');
            if (!icoCheck.ok) {
                showMessage(icoCheck.reason || 'IČO se nepodařilo ověřit.', 'error');
                return;
            }
            // Volitelně doplnit obchodní název/sídlo z HlídačStátu
            if (!userData.companyName && icoCheck.name) {
                userData.companyName = icoCheck.name;
            }
            if (!userData.companyAddress && icoCheck.seat && icoCheck.seat.text) {
                userData.companyAddress = icoCheck.seat.text;
            }
        }
        if (!normalizedPhone) {
            showMessage('Telefon je povinný a musí být ve formátu +420XXXXXXXXX (např. +420123456789).', 'error');
            return;
        }
        
        // Kontrola formátu telefonu - musí začínat +420 a mít alespoň 9 číslic za předvolbou
        if (!normalizedPhone.startsWith('+420')) {
            showMessage('Telefon musí začínat předvolbou +420 (např. +420123456789).', 'error');
            return;
        }
        
        const digitsAfterPrefix = normalizedPhone.slice(4).replace(/\D/g, '');
        if (digitsAfterPrefix.length < 9) {
            showMessage('Telefonní číslo musí obsahovat alespoň 9 číslic za předvolbou +420 (např. +420123456789).', 'error');
            return;
        }
        const available = await isPhoneAvailable(normalizedPhone);
        if (!available) {
            showMessage('Toto telefonní číslo je již používáno jiným účtem.', 'error');
            return;
        }
        
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        
        // Vytvořit root dokument uživatele a profil subdokument
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        await setDoc(doc(firebaseDb, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            createdAt: new Date(),
            userType: userData.type
        });
        
        // Vytvořit profil podle typu uživatele s rozšířenými informacemi
        const profileData = {
            email: user.email,
            balance: 1000,
            createdAt: new Date(),
            userType: userData.type,
            // Základní informace
            name: userData.firstName && userData.lastName ? `${userData.firstName} ${userData.lastName}` : (userData.companyName || 'Uživatel'),
            phone: normalizedPhone || null,
            city: userData.city || null,
            bio: userData.bio || null,
            // Obchodní informace (pro firmy i osoby, které mohou mít obchodní údaje)
            businessName: userData.companyName || userData.businessName || null,
            businessType: userData.businessType || null,
            businessIco: null, // Bude nastaveno níže pro firmy
            businessDic: null, // Bude nastaveno níže pro firmy
            businessAddress: userData.companyAddress || userData.businessAddress || null,
            businessDescription: userData.businessDescription || null,
            // Předvolby
            emailNotifications: userData.emailNotifications !== false,
            smsNotifications: userData.smsNotifications === true,
            marketingEmails: userData.marketingEmails === true,
            // Hodnocení (prázdné při registraci)
            rating: 0,
            totalReviews: 0,
            ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            recentReviews: [],
            // Statistiky
            totalAds: 0,
            activeAds: 0,
            totalViews: 0,
            totalContacts: 0
        };
        
        if (userData.type === 'person') {
            profileData.firstName = userData.firstName;
            profileData.lastName = userData.lastName;
            profileData.birthDate = userData.birthDate;
            profileData.name = `${userData.firstName} ${userData.lastName}`;
        } else if (userData.type === 'company') {
            profileData.name = userData.companyName || 'Firma';
            // Uložit obchodní informace i na hlavní úroveň profilu (pro zobrazení v nastavení)
            const normalizedIco = normalizeICO(userData.ico || '');
            profileData.businessName = userData.companyName || null;
            profileData.businessType = userData.businessType || null;
            profileData.businessIco = normalizedIco || null;
            profileData.businessDic = userData.dic || null;
            profileData.businessAddress = userData.companyAddress || null;
            profileData.businessDescription = userData.businessDescription || null;
            // U firmy se businessAddress ukládá také do location, aby se zobrazovala v profilu
            profileData.location = userData.companyAddress || null;
            // Také zachovat v company objektu pro kompatibilitu
            profileData.company = {
                companyName: userData.companyName || null,
                ico: normalizedIco || null,
                dic: userData.dic || null,
                phone: normalizedPhone || null,
                address: userData.companyAddress || null
            };
        }
        
        await setDoc(doc(firebaseDb, 'users', user.uid, 'profile', 'profile'), profileData);

        // Manuálně aktualizovat UI po registraci
        console.log('🔄 Manuálně aktualizuji UI po registraci');
        updateUI(user);

        // Vyslat event pro aktualizaci nastavení (pokud je otevřena stránka nastavení)
        try {
            window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
                detail: { uid: user.uid } 
            }));
            // Také zkusit zavolat loadUserSettings pokud je dostupná (pro stránku nastavení)
            setTimeout(() => {
                if (typeof window.loadUserSettings === 'function') {
                    window.loadUserSettings();
                }
            }, 500);
        } catch (reloadError) {
            console.warn('⚠️ Chyba při vysílání eventu userProfileUpdated:', reloadError);
        }

        // DŮLEŽITÉ: Ověřit, že se data skutečně uložila před zavřením modalu
        const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        let retries = 0;
        let profileSaved = false;
        while (retries < 5 && !profileSaved) {
            const verifyRef = doc(firebaseDb, 'users', user.uid, 'profile', 'profile');
            const verifySnap = await getDoc(verifyRef);
            if (verifySnap.exists()) {
                profileSaved = true;
                console.log('[AUTH] ✅ Ověření: Profil je v DB (register funkce), retries:', retries);
            } else {
                retries++;
                console.log('[AUTH] ⏳ Čekám na uložení profilu (register funkce), retry:', retries);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        if (!profileSaved) {
            console.error('[AUTH] ❌ Profil se nepodařilo ověřit po 5 pokusech (register funkce)');
            throw new Error('Profil se nepodařilo uložit do databáze. Zkuste to znovu.');
        }
        
        showMessage('Úspěšně jste se zaregistrovali!', 'success');
        
        // Zavřít modal (použít hash modal hook pokud je dostupný)
        if (window.hashModal && typeof window.hashModal.close === 'function') {
            window.hashModal.close();
        } else {
            closeAuthModal();
        }
        return user;
    } catch (error) {
        handleAuthError(error);
    }
}

// Přihlášení uživatele
async function login(email, password) {
    try {
        // DŮLEŽITÉ: Zajistit, že uživatel má profil v Firestore (fail-safe)
        // Toto opraví i existující účty, které byly vytvořeny bez profilu
        console.log('🔐 Pokus o přihlášení:', { email, firebaseAuth: !!firebaseAuth });
        
        if (!firebaseAuth) {
            console.error('❌ Firebase Auth není dostupný!');
            showMessage('Chyba: Firebase není načten. Obnovte stránku.', 'error');
            return;
        }
        
        // Importuji Firebase Auth modul - logy odstraněny
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        // Firebase Auth modul načten - logy odstraněny
        
        // Volám signInWithEmailAndPassword - logy odstraněny
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;
        console.log('✅ Přihlášení úspěšné:', user.uid);
        
        // DŮLEŽITÉ: Zajistit, že uživatel má profil v Firestore (fail-safe)
        // Toto opraví i existující účty, které byly vytvořeny bez profilu
        if (window.authService && typeof window.authService.ensureUserProfile === 'function') {
            try {
                console.log('[AUTH] 🔧 Kontroluji/zajišťuji profil uživatele po přihlášení...');
                const profileCreated = await window.authService.ensureUserProfile(user);
                if (profileCreated) {
                    console.log('[AUTH] ✅ Profil byl vytvořen/aktualizován po přihlášení');
                }
            } catch (ensureError) {
                console.error('[AUTH] ❌ Chyba při ensureUserProfile po přihlášení:', ensureError);
                // Necháme pokračovat, není kritické
            }
        }
        
        // Počkat na aktualizaci auth state (onAuthStateChanged se spustí automaticky)
        // Manuálně aktualizovat UI po přihlášení
        console.log('🔄 Manuálně aktualizuji UI po přihlášení');
        updateUI(user);
        
        // Zkontrolovat, zda existuje callback po přihlášení a zavolat ho
        if (window.afterLoginCallback) {
            console.log('🔄 Volám afterLoginCallback z login funkce');
            try {
                window.afterLoginCallback();
            } catch (e) {
                console.error('❌ Chyba při volání afterLoginCallback:', e);
            }
        }
        
        showMessage('Úspěšně jste se přihlásili!', 'success');
        closeAuthModal();
        return user;
    } catch (error) {
        console.error('❌ Chyba při přihlašování:', error);
        console.error('❌ Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        handleAuthError(error);
    }
}

// Odhlášení uživatele
async function logout(options = {}) {
    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        await signOut(firebaseAuth);
        showMessage('Úspěšně jste se odhlásili!', 'success');

        // Všude po webu po odhlášení přesměrovat na domovskou stránku
        const redirect = options && options.redirect !== undefined ? !!options.redirect : true;
        const redirectUrl = (options && options.redirectUrl) ? String(options.redirectUrl) : 'index.html';
        const delayMs = (options && typeof options.delayMs === 'number') ? options.delayMs : 250;
        if (redirect) {
            setTimeout(() => {
                try { window.location.href = redirectUrl; } catch (_) {}
            }, delayMs);
        }
    } catch (error) {
        handleAuthError(error);
    }
}

// Kontrola admin statusu uživatele
async function checkAdminStatus(user) {
    if (!user || !user.uid) return false;
    
    try {
        const db = firebaseDb || window.firebaseDb;
        if (!db) return false;
        
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Zkontrolovat profil uživatele pro admin flag
        const profileRef = doc(db, 'users', user.uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            // Admin může být označen přes pole 'isAdmin' nebo 'role: admin'
            if (profileData.isAdmin === true || profileData.role === 'admin') {
                return true;
            }
        }
        
        // Fallback: kontrola přes email (pouze pro skutečné admin emaily)
        const adminEmails = ['admin@bulldogo.cz', 'support@bulldogo.cz'];
        if (user.email && adminEmails.includes(user.email.toLowerCase())) {
            return true;
        }
        
        // Poznámka: localStorage fallback byl odstraněn kvůli bezpečnosti
        // Admin práva se kontrolují pouze přes Firestore profil nebo admin emaily
        
        return false;
    } catch (error) {
        console.error('Chyba při kontrole admin statusu:', error);
        return false;
    }
}

// Aktualizace UI podle stavu přihlášení
async function updateUI(user) {
    // Aktualizace UI - logy odstraněny
    
    const authSection = document.querySelector('.auth-section');
    const userProfileSection = document.querySelector('.user-profile-section');
    const adminSection = document.getElementById('adminSection');
    
    // Debug: Zkontrolovat všechny možné elementy
    const allAuthElements = document.querySelectorAll('[class*="auth"]');
    const allUserElements = document.querySelectorAll('[class*="user"]');
    // Elementy nalezeny - logy odstraněny
    
    if (user) {
        // Uživatel je přihlášen
        if (authSection) authSection.style.display = 'none';
        if (userProfileSection) {
            userProfileSection.style.display = 'block';
            
            // Zobrazit email v navbaru
            const userEmailSpan = userProfileSection.querySelector('.user-email');
            if (userEmailSpan) {
                userEmailSpan.textContent = user.email;
            }
            
            // Zobrazit jméno a email v dropdown menu
            const displayName = userProfileSection.querySelector('.user-display-name');
            const userEmail = userProfileSection.querySelector('.user-email');
            
            if (displayName && userEmail) {
                // Zkusit načíst jméno z Firestore
                loadUserProfile(user.uid).then(userProfile => {
                    if (userProfile && userProfile.name) {
                        displayName.textContent = userProfile.name;
                    } else {
                        // Pokud není jméno, použít část emailu před @
                        const emailName = user.email.split('@')[0];
                        displayName.textContent = emailName.charAt(0).toUpperCase() + emailName.slice(1);
                    }
                    
                    // Zobrazit zůstatek
                    const balanceAmount = document.querySelector('.balance-amount');
                    if (balanceAmount && userProfile) {
                        const balance = userProfile.balance || 0;
                        balanceAmount.textContent = `${balance.toLocaleString('cs-CZ')} Kč`;
                    }

                    // Kontrola balíčku z databáze pro zobrazení odznaku
                    try {
                        let activePlan = null;
                        if (userProfile && userProfile.plan) {
                            // Kontrola, zda je balíček aktivní
                            const end = userProfile.planPeriodEnd ? (userProfile.planPeriodEnd.toDate ? userProfile.planPeriodEnd.toDate() : new Date(userProfile.planPeriodEnd)) : null;
                            const cancelAt = userProfile.planCancelAt ? (userProfile.planCancelAt.toDate ? userProfile.planCancelAt.toDate() : new Date(userProfile.planCancelAt)) : null;
                            
                            // Pokud má zrušení naplánované a období skončilo, balíček není aktivní
                            if (cancelAt && end && new Date() >= end) {
                                // Aktualizovat databázi - odstranit plan
                                (async () => {
                                    try {
                                        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                                        await setDoc(doc(firebaseDb, 'users', user.uid, 'profile', 'profile'), { plan: null, planCancelAt: null }, { merge: true });
                                    } catch (_) {}
                                })();
                                activePlan = null;
                            } else if (end && new Date() >= end) {
                                // Období skončilo, balíček není aktivní
                                activePlan = null;
                            } else {
                                // Balíček je aktivní
                                activePlan = userProfile.plan;
                            }
                        }
                        
                        // Synchronizace do localStorage pouze pro zobrazení odznaku (volitelné)
                        if (activePlan) {
                            localStorage.setItem('bdg_plan', activePlan);
                        } else {
                            localStorage.removeItem('bdg_plan');
                        }
                    } catch (_) {}
                });
                userEmail.textContent = user.email;
            }

            // Odznak podle balíčku (hobby/firma/?) vedle tlačítka Profil - získat z databáze
            try {
                (async () => {
                    try {
                        const activePlan = await checkUserPlanFromDatabase(user.uid);
                        const btnProfile = userProfileSection.querySelector('.btn-profile');
                        if (btnProfile) {
                            const old = btnProfile.querySelector('.user-badge');
                            if (old) old.remove();
                            
                            if (activePlan) {
                                const badge = document.createElement('span');
                                const label = activePlan === 'business' ? 'Firma' : activePlan === 'hobby' ? 'Hobby' : '?';
                                const cls = activePlan === 'business' ? 'badge-business' : activePlan === 'hobby' ? 'badge-hobby' : 'badge-unknown';
                                badge.className = 'user-badge ' + cls;
                                badge.textContent = label;
                                btnProfile.appendChild(badge);
                            }
                        }
                    } catch (_) {}
                })();
            } catch (_) {}
        }
        
        // Zobrazit tlačítko pro přidání služby
        showAddServiceButton();
        
        // Kontrola admin statusu a zobrazení admin menu
        checkAdminStatus(user).then(isAdmin => {
            const adminSection = document.getElementById('adminSection');
            if (adminSection) {
                if (isAdmin) {
                    adminSection.style.display = 'block';
                    console.log('✅ Admin menu zobrazeno');
                } else {
                    adminSection.style.display = 'none';
                }
            }
        });
    } else {
        // Uživatel není přihlášen
        if (authSection) authSection.style.display = 'flex';
        if (userProfileSection) userProfileSection.style.display = 'none';
        
        // Skrýt admin menu
        const adminSection = document.getElementById('adminSection');
        if (adminSection) adminSection.style.display = 'none';
        
        hideAddServiceButton();
    }
}

// Zobrazení tlačítka pro přidání služby
function showAddServiceButton() {
    let addServiceBtn = document.querySelector('.add-service-btn');
    if (!addServiceBtn) {
        addServiceBtn = document.createElement('a');
        addServiceBtn.href = 'create-ad.html';
        addServiceBtn.className = 'btn btn-primary add-service-btn';
        addServiceBtn.innerHTML = '<i class="fas fa-plus"></i> Přidat službu';
        
        const heroButtons = document.querySelector('.hero-buttons');
        if (heroButtons) {
            heroButtons.appendChild(addServiceBtn);
        }
    }
}

// Skrytí tlačítka pro přidání služby
function hideAddServiceButton() {
    const addServiceBtn = document.querySelector('.add-service-btn');
    if (addServiceBtn) {
        addServiceBtn.remove();
    }
}

// Vytvoření auth modalu dynamicky
function createAuthModal() {
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    
    modal.innerHTML = `
		<div class="modal-content auth-with-hero">
			<div class="auth-hero-ledge">
				<img src="fotky/bulldogo-overlay.png" alt="Bulldogo" class="auth-dog-lean" aria-hidden="true">
				<div class="modal-header">
					<h2 class="modal-title">Přihlášení</h2>
					<span class="close">&times;</span>
				</div>
			</div>
            <style>
                @media (max-width: 768px) {
                    #forgotPasswordLink:not([style*="display: none"]):not([style*="display:none"]) {
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                        text-align: center !important;
                        width: 100% !important;
                    }
                    #forgotPasswordLink .forgot-password-btn,
                    #forgotPasswordLink #btnForgotPassword {
                        display: inline-block !important;
                        text-align: center !important;
                        margin: 0 auto !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                    }
                    .auth-form .form-group:has(.auth-switch-btn) {
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                        text-align: center !important;
                        width: 100% !important;
                    }
                    .auth-switch-btn {
                        display: inline-block !important;
                        text-align: center !important;
                        margin: 0 auto !important;
                    }
                }
            </style>
            <form id="authForm" class="auth-form" action="javascript:void(0)" method="post">
                <!-- Výběr typu registrace (pouze při registraci) -->
                <div class="form-group registration-type" style="display: none;">
                    <label class="form-label">Typ registrace:</label>
                    <div class="registration-type-buttons">
                        <button type="button" class="registration-type-btn active" data-type="person">
                            <i class="fas fa-user"></i> Hobby (fyzická osoba)
                        </button>
                        <button type="button" class="registration-type-btn" data-type="company">
                            <i class="fas fa-building"></i> Firma
                        </button>
                    </div>
                </div>

                <!-- Formulář pro fyzickou osobu -->
                <div class="person-form" style="display: none;">
                    <div class="form-row two-col">
                        <div class="half">
                            <input type="text" id="firstName" name="firstName" placeholder="Jméno" required>
                        </div>
                        <div class="half">
                            <input type="text" id="lastName" name="lastName" placeholder="Příjmení" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="date-inline">
                            <label for="birthDate">Datum narození</label>
                            <input type="date" id="birthDate" name="birthDate" required>
                        </div>
                    </div>
                </div>

                <!-- Formulář pro firmu -->
                <div class="company-form" style="display: none;">
                    <div class="form-group">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="text" id="ico" name="ico" placeholder="IČ" required style="flex:1;">
                            <button type="button" id="btnVerifyICO" class="btn" style="flex:1;">Ověřit</button>
                        </div>
                        <div id="icoStatus" style="font-size:13px; margin-top:4px; color:#6b7280;"></div>
                    </div>
                    <div class="form-group">
                        <input type="text" id="companyName" name="companyName" placeholder="Název firmy" required>
                    </div>
                    <!-- Telefon a e‑mail pro firmu se vyplňují níže ve společných polích -->
                </div>

                <!-- Společná pole -->
                <div class="form-group" id="groupAuthEmail" style="display: none;">
                    <input type="email" id="authEmail" name="email" placeholder="Email" required>
                </div>
                <div class="form-group">
                    <input type="password" id="authPassword" name="password" placeholder="Heslo" required>
                </div>
                <div class="form-row two-col" id="phoneRow">
                    <div class="half">
                        <input type="tel" id="authPhone" name="phone" placeholder="Telefon" required>
                    </div>
                    <div class="half" id="phoneRight">
                        <button type="button" id="btnSendPhoneCode" class="btn btn-secondary" style="display: none;">Odeslat SMS kód</button>
                        <input type="text" id="phoneCode" name="phoneCode" placeholder="Kód z SMS" inputmode="numeric" autocomplete="one-time-code" style="display: none;">
                    </div>
                </div>

                <!-- Souhlas s GDPR (pouze při registraci) -->
                <div class="form-group gdpr-consent" style="display: none; margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none; font-size: 13px; line-height: 1.5; color: #374151;">
                        <input type="checkbox" id="gdprConsent" required style="
                            width: 18px;
                            height: 18px;
                            margin-top: 2px;
                            cursor: pointer;
                            accent-color: #f77c00;
                            flex-shrink: 0;
                        ">
                        <span>
                            Registrací berete na vědomí zpracování osobních údajů dle <a href="terms.html" target="_blank" style="color: #f77c00; text-decoration: underline; font-weight: 600;">Zásad ochrany osobních údajů</a>.
                        </span>
                    </label>
                </div>

                <div class="form-group">
                    <button type="submit" class="auth-submit-btn btn btn-primary">Přihlásit se</button>
                    <button type="button" id="btnAuthSubmit" class="btn btn-primary" style="display: none;">Dokončit registraci</button>
                </div>

                <div class="form-group" id="forgotPasswordLink" style="display: none;">
                    <button type="button" id="btnForgotPassword" class="btn btn-link forgot-password-btn" style="font-size: 0.9rem; padding: 0.5rem 0; color: #6b7280; text-decoration: underline; cursor: pointer;">
                        Zapomněli jste heslo?
                    </button>
                </div>

                <div class="form-group">
                    <button type="button" class="auth-switch-btn btn btn-link">Nemáte účet? Zaregistrujte se</button>
                </div>
                
                <!-- Neviditelná reCAPTCHA pro ověření telefonu -->
                <div id="recaptcha-container" style="height:0; overflow:hidden;"></div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Resetovat flag při vytvoření nového modalu
    authModalEventsSetup = false;
    
    // Nastavit event listenery
    setupAuthModalEvents();
    
    // Nastavit event listenery pro formulář okamžitě po vytvoření modalu
    setTimeout(() => {
        try { 
            setupEventListeners(); 
        } catch (e) { 
            console.warn('setupEventListeners failed in createAuthModal', e); 
        }
    }, 50);
    
    return modal;
}

// Nastavení event listenerů pro auth modal
// Uložit reference na handler funkce pro správné odstranění
let authModalClickHandler = null;
let authModalEventsSetup = false;

function setupAuthModalEvents() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    
    // Pokud už byly listenery nastaveny, neopakovat
    if (authModalEventsSetup) return;
    
    // Event listener pro zavírací tlačítko
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
        // Odstranit starý onclick atribut
        closeBtn.removeAttribute('onclick');
        // Odstranit všechny existující listenery klonováním elementu
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        // Přidat nový listener s once: true, aby se spustil jen jednou
        newCloseBtn.addEventListener('click', function closeBtnHandler(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.closeAuthModal === 'function') {
                window.closeAuthModal();
            }
        }, { once: false });
    }
    
    // Event listener pro kliknutí na pozadí (overlay) - zavřít modal
    // Uložit handler do globální proměnné pro správné odstranění
    if (authModalClickHandler) {
        modal.removeEventListener('click', authModalClickHandler);
    }
    authModalClickHandler = function(e) {
        if (e.target === modal) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.closeAuthModal === 'function') {
                window.closeAuthModal();
            }
        }
    };
    modal.addEventListener('click', authModalClickHandler);
    
    // Event listener pro přepínání mezi přihlášením a registrací
    const authSwitchBtn = modal.querySelector('.auth-switch-btn');
    if (authSwitchBtn) {
        // Odstranit všechny listenery klonováním
        const newSwitchBtn = authSwitchBtn.cloneNode(true);
        authSwitchBtn.parentNode.replaceChild(newSwitchBtn, authSwitchBtn);
        newSwitchBtn.addEventListener('click', function() {
            const type = newSwitchBtn.getAttribute('data-type');
            showAuthModal(type);
        });
    }
    
    // Event listener pro tlačítka typu registrace
    const typeButtons = modal.querySelectorAll('.registration-type-btn');
    typeButtons.forEach(btn => {
        // Odstranit všechny listenery klonováním
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function() {
            const allButtons = modal.querySelectorAll('.registration-type-btn');
            allButtons.forEach(b => b.classList.remove('active'));
            newBtn.classList.add('active');
            
            const type = newBtn.getAttribute('data-type');
            const personForm = modal.querySelector('.person-form');
            const companyForm = modal.querySelector('.company-form');
            
            if (type === 'person') {
                personForm.style.display = 'block';
                personForm.classList.add('visible');
                personForm.classList.remove('hidden');
                companyForm.style.display = 'none';
                companyForm.classList.add('hidden');
                companyForm.classList.remove('visible');
            } else {
                companyForm.style.display = 'block';
                companyForm.classList.add('visible');
                companyForm.classList.remove('hidden');
                personForm.style.display = 'none';
                personForm.classList.add('hidden');
                personForm.classList.remove('visible');
            }
        });
    });
    
    // Event listener pro formulář - ODSTRANĚNO (přidává se v setupEventListeners)
    // Duplicitní listenery způsobovaly vícenásobné odesílání formuláře
    
    // Event listener pro tlačítko odeslání SMS kódu
    const btnSendPhoneCode = modal.querySelector('#btnSendPhoneCode');
    if (btnSendPhoneCode) {
        const newBtn = btnSendPhoneCode.cloneNode(true);
        btnSendPhoneCode.parentNode.replaceChild(newBtn, btnSendPhoneCode);
        newBtn.addEventListener('click', async function() {
            console.log('Odeslání SMS kódu');
        });
    }
    
    // Event listener pro tlačítko Zapomenuté heslo
    const btnForgotPassword = modal.querySelector('#btnForgotPassword');
    if (btnForgotPassword) {
        // Odstranit všechny listenery klonováním (stejně jako ostatní tlačítka)
        const newBtn = btnForgotPassword.cloneNode(true);
        btnForgotPassword.parentNode.replaceChild(newBtn, btnForgotPassword);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleForgotPassword();
        });
    }
    
    authModalEventsSetup = true;
}

// Zobrazení auth modalu
function showAuthModal(type = 'login') {
    // Diagnostika: vypiš pathname pro debug
    console.log(`[AUTH MODAL] 🔓 Otevírám modal "${type}" z: ${window.location.pathname}`, {
        hash: window.location.hash,
        firebaseAuth: !!window.firebaseAuth,
        firebaseDb: !!window.firebaseDb,
        firebaseReady: !!window.firebaseReady
    });
    
    // Přidat hash do URL pro univerzální odkaz
    try {
        const hash = type === 'register' ? '#registrace' : '#prihlaseni';
        if (window.location.hash !== hash) {
            // Použít replaceState aby se nepřidalo do historie
            window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
        }
    } catch (e) {
        console.warn('⚠️ Nepodařilo se přidat hash do URL:', e);
    }
    
    // Kontrola in-app browseru při registraci nebo přihlášení
    if (isInAppBrowser()) {
        const actionText = type === 'register' ? 'registraci' : 'přihlášení';
        showInAppBrowserWarning(actionText);
        return;
    }
    
    let modal = document.getElementById('authModal');
    
    // Pokud modal neexistuje, vytvoř ho dynamicky
    if (!modal) {
        modal = createAuthModal();
    } else {
        // Pokud modal už existuje, zkontrolovat, zda má správné event listenery
        // Pokud ne, znovu je nastavit
        const authForm = modal.querySelector('#authForm');
        if (authForm && !authForm.hasAttribute('data-listener-set')) {
            // Event listenery nejsou nastaveny, nastavit je
            setTimeout(() => {
                try { 
                    setupEventListeners(); 
                } catch (e) { 
                    console.warn('setupEventListeners failed in showAuthModal', e); 
                }
            }, 50);
        }
        
        // Zajistit, že jsou nastaveny event listenery pro modal
        if (!authModalEventsSetup) {
            setupAuthModalEvents();
        }
    }
    
    const modalTitle = modal.querySelector('.modal-title');
    const submitBtn = modal.querySelector('.auth-submit-btn');
    const switchBtn = modal.querySelector('.auth-switch-btn');
    const registrationType = modal.querySelector('.registration-type');
    const personForm = modal.querySelector('.person-form');
    const companyForm = modal.querySelector('.company-form');
    
    // Elementy modalu připraveny

    const btnSendPhoneCode = modal.querySelector('#btnSendPhoneCode');
    const btnAuthSubmit = modal.querySelector('#btnAuthSubmit');
    const groupAuthEmail = modal.querySelector('#groupAuthEmail');
    const phoneRight = modal.querySelector('#phoneRight');
    const phoneCode = modal.querySelector('#phoneCode');
    const authEmail = modal.querySelector('#authEmail');
    const authPhone = modal.querySelector('#authPhone');
    const phoneRow = modal.querySelector('#phoneRow');

    // Skrýt GDPR souhlas při přihlášení
    const gdprConsent = modal.querySelector('.gdpr-consent');
    if (gdprConsent) {
        gdprConsent.style.display = 'none';
    }
    const gdprCheckbox = modal.querySelector('#gdprConsent');
    if (gdprCheckbox) {
        gdprCheckbox.required = false;
    }
    
    if (type === 'login') {
        console.log('🔧 Nastavuji modal pro přihlášení');
        modal.setAttribute('data-mode', 'login');
        modalTitle.textContent = 'Přihlášení';
        submitBtn.textContent = 'Přihlásit se';
        switchBtn.textContent = 'Nemáte účet? Zaregistrujte se';
        switchBtn.setAttribute('data-type', 'register');
        registrationType.style.display = 'none';
        personForm.style.display = 'none';
        companyForm.style.display = 'none';
        // Přihlášení: e‑mail + heslo
        if (groupAuthEmail) { groupAuthEmail.style.display = ''; }
        if (authEmail) { authEmail.required = true; }
        
        // Odstranit required atribut ze skrytých polí při přihlášení
        toggleRequired(personForm, false);
        toggleRequired(companyForm, false);
        
        // Přepnout tlačítka a kroky
        if (btnSendPhoneCode) btnSendPhoneCode.style.display = 'none';
        if (btnAuthSubmit) btnAuthSubmit.style.display = 'none';
        if (submitBtn) submitBtn.style.display = '';
        // Skrytí telefonní řádky v přihlášení + zrušit required na telefonu
        if (authPhone) authPhone.required = false;
        if (phoneRow) phoneRow.style.display = 'none';
        if (phoneRight && phoneCode) phoneCode.style.display = 'none';
        
        // Zobrazit tlačítko Zapomenuté heslo při přihlášení
        const forgotPasswordLink = modal.querySelector('#forgotPasswordLink');
        if (forgotPasswordLink) forgotPasswordLink.style.display = '';

        console.log('✅ Modal nastaven pro přihlášení:', { 
            title: modalTitle.textContent, 
            submitBtn: submitBtn.textContent 
        });
    } else {
        modalTitle.textContent = 'Registrace';
        
        // Skrýt tlačítko Zapomenuté heslo při registraci
        const forgotPasswordLink = modal.querySelector('#forgotPasswordLink');
        if (forgotPasswordLink) forgotPasswordLink.style.display = 'none';
        modal.setAttribute('data-mode', 'register');
        submitBtn.textContent = 'Zaregistrovat se';
        switchBtn.textContent = 'Již máte účet? Přihlaste se';
        switchBtn.setAttribute('data-type', 'login');
        registrationType.style.display = 'block';
        if (groupAuthEmail) { groupAuthEmail.style.display = ''; }
        if (authEmail) { authEmail.required = true; }
        
        // Zobrazit formulář pro fyzickou osobu jako výchozí
        personForm.style.display = 'block';
        personForm.classList.add('visible');
        personForm.classList.remove('hidden');
        companyForm.style.display = 'none';
        companyForm.classList.add('hidden');
        companyForm.classList.remove('visible');
        
        // Zobrazit GDPR souhlas při registraci
        if (gdprConsent) {
            gdprConsent.style.display = 'block';
        }
        if (gdprCheckbox) {
            gdprCheckbox.required = true;
            gdprCheckbox.checked = false;
        }
        
        // Přepnout tlačítka a kroky
        if (btnSendPhoneCode) btnSendPhoneCode.style.display = '';
        if (btnAuthSubmit) btnAuthSubmit.style.display = 'none';
        // V režimu registrace primární submit "Zaregistrovat se" nepotřebujeme
        if (submitBtn) submitBtn.style.display = 'none';
        if (phoneRight) {
            if (phoneCode) phoneCode.style.display = 'none';
        }
        // Zobrazit telefonní řádku pro registraci + vyžadovat telefon
        if (authPhone) authPhone.required = true;
        if (phoneRow) phoneRow.style.display = '';
        if (authPhone && (!authPhone.value || authPhone.value.trim() === '')) {
            authPhone.value = '+420';
        }

        // Inicializace registrace - výchozí stav
        
        // Aktivovat tlačítko pro fyzickou osobu
        const typeButtons = document.querySelectorAll('.registration-type-btn');
        typeButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('.registration-type-btn[data-type="person"]').classList.add('active');
    }

    // Nastavit event listenery jen pokud ještě nebyly nastaveny
    if (!authModalEventsSetup) {
        setupAuthModalEvents();
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open'); // Přidat třídu pro CSS kontrolu
    
    // POZOR: Nastavit event listenery VŽDY po otevření modalu (i když se otevře přes hash)
    // To zajistí, že formulář bude fungovat správně
    setTimeout(() => {
        try {
            // Odstranit flag, aby se listenery nastavily znovu (důležité pro hash otevření)
            const authForm = document.getElementById('authForm');
            if (authForm && authForm.hasAttribute('data-listener-set')) {
                authForm.removeAttribute('data-listener-set');
            }
            setupEventListeners();
        } catch (e) {
            console.warn('setupEventListeners failed in showAuthModal', e);
        }
    }, 100);
    
    // Zajistit, aby se listener nastavil i po malém zpoždění (fallback)
    // Použít requestAnimationFrame pro lepší načasování
    requestAnimationFrame(() => {
        setTimeout(() => {
            const authForm = document.getElementById('authForm');
            if (authForm && !authForm.hasAttribute('data-listener-set')) {
                console.log('⚠️ Fallback: Nastavuji event listener po zpoždění');
                try { 
                    setupEventListeners(); 
                } catch (e) { 
                    console.warn('setupEventListeners failed in fallback', e); 
                }
            } else if (authForm) {
                // AuthForm už má listener - logy odstraněny
            } else {
                console.warn('⚠️ AuthForm nebyl nalezen v fallback');
            }
        }, 150);
    });
    
    // Dodatečný fallback - zkontrolovat po delším zpoždění
    setTimeout(() => {
        const authForm = document.getElementById('authForm');
        if (authForm && !authForm.hasAttribute('data-listener-set')) {
            console.log('⚠️ Dodatečný fallback: Nastavuji event listener po delším zpoždění');
            try { 
                setupEventListeners(); 
            } catch (e) { 
                console.warn('setupEventListeners failed in additional fallback', e); 
            }
        }
    }, 500);
    
    // Debug: Zkontrolovat formulář po otevření modalu a nastavit event listener
    setTimeout(() => {
        const authFormAfterOpen = modal.querySelector('#authForm');
        // ODSTRANĚNO: Duplicitní event listener - formulář už má listener v setupEventListeners()
        // Přidávání dalšího listeneru způsobovalo vícenásobné odesílání formuláře
    }, 100);
}

// Zavření auth modalu
function closeAuthModal() {
    try {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        
        // Zastavit propagaci eventů, aby se zabránilo rekurzi
        if (modal.style.display === 'none') return; // Už je zavřený
        
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        document.body.classList.remove('modal-open'); // Odstranit třídu pro CSS kontrolu
        
        // Vyčištění formuláře
        const form = document.getElementById('authForm');
        if (form) {
            form.reset();
        }
        
        // Odstranit hash z URL (pokud hash modal hook není dostupný, uděláme to zde)
        if (!window.hashModal || typeof window.hashModal.close !== 'function') {
            try {
                const newUrl = window.location.pathname + window.location.search;
                if (window.location.hash) {
                    window.history.replaceState(null, '', newUrl);
                }
            } catch (e) {
                console.warn('⚠️ Nepodařilo se odstranit hash z URL:', e);
            }
        }
    } catch (e) {
        console.error('Chyba při zavírání modalu:', e);
    }
}

// Export funkcí pro globální použití - ihned po definici
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.createAuthModal = createAuthModal;
window.setupAuthModalEvents = setupAuthModalEvents;

// Funkce pro kontrolu aktivního balíčku z databáze (globální)
window.checkUserPlanFromDatabase = async function(userId) {
    try {
        if (!userId || !window.firebaseDb) return null;
        
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', userId, 'profile', 'profile');
        const snap = await getDoc(profileRef);
        
        if (!snap.exists()) return null;
        
        const data = snap.data();
        const plan = data.plan;
        
        // Pokud nemá balíček, vrátit null
        if (!plan || plan === 'none') return null;
        
        // Kontrola, zda je balíček aktivní (planPeriodEnd je v budoucnosti)
        const planPeriodEnd = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
        const planCancelAt = data.planCancelAt ? (data.planCancelAt.toDate ? data.planCancelAt.toDate() : new Date(data.planCancelAt)) : null;
        
        // Pokud má zrušení naplánované a období skončilo, balíček není aktivní
        if (planCancelAt && planPeriodEnd && new Date() >= planPeriodEnd) {
            return null;
        }
        
        // Pokud je planPeriodEnd v minulosti, balíček už není aktivní
        if (planPeriodEnd && new Date() >= planPeriodEnd) {
            return null;
        }
        
        return plan;
    } catch (error) {
        console.error('Chyba při kontrole balíčku z databáze:', error);
        return null;
    }
};

// Export funkce pro globální použití
window.checkUserPlanFromDatabase = checkUserPlanFromDatabase;

// Zobrazení modalu pro přidání služby
async function showAddServiceModal() {
    // Gating: vyžaduje přihlášení a vybraný balíček
    const viewer = window.firebaseAuth?.currentUser;
    if (!viewer) {
        if (typeof window.showAuthRequiredModal === 'function') {
            window.showAuthRequiredModal();
        } else {
            showMessage('Pro přidání inzerátu se prosím přihlaste nebo registrujte.', 'error');
        }
        return;
    }
    
    // Kontrola balíčku přímo z databáze
    const plan = await checkUserPlanFromDatabase(viewer.uid);
    if (!plan) {
        // Nemá aktivní balíček – nasměrujeme na výběr balíčku
        showMessage('Nejdříve si vyberte balíček.', 'info');
        window.location.href = 'packages.html';
        return;
    }
    
    const modal = document.getElementById('addServiceModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Inicializace counteru pro popis inzerátu
    if (typeof initCharCounter === 'function') {
        setTimeout(() => {
            initCharCounter('serviceDescription', 'serviceDescriptionCounter', 600);
        }, 100);
    }
}

// Zavření modalu pro přidání služby
function closeAddServiceModal() {
    const modal = document.getElementById('addServiceModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Vyčištění formuláře
    const form = document.getElementById('addServiceForm');
    form.reset();
    
    // Reset counteru
    const counter = document.getElementById('serviceDescriptionCounter');
    if (counter) {
        counter.textContent = '600';
        if (counter.parentElement) {
            counter.parentElement.classList.remove('warning', 'error');
        }
    }
}

// Export dalších funkcí
window.showAddServiceModal = showAddServiceModal;
window.closeAddServiceModal = closeAddServiceModal;

// Zpracování chyb autentifikace
function handleAuthError(error) {
    let message = 'Došlo k chybě při autentifikaci.';
    
    // Extrahovat kód chyby z error.code nebo z error.message
    let errorCode = error.code;
    
    // Pokud nemáme code, zkusit extrahovat z message (např. "Firebase: Error (auth/provider-already-linked)")
    if (!errorCode && error.message) {
        const match = error.message.match(/auth\/([^\)]+)/);
        if (match) {
            errorCode = 'auth/' + match[1];
        }
    }
    
    // Pokud error nemá code, zkusit zprávu přímo
    if (!errorCode && error.message) {
        // Odstranit "Firebase: Error" prefix
        message = error.message.replace(/^Firebase:\s*Error\s*\([^\)]+\)\s*/i, '').trim();
        if (!message) {
            message = error.message;
        }
    } else {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                message = 'Účet s tímto emailem již existuje. Použijte jiný email nebo se přihlaste.';
                break;
            case 'auth/weak-password':
                message = 'Heslo je příliš slabé. Heslo musí obsahovat alespoň 6 znaků.';
                break;
            case 'auth/invalid-email':
                message = 'Neplatný formát emailu. Zadejte platný email (např. jmeno@domena.cz).';
                break;
            case 'auth/user-not-found':
                message = 'Uživatel s tímto emailem neexistuje. Zkontrolujte email nebo se zaregistrujte.';
                break;
            case 'auth/wrong-password':
                message = 'Nesprávné heslo. Zkuste to znovu nebo použijte obnovení hesla.';
                break;
            case 'auth/too-many-requests':
                message = 'Příliš mnoho neúspěšných pokusů. Zkuste to znovu později nebo obnovte heslo.';
                break;
            case 'auth/operation-not-allowed':
                message = 'Tento způsob přihlášení není povolen. Kontaktujte podporu.';
                break;
            case 'auth/network-request-failed':
                message = 'Chyba připojení k internetu. Zkontrolujte připojení a zkuste to znovu.';
                break;
            case 'auth/invalid-phone-number':
                message = 'Neplatný formát telefonního čísla. Zadejte telefon ve formátu +420XXXXXXXXX.';
                break;
            case 'auth/missing-phone-number':
                message = 'Telefonní číslo je povinné. Zadejte telefonní číslo.';
                break;
            case 'auth/invalid-verification-code':
                message = 'Neplatný ověřovací kód z SMS. Zkontrolujte kód a zkuste to znovu.';
                break;
            case 'auth/code-expired':
                message = 'Platnost ověřovacího kódu vypršela. Požádejte o nový kód.';
                break;
            case 'auth/session-expired':
                message = 'Vaše relace vypršela. Obnovte stránku a zkuste to znovu.';
                break;
            case 'auth/quota-exceeded':
                message = 'Byl překročen limit pro SMS. Zkuste to později.';
                break;
            case 'auth/captcha-check-failed':
                message = 'Ověření reCAPTCHA selhalo. Obnovte stránku a zkuste to znovu.';
                break;
            case 'auth/invalid-app-credential':
                message = 'Chyba konfigurace telefonního ověření. Kontaktujte podporu.';
                break;
            case 'auth/missing-verification-code':
                message = 'Chybí ověřovací kód. Zadejte kód z SMS.';
                break;
            case 'auth/invalid-verification-id':
                message = 'Neplatné ID ověření. Začněte registraci znovu.';
                break;
            case 'auth/missing-continue-uri':
                message = 'Chybí URL pro pokračování. Kontaktujte podporu.';
                break;
            case 'auth/invalid-continue-uri':
                message = 'Neplatná URL pro pokračování. Kontaktujte podporu.';
                break;
            case 'auth/unauthorized-continue-uri':
                message = 'Neautorizovaná URL. Kontaktujte podporu.';
                break;
            case 'auth/requires-recent-login':
                message = 'Pro tuto operaci je potřeba se znovu přihlásit.';
                break;
            case 'auth/provider-already-linked':
                message = 'Tento účet je již propojen s jiným způsobem přihlášení. Použijte jiný způsob přihlášení nebo kontaktujte podporu.';
                break;
            case 'auth/credential-already-in-use':
                message = 'Tyto přihlašovací údaje jsou již používány jiným účtem. Použijte jiné údaje nebo se přihlaste k existujícímu účtu.';
                break;
            case 'auth/account-exists-with-different-credential':
                message = 'Účet s tímto emailem již existuje, ale je propojen s jiným způsobem přihlášení. Použijte správný způsob přihlášení.';
                break;
            case 'auth/popup-closed-by-user':
                message = 'Přihlášení bylo zrušeno. Zkuste to znovu.';
                break;
            case 'auth/popup-blocked':
                message = 'Vyskakovací okno bylo zablokováno prohlížečem. Povolte vyskakovací okna a zkuste to znovu.';
                break;
            case 'auth/cancelled-popup-request':
                message = 'Přihlášení bylo zrušeno. Zkuste to znovu.';
                break;
            case 'auth/invalid-credential':
                message = 'Neplatné přihlašovací údaje. Zkontrolujte email a heslo.';
                break;
            case 'auth/user-disabled':
                message = 'Tento účet byl deaktivován. Kontaktujte podporu.';
                break;
            case 'auth/operation-not-allowed':
                message = 'Tento způsob přihlášení není povolen. Kontaktujte podporu.';
                break;
            default:
                // Pokud je to známá chyba s message, použít ji
                if (error.message && error.message !== 'Firebase: Error (auth/unknown)') {
                    // Odstranit "Firebase: Error (auth/...)" prefix a extrahovat čitelnou zprávu
                    message = error.message
                        .replace(/^Firebase:\s*Error\s*\([^\)]+\)\s*/i, '')
                        .replace(/^auth\/[^:]+:\s*/i, '')
                        .trim();
                    
                    // Pokud po úpravě není zpráva, použít obecnou zprávu
                    if (!message || message === error.message) {
                        message = `Chyba při autentifikaci: ${errorCode || 'neznámá chyba'}. Zkuste to znovu nebo kontaktujte podporu.`;
                    }
                } else {
                    message = `Chyba při autentifikaci: ${errorCode || 'neznámá chyba'}. Zkuste to znovu nebo kontaktujte podporu.`;
                }
                break;
        }
    }
    
    console.error('❌ Auth error:', errorCode || error.code, error.message);
    showMessage(message, 'error');
}

// Zpracování zapomenutého hesla
async function handleForgotPassword() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    
    const authEmail = modal.querySelector('#authEmail');
    if (!authEmail) {
        showMessage('Chyba: Emailové pole není dostupné.', 'error');
        return;
    }
    
    const email = authEmail.value.trim();
    if (!email) {
        showMessage('Zadejte prosím emailovou adresu pro obnovení hesla.', 'error');
        authEmail.focus();
        return;
    }
    
    // Základní validace emailu
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Zadejte prosím platnou emailovou adresu.', 'error');
        authEmail.focus();
        return;
    }
    
    try {
        if (!firebaseAuth) {
            showMessage('Chyba: Firebase není načten. Obnovte stránku.', 'error');
            return;
        }
        
        const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        console.log('📧 Odesílám email pro obnovení hesla na:', email);
        
        await sendPasswordResetEmail(firebaseAuth, email, {
            // URL pro redirect po kliknutí na odkaz (volitelné)
            url: window.location.origin + '/auth-action.html',
            // Handle kódy v URL (můžete použít vlastní stránku)
            handleCodeInApp: false
        });
        
        console.log('✅ Email pro obnovení hesla byl úspěšně odeslán');
        
        showMessage(`📧 Email s odkazem pro obnovení hesla byl odeslán na adresu ${email}. Zkontrolujte prosím svou poštovní schránku (včetně složky Spam).`, 'success', { timeout: 10000 });
        
        // Zavřít modal po úspěšném odeslání
        setTimeout(() => {
            closeAuthModal();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Chyba při odesílání reset emailu:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        
        let errorMessage = 'Nepodařilo se odeslat email pro obnovení hesla.';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'Uživatel s tímto emailem neexistuje. Zkontrolujte email nebo se zaregistrujte.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Neplatný formát emailu. Zadejte platný email.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Příliš mnoho pokusů. Počkejte prosím a zkuste to znovu později.';
        } else if (error.code === 'auth/invalid-continue-uri') {
            errorMessage = 'Neplatná URL pro redirect. Kontaktujte podporu.';
        } else if (error.code === 'auth/unauthorized-continue-uri') {
            errorMessage = 'URL pro redirect není autorizována. Přidejte doménu do Firebase Console → Authentication → Settings → Authorized domains.';
        } else {
            errorMessage = `Chyba: ${error.message || error.code || 'Neznámá chyba'}. Zkontrolujte konzoli pro více informací.`;
        }
        
        showMessage(errorMessage, 'error', { timeout: 10000 });
    }
}

// Překlad běžných chyb phone auth do srozumitelných zpráv
function humanizePhoneError(error) {
    // Extrahovat kód chyby z error.code nebo z error.message
    let errorCode = error?.code || '';
    
    // Pokud nemáme code, zkusit extrahovat z message (např. "Firebase: Error (auth/too-many-requests)")
    if (!errorCode && error?.message) {
        const match = error.message.match(/auth\/([^\)\s]+)/);
        if (match) {
            errorCode = 'auth/' + match[1];
        }
    }
    
    switch (errorCode) {
        case 'auth/invalid-phone-number':
            return 'Neplatné telefonní číslo.';
        case 'auth/missing-phone-number':
            return 'Chybí telefonní číslo.';
        case 'auth/too-many-requests':
            return 'Příliš mnoho pokusů o odeslání SMS. Firebase má ochranu proti zneužití - počkejte prosím 10-60 minut a zkuste to znovu, nebo použijte jiné telefonní číslo. Pro testování můžete použít testovací telefonní čísla z Firebase Console.';
        case 'auth/captcha-check-failed':
            return 'Ověření reCAPTCHA selhalo. Obnovte stránku a zkuste to znovu.';
        case 'auth/invalid-verification-code':
            return 'Neplatný kód z SMS.';
        case 'auth/code-expired':
            return 'Platnost kódu vypršela. Požádejte o nový.';
        case 'auth/quota-exceeded':
            return 'Byl překročen limit pro SMS. Zkuste to později.';
        case 'auth/invalid-app-credential':
            console.error('❌ Firebase telefonní autentifikace není správně nakonfigurovaná. Zkontrolujte:');
            console.error('1. Firebase Console → Authentication → Sign-in method → Phone musí být povoleno');
            console.error('2. Firebase Console → Authentication → Settings → Authorized domains musí obsahovat localhost');
            console.error('3. Zkontrolujte, že máte správný API klíč a projekt ID');
            return 'Telefonní ověření není správně nakonfigurované. Prosím zkontrolujte nastavení Firebase projektu. Pro více informací otevřete konzoli.';
        case 'auth/captcha-check-failed':
            return 'Ověření reCAPTCHA selhalo. Obnovte stránku a zkuste to znovu.';
        default:
            // Pokud je to známá chyba s message, použít ji (ale odstranit Firebase prefix)
            if (error?.message && error.message !== 'Firebase: Error (auth/unknown)') {
                let cleanMessage = error.message
                    .replace(/^Firebase:\s*Error\s*\([^\)]+\)\s*/i, '')
                    .replace(/^auth\/[^:]+:\s*/i, '')
                    .trim();
                
                // Pokud po úpravě není zpráva, použít obecnou zprávu
                if (!cleanMessage || cleanMessage === error.message) {
                    cleanMessage = `Chyba při telefonním ověření: ${errorCode || 'neznámá chyba'}. Zkuste to znovu nebo kontaktujte podporu.`;
                }
                return cleanMessage;
            }
            return `Chyba při telefonním ověření: ${errorCode || 'neznámá chyba'}. Zkuste to znovu nebo kontaktujte podporu.`;
    }
}

// Detekce in-app browseru (Instagram, Facebook, Messenger, TikTok)
function isInAppBrowser() {
    if (typeof navigator === 'undefined') return false;
    
    const ua = navigator.userAgent || navigator.vendor || '';
    const isInstagram = ua.includes('Instagram');
    const isFacebook = ua.includes('FBAN') || ua.includes('FBAV');
    
    return isInstagram || isFacebook;
}

// Zobrazení varování pro in-app browser
function showInAppBrowserWarning(action = 'registrace') {
    // Vytvořit modal overlay
    const modal = document.createElement('div');
    modal.id = 'inAppBrowserWarning';
    modal.style.cssText = `
        position: fixed !important;
        inset: 0 !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 100% !important;
        min-height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        background: radial-gradient(1200px 600px at 70% 10%, rgba(247,124,0,0.18), transparent 60%), rgba(0,0,0,0.65) !important;
        backdrop-filter: blur(8px) saturate(110%) !important;
        z-index: 100000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        animation: fadeIn 0.25s ease-in !important;
    `;
    
    // Přidat keyframes pro animaci (pokud neexistují)
    if (!document.getElementById('inAppBrowserWarningStyles')) {
        const style = document.createElement('style');
        style.id = 'inAppBrowserWarningStyles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    const actionText = action === 'registrace' ? 'registraci' : action === 'přihlášení' ? 'přihlášení' : action === 'platba' ? 'platbu' : 'tuto akci';
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: min(380px, calc(100vw - 40px));
            width: calc(100% - 40px);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
            animation: slideUp 0.3s ease-out;
            position: relative;
            margin: 20px;
            flex-shrink: 0;
        ">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="
                    width: 56px;
                    height: 56px;
                    background: linear-gradient(135deg, #f77c00 0%, #ff9500 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    font-size: 28px;
                    box-shadow: 0 4px 16px rgba(247, 124, 0, 0.3);
                ">⚠️</div>
                <h2 style="
                    margin: 0 0 10px 0;
                    font-size: 20px;
                    font-weight: 700;
                    color: #1f2937;
                    line-height: 1.3;
                ">Tento prohlížeč není podporován</h2>
                <p style="
                    margin: 0;
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.5;
                ">
                    Pro dokončení ${actionText} prosím otevřete web v Safari nebo Chrome.
                </p>
            </div>
            
            <div style="
                background: #f9fafb;
                border-radius: 10px;
                padding: 14px;
                margin-bottom: 20px;
                border: 1px solid #e5e7eb;
            ">
                <p style="
                    margin: 0;
                    color: #4b5563;
                    font-size: 13px;
                    line-height: 1.6;
                    text-align: center;
                ">
                    <strong style="color: #374151;">Jak otevřít v prohlížeči:</strong><br>
                    V menu aplikace zvolte "Otevřít v Safari/Chrome" nebo použijte tlačítko sdílet
                </p>
            </div>
            
            <div style="display: flex; gap: 10px; flex-direction: column;">
                <button class="in-app-browser-close-btn"
                        style="
                            padding: 10px 20px;
                            background: transparent;
                            border: 1px solid #d1d5db;
                            color: #6b7280;
                            border-radius: 8px;
                            font-weight: 500;
                            font-size: 14px;
                            cursor: pointer;
                            transition: background 0.2s, border-color 0.2s;
                        "
                        onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';"
                        onmouseout="this.style.background='transparent'; this.style.borderColor='#d1d5db';">
                    Zavřít
                </button>
            </div>
        </div>
    `;
    
    // Zablokovat scroll na body a html
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Přidat overlay přímo na body, ale zajistit, že je přes vše
    document.body.appendChild(modal);
    
    // Zavření při kliknutí na overlay
    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = originalBodyOverflow || '';
        document.documentElement.style.overflow = originalHtmlOverflow || '';
    };
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Zavření při ESC
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Zavření při kliknutí na tlačítko Zavřít
    const closeBtn = modal.querySelector('.in-app-browser-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
}

// Exportovat funkce globálně
window.isInAppBrowser = isInAppBrowser;
window.showInAppBrowserWarning = showInAppBrowserWarning;

// Zobrazení zprávy (banner ve stylu pejska s gradientem)
function showMessage(message, type = 'info', options = {}) {
    console.log(`💬 Zobrazuji zprávu: ${message} (${type})`);
    const timeoutMs = typeof options.timeout === 'number' ? options.timeout : 5000;
    
    // Kontejner (pro snadné centrování a stacking)
    let host = document.getElementById('notice-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'notice-host';
        host.style.cssText = `
            position: fixed;
            top: 120px;
            right: 24px;
            left: auto;
            transform: none;
            z-index: 10050;
            width: min(90vw, 520px);
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: flex-end;
            pointer-events: none;
        `;
        document.body.appendChild(host);
    }
    
    const banner = document.createElement('div');
    banner.className = `notice-banner notice-${type}`;
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.pointerEvents = 'auto';
    banner.innerHTML = `
        <div class="notice-hero">
            <img src="fotky/bulldogo-overlay.png" alt="" aria-hidden="true">
        </div>
        <div class="notice-content">
            <strong class="notice-title">${message}</strong>
            <button class="notice-close" aria-label="Zavřít" title="Zavřít">×</button>
        </div>
    `;
    
    // Zavření
    const close = () => {
        try {
            banner.classList.add('closing');
            setTimeout(() => banner.remove(), 180);
        } catch (_) {
            banner.remove();
        }
    };
    banner.querySelector('.notice-close')?.addEventListener('click', close);
    if (timeoutMs > 0) setTimeout(close, timeoutMs);
    
    host.appendChild(banner);
}

// Helper funkce pro kontrolu aktivního předplatného
async function checkActiveSubscription(uid) {
    try {
        const db = firebaseDb || window.firebaseDb;
        if (!db) {
            console.error('❌ checkActiveSubscription: firebaseDb není dostupný');
            return { hasSubscription: false, plan: null, expired: false };
        }
        
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(db, 'users', uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        console.log('🔍 checkActiveSubscription pro uid:', uid, 'profil existuje:', profileSnap.exists());
        
        if (!profileSnap.exists()) {
            console.log('❌ Profil neexistuje - žádné předplatné');
            return { hasSubscription: false, plan: null, expired: false };
        }
        
        const profile = profileSnap.data();
        const plan = profile.plan; // 'hobby' nebo 'business'
        
        console.log('📋 Aktuální plán:', plan, 'planPeriodEnd:', profile.planPeriodEnd);
        
        if (!plan || (plan !== 'hobby' && plan !== 'business')) {
            console.log('❌ Žádný aktivní plán (plan =', plan, ')');
            return { hasSubscription: false, plan: null, expired: false };
        }
        
        // Zkontrolovat, zda předplatné nevypršelo
        const planPeriodEnd = profile.planPeriodEnd;
        if (planPeriodEnd) {
            const endDate = planPeriodEnd.toDate ? planPeriodEnd.toDate() : new Date(planPeriodEnd);
            console.log('📅 Datum vypršení:', endDate, 'Nyní:', new Date());
            if (endDate < new Date()) {
                console.log('❌ Předplatné vypršelo');
                return { hasSubscription: false, plan: plan, expired: true };
            }
        }
        
        console.log('✅ Předplatné aktivní');
        return { hasSubscription: true, plan: plan, expired: false };
    } catch (error) {
        console.error('❌ Chyba při kontrole předplatného:', error);
        return { hasSubscription: false, plan: null, expired: false };
    }
}

// Globálně dostupná funkce pro kontrolu předplatného
window.checkActiveSubscription = checkActiveSubscription;

// Přidání služby
async function addService(serviceData) {
    try {
        if (!authCurrentUser) {
            showMessage('Musíte být přihlášeni pro přidání služby.', 'error');
            return false;
        }

        const db = firebaseDb || window.firebaseDb;
        if (!db) {
            showMessage('Chyba: Databáze není dostupná.', 'error');
            return false;
        }

        const { addDoc, collection, setDoc, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');

        // Kontrola aktivního předplatného - POVINNÁ
        console.log('🔒 Kontroluji předplatné před přidáním inzerátu...');
        const subscriptionCheck = await checkActiveSubscription(authCurrentUser.uid);
        console.log('🔒 Výsledek kontroly:', subscriptionCheck);
        
        if (!subscriptionCheck.hasSubscription) {
            if (subscriptionCheck.expired) {
                showMessage('⚠️ Vaše předplatné vypršelo. Pro přidávání inzerátů si prosím obnovte balíček.', 'error');
            } else {
                showMessage('⚠️ Pro přidávání inzerátů potřebujete aktivní předplatné (Hobby nebo Firma).', 'error');
            }
            // Přesměrovat na stránku balíčků po 2 sekundách
            setTimeout(() => {
                window.location.href = 'packages.html';
            }, 2000);
            return false; // DŮLEŽITÉ: vrátit false pro zastavení
        }

        // Kontrola zakázaných slov
        if (window.ProfanityFilter) {
            const profanityCheck = window.ProfanityFilter.checkMultiple({
                title: serviceData.title || '',
                description: serviceData.description || ''
            });
            
            if (!profanityCheck.isClean) {
                const bannedWords = profanityCheck.bannedWords.join(', ');
                console.warn('🚫 Blokováno zakázanými slovy:', bannedWords);
                console.warn('🚫 Detaily:', profanityCheck.fields);
                showMessage(`⚠️ Váš text obsahuje nevhodný obsah: "${bannedWords}". Prosím upravte název nebo popis inzerátu.`, 'error');
                return false;
            }
        }

        // Zkontrolovat, zda uživatel existuje, pokud ne, vytvořit ho
        const userRef = doc(db, 'users', authCurrentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // Vytvořit root dokument uživatele
            await setDoc(userRef, {
                uid: authCurrentUser.uid,
                email: authCurrentUser.email,
                createdAt: new Date()
            });
            
            // Vytvořit profil uživatele
            await setDoc(doc(db, 'users', authCurrentUser.uid, 'profile', 'profile'), {
                name: authCurrentUser.email.split('@')[0],
                email: authCurrentUser.email,
                balance: 1000,
                createdAt: new Date()
            });
        }

        // Nahrát obrázky do Firebase Storage
        // Zkontrolovat, zda Storage je dostupné
        if (!window.firebaseApp) {
            throw new Error('Firebase App není inicializované');
        }
        
        // Použít globálně inicializované Storage (musí existovat z firebase-init.js)
        if (!window.firebaseStorage) {
            const { getStorage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            window.firebaseStorage = getStorage(window.firebaseApp);
            console.log('✅ Vytvořil jsem novou Storage instanci');
        }
        
        const storage = window.firebaseStorage;
        const uploadedImages = [];
        
        const bucketName = window.firebaseApp?.options?.storageBucket;
        console.log('📦 Storage inicializace:', {
            app: !!window.firebaseApp,
            storage: !!storage,
            bucket: bucketName || 'default',
            storageUrl: storage?._delegate?._host || 'unknown'
        });
        
        // Kontrola, zda Storage bucket existuje
        if (!bucketName) {
            throw new Error('Storage bucket není nakonfigurovaný v Firebase konfiguraci');
        }
        
        // Debug: zkontrolovat Storage instance
        if (storage) {
            console.log('📦 Storage instance detaily:', {
                bucket: bucketName,
                host: storage?._delegate?._host,
                protocol: storage?._delegate?._protocol
            });
        }
        
        // Nahrát náhledový obrázek, nebo použít výchozí URL bez uploadu
        console.log('🔍 Kontrola previewImage:', {
            hasPreviewImage: !!serviceData.previewImage,
            previewImageType: typeof serviceData.previewImage,
            isFile: serviceData.previewImage instanceof File,
            isBlob: serviceData.previewImage instanceof Blob,
            name: serviceData.previewImage?.name,
            size: serviceData.previewImage?.size
        });
        if (serviceData.previewImage) {
            try {
                console.log('📸 Nahrávám náhledový obrázek...', {
                    fileName: serviceData.previewImage.name,
                    fileSize: serviceData.previewImage.size,
                    fileType: serviceData.previewImage.type
                });
                const fileName = `services/${authCurrentUser.uid}/${Date.now()}_preview.jpg`;
                console.log('📍 Cesta k souboru:', fileName);
                const previewRef = ref(storage, fileName);
                console.log('📤 Začínám nahrávání...');
                const previewSnapshot = await uploadBytes(previewRef, serviceData.previewImage, {
                    contentType: serviceData.previewImage.type || 'image/jpeg'
                });
                console.log('✅ Upload úspěšný, získávám URL...');
                console.log('🔍 previewSnapshot.ref:', previewSnapshot.ref);
                console.log('🔍 previewSnapshot.ref.fullPath:', previewSnapshot.ref.fullPath);
                console.log('🔍 previewSnapshot.ref.name:', previewSnapshot.ref.name);
                console.log('🔍 Očekávaná cesta:', fileName);
                console.log('🔍 Shoduje se fullPath s očekávanou cestou?', previewSnapshot.ref.fullPath === fileName);
                const previewUrl = await getDownloadURL(previewSnapshot.ref);
                console.log('🔗 Získaná URL:', previewUrl);
                console.log('🔗 URL obsahuje token:', previewUrl.includes('token='));
                console.log('🔗 URL obsahuje správný název:', previewUrl.includes(fileName.split('/').pop()));
                uploadedImages.push({
                    url: previewUrl,
                    isPreview: true,
                    name: serviceData.previewImage.name
                });
                console.log('✅ Náhledový obrázek nahrán:', previewUrl);
                console.log('✅ uploadedImages.length po přidání preview:', uploadedImages.length);
            } catch (uploadError) {
                console.error('❌ Chyba při nahrávání náhledového obrázku:', uploadError);
                console.error('❌ Error code:', uploadError.code);
                console.error('❌ Error message:', uploadError.message);
                console.error('❌ Error serverResponse:', uploadError.serverResponse);
                
                let errorMessage = 'Nepodařilo se nahrát náhledový obrázek. ';
                if (uploadError.code === 'storage/unauthorized') {
                    errorMessage += 'Nemáte oprávnění k nahrávání. Zkontrolujte Storage Rules.';
                } else if (uploadError.code === 'storage/unknown') {
                    errorMessage += 'Storage není dostupné. Zkontrolujte, zda je Storage povolené v Firebase projektu.';
                } else {
                    errorMessage += `Chyba: ${uploadError.message || 'Neznámá chyba'}`;
                }
                
                showMessage(errorMessage, 'error');
                throw uploadError; // Přerušit proces přidávání služby
            }
        } else if (serviceData.defaultPreviewUrl) {
            uploadedImages.push({
                url: serviceData.defaultPreviewUrl,
                isPreview: true,
                name: 'default'
            });
        }
        
        // Nahrát další obrázky
        if (serviceData.additionalImages && serviceData.additionalImages.length > 0) {
            console.log('📸 Nahrávám další obrázky...', serviceData.additionalImages.length);
            try {
                for (let i = 0; i < serviceData.additionalImages.length; i++) {
                    const image = serviceData.additionalImages[i];
                    const imageRef = ref(storage, `services/${authCurrentUser.uid}/${Date.now()}_${i}.jpg`);
                    const imageSnapshot = await uploadBytes(imageRef, image, {
                        contentType: image.type || 'image/jpeg'
                    });
                    const imageUrl = await getDownloadURL(imageSnapshot.ref);
                    uploadedImages.push({
                        url: imageUrl,
                        isPreview: false,
                        name: image.name
                    });
                }
                console.log('✅ Všechny další obrázky nahrány');
            } catch (uploadError) {
                console.error('❌ Chyba při nahrávání dalších obrázků:', uploadError);
                showMessage('Nepodařilo se nahrát některé obrázky. Zkuste to znovu.', 'error');
                throw uploadError; // Přerušit proces přidávání služby
            }
        }

        // Vytvořit službu s URL obrázků
        console.log('💾 Příprava k uložení inzerátu do databáze...');
        console.log('💾 Počet nahráných obrázků:', uploadedImages.length);
        console.log('💾 Nahráné obrázky:', uploadedImages);
        
        const { serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const serviceToSave = {
            ...serviceData,
            userId: authCurrentUser.uid,
            userEmail: authCurrentUser.email,
            createdAt: serverTimestamp(),
            status: 'active',
            images: uploadedImages
        };
        
        // Odstranit File objekty před uložením do Firestore
        delete serviceToSave.previewImage;
        delete serviceToSave.additionalImages;

        console.log('💾 Ukládám inzerát do databáze...');
        const docRef = await addDoc(collection(db, 'users', authCurrentUser.uid, 'inzeraty'), serviceToSave);
        console.log('✅ Inzerát úspěšně uložen do databáze, ID:', docRef.id);
        console.log('✅ Uložené obrázky:', serviceToSave.images);

        showMessage('Služba byla úspěšně přidána!', 'success');
        closeAddServiceModal();
        
        // Real-time listener automaticky aktualizuje seznam
        return true; // Úspěch
    } catch (error) {
        console.error('Chyba při přidávání služby:', error);
        showMessage('Došlo k chybě při přidávání služby.', 'error');
        return false; // Neúspěch
    }
}

// Načtení uživatelského profilu z Firestore (users/{uid}/profile/profile)
async function loadUserProfile(uid) {
    try {
        if (!window.firebaseDb) {
            console.warn('⚠️ Firebase DB not available');
            return null;
        }
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
        const snap = await getDoc(profileRef);
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        console.error('Chyba při načítání uživatelského profilu:', error);
        return null;
    }
}

// Přepínání dropdown menu
function toggleUserDropdown() {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Zavření dropdown menu při kliknutí mimo něj
function closeUserDropdown() {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// Načtení služeb z databáze
async function loadServices() {
    try {
        const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const servicesSnapshot = await getDocs(collection(firebaseDb, 'services'));
        const services = [];
        
        servicesSnapshot.forEach((doc) => {
            services.push({ id: doc.id, ...doc.data() });
        });
        
        // Zde můžete aktualizovat UI se seznamem služeb
        console.log('Načtené služby:', services);
        
        return services;
    } catch (error) {
        console.error('Chyba při načítání služeb:', error);
    }
}

// Event listenery - přesunuto do initAuth funkce
// POZOR: Tato funkce je specifická pro auth formulář, ne pro obecné event listenery
function setupEventListeners() {
    // Auth formulář - POUZE JEDEN LISTENER (odstraněny duplicity)
    const authForm = document.getElementById('authForm');
    
    if (authForm) {
        // Pokud už má listener, neopakovat
        if (authForm.hasAttribute('data-listener-set')) {
            return;
        }
        
        // Odstranit existující listenery - klonovat formulář a nahradit
        const newForm = authForm.cloneNode(true);
        authForm.parentNode.replaceChild(newForm, authForm);
        const cleanAuthForm = document.getElementById('authForm');
		
		// Po klonování se ztratí listenery na tlačítkách typů registrace.
		// Znovu je navážeme, aby šlo přepnout na „Firma".
		try {
			setupRegistrationTypeSelection();
		} catch (e) {
			console.warn('⚠️ Nepodařilo se znovu navázat registration-type listenery:', e?.message || e);
		}
		
		// Po klonování se ztratí listener na tlačítku Zapomenuté heslo.
		// Znovu ho navážeme.
		try {
			const btnForgotPassword = cleanAuthForm.querySelector('#btnForgotPassword');
			if (btnForgotPassword) {
				const newBtn = btnForgotPassword.cloneNode(true);
				btnForgotPassword.parentNode.replaceChild(newBtn, btnForgotPassword);
				newBtn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation();
					handleForgotPassword();
				});
			}
		} catch (e) {
			console.warn('⚠️ Nepodařilo se znovu navázat forgot-password listener:', e?.message || e);
		}
        
        // Auth formulář připraven pro event listener
        
        // Označit, že listener je nastaven
        cleanAuthForm.setAttribute('data-listener-set', 'true');
        
        // Přidat listener pouze jednou
        // Použít capture phase pro zachycení eventu dříve než ostatní listenery
        cleanAuthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Zastavit propagaci eventu
            e.stopImmediatePropagation(); // Zastavit všechny další listenery
            
            // Zamezit vícenásobnému odesílání
            const submitBtn = cleanAuthForm.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) {
                return false;
            }
            
            if (submitBtn) {
                submitBtn.disabled = true;
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Zpracovávám...';
            }
            
            const formData = new FormData(cleanAuthForm);
            const email = formData.get('email');
            const password = formData.get('password');
            
            const modalEl = document.getElementById('authModal');
            const mode = modalEl?.getAttribute('data-mode') || '';
            const isLogin = mode === 'login';
            
            try {
                if (isLogin) {
                    await login(email, password);
                } else {
                    // U registrace submit už nevolá registraci; používáme tlačítko pro telefonní ověření
                }
            } catch (error) {
                console.error('❌ Chyba při zpracování formuláře:', error);
            } finally {
                // Obnovit tlačítko
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = isLogin ? 'Přihlásit se' : 'Zaregistrovat se';
                }
            }
            
            return false; // Dodatečná ochrana na konci
        }, { capture: true }); // Použít capture phase pro zachycení eventu dříve
    }
    // Tlačítko: Pokračovat na ověření telefonního čísla
    const btnSendPhoneCode = document.getElementById('btnSendPhoneCode');
    if (btnSendPhoneCode) {
        btnSendPhoneCode.addEventListener('click', async () => {
            try {
                // Validace vstupů kroku 1
                const form = document.getElementById('authForm');
                const formData = new FormData(form);

                const email = (formData.get('email') || '').toString().trim();
                const password = (formData.get('password') || '').toString();
                const activeTypeBtn = document.querySelector('.registration-type-btn.active');
                const userType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'person';
                const phone = (formData.get('phone') || '').toString().trim();
                const ico = (formData.get('ico') || '').toString().trim();

                // Validace emailu
                if (!email) {
                    showMessage('Email je povinný. Zadejte email.', 'error');
                    return;
                }
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showMessage('Neplatný formát emailu. Zadejte platný email (např. jmeno@domena.cz).', 'error');
                    return;
                }
                
                // Validace hesla
                if (!password) {
                    showMessage('Heslo je povinné. Zadejte heslo.', 'error');
                    return;
                }
                
                if (password.length < 6) {
                    showMessage('Heslo musí obsahovat alespoň 6 znaků.', 'error');
                    return;
                }
                
                // Validace telefonu
                if (!phone) {
                    showMessage('Telefon je povinný. Zadejte telefonní číslo.', 'error');
                    return;
                }
                // Ověřit IČO pro firemní registraci (musí být již ověřeno před odesláním)
                if (userType === 'company') {
                    if (!window.__icoVerified || window.__icoVerifiedValue !== ico) {
                        showMessage('Nejdříve musíte ověřit IČO tlačítkem "Ověřit".', 'error');
                        return;
                    }
                    // Dvojité ověření pro jistotu
                    const icoCheck = await validateICOWithARES(ico);
                    if (!icoCheck.ok) {
                        showMessage(icoCheck.reason || 'IČO se nepodařilo ověřit.', 'error');
                        window.__icoVerified = false;
                        toggleCompanyFormFields(true);
                        return;
                    }
                }
                if (!phone.startsWith('+') && !phone.startsWith('00') && !phone.startsWith('420')) {
                    showMessage('Telefon uveďte v mezinárodním formátu (např. +420...).', 'error');
                    return;
                }

                // Normalizovat a ověřit unikátnost telefonu ještě před odesláním SMS
                const normalizedPhone = normalizePhone(phone);
                // Zabránit odeslání jen s předvolbou bez čísla
                if (normalizedPhone === '+420') {
                    showMessage('Doplňte telefonní číslo za předvolbou +420.', 'error');
                    return;
                }
                const available = await isPhoneAvailable(normalizedPhone);
                if (!available) {
                    showMessage('Toto telefonní číslo je již používáno jiným účtem.', 'error');
                    return;
                }
                
                // DŮLEŽITÉ: Uložit data formuláře do sessionStorage před odesláním OTP
                // Toto zajistí, že data přežijí mezi fázemi (i při unmountu modalu/redirectu)
                console.log('[REGISTER] 💾 Ukládám data formuláře do sessionStorage před OTP');
                const registrationPayload = {
                    email: email,
                    password: password,
                    phone: normalizedPhone,
                    userType: userType,
                    firstName: (formData.get('firstName') || '').toString().trim(),
                    lastName: (formData.get('lastName') || '').toString().trim(),
                    birthDate: (formData.get('birthDate') || '').toString().trim(),
                    companyName: (formData.get('companyName') || '').toString().trim(),
                    ico: ico,
                    dic: (formData.get('dic') || '').toString().trim(),
                    businessType: (formData.get('businessType') || '').toString().trim(),
                    companyAddress: (formData.get('companyAddress') || '').toString().trim(),
                    businessDescription: (formData.get('businessDescription') || '').toString().trim(),
                    consentAccepted: true, // Bude ověřeno později
                    pathname: window.location.pathname,
                    hash: window.location.hash,
                    timestamp: Date.now()
                };
                
                try {
                    sessionStorage.setItem('pendingRegistrationPayload', JSON.stringify(registrationPayload));
                    console.log('[REGISTER] ✅ Data uložena do sessionStorage:', Object.keys(registrationPayload));
                } catch (storageError) {
                    console.error('[REGISTER] ❌ Chyba při ukládání do sessionStorage:', storageError);
                    // Pokračovat i při chybě, ale data se mohou ztratit
                }

                // Lazy load potřebných funkcí (Firebase v10.7.1 v projektu)
                const authMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                const { RecaptchaVerifier, signInWithPhoneNumber } = authMod;

                // Zjistit, zda používáme DEV bypass (testovací čísla)
                const devBypass = !!(firebaseAuth?.settings?.appVerificationDisabledForTesting);

                // Vždy vytvořit čistou reCAPTCHA instanci (prevence DUPE)
                try { if (recaptchaVerifier) { await recaptchaVerifier.clear(); } } catch (_) {}
                recaptchaVerifier = null;
                const containerId = 'recaptcha-container';
                const container = document.getElementById(containerId);
                if (!container) {
                    showMessage('Chybí reCAPTCHA kontejner v DOM.', 'error');
                    return;
                }
                
                // Inicializace verifieru
                recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
                    size: 'invisible',
                    callback: () => {},
                    'expired-callback': () => {
                        console.warn('⚠️ reCAPTCHA expired');
                        if (!devBypass) showMessage('Ověření reCAPTCHA vypršelo, zkuste to znovu.', 'error');
                    }
                });
                
                // Render/verify POUZE mimo devBypass
                btnSendPhoneCode.disabled = true;
                btnSendPhoneCode.textContent = 'Inicializuji ověření...';
                if (!devBypass) {
                    try { 
                        // Renderování a ověřování reCAPTCHA
                        await recaptchaVerifier.render();
                        await recaptchaVerifier.verify();
                        await new Promise(resolve => setTimeout(resolve, 300));
                    } catch (renderError) {
                        console.error('❌ Chyba při render/verify reCAPTCHA:', renderError);
                        showMessage('reCAPTCHA se nepodařilo inicializovat. Přidejte doménu do Authorized domains nebo použijte testovací telefon.', 'error');
                        throw renderError;
                    }
                } else {
                    console.log('🧪 Dev bypass aktivní: reCAPTCHA se nerenederuje ani neověřuje (použijte test telefonní čísla).');
                }

                btnSendPhoneCode.textContent = 'Odesílám SMS...';

                // Odeslat SMS s podrobným error handlingem
                try {
                    phoneConfirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, recaptchaVerifier);
                } catch (smsError) {
                    // Logovat jen zpracovanou chybu, ne původní Firebase chybu
                    const humanizedError = humanizePhoneError(smsError);
                    console.error('❌ Chyba při odesílání SMS:', humanizedError);
                    
                    // Pro auth/invalid-app-credential přidat specifické instrukce
                    if (smsError?.code === 'auth/invalid-app-credential') {
                        console.error('🔧 ŘEŠENÍ: Zkontrolujte v Firebase Console:');
                        console.error('  1. Authentication → Sign-in method → Phone → musí být ENABLED');
                        console.error('  2. Authentication → Settings → Authorized domains → musí obsahovat "localhost"');
                        console.error('  3. Project Settings → General → zkontrolujte API klíč a projekt ID');
                        console.error('  4. Zkontrolujte, že reCAPTCHA je správně nakonfigurovaná v Phone sign-in nastavení');
                    }
                    
                    throw smsError;
                }

                // Zobrazit pole pro kód a umožnit dokončení registrace
                const phoneCodeInput = document.getElementById('phoneCode') || document.querySelector('#phoneCode');
                const btnAuthSubmitLocal = document.getElementById('btnAuthSubmit') || document.querySelector('#btnAuthSubmit');
                if (phoneCodeInput) phoneCodeInput.style.display = '';
                if (btnSendPhoneCode) btnSendPhoneCode.style.display = 'none';
                if (btnAuthSubmitLocal) btnAuthSubmitLocal.style.display = '';
                // Ujistit se, že původní submit zůstane skrytý i po odeslání SMS
                const submitBtnLocal = document.querySelector('#authModal .auth-submit-btn');
                if (submitBtnLocal) submitBtnLocal.style.display = 'none';

                showMessage('SMS s kódem byla odeslána.', 'success');
            } catch (err) {
                try { if (recaptchaVerifier) recaptchaVerifier.clear(); recaptchaVerifier = null; } catch (_) {}
                // Logovat jen zpracovanou chybu, ne původní Firebase chybu
                const humanizedError = humanizePhoneError(err);
                console.error('❌ Chyba při telefonním ověření:', humanizedError);
                showMessage(humanizedError, 'error');
            } finally {
                btnSendPhoneCode.disabled = false;
                btnSendPhoneCode.textContent = 'Pokračovat na ověření telefonního čísla';
            }
        });
    }

    // Tlačítko: Dokončit registraci (ověřit zadaný SMS kód a založit účet)
    const btnAuthSubmit2 = document.getElementById('btnAuthSubmit');
    if (btnAuthSubmit2) {
        btnAuthSubmit2.addEventListener('click', async () => {
            let finalUser = null; // Deklarovat na začátku pro použití v catch
            let registrationPayload = null; // Deklarovat pro retry
            
            try {
                console.log('[REGISTER] 📍 route:', window.location.pathname, 'hash:', window.location.hash);
                
                const title = (document.querySelector('#authModal .modal-title')?.textContent || '').trim();
                if (title !== 'Registrace') return; // jen v režimu registrace
                
                // Nastavit flag, že probíhá registrace (aby onAuthStateChanged nevolal callback předčasně)
                window._registrationInProgress = true;
                console.log('[AUTH] 🚩 Nastaven flag _registrationInProgress = true');
                
                // Kontrola GDPR souhlasu
                const gdprCheckbox = document.getElementById('gdprConsent');
                if (!gdprCheckbox || !gdprCheckbox.checked) {
                    showMessage('Pro dokončení registrace musíte souhlasit se zpracováním osobních údajů.', 'error');
                    if (gdprCheckbox) {
                        gdprCheckbox.focus();
                        gdprCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    return;
                }
                
                const raw = (document.getElementById('phoneCode')?.value || '').toString().trim();
                // Povolit 4–8 číslic, odstranit mezery a nečíselné znaky
                const code = raw.replace(/\s+/g, '').replace(/[^0-9]/g, '');
                if (!code) { showMessage('Zadejte kód z SMS.', 'error'); return; }
                if (!phoneConfirmationResult) { showMessage('Nejdřív odešlete SMS s kódem.', 'error'); return; }

                btnAuthSubmit2.disabled = true;
                btnAuthSubmit2.textContent = 'Dokončuji…';

                // DŮLEŽITÉ: Načíst data z sessionStorage (pokud existují) nebo z DOM jako fallback
                console.log('[REGISTER] 📍 route:', window.location.pathname, 'hash:', window.location.hash);
                let registrationPayload = null;
                try {
                    const stored = sessionStorage.getItem('pendingRegistrationPayload');
                    if (stored) {
                        registrationPayload = JSON.parse(stored);
                        console.log('[REGISTER] ✅ Data načtena z sessionStorage:', Object.keys(registrationPayload));
                    } else {
                        console.warn('[REGISTER] ⚠️ Data nejsou v sessionStorage, načítám z DOM');
                    }
                } catch (storageError) {
                    console.error('[REGISTER] ❌ Chyba při načítání z sessionStorage:', storageError);
                }
                
                // Fallback: načíst z DOM pokud sessionStorage selhal
                if (!registrationPayload) {
                    const emailEl = document.getElementById('authEmail');
                    const passwordEl = document.getElementById('authPassword');
                    const activeTypeBtn = document.querySelector('.registration-type-btn.active');
                    const firstNameEl = document.getElementById('firstName');
                    const lastNameEl = document.getElementById('lastName');
                    const birthDateEl = document.getElementById('birthDate');
                    const companyNameEl = document.getElementById('companyName');
                    const icoEl = document.getElementById('ico');
                    const dicEl = document.getElementById('dic');
                    const businessTypeEl = document.getElementById('businessType');
                    const companyAddressEl = document.getElementById('companyAddress');
                    const businessDescriptionEl = document.getElementById('businessDescription');
                    
                    registrationPayload = {
                        email: emailEl ? emailEl.value.trim() : '',
                        password: passwordEl ? passwordEl.value : '',
                        userType: activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'person',
                        firstName: firstNameEl ? firstNameEl.value.trim() : '',
                        lastName: lastNameEl ? lastNameEl.value.trim() : '',
                        birthDate: birthDateEl ? birthDateEl.value.trim() : '',
                        companyName: companyNameEl ? companyNameEl.value.trim() : '',
                        ico: icoEl ? icoEl.value.trim() : '',
                        dic: dicEl ? dicEl.value.trim() : '',
                        businessType: businessTypeEl ? businessTypeEl.value.trim() : '',
                        companyAddress: companyAddressEl ? companyAddressEl.value.trim() : '',
                        businessDescription: businessDescriptionEl ? businessDescriptionEl.value.trim() : '',
                        pathname: window.location.pathname,
                        hash: window.location.hash
                    };
                    console.log('[REGISTER] ⚠️ Data načtena z DOM (fallback):', Object.keys(registrationPayload));
                }
                
                const { email, password, userType, firstName, lastName, birthDate, companyName, ico, dic, businessType, companyAddress, businessDescription } = registrationPayload;
                
                // Uložit payload pro případný retry
                registrationPayload = { ...registrationPayload }; // Kopie pro retry

                // Potvrdit SMS kód
                console.log('[REGISTER] 📱 Potvrzuji SMS kód...');
                const result = await phoneConfirmationResult.confirm(code);
                const phoneUser = result.user;
                finalUser = phoneUser; // Nastavit pro použití v catch bloku
                console.log('[REGISTER] ✅ OTP verified uid:', phoneUser.uid, 'phone:', phoneUser.phoneNumber);
                console.log('[REGISTER] 📝 Shromážděná data:', { email, userType, firstName, lastName, companyName, birthDate });

                // Vytvořit e-mailové přihlašování k telefonnímu účtu
                console.log('🔗 Propojuji email s telefonním účtem...');
                const { linkWithCredential, EmailAuthProvider, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                const credential = EmailAuthProvider.credential(email, password);
                try {
                    await linkWithCredential(phoneUser, credential);
                    console.log('✅ Email úspěšně propojen s telefonním účtem');
                } catch (linkError) {
                    console.error('❌ Chyba při propojení emailu:', linkError);
                    throw linkError;
                }

                // DŮLEŽITÉ: Použít centralizovanou službu pro uložení profilu
                console.log('[REGISTER] 💾 Ukládám data do databáze přes userProfileService...');
                // finalUser už je nastaven výše (z phoneUser po OTP verifikaci)
                const normalizedIco = normalizeICO(ico || '');
                
                // Příprava payload pro userProfileService
                // STEJNĚ PRO HOBBY I FIRMY: základní struktura
                const profilePayload = {
                    email: email,
                    phoneNumber: finalUser.phoneNumber || registrationPayload.phone || '',
                    provider: 'password+phone',
                    userType: userType,
                    name: '', // Bude nastaveno níže podle typu
                    consentAccepted: true,
                    balance: 1000,
                    plan: 'none'
                };
                
                // Osobní údaje - HOBBY (funguje perfektně, NEMĚNIT)
                if (userType === 'person') {
                    console.log('[REGISTER] 📝 Přidávám osobní informace - firstName:', firstName, 'lastName:', lastName);
                    if (firstName && firstName.trim()) profilePayload.firstName = firstName.trim();
                    if (lastName && lastName.trim()) profilePayload.lastName = lastName.trim();
                    if (birthDate && birthDate.trim()) profilePayload.birthDate = birthDate.trim();
                    // Nastavit name stejně jako u hobby
                    profilePayload.name = `${firstName || ''} ${lastName || ''}`.trim() || 'Uživatel';
                } 
                // Firemní údaje - FIRMA (aplikovat STEJNOU logiku jako hobby)
                else if (userType === 'company') {
                    console.log('[REGISTER] 📝 Přidávám firemní informace - companyName:', companyName, 'ico:', normalizedIco);
                    // STEJNĚ JAKO U HOBBY: kontrolovat .trim() a ukládat pouze pokud není prázdný
                    if (companyName && companyName.trim()) profilePayload.companyName = companyName.trim();
                    if (normalizedIco && normalizedIco.trim()) profilePayload.ico = normalizedIco.trim();
                    if (dic && dic.trim()) profilePayload.dic = dic.trim();
                    if (businessType && businessType.trim()) profilePayload.businessType = businessType.trim();
                    if (companyAddress && companyAddress.trim()) profilePayload.companyAddress = companyAddress.trim();
                    if (businessDescription && businessDescription.trim()) profilePayload.businessDescription = businessDescription.trim();
                    // Nastavit name STEJNĚ jako u hobby (stejná logika)
                    profilePayload.name = (companyName && companyName.trim()) ? companyName.trim() : 'Firma';
                }
                
                console.log('[REGISTER] 📦 Writing profile payload:', profilePayload);
                
                // Použít userProfileService pokud je dostupný, jinak fallback na přímý zápis
                if (window.userProfileService && typeof window.userProfileService.saveUserProfile === 'function') {
                    try {
                        await window.userProfileService.saveUserProfile(finalUser.uid, profilePayload);
                        console.log('[REGISTER] ✅ Profil uložen přes userProfileService');
                    } catch (profileServiceError) {
                        console.error('[REGISTER] ❌ Firestore write failed přes userProfileService:', profileServiceError);
                        console.error('[REGISTER] ❌ Error details:', {
                            code: profileServiceError?.code,
                            message: profileServiceError?.message,
                            stack: profileServiceError?.stack,
                            pathname: window.location.pathname
                        });
                        // Zobrazit chybu uživateli
                        const errorMsg = profileServiceError?.message || 'Nepodařilo se uložit profil do databáze.';
                        showMessage(`Chyba při ukládání profilu: ${errorMsg}`, 'error');
                        // NENECHAT uživatele bez profilu - zkusit fallback
                        throw profileServiceError;
                    }
                } else {
                    // Fallback: přímý zápis (starý způsob)
                    console.warn('[REGISTER] ⚠️ userProfileService není dostupný, používám fallback');
                    const { setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                    
                    try {
                        await setDoc(doc(firebaseDb, 'users', finalUser.uid), {
                            uid: finalUser.uid,
                            email,
                            phoneNumber: finalUser.phoneNumber || '',
                            createdAt: serverTimestamp(),
                            provider: 'password+phone',
                            type: userType
                        }, { merge: true });
                        
                        const profileData = { ...profilePayload };
                        profileData.createdAt = serverTimestamp();
                        profileData.updatedAt = serverTimestamp();
                        
                        await setDoc(doc(firebaseDb, 'users', finalUser.uid, 'profile', 'profile'), profileData, { merge: true });
                        console.log('[REGISTER] ✅ Profil uložen přes fallback');
                    } catch (fallbackError) {
                        console.error('[REGISTER] ❌ Firestore write failed (fallback):', fallbackError);
                        throw fallbackError;
                    }
                }
                
                console.log('👤 Aktualizuji displayName...');
                try {
                    await updateProfile(finalUser, { displayName: userType === 'company' ? companyName : `${firstName} ${lastName}`.trim() });
                    console.log('✅ DisplayName aktualizován');
                } catch (profileUpdateError) {
                    console.warn('⚠️ Chyba při aktualizaci displayName (není kritická):', profileUpdateError);
                }

                // Ověřit, že se data skutečně uložila (userProfileService už to dělá, ale pro jistotu)
                const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                const verifyRef = doc(firebaseDb, 'users', finalUser.uid, 'profile', 'profile');
                const verifySnap = await getDoc(verifyRef);
                if (!verifySnap.exists()) {
                    console.error('[REGISTER] ❌ Profil se nepodařilo ověřit po uložení!');
                    throw new Error('Profil se nepodařilo uložit do databáze. Zkuste to znovu.');
                }
                
                console.log('[REGISTER] ✅ Registrace úspěšně dokončena - DB zápis ověřen');
                const savedData = verifySnap.data();
                console.log('[REGISTER] ✅ Ověření uložených dat:', {
                    uid: finalUser.uid,
                    email: savedData.email,
                    userType: savedData.userType,
                    firstName: savedData.firstName,
                    lastName: savedData.lastName
                });
                
                showMessage('Registrace dokončena.', 'success');
                
                // Aktualizovat UI PŘED zavřením modalu
                if (typeof updateUI === 'function') {
                    try {
                        updateUI(finalUser);
                    } catch (uiError) {
                        console.warn('⚠️ Chyba při aktualizaci UI:', uiError);
                    }
                }
                
                // Zavřít modal (použít hash modal hook pokud je dostupný)
                if (window.hashModal && typeof window.hashModal.close === 'function') {
                    window.hashModal.close();
                } else {
                    closeAuthModal();
                }
                
                // Pokud jsme na stránce nastavení, znovu načíst data pomocí custom eventu
                if (window.location.pathname.includes('profile-settings')) {
                    try {
                        // Vyslat custom event pro znovunačtení dat
                        window.dispatchEvent(new CustomEvent('userProfileUpdated', { 
                            detail: { uid: finalUser.uid } 
                        }));
                        // Také zkusit zavolat loadUserSettings pokud je dostupná
                        setTimeout(() => {
                            if (typeof window.loadUserSettings === 'function') {
                                window.loadUserSettings();
                            }
                        }, 1000);
                    } catch (reloadError) {
                        console.warn('⚠️ Chyba při znovunačtení nastavení:', reloadError);
                    }
                }
                
                // Vyčistit sessionStorage po úspěšné registraci
                try {
                    sessionStorage.removeItem('pendingRegistrationPayload');
                    console.log('[REGISTER] ✅ SessionStorage vyčištěn');
                } catch (storageError) {
                    console.warn('[REGISTER] ⚠️ Chyba při čištění sessionStorage:', storageError);
                }
                
                // DŮLEŽITÉ: afterLoginCallback se NESMÍ volat dřív, než se dokončí Firestore zápis
                // Callback se zavolá až po úspěšném ověření uložení profilu (viz kód výše)
                // Pokud je nastaven afterLoginCallback, počkáme ještě chvíli před jeho zavoláním
                // aby se zajistilo, že všechny DB operace jsou dokončené
                if (typeof window.afterLoginCallback === 'function') {
                    // Počkat ještě chvíli, aby se zajistilo, že Firestore zápis je dokončen
                    await new Promise(resolve => setTimeout(resolve, 500));
                    try { 
                        console.log('[AUTH] 🔄 Volám afterLoginCallback po úspěšné registraci a dokončení Firestore zápisu');
                        window.afterLoginCallback(); 
                        // Vyčistit callback po zavolání
                        window.afterLoginCallback = null;
                    } catch (callbackError) {
                        console.error('[AUTH] ❌ Chyba při volání afterLoginCallback:', callbackError);
                    }
                }
            } catch (err) {
                // Odstranit flag registrace i při chybě
                window._registrationInProgress = false;
                console.log('[AUTH] 🚩 Odstraněn flag _registrationInProgress (kvůli chybě)');
                
                // NESMAZAT sessionStorage při chybě - data mohou být potřeba pro retry
                console.log('[REGISTER] ⚠️ Registrace selhala, data zůstávají v sessionStorage pro případný retry');
                
                console.error('[REGISTER] ❌ Dokončení registrace selhalo - původní chyba:', err);
                console.error('[REGISTER] ❌ Error details:', {
                    code: err?.code,
                    message: err?.message,
                    stack: err?.stack,
                    pathname: window.location.pathname,
                    hash: window.location.hash,
                    uid: finalUser?.uid
                });
                
                // Zpracovat různé typy chyb
                let errorMessage = 'Chyba při dokončení registrace.';
                let isFirestoreError = false;
                let canRetry = false;
                
                // Pokud je to telefonní chyba, použít humanizePhoneError
                if (err?.code && err.code.startsWith('auth/')) {
                    errorMessage = humanizePhoneError(err);
                } 
                // Pokud je to Firestore chyba
                else if (err?.code && err.code.startsWith('firestore/') || err?.code === 'permission-denied' || err?.message?.includes('Firestore')) {
                    isFirestoreError = true;
                    canRetry = true;
                    switch (err.code) {
                        case 'firestore/permission-denied':
                        case 'permission-denied':
                            errorMessage = 'Nemáte oprávnění k uložení dat. Kontaktujte podporu.';
                            canRetry = false;
                            break;
                        case 'firestore/unavailable':
                        case 'unavailable':
                            errorMessage = 'Databáze není dostupná. Zkontrolujte připojení k internetu.';
                            canRetry = true;
                            break;
                        default:
                            errorMessage = `Chyba databáze: ${err.message || err.code || 'neznámá chyba'}`;
                            canRetry = true;
                    }
                }
                // Pokud je to chyba při linkWithCredential (email už existuje)
                else if (err?.code === 'auth/email-already-in-use' || err?.message?.includes('email-already-in-use')) {
                    errorMessage = 'Účet s tímto emailem již existuje. Použijte jiný email nebo se přihlaste.';
                }
                // Pokud je to jiná auth chyba
                else if (err?.code && err.code.startsWith('auth/')) {
                    errorMessage = handleAuthError(err) || errorMessage;
                }
                // Obecná chyba
                else if (err?.message) {
                    errorMessage = err.message;
                    canRetry = true;
                }
                
                // Pokud je errorMessage stále jen tečka nebo prázdný, použít obecnou zprávu
                if (!errorMessage || errorMessage === '.' || errorMessage.trim() === '') {
                    errorMessage = 'Chyba při dokončení registrace. Zkuste to znovu nebo kontaktujte podporu.';
                    canRetry = true;
                }
                
                console.error('[REGISTER] ❌ Dokončení registrace selhalo:', errorMessage);
                showMessage(errorMessage, 'error');
                
                // Pokud je to Firestore chyba a máme uživatele, zobrazit tlačítko "Zkusit znovu"
                if (isFirestoreError && canRetry && finalUser && finalUser.uid) {
                    // Zobrazit tlačítko pro retry
                    const modal = document.getElementById('authModal');
                    if (modal) {
                        const retryBtn = document.createElement('button');
                        retryBtn.type = 'button';
                        retryBtn.className = 'btn btn-secondary';
                        retryBtn.textContent = 'Zkusit znovu uložit profil';
                        retryBtn.style.marginTop = '10px';
                        retryBtn.onclick = async () => {
                            retryBtn.disabled = true;
                            retryBtn.textContent = 'Ukládám...';
                            try {
                                // Načíst data z registrationPayload (zachováno z try bloku) nebo sessionStorage
                                let payload = registrationPayload;
                                if (!payload) {
                                    try {
                                        const stored = sessionStorage.getItem('pendingRegistrationPayload');
                                        if (stored) {
                                            payload = JSON.parse(stored);
                                        }
                                    } catch (_) {}
                                }
                                
                                if (!payload) {
                                    // Fallback: načíst z DOM
                                    const emailEl = document.getElementById('authEmail');
                                    const activeTypeBtn = document.querySelector('.registration-type-btn.active');
                                    payload = {
                                        email: emailEl ? emailEl.value.trim() : '',
                                        phoneNumber: finalUser.phoneNumber || '',
                                        provider: 'password+phone',
                                        userType: activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'person'
                                    };
                                }
                                
                                console.log('[REGISTER] 🔄 Retry: Ukládám profil znovu...', { uid: finalUser.uid, payloadKeys: Object.keys(payload) });
                                
                                // Zkusit znovu uložit profil
                                if (window.userProfileService && typeof window.userProfileService.saveUserProfile === 'function') {
                                    await window.userProfileService.saveUserProfile(finalUser.uid, payload);
                                    showMessage('Profil úspěšně uložen!', 'success');
                                    retryBtn.remove();
                                    
                                    // Vyčistit sessionStorage
                                    try {
                                        sessionStorage.removeItem('pendingRegistrationPayload');
                                    } catch (_) {}
                                    
                                    // Zavřít modal po úspěchu
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                    if (window.hashModal && typeof window.hashModal.close === 'function') {
                                        window.hashModal.close();
                                    } else {
                                        closeAuthModal();
                                    }
                                    
                                    // Aktualizovat UI
                                    if (typeof updateUI === 'function') {
                                        try {
                                            updateUI(finalUser);
                                        } catch (uiError) {
                                            console.warn('⚠️ Chyba při aktualizaci UI:', uiError);
                                        }
                                    }
                                    
                                    // Volat callback pokud existuje
                                    if (typeof window.afterLoginCallback === 'function') {
                                        try {
                                            window.afterLoginCallback();
                                            window.afterLoginCallback = null;
                                        } catch (callbackError) {
                                            console.error('[AUTH] ❌ Chyba při volání afterLoginCallback:', callbackError);
                                        }
                                    }
                                    
                                    // Odstranit flag registrace
                                    window._registrationInProgress = false;
                                } else {
                                    throw new Error('userProfileService není dostupný');
                                }
                            } catch (retryError) {
                                console.error('[REGISTER] ❌ Retry selhal:', retryError);
                                showMessage(`Znovu se nepodařilo uložit profil: ${retryError.message || 'Neznámá chyba'}`, 'error');
                                retryBtn.disabled = false;
                                retryBtn.textContent = 'Zkusit znovu uložit profil';
                            }
                        };
                        
                        // Přidat tlačítko do modalu (před form nebo do něj)
                        const form = modal.querySelector('#authForm');
                        if (form) {
                            const existingRetry = form.querySelector('.retry-profile-btn');
                            if (!existingRetry) {
                                retryBtn.classList.add('retry-profile-btn');
                                form.appendChild(retryBtn);
                            }
                        }
                    }
                }
            } finally {
                btnAuthSubmit2.disabled = false;
                btnAuthSubmit2.textContent = 'Dokončit registraci';
            }
        });
    }
    // Tlačítko: Zpět z kroku 2
    const btnPhoneBack = document.getElementById('btnPhoneBack');
    if (btnPhoneBack) {
        btnPhoneBack.addEventListener('click', () => {
            const phoneStep2 = document.getElementById('phoneStep2');
            const btnSendPhoneCodeLocal = document.getElementById('btnSendPhoneCode');
            const btnAuthSubmitLocal = document.getElementById('btnAuthSubmit');
            if (phoneStep2) phoneStep2.style.display = 'none';
            if (btnSendPhoneCodeLocal) btnSendPhoneCodeLocal.style.display = '';
            if (btnAuthSubmitLocal) btnAuthSubmitLocal.style.display = 'none';
        });
    }

    // Tlačítko: Ověřit kód a dokončit registraci
    const btnVerifyPhoneCode = document.getElementById('btnVerifyPhoneCode');
    if (btnVerifyPhoneCode) {
        btnVerifyPhoneCode.addEventListener('click', async () => {
            try {
                const code = (document.getElementById('smsCode')?.value || '').toString().trim();
                if (!code) {
                    showMessage('Zadejte kód z SMS.', 'error');
                    return;
                }
                if (!phoneConfirmationResult) {
                    showMessage('Nejdřív odešlete SMS s kódem.', 'error');
                    return;
                }

                btnVerifyPhoneCode.disabled = true;
                btnVerifyPhoneCode.textContent = 'Ověřuji...';

                // a) Potvrdit SMS kód => přihlásí dočasně telefonního uživatele
                const result = await phoneConfirmationResult.confirm(code);
                const phoneUser = result.user;

                // b) Připravit data pro propojení email+heslo
                const form = document.getElementById('authForm');
                const formData = new FormData(form);
                const email = formData.get('email');
                const password = formData.get('password');
                const activeTypeBtn = document.querySelector('.registration-type-btn.active');
                const userType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'person';

                const authMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                const { EmailAuthProvider, linkWithCredential, updateProfile } = authMod;

                // c) Update displayName
                const firstName = formData.get('firstName');
                const lastName = formData.get('lastName');
                const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
                if (displayName) {
                    await updateProfile(phoneUser, { displayName });
                }

                // d) Propojit email+heslo s telefonním účtem
                const credential = EmailAuthProvider.credential(email, password);
                const linked = await linkWithCredential(phoneUser, credential);
                const finalUser = linked.user;

                // e) Připravit a ověřit telefon (normalizace + unikátnost)
                const userData = { type: userType };
                if (userType === 'person') {
                    userData.firstName = firstName;
                    userData.lastName = lastName;
                    userData.phone = formData.get('phone');
                    userData.birthDate = formData.get('birthDate');
                } else {
                    userData.companyName = formData.get('companyName');
                    userData.ico = formData.get('ico');
                    userData.dic = formData.get('dic');
                    userData.companyAddress = formData.get('companyAddress');
                    // Telefon i e‑mail pro firmu se berou ze společných polí
                    userData.phone = formData.get('phone');
                }
                // Při dokončení registrace ještě jednou ověřit IČO (pro jistotu)
                if (userType === 'company') {
                    const ico = userData.ico || '';
                    if (!window.__icoVerified || window.__icoVerifiedValue !== ico) {
                        showMessage('Nejdříve musíte ověřit IČO tlačítkem "Ověřit".', 'error');
                        return;
                    }
                    const icoCheck = await validateICOWithARES(ico);
                    if (!icoCheck.ok) {
                        showMessage(icoCheck.reason || 'IČO se nepodařilo ověřit.', 'error');
                        window.__icoVerified = false;
                        toggleCompanyFormFields(true);
                        return;
                    }
                    if (!userData.companyName && icoCheck.name) {
                        userData.companyName = icoCheck.name;
                    }
                    if (!userData.companyAddress && icoCheck.seat && icoCheck.seat.text) {
                        userData.companyAddress = icoCheck.seat.text;
                    }
                }

                const rawPhone = (userData.phone || '');
                const normalizedPhone = normalizePhone(rawPhone);
                if (!normalizedPhone) {
                    showMessage('Telefon je povinný a musí být ve formátu +420...', 'error');
                    return;
                }
                const available = await isPhoneAvailable(normalizedPhone);
                if (!available) {
                    showMessage('Toto telefonní číslo je již používáno jiným účtem.', 'error');
                    return;
                }

                // Vytvoření dokumentů (kopie logiky z register, ale bez createUserWithEmailAndPassword)
                const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                await setDoc(doc(firebaseDb, 'users', finalUser.uid), {
                    uid: finalUser.uid,
                    email: finalUser.email,
                    createdAt: new Date(),
                    userType: userData.type
                });

                const profileData = {
                    email: finalUser.email,
                    balance: 1000,
                    createdAt: new Date(),
                    userType: userData.type,
                    name: displayName || (userData.companyName || 'Uživatel'),
                    phone: normalizedPhone || null,
                    city: userData.city || null,
                    bio: userData.bio || null,
                    businessName: userData.companyName || userData.businessName || null,
                    businessType: userData.businessType || null,
                    businessIco: null, // Bude nastaveno níže pro firmy
                    businessDic: null, // Bude nastaveno níže pro firmy
                    businessAddress: userData.companyAddress || userData.businessAddress || null,
                    businessDescription: userData.businessDescription || null,
                    emailNotifications: userData.emailNotifications !== false,
                    smsNotifications: userData.smsNotifications === true,
                    marketingEmails: userData.marketingEmails === true,
                    rating: 0,
                    totalReviews: 0,
                    ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
                    recentReviews: [],
                    totalAds: 0,
                    activeAds: 0,
                    totalViews: 0,
                    totalContacts: 0
                };

                if (userType === 'person') {
                    profileData.firstName = firstName;
                    profileData.lastName = lastName;
                    profileData.birthDate = formData.get('birthDate');
                    profileData.name = displayName || `${firstName || ''} ${lastName || ''}`.trim();
                } else {
                    profileData.name = userData.companyName || 'Firma';
                    // Uložit obchodní informace i na hlavní úroveň profilu (pro zobrazení v nastavení)
                    const normalizedIco = normalizeICO(userData.ico || '');
                    profileData.businessName = userData.companyName || null;
                    profileData.businessType = userData.businessType || null;
                    profileData.businessIco = normalizedIco || null;
                    profileData.businessDic = userData.dic || null;
                    profileData.businessAddress = userData.companyAddress || null;
                    profileData.businessDescription = userData.businessDescription || null;
                    // U firmy se businessAddress ukládá také do location, aby se zobrazovala v profilu
                    profileData.location = userData.companyAddress || null;
                    // Také zachovat v company objektu pro kompatibilitu
                    profileData.company = {
                        companyName: userData.companyName || null,
                        ico: normalizedIco || null,
                        dic: userData.dic || null,
                        phone: normalizedPhone || null,
                        address: userData.companyAddress || null
                    };
                }

                // --- Úkol 2 dokončen ---
                // --- Úkol 4 dokončen ---

                await setDoc(doc(firebaseDb, 'users', finalUser.uid, 'profile', 'profile'), profileData);

                updateUI(finalUser);
                showMessage('Registrace úspěšná. Telefon ověřen.', 'success');
                closeAuthModal();
            } catch (err) {
                const humanizedError = humanizePhoneError(err);
                console.error('❌ Chyba při ověřování kódu:', humanizedError);
                showMessage(humanizedError, 'error');
            } finally {
                btnVerifyPhoneCode.disabled = false;
                btnVerifyPhoneCode.textContent = 'Ověřit kód a dokončit registraci';
            }
        });
    }

    // Ověření IČ přes HlídačStátu (vedle pole IČ)
    const btnVerifyICO = document.getElementById('btnVerifyICO');
    if (btnVerifyICO) {
        btnVerifyICO.addEventListener('click', async () => {
            try {
                const icoInput = document.getElementById('ico') || document.getElementById('companyId');
                const statusEl = document.getElementById('icoStatus');
                const companyNameEl = document.getElementById('companyName');
                const companyAddressEl = document.getElementById('companyAddress');
                const icoVal = (icoInput?.value || '').toString().trim();
                if (!icoVal) { 
                    if (statusEl) { 
                        statusEl.style.color = '#dc3545'; 
                        statusEl.textContent = 'Zadejte IČ'; 
                    } 
                    return; 
                }
                btnVerifyICO.disabled = true;
                btnVerifyICO.textContent = 'Ověřuji...';
                const res = await validateICOWithARES(icoVal);
                if (res.ok) {
                    if (statusEl) { 
                        statusEl.style.color = '#28a745'; 
                        statusEl.textContent = 'IČ ověřeno ✓'; 
                    }
                    // Předvyplnit název/sídlo pokud jsou prázdné
                    if (res.name && companyNameEl && !companyNameEl.value) {
                        companyNameEl.value = res.name;
                    }
                    if (res.seat && companyAddressEl && !companyAddressEl.value && res.seat.text) {
                        companyAddressEl.value = res.seat.text;
                    }
                    // Odblokovat všechna pole po úspěšném ověření
                    toggleCompanyFormFields(false);
                    // Nastavit flag, že IČO je ověřeno
                    window.__icoVerified = true;
                    window.__icoVerifiedValue = icoVal;
                } else {
                    if (statusEl) { 
                        statusEl.style.color = '#dc3545'; 
                        statusEl.textContent = res.reason || 'IČ nebylo ověřeno'; 
                    }
                    // Pole zůstávají zablokovaná
                    window.__icoVerified = false;
                }
            } catch (e) {
                const statusEl = document.getElementById('icoStatus');
                if (statusEl) { 
                    statusEl.style.color = '#dc3545'; 
                    statusEl.textContent = 'Chyba při ověřování IČ'; 
                }
                window.__icoVerified = false;
            } finally {
                btnVerifyICO.disabled = false;
                btnVerifyICO.textContent = 'Ověřit';
            }
        });
    }
    
    // Přepínání mezi přihlášením a registrací
    const authSwitchBtn = document.querySelector('.auth-switch-btn');
    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', () => {
            const type = authSwitchBtn.getAttribute('data-type');
            showAuthModal(type);
        });
    }

    // Při otevření registrace přejmenovat texty tlačítek, když existují
    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle && modalTitle.textContent === 'Registrace') {
        // V režimu registrace má být hlavní flow: Odeslat SMS → Dokončit registraci
        const primarySubmit = document.querySelector('#authModal .auth-submit-btn');
        if (primarySubmit) primarySubmit.style.display = 'none';
        const sendCodeBtn = document.getElementById('btnSendPhoneCode');
        if (sendCodeBtn) sendCodeBtn.textContent = 'Pokračovat na ověření telefonního čísla';
        const completeBtn = document.getElementById('btnAuthSubmit');
        if (completeBtn) completeBtn.textContent = 'Dokončit registraci';
    }
    
    // Inicializace náhledů obrázků
    setupImagePreviews();
    
    // Formulář pro přidání služby
    // Event listener pro formulář přidání služby - pouze pro modaly na jiných stránkách
    // Na stránce create-ad.html se používá create-ad.js, ne tento listener
    const addServiceForm = document.getElementById('addServiceForm');
    if (addServiceForm && !window.location.pathname.includes('create-ad.html')) {
        addServiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(addServiceForm);
            const serviceData = {
                title: formData.get('title'),
                category: formData.get('category'),
                description: formData.get('description'),
                price: formData.get('price'),
                location: formData.get('location')
            };
            
            // Zpracovat obrázky
            const previewImageInput = document.getElementById('previewImage');
            const additionalImagesInput = document.getElementById('additionalImages');
            
            // Validace náhledového obrázku
            if (!previewImageInput.files[0]) {
                showMessage('Náhledový obrázek je povinný!', 'error');
                return;
            }
            
            serviceData.previewImage = previewImageInput.files[0];
            
            // Zpracovat další obrázky
            if (additionalImagesInput.files.length > 0) {
                if (additionalImagesInput.files.length > 10) {
                    showMessage('Můžete nahrát maximálně 10 dalších fotek!', 'error');
                    return;
                }
                serviceData.additionalImages = Array.from(additionalImagesInput.files);
            }
            
            await addService(serviceData);
        });
    }
    
    // Zavření modalu při kliknutí mimo něj
    window.addEventListener('click', (e) => {
        const authModal = document.getElementById('authModal');
        const addServiceModal = document.getElementById('addServiceModal');
        const userDropdown = document.querySelector('.user-dropdown');
        
        if (e.target === authModal) {
            if (typeof window.closeAuthModal === 'function') {
                window.closeAuthModal();
            }
        }
        if (e.target === addServiceModal) {
            closeAddServiceModal();
        }
        
        // Zavření dropdown menu při kliknutí mimo něj
        if (userDropdown && !userDropdown.contains(e.target)) {
            closeUserDropdown();
        }
    });
}

// Funkce pro náhled obrázků při nahrávání
// Flag pro zajištění, že se event listenery přidají jen jednou
let imagePreviewsSetup = false;

function setupImagePreviews() {
    // Pokud už byly event listenery přidány, nepřidávat znovu
    if (imagePreviewsSetup) {
        return;
    }
    
    const previewImageInput = document.getElementById('previewImage');
    const additionalImagesInput = document.getElementById('additionalImages');
    const previewImagePreview = document.getElementById('previewImagePreview');
    const additionalImagesPreview = document.getElementById('additionalImagesPreview');
    
    if (previewImageInput && previewImagePreview) {
        previewImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImagePreview.innerHTML = `<img src="${e.target.result}" alt="Náhled">`;
                    previewImagePreview.classList.remove('empty');
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    if (additionalImagesInput && additionalImagesPreview) {
        additionalImagesInput.addEventListener('change', function(e) {
            const files = Array.from(e.target.files);
            if (files.length > 10) {
                showMessage('Můžete nahrát maximálně 10 dalších fotek!', 'error');
                return;
            }
            
            // VYMAZAT existující náhledy před přidáním nových - důležité pro zabránění duplicit
            // Použít replaceChildren pro lepší výkon a jistotu, že se vše vymaže
            while (additionalImagesPreview.firstChild) {
                additionalImagesPreview.removeChild(additionalImagesPreview.firstChild);
            }
            
            // Zajistit, že se každý soubor zpracuje jen jednou
            const processedFiles = new Set();
            
            files.forEach((file, index) => {
                // Zkontrolovat, jestli už tento soubor nebyl zpracován
                if (processedFiles.has(file.name + file.size)) {
                    return;
                }
                processedFiles.add(file.name + file.size);
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imageItem = document.createElement('div');
                    imageItem.className = 'image-item';
                    imageItem.innerHTML = `
                        <img src="${e.target.result}" alt="Obrázek ${index + 1}">
                        <button class="remove-btn" onclick="removeImage(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    additionalImagesPreview.appendChild(imageItem);
                };
                reader.readAsDataURL(file);
            });
        });
    }
    
    // Označit, že byly event listenery přidány
    imagePreviewsSetup = true;
}

// Funkce pro odstranění obrázku z náhledu
function removeImage(index) {
    const additionalImagesInput = document.getElementById('additionalImages');
    const additionalImagesPreview = document.getElementById('additionalImagesPreview');
    
    if (additionalImagesInput && additionalImagesPreview) {
        const dt = new DataTransfer();
        const files = Array.from(additionalImagesInput.files);
        
        files.forEach((file, i) => {
            if (i !== index) {
                dt.items.add(file);
            }
        });
        
        additionalImagesInput.files = dt.files;
        
        // Aktualizovat náhled
        additionalImagesInput.dispatchEvent(new Event('change'));
    }
}

// Instagram-like prohlížeč obrázků
function openImageViewer(images, startIndex = 0) {
    console.log('🖼️ Otevírám prohlížeč obrázků:', images.length, 'obrázků');
    
    if (!images || images.length === 0) {
        showMessage('Žádné obrázky k zobrazení', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal image-viewer-modal';
    modal.style.display = 'flex';
    
    let currentIndex = startIndex;
    
    function updateImage() {
        const mainImage = modal.querySelector('.image-viewer-main');
        const counter = modal.querySelector('.image-viewer-counter');
        const thumbnails = modal.querySelectorAll('.image-viewer-thumbnail');
        
        if (mainImage && images[currentIndex]) {
            mainImage.src = images[currentIndex].url;
            mainImage.alt = images[currentIndex].name || `Obrázek ${currentIndex + 1}`;
        }
        
        if (counter) {
            counter.textContent = `${currentIndex + 1} / ${images.length}`;
        }
        
        thumbnails.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === currentIndex);
        });
        
        // Skrýt/zobrazit navigační tlačítka
        const prevBtn = modal.querySelector('.image-viewer-prev');
        const nextBtn = modal.querySelector('.image-viewer-next');
        
        if (prevBtn) prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
    }
    
    modal.innerHTML = `
        <div class="image-viewer-content">
            <div class="image-viewer-header">
                <button class="image-viewer-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
                <div class="image-viewer-counter">${currentIndex + 1} / ${images.length}</div>
            </div>
            
            <div class="image-viewer-body">
                <img class="image-viewer-main" src="${images[currentIndex].url}" alt="${images[currentIndex].name || `Obrázek ${currentIndex + 1}`}">
                
                <button class="image-viewer-nav image-viewer-prev" onclick="navigateImage(-1)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                
                <button class="image-viewer-nav image-viewer-next" onclick="navigateImage(1)">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            
            <div class="image-viewer-thumbnails">
                ${images.map((img, index) => `
                    <div class="image-viewer-thumbnail ${index === currentIndex ? 'active' : ''}" onclick="goToImage(${index})">
                        <img src="${img.url}" alt="${img.name || `Obrázek ${index + 1}`}">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Přidat navigační funkce
    window.navigateImage = function(direction) {
        currentIndex += direction;
        if (currentIndex < 0) currentIndex = images.length - 1;
        if (currentIndex >= images.length) currentIndex = 0;
        updateImage();
    };
    
    window.goToImage = function(index) {
        currentIndex = index;
        updateImage();
    };
    
    // Klávesové zkratky
    const handleKeydown = (e) => {
        if (e.key === 'ArrowLeft') navigateImage(-1);
        if (e.key === 'ArrowRight') navigateImage(1);
        if (e.key === 'Escape') modal.remove();
    };
    
    document.addEventListener('keydown', handleKeydown);
    
    // Vyčistit event listener při zavření
    const originalRemove = modal.remove;
    modal.remove = function() {
        document.removeEventListener('keydown', handleKeydown);
        delete window.navigateImage;
        delete window.goToImage;
        originalRemove.call(this);
    };
    
    document.body.appendChild(modal);
    updateImage();
}

// Export funkcí pro globální použití - ihned po definici
window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.createAuthModal = createAuthModal;
window.setupAuthModalEvents = setupAuthModalEvents;
window.showAddServiceModal = showAddServiceModal;
window.closeAddServiceModal = closeAddServiceModal;
window.logout = logout;
window.addService = addService;
window.loadServices = loadServices;
window.toggleUserDropdown = toggleUserDropdown;
window.closeUserDropdown = closeUserDropdown;
window.setupImagePreviews = setupImagePreviews;
window.removeImage = removeImage;
window.openImageViewer = openImageViewer;

// Funkce pro vyžadování přihlášení před přesměrováním na create-ad.html
window.requireAuthForCreateAd = function() {
    // Zkontrolovat, zda je Firebase načten
    if (!window.firebaseAuth) {
        // Pokud Firebase není načten, počkat a zkusit znovu
        const checkFirebase = setInterval(() => {
            if (window.firebaseAuth) {
                clearInterval(checkFirebase);
                window.requireAuthForCreateAd();
            }
        }, 100);
        
        // Po 3 sekundách timeout - zobrazit přihlašovací okno
        setTimeout(() => {
            clearInterval(checkFirebase);
            if (typeof window.showAuthModal === 'function') {
                window.afterLoginCallback = () => {
                    window.location.href = 'create-ad.html';
                };
                showAuthModal('login');
            } else {
                alert('Pro vytvoření inzerátu se prosím přihlaste.');
            }
        }, 3000);
        return;
    }
    
    // Zkontrolovat aktuální stav přihlášení
    const currentUser = window.firebaseAuth.currentUser;
    
    if (currentUser) {
        // Uživatel je přihlášený - přesměrovat přímo
        window.location.href = 'create-ad.html';
    } else {
        // Uživatel není přihlášený - zobrazit přihlašovací okno
        if (typeof window.showAuthModal === 'function') {
            // Nastavit callback, který se zavolá po úspěšném přihlášení
            window.afterLoginCallback = () => {
                window.location.href = 'create-ad.html';
            };
            showAuthModal('login');
        } else {
            alert('Pro vytvoření inzerátu se prosím přihlaste.');
        }
    }
};

// Exportované funkce - logy odstraněny

// Fallback pro tlačítka - pokud se funkce nenačtou, zobrazit chybu
document.addEventListener('DOMContentLoaded', () => {
    // Zkontrolovat, zda jsou funkce dostupné po 1 sekundě
    setTimeout(() => {
        if (typeof window.showAuthModal !== 'function') {
            console.error('❌ showAuthModal není dostupná!');
            // Přidat error handler na tlačítka
            document.querySelectorAll('[onclick*="showAuthModal"]').forEach(btn => {
                btn.onclick = () => {
                    alert('Chyba: Autentifikační funkce nejsou načtené. Obnovte stránku.');
                };
            });
        } else {
            // showAuthModal je dostupná
        }
    }, 1000);
});