console.log('🚀 Profile detail page loaded');
console.log('🔍 Script loading check - profile-detail.js loaded');

// Global variables
let currentProfileUser = null;
let userProfile = null;
let userServices = [];
let selectedReviewPhotos = []; // Pro nový systém recenzí

// Category names mapping
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

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Profile detail page DOM loaded');
    console.log('🔍 DOMContentLoaded listener triggered');
    
    // Check if back button exists and is clickable
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
        console.log('✅ Back button found:', backBtn);
        console.log('✅ Back button onclick:', backBtn.onclick);
        
        // Add event listener as backup
        backBtn.addEventListener('click', function(e) {
            console.log('🔙 Back button clicked via event listener');
            e.preventDefault();
            goBack();
        });
        
        console.log('✅ Event listener added to back button');
    } else {
        console.error('❌ Back button not found');
    }
    
    // Get user ID from URL parameters with robust fallbacks
    const userId = getRequestedUserId();
    
    console.log('🔍 URL params:', window.location.search);
    console.log('🔍 userId from URL:', userId);
    
    if (userId) {
        console.log('👤 Loading profile for user:', userId);
        console.log('🖼️ About to call loadProfileDetail...');
        try {
            await loadProfileDetail(userId);
            console.log('🖼️ loadProfileDetail completed');
        } catch (error) {
            console.error('🖼️ Error in loadProfileDetail:', error);
        }
    } else {
        console.error('❌ Missing user ID in URL');
        showError('Chyba: Chybí ID uživatele');
    }
});

// Extract userId from URL or referrer
function getRequestedUserId() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        let uid = params.get('userId') || params.get('uid') || params.get('sellerId');
        if (uid) return uid;
        // Try hash
        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            uid = hashParams.get('userId') || hashParams.get('uid') || hashParams.get('sellerId');
            if (uid) return uid;
        }
        // Try referrer (e.g., came from ad-detail.html?id=...&userId=...)
        if (document.referrer) {
            const refUrl = new URL(document.referrer, window.location.origin);
            const refParams = new URLSearchParams(refUrl.search || '');
            uid = refParams.get('userId') || refParams.get('uid') || refParams.get('sellerId');
            if (uid) return uid;
        }
    } catch (e) {
        console.warn('⚠️ getRequestedUserId fallback error:', e);
    }
    return null;
}

// Load profile detail
async function loadProfileDetail(userId) {
    try {
        console.log('🖼️ loadProfileDetail called for userId:', userId);
        showLoading();
        
        // Load user profile data
        console.log('🖼️ Loading user profile...');
        await loadUserProfile(userId);
        console.log('🖼️ User profile loaded');
        
        // Load user services
        console.log('🖼️ Loading user services...');
        await loadUserServices(userId);
        console.log('🖼️ User services loaded');
        
        // Display profile (recenze se načtou v displayProfile pomocí nového modulu)
        console.log('🖼️ Calling displayProfile...');
        displayProfile();
        console.log('🖼️ displayProfile called');
        
        hideLoading();
        console.log('🖼️ Profile loading completed');
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        showError('Chyba při načítání profilu: ' + error.message);
    }
}

// Load user profile data
async function loadUserProfile(userId) {
    try {
        console.log('🖼️ loadUserProfile called for userId:', userId);
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Try to load from users/{userId}/profile/profile first
        const profileRef = doc(window.firebaseDb, 'users', userId, 'profile', 'profile');
        console.log('🖼️ Trying to load from users/{userId}/profile/profile');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            userProfile = profileSnap.data();
            console.log('✅ Profile loaded from users/{userId}/profile/profile:', userProfile);
            console.log('📝 firstName v profilu:', userProfile.firstName);
            console.log('📝 lastName v profilu:', userProfile.lastName);
        } else {
            console.log('🖼️ Profile not found in users/{userId}/profile/profile, trying fallback');
            // Fallback to users/{userId}
            const userRef = doc(window.firebaseDb, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                userProfile = userSnap.data();
                console.log('✅ Profile loaded from users/{userId}:', userProfile);
            } else {
                console.error('❌ Profile not found in any location');
                throw new Error('Profil uživatele nebyl nalezen');
            }
        }
        
        // Load user basic info
        console.log('🖼️ Loading user basic info from users/{userId}');
        const userRef = doc(window.firebaseDb, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            currentProfileUser = userSnap.data();
            currentProfileUser.id = userId;
            currentProfileUser.uid = userId; // Pro kompatibilitu s reviews systémem
            console.log('✅ User basic info loaded:', currentProfileUser);
            // Sloučit základní info s profilem pro lepší fallbacky při zobrazení
            // DŮLEŽITÉ: pole z profilu (userProfile) mají přednost před polem ze základního dokumentu (currentProfileUser)
            // Zachovat firstName a lastName z profilu, pokud existují
            const profileFirstName = userProfile.firstName;
            const profileLastName = userProfile.lastName;
            userProfile = { ...currentProfileUser, ...userProfile };
            // Zajistit, že firstName a lastName z profilu se nepřepíšou
            if (profileFirstName !== undefined) userProfile.firstName = profileFirstName;
            if (profileLastName !== undefined) userProfile.lastName = profileLastName;
            console.log('🧩 Merged userProfile for display:', userProfile);
            console.log('📝 Po sloučení - firstName:', userProfile.firstName, 'lastName:', userProfile.lastName);
        } else {
            console.error('❌ User basic info not found');
            throw new Error('Základní informace o uživateli nebyly nalezeny');
        }
        
        console.log('🖼️ loadUserProfile completed successfully');
        
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        throw error;
    }
}

