/**
 * 🔧 DEBUG SCRIPT pro Subscription System
 * 
 * Spusťte tento script v browser console pro diagnostiku problémů.
 * Stačí zkopírovat celý soubor a vložit do console, nebo spustit:
 * 
 * Krok 1: Načíst script
 * const script = document.createElement('script');
 * script.src = '/debug-subscription.js';
 * document.head.appendChild(script);
 * 
 * Krok 2: Spustit diagnostiku
 * debugSubscription()
 */

window.debugSubscription = async function() {
    console.log('🔧 ============================================');
    console.log('🔧 SUBSCRIPTION SYSTEM DIAGNOSTIKA');
    console.log('🔧 ============================================\n');

    const results = {
        firebase: false,
        auth: false,
        user: false,
        subscriptionFunctions: false,
        firestoreAccess: false,
        subscriptionData: null,
        errors: []
    };

    // 1. Kontrola Firebase
    console.log('📦 1. Kontrola Firebase SDK...');
    if (window.firebaseAuth && window.firebaseDb) {
        console.log('   ✅ Firebase Auth:', !!window.firebaseAuth);
        console.log('   ✅ Firebase Firestore:', !!window.firebaseDb);
        results.firebase = true;
    } else {
        console.error('   ❌ Firebase není načten!');
        console.error('   💡 Řešení: Ujistěte se, že /firebase-init.js je načten PŘED auth.js');
        results.errors.push('Firebase není načten');
    }

    // 2. Kontrola autentizace
    console.log('\n👤 2. Kontrola autentizace...');
    if (window.firebaseAuth) {
        const user = window.firebaseAuth.currentUser;
        if (user) {
            console.log('   ✅ Uživatel je přihlášen');
            console.log('   📧 Email:', user.email);
            console.log('   🆔 UID:', user.uid);
            results.auth = true;
            results.user = user;
        } else {
            console.warn('   ⚠️ Uživatel není přihlášen');
            console.log('   💡 Pro testování subscription musíte být přihlášeni');
        }
    }

    // 3. Kontrola subscription funkcí
    console.log('\n⚙️ 3. Kontrola subscription funkcí...');
    const functions = [
        'subscribeToUserSubscription',
        'checkUserSubscription',
        'requireSubscription'
    ];
    
    let allFunctionsExist = true;
    functions.forEach(fn => {
        if (typeof window[fn] === 'function') {
            console.log(`   ✅ ${fn} je dostupná`);
        } else {
            console.error(`   ❌ ${fn} NENÍ dostupná`);
            results.errors.push(`${fn} není dostupná`);
            allFunctionsExist = false;
        }
    });
    
    if (allFunctionsExist) {
        results.subscriptionFunctions = true;
    } else {
        console.error('   💡 Řešení: Zkontrolujte, že auth.js je plně načten');
    }

    // 4. Kontrola přístupu k Firestore (pokud je uživatel přihlášen)
    if (results.user && results.firebase) {
        console.log('\n🗄️ 4. Kontrola přístupu k Firestore...');
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const subsRef = collection(window.firebaseDb, 'customers', results.user.uid, 'subscriptions');
            
            const snapshot = await getDocs(subsRef);
            console.log(`   ✅ Přístup k Firestore OK`);
            console.log(`   📊 Nalezeno ${snapshot.size} dokumentů předplatného`);
            
            if (snapshot.size > 0) {
                console.log('\n   📋 Detail předplatných:');
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    console.log(`   
   📄 Předplatné: ${doc.id}
      Status: ${data.status}
      Created: ${data.created?.toDate()?.toLocaleString('cs-CZ') || 'N/A'}
      Current Period End: ${data.current_period_end?.toDate()?.toLocaleString('cs-CZ') || 'N/A'}
      Cancel at period end: ${data.cancel_at_period_end || false}
      ${data.current_period_end ? 
        `Expirováno: ${data.current_period_end.toDate() < new Date() ? '❌ ANO' : '✅ NE'}` 
        : ''}`);
                });
            } else {
                console.warn('   ⚠️ Žádná předplatná nenalezena');
                console.log('   💡 Zkontrolujte Stripe Extension nebo vytvořte testovací předplatné');
            }
            
            results.firestoreAccess = true;
        } catch (error) {
            console.error('   ❌ Chyba při přístupu k Firestore:', error.message);
            console.error('   💡 Řešení: Zkontrolujte Firebase Security Rules');
            console.error('   💡 Rules by měly povolit read pro: customers/{userId}/subscriptions');
            results.errors.push(`Firestore error: ${error.message}`);
        }
    }

    // 5. Test real-time listeneru (pokud všechno funguje)
    if (results.user && results.subscriptionFunctions && results.firestoreAccess) {
        console.log('\n📡 5. Test real-time listeneru...');
        try {
            let listenerCalled = false;
            
            const unsubscribe = await window.subscribeToUserSubscription(
                results.user.uid,
                (subData) => {
                    listenerCalled = true;
                    results.subscriptionData = subData;
                    
                    console.log('   ✅ Listener funguje! Obdržena data:');
                    console.log('   📊 Subscription Data:', {
                        isSubscribed: subData.isSubscribed,
                        isLoading: subData.isLoading,
                        subscriptionEnd: subData.subscriptionEnd?.toLocaleString('cs-CZ'),
                        isCanceled: subData.isCanceled,
                        status: subData.status,
                        subscriptionId: subData.subscriptionId
                    });
                    
                    if (subData.isSubscribed) {
                        console.log('   🎉 Uživatel MÁ aktivní předplatné!');
                    } else {
                        console.warn('   ⚠️ Uživatel NEMÁ aktivní předplatné');
                        if (subData.status === 'expired') {
                            console.log('   💡 Důvod: Předplatné expirovala');
                        }
                    }
                    
                    // Odpojit listener po testu
                    setTimeout(() => {
                        if (unsubscribe) unsubscribe();
                        console.log('   🔌 Listener odpojen');
                    }, 1000);
                }
            );
            
            // Počkat chvíli na callback
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (!listenerCalled) {
                console.error('   ❌ Listener nebyl volán!');
                console.error('   💡 Možné příčiny:');
                console.error('      - Firestore pravidla blokují přístup');
                console.error('      - Žádná data v customers/{userId}/subscriptions');
                results.errors.push('Listener nebyl volán');
            }
            
        } catch (error) {
            console.error('   ❌ Chyba při testování listeneru:', error.message);
            results.errors.push(`Listener error: ${error.message}`);
        }
    }

    // 6. Shrnutí
    console.log('\n📊 ============================================');
    console.log('📊 SHRNUTÍ DIAGNOSTIKY');
    console.log('📊 ============================================\n');
    
    console.log('Firebase SDK:', results.firebase ? '✅' : '❌');
    console.log('Autentizace:', results.auth ? '✅' : '⚠️ Není přihlášen');
    console.log('Subscription funkce:', results.subscriptionFunctions ? '✅' : '❌');
    console.log('Firestore přístup:', results.firestoreAccess ? '✅' : '❌');
    
    if (results.subscriptionData) {
        console.log('Real-time listener:', '✅');
        console.log('Má předplatné:', results.subscriptionData.isSubscribed ? '✅ ANO' : '❌ NE');
    }
    
    if (results.errors.length > 0) {
        console.log('\n❌ Nalezené chyby:');
        results.errors.forEach((err, i) => {
            console.error(`   ${i + 1}. ${err}`);
        });
    } else {
        console.log('\n✅ Všechny kontroly prošly!');
    }
    
    console.log('\n📖 Pro více informací viz: SUBSCRIPTION_GUIDE.md');
    console.log('🔧 ============================================\n');
    
    return results;
};

// Quick test funkce
window.quickSubTest = async function() {
    console.log('⚡ Quick Subscription Test...\n');
    
    if (!window.firebaseAuth?.currentUser) {
        console.error('❌ Nejste přihlášeni');
        return false;
    }
    
    try {
        const hasSubscription = await window.checkUserSubscription(window.firebaseAuth.currentUser.uid);
        console.log('Má předplatné:', hasSubscription ? '✅ ANO' : '❌ NE');
        return hasSubscription;
    } catch (error) {
        console.error('❌ Chyba:', error.message);
        return false;
    }
};

console.log('🔧 Debug script načten!');
console.log('📋 Dostupné příkazy:');
console.log('   debugSubscription() - Kompletní diagnostika');
console.log('   quickSubTest() - Rychlá kontrola předplatného');
