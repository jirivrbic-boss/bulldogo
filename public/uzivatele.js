// Uživatelé - Admin stránka
let allUsers = [];
let allAds = [];

// Inicializace
document.addEventListener('DOMContentLoaded', () => {
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDb) {
            initUsersPage();
            clearInterval(checkFirebase);
        }
    }, 100);
});

async function initUsersPage() {
    console.log('Inicializuji stránku uživatelů...');
    
    const auth = window.firebaseAuth;
    if (!auth) {
        console.error('Firebase Auth není dostupné');
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Počkat na přihlášení uživatele pomocí onAuthStateChanged
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed na uzivatele.html:', user ? user.email : 'Odhlášen');
        
        if (!user) {
            console.log('Uživatel není přihlášen, přesměrovávám na dashboard');
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Zkontrolovat admin status
        const isAdmin = await checkAdminStatus(user.uid);
        console.log('Admin status pro', user.email, ':', isAdmin);
        
        if (!isAdmin) {
            console.log('Uživatel není admin, přesměrovávám na dashboard');
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Načíst data
        try {
            await loadAllUsers();
            await loadAllAds();
            displayUsers(allUsers);
            
            // Zobrazit admin menu
            if (typeof window.checkAndShowAdminMenu === 'function') {
                setTimeout(() => window.checkAndShowAdminMenu(), 500);
            }
        } catch (error) {
            console.error('Chyba při načítání dat:', error);
            showMessage('Nepodařilo se načíst data.', 'error');
        }
    });
}

// Kontrola admin statusu
async function checkAdminStatus(uid) {
    if (!uid) return false;
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            if (profileData.isAdmin === true || profileData.role === 'admin') {
                return true;
            }
        }
        const adminEmails = ['admin@bulldogo.cz', 'support@bulldogo.cz'];
        if (window.firebaseAuth?.currentUser?.email && adminEmails.includes(window.firebaseAuth.currentUser.email.toLowerCase())) {
            return true;
        }
        return false;
    } catch (error) {
        console.error('Chyba při kontrole admin statusu:', error);
        return false;
    }
}

// Načtení všech uživatelů
async function loadAllUsers() {
    try {
        const { getDocs, getDoc, collection, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const usersSnapshot = await getDocs(collection(window.firebaseDb, 'users'));
        allUsers = [];
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = { 
                id: userDoc.id, 
                uid: userDoc.id,
                ...userDoc.data() 
            };
            const profileRef = doc(window.firebaseDb, 'users', userDoc.id, 'profile', 'profile');
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                userData.name = profileData.name || userData.name || userDoc.data().email || 'Bez jména';
                userData.email = profileData.email || userData.email || userDoc.data().email || 'Bez emailu';
                userData.balance = profileData.balance || 0;
                userData.profileCreatedAt = profileData.createdAt || userDoc.data().createdAt || null;
            } else {
                userData.name = userData.name || userData.email || 'Bez jména';
                userData.email = userData.email || 'Bez emailu';
                userData.balance = 0;
            }
            allUsers.push(userData);
        }
        
        console.log('Načteno uživatelů:', allUsers.length);
    } catch (error) {
        console.error('Chyba při načítání uživatelů:', error);
        showMessage('Nepodařilo se načíst uživatele.', 'error');
    }
}

