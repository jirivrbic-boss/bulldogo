// ============================================
// NOVÝ CHAT SYSTÉM - BULLDOGO
// ============================================
// Struktura Firestore:
// - conversations/{conversationId}
//   - participants: [uid1, uid2]
//   - listingId: string
//   - listingTitle: string
//   - lastMessage: string
//   - lastMessageAt: timestamp
//   - createdAt: timestamp
// - conversations/{conversationId}/messages/{messageId}
//   - senderId: string
//   - text: string
//   - createdAt: timestamp

console.log('💬 Nový chat systém: inicializace');

// ============================================
// POMOCNÉ FUNKCE PRO FORMÁTOVÁNÍ
// ============================================
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
        'Celá Česká republika': 'Celá ČR',
        'Celá ČR': 'Celá ČR',
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
    
    // Pokud není přesná shoda, vrátit původní hodnotu
    return locStr;
}

// ============================================
// STAV
// ============================================
let currentUser = null;
let currentUserAvatar = '';
let conversations = [];
let currentConversationId = null;
let messages = [];
let conversationsUnsubscribe = null;
let messagesUnsubscribe = null;

// ============================================
// POMOCNÉ FUNKCE
// ============================================
function q(id) {
    return document.getElementById(id);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Dnes';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Včera';
    } else {
        return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
    }
}

function showError(message) {
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, 'error');
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    if (typeof window.showMessage === 'function') {
        window.showMessage(message, 'success');
    } else {
        console.log('✅', message);
    }
}

// ============================================
// KONTROLA PŘIHLÁŠENÍ
// ============================================
async function checkAuth() {
    if (!window.firebaseAuth) {
        console.warn('⚠️ Firebase Auth není inicializován');
        return false;
    }
    
    const authModule = await (window.importFirebaseAuth || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')))();
    const { onAuthStateChanged } = authModule;
    
    return new Promise((resolve) => {
        onAuthStateChanged(window.firebaseAuth, async (user) => {
            currentUser = user;
            if (!user) {
                currentUserAvatar = '';
                // Zobrazit CTA pro přihlášení
                showLoginPrompt();
                resolve(false);
            } else {
                // Načíst avatar aktuálního uživatele
                try {
                    const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
                    const { doc, getDoc } = firestoreModule;
                    const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const profileData = profileSnap.data();
                        currentUserAvatar = profileData.photoURL || profileData.avatarUrl || '';
                    } else {
                        currentUserAvatar = '';
                    }
                } catch (e) {
                    console.warn('⚠️ Nepodařilo se načíst avatar aktuálního uživatele:', e);
                    currentUserAvatar = '';
                }
                hideLoginPrompt();
                resolve(true);
            }
        });
    });
}

function showLoginPrompt() {
    const mainContent = q('igMain');
    const loginPrompt = q('igLoginPrompt');
    const inputBar = q('igInput');
    
    if (mainContent) {
        mainContent.style.display = 'none';
    }
    if (loginPrompt) {
        loginPrompt.style.display = 'flex';
    }
    if (inputBar) {
        inputBar.style.display = 'none';
    }
}

function hideLoginPrompt() {
    const mainContent = q('igMain');
    const loginPrompt = q('igLoginPrompt');
    const inputBar = q('igInput');
    
    if (mainContent) {
        mainContent.style.display = 'block';
    }
    if (loginPrompt) {
        loginPrompt.style.display = 'none';
    }
    if (inputBar) {
        inputBar.style.display = 'block';
    }
}

