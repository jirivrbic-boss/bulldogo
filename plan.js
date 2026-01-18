// Plan management functionality for profile-plan.html

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    initializeAuthState();
    // Načíst informace o předplatném při načtení stránky
    loadCurrentPlan();
    
    // Poslouchat změny v auth stavu
    if (window.firebaseAuth) {
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
            onAuthStateChanged(window.firebaseAuth, (user) => {
                if (user) {
                    loadCurrentPlan();
                }
            });
        });
    }
});

// Načíst aktuální balíček a aktualizovat UI
async function loadCurrentPlan() {
    try {
        // Použít globální helper funkci pro spolehlivé získání currentUser
        const user = await (window.waitForCurrentUser || (async () => window.firebaseAuth?.currentUser || null))(5000);
        if (!user || !window.firebaseDb) {
            console.warn('⚠️ Nelze načíst plán: chybí user nebo db');
            return;
        }
        
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const snap = await getDoc(ref);
        
        let plan = 'none';
        let planPeriodEnd = null;
        let planPeriodStart = null;
        let planDurationDays = null;
        let planCancelAt = null;
        
        if (snap.exists()) {
            const data = snap.data();
            plan = data.plan || 'none';
            
            // Správný převod Firestore Timestamp na Date
            if (data.planPeriodEnd) {
                if (data.planPeriodEnd.toDate && typeof data.planPeriodEnd.toDate === 'function') {
                    planPeriodEnd = data.planPeriodEnd.toDate();
                } else if (data.planPeriodEnd.seconds) {
                    planPeriodEnd = new Date(data.planPeriodEnd.seconds * 1000);
                } else if (data.planPeriodEnd instanceof Date) {
                    planPeriodEnd = data.planPeriodEnd;
                } else {
                    planPeriodEnd = new Date(data.planPeriodEnd);
                }
            }
            
            if (data.planPeriodStart) {
                if (data.planPeriodStart.toDate && typeof data.planPeriodStart.toDate === 'function') {
                    planPeriodStart = data.planPeriodStart.toDate();
                } else if (data.planPeriodStart.seconds) {
                    planPeriodStart = new Date(data.planPeriodStart.seconds * 1000);
                } else if (data.planPeriodStart instanceof Date) {
                    planPeriodStart = data.planPeriodStart;
                } else {
                    planPeriodStart = new Date(data.planPeriodStart);
                }
            }
            
            planDurationDays = data.planDurationDays || null;
            
            if (data.planCancelAt) {
                if (data.planCancelAt.toDate && typeof data.planCancelAt.toDate === 'function') {
                    planCancelAt = data.planCancelAt.toDate();
                } else if (data.planCancelAt.seconds) {
                    planCancelAt = new Date(data.planCancelAt.seconds * 1000);
                } else if (data.planCancelAt instanceof Date) {
                    planCancelAt = data.planCancelAt;
                } else {
                    planCancelAt = new Date(data.planCancelAt);
                }
            }
        }
        
        // Aktualizovat UI
        updatePlanUI(plan, planPeriodEnd, planPeriodStart, planDurationDays, planCancelAt);
        
        // Aktualizovat statistiky
        updatePlanStats(plan, planPeriodEnd);
        
    } catch (e) {
        console.error('❌ loadCurrentPlan:', e);
        showError('Nepodařilo se načíst informace o předplatném');
    }
}

