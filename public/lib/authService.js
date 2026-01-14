// Jednotný auth service pro registraci a přihlášení
// Zajišťuje deterministické chování bez ohledu na stránku

/**
 * Zaregistruje nového uživatele a uloží profil do DB
 * @param {Object} params - Registrační data
 * @param {string} params.email - Email uživatele
 * @param {string} params.password - Heslo
 * @param {Object} params.profileData - Data profilu (firstName, lastName, phone, atd.)
 * @returns {Promise<Object>} Firebase user objekt
 */
async function registerUser({ email, password, profileData }) {
    const pathname = window.location.pathname;
    console.log(`[AUTH SERVICE] 📝 Registrace spuštěna z: ${pathname}`, { 
        email, 
        hasPassword: !!password,
        profileDataKeys: Object.keys(profileData || {})
    });

    // Kontrola Firebase dostupnosti
    if (!window.firebaseAuth || !window.firebaseDb) {
        const error = new Error('Firebase není dostupný. Obnovte stránku.');
        console.error('[AUTH SERVICE] ❌', error.message, { 
            firebaseAuth: !!window.firebaseAuth, 
            firebaseDb: !!window.firebaseDb 
        });
        throw error;
    }

    try {
        const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const { setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

        // 1. Vytvořit auth uživatele
        console.log('[AUTH SERVICE] 🔐 Vytvářím auth uživatele...');
        const userCredential = await createUserWithEmailAndPassword(window.firebaseAuth, email, password);
        const user = userCredential.user;
        console.log('[AUTH SERVICE] ✅ Auth uživatel vytvořen:', user.uid);

        // 2. Vytvořit root dokument uživatele
        console.log('[AUTH SERVICE] 💾 Ukládám root dokument uživatele...');
        await setDoc(doc(window.firebaseDb, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            createdAt: serverTimestamp(),
            userType: profileData?.userType || 'person',
            provider: 'password'
        }, { merge: true });
        console.log('[AUTH SERVICE] ✅ Root dokument uložen');

        // 3. Vytvořit profil subdokument
        const finalProfileData = {
            email: user.email,
            balance: 1000,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            userType: profileData?.userType || 'person',
            plan: 'none',
            ...profileData
        };

        console.log('[AUTH SERVICE] 💾 Ukládám profil uživatele...', finalProfileData);
        await setDoc(
            doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'), 
            finalProfileData, 
            { merge: true }
        );
        console.log('[AUTH SERVICE] ✅ Profil uložen');

        // 4. Ověřit, že se data skutečně uložila
        const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const savedProfileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const savedProfileSnap = await getDoc(savedProfileRef);
        
        if (!savedProfileSnap.exists()) {
            throw new Error('Profil se nepodařilo uložit do databáze.');
        }
        
        const savedData = savedProfileSnap.data();
        console.log('[AUTH SERVICE] ✅ Ověření uložených dat:', {
            uid: user.uid,
            email: savedData.email,
            userType: savedData.userType,
            firstName: savedData.firstName,
            lastName: savedData.lastName
        });

        // 5. Aktualizovat displayName
        try {
            const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            const displayName = profileData?.name || profileData?.firstName || email.split('@')[0];
            await updateProfile(user, { displayName });
            console.log('[AUTH SERVICE] ✅ DisplayName aktualizován:', displayName);
        } catch (profileUpdateError) {
            console.warn('[AUTH SERVICE] ⚠️ Chyba při aktualizaci displayName (není kritická):', profileUpdateError);
        }

        console.log(`[AUTH SERVICE] ✅ Registrace úspěšně dokončena z: ${pathname}`, { uid: user.uid });
        return user;
    } catch (error) {
        console.error(`[AUTH SERVICE] ❌ Chyba při registraci z: ${pathname}`, error);
        throw error;
    }
}

/**
 * Přihlásí uživatele
 * @param {string} email - Email uživatele
 * @param {string} password - Heslo
 * @returns {Promise<Object>} Firebase user objekt
 */
async function loginUser(email, password) {
    const pathname = window.location.pathname;
    console.log(`[AUTH SERVICE] 🔐 Přihlášení spuštěno z: ${pathname}`, { email });

    if (!window.firebaseAuth) {
        const error = new Error('Firebase není dostupný. Obnovte stránku.');
        console.error('[AUTH SERVICE] ❌', error.message);
        throw error;
    }

    try {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const userCredential = await signInWithEmailAndPassword(window.firebaseAuth, email, password);
        const user = userCredential.user;
        console.log(`[AUTH SERVICE] ✅ Přihlášení úspěšné z: ${pathname}`, { uid: user.uid });
        return user;
    } catch (error) {
        console.error(`[AUTH SERVICE] ❌ Chyba při přihlášení z: ${pathname}`, error);
        throw error;
    }
}

/**
 * Zajistí, že uživatel má profil v Firestore (fail-safe pro existující účty bez profilu)
 * @param {Object} user - Firebase user objekt
 * @returns {Promise<boolean>} true pokud byl profil vytvořen/aktualizován, false pokud už existoval
 */
async function ensureUserProfile(user) {
    if (!user || !user.uid) {
        console.warn('[AUTH SERVICE] ⚠️ ensureUserProfile: Neplatný user objekt');
        return false;
    }

    if (!window.firebaseDb) {
        console.error('[AUTH SERVICE] ❌ ensureUserProfile: Firebase DB není dostupný');
        return false;
    }

    try {
        const { getDoc, setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Zkontrolovat root dokument
        const userRef = doc(window.firebaseDb, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        // Zkontrolovat profil subdokument
        const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        let created = false;
        
        // Pokud root dokument neexistuje, vytvořit ho
        if (!userSnap.exists()) {
            console.log('[AUTH SERVICE] 🔧 Vytvářím chybějící root dokument uživatele:', user.uid);
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                createdAt: serverTimestamp(),
                provider: user.providerData?.[0]?.providerId || 'unknown',
                type: 'person'
            }, { merge: true });
            created = true;
        }
        
        // Pokud profil neexistuje, vytvořit ho
        if (!profileSnap.exists()) {
            console.log('[AUTH SERVICE] 🔧 Vytvářím chybějící profil uživatele:', user.uid);
            const profileData = {
                email: user.email || '',
                name: user.displayName || user.email?.split('@')[0] || 'Uživatel',
                balance: 1000,
                plan: 'none',
                userType: 'person',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            await setDoc(profileRef, profileData, { merge: true });
            created = true;
            console.log('[AUTH SERVICE] ✅ Profil vytvořen pro uživatele:', user.uid);
        } else {
            console.log('[AUTH SERVICE] ✅ Profil už existuje pro uživatele:', user.uid);
        }
        
        return created;
    } catch (error) {
        console.error('[AUTH SERVICE] ❌ Chyba při ensureUserProfile:', error);
        return false;
    }
}

// Export pro ES moduly i globální použití (kompatibilita)
export {
    registerUser,
    loginUser,
    ensureUserProfile
};

// Globální export pro zpětnou kompatibilitu
if (typeof window !== 'undefined') {
    window.authService = {
        register: registerUser,
        login: loginUser,
        ensureUserProfile: ensureUserProfile
    };
    
    // Hard diagnostika při načtení
    console.log('[BOOT] authService loaded:', {
        register: typeof registerUser,
        login: typeof loginUser,
        ensureUserProfile: typeof ensureUserProfile
    });
}