// ============================================
// NAČÍTÁNÍ KONVERZACÍ
// ============================================
async function loadConversations() {
    if (!currentUser || !window.firebaseDb) {
        console.warn('⚠️ Nelze načíst konverzace: chybí user nebo db');
        return;
    }
    
    try {
        const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
        const { collection, query, where, orderBy, onSnapshot } = firestoreModule;
        
        const conversationsRef = collection(window.firebaseDb, 'conversations');
        
        // Zkusit query s orderBy, pokud selže, použít bez orderBy
        let q;
        try {
            q = query(
                conversationsRef,
                where('participants', 'array-contains', currentUser.uid),
                orderBy('lastMessageAt', 'desc')
            );
        } catch (e) {
            // Pokud selže (chybí index), použít jednodušší query bez orderBy
            console.warn('⚠️ Nelze použít orderBy, chybí index. Používám jednodušší query.');
            q = query(
                conversationsRef,
                where('participants', 'array-contains', currentUser.uid)
            );
        }
        
        if (conversationsUnsubscribe) {
            conversationsUnsubscribe();
        }
        
        conversationsUnsubscribe = onSnapshot(q, async (snapshot) => {
            const conversationsMap = new Map(); // Pro deduplikaci podle ID
            const processedIds = new Set(); // Pro kontrolu duplicit
            
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const conversationId = doc.id;
                
                // Přeskočit, pokud už jsme tuto konverzaci zpracovali
                if (processedIds.has(conversationId)) {
                    console.warn('⚠️ Duplicitní konverzace nalezena:', conversationId);
                    continue;
                }
                processedIds.add(conversationId);
                
                // Zkontrolovat, zda participants obsahuje aktuálního uživatele
                if (!data.participants || !Array.isArray(data.participants) || !data.participants.includes(currentUser.uid)) {
                    console.warn('⚠️ Konverzace neobsahuje aktuálního uživatele:', conversationId);
                    continue;
                }
                
                const otherParticipantId = data.participants.find(uid => uid !== currentUser.uid);
                
                // Přeskočit, pokud není druhý účastník
                if (!otherParticipantId) {
                    console.warn('⚠️ Konverzace nemá druhého účastníka:', conversationId);
                    continue;
                }
                
                // Zkontrolovat, zda konverzace má alespoň jednu zprávu
                // (nebo zobrazit jen ty, kde uživatel skutečně psal)
                const hasMessage = data.lastMessage && data.lastMessage.trim() !== '';
                
                // Načíst jméno a avatar druhého účastníka
                let otherParticipantName = 'Uživatel';
                let otherParticipantAvatar = '';
                let otherParticipantPhone = '';
                
                try {
                    const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
                    const { doc: docFn, getDoc } = firestoreModule;
                    const profileRef = docFn(window.firebaseDb, 'users', otherParticipantId, 'profile', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    
                    if (profileSnap.exists()) {
                        const profileData = profileSnap.data();
                        otherParticipantName = profileData.name || profileData.email || 'Uživatel';
                        otherParticipantAvatar = profileData.photoURL || profileData.avatarUrl || '';
                        otherParticipantPhone = profileData.phone || profileData.telefon || '';
                    }
                } catch (e) {
                    console.warn('⚠️ Nepodařilo se načíst profil:', e);
                }
                
                // Vytvořit klíč pro deduplikaci (normalizovat participants)
                const normalizedParticipants = [...data.participants].sort().join('_');
                const dedupKey = `${normalizedParticipants}_${conversationId}`;
                
                // Přidat konverzaci pouze pokud ještě není v mapě
                if (!conversationsMap.has(dedupKey)) {
                    conversationsMap.set(dedupKey, {
                        id: conversationId,
                        participants: data.participants,
                        otherParticipantId: otherParticipantId,
                        otherParticipantName: otherParticipantName,
                        otherParticipantAvatar: otherParticipantAvatar,
                        otherParticipantPhone: otherParticipantPhone,
                        listingId: data.listingId || null,
                        listingTitle: data.listingTitle || null,
                        lastMessage: data.lastMessage || '',
                        lastMessageAt: data.lastMessageAt || data.createdAt,
                        createdAt: data.createdAt,
                        hasMessage: hasMessage
                    });
                } else {
                    console.warn('⚠️ Duplicitní konverzace (stejní účastníci):', conversationId);
                }
            }
            
            // Převést mapu na pole
            conversations = Array.from(conversationsMap.values());
            
            // Filtrovat: zobrazit jen konverzace s alespoň jednou zprávou
            // (nebo konverzace, kde uživatel skutečně psal)
            // Zobrazíme jen konverzace, které mají zprávu nebo jsou aktuálně otevřené
            conversations = conversations.filter(conv => {
                // Zobrazit konverzaci, pokud má zprávu nebo pokud je aktuálně otevřená
                return conv.hasMessage || conv.id === currentConversationId;
            });
            
            // Seřadit podle lastMessageAt (pokud není orderBy v query)
            conversations.sort((a, b) => {
                const timeA = a.lastMessageAt?.toDate?.() || a.lastMessageAt || new Date(0);
                const timeB = b.lastMessageAt?.toDate?.() || b.lastMessageAt || new Date(0);
                return timeB - timeA;
            });
            
            renderConversations();
            
            // Pokud je v URL conversationId, otevřít ho
            const urlParams = new URLSearchParams(window.location.search);
            const conversationId = urlParams.get('conversationId');
            if (conversationId && !currentConversationId) {
                openConversation(conversationId);
            }
        }, (error) => {
            console.error('❌ Chyba při načítání konverzací:', error);
            if (error.code === 'permission-denied') {
                showError('Chybí oprávnění Firestore. Zkontrolujte publikované Firestore Rules ve Firebase Console.');
            } else if (error.code === 'failed-precondition') {
                const indexUrl = error.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0];
                if (indexUrl) {
                    console.error('📋 Vytvořte index na tomto odkazu:', indexUrl);
                    showError(`Pro chat je potřeba vytvořit Firestore index. Otevřete konzoli pro odkaz.`);
                } else {
                    showError('Pro chat je potřeba vytvořit Firestore index. Firebase Console → Firestore → Indexes → Create Index pro conversations s poli: participants (Array), lastMessageAt (Timestamp).');
                }
            } else {
                showError('Nepodařilo se načíst konverzace.');
            }
        });
    } catch (error) {
        console.error('❌ Chyba při inicializaci listeneru konverzací:', error);
        showError('Nepodařilo se načíst konverzace.');
    }
}

