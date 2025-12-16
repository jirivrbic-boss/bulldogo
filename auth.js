// Auth.js - Firebase Authentication funkcionality

// Debug: Zkontrolovat, jestli se auth.js načítá
console.log('🔧 Auth.js: Soubor se načítá na stránce:', window.location.pathname);
console.log('🔧 Auth.js: Čas načtení:', new Date().toLocaleTimeString());

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
    console.log('🔧 Auth.js: DOMContentLoaded spuštěn');
    
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

// Inicializace autentifikace
function initAuth() {
    console.log('🔧 Inicializuji auth s Firebase:', { firebaseAuth: !!firebaseAuth, firebaseDb: !!firebaseDb });
    
    // Import Firebase funkcí dynamicky
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
        console.log('✅ Firebase Auth modul načten');
        // Sledování stavu přihlášení
        onAuthStateChanged(firebaseAuth, (user) => {
            console.log('👤 Auth state changed:', user ? `Přihlášen: ${user.email}` : 'Odhlášen');
            console.log('👤 Auth state changed na stránce:', window.location.pathname);
            console.log('👤 Auth state changed v čase:', new Date().toLocaleTimeString());
            authCurrentUser = user;
            updateUI(user);
            
            // Pokud je uživatel přihlášen, aktualizovat v profilu čas posledního přihlášení
            if (user && window.firebaseDb) {
                (async () => {
                    try {
                        const { setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                        const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
                        await setDoc(profileRef, {
                            lastLoginAt: serverTimestamp()
                        }, { merge: true });
                        console.log('🕒 lastLoginAt uložen do profilu uživatele:', user.uid);
                    } catch (e) {
                        console.warn('⚠️ Nepodařilo se uložit lastLoginAt:', e);
                    }
                })();
            }
            
            // Zkontrolovat, zda existuje callback po přihlášení
            if (user && window.afterLoginCallback) {
                console.log('🔄 Spouštím callback po přihlášení');
                window.afterLoginCallback();
                // Vyčistit callback
                window.afterLoginCallback = null;
            }
        });
    }).catch(error => {
        console.error('❌ Chyba při načítání Firebase Auth:', error);
    });
    
    // Inicializace výběru typu registrace
    setupRegistrationTypeSelection();
    
    // Nastavení event listenerů
    setupEventListeners();
    
    // Debug: Zkontrolovat elementy po načtení
    setTimeout(() => {
        const personForm = document.querySelector('.person-form');
        const companyForm = document.querySelector('.company-form');
        const typeButtons = document.querySelectorAll('.registration-type-btn');
        
        console.log('🔍 Debug po načtení DOM:', {
            personForm: personForm ? 'nalezen' : 'nenalezen',
            companyForm: companyForm ? 'nalezen' : 'nenalezen',
            typeButtons: typeButtons.length,
            personFormDisplay: personForm ? personForm.style.display : 'N/A',
            companyFormDisplay: companyForm ? companyForm.style.display : 'N/A'
        });
    }, 1000);
}