// Load user services
async function loadUserServices(userId) {
    try {
        console.log('🔍 Loading services for user:', userId);
        const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        if (!window.firebaseDb) {
            throw new Error('Firebase DB není dostupný');
        }
        
        // Load user's services
        const servicesRef = collection(window.firebaseDb, 'users', userId, 'inzeraty');
        console.log('📁 Services reference:', servicesRef.path);
        
        const servicesSnap = await getDocs(servicesRef);
        console.log('📊 Services snapshot size:', servicesSnap.size);
        
        userServices = [];
        servicesSnap.forEach(doc => {
            const serviceData = doc.data();
            serviceData.id = doc.id;
            console.log('📄 Service data:', doc.id, {
                title: serviceData.title,
                category: serviceData.category,
                status: serviceData.status
            });
            userServices.push(serviceData);
        });
        
        console.log('✅ User services loaded:', userServices.length);
        
        if (userServices.length === 0) {
            console.warn('⚠️ Žádné služby nenalezeny pro uživatele:', userId);
            console.warn('⚠️ Zkontrolujte, zda existují dokumenty v: users/' + userId + '/inzeraty/');
        }
        
    } catch (error) {
        console.error('❌ Error loading user services:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        userServices = [];
        
        // Zobrazit uživatelsky přívětivou chybu
        if (error.code === 'permission-denied') {
            console.error('❌ Permission denied - zkontrolujte Firestore pravidla!');
        }
    }
}

// Načíst a zobrazit recenze pomocí nového modulu
async function displayUserReviewsNew() {
    if (!currentProfileUser || !currentProfileUser.uid) {
        console.warn('⚠️ No profile user to load reviews for');
        return;
    }
    
    const container = document.getElementById('userReviewsGrid');
    if (!container) {
        console.error('❌ Reviews container not found');
        return;
    }
    
    try {
        // Počkat na načtení reviews modulu
        if (!window.ReviewsSystem || !window.fetchReviewsForTarget) {
            console.log('⏳ Waiting for reviews module...');
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (window.ReviewsSystem && window.fetchReviewsForTarget) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }
        
        console.log('📖 Loading reviews for target:', currentProfileUser.uid);
        const reviews = await window.fetchReviewsForTarget(currentProfileUser.uid, {
            orderBy: 'createdAt',
            orderDirection: 'desc'
        });
        
        console.log('✅ Loaded reviews:', reviews.length);
        await window.renderReviews(container, reviews, {
            showAuthorName: true,
            showPhotos: true
        });
        
    } catch (error) {
        console.error('❌ Error loading reviews:', error);
        // Pro nepřihlášené uživatele zobrazit prázdný stav místo chyby
        const currentUser = window.firebaseAuth?.currentUser;
        if (!currentUser && error.message && error.message.includes('oprávnění')) {
            // Nepřihlášený uživatel - zobrazit prázdný stav
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 2px dashed #e5e7eb;">
                    <i class="fas fa-star" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                    <p style="font-size: 16px; color: #6b7280; margin: 0; font-weight: 500;">Zatím žádné recenze</p>
                </div>
            `;
        } else {
            // Přihlášený uživatel nebo jiná chyba - zobrazit chybovou zprávu
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc2626;">
                    <p>Chyba při načítání recenzí: ${error.message}</p>
                </div>
            `;
        }
    }
}

// Display profile
// Zkontrolovat přihlášení a zobrazit/skrýt formulář pro recenze
async function checkAuthAndShowReviewForm() {
    try {
        const currentUser = window.firebaseAuth?.currentUser;
        const writeReviewBtn = document.getElementById('writeReviewBtn');
        
        if (!writeReviewBtn) return;
        
        // Zobrazit formulář pro všechny přihlášené uživatele
        if (currentUser) {
            // Zkontrolovat, zda uživatel nesnaží recenzovat sám sebe
            const targetUserId = currentProfileUser?.uid || currentProfileUser?.id;
            if (targetUserId && currentUser.uid === targetUserId) {
                // Uživatel nemůže recenzovat sám sebe
                writeReviewBtn.style.display = 'none';
            } else {
                writeReviewBtn.style.display = 'block';
            }
        } else {
            // Není přihlášen - skrýt formulář
            writeReviewBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('❌ Error in checkAuthAndShowReviewForm:', error);
        const writeReviewBtn = document.getElementById('writeReviewBtn');
        if (writeReviewBtn) {
            writeReviewBtn.style.display = 'none';
        }
    }
}

function displayProfile() {
    console.log('🖼️ displayProfile called');
    
    // Zkontrolovat přihlášení a zobrazit formulář pro recenze
    checkAuthAndShowReviewForm();
    console.log('🖼️ currentProfileUser:', currentProfileUser);
    console.log('🖼️ userProfile:', userProfile);
    console.log('🖼️ userServices:', userServices);
    
    if (!currentProfileUser) {
        console.error('❌ currentProfileUser is missing');
        showError('Základní informace o uživateli nejsou dostupné');
        return;
    }
    
    if (!userProfile) {
        console.error('❌ userProfile is missing');
        showError('Profil uživatele není dostupný');
        return;
    }
    
    console.log('🖼️ All profile data available, proceeding with display');
    
    // Update profile information
    console.log('🖼️ Updating profile info');
    updateProfileInfo();
    
    // Update profile stats
    console.log('🖼️ Updating profile stats');
    updateProfileStats();
    
    // Display user services
    console.log('🖼️ Displaying user services');
    displayUserServices();
    
    // Display user reviews pomocí nového modulu
    console.log('🖼️ Displaying user reviews');
    displayUserReviewsNew().catch(error => {
        console.error('❌ Error displaying reviews:', error);
    });
    
    console.log('🖼️ displayProfile completed');
}

// Update profile information
function updateProfileInfo() {
    console.log('🖼️ updateProfileInfo called');
    console.log('🖼️ userProfile:', userProfile);
    console.log('🖼️ currentProfileUser:', currentProfileUser);
    console.log('📝 firstName v updateProfileInfo:', userProfile?.firstName);
    console.log('📝 lastName v updateProfileInfo:', userProfile?.lastName);
    
    // Profile display name
    const displayName = (userProfile.name && userProfile.name.trim())
        ? userProfile.name.trim()
        : (userProfile.firstName || userProfile.lastName)
            ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
            : (currentProfileUser.email || 'Uživatel');
    
    console.log('🖼️ displayName:', displayName);
    
    // Update main profile info
    const profileNameEl = document.getElementById('profileName');
        const profileAvatarEl = document.getElementById('profileAvatar');
        const profileAvatarPh = document.getElementById('profileAvatarPlaceholder');
    const profileLocationEl = document.getElementById('profileLocation');
    const profileBioEl = document.getElementById('profileBio');
    
    console.log('🖼️ Profile elements found:', {
        profileName: !!profileNameEl,
            profileAvatar: !!profileAvatarEl,
        profileLocation: !!profileLocationEl,
        profileBio: !!profileBioEl
    });
    
    if (profileNameEl) profileNameEl.textContent = displayName;
        // Avatar z userProfile.photoURL / avatarUrl
        try {
            const STOCK_AVATAR_URL = 'data:image/svg+xml;base64,' + btoa('<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f77c00;stop-opacity:1" /><stop offset="100%" style="stop-color:#fdf002;stop-opacity:1" /></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#avatarGradient)"/><circle cx="64" cy="48" r="16" fill="white"/><path d="M32 88C32 80.268 38.268 74 46 74H82C89.732 74 96 80.268 96 88V128H32V88Z" fill="white"/></svg>');
            const avatarUrl = userProfile?.photoURL || userProfile?.avatarUrl || STOCK_AVATAR_URL;
            if (profileAvatarEl && profileAvatarPh) {
                profileAvatarEl.src = avatarUrl;
                profileAvatarEl.style.display = 'block';
                profileAvatarPh.style.display = 'none';
            }
        } catch (e) { /* noop */ }
    // Pro firmy použít businessAddress jako lokaci, jinak city nebo location
    let locationText = 'Lokace neuvedena';
    if (userProfile?.userType === 'company' || userProfile?.type === 'company') {
        // U firmy použít businessAddress jako lokaci
        locationText = userProfile.businessAddress || userProfile.location || userProfile.city || currentProfileUser.location || 'Lokace neuvedena';
    } else {
        // U fyzické osoby použít city nebo location
        locationText = userProfile.city || userProfile.location || currentProfileUser.location || 'Lokace neuvedena';
    }
    if (profileLocationEl) profileLocationEl.textContent = locationText;
    if (profileBioEl) {
        const bioText = userProfile.bio || userProfile.description || userProfile.businessDescription || 'Uživatel nezadal žádný popis.';
        // Zachovat odřádkování - escapovat HTML a převést \n na <br>
        const escapedText = bioText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        profileBioEl.innerHTML = escapedText.replace(/\n/g, '<br>');
    }
    
    // Update additional info (ICO, DIČ, Typ podnikání, Web, Město, Lokace) - v sekci s datem registrace
    const additionalInfoContainer = document.getElementById('profileAdditionalInfo');
    const viewer = window.firebaseAuth?.currentUser;
    const isCompany = userProfile?.userType === 'company' || userProfile?.type === 'company';
    
    if (additionalInfoContainer) {
        // Vyčistit existující obsah
        additionalInfoContainer.innerHTML = '';
        
        // Pomocná funkce pro přidání dalšího údaje ve stejném formátu jako datum registrace
        const addAdditionalItem = (icon, label, value, isLink = false) => {
            if (!value || value.trim() === '') return; // Zobrazit jen vyplněné údaje
            
            const item = document.createElement('div');
            item.className = 'ad-meta-item';
            
            const iconEl = document.createElement('i');
            iconEl.className = icon;
            
            const spanEl = document.createElement('span');
            
            // Přidat text před hodnotu s dvojtečkou
            const labelText = document.createTextNode(label + ': ');
            
            if (isLink) {
                const link = document.createElement('a');
                link.href = value.startsWith('http') ? value : `https://${value}`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = value.replace(/^https?:\/\//, '');
                link.style.color = 'inherit';
                link.style.textDecoration = 'none';
                link.onmouseover = () => link.style.textDecoration = 'underline';
                link.onmouseout = () => link.style.textDecoration = 'none';
                spanEl.appendChild(labelText);
                spanEl.appendChild(link);
            } else {
                spanEl.appendChild(labelText);
                spanEl.appendChild(document.createTextNode(value));
            }
            
            item.appendChild(iconEl);
            item.appendChild(spanEl);
            additionalInfoContainer.appendChild(item);
        };
        
        // Pro firmy zobrazit další údaje
        if (isCompany) {
            // IČ (pokud je vyplněno)
            const ico = userProfile.businessIco || userProfile.ico || userProfile.company?.ico || '';
            if (ico) {
                addAdditionalItem('fas fa-id-card', 'IČ', ico);
            }
            
            // DIČ (pokud je vyplněno)
            const dic = userProfile.businessDic || userProfile.company?.dic || '';
            if (dic) {
                addAdditionalItem('fas fa-file-invoice', 'DIČ', dic);
            }
            
            // Typ podnikání (pokud je vyplněn)
            const businessType = userProfile.businessType || '';
            if (businessType) {
                const typeLabels = {
                    'individual': 'OSVČ',
                    'company': 'Společnost',
                    'freelancer': 'Freelancer',
                    'other': 'Jiné'
                };
                addAdditionalItem('fas fa-briefcase', 'Typ podnikání', typeLabels[businessType] || businessType);
            }
            
            // Webová stránka (pokud je vyplněna)
            const website = userProfile.businessWebsite || userProfile.company?.website || '';
            if (website) {
                addAdditionalItem('fas fa-globe', 'Webová stránka', website, true);
            }
            
            // Město (businessAddress)
            const location = userProfile.businessAddress || userProfile.location || '';
            if (location) {
                addAdditionalItem('fas fa-map-marker-alt', 'Město', location);
            }
        } else {
            // Pro fyzické osoby zobrazit město (pokud je vyplněno)
            const city = userProfile.city || '';
            if (city) {
                addAdditionalItem('fas fa-map-marker-alt', 'Město', city);
            }
        }
    }
    
    // Update contact info - pouze jméno, email, telefon
    const contactInfoContainer = document.getElementById('profileContactInfo');
    
    if (contactInfoContainer) {
        // Vyčistit existující obsah
        contactInfoContainer.innerHTML = '';
        
        // Pomocná funkce pro přidání kontaktního údaje
        const addContactItem = (icon, label, value, isBlurred = false) => {
            if (!value || value.trim() === '') return; // Zobrazit jen vyplněné údaje
            
            const item = document.createElement('div');
            item.className = 'contact-item';
            
            const iconEl = document.createElement('i');
            iconEl.className = icon;
            
            const labelEl = document.createElement('span');
            labelEl.style.fontWeight = '600';
            labelEl.style.marginRight = '8px';
            labelEl.textContent = label + ':';
            
            const valueEl = document.createElement('span');
            valueEl.textContent = value;
            
            if (isBlurred && !viewer) {
                valueEl.classList.add('blurred-contact');
                valueEl.style.cursor = 'pointer';
                valueEl.onclick = () => {
                    if (typeof window.showAuthModal === 'function') {
                        window.showAuthModal('login');
                    }
                };
                
                // Zabránit kopírování zablurovaného kontaktu
                valueEl.addEventListener('copy', (e) => {
                    e.preventDefault();
                    return false;
                });
                valueEl.addEventListener('cut', (e) => {
                    e.preventDefault();
                    return false;
                });
                valueEl.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    return false;
                });
            }
            
            item.appendChild(iconEl);
            item.appendChild(labelEl);
            item.appendChild(valueEl);
            contactInfoContainer.appendChild(item);
        };
        
        // Jméno a příjmení - zobrazit samostatně pokud jsou k dispozici
        console.log('🖼️ Kontaktní informace - firstName:', userProfile.firstName, 'lastName:', userProfile.lastName);
        if (userProfile.firstName || userProfile.lastName) {
            // Pokud máme obě hodnoty, zobrazit samostatně
            if (userProfile.firstName && userProfile.lastName) {
                console.log('🖼️ Zobrazuji samostatně firstName a lastName');
                addContactItem('fas fa-user', 'Jméno', userProfile.firstName);
                addContactItem('fas fa-user', 'Příjmení', userProfile.lastName);
            } else if (userProfile.firstName) {
                // Pokud máme jen jméno
                console.log('🖼️ Zobrazuji jen firstName');
                addContactItem('fas fa-user', 'Jméno', userProfile.firstName);
            } else if (userProfile.lastName) {
                // Pokud máme jen příjmení
                console.log('🖼️ Zobrazuji jen lastName');
                addContactItem('fas fa-user', 'Příjmení', userProfile.lastName);
            }
        } else {
            // Fallback na displayName nebo název firmy
            console.log('🖼️ firstName a lastName nejsou k dispozici, používám displayName:', displayName);
            addContactItem('fas fa-user', 'Jméno', displayName);
        }
        
        // Email (pokud je vyplněn)
        const email = userProfile.email || currentProfileUser.email || '';
        if (email) {
            addContactItem('fas fa-envelope', 'Email', email, true);
        }
        
        // Telefon (pokud je vyplněn)
        const phone = userProfile.phone || currentProfileUser.phone || '';
        if (phone && phone !== 'Telefon neuveden') {
            // Formátovat telefon pro zobrazení
            let formattedPhone = phone;
            if (phone.startsWith('+420') && phone.length > 4) {
                const digits = phone.slice(4).replace(/\D/g, '');
                if (digits.length >= 9) {
                    formattedPhone = `+420 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`.trim();
                }
            }
            addContactItem('fas fa-phone', 'Telefon', formattedPhone, true);
        }
        
        // Pokud nejsou žádné kontaktní údaje (kromě jména)
        if (contactInfoContainer.children.length <= 1) {
            const noInfo = document.createElement('div');
            noInfo.className = 'contact-item';
            noInfo.style.color = '#6b7280';
            noInfo.style.fontStyle = 'italic';
            noInfo.textContent = 'Uživatel nezadal žádné další kontaktní údaje.';
            contactInfoContainer.appendChild(noInfo);
        }
    }
    
    // Update join date
    let joinDate = new Date();
    const createdAtValue = userProfile.createdAt;
    try {
        if (createdAtValue && typeof createdAtValue.toDate === 'function') {
            joinDate = createdAtValue.toDate();
        } else if (createdAtValue) {
            const parsed = new Date(createdAtValue);
            if (!isNaN(parsed)) joinDate = parsed;
        }
    } catch (e) {
        console.warn('⚠️ Unable to parse join date, using current date');
    }
    const profileJoinDateEl = document.getElementById('profileJoinDate');
    if (profileJoinDateEl) {
        const formattedDate = joinDate.toLocaleDateString('cs-CZ', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        profileJoinDateEl.textContent = `Registrován ${formattedDate}`;
    }
    
    console.log('🖼️ Profile info updated successfully');
}

// Update profile stats
function updateProfileStats() {
    console.log('🖼️ updateProfileStats called');
    console.log('🖼️ userServices:', userServices);
    
    // Active services count
    const activeServices = userServices.filter(service => service.status === 'active');
    console.log('🖼️ activeServices:', activeServices);
    
    // Update profile stats section
    const profileStatsEl = document.getElementById('profileStats');
    if (profileStatsEl) {
        profileStatsEl.textContent = `${activeServices.length} aktivních služeb`;
        console.log('🖼️ Profile stats updated:', profileStatsEl.textContent);
    } else {
        console.error('❌ Profile stats element not found');
    }
}

// Display user services
function displayUserServices() {
    console.log('🖼️ displayUserServices called');
    console.log('🖼️ userServices:', userServices);
    console.log('🖼️ userServices.length:', userServices.length);
    
    const servicesGrid = document.getElementById('userServicesGrid');
    console.log('🖼️ servicesGrid element:', servicesGrid);
    
    if (userServices.length === 0) {
        console.log('🖼️ No services found, showing message');
        servicesGrid.innerHTML = '<p class="no-services">Uživatel nemá žádné služby.</p>';
        return;
    }
    
    const activeServices = userServices.filter(service => service.status === 'active');
    console.log('🖼️ activeServices:', activeServices);
    console.log('🖼️ activeServices.length:', activeServices.length);
    
    if (activeServices.length === 0) {
        console.log('🖼️ No active services found, showing message');
        servicesGrid.innerHTML = '<p class="no-services">Uživatel nemá žádné aktivní služby.</p>';
        return;
    }
    
    console.log('🖼️ Creating service cards for:', activeServices.length, 'services');
    servicesGrid.innerHTML = activeServices.map(service => createServiceCard(service)).join('');
    console.log('🖼️ Service cards created and inserted');
    
    // Přidat event listenery pro obrázky - přidat třídu .loaded po načtení
    const images = servicesGrid.querySelectorAll('.ad-thumb img, .ad-thumb picture img');
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
}

// Create service card
function createServiceCard(service) {
    console.log('🖼️ Creating service card for:', service.title);
    console.log('🖼️ Full service data:', service);
    console.log('🖼️ Service images:', service.images);
    console.log('🖼️ Service image:', service.image);
    console.log('🖼️ Service photo:', service.photo);
    
    const categoryName = categoryNames[service.category] || service.category;
    const createdAt = service.createdAt ? service.createdAt.toDate() : new Date();
    const timeAgo = getTimeAgo(createdAt);
    
    // Získat URL obrázku - stejná logika jako v services.js
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
    if (!imageUrl || imageUrl.trim() === '' || imageUrl === 'undefined' || imageUrl === 'null') {
        imageUrl = '/fotky/vychozi-inzerat.png';
    }
    
    const escapedImageUrl = imageUrl.replace(/"/g, '&quot;');
    const defaultImageUrl = '/fotky/vychozi-inzerat.png';
    const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
    const escapedTitle = (service.title || '').replace(/"/g, '&quot;');
    
    // Optimalizace obrázků - přidat fetchpriority pro první viditelné
    const isFirstVisible = typeof createServiceCard.firstIndex === 'undefined';
    if (isFirstVisible) createServiceCard.firstIndex = 0;
    const isPriorityImage = createServiceCard.firstIndex < 3; // První 3 obrázky mají vysokou prioritu
    createServiceCard.firstIndex++;
    
    // Použít WebP pouze pro lokální obrázky (ze složky /fotky/)
    // Pro obrázky z Firebase Storage nepoužívat WebP, protože neexistují
    const isLocalImage = imageUrl.startsWith('/fotky/') || imageUrl.startsWith('./fotky/');
    
    // Optimalizovat Firebase Storage URL - přidat parametry pro rychlejší načítání
    let optimizedImageUrl = escapedImageUrl;
    if (!isLocalImage && imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const urlObj = new URL(imageUrl);
            const params = new URLSearchParams(urlObj.search);
            if (!params.has('alt')) {
                params.set('alt', 'media');
            }
            urlObj.search = params.toString();
            optimizedImageUrl = urlObj.toString().replace(/"/g, '&quot;');
        } catch (e) {
            if (!imageUrl.includes('alt=media')) {
                optimizedImageUrl = imageUrl + (imageUrl.includes('?') ? '&' : '?') + 'alt=media';
                optimizedImageUrl = optimizedImageUrl.replace(/"/g, '&quot;');
            }
        }
    }
    
    // Atributy pro optimalizaci
    const loadingAttr = isPriorityImage ? 'eager' : 'lazy';
    const fetchPriorityAttr = isPriorityImage ? ' fetchpriority="high"' : '';
    const widthHeightAttr = ' width="400" height="300"'; // Standardní rozměry pro karty
    
    let imageHtml;
    if (isLocalImage) {
        const webpUrl = imageUrl.replace(/\.(png|jpg|jpeg|PNG|JPG|JPEG)(\?.*)?$/, '.webp$2');
        const escapedWebpUrl = webpUrl.replace(/"/g, '&quot;');
        imageHtml = `<picture>
            <source srcset="${escapedWebpUrl}" type="image/webp">
            <img src="${escapedImageUrl}" alt="${escapedTitle}" loading="${loadingAttr}"${fetchPriorityAttr} decoding="async"${widthHeightAttr} onerror="this.onerror=null; this.src='${escapedDefaultUrl}';">
        </picture>`;
    } else {
        // Pro Firebase Storage obrázky nepoužívat WebP, s retry mechanismem včetně _200x200 varianty
        imageHtml = `<img src="${optimizedImageUrl}" alt="${escapedTitle}" loading="${loadingAttr}"${fetchPriorityAttr} decoding="async"${widthHeightAttr} onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; const newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg').replace('.jpg', '_200x200.jpg'); this.src = newUrl + (params ? '?' + params : ''); } else { this.onerror=null; this.src='${escapedDefaultUrl}'; }" data-retry="0" style="object-fit: cover; width: 100%; height: 100%;">`;
    }
    
    return `
        <div class="ad-card" onclick="viewService('${service.id}', '${currentProfileUser.id}')">
            <div class="ad-thumb">
                ${imageHtml}
            </div>
            <div class="ad-body">
                <h3 class="ad-title">${service.title}</h3>
                <div class="ad-meta-details">
                    <div class="ad-meta-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${getLocationName(service.location) || 'Lokace neuvedena'}</span>
                    </div>
                    <div class="ad-meta-item">
                        <i class="fas fa-tags"></i>
                        <span>${categoryName}</span>
                    </div>
                    <div class="ad-meta-item">
                        <i class="fas fa-tag"></i>
                        <span class="ad-price-value">${service.price || 'Cena na dotaz'}</span>
                    </div>
                    <div class="ad-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>${timeAgo}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Stará funkce displayUserReviews - nahrazena displayUserReviewsNew()
// Zachována pro kompatibilitu, ale už se nepoužívá
async function displayUserReviews() {
    console.warn('⚠️ displayUserReviews() is deprecated, using displayUserReviewsNew()');
    await displayUserReviewsNew();
}

// createReviewCard funkce byla odstraněna - používáme window.renderReviews() z reviews.js modulu

// View service
window.viewService = function(serviceId, userId) {
    window.location.href = `ad-detail.html?id=${serviceId}&userId=${userId}`;
};

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

// Start chat
window.startChat = async function() {
    console.log('💬 Starting chat...');
    console.log('👤 Current profile user:', currentProfileUser);
    
    if (!currentProfileUser) {
        console.error('❌ No current profile user available');
        showError('Chyba: Uživatel není načten');
        return;
    }
    
    if (!currentProfileUser.id) {
        console.error('❌ No user ID in profile');
        showError('Chyba: ID uživatele není dostupné');
        return;
    }
    
    // Kontrola přihlášení
    const authUser = window.firebaseAuth?.currentUser;
    console.log('👤 Current user:', authUser);
    if (!authUser) {
        // Rovnou otevřít modal pro přihlášení
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
        }
        return;
    }
    
    // Kontrola, že uživatel nekontaktuje sám sebe
    if (currentProfileUser.id === authUser.uid) {
        showError('Nemůžete kontaktovat sami sebe');
        return;
    }
    
    console.log('✅ Login check passed, contacting user...');
    
    // Redirect to chat with user
    window.location.href = `chat.html?userId=${currentProfileUser.id}`;
};

// Go back
window.goBack = function() {
    console.log('🔙 goBack called');
    console.log('🔙 History length:', window.history.length);
    console.log('🔙 Current URL:', window.location.href);
    
    try {
        // Check if we have history to go back to
        if (window.history.length > 1) {
            console.log('🔙 Going back in history');
            window.history.back();
        } else {
            console.log('🔙 No history, redirecting to services');
            // If no history, redirect to services page
            window.location.href = 'services.html';
        }
    } catch (error) {
        console.error('❌ Error in goBack:', error);
        // Fallback: redirect to services page
        window.location.href = 'services.html';
    }
};

// Alternative back function with more robust logic
window.goBackAlternative = function() {
    console.log('🔙 goBackAlternative called');
    
    // Try to get referrer
    const referrer = document.referrer;
    console.log('🔙 Referrer:', referrer);
    
    if (referrer && referrer.includes(window.location.origin)) {
        console.log('🔙 Going back to referrer');
        window.location.href = referrer;
    } else {
        console.log('🔙 No valid referrer, going to services');
        window.location.href = 'services.html';
    }
};

// Utility functions
function showLoading() {
    // Hide content and show loading
    const content = document.querySelector('.ad-detail-content');
    if (content) {
        content.style.opacity = '0.5';
    }
}

function hideLoading() {
    // Show content
    const content = document.querySelector('.ad-detail-content');
    if (content) {
        content.style.opacity = '1';
    }
}

function showError(message) {
    alert(message);
}

function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Dnes';
    if (days === 1) return 'Včera';
    if (days < 7) return `Před ${days} dny`;
    if (days < 30) return `Před ${Math.floor(days / 7)} týdny`;
    if (days < 365) return `Před ${Math.floor(days / 30)} měsíci`;
    return `Před ${Math.floor(days / 365)} lety`;
}

// ===== RECENZE FUNKCE (NOVÝ SYSTÉM) =====

let selectedRating = 0;

// Zobrazit/skrýt formulář pro recenzi
function toggleReviewForm() {
    const form = document.getElementById('reviewFormSection');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        
        // Scroll k formuláři pokud se zobrazuje
        if (form.style.display === 'block') {
            form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// Zvýraznit hvězdičky při hover
function highlightStars(rating) {
    const stars = document.querySelectorAll('#reviewStars i');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.className = 'fas fa-star';
            star.style.color = '#f77c00';
        } else {
            star.className = 'far fa-star';
            star.style.color = '#d1d5db';
        }
    });
}

// Vybrat hodnocení
function selectRating(rating) {
    selectedRating = rating;
    highlightStars(rating);
    console.log('⭐ Vybráno hodnocení:', rating);
}

// Odeslat recenzi pomocí nového modulu
async function submitReview() {
    console.log('📝 submitReview() called');
    
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        console.warn('⚠️ User not logged in');
        alert('Pro napsání recenze se musíte přihlásit');
        return;
    }
    
    if (!currentProfileUser) {
        console.error('❌ currentProfileUser is null');
        alert('Chyba: Profil uživatele není načten');
        return;
    }
    
    const targetUserId = currentProfileUser.uid || currentProfileUser.id;
    if (!targetUserId) {
        console.error('❌ targetUserId is missing', currentProfileUser);
        alert('Chyba: ID uživatele není dostupné');
        return;
    }
    
    if (currentUser.uid === targetUserId) {
        alert('Nemůžete hodnotit sami sebe');
        return;
    }
    
    if (selectedRating === 0) {
        alert('Prosím vyberte hodnocení (1-5 hvězdiček)');
        return;
    }
    
    const reviewText = document.getElementById('reviewText')?.value?.trim();
    if (!reviewText) {
        alert('Prosím napište text recenze');
        return;
    }
    
    console.log('📝 Review data:', {
        targetUserId,
        rating: selectedRating,
        textLength: reviewText.length,
        photosCount: selectedReviewPhotos.length
    });
    
    try {
        // Počkat na načtení reviews modulu
        if (!window.ReviewsSystem || !window.createReview) {
            console.log('⏳ Waiting for reviews module...');
            console.log('⏳ window.ReviewsSystem:', typeof window.ReviewsSystem);
            console.log('⏳ window.createReview:', typeof window.createReview);
            
            // Zkusit načíst modul dynamicky, pokud není dostupný
            if (!window.ReviewsSystem && !document.querySelector('script[src*="reviews.js"]')) {
                console.log('⏳ Loading reviews.js dynamically...');
                const script = document.createElement('script');
                script.src = 'reviews.js';
                script.type = 'text/javascript';
                script.onload = () => console.log('✅ reviews.js loaded dynamically');
                script.onerror = () => {
                    console.error('❌ Error loading reviews.js from root, trying js/ folder...');
                    const script2 = document.createElement('script');
                    script2.src = 'js/reviews.js';
                    script2.type = 'text/javascript';
                    script2.onload = () => console.log('✅ reviews.js loaded from js/ folder');
                    script2.onerror = () => console.error('❌ Error loading reviews.js from js/ folder too');
                    document.head.appendChild(script2);
                };
                document.head.appendChild(script);
            }
            
            let waitCount = 0;
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    waitCount++;
                    if (window.ReviewsSystem && window.createReview) {
                        console.log('✅ Reviews module loaded after', waitCount * 100, 'ms');
                        clearInterval(checkInterval);
                        resolve();
                    } else if (waitCount > 100) { // Max 10 sekund
                        clearInterval(checkInterval);
                        console.error('❌ Reviews module timeout:', {
                            ReviewsSystem: typeof window.ReviewsSystem,
                            createReview: typeof window.createReview,
                            allScripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
                        });
                        reject(new Error('Reviews modul se nenačetl! Zkontrolujte, zda existuje soubor reviews.js'));
                    }
                }, 100);
            });
        }
        
        console.log('💾 Creating review with new system...');
        console.log('💾 ReviewsSystem available:', !!window.ReviewsSystem);
        console.log('💾 createReview available:', typeof window.createReview);
        console.log('💾 selectedReviewPhotos:', selectedReviewPhotos);
        console.log('💾 selectedReviewPhotos.length:', selectedReviewPhotos?.length);
        console.log('💾 selectedReviewPhotos type:', Array.isArray(selectedReviewPhotos) ? 'Array' : typeof selectedReviewPhotos);
        
        if (selectedReviewPhotos && selectedReviewPhotos.length > 0) {
            console.log('💾 Photo files details:', selectedReviewPhotos.map((f, i) => ({
                index: i,
                name: f.name,
                type: f.type,
                size: f.size
            })));
        }
        
        const reviewId = await window.createReview({
            targetUserId: targetUserId,
            rating: selectedRating,
            text: reviewText,
            files: selectedReviewPhotos || [],
            listingId: null
        });
        
        console.log('✅ Review created successfully:', reviewId);
        
        alert('✅ Děkujeme! Vaše recenze byla úspěšně přidána.');
        
        // Resetovat formulář
        selectedRating = 0;
        document.getElementById('reviewText').value = '';
        selectedReviewPhotos = [];
        document.getElementById('reviewPhotos').value = '';
        document.getElementById('reviewPhotosPreview').innerHTML = '';
        highlightStars(0);
        
        // Aktualizovat tlačítko a počet fotek
        const photosCount = document.getElementById('photosCount');
        const btn = document.getElementById('selectPhotosBtn');
        if (photosCount) photosCount.textContent = '';
        if (btn) {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
        
        toggleReviewForm();
        
        // Znovu načíst recenze
        await displayUserReviewsNew();
        
    } catch (error) {
        console.error('❌ Chyba při ukládání recenze:', error);
        alert('Nepodařilo se uložit recenzi: ' + error.message);
    }
}

// Handler pro změnu fotek v recenzi
function handleReviewPhotosChange(event) {
    console.log('📸 handleReviewPhotosChange called');
    const files = Array.from(event.target.files || []);
    console.log('📸 Files selected:', files.length, files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    const MAX_PHOTOS = 3;
    
    // Omezit na maximálně 3 fotky
    if (files.length > MAX_PHOTOS) {
        alert(`Můžete nahrát maximálně ${MAX_PHOTOS} fotky. První ${MAX_PHOTOS} byly vybrány.`);
        files.splice(MAX_PHOTOS);
    }
    
    // Přidat nové fotky k existujícím (pokud už nějaké jsou)
    const currentCount = selectedReviewPhotos.length;
    console.log('📸 Current selectedReviewPhotos count:', currentCount);
    const remainingSlots = MAX_PHOTOS - currentCount;
    
    if (remainingSlots <= 0) {
        alert(`Můžete nahrát maximálně ${MAX_PHOTOS} fotky.`);
        event.target.value = '';
        return;
    }
    
    const filesToAdd = files.slice(0, remainingSlots);
    console.log('📸 Files to add:', filesToAdd.length, filesToAdd.map(f => ({ name: f.name, type: f.type, size: f.size })));
    selectedReviewPhotos = [...selectedReviewPhotos, ...filesToAdd];
    console.log('📸 selectedReviewPhotos after adding:', selectedReviewPhotos.length, selectedReviewPhotos.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    // Aktualizovat input (aby se dalo znovu vybrat stejný soubor)
    const dataTransfer = new DataTransfer();
    selectedReviewPhotos.forEach(file => dataTransfer.items.add(file));
    event.target.files = dataTransfer.files;
    
    // Zobrazit preview
    updatePhotosPreview();
}

// Aktualizovat preview fotek
function updatePhotosPreview() {
    const preview = document.getElementById('reviewPhotosPreview');
    if (!preview) return;
    
    // Aktualizovat tlačítko a počet
    const btn = document.getElementById('selectPhotosBtn');
    const btnText = document.getElementById('selectPhotosBtnText');
    const photosCount = document.getElementById('photosCount');
    
    if (btn && btnText && photosCount) {
        if (selectedReviewPhotos.length > 0) {
            photosCount.textContent = `(${selectedReviewPhotos.length}/3)`;
            if (selectedReviewPhotos.length >= 3) {
                btn.style.opacity = '0.6';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        } else {
            photosCount.textContent = '';
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }
    
    if (selectedReviewPhotos.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    // Vytvořit preview HTML s placeholderem
    preview.innerHTML = selectedReviewPhotos.map((file, index) => {
        return `
            <div style="position: relative; width: 100%;">
                <div data-index="${index}" style="
                    width: 100%; 
                    height: 100px; 
                    border-radius: 8px; 
                    border: 2px solid #e5e7eb; 
                    background: #f3f4f6; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    overflow: hidden;
                ">
                    <i class="fas fa-spinner fa-spin" style="color: #9ca3af; font-size: 24px;"></i>
                </div>
                <button type="button" 
                        onclick="removeReviewPhoto(${index})" 
                        style="
                            position: absolute;
                            top: 6px;
                            right: 6px;
                            background: rgba(220, 38, 38, 0.95);
                            color: white;
                            border: none;
                            border-radius: 50%;
                            width: 28px;
                            height: 28px;
                            cursor: pointer;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            transition: all 0.2s;
                            z-index: 10;
                        " 
                        onmouseover="this.style.background='rgba(220, 38, 38, 1)'; this.style.transform='scale(1.1)'"
                        onmouseout="this.style.background='rgba(220, 38, 38, 0.95)'; this.style.transform='scale(1)'"
                        title="Odstranit fotku">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
    
    // Načíst preview pro všechny obrázky
    selectedReviewPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const container = preview.querySelector(`[data-index="${index}"]`);
            if (container) {
                container.innerHTML = `<img src="${e.target.result}" alt="Preview ${index + 1}" style="width: 100%; height: 100px; object-fit: cover; display: block;">`;
            }
        };
        reader.onerror = () => {
            console.error('Error loading preview for file:', file.name);
            const container = preview.querySelector(`[data-index="${index}"]`);
            if (container) {
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc2626;"><i class="fas fa-exclamation-triangle"></i> Chyba</div>`;
            }
        };
        reader.readAsDataURL(file);
    });
}

// Odstranit fotku z výběru
function removeReviewPhoto(index) {
    if (index < 0 || index >= selectedReviewPhotos.length) return;
    
    selectedReviewPhotos.splice(index, 1);
    
    // Aktualizovat input
    const input = document.getElementById('reviewPhotos');
    if (input) {
        const dataTransfer = new DataTransfer();
        selectedReviewPhotos.forEach(file => dataTransfer.items.add(file));
        input.files = dataTransfer.files;
    }
    
    // Aktualizovat preview
    updatePhotosPreview();
}

// Export funkcí pro globální použití
window.toggleReviewForm = toggleReviewForm;
window.highlightStars = highlightStars;
window.selectRating = selectRating;
window.submitReview = submitReview;
window.handleReviewPhotosChange = handleReviewPhotosChange;
window.removeReviewPhoto = removeReviewPhoto;

// Debug: zkontrolovat, zda jsou funkce dostupné
console.log('✅ Profile detail functions exported:', {
    toggleReviewForm: typeof window.toggleReviewForm,
    highlightStars: typeof window.highlightStars,
    selectRating: typeof window.selectRating,
    submitReview: typeof window.submitReview,
    handleReviewPhotosChange: typeof window.handleReviewPhotosChange,
    removeReviewPhoto: typeof window.removeReviewPhoto
});