// ============================================
// RENDEROVÁNÍ KONVERZACÍ
// ============================================
function renderConversations() {
    const container = q('igConversations');
    if (!container) return;
    
    if (conversations.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">Zatím nemáte žádné zprávy</div>';
        // Pokud není žádná konverzace, skrýt input a zobrazit prázdný stav
        if (!currentConversationId) {
            const messagesContainer = q('igMessages');
            const inputContainer = q('igInput');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="ig-empty-state">
                        <div class="ig-empty-icon">
                            <i class="fas fa-comments" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                        </div>
                        <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Začněte novou konverzaci</h3>
                        <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5;">
                            Klikněte na tlačítko "Chat" u nějakého inzerátu a začněte komunikovat s poskytovatelem služby.
                        </p>
                    </div>
                `;
            }
            if (inputContainer) inputContainer.style.display = 'none';
        }
        return;
    }
    
    container.innerHTML = conversations.map(conv => {
        const time = formatDate(conv.lastMessageAt);
        const avatar = conv.otherParticipantAvatar 
            ? `<img src="${conv.otherParticipantAvatar}" alt="${conv.otherParticipantName}" loading="lazy">`
            : `<i class="fas fa-user"></i>`;
        
        return `
            <div class="ig-conv ${currentConversationId === conv.id ? 'active' : ''}" 
                 data-conversation-id="${conv.id}"
                 onclick="openConversation('${conv.id}')">
                <div class="ig-avatar">${avatar}</div>
                <div>
                    <div class="ig-title">${conv.otherParticipantName}</div>
                    <div class="ig-last">${conv.lastMessage || 'Žádná zpráva'}</div>
                </div>
                <div class="ig-time">${time}</div>
            </div>
        `;
    }).join('');
}

// ============================================
// OTEVŘENÍ KONVERZACE
// ============================================
async function openConversation(conversationId) {
    if (!currentUser || !window.firebaseDb) {
        showError('Musíte být přihlášeni');
        return;
    }
    
    // Pokud konverzace ještě není načtená, načíst ji přímo z Firestore
    let conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
        // Zkusit načíst konverzaci přímo z Firestore
        try {
            const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
            const { doc, getDoc } = firestoreModule;
            const conversationRef = doc(window.firebaseDb, 'conversations', conversationId);
            const conversationSnap = await getDoc(conversationRef);
            
            if (!conversationSnap.exists()) {
                showError('Konverzace nenalezena');
                return;
            }
            
            const data = conversationSnap.data();
            // Zkontrolovat, jestli je uživatel účastníkem
            if (!data.participants || !data.participants.includes(currentUser.uid)) {
                showError('Nemáte přístup k této konverzaci');
                return;
            }
            
            // Načíst informace o druhém účastníkovi
            const otherParticipantId = data.participants.find(uid => uid !== currentUser.uid);
            let otherParticipantName = 'Neznámý uživatel';
            let otherParticipantAvatar = '';
            let otherParticipantPhone = '';
            
            if (otherParticipantId) {
                try {
                    const profileRef = doc(window.firebaseDb, 'users', otherParticipantId, 'profile', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                        const profileData = profileSnap.data();
                        otherParticipantName = profileData.displayName || profileData.name || profileData.email || 'Neznámý uživatel';
                        otherParticipantAvatar = profileData.photoURL || profileData.avatarUrl || '';
                        otherParticipantPhone = profileData.phoneNumber || profileData.phone || '';
                    }
                } catch (e) {
                    console.warn('⚠️ Nepodařilo se načíst profil druhého účastníka:', e);
                }
            }
            
            // Vytvořit objekt konverzace
            conversation = {
                id: conversationId,
                participants: data.participants,
                otherParticipantId: otherParticipantId,
                otherParticipantName: otherParticipantName,
                otherParticipantAvatar: otherParticipantAvatar,
                otherParticipantPhone: otherParticipantPhone,
                listingId: data.listingId || null,
                listingTitle: data.listingTitle || null,
                lastMessage: data.lastMessage || '',
                lastMessageAt: data.lastMessageAt || data.createdAt,
                createdAt: data.createdAt
            };
        } catch (error) {
            console.error('❌ Chyba při načítání konverzace:', error);
            showError('Nepodařilo se načíst konverzaci');
            return;
        }
    }
    
    currentConversationId = conversationId;
    renderConversations();
    
    // Na mobilu přidat třídu pro zobrazení chatu
    document.body.classList.add('chat-active');
    
    // Aktualizovat hlavičku
    const peerNameEl = q('igPeerName');
    const peerAvatarEl = q('igPeerAvatar');
    const peerStatusEl = q('igPeerStatus');
    const subjectEl = q('igSubject');
    const subjectTextEl = q('igSubjectText');
    
    if (peerNameEl) peerNameEl.textContent = conversation.otherParticipantName;
    if (peerStatusEl) peerStatusEl.textContent = 'Online';
    
    if (peerAvatarEl) {
        if (conversation.otherParticipantAvatar) {
            peerAvatarEl.innerHTML = `<img src="${conversation.otherParticipantAvatar}" alt="${conversation.otherParticipantName}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;">`;
        } else {
            peerAvatarEl.innerHTML = '<i class="fas fa-user"></i>';
        }
    }
    
    // Zobrazit předmět (listingTitle)
    if (conversation.listingTitle) {
        if (subjectEl) subjectEl.style.display = 'inline-flex';
        if (subjectTextEl) {
            if (conversation.listingId) {
                subjectTextEl.innerHTML = `<a href="ad-detail.html?id=${conversation.listingId}&userId=${conversation.otherParticipantId}" target="_blank">${conversation.listingTitle}</a>`;
            } else {
                subjectTextEl.textContent = conversation.listingTitle;
            }
        }
    } else {
        if (subjectEl) subjectEl.style.display = 'none';
    }
    
    // Nastavit tlačítko profilu
    const profileBtn = q('igOpenProfile');
    if (profileBtn) {
        profileBtn.onclick = () => {
            window.location.href = `profile-detail.html?userId=${conversation.otherParticipantId}`;
        };
    }
    
    // Načíst zprávy
    loadMessages(conversationId);
    
    // Načíst inzeráty druhého účastníka
    if (conversation.otherParticipantId) {
        loadLatestAds(conversation.otherParticipantId);
    }
}

// ============================================
// NAČÍTÁNÍ ZPRÁV
// ============================================
async function loadMessages(conversationId) {
    if (!currentUser || !window.firebaseDb) {
        return;
    }
    
    try {
        const firestoreModule = await (window.importFirebaseFirestore || (() => import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')))();
        const { collection, query, orderBy, onSnapshot } = firestoreModule;
        
        const messagesRef = collection(window.firebaseDb, 'conversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));
        
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
        }
        
        console.log('👂 Nastavuji real-time listener pro zprávy v konverzaci:', conversationId);
        
        messagesUnsubscribe = onSnapshot(q, async (snapshot) => {
            console.log('📨 Real-time update zpráv:', snapshot.docs.length, 'zpráv');
            console.log('📨 Snapshot metadata:', {
                fromCache: snapshot.metadata.fromCache,
                hasPendingWrites: snapshot.metadata.hasPendingWrites
            });
            
            // Použít Map pro deduplikaci zpráv podle ID
            const messagesMap = new Map();
            
            // Načíst zprávy a avatary odesílatelů
            for (const doc of snapshot.docs) {
                // Přeskočit duplicitní zprávy
                if (messagesMap.has(doc.id)) {
                    continue;
                }
                
                const data = doc.data();
                let senderAvatar = '';
                
                // Načíst avatar odesílatele
                if (data.senderId) {
                    try {
                        const { doc: getDoc, getDoc: getDocFn } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                        const profileRef = getDoc(window.firebaseDb, 'users', data.senderId, 'profile', 'profile');
                        const profileSnap = await getDocFn(profileRef);
                        if (profileSnap.exists()) {
                            const profileData = profileSnap.data();
                            senderAvatar = profileData.photoURL || profileData.avatarUrl || '';
                        }
                    } catch (e) {
                        console.warn('⚠️ Nepodařilo se načíst avatar odesílatele:', e);
                    }
                }
                
                messagesMap.set(doc.id, {
                    id: doc.id,
                    senderId: data.senderId,
                    text: data.text || '',
                    images: data.images || [],
                    createdAt: data.createdAt,
                    senderAvatar: senderAvatar,
                    isAdInfo: data.isAdInfo || false,
                    adUrl: data.adUrl || '',
                    adId: data.adId || '',
                    adTitle: data.adTitle || ''
                });
            }
            
            // Převést mapu na pole (seřazené podle createdAt)
            messages = Array.from(messagesMap.values());
            messages.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                const timeB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                return timeA - timeB;
            });
            
            renderMessages();
        }, (error) => {
            console.error('❌ Chyba při načítání zpráv:', error);
            console.error('❌ Error details:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            if (error.code === 'permission-denied') {
                showError('Chybí oprávnění pro čtení zpráv. Zkontrolujte Firestore Rules.');
            } else {
                showError('Chyba při načítání zpráv: ' + error.message);
            }
        });
    } catch (error) {
        console.error('❌ Chyba při inicializaci listeneru zpráv:', error);
    }
}

// ============================================
// RENDEROVÁNÍ ZPRÁV
// ============================================
function renderMessages() {
    const container = q('igMessages');
    const inputContainer = q('igInput');
    
    if (!container) return;
    
    // Pokud není vybraná konverzace, zobrazit zprávu a skrýt input
    if (!currentConversationId) {
        // Na mobilu odebrat třídu pro zobrazení chatu
        document.body.classList.remove('chat-active');
        
        container.innerHTML = `
            <div class="ig-empty-state">
                <div class="ig-empty-icon">
                    <i class="fas fa-comments" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                </div>
                <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Vyberte konverzaci</h3>
                <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5;">
                    Zvolte si konverzaci vlevo nebo začněte novou kliknutím na tlačítko "Chat" u inzerátu.
                </p>
            </div>
        `;
        if (inputContainer) inputContainer.style.display = 'none';
        return;
    }
    
    // Zobrazit input když je vybraná konverzace
    if (inputContainer) inputContainer.style.display = 'block';
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="ig-empty">Zatím žádné zprávy – napište první.</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        // Systémová zpráva o inzerátu
        if (msg.isAdInfo) {
            const adLink = msg.adUrl ? `<a href="${msg.adUrl}" style="color: #f77c00; text-decoration: underline; font-weight: 600; margin-left: 8px;">Zobrazit inzerát</a>` : '';
            return `
                <div class="ig-row" style="justify-content: center; align-items: center; margin: 16px 0; display: flex; width: 100%;">
                    <div class="ig-bubble" style="background: #fff8eb; border: 1px solid #ffe0b2; max-width: 90%; text-align: center; padding: 12px 16px; display: inline-block;">
                        <div style="font-size: 14px; color: #111827; display: inline; white-space: normal;">
                            ${msg.text || ''}${adLink ? adLink : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        const isMine = msg.senderId === currentUser.uid;
        const time = formatTime(msg.createdAt);
        // Určit avatar - pro vlastní zprávy použít currentUserAvatar, jinak senderAvatar
        let avatarUrl = '';
        if (isMine) {
            avatarUrl = currentUserAvatar;
        } else {
            avatarUrl = msg.senderAvatar || '';
        }
        
        const avatar = avatarUrl
            ? `<img src="${avatarUrl}" alt="Avatar" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;">`
            : '<i class="fas fa-user"></i>';
        
        // Zpracovat obrázky
        let imagesHtml = '';
        if (msg.images && msg.images.length > 0) {
            // Převést URL stringy na formát pro openImageViewer
            const imageObjects = msg.images.map(imgUrl => ({ url: imgUrl }));
            const imagesJson = JSON.stringify(imageObjects).replace(/"/g, '&quot;');
            imagesHtml = `<div class="ig-images" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-top: 8px;">
                ${msg.images.map((imgUrl, imgIndex) => {
                    const escapedUrl = imgUrl.replace(/"/g, '&quot;');
                    return `<img src="${escapedUrl}" alt="Obrázek" loading="lazy" style="width: 100%; max-width: 300px; border-radius: 8px; cursor: pointer; object-fit: cover;" class="ig-chat-image" data-images="${imagesJson}" data-image-index="${imgIndex}">
                `;
                }).join('')}
            </div>`;
        }
        
        return `
            <div class="ig-row ${isMine ? 'mine' : ''}">
                <div class="ig-avatar">
                    ${avatar}
                </div>
                <div class="ig-bubble">
                    ${msg.text ? `<div>${msg.text}</div>` : ''}
                    ${imagesHtml}
                    <div class="ig-meta">${time}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Přidat event listenery pro obrázky (otevření vieweru místo přesměrování)
    container.querySelectorAll('.ig-chat-image').forEach(img => {
        img.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const imagesJson = this.getAttribute('data-images');
            const imageIndex = parseInt(this.getAttribute('data-image-index'), 10);
            if (imagesJson && typeof window.openImageViewer === 'function') {
                try {
                    const images = JSON.parse(imagesJson.replace(/&quot;/g, '"'));
                    window.openImageViewer(images, imageIndex);
                } catch (err) {
                    console.error('Chyba při parsování obrázků:', err);
                }
            }
        });
    });
    
    // Scroll na konec
    container.scrollTop = container.scrollHeight;
}

// ============================================
// SPRÁVA PŘÍLOH
// ============================================
let selectedFiles = [];

function initFileInput() {
    const fileInput = q('igFiles');
    const previewContainer = q('igFilePreview');
    
    if (!fileInput || !previewContainer) return;
    
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        selectedFiles = files;
        showFilePreview(files, previewContainer);
    });
}

function showFilePreview(files, container) {
    if (!container) return;
    
    container.innerHTML = files.map((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = container.querySelector(`[data-index="${index}"] img`);
            if (img) img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        return `
            <div class="ig-file-preview-item" data-index="${index}">
                <img src="" alt="Preview" style="max-width: 100px; max-height: 100px; border-radius: 8px; object-fit: cover;">
                <button type="button" class="ig-file-remove" onclick="removeFile(${index})" title="Odstranit">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    container.style.display = 'flex';
}

function removeFile(index) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
    const fileInput = q('igFiles');
    if (fileInput) {
        // Vytvořit nový DataTransfer objekt pro aktualizaci file inputu
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        fileInput.files = dt.files;
    }
    
    const previewContainer = q('igFilePreview');
    if (previewContainer) {
        if (selectedFiles.length === 0) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
        } else {
            showFilePreview(selectedFiles, previewContainer);
        }
    }
}

// Globální funkce pro onclick
window.removeFile = removeFile;

// ============================================
// ODESLÁNÍ ZPRÁVY
// ============================================
let isSendingMessage = false;

async function sendMessage() {
    // Zabraň dvojitému odeslání
    if (isSendingMessage) {
        return;
    }
    
    if (!currentUser || !currentConversationId || !window.firebaseDb) {
        showError('Musíte být přihlášeni a mít otevřenou konverzaci');
        return;
    }
    
    const input = q('igText');
    const text = (input?.value || '').trim();
    
    // Povolit odeslání i bez textu, pokud jsou obrázky
    if (!text && selectedFiles.length === 0) {
        return;
    }
    
    // Kontrola profanity filtru
    if (window.ProfanityFilter) {
        const profanityCheck = window.ProfanityFilter.check(text);
        if (!profanityCheck.isClean) {
            const blockedWords = profanityCheck.bannedWords.join(', ');
            showError(`Vaše zpráva obsahuje nevhodný obsah: ${blockedWords}. Prosím upravte text.`);
            return;
        }
    }
    
    // Nastavit flag, že se odesílá zpráva
    isSendingMessage = true;
    
    try {
        const { collection, addDoc, doc, updateDoc, getDoc, getDocs, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Nahrát obrázky, pokud existují
        const imageUrls = [];
        if (selectedFiles.length > 0 && window.firebaseStorage) {
            try {
                const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
                
                const uploadPromises = selectedFiles.map(async (file) => {
                    const timestamp = Date.now();
                    const fileName = `chat/${currentConversationId}/${timestamp}_${file.name}`;
                    const storageRef = ref(window.firebaseStorage, fileName);
                    
                    await uploadBytes(storageRef, file);
                    const downloadURL = await getDownloadURL(storageRef);
                    return downloadURL;
                });
                
                imageUrls.push(...await Promise.all(uploadPromises));
                console.log('✅ Obrázky nahrány:', imageUrls.length);
            } catch (uploadError) {
                console.error('❌ Chyba při nahrávání obrázků:', uploadError);
                showError('Nepodařilo se nahrát obrázky. Zkuste to znovu.');
                return;
            }
        }
        
        // Přidat zprávu
        const messagesRef = collection(window.firebaseDb, 'conversations', currentConversationId, 'messages');
        const messageData = {
            senderId: currentUser.uid,
            text: text || '',
            createdAt: serverTimestamp()
        };
        
        if (imageUrls.length > 0) {
            messageData.images = imageUrls;
        }
        
        const messageDocRef = await addDoc(messagesRef, messageData);
        
        console.log('✅ Zpráva uložena:', messageDocRef.id);
        
        // Pokud konverzace má listingId a listingTitle, přidat systémovou zprávu o inzerátu (pokud ještě není)
        // Použijeme try-catch, aby to neblokovalo odesílání zprávy
        try {
            const conversationRef = doc(window.firebaseDb, 'conversations', currentConversationId);
            const conversationSnap = await getDoc(conversationRef);
            
            if (conversationSnap.exists()) {
                const convData = conversationSnap.data();
                if (convData.listingId && convData.listingTitle) {
                    // Zkontrolovat, zda už není systémová zpráva o tomto konkrétním inzerátu
                    const existingMessagesSnapshot = await getDocs(messagesRef);
                    const hasSystemMessageForThisAd = existingMessagesSnapshot.docs.some(doc => {
                        const data = doc.data();
                        return data.isAdInfo === true && data.adId === convData.listingId;
                    });
                    
                    if (!hasSystemMessageForThisAd) {
                        // Vytvořit systémovou zprávu s informacemi o inzerátu
                        // POZOR: senderId musí být ID aktuálního uživatele kvůli Firestore pravidlům
                        const systemMessageText = `📌 Tato konverzace se týká inzerátu: "${convData.listingTitle}"`;
                        const otherUserId = convData.participants.find(uid => uid !== currentUser.uid);
                        const adUrl = `ad-detail.html?id=${convData.listingId}&userId=${otherUserId}`;
                        
                        await addDoc(messagesRef, {
                            senderId: currentUser.uid, // Musí být ID přihlášeného uživatele kvůli pravidlům
                            isAdInfo: true,
                            text: systemMessageText,
                            adUrl: adUrl,
                            adId: convData.listingId,
                            adTitle: convData.listingTitle,
                            createdAt: serverTimestamp()
                        });
                        
                        console.log('✅ Systémová zpráva o inzerátu přidána:', convData.listingId);
                    }
                }
            }
        } catch (systemMessageError) {
            // Nechat tichý fallback - systémová zpráva není kritická
            console.warn('⚠️ Nepodařilo se přidat systémovou zprávu o inzerátu:', systemMessageError);
        }
        
        // Aktualizovat konverzaci (zpráva s obrázky nebo textem)
        const lastMessageText = imageUrls.length > 0 
            ? (text || `📷 ${imageUrls.length} obrázek${imageUrls.length > 1 ? 'ů' : ''}`)
            : text;
        
        const conversationRef = doc(window.firebaseDb, 'conversations', currentConversationId);
        await updateDoc(conversationRef, {
            lastMessage: lastMessageText,
            lastMessageAt: serverTimestamp()
        });
        
        console.log('✅ Konverzace aktualizována:', currentConversationId);
        
        // Vyčistit input a přílohy
        if (input) input.value = '';
        selectedFiles = [];
        const fileInput = q('igFiles');
        if (fileInput) fileInput.value = '';
        const previewContainer = q('igFilePreview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ Chyba při odesílání zprávy:', error);
        if (error.code === 'permission-denied') {
            showError('Chybí oprávnění pro odesílání zpráv. Zkontrolujte Firestore Rules.');
        } else {
            showError('Nepodařilo se odeslat zprávu.');
        }
    } finally {
        // Resetovat flag po dokončení odesílání
        isSendingMessage = false;
    }
}

// ============================================
// VYTVOŘENÍ NEBO NAJITÍ KONVERZACE
// ============================================
async function findOrCreateConversation(otherUserId, listingId, listingTitle) {
    if (!currentUser || !window.firebaseDb) {
        showError('Musíte být přihlášeni');
        return null;
    }
    
    if (currentUser.uid === otherUserId) {
        showError('Nemůžete kontaktovat sami sebe');
        return null;
    }
    
    try {
        const { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Najít existující konverzaci
        const conversationsRef = collection(window.firebaseDb, 'conversations');
        const q = query(
            conversationsRef,
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const snapshot = await getDocs(q);
        
        // Normalizovat participants pro konzistentní porovnání
        const normalizedParticipants = [currentUser.uid, otherUserId].sort();
        
        // Najít existující konverzaci se stejnými participants (bez ohledu na pořadí)
        const existingConv = snapshot.docs.find(doc => {
            const data = doc.data();
            if (!data.participants || !Array.isArray(data.participants)) return false;
            
            // Normalizovat participants pro porovnání
            const dataParticipants = [...data.participants].sort();
            return JSON.stringify(dataParticipants) === JSON.stringify(normalizedParticipants);
        });
        
        if (existingConv) {
            console.log('✅ Nalezena existující konverzace:', existingConv.id);
            // Aktualizovat listingId a listingTitle, pokud jsou předány nové hodnoty
            if (listingId || listingTitle) {
                try {
                    const conversationRef = doc(window.firebaseDb, 'conversations', existingConv.id);
                    const updateData = {};
                    if (listingId) updateData.listingId = listingId;
                    if (listingTitle) updateData.listingTitle = listingTitle;
                    await updateDoc(conversationRef, updateData);
                    console.log('✅ Konverzace aktualizována s novými informacemi o inzerátu:', updateData);
                } catch (updateError) {
                    console.warn('⚠️ Nepodařilo se aktualizovat konverzaci:', updateError);
                }
            }
            return existingConv.id;
        }
        
        // Vytvořit novou konverzaci
        const newConvRef = doc(conversationsRef);
        await setDoc(newConvRef, {
            participants: normalizedParticipants,
            listingId: listingId || null,
            listingTitle: listingTitle || null,
            lastMessage: '',
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });
        
        console.log('✅ Vytvořena nová konverzace:', newConvRef.id);
        return newConvRef.id;
    } catch (error) {
        console.error('❌ Chyba při vytváření/nalezení konverzace:', error);
        if (error.code === 'permission-denied') {
            showError('Chybí oprávnění pro vytváření konverzací. Zkontrolujte Firestore Rules.');
        } else {
            showError('Nepodařilo se vytvořit konverzaci.');
        }
        return null;
    }
}

// ============================================
// GLOBÁLNÍ FUNKCE PRO INTEGRACI
// ============================================
window.contactSeller = async function(listingId, sellerUid, listingTitle) {
    if (!currentUser) {
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
        } else {
            showError('Pro kontaktování se musíte přihlásit');
        }
        return;
    }
    
    const conversationId = await findOrCreateConversation(sellerUid, listingId, listingTitle);
    if (conversationId) {
        window.location.href = `chat.html?conversationId=${conversationId}`;
    }
};

// ============================================
// NAČÍTÁNÍ NEJNOVĚJŠÍCH INZERÁTŮ (PRAVÝ PANEL)
// ============================================
async function loadLatestAds(targetUserId = null) {
    const container = q('igRightAds');
    if (!container) {
        console.warn('⚠️ Nelze načíst inzeráty: chybí container');
        return;
    }
    
    // Zobrazit loading stav
    container.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: #6b7280;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px; display: block;"></i><div style="font-size: 14px;">Načítám inzeráty...</div></div>';
    
    // Počkat na Firebase
    if (!window.firebaseDb) {
        let tries = 0;
        while (!window.firebaseDb && tries < 50) {
            await new Promise(r => setTimeout(r, 100));
            tries++;
        }
    }
    
    if (!window.firebaseDb) {
        console.warn('⚠️ Nelze načíst inzeráty: firebaseDb není inicializován');
        container.innerHTML = '<div style="padding: 12px; color: #6b7280;">Nelze načíst inzeráty</div>';
        return;
    }
    
    try {
        const { collectionGroup, collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        let snapshot = null;
        let ads = [];
        
        // Pokud je zadán targetUserId, načíst inzeráty pouze tohoto uživatele
        if (targetUserId) {
            try {
                console.log('🔄 Načítám inzeráty uživatele:', targetUserId);
                const userAdsRef = collection(window.firebaseDb, 'users', targetUserId, 'inzeraty');
                
                // Zkusit načíst s orderBy a limitem
                let q;
                try {
                    q = query(userAdsRef, orderBy('createdAt', 'desc'), limit(10));
                } catch (orderByError) {
                    // Pokud orderBy nefunguje, použít bez něj
                    q = query(userAdsRef, limit(10));
                }
                
                snapshot = await getDocs(q);
                console.log('📊 Uživatelské inzeráty výsledek:', snapshot.size, 'dokumentů');
                
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    const status = data.status || 'active';
                    
                    // Zobrazit pouze aktivní inzeráty (stejně jako v services.js)
                    if (status === 'active') {
                        ads.push({
                            id: docSnap.id,
                            userId: targetUserId,
                            title: data.title || 'Bez názvu',
                            location: data.location || 'Neuvedeno',
                            category: data.category || '',
                            price: data.price || '',
                            isTop: data.isTop || false,
                            createdAt: data.createdAt,
                            images: data.images || [],
                            image: data.image,
                            photo: data.photo,
                            status: status
                        });
                    }
                });
                
                // Seřadit podle data vytvoření (nejnovější první)
                ads.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                    return dateB - dateA;
                });
                
                console.log('✅ Načteno inzerátů uživatele:', ads.length);
            } catch (userAdsError) {
                console.warn('⚠️ Chyba při načítání uživatelských inzerátů:', userAdsError.message);
            }
        }
        
        // Pokud není zadán targetUserId nebo se nepodařilo načíst, načíst všechny inzeráty
        if (ads.length === 0) {
            // Zkusit collectionGroup pro users/{uid}/inzeraty
            try {
                console.log('🔄 Zkouším načíst inzeráty přes collectionGroup...');
                const inzeratyRef = collectionGroup(window.firebaseDb, 'inzeraty');
                snapshot = await getDocs(inzeratyRef);
                console.log('📊 CollectionGroup výsledek:', snapshot.size, 'dokumentů');
                
                snapshot.forEach((docSnap) => {
                    const data = docSnap.data() || {};
                    const userIdFromPath = docSnap.ref.parent && docSnap.ref.parent.parent ? docSnap.ref.parent.parent.id : undefined;
                    if (!data.userId && userIdFromPath) data.userId = userIdFromPath;
                    const status = data.status || 'active';
                    
                    // Zobrazit pouze aktivní inzeráty (stejně jako v services.js)
                    if (status === 'active') {
                        ads.push({
                            id: docSnap.id,
                            userId: data.userId || userIdFromPath,
                            title: data.title || 'Bez názvu',
                            location: data.location || 'Neuvedeno',
                            category: data.category || '',
                            price: data.price || '',
                            isTop: data.isTop || false,
                            createdAt: data.createdAt,
                            images: data.images || [],
                            image: data.image,
                            photo: data.photo,
                            status: status
                        });
                    }
                });
                
                // Seřadit podle data vytvoření (nejnovější první) a omezit na 10
                ads.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                    const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                    return dateB - dateA;
                });
                ads = ads.slice(0, 10);
                
                console.log('✅ Načteno inzerátů z collectionGroup:', ads.length);
            } catch (cgError) {
                console.warn('⚠️ Chyba při načítání přes collectionGroup:', cgError.message);
            }
            
            // Fallback: zkusit starou kolekci 'services'
            if (ads.length === 0) {
                try {
                    console.log('🔄 Zkouším načíst inzeráty ze staré kolekce services...');
                    const servicesRef = collection(window.firebaseDb, 'services');
                    snapshot = await getDocs(servicesRef);
                    console.log('📊 Services kolekce výsledek:', snapshot.size, 'dokumentů');
                    
                    snapshot.forEach((docSnap) => {
                        const data = docSnap.data() || {};
                        const status = data.status || 'active';
                        
                        // Zobrazit pouze aktivní inzeráty (stejně jako v services.js)
                        if (status === 'active') {
                            ads.push({
                                id: docSnap.id,
                                userId: data.userId || '',
                                title: data.title || 'Bez názvu',
                                location: data.location || 'Neuvedeno',
                                category: data.category || '',
                                price: data.price || '',
                                isTop: data.isTop || false,
                                createdAt: data.createdAt,
                                images: data.images || [],
                                image: data.image,
                                photo: data.photo,
                                status: status
                            });
                        }
                    });
                    
                    // Seřadit podle data vytvoření (nejnovější první) a omezit na 10
                    ads.sort((a, b) => {
                        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                        return dateB - dateA;
                    });
                    ads = ads.slice(0, 10);
                    
                    console.log('✅ Načteno inzerátů z services:', ads.length);
                } catch (servicesError) {
                    console.warn('⚠️ Chyba při načítání z kolekce services:', servicesError.message);
                }
            }
        }
        
        if (ads.length === 0) {
            console.warn('⚠️ Nenašly se žádné inzeráty');
            container.innerHTML = '<div style="padding: 12px; color: #6b7280;">Zatím žádné inzeráty</div>';
            return;
        }
        
        // Pokud ještě nejsou seřazeny (fallback cesta), seřadit podle createdAt (nejnovější první)
        if (ads.length > 1) {
            ads.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                const timeB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                return timeB - timeA;
            });
        }
        
        // Použít všechny načtené inzeráty (už jsou omezeny na 10 v podmíněných blocích)
        const latestAds = ads;
        
        console.log('🎯 Zobrazuji', latestAds.length, 'nejnovějších inzerátů');
        
        container.innerHTML = latestAds.map(ad => {
            // Najít obrázek - podobně jako v services.js
            let imageUrl = './fotky/vychozi-inzerat.png';
            if (ad.images && ad.images.length > 0) {
                if (ad.images[0].url) {
                    imageUrl = ad.images[0].url;
                } else if (typeof ad.images[0] === 'string') {
                    imageUrl = ad.images[0];
                }
            } else if (ad.image) {
                if (ad.image.url) {
                    imageUrl = ad.image.url;
                } else if (typeof ad.image === 'string') {
                    imageUrl = ad.image;
                }
            } else if (ad.photo) {
                if (ad.photo.url) {
                    imageUrl = ad.photo.url;
                } else if (typeof ad.photo === 'string') {
                    imageUrl = ad.photo;
                }
            }
            const topBadge = ad.isTop ? `
                <span style="
                    background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%);
                    color: #111827;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                ">TOP</span>
            ` : '';
            
            return `
                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 0;
                    margin-bottom: 12px;
                    cursor: pointer;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    overflow: hidden;
                " onclick="window.location.href='ad-detail.html?id=${ad.id}&userId=${ad.userId}'">
                    <div style="width: 100%; height: 140px; overflow: hidden; background: #f3f4f6;">
                        <img src="${imageUrl}" alt="${ad.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='./fotky/vychozi-inzerat.png'">
                    </div>
                    <div style="padding: 14px;">
                        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px;">
                            <h4 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0; flex: 1; line-height: 1.3;">${ad.title}</h4>
                            ${topBadge}
                        </div>
                        <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">
                            <i class="fas fa-map-marker-alt" style="color:#f77c00;"></i> ${getLocationName(ad.location) || ad.location || 'Neuvedeno'}
                            ${ad.category ? ` • ${getCategoryName(ad.category)}` : ''}
                        </div>
                        ${ad.price ? `<div style="font-size: 16px; font-weight: 700; color: #f77c00;">${ad.price}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ Chyba při načítání inzerátů:', error);
        // Tichý fallback - nechat prázdný nebo zobrazit neutrální zprávu
        container.innerHTML = '<div style="padding: 12px; color: #6b7280;">Zatím žádné inzeráty</div>';
    }
}

