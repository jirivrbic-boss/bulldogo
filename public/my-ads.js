// My Ads JavaScript - Správa vlastních inzerátů

let userAds = [];
let currentEditingAdId = null;
let currentEditingImages = []; // Aktuální seznam obrázků při editaci
let imagesToDelete = []; // Obrázky k smazání
let newImagesToUpload = []; // Nové obrázky k nahrání

// Inicializace po načtení Firebase
document.addEventListener('DOMContentLoaded', () => {
    console.log('My Ads DOMContentLoaded');
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDb) {
            console.log('Firebase nalezen v My Ads, inicializuji');
            initMyAds();
            clearInterval(checkFirebase);
        } else {
            console.log('Čekám na Firebase v My Ads...');
        }
    }, 100);
});

// Inicializace stránky
function initMyAds() {
    console.log('Inicializuji My Ads stránku');
    
    // Nastavit callback pro aktualizaci po přihlášení
    window.afterLoginCallback = function() {
        console.log('🔄 Callback po přihlášení na stránce My Ads');
        const user = window.firebaseAuth?.currentUser;
        if (user) {
            updateUI(user);
            loadUserAds();
        }
    };
    
    // Import Firebase funkcí dynamicky
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
        console.log('Firebase Auth importován');
        // Sledování stavu přihlášení
        onAuthStateChanged(window.firebaseAuth, (user) => {
            console.log('Auth state changed:', user);
            if (user) {
                console.log('Uživatel přihlášen, načítám UI a inzeráty');
                updateUI(user);
                loadUserAds();
                // Spustit periodickou kontrolu expirace TOP inzerátů
            } else {
                console.log('Uživatel není přihlášen');
                console.log('Firebase Auth objekt:', window.firebaseAuth);
                console.log('Aktuální URL:', window.location.href);
                
                // Zastavit periodickou kontrolu při odhlášení
                
                // Zobrazit zprávu místo okamžitého přesměrování
                const grid = document.getElementById('myAdsGrid');
                if (grid) {
                    grid.innerHTML = `
                        <div class="no-services">
                            <div class="no-services-icon">
                                <i class="fas fa-lock"></i>
                            </div>
                            <h3>Pro zobrazení vašich inzerátů se musíte přihlásit</h3>
                            <p>Přihlaste se pro správu vašich inzerátů.</p>
                            <div class="no-services-actions">
                                <button class="btn btn-primary btn-bulldogo" id="btnLoginMyAds">Přihlásit se</button>
                                <button class="btn btn-secondary" id="btnBackMyAds">Zpět na hlavní stránku</button>
                            </div>
                        </div>
                    `;
                    
                    // Přidat event listenery na tlačítka
                    const btnLogin = document.getElementById('btnLoginMyAds');
                    const btnBack = document.getElementById('btnBackMyAds');
                    
                    if (btnLogin) {
                        btnLogin.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (typeof window.showAuthModal === 'function') {
                                window.showAuthModal('login');
                            } else {
                                console.error('showAuthModal není dostupná');
                            }
                        });
                    }
                    
                    if (btnBack) {
                        btnBack.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = 'index.html';
                        });
                    }
                }
                
                // Dříve zde bylo automatické přesměrování. Necháme uživatele rozhodnout tlačítkem.
            }
        });
    });

    // Event listenery pro filtry a vyhledávání
    // POZOR: Název funkce je setupMyAdsEventListeners, aby nedošlo ke konfliktu s auth.js
    setupMyAdsEventListeners();
}

// Aktualizace UI podle stavu přihlášení
function updateUI(user) {
    const authSection = document.getElementById('authSection');
    const userProfileSection = document.getElementById('userProfileSection');
    
    if (user) {
        // Skrýt auth tlačítka a zobrazit user profil
        if (authSection) authSection.style.display = 'none';
        if (userProfileSection) {
            userProfileSection.style.display = 'block';
            
            // Aktualizovat email v user profilu
            const userEmail = userProfileSection.querySelector('.user-email');
            if (userEmail) {
                userEmail.textContent = user.email;
            }
            
            // Načíst a zobrazit profil uživatele
            loadUserProfile(user.uid).then(userProfile => {
                const userRole = userProfileSection.querySelector('.user-role');
                if (userRole) {
                    userRole.textContent = userProfile?.name || 'Uživatel';
                }
            });
        }
    } else {
        // Zobrazit auth tlačítka a skrýt user profil
        if (authSection) authSection.style.display = 'flex';
        if (userProfileSection) userProfileSection.style.display = 'none';
    }
}

// Načtení uživatelského profilu z Firestore (users/{uid}/profile/profile)
async function loadUserProfile(uid) {
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
        const snap = await getDoc(profileRef);
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        console.error('Chyba při načítání uživatelského profilu:', error);
        return null;
    }
}