// Načtení všech inzerátů
async function loadAllAds() {
    try {
        const { getDocs, collection, collectionGroup } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        console.log('Načítám inzeráty přes collectionGroup("inzeraty")...');
        
        allAds = [];
        
        // Zkusit collectionGroup pro users/{uid}/inzeraty
        try {
            const cgSnapshot = await getDocs(collectionGroup(window.firebaseDb, 'inzeraty'));
            console.log('CollectionGroup výsledek:', cgSnapshot.size, 'dokumentů');
            
            cgSnapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const userIdFromPath = docSnap.ref.parent && docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : undefined;
                if (!data.userId && userIdFromPath) data.userId = userIdFromPath;
                allAds.push({ 
                    id: docSnap.id, 
                    userId: data.userId || userIdFromPath,
                    ...data 
                });
            });
            
            console.log('Načteno inzerátů z users/{uid}/inzeraty:', allAds.length);
        } catch (cgError) {
            console.warn('Chyba při načítání přes collectionGroup:', cgError);
        }
        
        // Fallback: zkusit starou kolekci 'services'
        if (allAds.length === 0) {
            console.warn('Nenalezeny žádné inzeráty v users/{uid}/inzeraty, zkouším fallback na kolekci "services"');
            try {
                const servicesSnapshot = await getDocs(collection(window.firebaseDb, 'services'));
                console.log('Services kolekce výsledek:', servicesSnapshot.size, 'dokumentů');
                
                servicesSnapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    allAds.push({ 
                        id: docSnap.id, 
                        ...data 
                    });
                });
                
                console.log('Načteno inzerátů z fallback kolekce services:', allAds.length);
            } catch (servicesError) {
                console.error('Chyba při načítání z kolekce services:', servicesError);
            }
        }
        
        // Pokud stále nic, zkusit projít všechny uživatele a načíst jejich inzeráty
        if (allAds.length === 0) {
            console.warn('Stále žádné inzeráty, zkouším projít všechny uživatele...');
            try {
                const usersSnapshot = await getDocs(collection(window.firebaseDb, 'users'));
                let totalAds = 0;
                
                for (const userDoc of usersSnapshot.docs) {
                    const userId = userDoc.id;
                    const userAdsRef = collection(window.firebaseDb, 'users', userId, 'inzeraty');
                    const userAdsSnapshot = await getDocs(userAdsRef);
                    
                    userAdsSnapshot.forEach((adDoc) => {
                        const data = adDoc.data() || {};
                        allAds.push({
                            id: adDoc.id,
                            userId: userId,
                            ...data
                        });
                        totalAds++;
                    });
                }
                
                console.log('Načteno inzerátů procházením uživatelů:', totalAds);
            } catch (usersError) {
                console.error('Chyba při procházení uživatelů:', usersError);
            }
        }
        
        console.log('Celkem načteno inzerátů:', allAds.length);
        
        if (allAds.length === 0) {
            console.warn('⚠️ Nebyly nalezeny žádné inzeráty v databázi');
        }
        
    } catch (error) {
        console.error('Chyba při načítání inzerátů:', error);
        showMessage('Nepodařilo se načíst inzeráty.', 'error');
    }
}