// ============================================
// INICIALIZACE
// ============================================
async function init() {
    console.log('🚀 Inicializace chatu...');
    
    // Nejdříve zobrazit prázdný stav
    const messagesContainer = q('igMessages');
    const inputContainer = q('igInput');
    if (messagesContainer && !currentConversationId) {
        messagesContainer.innerHTML = `
            <div class="ig-empty-state">
                <div class="ig-empty-icon">
                    <i class="fas fa-comments" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                </div>
                <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Vyberte konverzaci</h3>
                <p style="font-size: 14px; color: #6b7280; margin: 0; line-height: 1.5;">
                    Zvolte si konverzaci vlevo nebo začněte novou kliknutím na tlačítko "Chat" u inzerátu.
                </p>
            </div>
        `;
    }
    if (inputContainer && !currentConversationId) {
        inputContainer.style.display = 'none';
    }
    
    // Počkat na Firebase
    let tries = 0;
    while ((!window.firebaseAuth || !window.firebaseDb) && tries < 30) {
        await new Promise(r => setTimeout(r, 100));
        tries++;
    }
    
    if (!window.firebaseAuth || !window.firebaseDb) {
        console.error('❌ Firebase není inicializován');
        showError('Firebase není inicializován. Obnovte stránku.');
        return;
    }
    
    // Načíst nejnovější inzeráty (veřejné, nezávisle na přihlášení)
    await loadLatestAds();
    
    // Kontrola přihlášení
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        return;
    }
    
    // Nastavit event listenery
    const sendBtn = q('igSend');
    const input = q('igText');
    const backBtn = q('igBackBtn');
    
    if (sendBtn) {
        sendBtn.onclick = sendMessage;
    }
    
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Tlačítko zpět - na mobilu vrátit k seznamu konverzací
    if (backBtn) {
        backBtn.onclick = () => {
            currentConversationId = null;
            document.body.classList.remove('chat-active');
            renderConversations();
            renderMessages();
        };
    }
    
    // Inicializovat file input
    initFileInput();
    
    // Načíst konverzace
    await loadConversations();
    
    // Zpracovat URL parametry
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    const listingId = urlParams.get('listingId');
    const listingTitle = urlParams.get('listingTitle');
    const conversationId = urlParams.get('conversationId');
    
    if (userId && !conversationId) {
        // Vytvořit nebo najít konverzaci
        const convId = await findOrCreateConversation(userId, listingId, listingTitle);
        if (convId) {
            window.history.replaceState({}, '', `chat.html?conversationId=${convId}`);
            await openConversation(convId);
        }
    } else if (conversationId) {
        await openConversation(conversationId);
    }
}

// ============================================
// SPUŠTĚNÍ PO NAČTENÍ DOM
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export pro globální použití
window.openConversation = openConversation;