// Načtení vlastních inzerátů uživatele
async function loadUserAds() {
    try {
        const currentUser = window.firebaseAuth.currentUser;
        console.log('Načítám inzeráty pro uživatele:', currentUser?.uid);
        if (!currentUser) {
            console.log('Uživatel není přihlášen');
            return;
        }

        const { getDocs, collection, getDoc, doc, updateDoc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Nejdříve zkontrolovat, zda má uživatel aktivní předplatné
        const profileRef = doc(window.firebaseDb, 'users', currentUser.uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        let hasActivePlan = false;
        if (profileSnap.exists()) {
            const profile = profileSnap.data();
            const plan = profile.plan;
            
            if (plan && (plan === 'hobby' || plan === 'business')) {
                const planPeriodEnd = profile.planPeriodEnd;
                if (planPeriodEnd) {
                    const endDate = planPeriodEnd.toDate ? planPeriodEnd.toDate() : new Date(planPeriodEnd);
                    if (endDate >= new Date()) {
                        hasActivePlan = true;
                    }
                }
            }
        }
        
        // Načíst inzeráty
        const adsCollection = collection(window.firebaseDb, 'users', currentUser.uid, 'inzeraty');
        console.log('Provádím dotaz na Firestore (users/{uid}/inzeraty)...');
        const querySnapshot = await getDocs(adsCollection);
        console.log('Dotaz dokončen, počet dokumentů:', querySnapshot.size);
        
        userAds = [];
        const activeAdsToDeactivate = [];
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log('Načtený inzerát:', docSnap.id, data);
            userAds.push({ id: docSnap.id, ...data });
            
            // Pokud nemá aktivní plán a inzerát je aktivní, označit k deaktivaci
            if (!hasActivePlan && data.status === 'active') {
                activeAdsToDeactivate.push({ id: docSnap.id, ref: docSnap.ref });
            }
        });
        
        // Deaktivovat aktivní inzeráty, pokud nemá aktivní předplatné
        if (activeAdsToDeactivate.length > 0) {
            console.log(`🚫 Uživatel nemá aktivní předplatné, deaktivuji ${activeAdsToDeactivate.length} aktivních inzerátů`);
            const batch = writeBatch();
            const now = new Date();
            
            for (const ad of activeAdsToDeactivate) {
                batch.update(ad.ref, {
                    status: 'inactive',
                    inactiveReason: 'plan_expired',
                    inactiveAt: now,
                    updatedAt: now
                });
            }
            
            try {
                await batch.commit();
                console.log('✅ Aktivní inzeráty byly deaktivovány');
                
                // Aktualizovat lokální kopii inzerátů
                userAds.forEach(ad => {
                    if (ad.status === 'active' && activeAdsToDeactivate.find(a => a.id === ad.id)) {
                        ad.status = 'inactive';
                        ad.inactiveReason = 'plan_expired';
                        ad.inactiveAt = now;
                    }
                });
            } catch (error) {
                console.error('❌ Chyba při deaktivaci inzerátů:', error);
            }
        }
        
        // Seřadit podle data vytvoření (nejnovější první)
        userAds.sort((a, b) => {
            const dateA = new Date(a.createdAt?.toDate?.() || a.createdAt);
            const dateB = new Date(b.createdAt?.toDate?.() || b.createdAt);
            return dateB - dateA;
        });
        
        console.log('Celkem načteno inzerátů:', userAds.length);
        updateStats();
        displayAds(userAds);
        
    } catch (error) {
        console.error('Chyba při načítání inzerátů:', error);
        showError('Nepodařilo se načíst vaše inzeráty: ' + error.message);
    }
}

// Aktualizace statistik
function updateStats() {
    const totalAds = userAds.length;
    const activeAds = userAds.filter(ad => ad.status === 'active').length;
    
    const totalAdsElement = document.getElementById('totalAds');
    const activeAdsElement = document.getElementById('activeAds');
    
    if (totalAdsElement) {
        totalAdsElement.textContent = totalAds;
    }
    
    if (activeAdsElement) {
        activeAdsElement.textContent = activeAds;
    }
}