// Nastavení výběru typu registrace
function setupRegistrationTypeSelection() {
    const typeButtons = document.querySelectorAll('.registration-type-btn');
    const personForm = document.querySelector('.person-form');
    const companyForm = document.querySelector('.company-form');
    
    console.log('🔧 Nastavuji registrační typy:', { typeButtons: typeButtons.length, personForm, companyForm });
    
    typeButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('🖱️ Kliknuto na tlačítko:', button.getAttribute('data-type'));
            
            // Odstranit active třídu ze všech tlačítek
            typeButtons.forEach(btn => btn.classList.remove('active'));
            // Přidat active třídu na kliknuté tlačítko
            button.classList.add('active');
            
            const type = button.getAttribute('data-type');
            console.log('📝 Typ registrace:', type);
            
            if (type === 'person') {
                console.log('👤 Zobrazuji formulář pro fyzickou osobu');
                personForm.style.display = 'block';
                personForm.classList.remove('hidden');
                personForm.classList.add('visible');
                companyForm.style.display = 'none';
                companyForm.classList.add('hidden');
                companyForm.classList.remove('visible');
                // required přepínač
                toggleRequired(personForm, true);
                toggleRequired(companyForm, false);
            } else if (type === 'company') {
                console.log('🏢 Zobrazuji formulář pro firmu');
                personForm.style.display = 'none';
                personForm.classList.add('hidden');
                personForm.classList.remove('visible');
                companyForm.style.display = 'block';
                companyForm.classList.remove('hidden');
                companyForm.classList.add('visible');
                // required přepínač
                toggleRequired(personForm, false);
                toggleRequired(companyForm, true);
            }
            
            console.log('📊 Stav formulářů:', {
                personForm: {
                    display: personForm.style.display,
                    classes: personForm.className
                },
                companyForm: {
                    display: companyForm.style.display,
                    classes: companyForm.className
                }
            });
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

// Ověření IČO přes ARES veřejné API (fail-safe: pokud ARES nedostupné, registraci nepovolit)
// Pozn.: pro produkci doporučujeme serverový proxy kvůli CORS a rate-limitům.
async function validateICOWithARES(ico) {
    const n = normalizeICO(ico);
    if (n.length !== 8) return { ok: false, reason: 'IČO musí mít 8 číslic.' };
    try {
        // Primární endpoint (ARES REST)
        const urlV1 = `https://ares.gov.cz/ekonomicke-subjekty-v-be/v1/ekonomicke-subjekty/${n}`;
        const res = await fetch(urlV1, { method: 'GET' });
        if (!res.ok) {
            return { ok: false, reason: 'Subjekt s tímto IČO nebyl nalezen.' };
        }
        const data = await res.json().catch(() => ({}));
        // Ověření dat – hledáme minimálně IČO / obchodní jméno
        if (!data || (!data.ico && !data.IC)) {
            return { ok: false, reason: 'Subjekt s tímto IČO nebyl nalezen.' };
        }
        const companyName = data.obchodniJmeno || data.obchodni_name || data.obchodni_jmeno || '';
        const seat = data.sidlo || data.sídlo || data.seat || null;
        return { ok: true, name: companyName, seat };
    } catch (e) {
        return { ok: false, reason: 'ARES je dočasně nedostupný. Zkuste to později.' };
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
        const rawPhone = userData.phone || userData.companyPhone || '';
        const normalizedPhone = normalizePhone(rawPhone);
        // Pokud jde o firmu, ověřit IČO přes ARES
        if (userData.type === 'company') {
            const icoCheck = await validateICOWithARES(userData.ico || '');
            if (!icoCheck.ok) {
                showMessage(icoCheck.reason || 'IČO se nepodařilo ověřit.', 'error');
                return;
            }
            // Volitelně doplnit obchodní název/sídlo z ARES
            if (!userData.companyName && icoCheck.name) {
                userData.companyName = icoCheck.name;
            }
            if (!userData.companyAddress && icoCheck.seat && icoCheck.seat.text) {
                userData.companyAddress = icoCheck.seat.text;
            }
        }
        if (!normalizedPhone) {
            showMessage('Telefon je povinný a musí být ve formátu +420...', 'error');
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
            // Obchodní informace
            businessName: userData.companyName || userData.businessName || null,
            businessType: userData.businessType || null,
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
            profileData.company = {
                companyName: userData.companyName || null,
                ico: normalizeICO(userData.ico || '') || null,
                dic: userData.dic || null,
                phone: normalizedPhone || null,
                address: userData.companyAddress || null
            };
        }
        
        await setDoc(doc(firebaseDb, 'users', user.uid, 'profile', 'profile'), profileData);

        // Manuálně aktualizovat UI po registraci
        console.log('🔄 Manuálně aktualizuji UI po registraci');
        updateUI(user);

        showMessage('Úspěšně jste se zaregistrovali!', 'success');
        closeAuthModal();
        return user;
    } catch (error) {
        handleAuthError(error);
    }
}

// Přihlášení uživatele
async function login(email, password) {
    try {
        console.log('🔐 Pokus o přihlášení:', { email, firebaseAuth: !!firebaseAuth });
        
        if (!firebaseAuth) {
            console.error('❌ Firebase Auth není dostupný!');
            showMessage('Chyba: Firebase není načten. Obnovte stránku.', 'error');
            return;
        }
        
        console.log('📦 Importuji Firebase Auth modul...');
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        console.log('✅ Firebase Auth modul načten');
        
        console.log('🔑 Volám signInWithEmailAndPassword...');
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        console.log('✅ Přihlášení úspěšné:', userCredential.user);
        
        // Manuálně aktualizovat UI po přihlášení
        console.log('🔄 Manuálně aktualizuji UI po přihlášení');
        updateUI(userCredential.user);
        
        showMessage('Úspěšně jste se přihlásili!', 'success');
        closeAuthModal();
        return userCredential.user;
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
async function logout() {
    try {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        
        await signOut(firebaseAuth);
        showMessage('Úspěšně jste se odhlásili!', 'success');
    } catch (error) {
        handleAuthError(error);
    }
}

// Aktualizace UI podle stavu přihlášení
function updateUI(user) {
    console.log('🔄 Aktualizuji UI pro uživatele:', user ? user.email : 'Odhlášen');
    console.log('🔄 updateUI volána na stránce:', window.location.pathname);
    console.log('🔄 updateUI volána v čase:', new Date().toLocaleTimeString());
    
    const authSection = document.querySelector('.auth-section');
    const userProfileSection = document.querySelector('.user-profile-section');
    
    console.log('🔍 UI elementy:', { 
        authSection: !!authSection, 
        userProfileSection: !!userProfileSection,
        authSectionDisplay: authSection ? authSection.style.display : 'N/A',
        userProfileSectionDisplay: userProfileSection ? userProfileSection.style.display : 'N/A'
    });
    
    // Debug: Zkontrolovat všechny možné elementy
    const allAuthElements = document.querySelectorAll('[class*="auth"]');
    const allUserElements = document.querySelectorAll('[class*="user"]');
    console.log('🔍 Všechny auth elementy:', allAuthElements.length);
    console.log('🔍 Všechny user elementy:', allUserElements.length);
    
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
                    
                    // Zobrazit profilový obrázek v navbaru
                    updateNavbarAvatar(userProfile?.profilePictureUrl);
                    
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
    } else {
        // Uživatel není přihlášen
        if (authSection) authSection.style.display = 'flex';
        if (userProfileSection) userProfileSection.style.display = 'none';
        
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
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Přihlášení</h2>
                <span class="close" onclick="closeAuthModal()">&times;</span>
            </div>
            <form id="authForm" class="auth-form">
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
                    <div class="form-group">
                        <input type="text" id="firstName" name="firstName" placeholder="Jméno" required>
                    </div>
                    <div class="form-group">
                        <input type="text" id="lastName" name="lastName" placeholder="Příjmení" required>
                    </div>
                    <div class="form-group">
                        <input type="tel" id="phone" name="phone" placeholder="Telefon" required>
                    </div>
                    <div class="form-group">
                        <input type="date" id="birthDate" name="birthDate" placeholder="Datum narození" required>
                    </div>
                </div>

                <!-- Formulář pro firmu -->
                <div class="company-form" style="display: none;">
                    <div class="form-group">
                        <input type="text" id="companyName" name="companyName" placeholder="Název firmy" required>
                    </div>
                    <div class="form-group">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="text" id="ico" name="ico" placeholder="IČ" required style="flex:1;">
                            <button type="button" id="btnVerifyICO" class="btn">Ověřit</button>
                        </div>
                        <div id="icoStatus" style="font-size:13px; margin-top:4px; color:#6b7280;"></div>
                    </div>
                    <div class="form-group">
                        <input type="tel" id="companyPhone" name="companyPhone" placeholder="Telefon" required>
                    </div>
                    <div class="form-group">
                        <input type="email" id="companyEmail" name="companyEmail" placeholder="Email" required>
                    </div>
                </div>

                <!-- Telefon a heslo -->
                <div class="form-group">
                    <input type="tel" id="authPhone" name="phone" placeholder="Telefon" required>
                </div>
                
                <div class="form-group" id="phoneStep2" style="display: none;">
                    <input type="text" id="phoneCode" name="phoneCode" placeholder="Kód z SMS" required>
                </div>
                
                <div class="form-group">
                    <input type="password" id="authPassword" name="password" placeholder="Heslo" required>
                </div>

                <div class="form-group">
                    <button type="submit" class="auth-submit-btn btn btn-primary">Přihlásit se</button>
                    <button type="button" id="btnSendPhoneCode" class="btn btn-secondary" style="display: none;">Odeslat SMS kód</button>
                    <button type="button" id="btnAuthSubmit" class="btn btn-primary" style="display: none;">Dokončit registraci</button>
                </div>

                <div class="form-group">
                    <button type="button" class="auth-switch-btn btn btn-link">Nemáte účet? Zaregistrujte se</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Nastavit event listenery
    setupAuthModalEvents();
    
    return modal;
}

// Nastavení event listenerů pro auth modal
function setupAuthModalEvents() {
    // Event listener pro přepínání mezi přihlášením a registrací
    const authSwitchBtn = document.querySelector('.auth-switch-btn');
    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', () => {
            const type = authSwitchBtn.getAttribute('data-type');
            showAuthModal(type);
        });
    }
    
    // Event listener pro tlačítka typu registrace
    const typeButtons = document.querySelectorAll('.registration-type-btn');
    typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            typeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const type = btn.getAttribute('data-type');
            const personForm = document.querySelector('.person-form');
            const companyForm = document.querySelector('.company-form');
            
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
    const btnSendPhoneCode = document.getElementById('btnSendPhoneCode');
    if (btnSendPhoneCode) {
        btnSendPhoneCode.addEventListener('click', async () => {
            console.log('Odeslání SMS kódu');
        });
    }
}