// Aktualizovat UI s informacemi o plánu
function updatePlanUI(plan, planPeriodEnd, planPeriodStart, planDurationDays, planCancelAt) {
    const pPlan = document.getElementById('currentPlan');
    const pEnd = document.getElementById('currentPlanEnd');
    const pDuration = document.getElementById('currentPlanDuration');
    const pRemaining = document.getElementById('currentPlanRemaining');
    const cancelInfo = document.getElementById('cancelInfo');
    const pCancel = document.getElementById('currentPlanCancelAt');
    
    // Aktuální balíček
    if (pPlan) {
        const planLabel = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : 'Žádný';
        pPlan.textContent = planLabel;
    }
    
    // Platné do
    if (pEnd) {
        pEnd.textContent = planPeriodEnd ? planPeriodEnd.toLocaleDateString('cs-CZ') : '-';
    }
    
    // Délka období
    if (pDuration) {
        if (planDurationDays) {
            pDuration.textContent = `${planDurationDays} dní`;
        } else if (planPeriodStart && planPeriodEnd) {
            const days = Math.ceil((planPeriodEnd.getTime() - planPeriodStart.getTime()) / (24 * 60 * 60 * 1000));
            pDuration.textContent = `${days} dní`;
        } else {
            pDuration.textContent = '-';
        }
    }
    
    // Zbývá - správný výpočet celých dní
    if (pRemaining) {
        if (planPeriodEnd) {
            const now = new Date();
            // Nastavit čas na půlnoc pro správný výpočet dní
            const endDate = new Date(planPeriodEnd);
            endDate.setHours(23, 59, 59, 999); // Konec dne
            const today = new Date(now);
            today.setHours(0, 0, 0, 0); // Začátek dne
            
            // Vypočítat rozdíl v milisekundách a převést na dny
            const diffMs = endDate.getTime() - today.getTime();
            const remainingDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
            
            console.log('📅 Výpočet zbývajících dní:', {
                planPeriodEnd: planPeriodEnd,
                endDate: endDate,
                today: today,
                diffMs: diffMs,
                remainingDays: remainingDays
            });
            
            if (remainingDays > 0) {
                pRemaining.textContent = `${remainingDays} ${remainingDays === 1 ? 'den' : remainingDays < 5 ? 'dny' : 'dní'}`;
            } else if (remainingDays === 0) {
                // Pokud je to dnes, zkontrolovat, zda ještě nevypršelo
                const endOfToday = new Date(today);
                endOfToday.setHours(23, 59, 59, 999);
                if (now.getTime() <= endOfToday.getTime()) {
                    pRemaining.textContent = 'Dnes končí';
                } else {
                    pRemaining.textContent = 'Vypršelo';
                }
            } else {
                pRemaining.textContent = 'Vypršelo';
            }
        } else {
            pRemaining.textContent = '-';
        }
    }
    
    // Informace o zrušení
    if (cancelInfo) {
        if (planCancelAt) {
            cancelInfo.style.display = '';
            if (pCancel) {
                pCancel.textContent = planCancelAt.toLocaleDateString('cs-CZ');
            }
        } else {
            cancelInfo.style.display = 'none';
        }
    }
}

// Aktualizovat statistiky
function updatePlanStats(plan, planPeriodEnd) {
    const currentPlanBadge = document.getElementById('currentPlanBadge');
    const currentPlanDays = document.getElementById('currentPlanDays');
    
    if (currentPlanBadge) {
        const planLabel = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : 'Žádný';
        currentPlanBadge.textContent = planLabel;
    }
    
    if (currentPlanDays) {
        if (planPeriodEnd) {
            const now = new Date();
            const remaining = Math.ceil((planPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            if (remaining > 0) {
                currentPlanDays.textContent = remaining;
            } else {
                currentPlanDays.textContent = '0';
            }
        } else {
            currentPlanDays.textContent = '-';
        }
    }
}

// Aktualizovat odznak podle aktuálního předplatného
async function refreshBadge() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user) {
            if (typeof showAuthModal === 'function') {
                showAuthModal('login');
            }
            return;
        }
        if (!window.firebaseDb) {
            showError('Databáze není dostupná');
            return;
        }
        
        // Načíst aktuální plán z databáze
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const snap = await getDoc(ref);
        
        let plan = null;
        if (snap.exists()) {
            const data = snap.data();
            plan = data.plan || null;
            
            // Kontrola, zda je balíček aktivní
            if (plan && plan !== 'none') {
                const planPeriodEnd = data.planPeriodEnd ? (data.planPeriodEnd.toDate ? data.planPeriodEnd.toDate() : new Date(data.planPeriodEnd)) : null;
                if (planPeriodEnd && new Date() >= planPeriodEnd) {
                    // Balíček vypršel - odebrat
                    plan = null;
                }
            } else {
                plan = null;
            }
        }
        
        // Aktualizovat cache
        if (plan) {
            try { localStorage.setItem('bdg_plan', plan); } catch (_) {}
        } else {
            try { localStorage.removeItem('bdg_plan'); } catch (_) {}
        }
        
        // Aktualizovat odznak v sidebaru
        if (typeof window.applySidebarBadge === 'function') {
            window.applySidebarBadge(plan);
        } else {
            // Fallback: aktualizovat přímo v sidebaru
            const userProfileSection = document.getElementById('userProfileSection');
            const btnProfile = userProfileSection && userProfileSection.querySelector('.btn-profile');
            if (btnProfile) {
                const old = btnProfile.querySelector('.user-badge');
                if (old) old.remove();
                if (plan) {
                    const badge = document.createElement('span');
                    const label = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : '?';
                    const cls = plan === 'business' ? 'badge-business' : plan === 'hobby' ? 'badge-hobby' : 'badge-unknown';
                    badge.className = 'user-badge ' + cls;
                    badge.textContent = label;
                    btnProfile.appendChild(badge);
                }
            }
        }
        
        showSuccess('Odznak aktualizován' + (plan ? `: ${plan === 'business' ? 'Firma' : 'Hobby'}` : ' (odebrán)'));
        
        // Znovu načíst informace o plánu
        loadCurrentPlan();
        
    } catch (e) {
        console.error('❌ refreshBadge:', e);
        showError('Nepodařilo se aktualizovat odznak');
    }
}

