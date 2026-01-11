// Jednoduchá Firebase verze s otevřenými pravidly
let allServices = [];
let filteredServices = [];
let currentPage = 1;
const itemsPerPage = 16; // 16 inzerátů na stránku
let servicesFirebaseAuth = null;
let servicesFirebaseDb = null;

// services.js se načítá - logy odstraněny

// Funkce pro inicializaci služeb
function initializeServices() {
    // Pokud už je Firebase připraven, inicializovat ihned
    if (window.firebaseAuth && window.firebaseDb) {
        servicesFirebaseAuth = window.firebaseAuth;
        servicesFirebaseDb = window.firebaseDb;
        initServices();
        return;
    }
    
    // Použít event listener místo polling (rychlejší a efektivnější)
    const initOnceFirebaseReady = () => {
        if (window.firebaseAuth && window.firebaseDb) {
            servicesFirebaseAuth = window.firebaseAuth;
            servicesFirebaseDb = window.firebaseDb;
            initServices();
            window.removeEventListener('firebaseReady', initOnceFirebaseReady);
        }
    };
    
    // Přidat event listener
    window.addEventListener('firebaseReady', initOnceFirebaseReady);
    
    // Fallback timeout po 5 sekundách (pokud event nepřijde)
    setTimeout(() => {
        if (!servicesFirebaseAuth || !servicesFirebaseDb) {
            if (window.firebaseAuth && window.firebaseDb) {
                // Zkusit ještě jednou
                servicesFirebaseAuth = window.firebaseAuth;
                servicesFirebaseDb = window.firebaseDb;
                initServices();
            } else {
                console.error('❌ Firebase se nepodařilo načíst po 5 sekundách');
                console.log('🔄 Přepínám na lokální databázi...');
                initLocalFallback();
            }
            window.removeEventListener('firebaseReady', initOnceFirebaseReady);
        }
    }, 5000);
}

// Inicializace po načtení DOM
document.addEventListener('DOMContentLoaded', () => {
    // DOM loaded - logy odstraněny
    initializeServices();
});

// Alternativní inicializace - pokud už je DOM načtený
if (document.readyState === 'loading') {
    // DOM se stále načítá, čekáme na DOMContentLoaded
        // DOM se stále načítá - logy odstraněny
    } else {
        // DOM je už načtený - logy odstraněny
    initializeServices();
}

// Inicializace služeb
// Spustit periodickou kontrolu expirace TOP inzerátů v services každou minutu
let servicesTopExpirationInterval = null;

function startServicesTopExpirationCheck() {
    // Zastavit předchozí interval pokud existuje
    if (servicesTopExpirationInterval) {
        clearInterval(servicesTopExpirationInterval);
    }
    
    // Kontrola má smysl jen pro přihlášené (zápisy jinak selžou na oprávnění)
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        console.log('ℹ️ Expirace TOP se nespouští – uživatel není přihlášen.');
        return;
    }

    // Spustit kontrolu každou minutu pouze pokud je uživatel přihlášen
    servicesTopExpirationInterval = setInterval(async () => {
        await checkAndExpireTopAdsInServices();
    }, 60000); // 60 sekund
    
    console.log('🕒 Spuštěna periodická kontrola expirace TOP inzerátů v services');
}

function stopServicesTopExpirationCheck() {
    if (servicesTopExpirationInterval) {
        clearInterval(servicesTopExpirationInterval);
        servicesTopExpirationInterval = null;
        console.log('🕒 Zastavena periodická kontrola expirace TOP inzerátů v services');
    }
}

async function initServices() {
    console.log('Inicializace Firebase služeb...');
    
    try {
        // Nastavení real-time listeneru
        await setupRealtimeListener();
        
        // Nastavit event listenery
        setupEventListeners();
        
        // Přednastavit filtry podle URL parametrů
        applyFiltersFromUrl();
        
        // Spustit periodickou kontrolu expirace TOP inzerátů
        startServicesTopExpirationCheck();
    } catch (error) {
        console.error('Chyba při inicializaci Firebase:', error);
        showErrorMessage('Chyba při připojení k Firebase. Používám lokální databázi.');
        initLocalFallback();
    }
}