// Zobrazení inzerátů
function displayAds(ads) {
    const grid = document.getElementById('myAdsGrid');
    
    if (ads.length === 0) {
        grid.innerHTML = `
            <div class="no-services">
                <i class="fas fa-plus-circle"></i>
                <h3>Zatím nemáte žádné inzeráty</h3>
                <p>Začněte tím, že přidáte svou první službu!</p>
                <div class="no-services-actions">
                    <button class="btn-create-ad" onclick="window.location.href='create-ad.html'">
                        Přidat inzerát
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = ads.map(ad => createAdCard(ad)).join('');
}

// Vytvoření karty inzerátu
function createAdCard(ad) {
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
    
    const statusColors = {
        'active': '#28a745',
        'inactive': '#dc3545',
        'paused': '#ffc107'
    };
    
    const statusTexts = {
        'active': 'Aktivní',
        'inactive': 'Neaktivní',
        'paused': 'Pozastaveno'
    };
    
    // Kontrola, zda byl inzerát pozastaven kvůli vypršenému předplatnému
    const isPlanExpired = ad.inactiveReason === 'plan_expired';
    
    // Speciální text pro pozastavený kvůli předplatnému
    let statusText = statusTexts[ad.status] || ad.status;
    let statusColor = statusColors[ad.status] || '#dc3545';
    if (isPlanExpired) {
        statusText = 'Pozastaveno - Vypršelo předplatné';
        statusColor = '#ff6b35';
    }
    
    const topStyle = ad.isTop ? 'style="border: 3px solid #ff8a00 !important; box-shadow: 0 8px 28px rgba(255, 138, 0, 0.6), 0 0 0 2px rgba(255, 138, 0, 0.4) !important;"' : '';
    
    // Získání správné URL obrázku
    let imageUrl = 'fotky/team.jpg'; // default fallback
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
    }
    
    // Tlačítko aktivace - speciální text pro vypršelé předplatné
    const activateButton = isPlanExpired 
        ? `<button class="btn-activate" onclick="toggleAdStatus('${ad.id}', 'active')" title="Pro aktivaci je potřeba obnovit předplatné" style="background:#ff6b35;">
            <i class="fas fa-crown"></i>
           </button>`
        : `<button class="btn-activate" onclick="toggleAdStatus('${ad.id}', 'active')" title="Aktivovat">
            <i class="fas fa-play"></i>
           </button>`;
    
    return `
        <article class="ad-card${ad.isTop ? ' is-top' : ''}" ${topStyle}>
            <div class="ad-thumb">
                <img src="${imageUrl}" alt="Inzerát" loading="lazy" decoding="async">
            </div>
            <div class="ad-body">
                <h3 class="ad-title">${ad.title}</h3>
                <div class="ad-meta"><span>${ad.location}</span> • <span>${categoryNames[ad.category] || ad.category}</span></div>
                <div class="ad-status" style="background-color: ${statusColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 10px; font-size: 0.8rem; margin-top: 0.5rem; display: inline-block;">
                    ${statusText}
                </div>
                ${isPlanExpired ? `
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #ff6b35;">
                    <i class="fas fa-info-circle"></i> <a href="packages.html" style="color:#ff6b35; text-decoration:underline;">Obnovit předplatné</a> pro aktivaci
                </div>
                ` : ''}
            </div>
            ${ad.isTop ? `
            <div class="ad-badge-top"><i class="fas fa-fire"></i> TOP</div>
            <div class="ad-flames" aria-hidden="true"></div>
            ` : ''}
            <div class="ad-actions">
                <button class="btn-edit" onclick="editAd('${ad.id}')" title="Upravit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="deleteAd('${ad.id}')" title="Smazat">
                    <i class="fas fa-trash"></i>
                </button>
                ${ad.status === 'active' ? `
                <button class="btn-pause" onclick="toggleAdStatus('${ad.id}', 'paused')" title="Pozastavit">
                    <i class="fas fa-pause"></i>
                </button>
                ` : activateButton}
            </div>
        </article>
    `;
}

// Nastavení event listenerů pro my-ads stránku
// POZOR: Název změněn z setupEventListeners na setupMyAdsEventListeners, 
// aby nedošlo ke konfliktu s auth.js setupEventListeners()
function setupMyAdsEventListeners() {
    // Vyhledávání
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filterAds);
    }
    
    // Filtry
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterAds);
    }
    
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', sortAds);
    }
    
    // Edit service form
    const editServiceForm = document.getElementById('editServiceForm');
    if (editServiceForm) {
        console.log('Edit service form nalezen, nastavuji event listener');
        editServiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Edit service form odeslán');
            await updateAd();
        });
    } else {
        console.log('Edit service form NENALEZEN');
    }
}

// Filtrování inzerátů
function filterAds() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    
    let filteredAds = userAds.filter(ad => {
        const matchesSearch = ad.title.toLowerCase().includes(searchTerm) || 
                             ad.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || ad.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    // TOP inzeráty vždy první
    filteredAds.sort((a, b) => {
        if (a.isTop && !b.isTop) return -1;
        if (!a.isTop && b.isTop) return 1;
        return 0;
    });
    displayAds(filteredAds);
}

// Řazení inzerátů
function sortAds() {
    const sortBy = document.getElementById('sortSelect').value;
    let sortedAds = [...userAds];
    
    switch (sortBy) {
        case 'newest':
            sortedAds.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt));
            break;
        case 'oldest':
            sortedAds.sort((a, b) => new Date(a.createdAt?.toDate?.() || a.createdAt) - new Date(b.createdAt?.toDate?.() || b.createdAt));
            break;
        case 'title':
            sortedAds.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
    
    // TOP inzeráty vždy první bez ohledu na vybrané řazení
    sortedAds.sort((a, b) => {
        if (a.isTop && !b.isTop) return -1;
        if (!a.isTop && b.isTop) return 1;
        return 0;
    });
    displayAds(sortedAds);
}

// Funkce pro získání zbývajícího času TOP
function getTopTimeRemaining(ad) {
    if (!ad.isTop || !ad.topExpiresAt) return '';
    
    const expiresAt = ad.topExpiresAt.toDate ? ad.topExpiresAt.toDate() : new Date(ad.topExpiresAt);
    const now = new Date();
    const remainingMs = expiresAt - now;
    
    if (remainingMs <= 0) return '(vypršel)';
    
    const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    return `(${remainingMinutes}min)`;
}


// Parsování ceny z textu
function parsePrice(priceText) {
    if (!priceText || priceText.trim() === '' || priceText.toLowerCase().includes('dohodou')) {
        return { type: 'negotiable', value: null, from: null, to: null, unit: 'hour' };
    }
    
    // Rozpoznat rozmezí (např. "200 - 600 Kč/hod" nebo "200-600 Kč")
    const rangeMatch = priceText.match(/(\d+)\s*-\s*(\d+)\s*Kč(?:\/(\w+))?/);
    if (rangeMatch) {
        return {
            type: 'range',
            value: null,
            from: parseInt(rangeMatch[1]),
            to: parseInt(rangeMatch[2]),
            unit: rangeMatch[3] === 'práci' ? 'work' : 'hour'
        };
    }
    
    // Rozpoznat fixní cenu (např. "500 Kč/hod" nebo "500 Kč")
    const fixedMatch = priceText.match(/(\d+)\s*Kč(?:\/(\w+))?/);
    if (fixedMatch) {
        return {
            type: 'fixed',
            value: parseInt(fixedMatch[1]),
            from: null,
            to: null,
            unit: fixedMatch[2] === 'práci' ? 'work' : 'hour'
        };
    }
    
    return { type: 'negotiable', value: null, from: null, to: null, unit: 'hour' };
}

// Úprava inzerátu - přesměrování na samostatnou stránku
function editAd(adId) {
    console.log('EditAd volána s ID:', adId);
    const ad = userAds.find(a => a.id === adId);
    if (!ad) {
        console.log('Inzerát nenalezen:', adId);
        showMessage('Inzerát nebyl nalezen', 'error');
        return;
    }
    
    console.log('Našel inzerát:', ad);
    // Přesměrovat na stránku pro úpravu
    window.location.href = `edit-ad.html?id=${adId}`;
}

// Nastavení event listenerů pro obrázky v edit modalu
function setupEditImageListeners() {
    const previewImageInput = document.getElementById('editPreviewImage');
    const previewImagePreview = document.getElementById('editPreviewImagePreview');
    const noPreviewCheckbox = document.getElementById('editNoPreviewImage');
    const additionalImagesInput = document.getElementById('editAdditionalImages');
    const additionalImagesPreview = document.getElementById('editAdditionalImagesPreview');
    
    // Náhledový obrázek
    if (previewImageInput && previewImagePreview) {
        previewImageInput.onchange = function(e) {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImagePreview.innerHTML = `<img src="${e.target.result}" alt="Náhled" style="max-width: 100%; border-radius: 8px;">`;
                    previewImagePreview.classList.remove('empty');
                };
                reader.readAsDataURL(file);
            }
        };
    }
    
    // Checkbox "bez náhledového obrázku"
    if (noPreviewCheckbox && previewImageInput && previewImagePreview) {
        noPreviewCheckbox.onchange = function() {
            const checked = noPreviewCheckbox.checked;
            previewImageInput.required = !checked;
            previewImageInput.disabled = checked;
            if (checked) {
                previewImageInput.value = '';
                const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
                previewImagePreview.innerHTML = `<img src="${DEFAULT_PREVIEW_LOGO}" alt="Náhled" style="max-width: 100%; border-radius: 8px;">`;
            }
        };
    }
    
    // Další fotky
    if (additionalImagesInput && additionalImagesPreview) {
        additionalImagesInput.onchange = function(e) {
            const files = Array.from(e.target.files);
            const totalImages = currentEditingImages.length + newImagesToUpload.length + files.length;
            
            if (totalImages > 10) {
                showMessage('Můžete mít maximálně 10 fotek celkem.', 'error');
                e.target.value = '';
                return;
            }
            
            files.forEach(file => {
                newImagesToUpload.push(file);
                const reader = new FileReader();
                reader.onload = function(e) {
                    const imgDiv = document.createElement('div');
                    imgDiv.className = 'image-preview-item';
                    imgDiv.innerHTML = `
                        <img src="${e.target.result}" alt="Nová fotka">
                        <button type="button" class="remove-image-btn" onclick="removeNewEditImage('${file.name}')" title="Odebrat">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    additionalImagesPreview.appendChild(imgDiv);
                };
                reader.readAsDataURL(file);
            });
            
            e.target.value = '';
        };
    }
}