// Zobrazení auth modalu
function showAuthModal(type = 'login') {
    console.log('🔧 showAuthModal volána s typem:', type);
    let modal = document.getElementById('authModal');
    
    // Pokud modal neexistuje, vytvoř ho dynamicky
    if (!modal) {
        console.log('🔧 Modal neexistuje, vytvářím ho dynamicky');
        modal = createAuthModal();
    }
    
    const modalTitle = document.querySelector('.modal-title');
    const submitBtn = document.querySelector('.auth-submit-btn');
    const switchBtn = document.querySelector('.auth-switch-btn');
    const registrationType = document.querySelector('.registration-type');
    const personForm = document.querySelector('.person-form');
    const companyForm = document.querySelector('.company-form');
    
    console.log('🔍 Elementy nalezeny:', {
        modal: !!modal,
        modalTitle: !!modalTitle,
        submitBtn: !!submitBtn,
        switchBtn: !!switchBtn,
        registrationType: !!registrationType,
        personForm: !!personForm,
        companyForm: !!companyForm
    });

    const btnSendPhoneCode = document.getElementById('btnSendPhoneCode');
    const btnAuthSubmit = document.getElementById('btnAuthSubmit');
    const phoneStep2 = document.getElementById('phoneStep2');

    if (type === 'login') {
        console.log('🔧 Nastavuji modal pro přihlášení');
        modalTitle.textContent = 'Přihlášení';
        submitBtn.textContent = 'Přihlásit se';
        switchBtn.textContent = 'Nemáte účet? Zaregistrujte se';
        switchBtn.setAttribute('data-type', 'register');
        registrationType.style.display = 'none';
        personForm.style.display = 'none';
        companyForm.style.display = 'none';
        
        // Odstranit required atribut ze skrytých polí při přihlášení
        toggleRequired(personForm, false);
        toggleRequired(companyForm, false);
        
        // Přepnout tlačítka a kroky
        if (btnSendPhoneCode) btnSendPhoneCode.style.display = 'none';
        if (btnAuthSubmit) btnAuthSubmit.style.display = '';
        if (phoneStep2) phoneStep2.style.display = 'none';

        console.log('✅ Modal nastaven pro přihlášení:', { 
            title: modalTitle.textContent, 
            submitBtn: submitBtn.textContent 
        });
    } else {
        modalTitle.textContent = 'Registrace';
        submitBtn.textContent = 'Zaregistrovat se';
        switchBtn.textContent = 'Již máte účet? Přihlaste se';
        switchBtn.setAttribute('data-type', 'login');
        registrationType.style.display = 'block';
        
        // Zobrazit formulář pro fyzickou osobu jako výchozí
        personForm.style.display = 'block';
        personForm.classList.add('visible');
        personForm.classList.remove('hidden');
        companyForm.style.display = 'none';
        companyForm.classList.add('hidden');
        companyForm.classList.remove('visible');
        
        // Přepnout tlačítka a kroky
        if (btnSendPhoneCode) btnSendPhoneCode.style.display = '';
        if (btnAuthSubmit) btnAuthSubmit.style.display = 'none';
        if (phoneStep2) phoneStep2.style.display = 'none';

        console.log('🎯 Inicializace registrace - výchozí stav:', {
            personForm: {
                display: personForm.style.display,
                classes: personForm.className
            },
            companyForm: {
                display: companyForm.style.display,
                classes: companyForm.className
            }
        });
        
        // Aktivovat tlačítko pro fyzickou osobu
        const typeButtons = document.querySelectorAll('.registration-type-btn');
        typeButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('.registration-type-btn[data-type="person"]').classList.add('active');
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Debug: Zkontrolovat formulář po otevření modalu a nastavit event listener
    setTimeout(() => {
        const authFormAfterOpen = document.getElementById('authForm');
        console.log('🔍 AuthForm po otevření modalu:', authFormAfterOpen ? 'NALEZEN' : 'NENALEZEN');
        console.log('🔍 AuthForm element po otevření:', authFormAfterOpen);
        if (authFormAfterOpen) {
            console.log('🔍 AuthForm ID po otevření:', authFormAfterOpen.id);
            console.log('🔍 AuthForm class po otevření:', authFormAfterOpen.className);
            
            // Nastavit event listener na formulář po otevření modalu
            console.log('🔧 Nastavuji event listener na formulář po otevření modalu');
            
            // Debug: Zkontrolovat, jestli už má event listener
            console.log('🔍 AuthForm má event listener:', authFormAfterOpen.onsubmit !== null);
            
            // ODSTRANĚNO: Duplicitní event listener - formulář už má listener v setupEventListeners()
            // Přidávání dalšího listeneru způsobovalo vícenásobné odesílání formuláře
        }
    }, 100);
}

// Zavření auth modalu
function closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Vyčištění formuláře
    const form = document.getElementById('authForm');
    form.reset();
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
    
    switch (error.code) {
        case 'auth/email-already-in-use':
            message = 'Tento email je již používán.';
            break;
        case 'auth/weak-password':
            message = 'Heslo je příliš slabé.';
            break;
        case 'auth/invalid-email':
            message = 'Neplatný email.';
            break;
        case 'auth/user-not-found':
            message = 'Uživatel s tímto emailem neexistuje.';
            break;
        case 'auth/wrong-password':
            message = 'Nesprávné heslo.';
            break;
        case 'auth/too-many-requests':
            message = 'Příliš mnoho pokusů. Zkuste to později.';
            break;
    }
    
    showMessage(message, 'error');
}