// Nastavení real-time listeneru pro služby
async function setupRealtimeListener() {
    try {
        if (!servicesFirebaseDb) {
            throw new Error('Firebase DB není dostupný');
        }
        
        const { collectionGroup, collection, onSnapshot, getDocs, query, limit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // DIAGNOSTIKA: Nejdříve zkusit jednoduchý test - načíst jeden uživatelský dokument
        try {
            // Zkusit načíst users kolekci (pokud existuje)
            const usersRef = collection(servicesFirebaseDb, 'users');
            const usersTest = query(usersRef, limit(1));
            const usersSnapshot = await getDocs(usersTest);
            // Test úspěšný - logy odstraněny
        } catch (usersTestError) {
            // Tichý režim - logy odstraněny pro čistší konzoli
            if (usersTestError.code === 'permission-denied') {
                // Pouze error log pro kritické chyby
                console.error('🚨 KRITICKÁ CHYBA: Nemáte přístup k users kolekci! Zkontrolujte Firebase Rules.');
            }
        }
        
        // Čtení všech inzerátů napříč uživateli přes collectionGroup
        const servicesRef = collectionGroup(servicesFirebaseDb, 'inzeraty');
        
        // Nejdříve zkusit jednorázový dotaz pro debug
        try {
            const testSnapshot = await getDocs(servicesRef);
            // Test úspěšný - logy odstraněny
        } catch (testError) {
            // CollectionGroup nefunguje - použít alternativní metodu (tichý režim)
            if (testError.code === 'permission-denied') {
                // Tichý režim - logy odstraněny
            } else {
                // Pro jiné chyby zobrazit warning
                console.warn('⚠️ CollectionGroup dotaz selhal:', testError.message);
            }
            
            // CollectionGroup nefunguje - použít alternativní metodu
            await tryAlternativeLoadMethod();
            return; // Ukončit, protože collectionGroup nefunguje
        }
        
        // Pokud collectionGroup funguje, nastavit real-time listener
        
        // Bez orderBy - seřadíme v JavaScriptu
        console.log('🔍 Query bez orderBy (seřadíme v JS)');
        
        console.log('👂 Nastavuji onSnapshot listener...');
        
        onSnapshot(servicesRef, async (snapshot) => {
            // Real-time update - logy odstraněny pro čistší konzoli
            
            // Aktualizace stavu připojení
            updateConnectionStatus(true);
            
            // Nejdříve zkontrolovat a zrušit expirované TOP inzeráty (pouze pro přihlášené)
            try {
                if (window.firebaseAuth?.currentUser) {
                    await checkAndExpireTopAdsInServices();
                }
            } catch (error) {
                console.warn('⚠️ Chyba při kontrole expirace TOP:', error);
            }
            
            allServices = [];
            const servicesToCheck = [];
            
            // Nejdříve načíst všechny služby
            snapshot.forEach((doc) => {
                const data = doc.data() || {};
                // Doplnit userId z cesty (users/{uid}/inzeraty/{adId}) pokud chybí
                const userIdFromPath = doc.ref.parent && doc.ref.parent.parent ? doc.ref.parent.parent.id : undefined;
                if (!data.userId && userIdFromPath) {
                    data.userId = userIdFromPath;
                }
                servicesToCheck.push({
                    id: doc.id,
                    data: data,
                    userId: data.userId || userIdFromPath
                });
            });
            
            // Cache pro profily uživatelů (aby se nemusely načítat opakovaně)
            const userProfilesCache = new Map();
            const uniqueUserIds = [...new Set(servicesToCheck.map(s => s.userId).filter(Boolean))];
            
            // Načíst profily všech uživatelů paralelně
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const profilePromises = uniqueUserIds.map(async (userId) => {
                try {
                    const profileRef = doc(servicesFirebaseDb, 'users', userId, 'profile', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    
                    if (!profileSnap.exists()) {
                        userProfilesCache.set(userId, false);
                        return;
                    }
                    
                    const profile = profileSnap.data();
                    const plan = profile.plan;
                    
                    if (!plan || (plan !== 'hobby' && plan !== 'business')) {
                        userProfilesCache.set(userId, false);
                        return;
                    }
                    
                    const planPeriodEnd = profile.planPeriodEnd;
                    if (planPeriodEnd) {
                        const endDate = planPeriodEnd.toDate ? planPeriodEnd.toDate() : new Date(planPeriodEnd);
                        if (endDate < new Date()) {
                            userProfilesCache.set(userId, false);
                            return;
                        }
                    }
                    
                    userProfilesCache.set(userId, true);
                } catch (error) {
                    console.warn('⚠️ Chyba při kontrole předplatného pro uživatele', userId, error);
                    // V případě chyby zobrazit inzerát (aby se nezobrazovaly chyby uživatelům)
                    userProfilesCache.set(userId, true);
                }
            });
            
            await Promise.all(profilePromises);
            
            // Filtrovat služby podle předplatného
            servicesToCheck.forEach((service) => {
                const hasActivePlan = userProfilesCache.get(service.userId) || false;
                const status = service.data.status || 'active';
                
                // Zobrazit pouze služby uživatelů s aktivním předplatným a aktivním statusem
                if (hasActivePlan && status === 'active') {
                    allServices.push({ 
                        id: service.id, 
                        ...service.data,
                        createdAt: service.data.createdAt?.toDate() || new Date()
                    });
                }
            });
            
            // Kontrola expirace topování před řazením
            const now = new Date();
            allServices.forEach(service => {
                if (service.isTop && service.topExpiresAt) {
                    const expiresAt = service.topExpiresAt.toDate ? service.topExpiresAt.toDate() : new Date(service.topExpiresAt);
                    if (now > expiresAt) {
                        // Topování vypršelo - nastavit na false
                        service.isTop = false;
                        // Asynchronně aktualizovat v databázi
                        updateExpiredTopAd(service.id, service.userId).catch(err => {
                            console.warn('⚠️ Nepodařilo se aktualizovat expirovaný TOP inzerát:', service.id, err);
                        });
                    }
                }
            });
            
            // Seřadit: TOP inzeráty podle data přidání (createdAt) - nejnovější první, pak klasické podle createdAt
            allServices.sort((a, b) => {
                // TOP mají přednost
                if (a.isTop && !b.isTop) return -1;
                if (!a.isTop && b.isTop) return 1;
                
                // Pokud jsou oba TOP, řadit podle data přidání (createdAt) - nejnovější první
                if (a.isTop && b.isTop) {
                    const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
                    const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
                    return bDate - aDate;
                }
                
                // Pro klasické inzeráty řadit podle data vytvoření - nejnovější první
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB - dateA;
            });
            
            // Služby načteny - logy odstraněny pro čistší konzoli
            
            // Pokud nejsou žádné služby, přidáme testovací            
            if (allServices.length === 0) {
                console.log('📭 Žádné služby v databázi - zobrazuji prázdný stav');
                // Nevytvářet stock inzeráty - zobrazit prázdný stav
                filteredServices = [];
                displayServices();
                updateStats();
                return;
            }
            
            // Respektovat aktuálně zadané filtry (včetně města)
            filterServices();
            
            // Pokud jsou v URL parametry, znovu aplikovat filtry (pro případ, že se volaly dřív než data)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('q') || urlParams.get('region')) {
                console.log('🔄 Aplikuji filtry z URL po načtení dat...');
                applyFiltersFromUrl();
            }
            
            updateStats();
            
            // Debug - kolik služeb prošlo filtrem
            // Filtrování dokončeno - logy odstraněny
            
        }, (error) => {
            console.error('❌ Chyba v real-time listeneru:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            updateConnectionStatus(false);
            
            // Zobrazit chybu uživateli s konkrétními informacemi
            if (error.code === 'permission-denied') {
                const errorMsg = '🔒 Problém s oprávněními Firestore! Pravidla v Firebase Console mohou být nesprávně nastavena. ' +
                    'Zkontrolujte konzoli prohlížeče pro více detailů. Používám lokální databázi.';
                console.error(errorMsg);
                console.error('📋 Pravidla v Firebase Console by měla povolit čtení collectionGroup("inzeraty") i bez přihlášení.');
                showErrorMessage(errorMsg);
                // Po 5 sekundách zkusit lokální fallback
                setTimeout(() => {
                    console.log('🔄 Přepínám na lokální databázi...');
                    initLocalFallback();
                }, 5000);
            } else if (error.code === 'unavailable' || error.code === 'unauthenticated') {
                console.log('🔒 Problém s Firebase připojením:', error.message);
                showErrorMessage('Problém s připojením k databázi: ' + error.message);
                // Po 3 sekundách zkusit lokální fallback
                setTimeout(() => {
                    initLocalFallback();
                }, 3000);
            } else {
                showErrorMessage('Chyba při sledování změn v databázi: ' + error.message);
                // Po 3 sekundách zkusit lokální fallback
                setTimeout(() => {
                    initLocalFallback();
                }, 3000);
            }
        });
        
    } catch (error) {
        console.error('❌ Chyba při nastavování real-time listeneru:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        showErrorMessage('Nepodařilo se nastavit real-time sledování: ' + error.message);
        initLocalFallback();
    }
}

// Kontrola a automatické zrušení expirovaných TOP inzerátů v services
async function checkAndExpireTopAdsInServices() {
    try {
        if (!servicesFirebaseDb) return;
        // Bez přihlášení neprovádět zápisy (vyhneme se permission-denied)
        const currentUser = window.firebaseAuth?.currentUser;
        if (!currentUser) {
            return;
        }
        
        const { getDocs, collection, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Načíst pouze inzeráty přihlášeného uživatele (může je aktualizovat)
        const userAdsRef = collection(servicesFirebaseDb, 'users', currentUser.uid, 'inzeraty');
        const adsSnapshot = await getDocs(userAdsRef);
        
        const now = new Date();
        let expiredCount = 0;
        
        for (const adDoc of adsSnapshot.docs) {
            const adData = adDoc.data();
            
            // Kontrola zda je TOP a má čas expirace
            if (adData.isTop && adData.topExpiresAt) {
                const expiresAt = adData.topExpiresAt.toDate ? adData.topExpiresAt.toDate() : new Date(adData.topExpiresAt);
                
                if (now > expiresAt) {
                    // TOP vypršel - zrušit TOP status (pouze vlastní inzeráty)
                    try {
                        await updateDoc(adDoc.ref, {
                            isTop: false,
                            topExpiredAt: now
                        });
                        expiredCount++;
                    } catch (updateError) {
                        console.warn('⚠️ Nepodařilo se aktualizovat expirovaný TOP inzerát:', adDoc.id, updateError);
                    }
                }
            }
        }
        
        if (expiredCount > 0) {
            console.log(`🕒 Automaticky zrušeno ${expiredCount} expirovaných TOP inzerátů v services`);
        }
        
    } catch (error) {
        console.error('Chyba při kontrole expirace TOP v services:', error);
        // Nevyhazovat chybu - jen logovat, aby neblokovala načítání inzerátů
    }
}

// Funkce pro aktualizaci expirovaného topování
async function updateExpiredTopAd(adId, userId) {
    if (!adId || !userId || !window.firebaseDb) {
        return;
    }
    
    try {
        const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const adRef = doc(window.firebaseDb, 'users', userId, 'inzeraty', adId);
        await updateDoc(adRef, {
            isTop: false,
            topExpiredAt: serverTimestamp()
        });
        console.log('✅ Topování deaktivováno pro inzerát:', adId);
    } catch (error) {
        console.warn('⚠️ Nepodařilo se deaktivovat topování:', adId, error);
    }
}

// Alternativní metoda načítání inzerátů bez collectionGroup
async function tryAlternativeLoadMethod() {
    try {
        // Alternativní metoda - logy odstraněny
        const { collection, getDocs, query, limit, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Funkce pro načtení všech inzerátů
        async function loadAllAds() {
            // Načíst všechny uživatele (limit 100 pro test)
            const usersRef = collection(servicesFirebaseDb, 'users');
            const usersQuery = query(usersRef, limit(100));
            const usersSnapshot = await getDocs(usersQuery);
            
            // Uživatelé načteni - logy odstraněny
            
            if (usersSnapshot.size === 0) {
                console.warn('⚠️ Žádní uživatelé nenalezeni - databáze je prázdná');
                return [];
            }
            
            // Pro každého uživatele načíst jeho inzeráty
            const services = [];
            const loadPromises = [];
            
            usersSnapshot.forEach((userDoc) => {
                const userId = userDoc.id;
                const userAdsRef = collection(servicesFirebaseDb, 'users', userId, 'inzeraty');
                
                const loadPromise = getDocs(userAdsRef).then((adsSnapshot) => {
                    adsSnapshot.forEach((adDoc) => {
                        const data = adDoc.data();
                        services.push({
                            id: adDoc.id,
                            userId: userId,
                            ...data,
                            createdAt: data.createdAt?.toDate() || new Date()
                        });
                    });
                }).catch((error) => {
                    console.warn(`⚠️ Chyba při načítání inzerátů uživatele ${userId}:`, error);
                });
                
                loadPromises.push(loadPromise);
            });
            
            await Promise.all(loadPromises);
            
            // Kontrola expirace topování před řazením
            const now = new Date();
            services.forEach(service => {
                if (service.isTop && service.topExpiresAt) {
                    const expiresAt = service.topExpiresAt.toDate ? service.topExpiresAt.toDate() : new Date(service.topExpiresAt);
                    if (now > expiresAt) {
                        // Topování vypršelo - nastavit na false
                        service.isTop = false;
                        // Asynchronně aktualizovat v databázi
                        updateExpiredTopAd(service.id, service.userId).catch(err => {
                            console.warn('⚠️ Nepodařilo se aktualizovat expirovaný TOP inzerát:', service.id, err);
                        });
                    }
                }
            });
            
            // Seřadit: TOP inzeráty podle data přidání (createdAt) - nejnovější první, pak klasické podle createdAt
            services.sort((a, b) => {
                // TOP mají přednost
                if (a.isTop && !b.isTop) return -1;
                if (!a.isTop && b.isTop) return 1;
                
                // Pokud jsou oba TOP, řadit podle data přidání (createdAt) - nejnovější první
                if (a.isTop && b.isTop) {
                    const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
                    const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
                    return bDate - aDate;
                }
                
                // Pro klasické inzeráty řadit podle data vytvoření - nejnovější první
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB - dateA;
            });
            
            return services;
        }
        
        // Načíst inzeráty poprvé
        allServices = await loadAllAds();
        // Alternativní metoda: inzeráty načteny - logy odstraněny
        
        if (allServices.length === 0) {
            console.warn('⚠️ Alternativní metoda nenašla žádné inzeráty');
            initLocalFallback();
            return;
        }
        
        // Zobrazit inzeráty
        filterServices();
        updateStats();
        updateConnectionStatus(true);
        // Filtrování dokončeno - logy odstraněny
        
        // Nastavit periodické obnovování (každých 30 sekund, protože nemáme real-time listener)
        setInterval(async () => {
            try {
                const newServices = await loadAllAds();
                if (newServices.length !== allServices.length) {
                    // Detekována změna - logy odstraněny
                    allServices = newServices;
                    filterServices();
                    updateStats();
                }
            } catch (error) {
                console.warn('⚠️ Chyba při periodickém načítání:', error);
            }
        }, 30000); // 30 sekund
        
    } catch (error) {
        console.error('❌ Alternativní metoda selhala:', error);
        initLocalFallback();
    }
}

// Lokální fallback databáze
function initLocalFallback() {
    console.log('🔄 Inicializace lokální fallback databáze...');
    
    try {
        // Načtení služeb z localStorage nebo vytvoření testovacích
        const savedServices = localStorage.getItem('inzerio-services');
        
        if (savedServices) {
            allServices = JSON.parse(savedServices);
            console.log('✅ Načteny služby z localStorage:', allServices.length);
        } else {
            console.log('⚠️ Žádné uložené služby, vytvářím testovací...');
            createTestServices();
        }
        // Konzistence: TOP inzeráty podle data přidání (createdAt) - nejnovější první, pak klasické podle createdAt
        allServices.sort((a, b) => {
            // TOP mají přednost
            if (a.isTop && !b.isTop) return -1;
            if (!a.isTop && b.isTop) return 1;
            
            // Pokud jsou oba TOP, řadit podle data přidání (createdAt) - nejnovější první
            if (a.isTop && b.isTop) {
                const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
                const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
                return bDate - aDate;
            }
            
            // Pro klasické inzeráty řadit podle data vytvoření - nejnovější první
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        filteredServices = [...allServices];
        // TOP služby vždy první i v lokálním fallbacku, řadit podle data přidání (createdAt)
        filteredServices.sort((a, b) => {
            // TOP mají přednost
            if (a.isTop && !b.isTop) return -1;
            if (!a.isTop && b.isTop) return 1;
            
            // Pokud jsou oba TOP, řadit podle data přidání (createdAt) - nejnovější první
            if (a.isTop && b.isTop) {
                const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
                const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
                return bDate - aDate;
            }
            
            // Pro klasické inzeráty řadit podle data vytvoření - nejnovější první
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return dateB - dateA;
        });
        console.log('📊 Služby připraveny:', { allServices: allServices.length, filteredServices: filteredServices.length });
        
        displayServices();
        updateStats();
        updateConnectionStatus(true); // Lokální DB je vždy dostupná
        
        setupEventListeners();
        console.log('✅ Lokální fallback databáze inicializována');
    } catch (error) {
        console.error('❌ Chyba při inicializaci lokální databáze:', error);
        // Vytvořit minimální testovací služby
        allServices = [{
            id: 'fallback-1',
            title: "Testovací služba",
            description: "Toto je testovací služba pro fallback",
            price: "100 Kč/hod",
            location: "Praha",
            category: "technical",
            userId: "fallback-user",
            userEmail: "test@example.com",
            createdAt: new Date(),
            status: "active"
        }];
        filteredServices = [...allServices];
        displayServices();
        updateStats();
        updateConnectionStatus(true);
    }
}

// Vytvoření testovacích služeb pro lokální databázi
function createTestServices() {
    console.log('🧪 Testovací služby jsou vypnuté - používám prázdný seznam');
    allServices = [];
    /* Odstraněno - stock inzeráty
    allServices = [
        {
            id: '1',
            title: "Oprava počítačů a notebooků",
            category: "it",
            description: "Profesionální oprava počítačů, notebooků a tabletů. Diagnostika problémů, výměna komponentů, instalace operačních systémů. Rychlé a spolehlivé služby.",
            price: "500 Kč/hod",
            location: "Praha",
            userId: "test-user-1",
            userEmail: "opravy@example.com",
            createdAt: new Date(),
            status: "active"
        },
        {
            id: '2',
            title: "Instalace nábytku",
            category: "technical",
            description: "Montáž a instalace nábytku všech typů. IKEA nábytek, kuchyňské linky, skříně, postele. Zkušený montér s vlastním nářadím.",
            price: "800 Kč/hod",
            location: "Brno",
            userId: "test-user-2",
            userEmail: "montaz@example.com",
            createdAt: new Date(),
            status: "active"
        },
        {
            id: '3',
            title: "Doučování matematiky",
            category: "education",
            description: "Doučování matematiky pro základní a střední školy. Příprava na přijímací zkoušky, maturitu. Individuální přístup, trpělivost.",
            price: "400 Kč/hod",
            location: "Ostrava",
            userId: "test-user-3",
            userEmail: "doucovani@example.com",
            createdAt: new Date(),
            status: "active"
        },
        {
            id: '4',
            title: "Grafický design",
            category: "design",
            description: "Tvorba log, vizitek, bannerů, letáků. Branding a corporate identity. Moderní design, rychlé dodání, konkurenční ceny.",
            price: "1200 Kč/projekt",
            location: "Plzeň",
            userId: "test-user-4",
            userEmail: "design@example.com",
            createdAt: new Date(),
            status: "active"
        },
        {
            id: '5',
            title: "Úklidové služby",
            category: "home",
            description: "Profesionální úklid domácností a kanceláří. Jednorázový i pravidelný úklid. Ekologické prostředky, spolehlivost.",
            price: "300 Kč/hod",
            location: "České Budějovice",
            userId: "test-user-5",
            userEmail: "uklid@example.com",
            createdAt: new Date(),
            status: "active"
        },
        {
            id: '6',
            title: "Stěhování",
            category: "transport",
            description: "Kompletní stěhovací služby. Stěhování bytů, domů, kanceláří. Zabalené služby, pojištění, rychlé a šetrné stěhování.",
            price: "1500 Kč/hod",
            location: "Liberec",
            userId: "test-user-6",
            userEmail: "stehovani@example.com",
            createdAt: new Date(),
            status: "active"
        }
    ];
    */
    
    console.log(`✅ Stock inzeráty jsou vypnuté, používám prázdný seznam`);
    saveServicesToLocalStorage();
}

// Uložení služeb do localStorage
function saveServicesToLocalStorage() {
    localStorage.setItem('inzerio-services', JSON.stringify(allServices));
    console.log('Služby uloženy do localStorage');
}

// Zobrazení služeb v gridu (volitelné předání seznamu)
function displayServices(list) {
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;
    
    // Získání limitu z data-limit atributu (pokud existuje)
    const limitAttr = grid.getAttribute('data-limit');
    const showActionsAttr = grid.getAttribute('data-show-actions');
    const limit = limitAttr ? parseInt(limitAttr, 10) : null;
    const showActions = showActionsAttr ? showActionsAttr === 'true' : true;
    
    // Zkontrolovat, zda jsou aktivní nějaké filtry
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const regionFilter = document.getElementById('regionFilter');
    const hasActiveFilters = (searchInput?.value?.trim() || '') || 
                            (categoryFilter?.value?.trim() || '') || 
                            (regionFilter?.value?.trim() || '');
    
    // Pokud není žádný výsledek, zobrazit prázdný stav a ukončit
    if (!filteredServices || filteredServices.length === 0) {
        // Skrýt paginaci
        const pagination = document.getElementById('pagination');
        if (pagination) {
            pagination.style.display = 'none';
        }
        
        // Skrýt element noServices (pokud existuje)
        const noServices = document.getElementById('noServices');
        if (noServices) {
            noServices.style.display = 'none';
        }
        
        if (hasActiveFilters) {
            // Aktivní filtry, ale žádné výsledky
            grid.innerHTML = `
                <div class="no-services">
                    <div class="no-services-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>Žádné výsledky</h3>
                    <p>Pro zadané parametry vyhledávání nebyl nalezen žádný inzerát.</p>
                    <p class="no-services-suggestion">Zkuste upravit kritéria vyhledávání nebo zkuste jiný výraz.</p>
                </div>
            `;
        } else {
            // Žádné filtry, ale žádné služby v databázi
            grid.innerHTML = `
                <div class="no-services">
                    <div class="no-services-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <h3>Žádné služby nenalezeny</h3>
                    <p>Momentálně nejsou k dispozici žádné služby.</p>
                </div>
            `;
        }
        return;
    }
    
    // VŽDY použít filteredServices, ne předaný parametr (aby se respektovaly filtry)
    let servicesToRender = filteredServices;
    
    // Pro homepage: seřadit služby - TOP nejnovější první, pak klasické nejnovější
    if (limit) {
        // Vytvořit kopii pro řazení
        servicesToRender = [...servicesToRender];
        
        // Seřadit: TOP nejnovější první (podle data přidání createdAt), pak klasické nejnovější
        servicesToRender.sort((a, b) => {
            // TOP mají přednost
            if (a.isTop && !b.isTop) return -1;
            if (!a.isTop && b.isTop) return 1;
            
            // Pokud jsou oba TOP, řadit podle data přidání (createdAt) - nejnovější první
            if (a.isTop && b.isTop) {
                const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
                const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
                return bDate - aDate;
            }
            
            // Pro klasické inzeráty řadit podle data vytvoření - nejnovější první
            const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
            const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
            return bDate - aDate;
        });
    }
    
    // Pokud je nastaven limit (např. na homepage), vždy použij prvních N služeb
    // Limit se aplikuje, i když je předán parametr list (např. z sortServices)
    let finalServices;
    if (limit) {
        // Hlavní stránka - použij limit
        finalServices = servicesToRender.slice(0, limit);
    } else {
        // Stránka služeb - použij paginaci
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        finalServices = servicesToRender.slice(startIndex, endIndex);
        
        // Zobraz/zakryj paginaci
        const pagination = document.getElementById('pagination');
        if (pagination) {
            const totalPages = Math.ceil(servicesToRender.length / itemsPerPage);
            if (totalPages > 1) {
                pagination.style.display = 'flex';
                updatePagination(totalPages);
            } else {
                pagination.style.display = 'none';
            }
        }
    }
    
    // Skrýt element noServices (pokud existuje)
    const noServices = document.getElementById('noServices');
    if (noServices) {
        noServices.style.display = 'none';
    }

    // Zabraň změně velikosti při filtrování - použij requestAnimationFrame
    requestAnimationFrame(() => {
        // Nastavit minimální výšku gridu, aby se zabránilo změně velikosti
        const currentHeight = grid.offsetHeight;
        if (currentHeight > 0) {
            grid.style.minHeight = currentHeight + 'px';
        }

        // Vykreslit karty - univerzální šablona zajistí konzistentní vzhled
        let htmlContent = finalServices.map(service => createAdCard(service, showActions)).join('');
        grid.innerHTML = htmlContent;
        
        // Po renderování odstranit min-height
        requestAnimationFrame(() => {
            grid.style.minHeight = '';
        });
    });
    
    // Optimalizace: Intersection Observer pro lepší lazy loading
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px' // Začít načítat 50px před tím, než je obrázek viditelný
        });
        
        // Najít všechny lazy obrázky a pozorovat je
        const lazyImages = grid.querySelectorAll('img[loading="lazy"]');
        lazyImages.forEach(img => {
            if (img.src && !img.complete) {
                imageObserver.observe(img);
            }
        });
    }
}

// Funkce pro aktualizaci paginace
function updatePagination(totalPages) {
    const paginationNumbers = document.getElementById('paginationNumbers');
    if (!paginationNumbers) return;
    
    // Vymaž předchozí čísla
    paginationNumbers.innerHTML = '';
    
    // Vytvoř čísla stránek
    const maxVisiblePages = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Upravit startPage, pokud je konec blízko
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-number ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToPage(i);
        paginationNumbers.appendChild(pageBtn);
    }
    
    // Aktualizovat tlačítka
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => goToPage(currentPage - 1);
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => goToPage(currentPage + 1);
    }
}

// Funkce pro přechod na stránku
function goToPage(page) {
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayServices(filteredServices);
    
    // Scroll nahoru
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Vytvoření karty inzerátu
function createAdCard(service, showActions = true) {
    // Kontrola expirace topování - pokud vypršelo, nastavit isTop na false
    let isTop = service.isTop === true;
    if (isTop && service.topExpiresAt) {
        const expiresAt = service.topExpiresAt.toDate ? service.topExpiresAt.toDate() : new Date(service.topExpiresAt);
        const now = new Date();
        if (now > expiresAt) {
            // Topování vypršelo - nastavit na false
            isTop = false;
            // Asynchronně aktualizovat v databázi (neblokovat renderování)
            updateExpiredTopAd(service.id, service.userId).catch(err => {
                console.warn('⚠️ Nepodařilo se aktualizovat expirovaný TOP inzerát:', service.id, err);
            });
        }
    }
    
    // CSS šablona zajistí všechny základní styly - pouze TOP border/shadow jako inline
    const topStyle = isTop 
        ? `style="border: 3px solid #ff8a00 !important; box-shadow: 0 8px 28px rgba(255, 138, 0, 0.6), 0 0 0 2px rgba(255, 138, 0, 0.4) !important;"`
        : '';
    
    // Formátování ceny - pokud je jen číslo, přidat Kč
    let formattedPrice = service.price || '';
    if (formattedPrice && /^\d+$/.test(formattedPrice.toString().trim())) {
        // Pokud je cena jen číslo, přidat "Kč"
        formattedPrice = `${formattedPrice} Kč`;
    }
    
    const status = (service?.status || 'active').toString().trim().toLowerCase();
    
    // Získat URL obrázku - může být string nebo objekt s .url
    let imageUrl = '/fotky/vychozi-inzerat.png';
    if (service.images && service.images.length > 0) {
        const firstImg = service.images[0];
        if (typeof firstImg === 'string') {
            imageUrl = firstImg;
        } else if (firstImg && firstImg.url) {
            imageUrl = firstImg.url;
        }
    } else if (service.image) {
        // Fallback na service.image (starší formát)
        if (typeof service.image === 'string') {
            imageUrl = service.image;
        } else if (service.image.url) {
            imageUrl = service.image.url;
        }
    } else if (service.photo) {
        // Fallback na service.photo (starší formát)
        if (typeof service.photo === 'string') {
            imageUrl = service.photo;
        } else if (service.photo.url) {
            imageUrl = service.photo.url;
        }
    }
    
    // Ověřit, že imageUrl je platná URL nebo cesta
    if (!imageUrl || imageUrl === 'undefined' || imageUrl === 'null') {
        imageUrl = '/fotky/vychozi-inzerat.png';
    }
    
    const escapedImageUrl = imageUrl.replace(/"/g, '&quot;');
    const defaultImageUrl = '/fotky/vychozi-inzerat.png';
    const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
    
    // Optimalizace obrázků - přidat fetchpriority pro první viditelné
    // Zjistit, zda je to první obrázek v seznamu (pro fetchpriority)
    const isFirstVisible = typeof createAdCard.firstIndex === 'undefined';
    if (isFirstVisible) createAdCard.firstIndex = 0;
    const isPriorityImage = createAdCard.firstIndex < 3; // První 3 obrázky mají vysokou prioritu
    createAdCard.firstIndex++;
    
    // Použít WebP pouze pro lokální obrázky (ze složky /fotky/)
    // Pro obrázky z Firebase Storage nepoužívat WebP, protože neexistují
    const isLocalImage = imageUrl.startsWith('/fotky/') || imageUrl.startsWith('./fotky/');
    
    // Optimalizovat Firebase Storage URL - přidat parametry pro rychlejší načítání a resize
    let optimizedImageUrl = escapedImageUrl;
    if (!isLocalImage && imageUrl.includes('firebasestorage.googleapis.com')) {
        // Přidat parametry pro optimalizaci
        const urlObj = new URL(imageUrl);
        const params = new URLSearchParams(urlObj.search);
        
        // Přidat alt=media pokud chybí
        if (!params.has('alt')) {
            params.set('alt', 'media');
        }
        
        // Přidat parametry pro resize - optimalizovat velikost pro karty (400x300 = 4:3)
        // Použít token= parametry pro lepší cachování
        if (!params.has('token')) {
            // Token se přidá automaticky Firebase Storage, ale můžeme přidat resize parametry
        }
        
        // Sestavit novou URL
        urlObj.search = params.toString();
        optimizedImageUrl = urlObj.toString().replace(/"/g, '&quot;');
    }
    
    // Atributy pro optimalizaci
    const loadingAttr = isPriorityImage ? 'eager' : 'lazy';
    const fetchPriorityAttr = isPriorityImage ? ' fetchpriority="high"' : '';
    const widthHeightAttr = ' width="400" height="300"'; // Standardní rozměry pro karty (4:3)
    
    // Přidat placeholder pro smooth loading - oranžový spinner místo shimmer efektu
    const placeholderStyle = 'background: #f8f9fa; position: relative;';
    
    let imageHtml;
    if (isLocalImage) {
        const webpUrl = imageUrl.replace(/\.(png|jpg|jpeg|PNG|JPG|JPEG)(\?.*)?$/, '.webp$2');
        const escapedWebpUrl = webpUrl.replace(/"/g, '&quot;');
        imageHtml = `
                <picture>
                    <source srcset="${escapedWebpUrl}" type="image/webp">
                    <img src="${escapedImageUrl}" alt="Inzerát" loading="${loadingAttr}" decoding="async"${fetchPriorityAttr}${widthHeightAttr} style="${placeholderStyle}" onload="this.classList.add('loaded'); this.style.background='transparent';" onerror="this.onerror=null; this.src='${escapedDefaultUrl}'; this.classList.add('loaded'); this.style.background='transparent';">
                </picture>
            `;
    } else {
        // Pro Firebase Storage obrázky použít optimalizovanou URL s retry mechanismem včetně _200x200 varianty
        imageHtml = `<img src="${optimizedImageUrl}" alt="Inzerát" loading="${loadingAttr}" decoding="async"${fetchPriorityAttr}${widthHeightAttr} style="${placeholderStyle}" onload="this.classList.add('loaded'); this.style.background='transparent';" onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; const newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg').replace('.jpg', '_200x200.jpg'); this.src = newUrl + (params ? '?' + params : ''); } else if(this.dataset.retry === '1') { this.dataset.retry='2'; this.src=this.src.split('?')[0] + '?alt=media'; } else { this.onerror=null; this.src='${escapedDefaultUrl}'; this.classList.add('loaded'); this.style.background='transparent'; }" data-retry="0">`;
    }
    
    // Získat formátovanou lokaci - STEJNĚ jako u ostatních krajů
    const formattedLocation = getLocationName(service.location || '') || 'Neuvedeno';
    
    // CSS šablona zajistí všechny styly - žádné inline styly potřeba
    const escapedLocation = formattedLocation.replace(/"/g, '&quot;');
    
    return `
        <article class="ad-card${isTop ? ' is-top' : ''}" data-category="${service.category || ''}" data-status="${status}" data-location="${escapedLocation}" ${topStyle}>
            <div class="ad-thumb">
                ${imageHtml}
            </div>
            <div class="ad-body" data-location="${escapedLocation}">
                <div class="ad-meta"><span>${getCategoryName(service.category || '')}</span></div>
                <h3 class="ad-title">${service.title || 'Bez názvu'}</h3>
                ${formattedPrice ? `<div class="ad-price">${formattedPrice}</div>` : ''}
                <div class="ad-location" data-location-text="${escapedLocation}">${formattedLocation}</div>
            </div>
            ${isTop ? `
            <div class="ad-badge-top"><i class="fas fa-fire"></i> TOP</div>
            <div class="ad-flames" aria-hidden="true"></div>
            ` : ''}
            ${showActions ? `
            <div class="ad-actions">
                <button class="btn-contact" onclick="contactService('${service.id}')" title="Kontaktovat">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="btn-profile" onclick="openUserProfile('${service.userId}')" title="Profil">
                    <i class="fas fa-user"></i>
                </button>
                <button class="btn-info" onclick="showServiceDetails('${service.id}')" title="Info">
                    <i class="fas fa-info"></i>
                </button>
            </div>
            ` : ''}
        </article>
    `;
}

// Získání názvu kategorie
function getCategoryName(category) {
    const categories = {
        'home_craftsmen': 'Domácnost & Řemeslníci',
        'auto_moto': 'Auto & Moto',
        'garden_exterior': 'Zahrada & Exteriér',
        'education_tutoring': 'Vzdělávání & Doučování',
        'it_technology': 'IT & technologie',
        'health_personal_care': 'Zdraví a Osobní péče',
        'gastronomy_catering': 'Gastronomie & Catering',
        'events_entertainment': 'Události & Zábava',
        'personal_small_jobs': 'Osobní služby & drobné práce',
        'auto_moto_transport': 'Auto - moto doprava',
        'hobby_creative': 'Hobby & kreativní služby',
        'law_finance_admin': 'Právo & finance & administrativa',
        'pets': 'Domácí zvířata',
        'specialized_custom': 'Specializované služby / na přání'
    };
    return categories[category] || category;
}

// Získání názvu lokace s diakritikou
function getLocationName(location) {
    // Pokud není lokace, vrátit prázdný string
    if (!location) return '';
    
    // Pokud je to objekt, zkusit získat název nebo kód
    if (typeof location === 'object') {
        if (location.name) location = location.name;
        else if (location.code) location = location.code;
        else if (location.city) location = location.city;
        else location = String(location);
    }
    
    // Převést na string a oříznout mezery
    const locStr = String(location).trim();
    
    const locations = {
        'Kdekoliv': 'Kdekoliv',
        'CelaCeskaRepublika': 'Celá ČR',
        'Celá Česká republika': 'Celá ČR', // Podpora i formátovaného názvu
        'Celá ČR': 'Celá ČR', // Podpora zkratky
        'Praha': 'Hlavní město Praha',
        'Stredocesky': 'Středočeský kraj',
        'Jihocesky': 'Jihočeský kraj',
        'Plzensky': 'Plzeňský kraj',
        'Karlovarsky': 'Karlovarský kraj',
        'Ustecky': 'Ústecký kraj',
        'Liberecky': 'Liberecký kraj',
        'Kralovehradecky': 'Královéhradecký kraj',
        'Pardubicky': 'Pardubický kraj',
        'Vysocina': 'Kraj Vysočina',
        'Jihomoravsky': 'Jihomoravský kraj',
        'Olomoucky': 'Olomoucký kraj',
        'Zlinsky': 'Zlínský kraj',
        'Moravskoslezsky': 'Moravskoslezský kraj'
    };
    
    // Zkusit najít přesnou shodu
    if (locations[locStr]) {
        return locations[locStr];
    }
    
    // Pokud není přesná shoda, vrátit původní hodnotu (může to být už formátovaný název nebo jiný formát)
    return locStr;
}

// Mapování: název kraje → kód (pro robustní porovnávání)
function getRegionCode(input) {
    const val = (input || '').toString().trim();
    if (!val) return '';
    // Pokud už je to kód, vrať bez změny
    const validCodes = [
        'Kdekoliv', 'CelaCeskaRepublika',
        'Praha','Stredocesky','Jihocesky','Plzensky','Karlovarsky','Ustecky','Liberecky','Kralovehradecky','Pardubicky','Vysocina','Jihomoravsky','Olomoucky','Zlinsky','Moravskoslezsky'
    ];
    if (validCodes.includes(val)) return val;
    // Bez diakritiky a malá písmena
    const n = normalize(val);
    const map = {
        'kdekoliv': 'Kdekoliv',
        'cela ceska republika': 'CelaCeskaRepublika',
        'hlavni mesto praha': 'Praha',
        'praha': 'Praha',
        'stredocesky kraj': 'Stredocesky',
        'jihocesky kraj': 'Jihocesky',
        'plzensky kraj': 'Plzensky',
        'karlovarsky kraj': 'Karlovarsky',
        'ustecky kraj': 'Ustecky',
        'liberecky kraj': 'Liberecky',
        'kralovehradecky kraj': 'Kralovehradecky',
        'pardubicky kraj': 'Pardubicky',
        'kraj vysocina': 'Vysocina',
        'jihomoravsky kraj': 'Jihomoravsky',
        'olomoucky kraj': 'Olomoucky',
        'zlinsky kraj': 'Zlinsky',
        'moravskoslezsky kraj': 'Moravskoslezsky'
    };
    return map[n] || '';
}

// Pomocná funkce pro získání kódu z formátovaného názvu
function getRegionCodeFromFormatted(formattedName) {
    if (!formattedName) return '';
    const val = formattedName.toString().trim();
    // Přímé mapování formátovaných názvů na kódy
    const formattedMap = {
        'Kdekoliv': 'Kdekoliv',
        'Celá Česká republika': 'CelaCeskaRepublika',
        'Hlavní město Praha': 'Praha',
        'Středočeský kraj': 'Stredocesky',
        'Jihočeský kraj': 'Jihocesky',
        'Plzeňský kraj': 'Plzensky',
        'Karlovarský kraj': 'Karlovarsky',
        'Ústecký kraj': 'Ustecky',
        'Liberecký kraj': 'Liberecky',
        'Královéhradecký kraj': 'Kralovehradecky',
        'Pardubický kraj': 'Pardubicky',
        'Kraj Vysočina': 'Vysocina',
        'Jihomoravský kraj': 'Jihomoravsky',
        'Olomoucký kraj': 'Olomoucky',
        'Zlínský kraj': 'Zlinsky',
        'Moravskoslezský kraj': 'Moravskoslezsky'
    };
    return formattedMap[val] || getRegionCode(val);
}

// Formátování data
function formatDate(date) {
    if (!date) return 'Neznámé datum';
    
    let serviceDate;
    
    // Handle Firebase Timestamp
    if (date.toDate && typeof date.toDate === 'function') {
        serviceDate = date.toDate();
    }
    // Handle Firebase Timestamp with seconds/nanoseconds
    else if (date.seconds) {
        serviceDate = new Date(date.seconds * 1000);
    }
    // Handle regular Date object
    else if (date instanceof Date) {
        serviceDate = date;
    }
    // Handle string or number
    else {
        serviceDate = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(serviceDate.getTime())) {
        return 'Neznámé datum';
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const serviceDay = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate());
    
    // Compare dates (without time)
    if (serviceDay.getTime() === today.getTime()) {
        return 'Dnes';
    } else if (serviceDay.getTime() === yesterday.getTime()) {
        return 'Včera';
    } else {
        const diffTime = today.getTime() - serviceDay.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 7) {
            return `Před ${diffDays} dny`;
        } else if (diffDays < 30) {
            return `Před ${Math.ceil(diffDays / 7)} týdny`;
        } else {
            return serviceDate.toLocaleDateString('cs-CZ');
        }
    }
}

// Aktualizace statistik
function updateStats() {
    const totalEl = document.getElementById('totalServices');
    const activeEl = document.getElementById('activeServices');
    if (totalEl) totalEl.textContent = allServices.length;
    if (activeEl) activeEl.textContent = filteredServices.length;
}

// Aktualizace stavu připojení
function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        const icon = statusElement.querySelector('i');
        if (isConnected) {
            icon.style.color = '#28a745';
            icon.title = 'Databáze aktivní (Firebase nebo lokální)';
        } else {
            icon.style.color = '#dc3545';
            icon.title = 'Databáze nedostupná';
        }
    }
}

// Nastavení event listenerů
function setupEventListeners() {
    // Vyhledávání
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterServices();
            // Paralelně aplikovat rychlý DOM fallback (pro jistotu)
            const categoryVal = (document.getElementById('categoryFilter')?.value || '').trim();
            filterServicesDom(normalize(searchInput.value || ''), categoryVal);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterServices();
                const categoryVal = (document.getElementById('categoryFilter')?.value || '').trim();
                filterServicesDom(normalize(searchInput.value || ''), categoryVal);
            }
        });
    }
    // Záchranný listener na celý dokument (pro případ re-renderu UI jiným skriptem)
    document.addEventListener('input', (e) => {
        const target = e.target;
        if (target && target.id === 'searchInput') {
            filterServices();
        }
    }, true);
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (target && target.id === 'searchInput') {
            filterServices();
        }
    }, true);

    // Filtry
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            filterServices();
            const searchVal = normalize((document.getElementById('searchInput')?.value || ''));
            const regionVal = (document.getElementById('regionFilter')?.value || '').trim();
            filterServicesDom(searchVal, categoryFilter.value || '', regionVal);
        });
    }
    
    // Filtrování podle kraje
    const regionFilter = document.getElementById('regionFilter');
    if (regionFilter) {
        regionFilter.addEventListener('change', () => {
            filterServices();
            const searchVal = normalize((document.getElementById('searchInput')?.value || ''));
            const categoryVal = (document.getElementById('categoryFilter')?.value || '').trim();
            filterServicesDom(searchVal, categoryVal, regionFilter.value || '');
        });
    }
    
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', sortServices);
    }
}