// Odebrat existující fotku z dalších fotek
function removeEditImage(index) {
    if (index === 0) return; // Nemůžeme smazat hlavní fotku tady
    const img = currentEditingImages[index];
    const imgUrl = typeof img === 'string' ? img : (img.url || img);
    if (imgUrl && !imgUrl.includes('vychozi-inzerat.png')) {
        imagesToDelete.push(imgUrl);
    }
    currentEditingImages.splice(index, 1);
    
    // Znovu zobrazit další fotky
    const additionalImagesPreview = document.getElementById('editAdditionalImagesPreview');
    if (additionalImagesPreview) {
        additionalImagesPreview.innerHTML = '';
        if (currentEditingImages.length > 1) {
            currentEditingImages.slice(1).forEach((img, idx) => {
                const imgUrl = typeof img === 'string' ? img : (img.url || img);
                if (imgUrl && !imagesToDelete.includes(imgUrl)) {
                    const imgDiv = document.createElement('div');
                    imgDiv.className = 'image-preview-item';
                    imgDiv.innerHTML = `
                        <img src="${imgUrl}" alt="Fotka ${idx + 2}">
                        <button type="button" class="remove-image-btn" onclick="removeEditImage(${idx + 1})" title="Odebrat">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    additionalImagesPreview.appendChild(imgDiv);
                }
            });
        }
    }
}

// Odebrat novou fotku před nahráním
function removeNewEditImage(fileName) {
    newImagesToUpload = newImagesToUpload.filter(f => f.name !== fileName);
    
    // Znovu zobrazit náhledy
    const additionalImagesPreview = document.getElementById('editAdditionalImagesPreview');
    if (additionalImagesPreview) {
        // Vymazat všechny nové fotky a znovu je přidat
        const existingPreviews = additionalImagesPreview.querySelectorAll('.image-preview-item');
        existingPreviews.forEach(el => {
            const img = el.querySelector('img');
            if (img && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
                // Toto je existující fotka, nechat
            } else {
                el.remove();
            }
        });
    
        // Přidat zbývající nové fotky
        newImagesToUpload.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imgDiv = document.createElement('div');
                imgDiv.className = 'image-preview-item';
                imgDiv.innerHTML = `
                    <img src="${e.target.result}" alt="Nová fotka">
                    <button type="button" class="remove-image-btn" onclick="removeNewEditImage('${file.name}')" title="Odebrat">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                additionalImagesPreview.appendChild(imgDiv);
            };
            reader.readAsDataURL(file);
        });
    }
}

// Nastavení event listenerů pro cenu v edit modalu
function setupEditPriceListeners() {
    const priceRadios = document.querySelectorAll('input[name="editPriceType"]');
    const priceInput = document.getElementById('editServicePrice');
    const priceFromInput = document.getElementById('editServicePriceFrom');
    const priceToInput = document.getElementById('editServicePriceTo');
    const unitPills = document.getElementById('editUnitPills');
    const inputsContainer = document.querySelector('#editServiceForm .price-inline .inputs');
    
    function onPriceTypeChange() {
        const sel = document.querySelector('input[name="editPriceType"]:checked');
        if (!sel) {
            if (inputsContainer) inputsContainer.style.display = 'none';
            if (unitPills) unitPills.style.display = 'none';
            return;
        }
        
        if (inputsContainer) inputsContainer.style.display = 'block';
        
        if (priceInput && priceFromInput && priceToInput && unitPills) {
            priceInput.style.display = 'none';
            priceFromInput.style.display = 'none';
            priceToInput.style.display = 'none';
            unitPills.style.display = 'none';
            priceInput.required = false;
            priceFromInput.required = false;
            priceToInput.required = false;
            
            if (sel.value === 'fixed') {
                unitPills.style.display = 'block';
                priceInput.style.display = 'block';
                priceInput.required = true;
            } else if (sel.value === 'range') {
                unitPills.style.display = 'block';
                priceFromInput.style.display = 'block';
                priceToInput.style.display = 'block';
                priceFromInput.required = true;
                priceToInput.required = true;
            } else {
                // negotiable
                if (inputsContainer) inputsContainer.style.display = 'none';
                if (unitPills) unitPills.style.display = 'none';
            }
        }
    }
    
    priceRadios.forEach(r => {
        r.addEventListener('change', onPriceTypeChange);
    });
    
    // Event listenery pro jednotky
    document.querySelectorAll('input[name="editPriceUnit"]').forEach(r => {
        r.addEventListener('change', function() {
            // Můžeme přidat další logiku pokud je potřeba
        });
    });
}

// Zobrazení fotek v edit modalu
function displayEditImages() {
    const container = document.getElementById('editImagesPreview');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Zobrazit existující fotky
    currentEditingImages.forEach((img, index) => {
        const imgUrl = typeof img === 'string' ? img : (img.url || img);
        if (!imgUrl || imagesToDelete.includes(imgUrl)) return;
        
        const imgDiv = document.createElement('div');
        imgDiv.className = 'edit-image-item';
        imgDiv.style.cssText = 'position: relative; border-radius: 10px; overflow: hidden; border: 2px solid ' + (index === 0 ? '#f77c00' : '#e5e7eb') + ';';
        
        const imgEl = document.createElement('img');
        imgEl.src = imgUrl;
        imgEl.style.cssText = 'width: 100%; height: 120px; object-fit: cover; display: block;';
        imgEl.alt = 'Fotka ' + (index + 1);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'position: absolute; top: 0; right: 0; display: flex; gap: 0.25rem; padding: 0.25rem;';
        
        if (index !== 0) {
            const setMainBtn = document.createElement('button');
            setMainBtn.innerHTML = '<i class="fas fa-star"></i>';
            setMainBtn.title = 'Nastavit jako hlavní';
            setMainBtn.style.cssText = 'background: rgba(247, 124, 0, 0.9); color: white; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;';
            setMainBtn.onclick = () => setMainImage(index);
            actionsDiv.appendChild(setMainBtn);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Smazat';
        deleteBtn.style.cssText = 'background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;';
        deleteBtn.onclick = () => deleteImage(index);
        actionsDiv.appendChild(deleteBtn);
        
        if (index === 0) {
            const mainLabel = document.createElement('div');
            mainLabel.textContent = 'Hlavní';
            mainLabel.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; background: rgba(247, 124, 0, 0.9); color: white; text-align: center; padding: 0.25rem; font-size: 0.75rem; font-weight: 600;';
            imgDiv.appendChild(mainLabel);
            }
        
        imgDiv.appendChild(imgEl);
        imgDiv.appendChild(actionsDiv);
        container.appendChild(imgDiv);
    });
    
    // Zobrazit náhledy nových fotek
    newImagesToUpload.forEach((file, index) => {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'edit-image-item';
        imgDiv.style.cssText = 'position: relative; border-radius: 10px; overflow: hidden; border: 2px dashed #d1d5db;';
        
        const imgEl = document.createElement('img');
        const reader = new FileReader();
        reader.onload = (e) => {
            imgEl.src = e.target.result;
        };
        reader.readAsDataURL(file);
        imgEl.style.cssText = 'width: 100%; height: 120px; object-fit: cover; display: block;';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.title = 'Odebrat';
        deleteBtn.style.cssText = 'position: absolute; top: 0; right: 0; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; margin: 0.25rem;';
        deleteBtn.onclick = () => {
            newImagesToUpload.splice(index, 1);
            displayEditImages();
        };
        
        imgDiv.appendChild(imgEl);
        imgDiv.appendChild(deleteBtn);
        container.appendChild(imgDiv);
    });
}

// Nastavit obrázek jako hlavní
function setMainImage(index) {
    if (index === 0) return;
    const img = currentEditingImages[index];
    currentEditingImages.splice(index, 1);
    currentEditingImages.unshift(img);
    displayEditImages();
}

// Smazat obrázek
function deleteImage(index) {
    const img = currentEditingImages[index];
    const imgUrl = typeof img === 'string' ? img : (img.url || img);
    if (imgUrl && !imgUrl.includes('bulldogo-logo.png')) {
        imagesToDelete.push(imgUrl);
    }
    currentEditingImages.splice(index, 1);
    displayEditImages();
}

// Zpracování nahrání nových fotek
function handleNewImagesUpload(e) {
    const files = Array.from(e.target.files);
    const totalImages = currentEditingImages.length + newImagesToUpload.length + files.length;
    
    if (totalImages > 10) {
        showMessage('Můžete mít maximálně 10 fotek celkem.', 'error');
        e.target.value = '';
        return;
    }
    
    newImagesToUpload.push(...files);
    displayEditImages();
    e.target.value = '';
}

// Sestavení textu ceny (stejně jako v create-ad.js)
function computeEditPriceText() {
    const priceType = document.querySelector('input[name="editPriceType"]:checked')?.value || 'negotiable';
    const unit = (document.querySelector('input[name="editPriceUnit"]:checked')?.value || 'hour');
    const unitText = unit === 'hour' ? 'hod' : '';
    const cur = 'Kč';
    
    if (priceType === 'fixed') {
        const val = (document.getElementById('editServicePrice')?.value || '').trim();
        if (!val) return '';
        const numVal = val.replace(/[^0-9]/g, '');
        if (!numVal) return '';
        return unitText ? `${numVal} ${cur}/${unitText}` : `${numVal} ${cur}`;
    } else if (priceType === 'range') {
        const from = (document.getElementById('editServicePriceFrom')?.value || '').trim();
        const to = (document.getElementById('editServicePriceTo')?.value || '').trim();
        if (!from || !to) return '';
        const numFrom = from.replace(/[^0-9]/g, '');
        const numTo = to.replace(/[^0-9]/g, '');
        if (!numFrom || !numTo) return '';
        const unitPart = unitText ? `/${unitText}` : '';
        return `${numFrom} - ${numTo} ${cur}${unitPart}`;
    }
    return 'Dohodou';
}

// Aktualizace inzerátu
async function updateAd() {
    try {
        console.log('UpdateAd volána, currentEditingAdId:', currentEditingAdId);
        if (!currentEditingAdId) {
            console.log('Žádné ID pro úpravu');
            return;
        }
        
        const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
        
        const storage = getStorage(window.firebaseApp);
        const userId = window.firebaseAuth.currentUser.uid;
        
        // Smazat označené obrázky
        for (const imgUrl of imagesToDelete) {
            try {
                // Extrahovat cestu z URL
                const urlParts = imgUrl.split('/o/');
                if (urlParts.length > 1) {
                    const path = decodeURIComponent(urlParts[1].split('?')[0]);
                    const imgRef = ref(storage, path);
                    await deleteObject(imgRef);
                    console.log('Obrázek smazán:', path);
                }
            } catch (deleteError) {
                console.error('Chyba při mazání obrázku:', deleteError);
            }
        }
        
        // Zpracovat náhledový obrázek
        const previewImageInput = document.getElementById('editPreviewImage');
        const noPreviewCheckbox = document.getElementById('editNoPreviewImage');
        let previewImageUrl = null;
        
        if (previewImageInput?.files?.[0]) {
            // Nahrát nový náhledový obrázek
            const imageRef = ref(storage, `services/${userId}/${Date.now()}_preview.jpg`);
            const imageSnapshot = await uploadBytes(imageRef, previewImageInput.files[0], {
                contentType: previewImageInput.files[0].type || 'image/jpeg'
            });
            previewImageUrl = await getDownloadURL(imageSnapshot.ref);
        } else if (noPreviewCheckbox?.checked) {
            // Použít výchozí logo
            previewImageUrl = '/fotky/vychozi-inzerat.png';
        } else if (currentEditingImages.length > 0) {
            // Zachovat existující první obrázek
            const firstImg = currentEditingImages[0];
            const firstImgUrl = typeof firstImg === 'string' ? firstImg : (firstImg.url || firstImg);
            if (firstImgUrl && !imagesToDelete.includes(firstImgUrl)) {
                previewImageUrl = firstImgUrl;
            } else {
                previewImageUrl = '/fotky/vychozi-inzerat.png';
            }
        } else {
            previewImageUrl = '/fotky/vychozi-inzerat.png';
        }
        
        // Nahrát nové další obrázky
        const uploadedImages = [];
        for (let i = 0; i < newImagesToUpload.length; i++) {
            const file = newImagesToUpload[i];
            const imageRef = ref(storage, `services/${userId}/${Date.now()}_${i}.jpg`);
            const imageSnapshot = await uploadBytes(imageRef, file, {
                contentType: file.type || 'image/jpeg'
            });
            const imageUrl = await getDownloadURL(imageSnapshot.ref);
            uploadedImages.push({
                url: imageUrl,
                isPreview: false,
                name: file.name
            });
        }
        
        // Kombinovat obrázky: náhledový + existující další (bez smazaných) + nové
        const finalImages = [];
        
        // Přidat náhledový obrázek
        if (previewImageUrl) {
            finalImages.push({
                url: previewImageUrl,
                isPreview: true
            });
        }
        
        // Přidat existující další obrázky (od druhé dál, bez smazaných)
        if (currentEditingImages.length > 1) {
            currentEditingImages.slice(1).forEach(img => {
                const imgUrl = typeof img === 'string' ? img : (img.url || img);
                if (imgUrl && !imagesToDelete.includes(imgUrl)) {
                    finalImages.push(typeof img === 'string' ? { url: imgUrl } : img);
                }
            });
        }
        
        // Přidat nové nahrané obrázky
        finalImages.push(...uploadedImages);
        
        const formData = new FormData(document.getElementById('editServiceForm'));
        const priceText = computeEditPriceText();
        
        const updateData = {
            title: formData.get('title'),
            category: formData.get('category'),
            description: formData.get('description'),
            price: priceText,
            location: formData.get('location'),
            status: formData.get('status'),
            images: finalImages,
            updatedAt: new Date()
        };
        
        console.log('Aktualizuji data:', updateData);
        await updateDoc(doc(window.firebaseDb, 'users', userId, 'inzeraty', currentEditingAdId), updateData);
        
        showMessage('Inzerát byl úspěšně aktualizován!', 'success');
        closeEditServiceModal();
        loadUserAds(); // Obnovit seznam
        
    } catch (error) {
        console.error('Chyba při aktualizaci inzerátu:', error);
        showMessage('Nepodařilo se aktualizovat inzerát.', 'error');
    }
}

// Přepnutí stavu inzerátu
async function toggleAdStatus(adId, targetStatus) {
    try {
        const { updateDoc, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // targetStatus je buď 'paused' nebo 'active'
        const newStatus = targetStatus === 'paused' ? 'inactive' : 'active';
        
        // Pokud se deaktivuje inzerát, zkontrolovat topování a předplatné
        if (newStatus === 'inactive') {
            // Načíst aktuální inzerát
            const adRef = doc(window.firebaseDb, 'users', window.firebaseAuth.currentUser.uid, 'inzeraty', adId);
            const adSnap = await getDoc(adRef);
            
            if (adSnap.exists()) {
                const adData = adSnap.data();
                const isTop = adData.isTop === true;
                
                // Pokud má inzerát zapnuté topování, zkontrolovat předplatné
                if (isTop) {
                    const profileRef = doc(window.firebaseDb, 'users', window.firebaseAuth.currentUser.uid, 'profile', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    
                    let hasActivePlan = false;
                    if (profileSnap.exists()) {
                        const profile = profileSnap.data();
                        const plan = profile.plan;
                        
                        if (plan && (plan === 'hobby' || plan === 'business')) {
                            const planPeriodEnd = profile.planPeriodEnd;
                            if (planPeriodEnd) {
                                const endDate = planPeriodEnd.toDate ? planPeriodEnd.toDate() : new Date(planPeriodEnd);
                                if (endDate >= new Date()) {
                                    hasActivePlan = true;
                                }
                            }
                        }
                    }
                    
                    // Pokud má aktivní předplatné a topování, zobrazit varování
                    if (hasActivePlan) {
                        showTopWarningModal(adId, targetStatus);
                        return;
                    }
                }
            }
        }
        
        // Pokud se aktivuje inzerát, zkontrolovat předplatné
        if (newStatus === 'active') {
            // Zkontrolovat aktivní předplatné
            const profileRef = doc(window.firebaseDb, 'users', window.firebaseAuth.currentUser.uid, 'profile', 'profile');
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                const profile = profileSnap.data();
                const plan = profile.plan;
                
                // Zkontrolovat, zda má aktivní předplatné
                if (!plan || (plan !== 'hobby' && plan !== 'business')) {
                    showMessage('Pro aktivaci inzerátu potřebujete aktivní předplatné (Hobby nebo Firma).', 'error');
                    setTimeout(() => {
                        window.location.href = 'packages.html';
                    }, 2000);
                    return;
                }
                
                // Zkontrolovat, zda předplatné nevypršelo
                const planPeriodEnd = profile.planPeriodEnd;
                if (planPeriodEnd) {
                    const endDate = planPeriodEnd.toDate ? planPeriodEnd.toDate() : new Date(planPeriodEnd);
                    if (endDate < new Date()) {
                        showMessage('Vaše předplatné vypršelo. Pro aktivaci inzerátu si prosím obnovte balíček.', 'error');
                        setTimeout(() => {
                            window.location.href = 'packages.html';
                        }, 2000);
                        return;
                    }
                }
            } else {
                showMessage('Pro aktivaci inzerátu potřebujete aktivní předplatné (Hobby nebo Firma).', 'error');
                setTimeout(() => {
                    window.location.href = 'packages.html';
                }, 2000);
                return;
            }
        }
        
        // Provedení deaktivace/aktivace
        await executeAdStatusChange(adId, newStatus);
        
    } catch (error) {
        console.error('Chyba při změně stavu inzerátu:', error);
        showMessage('Nepodařilo se změnit stav inzerátu.', 'error');
    }
}

// Provedení změny stavu inzerátu
async function executeAdStatusChange(adId, newStatus) {
    try {
        const { updateDoc, doc, deleteField } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Připravit data pro aktualizaci
        const updateData = {
            status: newStatus,
            updatedAt: new Date()
        };
        
        // Při aktivaci vymazat inactiveReason a inactiveAt
        if (newStatus === 'active') {
            updateData.inactiveReason = deleteField();
            updateData.inactiveAt = deleteField();
        }
        
        await updateDoc(doc(window.firebaseDb, 'users', window.firebaseAuth.currentUser.uid, 'inzeraty', adId), updateData);
        
        showMessage(`Inzerát byl ${newStatus === 'active' ? 'aktivován' : 'pozastaven'}!`, 'success');
        loadUserAds(); // Obnovit seznam
    } catch (error) {
        console.error('Chyba při změně stavu inzerátu:', error);
        showMessage('Nepodařilo se změnit stav inzerátu.', 'error');
    }
}

// Zobrazení varovného modalu pro topování
function showTopWarningModal(adId, targetStatus) {
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
            <h2 class="modal-top-warning-title">Varování: Topování pokračuje</h2>
            <p class="modal-top-warning-message">
                Váš inzerát má aktivní topování. I když inzerát deaktivujete, topování bude stále ubíhat a spotřebovávat se.
            </p>
            <div class="modal-top-warning-actions">
                <button class="btn btn-secondary" onclick="closeTopWarningModal()">
                    Zrušit
                </button>
                <button class="btn btn-primary" onclick="confirmDeactivateWithTop('${adId}', '${targetStatus}')">
                    Deaktivovat i přesto
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
}

// Zavření varovného modalu
function closeTopWarningModal() {
    const modal = document.getElementById('topWarningModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Potvrzení deaktivace i s topováním
async function confirmDeactivateWithTop(adId, targetStatus) {
    closeTopWarningModal();
    await executeAdStatusChange(adId, 'inactive');
}

// Smazání inzerátu
async function deleteAd(adId) {
    if (!confirm('Opravdu chcete smazat tento inzerát? Tato akce je nevratná.')) {
        return;
    }
    
    try {
        const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        await deleteDoc(doc(window.firebaseDb, 'users', window.firebaseAuth.currentUser.uid, 'inzeraty', adId));
        
        showMessage('Inzerát byl úspěšně smazán!', 'success');
        loadUserAds(); // Obnovit seznam
        
    } catch (error) {
        console.error('Chyba při mazání inzerátu:', error);
        showMessage('Nepodařilo se smazat inzerát.', 'error');
    }
}

// Zavření edit modalu
function closeEditServiceModal() {
    // Resetovat proměnné
    currentEditingImages = [];
    imagesToDelete = [];
    newImagesToUpload = [];
    const fileInput = document.getElementById('editAdditionalImages');
    if (fileInput) fileInput.value = '';
    document.getElementById('editServiceModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    currentEditingAdId = null;
    
    // Vyčištění formuláře
    document.getElementById('editServiceForm').reset();
}

// Zobrazení zprávy
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Zobrazení chyby
function showError(message) {
    const grid = document.getElementById('myAdsGrid');
    grid.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Chyba při načítání</h3>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="loadUserAds()">Zkusit znovu</button>
        </div>
    `;
}

// Přepínání dropdown menu
function toggleUserDropdown() {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Zavření dropdown menu při kliknutí mimo něj
function closeUserDropdown() {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// Event listenery
document.addEventListener('DOMContentLoaded', () => {
    // Zavření modalu při kliknutí mimo něj
    window.addEventListener('click', (e) => {
        const editServiceModal = document.getElementById('editServiceModal');
        const userDropdown = document.querySelector('.user-dropdown');
        
        if (e.target === editServiceModal) {
            closeEditServiceModal();
        }
        
        if (userDropdown && !userDropdown.contains(e.target)) {
            closeUserDropdown();
        }
    });
});

// Export funkcí pro globální použití
window.toggleUserDropdown = toggleUserDropdown;
// Topování inzerátu
function topovatAd(adId) {
    console.log('⭐ Topování inzerátu s ID:', adId);
    
    // Přesměrovat na stránku topování s předvybraným inzerátem
    window.location.href = `top-ads.html?adId=${adId}`;
}

window.closeUserDropdown = closeUserDropdown;
window.closeEditServiceModal = closeEditServiceModal;
window.editAd = editAd;
window.toggleAdStatus = toggleAdStatus;
window.deleteAd = deleteAd;
window.topovatAd = topovatAd;
window.removeEditImage = removeEditImage;
window.removeNewEditImage = removeNewEditImage;
window.removeEditImage = removeEditImage;
window.removeNewEditImage = removeNewEditImage;
