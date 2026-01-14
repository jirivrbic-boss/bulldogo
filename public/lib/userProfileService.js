// Centralizovaná služba pro správu uživatelských profilů v Firestore
// Zajišťuje, že každý auth uživatel má vždy kompletní profil v DB

/**
 * Normalizuje payload z registračního formuláře do jednotného formátu
 * @param {Object} formData - Data z formuláře (firstName, lastName, companyName, ico, atd.)
 * @param {Object} authUser - Firebase Auth user objekt (pro uid, phoneNumber, email, provider)
 * @returns {Object} Normalizovaný payload pro uložení do Firestore
 */
function normalizeRegistrationPayload(formData, authUser) {
    const userType = formData.userType || formData.type || 'person';
    const normalized = {
        uid: authUser?.uid || '',
        type: userType,
        provider: formData.provider || (authUser?.providerData?.[0]?.providerId === 'phone' ? 'cloudotp' : 'password+phone') || 'phone',
        phoneNumber: authUser?.phoneNumber || formData.phoneNumber || formData.phone || '',
        email: authUser?.email || formData.email || '',
        consentAccepted: formData.consentAccepted !== undefined ? formData.consentAccepted : true,
        consentAt: formData.consentAccepted ? new Date().toISOString() : null
    };

    if (userType === 'person') {
        // Osobní údaje
        if (formData.firstName && formData.firstName.trim()) normalized.firstName = formData.firstName.trim();
        if (formData.lastName && formData.lastName.trim()) normalized.lastName = formData.lastName.trim();
        if (formData.birthDate && formData.birthDate.trim()) normalized.birthDate = formData.birthDate.trim();
        normalized.name = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'Uživatel';
    } else if (userType === 'company') {
        // Firemní údaje
        if (formData.companyName && formData.companyName.trim()) normalized.companyName = formData.companyName.trim();
        if (formData.ico && formData.ico.trim()) {
            // Normalizovat IČO (odstranit mezery, pomlčky)
            normalized.ico = formData.ico.trim().replace(/\s+/g, '').replace(/-/g, '');
        }
        if (formData.dic && formData.dic.trim()) normalized.dic = formData.dic.trim();
        if (formData.businessType && formData.businessType.trim()) normalized.businessType = formData.businessType.trim();
        if (formData.companyAddress && formData.companyAddress.trim()) normalized.companyAddress = formData.companyAddress.trim();
        if (formData.businessDescription && formData.businessDescription.trim()) normalized.businessDescription = formData.businessDescription.trim();
        normalized.name = (formData.companyName && formData.companyName.trim()) ? formData.companyName.trim() : 'Firma';
    }

    return normalized;
}

/**
 * Zajistí, že uživatel má profil v Firestore (fail-safe)
 * @param {string} uid - Firebase user UID
 * @param {Object} payload - Data pro profil (firstName, lastName, email, phone, atd.)
 * @returns {Promise<boolean>} true pokud byl profil vytvořen/aktualizován, false pokud už existoval a je kompletní
 */
