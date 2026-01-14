// Packages functionality
let selectedPlan = null;
// Zpřístupnit globálně pro GoPay integraci
window.selectedPlan = selectedPlan;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializePackages();
    initializeAuthState();
    setupPackagesUserTypeFilter();
    try { updatePackagesPricingLayout(); } catch (_) {}
    // Po načtení stránky vyčkej na Firebase a načti stav balíčku
    (function waitAndLoadPlan(){
        if (window.firebaseAuth && window.firebaseDb) {
            loadCurrentPlan();
            // Po přihlášení schovej nepovolený balíček podle userType (person/company)
            try { filterPackagesByUserType(); } catch (_) {}
        } else {
            setTimeout(waitAndLoadPlan, 100);
        }
    })();
    // Zpracování návratu ze Stripe Checkout (?payment=success|canceled)
    (function handleStripeReturn(){
        try {
            const params = new URLSearchParams(window.location.search);
            const status = params.get('payment');
            if (!status) return;
            if (status === 'success') {
                // Po návratu ze Stripe: počkej na Auth a pak synchronizuj plán z extension
                (async () => {
                    try {
                        await waitForSignedInUser(15000);
                        await syncPlanFromStripeSubscription({ withRetry: true });
                    } catch (e) {
                        console.warn('Stripe success sync failed:', e);
                    } finally {
                        // Vyčistit URL až po pokusu o sync (kvůli refresh/debug)
                        try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
                        showSuccess();
                        try { loadCurrentPlan(); } catch (_) {}
                    }
                })();
            } else if (status === 'canceled') {
                showMessage("Platba byla zrušena.", "error");
                try { sessionStorage.removeItem('package_pending'); } catch (_) {}
                try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
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

function updatePackagesPricingLayout() {
    const grid = document.querySelector('.pricing-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.pricing-card[data-plan]'));
    const visible = cards.filter((c) => c.style.display !== 'none');
    grid.classList.toggle('single-plan', visible.length === 1);
}

function setPricingButtonsMode(mode) {
    // mode: 'select' | 'manage'
    document.querySelectorAll('.btn-pricing[data-plan]').forEach((btn) => {
        // uložit default HTML jen jednou
        if (!btn.getAttribute('data-default-html')) {
            btn.setAttribute('data-default-html', btn.innerHTML || '');
        }
        if (mode === 'manage') {
            btn.setAttribute('data-manage', '1');
            btn.innerHTML = '<i class="fas fa-cog"></i> Spravovat balíček';
        } else {
            btn.removeAttribute('data-manage');
            // obnovit původní text tlačítka
            const html = btn.getAttribute('data-default-html') || '';
            if (html) btn.innerHTML = html;
        }
    });
}

// Spolehlivé filtrování balíčků až po vyřešení auth state (currentUser != null).
function setupPackagesUserTypeFilter() {
    (async () => {
        try {
            // Počkat na Firebase Auth (max ~15s jako u ostatních částí)
            const startedAt = Date.now();
            while (!window.firebaseAuth && (Date.now() - startedAt) < 15000) {
                await new Promise(r => setTimeout(r, 100));
            }
            if (!window.firebaseAuth) return;

            const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            onAuthStateChanged(window.firebaseAuth, async (user) => {
                if (!user) {
                    // Nepřihlášený: ukaž oba
                    document.querySelectorAll('.pricing-card[data-plan]').forEach((card) => {
                        card.style.display = '';
                    });
                    try { updatePackagesPricingLayout(); } catch (_) {}
                    try { setPricingButtonsMode('select'); } catch (_) {}
                    return;
                }

                // Přihlášený: aplikuj filtr + krátký retry (kvůli pomalému dočtení profilu)
                for (let i = 0; i < 10; i++) {
                    await filterPackagesByUserType();
                    // Pokud se podařilo něco schovat, přestaň
                    const visible = Array.from(document.querySelectorAll('.pricing-card[data-plan]'))
                        .filter((c) => c.style.display !== 'none');
                    if (visible.length <= 1) break;
                    await new Promise(r => setTimeout(r, 200));
                }
                try { updatePackagesPricingLayout(); } catch (_) {}
                // Po přihlášení vždy načti aktuální plán a případně přepni CTA na "Spravovat balíček"
                try { await loadCurrentPlan(); } catch (_) {}
            });
        } catch (e) {
            console.warn('setupPackagesUserTypeFilter failed:', e);
        }
    })();
}

// Počká, než bude k dispozici Firebase Auth + přihlášený user.
async function waitForSignedInUser(timeoutMs = 15000) {
    const startedAt = Date.now();
    // 1) Počkat na window.firebaseAuth
    while (!window.firebaseAuth && (Date.now() - startedAt) < timeoutMs) {
        await new Promise(r => setTimeout(r, 100));
    }
    if (!window.firebaseAuth) throw new Error('Firebase Auth not ready');

    // 2) Počkat na auth state resolution
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    return await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Auth user not available in time')), Math.max(0, timeoutMs - (Date.now() - startedAt)));
        const unsub = onAuthStateChanged(window.firebaseAuth, (u) => {
            if (u) {
                clearTimeout(t);
                try { unsub(); } catch (_) {}
                resolve(u);
            }
        });
    });
}

// Zobrazit uživateli jen "jeho" balíček:
// - person => hobby
// - company => business
function normalizeUserType(value) {
    const t = (value || '').toString().trim().toLowerCase();
    if (t === 'company' || t === 'firma' || t === 'business') return 'company';
    if (t === 'person' || t === 'hobby' || t === 'personal') return 'person';
    return '';
}

async function filterPackagesByUserType() {
    try {
        if (!window.firebaseAuth || !window.firebaseDb) return;
        const user = window.firebaseAuth.currentUser;
        if (!user) return;

        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const rootRef = doc(window.firebaseDb, 'users', user.uid);
        const [profileSnap, rootSnap] = await Promise.all([getDoc(profileRef), getDoc(rootRef)]);
        const profile = profileSnap.exists() ? (profileSnap.data() || {}) : {};
        const root = rootSnap.exists() ? (rootSnap.data() || {}) : {};
        const rawType = profile?.userType || profile?.type || root?.userType || root?.type || '';
        const userType = normalizeUserType(rawType) || 'person'; // person/company

        const allowedPlan = userType === 'company' ? 'business' : 'hobby';

        document.querySelectorAll('.pricing-card[data-plan]').forEach((card) => {
            const plan = card.getAttribute('data-plan');
            card.style.display = (plan === allowedPlan) ? '' : 'none';
        });
        try { updatePackagesPricingLayout(); } catch (_) {}

        // Pokud byl vybraný "jiný" plán, reset
        if (window.selectedPlan && window.selectedPlan.plan && window.selectedPlan.plan !== allowedPlan) {
            try { resetPackages(); } catch (_) {}
        }
    } catch (e) {
        console.warn('filterPackagesByUserType failed:', e);
    }
}

// Sync plánu do users/{uid}/profile/profile podle Stripe subscription (Firebase Extension)
async function syncPlanFromStripeSubscription(options = {}) {
    // Čekej na Firebase
    if (!window.firebaseAuth || !window.firebaseDb) return;
    const user = window.firebaseAuth.currentUser;
    if (!user) return;

    const { collection, query, where, getDocs, setDoc, doc, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // 0) Který plán uživatel kupoval (uloženo před redirectem) – použijeme jako primární mapování
    let pendingPlanId = null;
    try {
        const raw = sessionStorage.getItem('package_pending');
        if (raw) {
            const p = JSON.parse(raw);
            if (p && (p.planId === 'hobby' || p.planId === 'business')) pendingPlanId = p.planId;
        }
    } catch (_) {}

    // Najdi aktivní nebo trial subscription
    const subsQ = () => query(
        collection(window.firebaseDb, 'customers', user.uid, 'subscriptions'),
        where('status', 'in', ['trialing', 'active'])
    );

    let subsSnap = await getDocs(subsQ());
    if (subsSnap.empty && options.withRetry) {
        // Stripe webhook může zapsat subscription až po chvíli – zkus to chvíli pollovat
        const startedAt = Date.now();
        const timeoutMs = 60_000;
        const pollMs = 1200;
        while (subsSnap.empty && (Date.now() - startedAt) < timeoutMs) {
            await new Promise(r => setTimeout(r, pollMs));
            subsSnap = await getDocs(subsQ());
        }
    }

    // 1) Pokud subscription ještě není, aspoň okamžitě nastav badge podle pending plánu
    if (subsSnap.empty) {
        if (pendingPlanId) {
            const now = new Date();
            const estEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            await setDoc(
                doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
                {
                    plan: pendingPlanId,
                    planName: pendingPlanId === 'business' ? 'Firma' : 'Hobby uživatel',
                    planUpdatedAt: now,
                    planPeriodStart: now,
                    planPeriodEnd: estEnd,
                    planDurationDays: 30,
                    planCancelAt: null,
                    planSource: 'stripe-pending'
                },
                { merge: true }
            );
            try { localStorage.setItem('bdg_plan', pendingPlanId); } catch (_) {}
        }
        console.warn('No active/trialing subscription found yet for user', user.uid);
        return;
    }

    // Vezmi nejnovější (když je jich víc, vyber podle created/current_period_end)
    const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    subs.sort((a, b) => {
        const aT = (a.current_period_end?.seconds || a.created?.seconds || 0);
        const bT = (b.current_period_end?.seconds || b.created?.seconds || 0);
        return bT - aT;
    });
    const sub = subs[0];

    // Zjisti priceId ze subscription (extension dává buď price, nebo items/prices)
    const getFirstPriceId = (s) => {
        if (typeof s.price === 'string') return s.price;
        if (s.price?.id) return s.price.id;
        const item0 = Array.isArray(s.items) ? s.items[0] : null;
        if (item0?.price) {
            if (typeof item0.price === 'string') return item0.price;
            if (item0.price.id) return item0.price.id;
        }
        if (Array.isArray(s.prices) && s.prices[0]) return s.prices[0];
        return null;
    };
    const subPriceId = getFirstPriceId(sub);

    let planId = null;
    // Primárně použij pending (nejspolehlivější)
    if (pendingPlanId) planId = pendingPlanId;

    // Fallback: podle názvu produktu v sub (pokud je tam)
    if (!planId) {
        const name = (sub?.product?.name || sub?.items?.[0]?.price?.product?.name || '').toString().toLowerCase();
        if (name.includes('hobby')) planId = 'hobby';
        if (name.includes('firma')) planId = 'business';
    }
    if (!planId) {
        console.warn('Unable to map subscription to plan. subPriceId=', subPriceId);
        return;
    }

    const planName = planId === 'business' ? 'Firma' : 'Hobby uživatel';
    const now = new Date();
    // Stripe timestamps bývají v sekundách
    const cps = sub.current_period_start?.seconds ? new Date(sub.current_period_start.seconds * 1000) : now;
    const cpe = sub.current_period_end?.seconds ? new Date(sub.current_period_end.seconds * 1000) : null;

    await setDoc(
        doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
        {
            plan: planId,
            planName,
            planUpdatedAt: now,
            planPeriodStart: cps,
            planPeriodEnd: cpe || null,
            planDurationDays: cpe ? Math.max(1, Math.round((cpe.getTime() - cps.getTime()) / (24 * 60 * 60 * 1000))) : null,
            planCancelAt: null
        },
        { merge: true }
    );

    // cache + badge
    try { localStorage.setItem('bdg_plan', planId); } catch (_) {}
    try {
        if (typeof window.applySidebarBadge === 'function') window.applySidebarBadge(planId);
    } catch (_) {}
    try { sessionStorage.removeItem('package_pending'); } catch (_) {}
}

function initializePackages() {
    console.log('🚀 Initializing packages');
    
    // Add event listeners to pricing buttons
    document.querySelectorAll('.btn-pricing').forEach(button => {
        button.addEventListener('click', function() {
            // Pokud má uživatel aktivní balíček, jdi na správu balíčku
            if (this.getAttribute('data-manage') === '1') {
                window.location.href = 'profile-plan.html';
                return;
            }
            const plan = this.getAttribute('data-plan');
            const price = this.getAttribute('data-price');
            selectPlan(plan, price);
        });
    });
}

function selectPlan(plan, price) {
    selectedPlan = {
        plan: plan,
        price: parseInt(price)
    };
    // Zpřístupnit globálně pro GoPay integraci
    window.selectedPlan = selectedPlan;

    console.log('📦 Selected plan:', plan, 'Price:', price);

    // Show payment section
    showPayment();
}

function showPayment() {
    document.getElementById('paymentSection').style.display = 'block';
    document.querySelector('.top-ads-pricing').style.display = 'none';
    
    // Update payment summary
    updatePaymentSummary();
    
    // Scroll to payment
    document.getElementById('paymentSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function hidePayment() {
    document.getElementById('paymentSection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Scroll to pricing
    document.querySelector('.top-ads-pricing').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

function updatePaymentSummary() {
    if (!selectedPlan) return;
    
    // Stripe (Firebase Extension) – zobrazení informací bez GoPay konfigurace
    let planTitle = '';
    let planType = '';
    let price = 0;
        switch(selectedPlan.plan) {
            case 'hobby':
                planTitle = 'Hobby uživatel';
                planType = 'První měsíc zdarma, poté 49 Kč/měsíc';
                price = 49;
                break;
            case 'business':
                planTitle = 'Firma';
                planType = 'Měsíční předplatné';
                price = 149;
                break;
    }
    
    document.getElementById('selectedPlanTitle').textContent = planTitle;
    document.getElementById('selectedPlanType').textContent = planType;
    
    if (selectedPlan.plan === 'hobby' && selectedPlan.price === 0) {
        document.getElementById('totalPrice').textContent = 'První měsíc zdarma';
    } else {
        document.getElementById('totalPrice').textContent = price + ' Kč/měsíc';
    }
}

// Zkontrolovat, zda uživatel už někdy měl trial subscription
async function hasUserUsedTrial(userId) {
    try {
        if (!window.firebaseDb || !userId) return false;
        
        const { collection, query, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Zkontrolovat všechny subscriptions uživatele (včetně těch, které už skončily)
        const subsRef = collection(window.firebaseDb, 'customers', userId, 'subscriptions');
        const subsSnap = await getDocs(subsRef);
        
        if (subsSnap.empty) return false;
        
        // Projít všechny subscriptions a zkontrolovat, zda některá měla trial
        for (const subDoc of subsSnap.docs) {
            const subData = subDoc.data() || {};
            
            // Kontrola 1: Status je "trialing" (i když už skončil, znamená to, že trial měl)
            if (subData.status === 'trialing') {
                return true;
            }
            
            // Kontrola 2: Subscription má trial_period_start nebo trial_period_end
            // To znamená, že trial byl aktivován
            if (subData.trial_start || subData.trial_end) {
                return true;
            }
            
            // Kontrola 3: Subscription má trial_start nebo trial_end v items
            if (subData.items && Array.isArray(subData.items)) {
                for (const item of subData.items) {
                    if (item.trial_start || item.trial_end) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('❌ Error checking trial history:', error);
        // V případě chyby raději vrátit false, aby se trial nenastavil
        // (bezpečnější varianta - raději žádný trial než opakovaný trial)
        return true; // Považujeme za "už použil", aby se trial nenastavil
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
        showMessage("Pro pokračování musíte souhlasit s obchodními podmínkami.", "error");
        if (termsCheckbox) {
            termsCheckbox.focus();
            termsCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    // Kontrola výběru plánu
    if (!window.selectedPlan || !window.selectedPlan.plan) {
        showMessage("Prosím nejdříve vyberte balíček", "error");
        return;
    }
    // Kontrola přihlášení
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    if (!user) {
        showMessage("Pro pokračování se prosím přihlaste.", "error");
        try { if (typeof window.showAuthModal === 'function') window.showAuthModal('login'); } catch (_) {}
        return;
    }
    
    // UI: loading - ZOBRAZIT OKAMŽITĚ po rychlých kontrolách
    const payButton = document.getElementById('payButtonPackages') || document.querySelector('.payment-actions .btn-primary');
    const originalText = payButton ? payButton.innerHTML : null;
    if (payButton) {
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Přesměrovávám...';
        payButton.disabled = true;
    }
    // Mapování Stripe Price IDs (nahraďte skutečnými ID z Stripe)
    const STRIPE_PRICE_IDS = {
        hobby: "price_1Sf26X1aQBd6ajy2BPS7ioTv",
        business: "price_1Sf26s1aQBd6ajy2a5mNNLst"
    };
    // Pokus o dynamické zjištění priceId z Firestore (funguje v TEST i LIVE módu)
    async function resolveStripePriceIdForPlan(plan) {
        try {
            if (!window.firebaseDb) return null;
            const PRODUCT_NAME_BY_PLAN = {
                hobby: 'Hobby balíček',
                business: 'Firma balíček'
            };
            const targetName = PRODUCT_NAME_BY_PLAN[plan];
            if (!targetName) return null;
            const { getDocs, collection, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const productsQ = query(
                collection(window.firebaseDb, 'products'),
                where('active', '==', true),
                where('name', '==', targetName)
            );
            const productsSnap = await getDocs(productsQ);
            if (productsSnap.empty) return null;
            const prodDoc = productsSnap.docs[0];
            const pricesSnap = await getDocs(collection(prodDoc.ref, 'prices'));
            // Najdi aktivní recurring cenu
            for (const priceDoc of pricesSnap.docs) {
                const p = priceDoc.data() || {};
                if (p.active && p.type === 'recurring') {
                    return priceDoc.id; // price_...
                }
            }
            return null;
        } catch (_) {
            return null;
        }
    }
    const planId = window.selectedPlan.plan;
    // 1) Zkusit dynamicky — pokud existují produkty/prices synchronizované z test/live Stripe
    let priceId = await resolveStripePriceIdForPlan(planId);
    // 2) Fallback na pevně zadané IDs (typicky LIVE)
    if (!priceId) priceId = STRIPE_PRICE_IDS[planId];
    if (!priceId) {
        showMessage("Chybí Stripe cena pro vybraný balíček.", "error");
        if (payButton && originalText) {
            payButton.innerHTML = originalText;
            payButton.disabled = false;
        }
        return;
    }
    // Uložit pending plán (pro návrat ze Stripe – mapování + okamžitý badge)
    try {
        sessionStorage.setItem('package_pending', JSON.stringify({ planId, startedAt: Date.now() }));
    } catch (_) {}
    try {
        const { addDoc, collection, getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const successUrl = `${window.location.origin}/packages.html?payment=success`;
        const cancelUrl = `${window.location.origin}/packages.html?payment=canceled`;
        // Připravit data pro Checkout Session – Stripe (Firebase Extension)
        const sessionData = {
            price: priceId,
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true, // Povolit zadání promo kódu (kupónu) v checkoutu
            // Automatické faktury - Stripe bude generovat a posílat faktury automaticky
            invoice_creation: {
                enabled: true, // Povolit automatické vytváření faktur
                invoice_data: {
                    description: planId === 'business' ? 'Měsíční předplatné - Firma' : 'Měsíční předplatné - Hobby uživatel',
                    // Memo se zobrazí na faktuře - Stripe automaticky použije pro trial faktury (0 Kč)
                    // Pro běžné faktury použije standardní popis
                    custom_fields: [
                        {
                            name: 'Typ faktury',
                            value: 'Předplatné'
                        }
                    ]
                }
            }
        };
        // Podpora pro URL parametr ?promo=KOD (předvyplní promo kód)
        const urlParams = new URLSearchParams(window.location.search);
        const promoCode = urlParams.get('promo') || urlParams.get('coupon');
        if (promoCode) {
            console.log('💳 Promo kód detekován v URL:', promoCode, '(uživatel ho zadá ve Stripe checkoutu)');
        }
        
        // Vytvořit Checkout Session přes Cloud Function (backend kontrola trial historie)
        // Získat Firebase project ID z konfigurace
        let projectId = 'inzerio-inzerce'; // fallback
        if (window.firebaseApp && window.firebaseApp.options && window.firebaseApp.options.projectId) {
            projectId = window.firebaseApp.options.projectId;
        }
        
        // Získat auth token pro autentizaci
        let authToken = null;
        if (user && typeof user.getIdToken === 'function') {
            try {
                authToken = await user.getIdToken();
            } catch (tokenError) {
                console.warn('Could not get auth token:', tokenError);
            }
        }
        
        // Zavolat Cloud Function pro vytvoření checkout session
        const functionsUrl = `https://europe-west1-${projectId}.cloudfunctions.net/createCheckoutSession`;
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (authToken && typeof authToken === 'string' && authToken.trim().length > 0) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const functionResponse = await fetch(functionsUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                priceId: priceId,
                planId: planId,
                successUrl: successUrl,
                cancelUrl: cancelUrl,
                uid: user.uid
            })
        });
        
        if (!functionResponse.ok) {
            const errorData = await functionResponse.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP error! status: ${functionResponse.status}`);
        }
        
        const functionData = await functionResponse.json();
        
        if (functionData.error) {
            console.error('Cloud Function error:', functionData.error);
            showMessage(`Chyba při vytváření platby: ${functionData.error}`, "error");
            if (payButton && originalText) {
                payButton.innerHTML = originalText;
                payButton.disabled = false;
            }
            return;
        }
        
        // Cloud Function vytvořila checkout session dokument, teď musíme počkat na URL
        const checkoutSessionId = functionData.checkoutSessionId;
        if (!checkoutSessionId) {
            throw new Error('Cloud Function nevrátila checkoutSessionId');
        }
        
        // Reference na checkout session dokument
        const checkoutRef = doc(window.firebaseDb, 'customers', user.uid, 'checkout_sessions', checkoutSessionId);
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
                    showMessage(`Chyba při vytváření platby: ${error.message || 'zkuste to prosím znovu.'}`, "error");
                    if (payButton && originalText) {
                        payButton.innerHTML = originalText;
                        payButton.disabled = false;
                    }
                    return true; // stop
                }
                if (url) {
                    // Text už je změněný na začátku funkce, jen přesměrovat
                    setTimeout(() => {
                    window.location.assign(url);
                    }, 300);
                    return true; // stop
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
        showMessage("Nepodařilo se vytvořit platbu. Zkuste to prosím znovu.", "error");
        if (payButton && originalText) {
            payButton.innerHTML = originalText;
            payButton.disabled = false;
        }
    }
}

async function showSuccess() {
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'block';
    
    // Scroll to success
    document.getElementById('successSection').scrollIntoView({ 
        behavior: 'smooth' 
    });

    // Zapsat plán do Firestore profilu uživatele (users/{uid}/profile/profile) - zdroj pravdy
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (user && window.firebaseDb && selectedPlan && selectedPlan.plan) {
            const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const now = new Date();
            const durationDays = 30; // měsíční předplatné
            const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            
            console.log('💾 Ukládám balíček do databáze:', selectedPlan.plan);
            await setDoc(
                doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
                { plan: selectedPlan.plan, planUpdatedAt: now, planPeriodStart: now, planPeriodEnd: periodEnd, planDurationDays: durationDays, planCancelAt: null },
                { merge: true }
            );
            console.log('✅ Balíček úspěšně uložen do databáze');
            
            // Volitelně synchronizovat do localStorage pouze pro zobrazení odznaku (cache)
            try {
                localStorage.setItem('bdg_plan', selectedPlan.plan);
            } catch (_) {}
        }
    } catch (e) {
        console.error('❌ Uložení plánu do Firestore selhalo:', e);
        showMessage('Nepodařilo se uložit balíček. Zkuste to prosím znovu.', 'error');
    }
}

function resetPackages() {
    // Reset all selections
    selectedPlan = null;
    window.selectedPlan = null;
    
    // Hide all sections except pricing
    document.getElementById('paymentSection').style.display = 'none';
    document.getElementById('successSection').style.display = 'none';
    document.querySelector('.top-ads-pricing').style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Ruční aktualizace odznaku po aktivaci balíčku (pro případ, že UI neodchytí změnu okamžitě)
async function refreshBadge() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user) { showAuthModal('login'); return; }
        if (!window.firebaseDb) return;
        
        // Kontrola balíčku přímo z databáze (použít globální funkci pokud existuje)
        let plan = null;
        if (typeof window.checkUserPlanFromDatabase === 'function') {
            plan = await window.checkUserPlanFromDatabase(user.uid);
        } else {
            // Fallback: načíst přímo z databáze
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                plan = data.plan || null;
                // Kontrola, zda je balíček aktivní
                if (plan) {
                    const planPeriodEnd = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
                    if (planPeriodEnd && new Date() >= planPeriodEnd) {
                        plan = null;
                    }
                }
            }
        }
        
        // Volitelně synchronizovat do localStorage pro cache (zobrazení odznaku)
        if (plan) {
            try { localStorage.setItem('bdg_plan', plan); } catch (_) {}
        } else {
            try { localStorage.removeItem('bdg_plan'); } catch (_) {}
        }
        
        // Vložit/aktualizovat odznak v tlačítku Profil
        const userProfileSection = document.getElementById('userProfileSection');
        const btnProfile = userProfileSection && userProfileSection.querySelector('.btn-profile');
        if (btnProfile) {
            const old = btnProfile.querySelector('.user-badge');
            if (old) old.remove();
            const badge = document.createElement('span');
            const label = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : '?';
            const cls = plan === 'business' ? 'badge-business' : plan === 'hobby' ? 'badge-hobby' : 'badge-unknown';
            badge.className = 'user-badge ' + cls;
            badge.textContent = label;
            btnProfile.appendChild(badge);
        }
        // krátká zpráva
        alert('Odznak aktualizován' + (plan ? `: ${plan}` : ''));
    } catch (e) {
        console.error('❌ refreshBadge:', e);
        alert('Nepodařilo se aktualizovat odznak');
    }
}

// Načíst aktuální balíček a aktualizovat manage UI
async function loadCurrentPlan() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        const pPlan = document.getElementById('currentPlan');
        const pEnd = document.getElementById('currentPlanEnd');
        const pCancel = document.getElementById('currentPlanCancelAt');
        const cancelInfo = document.getElementById('cancelInfo');
        const btnCancel = document.getElementById('btnCancelPlan');
        const btnUndo = document.getElementById('btnUndoCancel');
        // Pozn.: packages.html nemusí mít sekci "aktuální balíček", ale i tak potřebujeme načíst plán
        // kvůli přepnutí CTA na "Spravovat balíček".
        if (!user || !window.firebaseDb) return;
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const snap = await getDoc(ref);
        let plan = 'none', planPeriodEnd = null, planCancelAt = null;
        if (snap.exists()) {
            const data = snap.data();
            plan = data.plan || 'none';
            planPeriodEnd = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
            planCancelAt = data.planCancelAt ? (data.planCancelAt.toDate ? data.planCancelAt.toDate() : new Date(data.planCancelAt)) : null;
        }
        // Aktivní plán = existuje a ještě nevypršel
        const isActivePlan = plan && plan !== 'none' && (!planPeriodEnd || (new Date() < planPeriodEnd));
        // Pokud je na stránce sekce s aktuálním plánem, vyplnit ji (jinak přeskočit)
        if (pPlan) {
            const planLabel = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : 'Žádný';
            pPlan.textContent = planLabel;
            if (pEnd) pEnd.textContent = planPeriodEnd ? planPeriodEnd.toLocaleDateString('cs-CZ') : '-';
            if (cancelInfo) {
                if (planCancelAt) {
                    cancelInfo.style.display = '';
                    if (pCancel) pCancel.textContent = planCancelAt.toLocaleDateString('cs-CZ');
                    if (btnCancel) btnCancel.style.display = 'none';
                    if (btnUndo) btnUndo.style.display = '';
                } else {
                    cancelInfo.style.display = 'none';
                    if (btnCancel) btnCancel.style.display = plan === 'none' ? 'none' : '';
                    if (btnUndo) btnUndo.style.display = 'none';
                }
            }
        }

        // Přepnout CTA podle aktivního plánu
        try { setPricingButtonsMode(isActivePlan ? 'manage' : 'select'); } catch (_) {}
    } catch (e) {
        console.error('❌ loadCurrentPlan:', e);
    }
}

// Naplánovat zrušení k datu konce období
async function cancelPlan() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) return;
        const { getDoc, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const end = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
        if (!end) { alert('Nelze určit konec období.'); return; }
        await setDoc(ref, { planCancelAt: end }, { merge: true });
        alert('Zrušení balíčku naplánováno k: ' + end.toLocaleDateString('cs-CZ'));
        loadCurrentPlan();
    } catch (e) {
        console.error('❌ cancelPlan:', e);
        alert('Nepodařilo se naplánovat zrušení');
    }
}

// Zrušit naplánované zrušení
async function undoCancel() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) return;
        const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        await setDoc(ref, { planCancelAt: null }, { merge: true });
        alert('Zrušení bylo odebráno');
        loadCurrentPlan();
    } catch (e) {
        console.error('❌ undoCancel:', e);
        alert('Nepodařilo se zrušit naplánované zrušení');
    }
}

// Auth modal – používej přímo globální implementaci z auth.js (bez stínění názvu)
function callAuthModal(type) {
	if (typeof window.showAuthModal === 'function') {
		window.showAuthModal(type || 'login');
	}
}

// closeAuthModal je definována v auth.js jako window.closeAuthModal
// Nepoužívat lokální funkci, aby se zabránilo rekurzi

// Bezpečnostní guardy – tyto prvky vytváří až auth.js
window.addEventListener('click', function(event) {
    const modal = document.getElementById('authModal');
    if (modal && event.target === modal && typeof window.closeAuthModal === 'function') {
        window.closeAuthModal();
    }
});

const authFormEl = document.getElementById('authForm');
if (authFormEl) {
    authFormEl.addEventListener('submit', function(e) { e.preventDefault(); });
}

const switchBtnEl = document.querySelector('.auth-switch-btn');
if (switchBtnEl) {
    switchBtnEl.addEventListener('click', function() {
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