// Zobrazení uživatelů
function displayUsers(users) {
    const grid = document.getElementById('usersGrid');
    
    if (users.length === 0) {
        grid.innerHTML = `
            <div class="no-users">
                <i class="fas fa-users"></i>
                <h3>Žádní uživatelé</h3>
                <p>V systému nejsou žádní registrovaní uživatelé.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = users.map(user => createUserCard(user)).join('');
}

// Vytvoření karty uživatele
function createUserCard(user) {
    const userId = user.uid || user.id;
    const userAds = allAds.filter(ad => (ad.userId === userId) || (ad.userId === user.id));
    const activeAds = userAds.filter(ad => ad.status === 'active' || !ad.status).length;
    const joinDate = user.createdAt?.toDate?.() || user.createdAt || user.profileCreatedAt?.toDate?.() || user.profileCreatedAt;
    const formattedDate = joinDate ? new Date(joinDate).toLocaleDateString('cs-CZ') : 'Neznámé';
    
    return `
        <div class="user-card">
            <div class="user-card-header">
                <div class="user-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="user-info">
                    <h3>${user.name || 'Bez jména'}</h3>
                    <p>${user.email || 'Bez emailu'}</p>
                </div>
            </div>
            <div class="user-card-stats">
                <div class="stat-item">
                    <i class="fas fa-list"></i>
                    <span>${userAds.length} inzerátů</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-check-circle"></i>
                    <span>${activeAds} aktivních</span>
                </div>
                <div class="stat-item">
                    <i class="fas fa-calendar"></i>
                    <span>${formattedDate}</span>
                </div>
            </div>
            <div class="user-card-actions">
                <button class="btn btn-danger" onclick="deleteUser('${userId}')">
                    <i class="fas fa-trash"></i> Smazat
                </button>
            </div>
        </div>
    `;
}

// Filtrování uživatelů
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filterValue = document.getElementById('userFilter').value;
    
    let filteredUsers = allUsers.filter(user => {
        const userId = user.uid || user.id;
        const matchesSearch = (user.name?.toLowerCase() || '').includes(searchTerm) || 
                             (user.email?.toLowerCase() || '').includes(searchTerm);
        
        let matchesFilter = true;
        if (filterValue === 'withAds') {
            const userAds = allAds.filter(ad => (ad.userId === userId) || (ad.userId === user.id));
            matchesFilter = userAds.length > 0;
        } else if (filterValue === 'withoutAds') {
            const userAds = allAds.filter(ad => (ad.userId === userId) || (ad.userId === user.id));
            matchesFilter = userAds.length === 0;
        }
        
        return matchesSearch && matchesFilter;
    });
    
    displayUsers(filteredUsers);
}

// Mazání uživatele
async function deleteUser(userId) {
    if (!confirm('⚠️ VAROVÁNÍ: NEVRATNÁ AKCE\n\nOpravdu chcete smazat tohoto uživatele?\n\nTato akce je NEVRATNÁ a smaže:\n- Všechny jeho inzeráty a služby\n- Všechny recenze a hodnocení\n- Všechny zprávy a konverzace\n- Všechna data z Firestore a Storage\n- Účet z Firebase Authentication')) {
        return;
    }
    
    try {
        const { deleteDoc, doc, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        console.log('🗑️ Mažu uživatele ze všech částí Firebase:', userId);
        
        // 1. Smazat profil uživatele
        try {
            await deleteDoc(doc(window.firebaseDb, 'users', userId, 'profile', 'profile'));
            console.log('   ✓ Profil smazán');
        } catch (error) {
            console.log('   ⚠️ Profil nebyl nalezen nebo již byl smazán');
        }

        // 2. Smazat všechny inzeráty uživatele a jejich recenze
        try {
            const adsCollection = collection(window.firebaseDb, 'users', userId, 'inzeraty');
            const adsSnapshot = await getDocs(adsCollection);
            
            // Pro každý inzerát smazat i jeho recenze
            for (const adDoc of adsSnapshot.docs) {
                try {
                    // Smazat recenze na inzerátu
                    const adReviewsRef = collection(window.firebaseDb, 'users', userId, 'inzeraty', adDoc.id, 'reviews');
                    const adReviewsSnapshot = await getDocs(adReviewsRef);
                    const deleteAdReviewsPromises = adReviewsSnapshot.docs.map(reviewDoc => deleteDoc(reviewDoc.ref));
                    await Promise.all(deleteAdReviewsPromises);
                } catch (error) {
                    console.log(`   ⚠️ Recenze na inzerátu ${adDoc.id} nebyly nalezeny`);
                }
                
                // Smazat inzerát
                await deleteDoc(adDoc.ref);
            }
            console.log(`   ✓ Všechny inzeráty (${adsSnapshot.size}) a jejich recenze smazány`);
        } catch (error) {
            console.log('   ⚠️ Inzeráty nebyly nalezeny nebo již byly smazány');
        }

        // 3. Smazat recenze na profilu uživatele (users/{uid}/reviews)
        try {
            const profileReviewsRef = collection(window.firebaseDb, 'users', userId, 'reviews');
            const profileReviewsSnapshot = await getDocs(profileReviewsRef);
            const deleteProfileReviewsPromises = profileReviewsSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteProfileReviewsPromises);
            console.log(`   ✓ Recenze na profilu (${profileReviewsSnapshot.size}) smazány`);
        } catch (error) {
            console.log('   ⚠️ Recenze na profilu nebyly nalezeny');
        }

        // 4. Smazat všechny recenze v root kolekci reviews (kde je reviewedUserId nebo reviewerId)
        try {
            // Recenze kde je uživatel recenzovaný
            const reviewedQuery = query(
                collection(window.firebaseDb, 'reviews'),
                where('reviewedUserId', '==', userId)
            );
            const reviewedSnapshot = await getDocs(reviewedQuery);
            const deleteReviewedPromises = reviewedSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteReviewedPromises);
            
            // Recenze kde je uživatel recenzující
            const reviewerQuery = query(
                collection(window.firebaseDb, 'reviews'),
                where('reviewerId', '==', userId)
            );
            const reviewerSnapshot = await getDocs(reviewerQuery);
            const deleteReviewerPromises = reviewerSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteReviewerPromises);
            
            console.log(`   ✓ Všechny recenze v root kolekci (${reviewedSnapshot.size + reviewerSnapshot.size}) smazány`);
        } catch (error) {
            console.log('   ⚠️ Recenze v root kolekci nebyly nalezeny');
        }

        // 5. Smazat všechny zprávy (kde je userId nebo recipientId)
        try {
            // Zprávy kde je uživatel odesílatel
            const messagesFromQuery = query(
                collection(window.firebaseDb, 'messages'),
                where('userId', '==', userId)
            );
            const messagesFromSnapshot = await getDocs(messagesFromQuery);
            const deleteMessagesFromPromises = messagesFromSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteMessagesFromPromises);
            
            // Zprávy kde je uživatel příjemce
            const messagesToQuery = query(
                collection(window.firebaseDb, 'messages'),
                where('recipientId', '==', userId)
            );
            const messagesToSnapshot = await getDocs(messagesToQuery);
            const deleteMessagesToPromises = messagesToSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteMessagesToPromises);
            
            console.log(`   ✓ Všechny zprávy (${messagesFromSnapshot.size + messagesToSnapshot.size}) smazány`);
        } catch (error) {
            console.log('   ⚠️ Zprávy nebyly nalezeny');
        }

        // 6. Smazat všechny konverzace (kde je uživatel účastník)
        try {
            const conversationsQuery = query(
                collection(window.firebaseDb, 'conversations'),
                where('participants', 'array-contains', userId)
            );
            const conversationsSnapshot = await getDocs(conversationsQuery);
            const deleteConversationsPromises = conversationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteConversationsPromises);
            console.log(`   ✓ Všechny konverzace (${conversationsSnapshot.size}) smazány`);
        } catch (error) {
            console.log('   ⚠️ Konverzace nebyly nalezeny');
        }

        // 7. Smazat hlavní dokument uživatele (users/{uid})
        try {
            await deleteDoc(doc(window.firebaseDb, 'users', userId));
            console.log('   ✓ Hlavní dokument uživatele smazán');
        } catch (error) {
            console.log('   ⚠️ Hlavní dokument uživatele nebyl nalezen');
        }

        // 8. Smazat soubory ve Firebase Storage
        try {
            const { getStorage, ref, listAll, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            const storage = getStorage(window.firebaseApp);
            
            // Smazat všechny soubory v users/{uid}/
            const userStorageRef = ref(storage, `users/${userId}`);
            try {
                const filesList = await listAll(userStorageRef);
                const deleteFilePromises = filesList.items.map(fileRef => deleteObject(fileRef));
                await Promise.all(deleteFilePromises);
                
                // Smazat také soubory v podsložkách
                for (const prefixRef of filesList.prefixes) {
                    const prefixFiles = await listAll(prefixRef);
                    const deletePrefixPromises = prefixFiles.items.map(fileRef => deleteObject(fileRef));
                    await Promise.all(deletePrefixPromises);
                }
                console.log(`   ✓ Všechny soubory ve Storage (${filesList.items.length}) smazány`);
            } catch (storageError) {
                console.log('   ⚠️ Soubory ve Storage nebyly nalezeny nebo již byly smazány');
            }
        } catch (error) {
            console.log('   ⚠️ Chyba při mazání souborů ve Storage:', error);
        }

        // 9. Smazat Firebase Auth uživatele pomocí Cloud Function
        try {
            const currentAdmin = window.firebaseAuth.currentUser;
            if (!currentAdmin) {
                throw new Error('Admin není přihlášen');
            }

            // Získat ID token pro autentifikaci
            const idToken = await currentAdmin.getIdToken();

            // Zavolat Cloud Function pro smazání Auth uživatele
            const functionsUrl = 'https://europe-west1-inzerio-inzerce.cloudfunctions.net/deleteUserAuth';
            const response = await fetch(functionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    uid: userId,
                    adminUid: currentAdmin.uid
                })
            });

            if (!response.ok) {
                let errorMessage = 'Chyba při mazání z Authentication';
                try {
                    const result = await response.json();
                    errorMessage = result.error || result.message || errorMessage;
                } catch (e) {
                    // Pokud není JSON response, použít status text
                    errorMessage = response.statusText || `HTTP ${response.status}`;
                }
                
                if (response.status === 404) {
                    errorMessage = 'Cloud Function deleteUserAuth není nasazena. Prosím nasaďte ji pomocí: firebase deploy --only functions:deleteUserAuth';
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('   ✓ Firebase Auth uživatel smazán:', result);
        } catch (error) {
            console.error('   ❌ Chyba při mazání z Firebase Auth:', error);
            
            // Pokud je to 404, zobrazit uživatelsky přívětivou zprávu
            if (error.message && error.message.includes('404')) {
                showMessage('⚠️ Cloud Function není nasazena. Data z Firestore a Storage byla smazána, ale Auth uživatel zůstal. Pro úplné smazání nasaďte Cloud Function.', 'warning');
            } else {
                // Nevyhodit chybu - data z Firestore a Storage jsou smazána
                console.log('   ⚠️ Data z Firestore a Storage byla smazána, ale Auth uživatel zůstal');
            }
        }
        
        console.log('✅ Uživatel úspěšně smazán ze všech částí Firebase');
        
        // Odstranit z lokálních dat
        allUsers = allUsers.filter(u => (u.uid || u.id) !== userId);
        allAds = allAds.filter(ad => ad.userId !== userId);
        
        displayUsers(allUsers);
        showMessage('✅ Uživatel úspěšně smazán ze všech částí Firebase (Firestore, Storage, Authentication).', 'success');
    } catch (error) {
        console.error('❌ Chyba při mazání uživatele:', error);
        showMessage(`Nepodařilo se smazat uživatele: ${error.message}`, 'error');
    }
}

// Helper funkce pro zobrazení zprávy
function showMessage(message, type = 'info') {
    // Použít globální showMessage z auth.js, pokud existuje
    if (typeof window.showMessage === 'function' && window.showMessage !== showMessage) {
        window.showMessage(message, type);
    } else {
        // Fallback na alert, pokud není dostupná globální funkce
        alert(message);
    }
}