async function ensureUserProfile(uid, payload = null) {
    const pathname = window.location.pathname;
    console.log(`[USER PROFILE SERVICE] 🔧 ensureUserProfile spuštěno z: ${pathname}`, { 
        uid, 
        hasPayload: !!payload,
        payloadKeys: payload ? Object.keys(payload) : []
    });

    if (!uid) {
        console.error('[USER PROFILE SERVICE] ❌ ensureUserProfile: Chybí UID');
        return false;
    }

    if (!window.firebaseDb) {
        console.error('[USER PROFILE SERVICE] ❌ ensureUserProfile: Firebase DB není dostupný');
        return false;
    }

    try {
        const { getDoc, setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Zkontrolovat root dokument
        const userRef = doc(window.firebaseDb, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        // Zkontrolovat profil subdokument
        const profileRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        let created = false;
        let needsUpdate = false;
        
        // Příprava dat pro root dokument
        const rootData = {
            uid: uid,
            updatedAt: serverTimestamp()
        };
        
        if (payload) {
            if (payload.email) rootData.email = payload.email;
            if (payload.phoneNumber) rootData.phoneNumber = payload.phoneNumber;
            if (payload.provider) rootData.provider = payload.provider;
            if (payload.type) rootData.type = payload.type;
        }
        
        // Pokud root dokument neexistuje, vytvořit ho
        if (!userSnap.exists()) {
            console.log('[USER PROFILE SERVICE] 🔧 Vytvářím chybějící root dokument uživatele:', uid);
            rootData.createdAt = serverTimestamp();
            if (!rootData.email && !rootData.phoneNumber) {
                // Fallback z auth uživatele
                const authUser = window.firebaseAuth?.currentUser;
                if (authUser) {
                    rootData.email = authUser.email || '';
                    rootData.phoneNumber = authUser.phoneNumber || '';
                    rootData.provider = authUser.providerData?.[0]?.providerId || 'unknown';
                }
            }
            await setDoc(userRef, rootData, { merge: true });
            created = true;
        } else {
            // Zkontrolovat, zda root dokument potřebuje aktualizaci
            const existingData = userSnap.data();
            if (payload) {
                if (payload.email && !existingData.email) {
                    rootData.email = payload.email;
                    needsUpdate = true;
                }
                if (payload.phoneNumber && !existingData.phoneNumber) {
                    rootData.phoneNumber = payload.phoneNumber;
                    needsUpdate = true;
                }
                if (payload.provider && !existingData.provider) {
                    rootData.provider = payload.provider;
                    needsUpdate = true;
                }
            }
            if (needsUpdate) {
                console.log('[USER PROFILE SERVICE] 🔧 Aktualizuji root dokument uživatele:', uid);
                await setDoc(userRef, rootData, { merge: true });
                created = true;
            }
        }
        
        // Příprava dat pro profil
        const profileData = {
            updatedAt: serverTimestamp()
        };
        
        if (payload) {
            // Základní údaje
            if (payload.email) profileData.email = payload.email;
            if (payload.phoneNumber || payload.phone) profileData.phone = payload.phoneNumber || payload.phone;
            if (payload.userType || payload.type) profileData.userType = payload.userType || payload.type;
            if (payload.name) profileData.name = payload.name;
            
            // Osobní údaje - STEJNĚ JAKO V HOBBY: kontrolovat .trim()
            if (payload.firstName && payload.firstName.trim()) profileData.firstName = payload.firstName.trim();
            if (payload.lastName && payload.lastName.trim()) profileData.lastName = payload.lastName.trim();
            if (payload.birthDate && payload.birthDate.trim()) profileData.birthDate = payload.birthDate.trim();
            
            // Firemní údaje - STEJNĚ JAKO OSOBNÍ ÚDAJE: kontrolovat .trim() a ukládat pouze pokud není prázdný
            if (payload.companyName && payload.companyName.trim()) profileData.businessName = payload.companyName.trim();
            if (payload.ico && payload.ico.trim()) profileData.businessIco = payload.ico.trim();
            if (payload.dic && payload.dic.trim()) profileData.businessDic = payload.dic.trim();
            if (payload.companyAddress && payload.companyAddress.trim()) profileData.businessAddress = payload.companyAddress.trim();
            if (payload.businessType && payload.businessType.trim()) profileData.businessType = payload.businessType.trim();
            if (payload.businessDescription && payload.businessDescription.trim()) profileData.businessDescription = payload.businessDescription.trim();
            
            // GDPR souhlas
            if (payload.consentAccepted !== undefined) {
                profileData.consentAccepted = payload.consentAccepted;
                if (payload.consentAccepted) {
                    profileData.consentAt = serverTimestamp();
                }
            }
        }
        
        // Pokud profil neexistuje, vytvořit ho
        if (!profileSnap.exists()) {
            console.log('[USER PROFILE SERVICE] 🔧 Vytvářím chybějící profil uživatele:', uid);
            profileData.createdAt = serverTimestamp();
            profileData.balance = payload?.balance || 1000;
            profileData.plan = payload?.plan || 'none';
            
            // Fallback hodnoty, pokud payload není
            if (!profileData.email) {
                const authUser = window.firebaseAuth?.currentUser;
                if (authUser) {
                    profileData.email = authUser.email || '';
                    profileData.phone = authUser.phoneNumber || '';
                }
            }
            if (!profileData.name) {
                profileData.name = profileData.email?.split('@')[0] || 'Uživatel';
            }
            if (!profileData.userType) {
                profileData.userType = 'person';
            }
            
            await setDoc(profileRef, profileData, { merge: true });
            created = true;
            console.log('[USER PROFILE SERVICE] ✅ Profil vytvořen pro uživatele:', uid);
        } else {
            // Zkontrolovat, zda profil potřebuje aktualizaci
            const existingProfile = profileSnap.data();
            let profileNeedsUpdate = false;
            
            if (payload) {
                // Kontrola klíčových polí - OSOBNÍ ÚDAJE
                if (payload.email && !existingProfile.email) {
                    profileNeedsUpdate = true;
                }
                if ((payload.phoneNumber || payload.phone) && !existingProfile.phone) {
                    profileNeedsUpdate = true;
                }
                if ((payload.userType || payload.type) && !existingProfile.userType) {
                    profileNeedsUpdate = true;
                }
                if (payload.firstName && !existingProfile.firstName) {
                    profileNeedsUpdate = true;
                }
                if (payload.lastName && !existingProfile.lastName) {
                    profileNeedsUpdate = true;
                }
                if (payload.birthDate && !existingProfile.birthDate) {
                    profileNeedsUpdate = true;
                }
                
                // Kontrola klíčových polí - FIREMNÍ ÚDAJE (stejně jako osobní)
                if (payload.companyName && !existingProfile.businessName) {
                    profileNeedsUpdate = true;
                }
                if (payload.ico && !existingProfile.businessIco) {
                    profileNeedsUpdate = true;
                }
                if (payload.dic && !existingProfile.businessDic) {
                    profileNeedsUpdate = true;
                }
                if (payload.companyAddress && !existingProfile.businessAddress) {
                    profileNeedsUpdate = true;
                }
                if (payload.businessType && !existingProfile.businessType) {
                    profileNeedsUpdate = true;
                }
                if (payload.businessDescription && !existingProfile.businessDescription) {
                    profileNeedsUpdate = true;
                }
            }
            
            if (profileNeedsUpdate) {
                console.log('[USER PROFILE SERVICE] 🔧 Aktualizuji profil uživatele:', uid);
                await setDoc(profileRef, profileData, { merge: true });
                created = true;
            } else {
                console.log('[USER PROFILE SERVICE] ✅ Profil už existuje a je kompletní pro uživatele:', uid);
            }
        }
        
        // Ověřit, že se data skutečně uložila
        const verifyProfileRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
        const verifySnap = await getDoc(verifyProfileRef);
        if (!verifySnap.exists() && created) {
            console.error('[USER PROFILE SERVICE] ❌ Profil se nepodařilo ověřit po vytvoření!');
            throw new Error('Profil se nepodařilo uložit do databáze.');
        }
        
        return created;
    } catch (error) {
        console.error('[USER PROFILE SERVICE] ❌ Chyba při ensureUserProfile:', error);
        console.error('[USER PROFILE SERVICE] ❌ Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack,
            pathname: window.location.pathname
        });
        throw error;
    }
}

/**
 * Uloží kompletní profil uživatele do Firestore
 * @param {string} uid - Firebase user UID
 * @param {Object} payload - Kompletní data profilu
 * @returns {Promise<void>}
 */
async function saveUserProfile(uid, payload) {
    const pathname = window.location.pathname;
    console.log(`[USER PROFILE SERVICE] 💾 saveUserProfile spuštěno z: ${pathname}`, { 
        uid, 
        payloadKeys: Object.keys(payload || {}),
        userType: payload?.userType,
        companyName: payload?.companyName,
        ico: payload?.ico
    });

    if (!uid) {
        throw new Error('UID je povinný pro uložení profilu');
    }

    if (!window.firebaseDb) {
        throw new Error('Firebase DB není dostupný');
    }

    try {
        const { setDoc, doc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Příprava root dokumentu
        const rootData = {
            uid: uid,
            email: payload.email || '',
            phoneNumber: payload.phoneNumber || payload.phone || '',
            provider: payload.provider || 'phone',
            type: payload.userType || payload.type || 'person',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        console.log('[USER PROFILE SERVICE] 💾 Ukládám root dokument:', rootData);
        await setDoc(doc(window.firebaseDb, 'users', uid), rootData, { merge: true });
        console.log('[USER PROFILE SERVICE] ✅ Root dokument uložen');
        
        // Příprava profilu
        const profileData = {
            email: payload.email || '',
            phone: payload.phoneNumber || payload.phone || '',
            userType: payload.userType || payload.type || 'person',
            name: payload.name || '',
            balance: payload.balance || 1000,
            plan: payload.plan || 'none',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        // Osobní údaje - STEJNĚ JAKO V HOBBY: kontrolovat .trim()
        if (payload.firstName && payload.firstName.trim()) profileData.firstName = payload.firstName.trim();
        if (payload.lastName && payload.lastName.trim()) profileData.lastName = payload.lastName.trim();
        if (payload.birthDate && payload.birthDate.trim()) profileData.birthDate = payload.birthDate.trim();
        
        // Firemní údaje - STEJNĚ JAKO OSOBNÍ ÚDAJE: kontrolovat .trim() a ukládat pouze pokud není prázdný
        console.log('[USER PROFILE SERVICE] 🔍 DEBUG - Firemní údaje v payload:', {
            companyName: payload.companyName,
            companyNameType: typeof payload.companyName,
            ico: payload.ico,
            icoType: typeof payload.ico,
            dic: payload.dic,
            businessType: payload.businessType,
            companyAddress: payload.companyAddress,
            businessDescription: payload.businessDescription
        });
        if (payload.companyName && payload.companyName.trim()) {
            profileData.businessName = payload.companyName.trim();
            console.log('[USER PROFILE SERVICE] ✅ businessName přidáno:', profileData.businessName);
        } else {
            console.warn('[USER PROFILE SERVICE] ⚠️ companyName není v payload nebo je prázdný:', payload.companyName);
        }
        if (payload.ico && payload.ico.trim()) {
            profileData.businessIco = payload.ico.trim();
            console.log('[USER PROFILE SERVICE] ✅ businessIco přidáno:', profileData.businessIco);
        } else {
            console.warn('[USER PROFILE SERVICE] ⚠️ ico není v payload nebo je prázdný:', payload.ico);
        }
        if (payload.dic && payload.dic.trim()) profileData.businessDic = payload.dic.trim();
        if (payload.companyAddress && payload.companyAddress.trim()) profileData.businessAddress = payload.companyAddress.trim();
        if (payload.businessType && payload.businessType.trim()) profileData.businessType = payload.businessType.trim();
        if (payload.businessDescription && payload.businessDescription.trim()) profileData.businessDescription = payload.businessDescription.trim();
        
        // GDPR souhlas
        if (payload.consentAccepted !== undefined) {
            profileData.consentAccepted = payload.consentAccepted;
            if (payload.consentAccepted) {
                profileData.consentAt = serverTimestamp();
            }
        }
        
        console.log('[USER PROFILE SERVICE] 💾 Ukládám profil:', profileData);
        await setDoc(doc(window.firebaseDb, 'users', uid, 'profile', 'profile'), profileData, { merge: true });
        console.log('[USER PROFILE SERVICE] ✅ Profil uložen');
        
        // Ověřit uložení
        const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const verifyRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
        const verifySnap = await getDoc(verifyRef);
        if (!verifySnap.exists()) {
            throw new Error('Profil se nepodařilo ověřit po uložení');
        }
        
        console.log('[USER PROFILE SERVICE] ✅ Profil úspěšně uložen a ověřen');
    } catch (error) {
        console.error('[USER PROFILE SERVICE] ❌ Chyba při saveUserProfile:', error);
        console.error('[USER PROFILE SERVICE] ❌ Error details:', {
            code: error?.code,
            message: error?.message,
            stack: error?.stack,
            pathname: window.location.pathname
        });
        throw error;
    }
}

/**
 * Jednotná funkce pro uložení/aktualizaci profilu (pro hobby i firmu)
 * @param {string} uid - Firebase user UID
 * @param {Object} formData - Data z formuláře
 * @param {Object} authUser - Firebase Auth user objekt
 * @returns {Promise<void>}
 */
async function upsertUserProfile(uid, formData, authUser) {
    console.log('[USER PROFILE SERVICE] 🔄 upsertUserProfile - jednotná funkce pro hobby i firmu', {
        uid,
        userType: formData?.userType || formData?.type,
        hasAuthUser: !!authUser
    });

    // Normalizovat payload
    const normalizedPayload = normalizeRegistrationPayload(formData, authUser);
    console.log('[USER PROFILE SERVICE] ✅ Normalizovaný payload:', {
        type: normalizedPayload.type,
        name: normalizedPayload.name,
        hasCompanyData: !!(normalizedPayload.companyName || normalizedPayload.ico),
        hasPersonData: !!(normalizedPayload.firstName || normalizedPayload.lastName)
    });

    // Použít existující saveUserProfile
    await saveUserProfile(uid, normalizedPayload);
}

// Export pro ES moduly i globální použití (kompatibilita)
export {
    ensureUserProfile,
    saveUserProfile,
    upsertUserProfile,
    normalizeRegistrationPayload
};

// Globální export pro zpětnou kompatibilitu (pokud někdo používá window.userProfileService)
if (typeof window !== 'undefined') {
    window.userProfileService = {
        ensureUserProfile: ensureUserProfile,
        saveUserProfile: saveUserProfile,
        upsertUserProfile: upsertUserProfile,
        normalizeRegistrationPayload: normalizeRegistrationPayload
    };
    
    // Hard diagnostika při načtení
    console.log('[BOOT] userProfileService loaded:', {
        ensureUserProfile: typeof ensureUserProfile,
        saveUserProfile: typeof saveUserProfile,
        upsertUserProfile: typeof upsertUserProfile,
        normalizeRegistrationPayload: typeof normalizeRegistrationPayload
    });
}