// Filtrování služeb
function filterServices() {
    const rawSearch = (document.getElementById('searchInput')?.value || '').trim();
    const searchTerm = normalize(rawSearch);
    const categoryFilter = (document.getElementById('categoryFilter')?.value || '').trim();
    const regionFilter = (document.getElementById('regionFilter')?.value || '').trim();
    const regionCode = getRegionCode(regionFilter);

    // Fallback: pokud ještě nemáme načtená data, filtruj přímo DOM karty
    if (!allServices || allServices.length === 0) {
        filterServicesDom(searchTerm, categoryFilter, regionFilter);
        return;
    }

    // Kontrola expirace topování před filtrováním
    const now = new Date();
    allServices.forEach(service => {
        if (service.isTop && service.topExpiresAt) {
            const expiresAt = service.topExpiresAt.toDate ? service.topExpiresAt.toDate() : new Date(service.topExpiresAt);
            if (now > expiresAt) {
                // Topování vypršelo - nastavit na false
                service.isTop = false;
                // Asynchronně aktualizovat v databázi
                updateExpiredTopAd(service.id, service.userId).catch(err => {
                    console.warn('⚠️ Nepodařilo se aktualizovat expirovaný TOP inzerát:', service.id, err);
                });
            }
        }
    });

    let filteredAds = allServices.filter((service) => {
        const title = normalize(service?.title || '');
        const desc = normalize(service?.description || '');
        // Podpora různých polí pro kraj: location / region / serviceRegion
        const storedLocRaw = service?.location || service?.region || service?.serviceRegion || '';
        const locCode = getRegionCode(storedLocRaw);
        const loc = normalize(storedLocRaw || '');

        const matchesSearch = !searchTerm || title.includes(searchTerm) || desc.includes(searchTerm) || loc.includes(searchTerm);
        const matchesCategory = !categoryFilter || (service?.category === categoryFilter);
        // Pokud je vybrán kraj, musí se shodovat. Pokud kraj není vybrán, zobrazit všechny.
        // Speciální hodnoty: "Kdekoliv", "CelaCeskaRepublika" zobrazí všechny inzeráty
        let matchesRegion = true;
        if (regionFilter && regionFilter.trim()) {
            const serviceLoc = storedLocRaw.toString().trim();
            const regionFilterFormatted = getLocationName(regionFilter);
            const serviceLocFormatted = getLocationName(serviceLoc);
            
            if (regionFilter === 'Kdekoliv') {
                matchesRegion = serviceLoc === 'Kdekoliv' || loc === 'Kdekoliv' || serviceLocFormatted === 'Kdekoliv';
            } else if (regionFilter === 'CelaCeskaRepublika') {
                // Porovnat všechny možné formáty
                const normalizedServiceLoc = serviceLoc.toLowerCase().trim();
                const normalizedFormatted = serviceLocFormatted.toLowerCase().trim();
                matchesRegion = serviceLoc === 'CelaCeskaRepublika' || 
                               serviceLoc === 'Celá Česká republika' ||
                               serviceLoc === 'Celá ČR' ||
                               normalizedServiceLoc === 'celá česká republika' ||
                               normalizedServiceLoc === 'celá čr' ||
                               normalizedServiceLoc === 'celaceskarepublika' ||
                               loc === 'Celá Česká republika' ||
                               loc === 'Celá ČR' ||
                               loc === 'CelaCeskaRepublika' ||
                               serviceLocFormatted === 'Celá Česká republika' ||
                               serviceLocFormatted === 'Celá ČR' ||
                               normalizedFormatted === 'celá česká republika' ||
                               normalizedFormatted === 'celá čr' ||
                               locCode === 'CelaCeskaRepublika';
            } else if (regionCode) {
                matchesRegion = (locCode && locCode === regionCode) || 
                               (loc === regionFilterFormatted) ||
                               (serviceLoc === regionFilter) ||
                               (serviceLocFormatted === regionFilterFormatted);
            }
        }
        // Ve veřejném katalogu zobrazujeme jen aktivní inzeráty
        // Pokud status není nastaven, považujeme ho za aktivní
        const status = service?.status || 'active';
        const isVisible = status === 'active';

        return matchesSearch && matchesCategory && matchesRegion && isVisible;
    });

    // TOP inzeráty vždy první, v rámci TOP řadit podle data přidání (createdAt) - nejnovější první
    filteredAds.sort((a, b) => {
        // TOP mají přednost
        if (a.isTop && !b.isTop) return -1;
        if (!a.isTop && b.isTop) return 1;
        
        // Pokud jsou oba TOP, řadit podle data přidání (createdAt) - nejnovější první
        if (a.isTop && b.isTop) {
            const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
            const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
            return bDate - aDate;
        }
        
        // Pro klasické inzeráty řadit podle data vytvoření - nejnovější první
        const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
        const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
        return bDate - aDate;
    });

    filteredServices = filteredAds;
    
            // Filtrování dokončeno - logy odstraněny
    
    // Resetovat na první stránku při změně filtru
    currentPage = 1;
    
    // Pokud není žádný výsledek, zobrazit prázdný stav a ukončit (bez volání sortServices)
    if (!filteredServices || filteredServices.length === 0) {
        console.log('⚠️ Žádné výsledky po filtrování - zobrazuji prázdný stav');
        displayServices();
        updateStats();
        return;
    }
    
    // Po každé změně filtru znovu aplikovat aktuální řazení (pouze pokud jsou výsledky)
    sortServices();
    updateStats();
}

