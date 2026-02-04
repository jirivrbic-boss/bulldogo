// Top Ads functionality
let selectedPricing = null;
let selectedAd = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializeTopAds();
    initializeAuthState();
    // Zpracování návratu ze Stripe Checkout (?payment=success|canceled)
    (function handleStripeReturn(){
        try {
            const params = new URLSearchParams(window.location.search);
            const status = params.get('payment');
            if (!status) return;
            // Vyčistit URL
            try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
            if (status === 'success') {
                // Po úspěšné platbě aktivuj TOP pro vybraný inzerát (uložený před redirectem)
                (async () => {
                    try {
                        await activateTopFromPending();
                    } catch (e) {
                        console.error('activateTopFromPending failed:', e);
                    } finally {
                        showSuccess();
                    }
                })();
            } else if (status === 'canceled') {
                alert("Platba byla zrušena.");
                try { sessionStorage.removeItem('topad_pending'); } catch (_) {}
                try { localStorage.removeItem('topad_pending'); } catch (_) {}
                // Vrátit tlačítko do původního stavu
                const payButton = document.querySelector('.payment-actions .btn-primary');
                if (payButton) {
                    payButton.innerHTML = '<i class="fas fa-credit-card"></i> Zaplatit';
                    payButton.disabled = false;
                }
            }
        } catch (e) {
            console.error('handleStripeReturn error:', e);
        }
    })();
});

// Po návratu ze Stripe může být Auth ještě neinicializovaná (currentUser === null).
// Tohle čeká na Firebase + přihlášeného uživatele a teprve pak provede aktivaci.
async function waitForFirebaseAndUser(timeoutMs = 15000) {
    const started = Date.now();
    // 1) počkej na firebase init
    while (!(window.firebaseAuth && window.firebaseDb)) {
        if (Date.now() - started > timeoutMs) throw new Error('Firebase init timeout');
        await new Promise(r => setTimeout(r, 100));
    }
    // 2) počkej na auth state (uživatel může naskočit až po chvíli)
    return await new Promise((resolve, reject) => {
        let done = false;
        const t = setTimeout(() => {
            if (done) return;
            done = true;
            reject(new Error('Auth timeout'));
        }, Math.max(1000, timeoutMs - (Date.now() - started)));
        const unsub = window.firebaseAuth.onAuthStateChanged((u) => {
            if (u && !done) {
                done = true;
                clearTimeout(t);
                try { unsub(); } catch (_) {}
                resolve(u);
            }
        });
    });
}

// Aktivace TOP po návratu ze Stripe podle uloženého "pending" stavu.
async function activateTopFromPending() {
    let user = null;
    try {
        user = await waitForFirebaseAndUser(20000);
    } catch (e) {
        console.warn('activateTopFromPending: auth/firebase not ready:', e);
        return;
    }
    let pending = null;
    try {
        const raw = sessionStorage.getItem('topad_pending') || localStorage.getItem('topad_pending');
        if (raw) pending = JSON.parse(raw);
    } catch (_) {}
    if (!pending || !pending.adId || !pending.durationDays) {
        console.warn('No pending top activation data found.');
        return;
    }
    const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
    const { doc, setDoc, Timestamp } = firestoreModule;
    const now = new Date();
    const expires = new Date(now.getTime() + (Number(pending.durationDays) * 24 * 60 * 60 * 1000));

    await setDoc(
        doc(window.firebaseDb, 'users', user.uid, 'inzeraty', pending.adId),
        {
            isTop: true,
            topActivatedAt: Timestamp.fromDate(now),
            topExpiresAt: Timestamp.fromDate(expires),
            topDurationDays: Number(pending.durationDays),
            topPaymentProvider: 'stripe',
            topPaymentCreatedAt: pending.startedAt ? Timestamp.fromMillis(Number(pending.startedAt)) : Timestamp.fromDate(now)
        },
        { merge: true }
    );
    try { sessionStorage.removeItem('topad_pending'); } catch (_) {}
    try { localStorage.removeItem('topad_pending'); } catch (_) {}
}

function initializeTopAds() {
    console.log('🚀 Initializing top ads');
    
    // Add event listeners to pricing buttons
    document.querySelectorAll('.btn-pricing').forEach(button => {
        button.addEventListener('click', function() {
            const duration = this.getAttribute('data-duration');
            const price = this.getAttribute('data-price');
            selectPricing(duration, price);
        });
    });

    // URL preselection (duration/price) support
    try {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('duration');
        const p = params.get('price');
        if (d && p) {
            const di = parseInt(d, 10);
            const pi = parseInt(p, 10);
            if ([1,7,30].includes(di) && pi > 0) {
                selectPricing(di, pi);
            }
        }
    } catch (_) {}

    // Wait for Firebase to be ready before loading ads
    waitForFirebase();
}

