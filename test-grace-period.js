// 🧪 Test script pro ověření grace period a webhook delay tolerance
// Použití: Vložit do browser console na stránce my-ads.html

async function testGracePeriod() {
    console.log('🧪 TESTOVACÍ SCRIPT: Grace period a webhook delay tolerance');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (!window.firebaseAuth?.currentUser) {
        console.error('❌ Nejste přihlášeni');
        return;
    }
    
    const userId = window.firebaseAuth.currentUser.uid;
    console.log('👤 User ID:', userId);
    console.log('');
    
    // Test 1: Kontrola rozšířených statusů
    console.log('📊 Test #1: Kontrola akceptovaných statusů');
    console.log('───────────────────────────────────────────');
    
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const subsRef = collection(window.firebaseDb, 'customers', userId, 'subscriptions');
        const snapshot = await getDocs(subsRef);
        
        if (snapshot.empty) {
            console.log('⚠️ Žádná předplatná nenalezena');
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                const status = data.status;
                const periodEnd = data.current_period_end?.toDate();
                const created = data.created?.toDate() || data.current_period_start?.toDate();
                const now = new Date();
                
                console.log(`\n📋 Subscription: ${doc.id}`);
                console.log(`   Status: ${status}`);
                console.log(`   Period End: ${periodEnd}`);
                console.log(`   Created: ${created}`);
                
                // Zkontrolovat akceptované statusy
                const acceptedStatuses = ['active', 'trialing', 'incomplete', 'past_due'];
                const isAccepted = acceptedStatuses.includes(status);
                console.log(`   ✓ Akceptovaný status: ${isAccepted ? '✅ ANO' : '❌ NE'}`);
                
                // Zkontrolovat grace period pro incomplete/past_due
                if (['incomplete', 'past_due'].includes(status) && created) {
                    const minutesOld = (now - created) / 1000 / 60;
                    const isValid = minutesOld < 10;
                    console.log(`   ⏰ Stáří: ${minutesOld.toFixed(1)} min`);
                    console.log(`   ✓ V rámci 10min limitu: ${isValid ? '✅ ANO' : '❌ NE'}`);
                }
                
                // Zkontrolovat expiraci
                if (periodEnd) {
                    const isExpired = periodEnd < now;
                    const minutesSinceExpiry = (now - periodEnd) / 1000 / 60;
                    console.log(`   ⏱️ Expirováno: ${isExpired ? 'ANO' : 'NE'}`);
                    
                    if (isExpired) {
                        const inGracePeriod = minutesSinceExpiry < 2;
                        console.log(`   🛡️ Grace period (2min): ${inGracePeriod ? '✅ AKTIVNÍ' : '❌ VYPRŠEL'}`);
                        console.log(`   📊 Čas od expirace: ${minutesSinceExpiry.toFixed(2)} min`);
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ Chyba při načítání předplatných:', error);
    }
    
    console.log('\n\n');
    
    // Test 2: Kontrola pomocných funkcí
    console.log('🔧 Test #2: Kontrola pomocných funkcí');
    console.log('───────────────────────────────────────────');
    
    try {
        console.log('Volám checkUserSubscription()...');
        const hasSubscription = await window.checkUserSubscription(userId);
        console.log(`✓ checkUserSubscription(): ${hasSubscription ? '✅ MÁ předplatné' : '❌ NEMÁ předplatné'}`);
        
        console.log('\nVolám getSubscriptionDetails()...');
        const details = await window.getSubscriptionDetails(userId);
        if (details) {
            console.log('✓ getSubscriptionDetails():');
            console.log('   ID:', details.id);
            console.log('   Status:', details.status);
            console.log('   Period End:', details.current_period_end);
            console.log('   Plan:', details.plan);
            console.log('   Canceled:', details.cancel_at_period_end);
        } else {
            console.log('✓ getSubscriptionDetails(): null (žádné předplatné)');
        }
    } catch (error) {
        console.error('❌ Chyba při testování funkcí:', error);
    }
    
    console.log('\n\n');
    
    // Test 3: Simulace grace period scénářů
    console.log('🎭 Test #3: Simulace grace period scénářů');
    console.log('───────────────────────────────────────────');
    
    const scenarios = [
        {
            name: 'Trial právě skončil (webhook čeká)',
            status: 'trialing',
            periodEnd: new Date(Date.now() - 30000), // před 30s
            expected: 'GRACE PERIOD aktivní - inzeráty AKTIVNÍ'
        },
        {
            name: 'Incomplete status (platba se zpracovává)',
            status: 'incomplete',
            periodEnd: new Date(Date.now() - 60000), // před 1min
            expected: 'GRACE PERIOD aktivní - inzeráty AKTIVNÍ'
        },
        {
            name: 'Grace period vypršel',
            status: 'trialing',
            periodEnd: new Date(Date.now() - 150000), // před 2.5min
            expected: 'Grace period VYPRŠEL - inzeráty by byly DEAKTIVOVÁNY'
        },
        {
            name: 'Active subscription',
            status: 'active',
            periodEnd: new Date(Date.now() + 2592000000), // +30 dní
            expected: 'Platné předplatné - inzeráty AKTIVNÍ'
        }
    ];
    
    scenarios.forEach((scenario, index) => {
        console.log(`\n${index + 1}. ${scenario.name}`);
        const now = new Date();
        const periodEnd = scenario.periodEnd;
        const minutesSinceExpiry = (now - periodEnd) / 1000 / 60;
        
        const isExpired = periodEnd < now;
        const isInGracePeriod = isExpired && minutesSinceExpiry < 2;
        const isValidStatus = ['active', 'trialing', 'incomplete', 'past_due'].includes(scenario.status);
        
        console.log(`   Status: ${scenario.status}`);
        console.log(`   Period End: ${periodEnd.toISOString()}`);
        console.log(`   Expirováno: ${isExpired ? 'ANO' : 'NE'}`);
        if (isExpired) {
            console.log(`   Čas od expirace: ${minutesSinceExpiry.toFixed(2)} min`);
            console.log(`   V grace period: ${isInGracePeriod ? '✅ ANO' : '❌ NE'}`);
        }
        console.log(`   Akceptovaný status: ${isValidStatus ? '✅ ANO' : '❌ NE'}`);
        console.log(`   📋 Očekávaný výsledek: ${scenario.expected}`);
    });
    
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Test dokončen!');
    console.log('');
    console.log('💡 Pro manuální test:');
    console.log('   1. Vytvořte test subscription v Stripe');
    console.log('   2. Nastavte trial period na 1 minutu');
    console.log('   3. Po expiraci sledujte console logy');
    console.log('   4. Ověřte, že inzeráty nejsou deaktivovány během 2 minut');
}

// Export pro globální použití
window.testGracePeriod = testGracePeriod;

console.log('🧪 Test script načten!');
console.log('💡 Spusťte: testGracePeriod()');