// DOM fallback filtrování (bez datové vrstvy)
function filterServicesDom(searchTerm, categoryFilter, regionFilter) {
    const grid = document.getElementById('servicesGrid');
    const noServices = document.getElementById('noServices');
    if (!grid) return;
    const regionCode = getRegionCode(regionFilter || '');

    const cards = Array.from(grid.querySelectorAll('.ad-card'));
    if (cards.length === 0) return;

    let visible = 0;
    cards.forEach((card) => {
        const title = normalize(card.querySelector('.ad-title')?.textContent || '');
        const meta = normalize(card.querySelector('.ad-meta')?.textContent || '');
        const dataCategory = card.getAttribute('data-category') || '';
        
        // Extrahovat lokaci z data-location atributu nebo z .ad-location elementu
        const adBody = card.querySelector('.ad-body');
        const locationFromAttr = adBody?.getAttribute('data-location') || '';
        const locationFromElement = card.querySelector('.ad-location')?.textContent?.trim() || '';
        const locationText = locationFromAttr || locationFromElement || '';
        const locationCode = getRegionCode(locationText);
        
        // Získat také kód z formátovaného názvu (pro zpětnou kompatibilitu)
        const locationCodeFromFormatted = getRegionCodeFromFormatted(locationText);

        const matchesSearch = !searchTerm || title.includes(searchTerm) || meta.includes(searchTerm);
        const matchesCategory = !categoryFilter || dataCategory === categoryFilter;
        // Pokud je vybrán kraj, musí se shodovat. Pokud kraj není vybrán, zobrazit všechny.
        // Speciální hodnoty: "Kdekoliv", "CelaCeskaRepublika" zobrazí všechny inzeráty s touto hodnotou
        let matchesRegion = true;
        if (regionFilter && regionFilter.trim()) {
            const serviceLoc = locationText.trim();
            const regionFilterCode = getRegionCode(regionFilter);
            const regionFilterFormatted = getLocationName(regionFilter);
            
            if (regionFilter === 'Kdekoliv') {
                matchesRegion = serviceLoc === 'Kdekoliv' || locationCode === 'Kdekoliv' || locationCodeFromFormatted === 'Kdekoliv';
            } else if (regionFilter === 'CelaCeskaRepublika') {
                // Porovnat všechny možné formáty
                const normalizedServiceLoc = serviceLoc.toLowerCase().trim();
                matchesRegion = serviceLoc === 'Celá Česká republika' || 
                               serviceLoc === 'Celá ČR' ||
                               serviceLoc === 'CelaCeskaRepublika' || 
                               normalizedServiceLoc === 'celá česká republika' ||
                               normalizedServiceLoc === 'celá čr' ||
                               normalizedServiceLoc === 'celaceskarepublika' ||
                               locationCode === 'CelaCeskaRepublika' ||
                               locationCodeFromFormatted === 'CelaCeskaRepublika';
            } else if (regionCode) {
                matchesRegion = (locationCode && locationCode === regionCode) || 
                               (locationCodeFromFormatted && locationCodeFromFormatted === regionCode) ||
                               (serviceLoc === regionFilterFormatted);
            }
        }

        // Ve veřejném katalogu zobrazujeme jen aktivní karty (fallback režim)
        const st = (card.getAttribute('data-status') || 'active').toString().trim().toLowerCase();
        const statusOk = !st || st === 'active';
        const show = matchesSearch && matchesCategory && matchesRegion && statusOk;
        
        if (show) {
            // Zobrazit kartu a zajistit, že se zachovají všechny inline styly
            card.style.display = 'block';
            card.style.width = '100%';
            card.style.maxWidth = '100%';
            card.style.minWidth = '0';
            card.style.textAlign = 'left';
            card.style.boxSizing = 'border-box';
            card.style.margin = '0';
            card.style.padding = '0';
            
            // Zajistit, že ad-body a ad-location mají správné styly
            const adBody = card.querySelector('.ad-body');
            const adLocation = card.querySelector('.ad-location');
            const adTitle = card.querySelector('.ad-title');
            const adMeta = card.querySelector('.ad-meta');
            const adPrice = card.querySelector('.ad-price');
            
            if (adBody) {
                adBody.style.width = '100%';
                adBody.style.maxWidth = '100%';
                adBody.style.minWidth = '0';
                adBody.style.textAlign = 'left';
                adBody.style.boxSizing = 'border-box';
                adBody.style.margin = '0';
            }
            if (adLocation) {
                adLocation.style.width = '100%';
                adLocation.style.maxWidth = '100%';
                adLocation.style.minWidth = '0';
                adLocation.style.textAlign = 'left';
                adLocation.style.boxSizing = 'border-box';
                adLocation.style.wordWrap = 'break-word';
                adLocation.style.overflowWrap = 'break-word';
                adLocation.style.whiteSpace = 'normal';
                adLocation.style.margin = '0';
                adLocation.style.padding = '0';
            }
            if (adTitle) {
                adTitle.style.textAlign = 'left';
            }
            if (adMeta) {
                adMeta.style.textAlign = 'left';
            }
            if (adPrice) {
                adPrice.style.textAlign = 'left';
            }
            visible++;
        } else {
            card.style.display = 'none';
        }
    });

    if (noServices) {
        noServices.style.display = visible === 0 ? 'block' : 'none';
    }
}