function waitForFirebase() {
    console.log('⏳ Waiting for Firebase to be ready...');
    
    const checkFirebase = () => {
        if (window.firebaseAuth && window.firebaseDb) {
            console.log('✅ Firebase is ready, setting up auth listener...');
            setupAuthListener();
        } else {
            console.log('⏳ Firebase not ready yet, retrying in 100ms...');
            setTimeout(checkFirebase, 100);
        }
    };
    
    // Start checking immediately
    setTimeout(checkFirebase, 0);
}

function setupAuthListener() {
    console.log('🔐 Setting up auth state listener...');
    
    // Nastavit callback pro aktualizaci po přihlášení
    window.afterLoginCallback = function() {
        console.log('🔄 Callback po přihlášení na stránce Top Ads');
        const user = window.firebaseAuth?.currentUser;
        if (user) {
            loadUserAds();
        }
    };
    
    // Use onAuthStateChanged to properly detect auth state
    (window.importFirebaseAuth || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')))()
        .then(({ onAuthStateChanged }) => {
        onAuthStateChanged(window.firebaseAuth, (user) => {
            console.log('👤 Auth state changed:', user ? `Přihlášen: ${user.email}` : 'Odhlášen');
            
            if (user) {
                console.log('✅ User is authenticated, loading ads...');
                loadUserAds();
            } else {
                console.log('❌ User not authenticated, showing login message...');
                showLoginRequired();
            }
        });
    });
}

function showLoginRequired() {
    const adsList = document.getElementById('adsList');
    if (adsList) {
        adsList.innerHTML = `
            <div class="no-ads-message">
                <div class="no-ads-message-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <div class="no-ads-message-content">
                    <h3 class="no-ads-message-title">Přihlášení vyžadováno</h3>
                    <p class="no-ads-message-text">Pro topování inzerátů se musíte přihlásit.</p>
                    <button class="btn btn-primary btn-bulldogo" onclick="showAuthModal('login')">
                        <i class="fas fa-sign-in-alt"></i>
                        Přihlásit se
                    </button>
                </div>
            </div>
        `;
    }
}

function selectPricing(duration, price) {
    selectedPricing = {
        duration: parseInt(duration),
        price: parseInt(price)
    };

    // Always show ad selection first, regardless of pre-selected ad
    showAdSelection();
}

function showAdSelection() {
    const adSelectionEl = document.getElementById('adSelection');
    if (adSelectionEl) {
        adSelectionEl.style.display = 'block';
        adSelectionEl.style.setProperty('display', 'block', 'important');
    }
    
    const pricingEl = document.querySelector('.top-ads-pricing');
    if (pricingEl) {
        pricingEl.style.display = 'none';
    }
    
    // Scroll to ad selection
    if (adSelectionEl) {
        adSelectionEl.scrollIntoView({ 
            behavior: 'smooth' 
        });
    }
}

function hideAdSelection() {
    const adSelectionEl = document.getElementById('adSelection');
    if (adSelectionEl) {
        adSelectionEl.style.display = 'none';
        adSelectionEl.style.setProperty('display', 'none', 'important');
    }
    
    const pricingEl = document.querySelector('.top-ads-pricing');
    if (pricingEl) {
        pricingEl.style.display = 'block';
    }
    
    // Scroll to pricing
    if (pricingEl) {
        pricingEl.scrollIntoView({ 
            behavior: 'smooth' 
        });
    }
}

function loadUserAds() {
    console.log('🔍 loadUserAds called');
    
    const adsList = document.getElementById('adsList');
    if (!adsList) {
        console.error('❌ adsList element not found!');
        return;
    }
    
    console.log('✅ adsList element found');
    
    // Check if we have a pre-selected ad from URL
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectedAdId = urlParams.get('adId');
    
    console.log('🔍 Loading user ads, preSelectedAdId:', preSelectedAdId);
    
    // Load real user ads from Firebase
    loadUserAdsFromFirebase(preSelectedAdId);
}

async function loadUserAdsFromFirebase(preSelectedAdId = null) {
    try {
        console.log('🔄 Loading ads from Firebase, preSelectedAdId:', preSelectedAdId);
        
        // Get current user from auth state
        const currentUser = window.firebaseAuth.currentUser;
        console.log('👤 Current user from auth:', currentUser);
        
        if (!currentUser) {
            console.log('❌ No current user, this should not happen with auth listener');
            showLoginRequired();
            return;
        }

        const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
        const { getDocs, collection } = firestoreModule;
        
        const adsCollection = collection(window.firebaseDb, 'users', currentUser.uid, 'inzeraty');
        const querySnapshot = await getDocs(adsCollection);
        
        console.log('📊 Found ads:', querySnapshot.size);
        
        const adsList = document.getElementById('adsList');
        adsList.innerHTML = '';
        
        let foundPreSelected = false;
        
        if (querySnapshot.size === 0) {
            console.log('⚠️ No ads found, showing message');
            adsList.innerHTML = `
                <div class="no-ads-message">
                    <div class="no-ads-message-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="no-ads-message-content">
                        <h3 class="no-ads-message-title">Žádné inzeráty nenalezeny</h3>
                        <p class="no-ads-message-text">Nemáte žádné inzeráty k topování. Nejdříve vytvořte inzerát v sekci "Mé inzeráty".</p>
                        <button class="btn-bulldogo" onclick="window.location.href='my-ads.html'">
                            <i class="fas fa-list"></i>
                            Moje inzeráty
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        const categoryNames = {
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
            'specialized_custom': 'Specializované služby na přání'
        };
        const getImageUrl = (ad) => {
            let imageUrl = 'fotky/team.jpg';
            if (ad.images && ad.images.length > 0) {
                if (ad.images[0].url) imageUrl = ad.images[0].url;
                else if (typeof ad.images[0] === 'string') imageUrl = ad.images[0];
            } else if (ad.image) {
                if (ad.image.url) imageUrl = ad.image.url;
                else if (typeof ad.image === 'string') imageUrl = ad.image;
            }
            return imageUrl;
        };

        querySnapshot.forEach((docSnap) => {
            const ad = docSnap.data();
            const adId = docSnap.id;
            console.log('📝 Processing ad:', adId, 'title:', ad.title);

            // Kontrola aktivního topování
            const isTop = ad.isTop === true;
            const topExpiresAt = ad.topExpiresAt;
            let topInfo = '';
            if (isTop && topExpiresAt) {
                const expiresDate = topExpiresAt.toDate ? topExpiresAt.toDate() : new Date(topExpiresAt);
                const now = new Date();
                if (expiresDate > now) {
                    const remainingDays = Math.ceil((expiresDate - now) / (24 * 60 * 60 * 1000));
                    const expiresDateFormatted = expiresDate.toLocaleDateString('cs-CZ', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                    });
                    topInfo = `<div class="ad-meta" style="margin-top: 8px; color: #ff8a00; font-weight: bold;">
                        <i class="fas fa-fire"></i> TOP aktivní do ${expiresDateFormatted} (zbývá ${remainingDays} ${remainingDays === 1 ? 'den' : remainingDays < 5 ? 'dny' : 'dní'})
                    </div>`;
                }
            }

            const article = document.createElement('article');
            article.className = 'ad-card selectable';
            article.setAttribute('data-ad-id', adId);
            article.innerHTML = `
                <div class="ad-thumb">
                    <img src="${getImageUrl(ad)}" alt="Inzerát" loading="lazy" decoding="async">
                </div>
                <div class="ad-body">
                    <h3 class="ad-title">${ad.title || ''}</h3>
                    <div class="ad-meta">
                        <span>${ad.location || ''}</span> • <span>${categoryNames[ad.category] || ad.category || ''}</span>
                    </div>
                    ${ad.price ? `<div class="ad-meta" style="margin-top: 8px;"><strong>Cena:</strong> ${ad.price}</div>` : ''}
                    ${topInfo}
                </div>
            `;

            article.addEventListener('click', function() {
                selectAd({ id: adId, ...ad }, article);
            });

            adsList.appendChild(article);

            // Mark pre-selected ad visually; auto-select when pricing preselected
            if (preSelectedAdId && adId === preSelectedAdId) {
                console.log('✅ Found pre-selected ad, marking visually:', adId);
                foundPreSelected = true;
                article.classList.add('pre-selected');
                // Pokud je předvybraná délka/price (selectedPricing), rovnou vyber a přejdi na platbu
                if (selectedPricing && typeof selectedPricing.duration === 'number') {
                    try { selectAd({ id: adId, ...ad }, article); } catch (_) {}
                }
            }
        });
        
        // Přidat event listenery pro obrázky - přidat třídu .loaded po načtení (stejně jako v my-ads.js)
        const images = adsList.querySelectorAll('.ad-thumb img');
        images.forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                // Obrázek už je načtený
                img.classList.add('loaded');
            } else {
                // Obrázek se ještě načítá
                img.addEventListener('load', function() {
                    this.classList.add('loaded');
                });
                img.addEventListener('error', function() {
                    // I při chybě přidat třídu, aby se spinner skryl
                    this.classList.add('loaded');
                });
            }
        });
        
        if (preSelectedAdId && !foundPreSelected) {
            console.log('⚠️ Pre-selected ad not found:', preSelectedAdId);
        }
        
    } catch (error) {
        console.error('❌ Chyba při načítání inzerátů:', error);
        const adsList = document.getElementById('adsList');
        adsList.innerHTML = `
            <div class="no-ads-message">
                <div class="no-ads-message-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="no-ads-message-content">
                    <h3 class="no-ads-message-title">Chyba při načítání</h3>
                    <p class="no-ads-message-text">Nepodařilo se načíst vaše inzeráty. Zkuste to prosím znovu.</p>
                    <button class="btn-bulldogo" onclick="location.reload()">
                        <i class="fas fa-refresh"></i>
                        Obnovit stránku
                    </button>
                </div>
            </div>
        `;
    }
}


function selectAd(ad, element) {
    console.log('🎯 Selecting ad:', ad.id, 'title:', ad.title);
    
    // Remove previous selection
    document.querySelectorAll('.ad-card.selectable').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select current ad
    element.classList.add('selected');
    selectedAd = ad;
    
    console.log('✅ Ad selected, showing payment in 500ms');
    
    // Show payment section after a short delay
    setTimeout(() => {
        showPayment();
    }, 500);
}

function showPayment() {
    document.getElementById('adSelection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'block';
    
    // Update payment summary
    updatePaymentSummary();
    
    // Scroll to payment
    document.getElementById('paymentSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function hidePayment() {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('adSelection').style.display = 'block';
    
    // Scroll to ad selection
    document.getElementById('adSelection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function updatePaymentSummary() {
    if (!selectedAd || !selectedPricing) return;
    
    document.getElementById('selectedAdTitle').textContent = selectedAd.title;
    
    let durationText = '';
    if (selectedPricing.duration === 1) {
        durationText = '1 den';
    } else if (selectedPricing.duration === 7) {
        durationText = '1 týden';
    } else if (selectedPricing.duration === 30) {
        durationText = '1 měsíc';
    }
    
    document.getElementById('selectedDuration').textContent = durationText;
    document.getElementById('totalPrice').textContent = selectedPricing.price + ' Kč';
}

// Kontrola balíčku před topováním
async function checkPackageForTop(durationDays) {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) {
            return { valid: false, reason: 'not_logged_in', message: 'Pro topování se musíte přihlásit.' };
        }

        const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
        const { getDoc, doc } = firestoreModule;
        const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
            return { valid: false, reason: 'no_package', message: 'Pro topování inzerátů potřebujete aktivní balíček. Zakupte si balíček a zkuste to znovu.' };
        }

        const profile = profileSnap.data();
        const plan = profile.plan;
        const planPeriodEnd = profile.planPeriodEnd ? (profile.planPeriodEnd.toDate ? profile.planPeriodEnd.toDate() : new Date(profile.planPeriodEnd)) : null;
        const planCancelAt = profile.planCancelAt ? (profile.planCancelAt.toDate ? profile.planCancelAt.toDate() : new Date(profile.planCancelAt)) : null;
        const planDurationDays = profile.planDurationDays || 30; // Výchozí 30 dní

        // Kontrola, jestli má balíček
        if (!plan || plan === 'none') {
            return { valid: false, reason: 'no_package', message: 'Pro topování inzerátů potřebujete aktivní balíček. Zakupte si balíček a zkuste to znovu.' };
        }

        // Kontrola, jestli je balíček aktivní
        if (!planPeriodEnd || new Date() >= planPeriodEnd) {
            return { valid: false, reason: 'package_expired', message: 'Váš balíček vypršel. Pro topování inzerátů si prosím obnovte balíček.' };
        }

        // Pro měsíční topování (30 dní) stačí, když má zapnuté auto-renewal (planCancelAt je null)
        if (durationDays === 30) {
            if (planCancelAt && planCancelAt <= planPeriodEnd) {
                // Zrušení je naplánované a bude dřív nebo ve stejný den jako konec topování
                const topEndDate = new Date();
                topEndDate.setDate(topEndDate.getDate() + 30);
                
                if (planCancelAt < topEndDate) {
                    return { 
                        valid: false, 
                        reason: 'cancellation_before_top_end', 
                        message: `Váš balíček bude zrušen ${planCancelAt.toLocaleDateString('cs-CZ')}, což je dříve než konec topování (${topEndDate.toLocaleDateString('cs-CZ')}). Pro měsíční topování potřebujete aktivní auto-obnovení balíčku. Zrušte zrušení balíčku nebo zkuste kratší dobu topování.` 
                    };
                }
            }
            // Pokud má auto-renewal (planCancelAt je null), je to OK
            return { valid: true };
        }

        // Pro kratší topování (1 den, 7 dní) musí být doba topování kratší než délka trvání balíčku
        const now = new Date();
        const packageRemainingDays = Math.ceil((planPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        
        if (durationDays > packageRemainingDays) {
            return { 
                valid: false, 
                reason: 'top_longer_than_package', 
                message: `Doba topování (${durationDays} ${durationDays === 1 ? 'den' : durationDays < 5 ? 'dny' : 'dní'}) je delší než zbývající doba vašeho balíčku (${packageRemainingDays} ${packageRemainingDays === 1 ? 'den' : packageRemainingDays < 5 ? 'dny' : 'dní'}). Zkuste kratší dobu topování nebo si prodlužte balíček.` 
            };
        }

        // Kontrola, jestli je naplánované zrušení dřív než konec topování
        if (planCancelAt && planCancelAt <= planPeriodEnd) {
            const topEndDate = new Date();
            topEndDate.setDate(topEndDate.getDate() + durationDays);
            
            if (planCancelAt < topEndDate) {
                return { 
                    valid: false, 
                    reason: 'cancellation_before_top_end', 
                    message: `Váš balíček bude zrušen ${planCancelAt.toLocaleDateString('cs-CZ')}, což je dříve než konec topování (${topEndDate.toLocaleDateString('cs-CZ')}). Zrušte zrušení balíčku nebo zkuste kratší dobu topování.` 
                };
            }
        }

        return { valid: true };
    } catch (error) {
        console.error('Chyba při kontrole balíčku:', error);
        return { valid: false, reason: 'error', message: 'Nepodařilo se zkontrolovat balíček. Zkuste to prosím znovu.' };
    }
}

async function processPayment() {
    // Kontrola in-app browseru
    if (typeof window.isInAppBrowser === 'function' && window.isInAppBrowser()) {
        if (typeof window.showInAppBrowserWarning === 'function') {
            window.showInAppBrowserWarning('platba');
        }
        return;
    }
    
    // Kontrola souhlasu s obchodními podmínkami
    const termsCheckbox = document.getElementById('termsCheckbox');
    if (!termsCheckbox || !termsCheckbox.checked) {
        alert("Pro pokračování musíte souhlasit s obchodními podmínkami.");
        if (termsCheckbox) {
            termsCheckbox.focus();
            termsCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    // Kontroly výběrů
    if (!selectedPricing || !selectedAd) {
        alert("Prosím nejdříve vyberte inzerát a délku topování");
        return;
    }
    // Kontrola přihlášení
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    if (!user) {
        alert("Pro pokračování se prosím přihlaste.");
        try { if (typeof window.showAuthModal === 'function') window.showAuthModal('login'); } catch (_) {}
        return;
    }
    
    // Kontrola, jestli už má inzerát aktivní topování
    try {
        const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
        const { getDoc, doc } = firestoreModule;
        const adRef = doc(window.firebaseDb, 'users', user.uid, 'inzeraty', selectedAd.id);
        const adSnap = await getDoc(adRef);
        
        if (adSnap.exists()) {
            const adData = adSnap.data();
            const isTop = adData.isTop === true;
            const topExpiresAt = adData.topExpiresAt;
            
            if (isTop && topExpiresAt) {
                // Zkontrolovat, jestli topování ještě nevypršelo
                const expiresDate = topExpiresAt.toDate ? topExpiresAt.toDate() : new Date(topExpiresAt);
                const now = new Date();
                
                if (expiresDate > now) {
                    // Inzerát má aktivní topování
                    const remainingDays = Math.ceil((expiresDate - now) / (24 * 60 * 60 * 1000));
                    const expiresDateFormatted = expiresDate.toLocaleDateString('cs-CZ', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                    });
                    
                    showTopWarningModal(expiresDateFormatted, remainingDays);
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Chyba při kontrole aktivního topování:', error);
        // Pokračovat dál, pokud kontrola selže (nechceme blokovat platbu kvůli chybě)
    }
    
    // UI: loading - ZOBRAZIT OKAMŽITĚ po rychlých kontrolách
    const payButton = document.getElementById('payButtonTopAds') || document.querySelector('.payment-actions .btn-primary');
    const originalText = payButton ? payButton.innerHTML : null;
    if (payButton) {
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Přesměrovávám...';
        payButton.disabled = true;
    }
    
    // Kontrola balíčku před topováním
    const packageCheck = await checkPackageForTop(selectedPricing.duration);
    if (!packageCheck.valid) {
        const message = packageCheck.message || 'Pro topování inzerátů potřebujete aktivní balíček.';
        showPackageWarningModal(message);
        if (payButton && originalText) {
            payButton.innerHTML = originalText;
            payButton.disabled = false;
        }
        return;
    }
    // Mapování Stripe Price IDs (nahraďte skutečnými ID)
    const STRIPE_PRICE_IDS_TOPAD = {
        oneday: "price_1Sf2971aQBd6ajy2d9lZVHRQ",
        oneweek: "price_1Sf29n1aQBd6ajy20hbq5x6L",
        onemonth: "price_1Sf2AQ1aQBd6ajy2IpqtOstt"
    };
    // Promo kód pro 7denní topování (100% sleva) - "bulldogotop"
    const PROMO_CODE_7DAYS = 'promo_1SlHGn1aQBd6ajy2QHBxTL2u';
    // Pokus o dynamické zjištění priceId z Firestore (funguje v TEST i LIVE módu)
    async function resolveStripePriceIdForTopAd(key) {
        try {
            if (!window.firebaseDb) return null;
            const PRODUCT_NAME_BY_KEY = {
                oneday: 'Topování 1 den',
                oneweek: 'Topování 7 dní',
                onemonth: 'Topování 30 dní'
            };
            const targetName = PRODUCT_NAME_BY_KEY[key];
            if (!targetName) return null;
            const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
            const { getDocs, collection, query, where } = firestoreModule;
            const productsQ = query(
                collection(window.firebaseDb, 'products'),
                where('active', '==', true),
                where('name', '==', targetName)
            );
            const productsSnap = await getDocs(productsQ);
            if (productsSnap.empty) return null;
            const prodDoc = productsSnap.docs[0];
            const pricesSnap = await getDocs(collection(prodDoc.ref, 'prices'));
            // Najdi aktivní one_time cenu
            for (const priceDoc of pricesSnap.docs) {
                const p = priceDoc.data() || {};
                if (p.active && p.type === 'one_time') {
                    return priceDoc.id; // price_...
                }
            }
            return null;
        } catch (_) {
            return null;
        }
    }
    // Převod duration -> klíč
    let topAdKey = null;
    if (selectedPricing.duration === 1) topAdKey = 'oneday';
    else if (selectedPricing.duration === 7) topAdKey = 'oneweek';
    else if (selectedPricing.duration === 30) topAdKey = 'onemonth';
    else {
        alert('Neznámá délka topování: ' + selectedPricing.duration);
        return;
    }
    // 1) Zkusit dynamicky — pokud existují produkty/prices synchronizované z test/live Stripe
    let priceId = await resolveStripePriceIdForTopAd(topAdKey);
    // 2) Fallback na pevně zadané IDs (typicky LIVE)
    if (!priceId) priceId = STRIPE_PRICE_IDS_TOPAD[topAdKey];
    
    if (!priceId) {
        alert("Chybí Stripe cena pro vybranou délku topování.");
        if (payButton && originalText) {
            payButton.innerHTML = originalText;
            payButton.disabled = false;
        }
        return;
    }
    // Uložit pending aktivaci TOP (pro návrat ze Stripe)
    try {
        const pending = {
            adId: selectedAd.id,
            durationDays: selectedPricing.duration,
            startedAt: Date.now()
        };
        sessionStorage.setItem('topad_pending', JSON.stringify(pending));
        // localStorage jako fallback (např. když se návrat otevře v jiném tabu)
        localStorage.setItem('topad_pending', JSON.stringify(pending));
    } catch (_) {}
    // Vytvořit Stripe Checkout Session přes Firebase Extension
    (async () => {
        try {
            const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
            const { addDoc, collection, getDoc } = firestoreModule;
            const successUrl = `${window.location.origin}/top-ads.html?payment=success`;
            const cancelUrl = `${window.location.origin}/top-ads.html?payment=canceled`;
            // Pro 100% slevu použijeme coupon ID "BULLDOGOTOP" nebo promotion_code
            // Podle screenshotů: kupon "BULLDOGOTOP", promotion code "top" (API: promo_1SlGX81aQBd6aj)
            const checkoutData = {
                price: priceId,
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: { adId: selectedAd.id, duration: selectedPricing.duration },
                allow_promotion_codes: true, // Povolit zadání promo kódu (kupónu) v checkoutu
                // Pro 7denní topování automaticky aplikovat promo kód "bulldogotop" (100% sleva)
                ...(topAdKey === 'oneweek' ? {
                    discounts: [{
                        promotion_code: PROMO_CODE_7DAYS // Automaticky aplikovat promo kód pro 7denní topování
                    }]
                } : {}),
                // Automatické faktury - Stripe bude generovat a posílat faktury automaticky
                invoice_creation: {
                    enabled: true, // Povolit automatické vytváření faktur
                    invoice_data: {
                        description: `Topování inzerátu - ${selectedPricing.duration} ${selectedPricing.duration === 1 ? 'den' : selectedPricing.duration === 7 ? 'dní' : 'dní'}`,
                        custom_fields: [
                            {
                                name: 'Typ faktury',
                                value: 'Topování inzerátu'
                            }
                        ]
                    }
                }
            };
            
            const checkoutRef = await addDoc(
                collection(window.firebaseDb, 'customers', user.uid, 'checkout_sessions'),
                checkoutData
            );
            // doplň checkoutSessionId do pending pro případné budoucí dohledání
            try {
                const raw = sessionStorage.getItem('topad_pending') || localStorage.getItem('topad_pending');
                const p = raw ? JSON.parse(raw) : null;
                if (p && !p.checkoutSessionId) {
                    p.checkoutSessionId = checkoutRef.id;
                    sessionStorage.setItem('topad_pending', JSON.stringify(p));
                    localStorage.setItem('topad_pending', JSON.stringify(p));
                }
            } catch (_) {}
            // Čekat na URL bez realtime listeneru (Safari často blokuje Listen/channel)
            const startedAt = Date.now();
            const timeoutMs = 60_000;
            const pollMs = 700;
            const poll = async () => {
                try {
                    const snap = await getDoc(checkoutRef);
                    const data = snap.data() || {};
                    const url = data.url;
                    const error = data.error;
                    if (error) {
                        console.error('Stripe checkout error:', error);
                        alert(`Chyba při vytváření platby: ${error.message || 'zkuste to prosím znovu.'}`);
                        if (payButton && originalText) {
                            payButton.innerHTML = '<i class="fas fa-credit-card"></i> Zaplatit';
                            payButton.disabled = false;
                        }
                        return true;
                    }
                    if (url) {
                        // Text už je změněný na začátku funkce, jen přesměrovat
                        setTimeout(() => {
                            window.location.assign(url);
                        }, 300);
                        return true;
                    }
                } catch (e) {
                    console.error('Stripe checkout poll error:', e);
                }
                return (Date.now() - startedAt) > timeoutMs;
            };
            const t = setInterval(async () => {
                const stop = await poll();
                if (stop) clearInterval(t);
            }, pollMs);
        } catch (error) {
            console.error('❌ Stripe checkout error:', error);
            alert("Nepodařilo se vytvořit platbu. Zkuste to prosím znovu.");
            if (payButton && originalText) {
                payButton.innerHTML = '<i class="fas fa-credit-card"></i> Zaplatit';
                payButton.disabled = false;
            }
        }
    })();
}

function showSuccess() {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'block';
    
    // Scroll to success
    document.getElementById('successSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function resetTopAds() {
    // Reset all selections
    selectedPricing = null;
    selectedAd = null;
    
    // Hide all sections except pricing
    document.getElementById('adSelection').style.display = 'none';
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Clear selections
    document.querySelectorAll('.ad-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auth modal – používej přímo globální implementaci z auth.js (bez stínění názvu)
function callAuthModal(type) {
	if (typeof window.showAuthModal === 'function') {
		window.showAuthModal(type || 'login');
	}
}

// closeAuthModal je definována v auth.js jako window.closeAuthModal
// Nepoužívat lokální funkci, aby se zabránilo rekurzi

// Bezpečnostní guardy – prvky vytváří až auth.js
window.addEventListener('click', function(event) {
    const modal = document.getElementById('authModal');
    if (modal && event.target === modal && typeof window.closeAuthModal === 'function') {
        window.closeAuthModal();
    }
});

const authFormElTop = document.getElementById('authForm');
if (authFormElTop) {
    authFormElTop.addEventListener('submit', function(e) { e.preventDefault(); });
}

const switchBtnElTop = document.querySelector('.auth-switch-btn');
if (switchBtnElTop) {
    switchBtnElTop.addEventListener('click', function() {
        const type = this.getAttribute('data-type');
        callAuthModal(type);
    });
}

// Chat link handling with auth check
document.querySelectorAll('a[href="chat.html"]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        checkAuthForChat();
    });
});

function checkAuthForChat() {
    // Check if user is authenticated
    const currentUser = window.firebaseAuth?.currentUser;
    if (currentUser) {
                // User is logged in, allow access to chat
                window.location.href = 'chat.html';
            } else {
                // User is not logged in, show auth modal
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
        } else if (typeof window.showAuthModal === 'function') {
            window.showAuthModal('login');
    } else {
            // Fallback if auth modal is not available yet
            window.location.href = 'chat.html';
    }
}
}

// Export for global use
window.checkAuthForChat = checkAuthForChat;

// Export for global use
window.checkAuthForChat = checkAuthForChat;

// Zobrazení modalu s upozorněním o balíčku
// Zobrazení modalu pro varování o aktivním topování
function showTopWarningModal(expiresDateFormatted, remainingDays) {
    // Odstranit existující modal, pokud existuje
    const existingModal = document.getElementById('topWarningModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Vytvořit modal
    const modal = document.createElement('div');
    modal.id = 'topWarningModal';
    modal.className = 'modal-top-warning';
    modal.innerHTML = `
        <div class="modal-top-warning-overlay"></div>
        <div class="modal-top-warning-content">
            <div class="modal-top-warning-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2 class="modal-top-warning-title">Tento inzerát má již aktivní topování!</h2>
            <div class="modal-top-warning-message" style="text-align: left;">
                <div style="background: rgba(255, 138, 0, 0.1); padding: 16px; border-radius: 10px; margin-bottom: 16px; border-left: 4px solid #ff8a00;">
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #111827; display: block; margin-bottom: 4px;">Aktuální topování vyprší:</strong>
                        <span style="color: #f77c00; font-weight: 700; font-size: 18px;">${expiresDateFormatted}</span>
                    </div>
                    <div>
                        <strong style="color: #111827; display: block; margin-bottom: 4px;">Zbývá:</strong>
                        <span style="color: #f77c00; font-weight: 700; font-size: 18px;">${remainingDays} ${remainingDays === 1 ? 'den' : remainingDays < 5 ? 'dny' : 'dní'}</span>
                    </div>
                </div>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 12px 0; color: #6b7280; line-height: 1.6;">Pro nákup nového topování musíte nejdřív počkat do konce stávajícího období.</p>
                    <p style="margin: 0; color: #6b7280; line-height: 1.6;">Můžete také zrušit současné topování v sekci "Spravovat topování" a poté zakoupit nové.</p>
                </div>
            </div>
            <div class="modal-top-warning-actions">
                <button class="btn btn-primary" onclick="closeTopWarningModal(); window.location.href='profile-top.html';" style="background: linear-gradient(135deg, #ff8a00 0%, #ff6b35 100%); color: #ffffff; border: none; padding: 12px 24px; font-size: 16px; font-weight: 600; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(255, 138, 0, 0.3); transition: all 0.3s ease; min-width: 180px;">
                    <i class="fas fa-fire"></i> Spravovat topování
                </button>
                <button class="btn btn-secondary" onclick="closeTopWarningModal()" style="background: #f3f4f6; color: #374151; border: none; padding: 12px 24px; font-size: 16px; font-weight: 600; border-radius: 10px; cursor: pointer; transition: all 0.3s ease; min-width: 140px;">
                    Zavřít
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Zobrazit modal s animací
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Zavřít při kliknutí na overlay
    modal.querySelector('.modal-top-warning-overlay').addEventListener('click', closeTopWarningModal);
    
    // Zavřít při stisknutí ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeTopWarningModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Zavření modalu
function closeTopWarningModal() {
    const modal = document.getElementById('topWarningModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Expose functions
window.showTopWarningModal = showTopWarningModal;
window.closeTopWarningModal = closeTopWarningModal;

function showPackageWarningModal(message) {
    // Vytvořit modal, pokud ještě neexistuje
    let modal = document.getElementById('packageWarningModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'packageWarningModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Upozornění</h2>
                    <span class="close" onclick="closePackageWarningModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 1.5rem;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #f77c00; margin-bottom: 1rem;"></i>
                        <p id="packageWarningMessage" style="font-size: 1.1rem; line-height: 1.6; color: #333;"></p>
                    </div>
                    <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="window.location.href='packages.html'" style="padding: 12px 24px; font-size: 1rem; border-radius: 10px;">
                            <i class="fas fa-box"></i> Zobrazit balíčky
                        </button>
                        <button class="btn btn-secondary" onclick="closePackageWarningModal()" style="padding: 12px 24px; font-size: 1rem; background: #6c757d; color: white; border: none; border-radius: 10px; cursor: pointer;">
                            Zavřít
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Zavřít při kliknutí mimo modal
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closePackageWarningModal();
            }
        });
    }
    
    // Nastavit zprávu
    const messageEl = document.getElementById('packageWarningMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }
    
    // Zobrazit modal
    modal.style.display = 'flex';
}

// Zavření modalu
function closePackageWarningModal() {
    const modal = document.getElementById('packageWarningModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Exportovat funkci globálně
window.showPackageWarningModal = showPackageWarningModal;
window.closePackageWarningModal = closePackageWarningModal;