// Aktualizovat údaje o předplatném
async function updatePlanInfo() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user) {
            if (typeof showAuthModal === 'function') {
                showAuthModal('login');
            }
            return;
        }
        if (!window.firebaseDb) {
            showError('Databáze není dostupná');
            return;
        }
        
        // Zobrazit loading
        const btn = event?.target || document.querySelector('button[onclick="updatePlanInfo()"]');
        const originalText = btn ? btn.innerHTML : null;
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aktualizuji...';
            btn.disabled = true;
        }
        
        // Synchronizovat z Stripe subscription
        if (typeof syncPlanFromStripeSubscription === 'function') {
            await syncPlanFromStripeSubscription({ withRetry: true });
        } else {
            // Fallback: načíst přímo z subscriptions
            const { collection, query, where, getDocs, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const subsRef = collection(window.firebaseDb, 'customers', user.uid, 'subscriptions');
            const subsQuery = query(subsRef, where('status', 'in', ['trialing', 'active']));
            const subsSnap = await getDocs(subsQuery);
            
            if (!subsSnap.empty) {
                const sub = subsSnap.docs[0].data();
                const now = new Date();
                const cps = sub.current_period_start?.seconds ? new Date(sub.current_period_start.seconds * 1000) : now;
                const cpe = sub.current_period_end?.seconds ? new Date(sub.current_period_end.seconds * 1000) : null;
                
                // Určit typ plánu podle produktu
                const name = (sub?.product?.name || sub?.items?.[0]?.price?.product?.name || '').toString().toLowerCase();
                let planId = null;
                if (name.includes('hobby')) planId = 'hobby';
                if (name.includes('firma')) planId = 'business';
                
                if (planId) {
                    const planName = planId === 'business' ? 'Firma' : 'Hobby uživatel';
                    await setDoc(
                        doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
                        {
                            plan: planId,
                            planName,
                            planUpdatedAt: now,
                            planPeriodStart: cps,
                            planPeriodEnd: cpe || null,
                            planDurationDays: cpe ? Math.max(1, Math.round((cpe.getTime() - cps.getTime()) / (24 * 60 * 60 * 1000))) : null,
                        },
                        { merge: true }
                    );
                }
            } else {
                // Žádná aktivní subscription - odebrat plán
                await setDoc(
                    doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'),
                    {
                        plan: 'none',
                        planPeriodEnd: null,
                        planPeriodStart: null,
                        planDurationDays: null,
                    },
                    { merge: true }
                );
            }
        }
        
        // Znovu načíst informace
        await loadCurrentPlan();
        
        // Obnovit tlačítko
        if (btn && originalText) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        
        showSuccess('Údaje o předplatném aktualizovány');
        
    } catch (e) {
        console.error('❌ updatePlanInfo:', e);
        showError('Nepodařilo se aktualizovat údaje');
        
        // Obnovit tlačítko
        const btn = event?.target || document.querySelector('button[onclick="updatePlanInfo()"]');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-rotate"></i> Aktualizovat údaje';
            btn.disabled = false;
        }
    }
}