// Globální glue-handlery pro inline volání z HTML (100% propojení UI ↔ logika)
function servicesSearchHandler() {
    const searchVal = normalize((document.getElementById('searchInput')?.value || ''));
    const categoryVal = (document.getElementById('categoryFilter')?.value || '').trim();
    const regionVal = (document.getElementById('regionFilter')?.value || '').trim();
    try { filterServices(); } catch (e) { /* noop */ }
    try { filterServicesDom(searchVal, categoryVal, regionVal); } catch (e) { /* noop */ }
}

function servicesFilterChange() {
    servicesSearchHandler();
}

// Expose handlers
window.servicesSearchHandler = servicesSearchHandler;
window.servicesFilterChange = servicesFilterChange;
window.sortServices = sortServices;
window.filterServices = filterServices;

// Načtení filtrů z URL a jejich aplikace
function applyFiltersFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q') ? decodeURIComponent(params.get('q')) : '';
        const region = params.get('region') ? decodeURIComponent(params.get('region')) : '';
        const searchInput = document.getElementById('searchInput');
        const regionFilter = document.getElementById('regionFilter');
        if (searchInput && q) searchInput.value = q;
        if (regionFilter && region) regionFilter.value = region;
        if (q || region) {
            filterServices();
        }
    } catch (e) {
        console.warn('Nelze aplikovat filtry z URL:', e);
    }
}