// Překlad běžných chyb phone auth do srozumitelných zpráv
function humanizePhoneError(error) {
    const code = error?.code || '';
    switch (code) {
        case 'auth/invalid-phone-number':
            return 'Neplatné telefonní číslo.';
        case 'auth/missing-phone-number':
            return 'Chybí telefonní číslo.';
        case 'auth/too-many-requests':
            return 'Příliš mnoho pokusů. Zkuste to později.';
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
            return error?.message || 'Došlo k chybě. Zkuste to znovu.';
    }
}

// Zobrazení zprávy
function showMessage(message, type = 'info') {
    console.log(`💬 Zobrazuji zprávu: ${message} (${type})`);
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#fff3cd'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#856404'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#ffeaa7'};
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Přidání služby
async function addService(serviceData) {
    try {
        if (!authCurrentUser) {
            showMessage('Musíte být přihlášeni pro přidání služby.', 'error');
            return;
        }

        const { addDoc, collection, setDoc, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');

        // Zkontrolovat, zda uživatel existuje, pokud ne, vytvořit ho
        const userRef = doc(firebaseDb, 'users', authCurrentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // Vytvořit root dokument uživatele
            await setDoc(userRef, {
                uid: authCurrentUser.uid,
                email: authCurrentUser.email,
                createdAt: new Date()
            });
            
            // Vytvořit profil uživatele
            await setDoc(doc(firebaseDb, 'users', authCurrentUser.uid, 'profile', 'profile'), {
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
                const previewUrl = await getDownloadURL(previewSnapshot.ref);
                uploadedImages.push({
                    url: previewUrl,
                    isPreview: true,
                    name: serviceData.previewImage.name
                });
                console.log('✅ Náhledový obrázek nahrán:', previewUrl);
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

        await addDoc(collection(firebaseDb, 'users', authCurrentUser.uid, 'inzeraty'), serviceToSave);

        showMessage('Služba byla úspěšně přidána!', 'success');
        closeAddServiceModal();
        
        // Real-time listener automaticky aktualizuje seznam
    } catch (error) {
        console.error('Chyba při přidávání služby:', error);
        showMessage('Došlo k chybě při přidávání služby.', 'error');
    }
}

// Načtení uživatelského profilu z Firestore (users/{uid}/profile/profile)
async function loadUserProfile(uid) {
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(firebaseDb, 'users', uid, 'profile', 'profile');
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
function setupEventListeners() {
    console.log('🔧 Nastavuji event listenery');
    
    // Auth formulář - POUZE JEDEN LISTENER (odstraněny duplicity)
    const authForm = document.getElementById('authForm');
    console.log('🔍 Hledám authForm:', authForm ? 'NALEZEN' : 'NENALEZEN');
    console.log('🔍 AuthForm element:', authForm);
    if (authForm) {
        // Odstranit existující listenery - klonovat formulář a nahradit
        const newForm = authForm.cloneNode(true);
        authForm.parentNode.replaceChild(newForm, authForm);
        const cleanAuthForm = document.getElementById('authForm');
        
        console.log('🔧 Auth formulář nalezen, přidávám event listener (bez duplicit)');
        console.log('🔧 AuthForm ID:', cleanAuthForm.id);
        console.log('🔧 AuthForm class:', cleanAuthForm.className);
        
        // Přidat listener pouze jednou
        cleanAuthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Zastavit propagaci eventu
            
            // Zamezit vícenásobnému odesílání
            const submitBtn = cleanAuthForm.querySelector('button[type="submit"]');
            if (submitBtn && submitBtn.disabled) {
                console.log('⚠️ Formulář se již odesílá, ignoruji další pokus');
                return;
            }
            
            if (submitBtn) {
                submitBtn.disabled = true;
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Zpracovávám...';
            }
            
            console.log('📝 Auth formulář odeslán');
            
            const formData = new FormData(cleanAuthForm);
            const email = formData.get('email');
            const password = formData.get('password');
            
            console.log('📧 Formulář data:', { email, password: password ? '***' : 'prázdné' });
            
            const modalTitle = document.querySelector('.modal-title');
            const titleText = modalTitle ? modalTitle.textContent : 'NENALEZEN';
            const isLogin = titleText === 'Přihlášení';
            console.log('🔍 Typ akce:', { 
                modalTitle: !!modalTitle, 
                titleText: titleText, 
                isLogin: isLogin 
            });
            
            try {
                if (isLogin) {
                    console.log('🔐 Volám login funkci');
                    await login(email, password);
                } else {
                    // U registrace submit už nevolá registraci; používáme tlačítko pro telefonní ověření
                    console.log('ℹ️ Ignoruji submit u registrace, použijte tlačítko pro odeslání SMS.');
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
        });
    }
    // Tlačítko: Pokračovat na ověření telefonního čísla
    const btnSendPhoneCode = document.getElementById('btnSendPhoneCode');
    if (btnSendPhoneCode) {
        btnSendPhoneCode.addEventListener('click', async () => {
            try {
                // Validace vstupů kroku 1
                const form = document.getElementById('authForm');
                const formData = new FormData(form);

                const email = formData.get('email');
                const password = formData.get('password');
                const activeTypeBtn = document.querySelector('.registration-type-btn.active');
                const userType = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'person';
                const phoneInput = userType === 'person' ? 'phone' : 'companyPhone';
                const phone = (formData.get(phoneInput) || '').toString().trim();
                const ico = (formData.get('ico') || '').toString().trim();

                if (!email || !password || !phone) {
                    showMessage('Vyplňte e‑mail, heslo a telefon.', 'error');
                    return;
                }
                // Ověřit IČO pro firemní registraci
                if (userType === 'company') {
                    const icoCheck = await validateICOWithARES(ico);
                    if (!icoCheck.ok) {
                        showMessage(icoCheck.reason || 'IČO se nepodařilo ověřit.', 'error');
                        return;
                    }
                }
                if (!phone.startsWith('+') && !phone.startsWith('00') && !phone.startsWith('420')) {
                    showMessage('Telefon uveďte v mezinárodním formátu (např. +420...).', 'error');
                    return;
                }

                // Normalizovat a ověřit unikátnost telefonu ještě před odesláním SMS
                const normalizedPhone = normalizePhone(phone);
                const available = await isPhoneAvailable(normalizedPhone);
                if (!available) {
                    showMessage('Toto telefonní číslo je již používáno jiným účtem.', 'error');
                    return;
                }

                // Lazy load potřebných funkcí (Firebase v10.7.1 v projektu)
                const authMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                const { RecaptchaVerifier, signInWithPhoneNumber } = authMod;

                // Vždy vytvořit čistou reCAPTCHA instanci (prevence DUPE)
                try { if (recaptchaVerifier) { await recaptchaVerifier.clear(); } } catch (_) {}
                recaptchaVerifier = null;
                const containerId = 'recaptcha-container';
                const container = document.getElementById(containerId);
                if (!container) {
                    showMessage('Chybí reCAPTCHA kontejner v DOM.', 'error');
                    return;
                }
                
                // Použít invisible reCAPTCHA pro spolehlivější automatizaci
                // Poznámka: Invisible reCAPTCHA nevyžaduje uživatelskou interakci
                recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
                    size: 'invisible', // Invisible reCAPTCHA - automaticky ověří
                    callback: (response) => {
                        console.log('✅ reCAPTCHA callback vyvolán, token:', response ? 'získán' : 'chybí');
                    },
                    'expired-callback': () => {
                        console.warn('⚠️ reCAPTCHA expired');
                        showMessage('Ověření reCAPTCHA vypršelo, zkuste to znovu.', 'error');
                        recaptchaVerifier = null;
                    }
                });
                
                // Render reCAPTCHA a počkat na dokončení
                btnSendPhoneCode.disabled = true;
                btnSendPhoneCode.textContent = 'Inicializuji ověření...';
                try { 
                    console.log('🔄 Renderování reCAPTCHA...');
                    await recaptchaVerifier.render();
                    console.log('✅ reCAPTCHA render dokončen');
                    
                    // Pro invisible reCAPTCHA musíme vyvolat verify() explicitně
                    console.log('🔄 Ověřování reCAPTCHA (invisible)...');
                    await recaptchaVerifier.verify();
                    console.log('✅ reCAPTCHA verify dokončeno');
                    
                    // Počkat chvíli, aby se reCAPTCHA správně inicializovala
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (renderError) {
                    console.error('❌ Chyba při render/verify reCAPTCHA:', renderError);
                    console.error('❌ Error details:', {
                        code: renderError?.code,
                        message: renderError?.message,
                        name: renderError?.name
                    });
                    throw new Error('Nepodařilo se inicializovat ověření. Zkuste obnovit stránku.');
                }

                console.log('📱 Pokus o odeslání SMS na:', normalizedPhone);
                console.log('🔐 reCAPTCHA verifier:', recaptchaVerifier ? 'existuje' : 'chybí');
                console.log('🔥 Firebase Auth:', firebaseAuth ? 'existuje' : 'chybí');
                console.log('📋 Firebase config:', {
                    projectId: firebaseAuth.app.options.projectId,
                    apiKey: firebaseAuth.app.options.apiKey ? 'nastaven' : 'chybí'
                });
                
                btnSendPhoneCode.textContent = 'Odesílám SMS...';

                // Odeslat SMS s podrobným error handlingem
                try {
                    console.log('📤 Volám signInWithPhoneNumber...');
                    phoneConfirmationResult = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, recaptchaVerifier);
                    console.log('✅ SMS úspěšně odeslána, phoneConfirmationResult:', !!phoneConfirmationResult);
                } catch (smsError) {
                    console.error('❌ Chyba při odesílání SMS:', smsError);
                    console.error('❌ Error code:', smsError?.code);
                    console.error('❌ Error message:', smsError?.message);
                    console.error('❌ Full error:', JSON.stringify(smsError, null, 2));
                    
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

                // Zobrazit krok 2
                const phoneStep2 = document.getElementById('phoneStep2');
                const btnAuthSubmit = document.getElementById('btnAuthSubmit');
                if (phoneStep2) phoneStep2.style.display = '';
                if (btnSendPhoneCode) btnSendPhoneCode.style.display = 'none';
                if (btnAuthSubmit) btnAuthSubmit.style.display = 'none';

                showMessage('SMS s kódem byla odeslána.', 'success');
            } catch (err) {
                try { if (recaptchaVerifier) recaptchaVerifier.clear(); recaptchaVerifier = null; } catch (_) {}
                console.error(err);
                showMessage(humanizePhoneError(err), 'error');
            } finally {
                btnSendPhoneCode.disabled = false;
                btnSendPhoneCode.textContent = 'Pokračovat na ověření telefonního čísla';
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
                    userData.companyPhone = formData.get('companyPhone');
                    userData.companyAddress = formData.get('companyAddress');
                }
                // Při dokončení registrace ještě jednou ověřit IČO (pro jistotu)
                if (userType === 'company') {
                    const icoCheck = await validateICOWithARES(userData.ico || '');
                    if (!icoCheck.ok) {
                        showMessage(icoCheck.reason || 'IČO se nepodařilo ověřit.', 'error');
                        return;
                    }
                    if (!userData.companyName && icoCheck.name) {
                        userData.companyName = icoCheck.name;
                    }
                    if (!userData.companyAddress && icoCheck.seat && icoCheck.seat.text) {
                        userData.companyAddress = icoCheck.seat.text;
                    }
                }

                const rawPhone = userType === 'person' ? (userData.phone || '') : (userData.companyPhone || '');
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
                    profileData.company = {
                        companyName: userData.companyName || null,
                        ico: normalizeICO(userData.ico || '') || null,
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
                console.error(err);
                showMessage(humanizePhoneError(err), 'error');
            } finally {
                btnVerifyPhoneCode.disabled = false;
                btnVerifyPhoneCode.textContent = 'Ověřit kód a dokončit registraci';
            }
        });
    }

    // Ověření IČ přes ARES (vedle pole IČ)
    const btnVerifyICO = document.getElementById('btnVerifyICO');
    if (btnVerifyICO) {
        btnVerifyICO.addEventListener('click', async () => {
            try {
                const icoInput = document.getElementById('ico') || document.getElementById('companyId');
                const statusEl = document.getElementById('icoStatus');
                const companyNameEl = document.getElementById('companyName');
                const companyAddressEl = document.getElementById('companyAddress');
                const icoVal = (icoInput?.value || '').toString().trim();
                if (!icoVal) { if (statusEl) { statusEl.style.color = '#dc3545'; statusEl.textContent = 'Zadejte IČ'; } return; }
                btnVerifyICO.disabled = true;
                const res = await validateICOWithARES(icoVal);
                if (res.ok) {
                    if (statusEl) { statusEl.style.color = '#28a745'; statusEl.textContent = 'IČ ověřeno'; }
                    // předvyplnit název/sídlo pokud jsou prázdné
                    if (res.name && companyNameEl && !companyNameEl.value) companyNameEl.value = res.name;
                    if (res.seat && companyAddressEl && !companyAddressEl.value && res.seat.text) companyAddressEl.value = res.seat.text;
                } else {
                    if (statusEl) { statusEl.style.color = '#dc3545'; statusEl.textContent = res.reason || 'IČ nebylo ověřeno'; }
                }
            } catch (e) {
                const statusEl = document.getElementById('icoStatus');
                if (statusEl) { statusEl.style.color = '#dc3545'; statusEl.textContent = 'Chyba při ověřování IČ'; }
            } finally {
                btnVerifyICO.disabled = false;
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
        const primarySubmit = document.getElementById('btnAuthSubmit');
        const sendCodeBtn = document.getElementById('btnSendPhoneCode');
        if (primarySubmit) primarySubmit.textContent = 'Zaregistrovat se';
        if (sendCodeBtn) sendCodeBtn.textContent = 'Pokračovat na ověření telefonního čísla';
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
            closeAuthModal();
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
function setupImagePreviews() {
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
            
            additionalImagesPreview.innerHTML = '';
            
            files.forEach((file, index) => {
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

// Debug: Zkontrolovat, zda jsou funkce dostupné
console.log('🔧 Auth.js: Exportované funkce:', {
    showAuthModal: typeof window.showAuthModal,
    closeAuthModal: typeof window.closeAuthModal,
    showAddServiceModal: typeof window.showAddServiceModal
});

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
            console.log('✅ showAuthModal je dostupná');
        }
    }, 1000);
});

// Funkce pro aktualizaci profilového obrázku v navbaru
function updateNavbarAvatar(profilePictureUrl) {
    const userAvatarElements = document.querySelectorAll('.user-avatar');
    if (userAvatarElements.length === 0) {
        console.log('⚠️ Žádné .user-avatar elementy nenalezeny');
        return;
    }
    
    userAvatarElements.forEach(avatar => {
        if (profilePictureUrl) {
            // Pokud má uživatel profilový obrázek, zobrazit ho
            let img = avatar.querySelector('img');
            if (!img) {
                const icon = avatar.querySelector('i');
                if (icon) icon.style.display = 'none';
                img = document.createElement('img');
                img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover;';
                avatar.appendChild(img);
            }
            img.src = profilePictureUrl;
            img.style.display = 'block';
            img.alt = 'Profilový obrázek';
        } else {
            // Pokud nemá profilový obrázek, zobrazit ikonu
            const icon = avatar.querySelector('i');
            if (icon) {
                icon.style.display = 'flex';
            } else {
                // Pokud není ikona, vytvořit ji
                const newIcon = document.createElement('i');
                newIcon.className = 'fas fa-user';
                newIcon.style.cssText = 'font-size: 0.9rem; color: white;';
                avatar.appendChild(newIcon);
            }
            const img = avatar.querySelector('img');
            if (img) img.style.display = 'none';
        }
    });
}

// Export funkce globálně
window.updateNavbarAvatar = updateNavbarAvatar;