// Otevřít Stripe Customer Portal pro správu předplatného
async function openStripeCustomerPortal() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user) {
            if (typeof showAuthModal === 'function') {
                showAuthModal('login');
            }
            return;
        }
        if (!window.firebaseDb) {
            showError('Databáze není dostupná');
            return;
        }
        
        // Zobrazit animaci přesměrování
        showRedirectAnimation(async () => {
            try {
                const { addDoc, collection, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                
                // Vytvořit billing portal session přes Cloud Function
                // Firebase Extension nepodporuje billing portal přímo, použijeme Cloud Function
                const returnUrl = `${window.location.origin}/profile-plan.html`;
                
                // Získat Firebase project ID z konfigurace
                let projectId = 'inzerio-inzerce'; // fallback podle firebase-init.js
                if (window.firebaseApp && window.firebaseApp.options && window.firebaseApp.options.projectId) {
                    projectId = window.firebaseApp.options.projectId;
                }
                
                // Zavolat Cloud Function pro vytvoření billing portal session
                const functionsUrl = `https://europe-west1-${projectId}.cloudfunctions.net/createBillingPortalSession`;
                
                // Získat auth token pro autentizaci
                let authToken = null;
                if (user && typeof user.getIdToken === 'function') {
                    try {
                        authToken = await user.getIdToken();
                    } catch (tokenError) {
                        console.warn('Could not get auth token:', tokenError);
                    }
                }
                
                // Vytvořit headers objekt
                const headers = {
                    'Content-Type': 'application/json'
                };
                
                // Přidat Authorization header pouze pokud máme validní token
                if (authToken && typeof authToken === 'string' && authToken.trim().length > 0) {
                    headers['Authorization'] = `Bearer ${authToken}`;
                }
                
                const response = await fetch(functionsUrl, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        returnUrl: returnUrl,
                        uid: user.uid
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.error) {
                    console.error('Stripe portal error:', data.error);
                    showError(`Chyba při vytváření portálu: ${data.error || 'zkuste to prosím znovu.'}`);
                    return;
                }
                
                if (data.url) {
                    window.location.assign(data.url);
                } else {
                    throw new Error('Nepodařilo se získat URL portálu');
                }
                
            } catch (error) {
                console.error('❌ Stripe portal error:', error);
                showError('Nepodařilo se otevřít portál pro správu předplatného. Zkuste to prosím znovu.');
            }
        });
        
    } catch (error) {
        console.error('❌ openStripeCustomerPortal:', error);
        showError('Nepodařilo se otevřít portál pro správu předplatného.');
    }
}

// Funkce pro zobrazení animace přesměrování (stejná jako v top-ads.js)
function showRedirectAnimation(callback) {
    const overlay = document.createElement('div');
    overlay.id = 'redirect-overlay';
    overlay.innerHTML = `
        <div class="redirect-animation-content">
            <div class="redirect-spinner">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <h2 class="redirect-title">Přesměrovávám na platební bránu...</h2>
            <p class="redirect-subtitle">Prosím čekejte</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
    
    setTimeout(() => {
        if (callback) callback();
    }, 1500);
}

// Helper funkce pro zobrazení chyb
function showError(message) {
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, 'error');
    } else {
        alert(message);
    }
}

// Helper funkce pro zobrazení úspěchu
function showSuccess(message) {
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, 'success');
    } else {
        console.log('✅', message);
    }
}

// Export funkcí pro globální použití
window.loadCurrentPlan = loadCurrentPlan;
window.refreshBadge = refreshBadge;
window.updatePlanInfo = updatePlanInfo;
window.openStripeCustomerPortal = openStripeCustomerPortal;