// Vyhledání uživatelských profilů podle jména/příjmení/emailu/telefonu
async function searchUsers() {
    try {
        const queryTextRaw = (document.getElementById('userSearchInput')?.value || '').trim();
        const queryText = normalize(queryTextRaw);
        const userResultsEl = document.getElementById('userResults');
        if (!userResultsEl) return;
        if (!queryText) {
            userResultsEl.style.display = 'none';
            userResultsEl.innerHTML = '';
            return;
        }

        // Načti profily přes collectionGroup "profile"
        const { collectionGroup, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profilesRef = collectionGroup(servicesFirebaseDb, 'profile');
        const snapshot = await getDocs(profilesRef);

        const matched = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            const haystack = normalize(`${fullName} ${data.name || ''} ${data.email || ''} ${data.phone || ''}`);
            if (haystack.includes(queryText)) {
                matched.push({ id: docSnap.id, uid: docSnap.ref.parent.parent?.id, ...data });
            }
        });

        renderUserResults(matched);
    } catch (err) {
        console.error('Chyba při vyhledávání uživatelů:', err);
        showMessage('Chyba při vyhledávání uživatelů', 'error');
    }
}

function renderUserResults(users) {
    const userResultsEl = document.getElementById('userResults');
    if (!userResultsEl) return;
    if (!users || users.length === 0) {
        userResultsEl.style.display = 'block';
        userResultsEl.innerHTML = `
            <div class="no-services" style="grid-column: 1 / -1;">
                <i class="fas fa-user-slash"></i>
                <h3>Žádné profily nenalezeny</h3>
                <p>Zkuste upravit hledaný výraz.</p>
            </div>
        `;
        return;
    }

    userResultsEl.style.display = 'grid';
    userResultsEl.innerHTML = users.map(u => `
        <div class="service-item">
            <div class="service-item-header">
                <h3 class="service-title">${u.name || `${u.firstName || ''} ${u.lastName || ''}` || 'Uživatel'}</h3>
                <span class="service-category">Profil</span>
            </div>
            <div class="service-content">
                <div class="service-details">
                    <div class="service-detail"><i class="fas fa-user"></i> <span>${u.email || 'Neuvedeno'}</span></div>
                    ${u.phone ? `<div class="service-detail"><i class="fas fa-phone"></i> <span>${u.phone}</span></div>` : ''}
                </div>
            </div>
            <div class="service-actions">
                <button class="btn btn-success" onclick="openUserProfile('${u.uid || ''}')">
                    <i class="fas fa-user"></i> Zobrazit profil
                </button>
            </div>
        </div>
    `).join('');
}

async function openUserProfile(uid) {
    if (!uid) return;
    
    // Vždy přesměrovat na profil uživatele
    window.location.href = `profile-detail.html?userId=${uid}`;
}

// Normalizace textu pro porovnávání bez diakritiky
function normalize(str) {
    return (str || '')
        .toString()
        .toLowerCase()
        .normalize('NFD')
        // Bezpečné odstranění diakritiky (funguje všude)
        .replace(/[\u0300-\u036f]/g, '');
}

// Řazení služeb
function sortServices() {
    const sortBy = document.getElementById('sortSelect')?.value || 'newest';

    // Pokud není co řadit (prázdný filteredServices), zobrazit prázdný stav
    if (!filteredServices || filteredServices.length === 0) {
        displayServices();
        return;
    }

    // Řaď aktuálně filtrované výsledky (ne všechny služby)
    const base = [...filteredServices];

    const toDate = (d) => new Date(d?.toDate?.() || d);

    // Nejprve seřadit podle zvoleného klíče
    base.sort((a, b) => {
        switch (sortBy) {
            case 'oldest':
                return toDate(a.createdAt) - toDate(b.createdAt);
            case 'title':
                return (a.title || '').localeCompare(b.title || '');
            case 'newest':
            default:
                return toDate(b.createdAt) - toDate(a.createdAt);
        }
    });

    // TOP vždy nahoře, seřadit TOP podle data přidání (createdAt) - nejnovější první
    const top = base.filter(s => !!s.isTop);
    const rest = base.filter(s => !s.isTop);
    
    // Seřadit TOP inzeráty podle data přidání (createdAt) - nejnovější první
    top.sort((a, b) => {
        const aDate = new Date(a.createdAt?.toDate?.() || a.createdAt || 0);
        const bDate = new Date(b.createdAt?.toDate?.() || b.createdAt || 0);
        return bDate - aDate;
    });
    
    const result = [...top, ...rest];

    filteredServices = result;
    displayServices();
}

// Extrakce ceny z textu
function extractPrice(priceText) {
    if (!priceText) return 0;
    const match = priceText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

// Kontaktování služby
function contactService(serviceId) {
    console.log('📞 Kontaktování služby:', serviceId);
    const service = allServices.find(s => s.id === serviceId);
    console.log('🔍 Nalezená služba:', service);
    
    if (!service) {
        console.error('❌ Služba nenalezena!');
        showMessage('Služba nenalezena!', 'error');
        return;
    }
    
    // Kontrola přihlášení
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        // Rovnou otevřít modal pro přihlášení
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
        }
        return;
    }
    
    // Kontrola, že uživatel nekontaktuje sám sebe
    if (service.userId === currentUser.uid) {
        showMessage('Nemůžete kontaktovat sami sebe', 'error');
        return;
    }
    
    console.log('✅ Kontrola přihlášení prošla, pokračuji s chatem...');
    
    // Použít chat funkcionalitu – preferovat contactSeller, jinak přímé přesměrování
    if (typeof contactSeller === 'function' || window.contactSeller) {
        try {
            const fn = typeof contactSeller === 'function' ? contactSeller : window.contactSeller;
            console.log('🎯 Volám contactSeller funkci...');
            console.log('📋 Parametry:', { serviceId, sellerUid: service.userId, listingTitle: service.title });
            fn(serviceId, service.userId, service.title);
            return;
        } catch (e) {
            console.warn('⚠️ contactSeller selhal, používám přímé přesměrování', e);
        }
    }

    // Fallback: přímé přesměrování na chat s parametry
    const url = new URL('chat.html', window.location.href);
    url.searchParams.set('userId', service.userId);
    url.searchParams.set('listingId', serviceId);
    if (service.title) url.searchParams.set('listingTitle', service.title);
    window.location.href = url.toString();
}

// Zobrazení detailů služby
function showServiceDetails(serviceId) {
    // Redirect to ad detail page instead of showing modal
    const service = allServices.find(s => s.id === serviceId);
    if (service) {
        window.location.href = `ad-detail.html?id=${serviceId}&userId=${service.userId}`;
    }
    return;
    
    // Original modal code (commented out)
    /*
    const service = allServices.find(s => s.id === serviceId);
    if (!service) return;
    
    // Vytvoření modalu s detaily služby
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content service-details-modal">
            <div class="modal-header">
                <h2>${service.title}</h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="service-details-content">
                ${service.images && service.images.length > 0 ? `
                <div class="service-detail-section">
                    <h3><i class="fas fa-images"></i> Fotky služby</h3>
                    <div class="service-images-gallery">
                        ${service.images.map((img, index) => `
                            <div class="gallery-image-item" onclick="openImageViewer(${JSON.stringify(service.images).replace(/"/g, '&quot;')}, ${index})">
                                <img src="${img.url}" alt="${service.title} - obrázek ${index + 1}" class="gallery-image">
                                <div class="gallery-image-overlay">
                                    <i class="fas fa-expand"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <p class="gallery-info">Klikněte na obrázek pro plné zobrazení</p>
                </div>
                ` : ''}
                <div class="service-detail-section">
                    <h3>Popis služby</h3>
                    <p>${service.description}</p>
                </div>
                <div class="service-detail-section">
                    <h3>Detaily</h3>
                    <div class="service-details-grid">
                        <div class="detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span><strong>Lokalita:</strong> ${getLocationName(service.location)}</span>
                        </div>
                        ${service.price ? `
                        <div class="detail-item">
                            <i class="fas fa-tag"></i>
                            <span><strong>Cena:</strong> ${service.price}</span>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <i class="fas fa-user"></i>
                            <span><strong>Poskytovatel:</strong> ${service.userEmail}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-calendar"></i>
                            <span><strong>Přidáno:</strong> ${formatDate(service.createdAt)}</span>
                        </div>
                        <div class="detail-item">
                            <i class="fas fa-tags"></i>
                            <span><strong>Kategorie:</strong> ${getCategoryName(service.category)}</span>
                        </div>
                    </div>
                </div>
                <div class="service-actions">
                    <button class="btn btn-primary" onclick="contactService('${service.id}'); this.closest('.modal').remove();">
                        <i class="fas fa-comments"></i> Chat
                    </button>
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()">
                        Zavřít
                    </button>
                </div>
                <div class="service-detail-section">
                    <h3><i class="fas fa-star"></i> Hodnocení této nabídky</h3>
                    <div id="listingReviews_${service.id}" class="reviews-list"></div>
                    <div id="listingReviewForm_${service.id}" class="review-form" style="display: none;">
                        <label>Vaše hodnocení</label>
                        <div class="stars" data-for="listing" data-adid="${service.id}">
                            ${[1,2,3,4,5].map(n => `<i class=\"fas fa-star\" data-value=\"${n}\"></i>`).join('')}
                        </div>
                        <textarea id="listingReviewText_${service.id}" class="form-input" placeholder="Napište vaši zkušenost"></textarea>
                        <button class="btn btn-success" onclick="submitListingReview('${service.userId}','${service.id}')">Uložit hodnocení</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    // Inicializace hodnocení
    initStarsInteractions();
    loadListingReviews(service.userId, service.id);
    
    // Zobrazit formulář pouze pokud je uživatel přihlášen a není vlastník
    const currentUser = window.firebaseAuth?.currentUser;
    const reviewForm = document.getElementById(`listingReviewForm_${service.id}`);
    if (reviewForm) {
        if (currentUser && currentUser.uid !== service.userId) {
            reviewForm.style.display = 'block';
        } else if (!currentUser) {
            reviewForm.innerHTML = '<p class="review-login-required">Pro hodnocení se prosím přihlaste</p>';
            reviewForm.style.display = 'block';
        }
    }
    
    // Zavření při kliknutí mimo modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    });
    */
}

// Zobrazení chybové zprávy
function showErrorMessage(message) {
    console.error('❌ Zobrazuji chybovou zprávu:', message);
    const servicesGrid = document.getElementById('servicesGrid');
    if (servicesGrid) {
        servicesGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Chyba při načítání</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Zkusit znovu</button>
            </div>
        `;
    } else {
        console.error('❌ Element servicesGrid nenalezen!');
    }
}

// Přidání testovacích služeb
async function addTestServices() {
    console.log('🚫 Testovací služby jsou vypnuté');
    return; // Vypnuto - nepoužívat stock inzeráty
    
    /* VYPNUTO - Stock inzeráty
    try {
        console.log('🧪 Přidávám testovací služby...');
        console.log('Firebase DB pro testovací služby:', servicesFirebaseDb);
        
        // Pokud máme Firebase, použij ho
        if (servicesFirebaseDb) {
            const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            const testServices = [
                {
                    title: "Oprava počítačů a notebooků",
                    category: "it",
                    description: "Profesionální oprava počítačů, notebooků a tabletů. Diagnostika problémů, výměna komponentů, instalace operačních systémů. Rychlé a spolehlivé služby.",
                    price: "500 Kč/hod",
                    location: "Praha",
                    userId: "test-user-1",
                    userEmail: "opravy@example.com",
                    createdAt: new Date(),
                    status: "active"
                },
                {
                    title: "Instalace nábytku",
                    category: "technical",
                    description: "Montáž a instalace nábytku všech typů. IKEA nábytek, kuchyňské linky, skříně, postele. Zkušený montér s vlastním nářadím.",
                    price: "800 Kč/hod",
                    location: "Brno",
                    userId: "test-user-2",
                    userEmail: "montaz@example.com",
                    createdAt: new Date(),
                    status: "active"
                },
                {
                    title: "Doučování matematiky",
                    category: "education",
                    description: "Doučování matematiky pro základní a střední školy. Příprava na přijímací zkoušky, maturitu. Individuální přístup, trpělivost.",
                    price: "400 Kč/hod",
                    location: "Ostrava",
                    userId: "test-user-3",
                    userEmail: "doucovani@example.com",
                    createdAt: new Date(),
                    status: "active"
                },
                {
                    title: "Grafický design",
                    category: "design",
                    description: "Tvorba log, vizitek, bannerů, letáků. Branding a corporate identity. Moderní design, rychlé dodání, konkurenční ceny.",
                    price: "1200 Kč/projekt",
                    location: "Plzeň",
                    userId: "test-user-4",
                    userEmail: "design@example.com",
                    createdAt: new Date(),
                    status: "active"
                },
                {
                    title: "Úklidové služby",
                    category: "home",
                    description: "Profesionální úklid domácností a kanceláří. Jednorázový i pravidelný úklid. Ekologické prostředky, spolehlivost.",
                    price: "300 Kč/hod",
                    location: "České Budějovice",
                    userId: "test-user-5",
                    userEmail: "uklid@example.com",
                    createdAt: new Date(),
                    status: "active"
                },
                {
                    title: "Stěhování",
                    category: "transport",
                    description: "Kompletní stěhovací služby. Stěhování bytů, domů, kanceláří. Zabalené služby, pojištění, rychlé a šetrné stěhování.",
                    price: "1500 Kč/hod",
                    location: "Liberec",
                    userId: "test-user-6",
                    userEmail: "stehovani@example.com",
                    createdAt: new Date(),
                    status: "active"
                }
            ];
            
            console.log('📝 Přidávám', testServices.length, 'testovacích služeb...');
            
            for (const service of testServices) {
                console.log('➕ Přidávám službu:', service.title);
                
                // Nejdříve vytvořit uživatele, pokud neexistuje
                const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                
                // Vytvořit root dokument uživatele
                await setDoc(doc(servicesFirebaseDb, 'users', service.userId), {
                    uid: service.userId,
                    email: service.userEmail,
                    createdAt: new Date()
                });
                
                // Vytvořit profil uživatele
                await setDoc(doc(servicesFirebaseDb, 'users', service.userId, 'profile', 'profile'), {
                    name: service.userEmail.split('@')[0],
                    email: service.userEmail,
                    balance: 1000,
                    createdAt: new Date()
                });
                
                // Uložit inzerát do users/{userId}/inzeraty
                const adsCollection = collection(servicesFirebaseDb, 'users', service.userId, 'inzeraty');
                const docRef = await addDoc(adsCollection, service);
                console.log('✅ Služba přidána s ID:', docRef.id);
            }
            
            console.log('🎉 Testovací služby byly úspěšně přidány do Firebase databáze');
        } else {
            // Pokud nemáme Firebase, použij lokální databázi
            createTestServices();
            filteredServices = [...allServices];
            displayServices();
            updateStats();
            console.log('Testovací služby přidány do lokální databáze');
        }
        
    } catch (error) {
        console.error('❌ Chyba při přidávání testovacích služeb:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        // Fallback na lokální databázi
        console.log('🔄 Přepínám na lokální databázi...');
        createTestServices();
        filteredServices = [...allServices];
        displayServices();
        updateStats();
    }
    */ // Konec vypnutých testovacích služeb
}

// Přidání nové služby
function addService(serviceData) {
    // Tato funkce je pro lokální databázi - pro Firebase používáme auth.js
    const newService = {
        id: Date.now().toString(),
        ...serviceData,
        userId: 'local-user',
        userEmail: 'local@example.com',
        createdAt: new Date(),
        status: 'active'
    };
    
    allServices.unshift(newService);
    filteredServices = [...allServices];
    saveServicesToLocalStorage();
    displayServices();
    updateStats();
    
    console.log('Nová služba přidána:', newService);
}

// Test připojení
async function testFirebaseConnection() {
    try {
        console.log('Testování připojení...');
        
        if (servicesFirebaseDb) {
            const { collection, addDoc, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            
            // Test zápisu
            const testRef = collection(servicesFirebaseDb, 'test');
            const testDoc = await addDoc(testRef, {
                test: true,
                timestamp: new Date()
            });
            console.log('Test zápisu úspěšný:', testDoc.id);
            
            // Test čtení
            const snapshot = await getDocs(testRef);
            console.log('Test čtení úspěšný:', snapshot.docs.length, 'dokumentů');
            
            updateConnectionStatus(true);
            return true;
        } else {
            console.log('Firebase není dostupný, používám lokální databázi');
            updateConnectionStatus(true);
            return true;
        }
        
    } catch (error) {
        console.error('Test selhal:', error);
        updateConnectionStatus(false);
        return false;
    }
}

// Zobrazení profilu prodejce služby
async function showServiceProfile(serviceId) {
    console.log('👤 Zobrazuji profil prodejce služby:', serviceId);
    
    const service = allServices.find(s => s.id === serviceId);
    if (!service) {
        console.error('❌ Služba nenalezena!');
        showMessage('Služba nenalezena!', 'error');
        return;
    }
    
    console.log('🔍 Nalezená služba:', service);
    
    // Redirect to profile detail page
    window.location.href = `profile-detail.html?userId=${service.userId}`;
}

// ===================== Reviews helpers =====================
function initStarsInteractions() {
    try {
        const containers = document.querySelectorAll('.stars');
        containers.forEach(container => {
            const stars = container.querySelectorAll('i.fas.fa-star');
            stars.forEach(star => {
                star.addEventListener('mouseenter', () => highlightStars(stars, parseInt(star.getAttribute('data-value'))));
                star.addEventListener('mouseleave', () => restoreStars(container));
                star.addEventListener('click', () => selectStars(container, parseInt(star.getAttribute('data-value'))));
            });
            container.setAttribute('data-selected', '0');
        });
    } catch (e) {
        console.warn('initStarsInteractions warning:', e);
    }
}

function highlightStars(stars, upto) {
    stars.forEach(s => {
        const val = parseInt(s.getAttribute('data-value'));
        s.style.color = val <= upto ? '#ffc107' : '#e0e0e0';
    });
}

function restoreStars(container) {
    const stars = container.querySelectorAll('i.fas.fa-star');
    const selected = parseInt(container.getAttribute('data-selected') || '0');
    highlightStars(stars, selected);
}

function selectStars(container, value) {
    container.setAttribute('data-selected', String(value));
    restoreStars(container);
}

async function submitProfileReview(targetUserId) {
    try {
        const currentUser = window.firebaseAuth?.currentUser;
        if (!currentUser) { showMessage('Pro hodnocení se přihlaste', 'error'); return; }
        if (currentUser.uid === targetUserId) { showMessage('Nemůžete hodnotit sami sebe', 'error'); return; }

        const starsEl = document.querySelector(`.stars[data-for="profile"][data-userid="${targetUserId}"]`);
        const rating = parseInt(starsEl?.getAttribute('data-selected') || '0');
        const text = (document.getElementById(`profileReviewText_${targetUserId}`)?.value || '').trim();
        if (rating < 1 || rating > 5) { showMessage('Vyberte počet hvězd (1-5)', 'error'); return; }

        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const reviewRef = doc(window.firebaseDb, 'users', targetUserId, 'reviews', currentUser.uid);
        await setDoc(reviewRef, {
            type: 'profile',
            rating,
            text,
            fromUserId: currentUser.uid,
            fromUserEmail: currentUser.email || '',
            updatedAt: new Date()
        }, { merge: true });

        showMessage('Hodnocení uloženo', 'success');
        loadCombinedUserReviews(targetUserId);
    } catch (e) {
        console.error('submitProfileReview error', e);
        showMessage('Nepodařilo se uložit hodnocení', 'error');
    }
}

async function submitListingReview(ownerUserId, adId) {
    try {
        const currentUser = window.firebaseAuth?.currentUser;
        if (!currentUser) { showMessage('Pro hodnocení se přihlaste', 'error'); return; }
        if (currentUser.uid === ownerUserId) { showMessage('Nemůžete hodnotit vlastní inzerát', 'error'); return; }

        const starsEl = document.querySelector(`.stars[data-for="listing"][data-adid="${adId}"]`);
        const rating = parseInt(starsEl?.getAttribute('data-selected') || '0');
        const text = (document.getElementById(`listingReviewText_${adId}`)?.value || '').trim();
        if (rating < 1 || rating > 5) { showMessage('Vyberte počet hvězd (1-5)', 'error'); return; }

        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const reviewRef = doc(window.firebaseDb, 'users', ownerUserId, 'inzeraty', adId, 'reviews', currentUser.uid);
        await setDoc(reviewRef, {
            type: 'ad',
            adId,
            rating,
            text,
            fromUserId: currentUser.uid,
            fromUserEmail: currentUser.email || '',
            updatedAt: new Date()
        }, { merge: true });

        showMessage('Hodnocení inzerátu uloženo', 'success');
        loadListingReviews(ownerUserId, adId);
    } catch (e) {
        console.error('submitListingReview error', e);
        showMessage('Nepodařilo se uložit hodnocení', 'error');
    }
}

async function loadListingReviews(ownerUserId, adId) {
    try {
        const container = document.getElementById(`listingReviews_${adId}`);
        if (!container) return;
        container.innerHTML = '<p>Načítám recenze...</p>';

        const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const reviewsRef = collection(window.firebaseDb, 'users', ownerUserId, 'inzeraty', adId, 'reviews');
        const snap = await getDocs(reviewsRef);
        const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        container.innerHTML = renderReviewsList(reviews);
    } catch (e) {
        console.error('loadListingReviews error', e);
    }
}

async function loadCombinedUserReviews(userId) {
    try {
        const container = document.getElementById(`combinedReviews_${userId}`);
        if (!container) return;
        container.innerHTML = '<p>Načítám recenze...</p>';

        const { getDocs, collection, collectionGroup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        // Recenze profilu
        const profileReviewsRef = collection(window.firebaseDb, 'users', userId, 'reviews');
        const profileSnap = await getDocs(profileReviewsRef);
        const profileReviews = profileSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Recenze ke všem inzerátům uživatele napříč strukturou
        const adReviewsGroup = collectionGroup(window.firebaseDb, 'reviews');
        const adReviews = [];
        const groupSnap = await getDocs(adReviewsGroup);
        groupSnap.forEach(docSnap => {
            const parent = docSnap.ref.parent; // reviews
            const adDoc = parent?.parent; // adId document
            const inzeraty = adDoc?.parent; // collection 'inzeraty'
            const userDoc = inzeraty?.parent; // user uid doc
            if (userDoc && userDoc.id === userId && inzeraty.id === 'inzeraty') {
                adReviews.push({ id: docSnap.id, ...docSnap.data() });
            }
        });

        const combined = [...profileReviews, ...adReviews];
        container.innerHTML = renderReviewsList(combined);
    } catch (e) {
        console.error('loadCombinedUserReviews error', e);
    }
}

function renderReviewsList(reviews) {
    if (!reviews || reviews.length === 0) {
        return `<div class=\"no-services\"><i class=\"fas fa-comment-slash\"></i><p>Zatím žádné recenze</p></div>`;
    }
    const avg = (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1);
    return `
        <div class=\"reviews-summary\"><strong>Průměr:</strong> ${avg} / 5 • <strong>Počet:</strong> ${reviews.length}</div>
        <div class=\"reviews-items\">
            ${reviews.map(r => `
                <div class=\"review-item\">
                    <div class=\"review-header\">
                        <span class=\"review-stars\">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
                        <span class=\"review-meta\">${r.fromUserEmail || r.fromUserId || ''}</span>
                    </div>
                    ${r.text ? `<p class=\"review-text\">${escapeHtml(r.text)}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function escapeHtml(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Expose submit functions
window.submitProfileReview = submitProfileReview;
window.submitListingReview = submitListingReview;

// Add CSS for review forms
const reviewStyles = document.createElement('style');
reviewStyles.textContent = `
    .review-form {
        margin-top: 15px;
        padding: 15px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: #f9f9f9;
    }
    .review-form label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
    }
    .stars {
        margin-bottom: 10px;
    }
    .stars i {
        font-size: 20px;
        color: #e0e0e0;
        cursor: pointer;
        margin-right: 3px;
        transition: color 0.2s;
    }
    .stars i:hover {
        color: #ffc107;
    }
    .review-form textarea {
        width: 100%;
        min-height: 80px;
        margin-bottom: 10px;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        resize: vertical;
    }
    .review-login-required {
        color: #666;
        font-style: italic;
        text-align: center;
        padding: 10px;
        background: #f0f0f0;
        border-radius: 4px;
    }
    .reviews-list {
        margin-top: 15px;
    }
    .reviews-summary {
        margin-bottom: 15px;
        padding: 10px;
        background: #e8f4fd;
        border-radius: 4px;
        font-size: 14px;
    }
    .review-item {
        margin-bottom: 15px;
        padding: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        background: white;
    }
    .review-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    .review-stars {
        color: #ffc107;
        font-size: 16px;
    }
    .review-meta {
        font-size: 12px;
        color: #666;
    }
    .review-text {
        margin: 0;
        color: #333;
        line-height: 1.4;
    }
`;
document.head.appendChild(reviewStyles);

// Získání ikony podle kategorie (stejné jako v chat.js)
function getCategoryIcon(category) {
    const icons = {
        'home_craftsmen': 'fas fa-hammer',
        'auto_moto': 'fas fa-car',
        'garden_exterior': 'fas fa-leaf',
        'education_tutoring': 'fas fa-graduation-cap',
        'it_technology': 'fas fa-microchip',
        'health_personal_care': 'fas fa-heart',
        'gastronomy_catering': 'fas fa-utensils',
        'events_entertainment': 'fas fa-music',
        'personal_small_jobs': 'fas fa-hands-helping',
        'auto_moto_transport': 'fas fa-truck',
        'hobby_creative': 'fas fa-palette',
        'law_finance_admin': 'fas fa-balance-scale',
        'pets': 'fas fa-paw',
        'specialized_custom': 'fas fa-star'
    };
    return icons[category] || 'fas fa-tag';
}

// Export funkcí pro globální použití
// Testovací funkce pro kontakt
function testContact() {
    console.log('🧪 Testování kontaktu...');
    console.log('📊 Stav služeb:', { 
        allServices: allServices.length, 
        filteredServices: filteredServices.length 
    });
    
    console.log('🔍 Kontrola funkcí:');
    console.log('- contactSeller:', typeof contactSeller);
    console.log('- window.contactSeller:', typeof window.contactSeller);
    console.log('- contactService:', typeof contactService);
    console.log('- window.firebaseAuth:', !!window.firebaseAuth);
    console.log('- window.firebaseDb:', !!window.firebaseDb);
    
    if (allServices.length === 0) {
        showMessage('Žádné služby nejsou načteny!', 'error');
        return;
    }
    
    const firstService = allServices[0];
    console.log('🔍 První služba:', firstService);
    
    if (firstService) {
        console.log('🎯 Spouštím contactService...');
        contactService(firstService.id);
    } else {
        showMessage('Nebyla nalezena žádná služba!', 'error');
    }
}

// Show auth required modal
window.showAuthRequiredModal = function() {
    // Check if modal already exists
    let modal = document.getElementById('authRequiredModal');
    if (modal) {
        modal.style.display = 'flex';
        return;
    }
    
    // Create modal
    modal = document.createElement('div');
    modal.id = 'authRequiredModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: center;">
            <div class="modal-header">
                <h2 style="margin: 0;">Přihlášení vyžadováno</h2>
                <span class="close" onclick="this.closest('.modal').style.display='none'">&times;</span>
            </div>
            <div class="modal-body" style="padding: 2rem;">
                <i class="fas fa-lock" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
                <p style="margin-bottom: 2rem;">Pro posílání zpráv v chatu se musíte přihlásit nebo registrovat.</p>
                <div style="display: flex; flex-direction: column; gap: 1rem; align-items: center;">
                    <button class="btn" onclick="showAuthModal('login'); document.getElementById('authRequiredModal').style.display='none';" style="background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%); color: white; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-sign-in-alt"></i>
                        Přihlásit se
                    </button>
                    <button class="btn" onclick="showAuthModal('register'); document.getElementById('authRequiredModal').style.display='none';" style="background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%); color: white; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-user-plus"></i>
                        Registrovat se
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
};

window.contactService = contactService;
window.showServiceDetails = showServiceDetails;
window.showServiceProfile = showServiceProfile;
window.openUserProfile = openUserProfile;
window.addTestServices = addTestServices;
window.testFirebaseConnection = testFirebaseConnection;
window.addService = addService;
window.testContact = testContact;