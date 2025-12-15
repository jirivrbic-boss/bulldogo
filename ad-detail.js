// Ad Detail Page JavaScript
let currentAd = null;
let adOwner = null;

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
    'specialized_custom': 'Specializované služby / na přání'
};

// Zamaskování telefonního čísla pro nepřihlášené návštěvníky
function maskPhone(input) {
	const s = (input || '').toString();
	// Ponechat předvolbu (např. +420) a zbytek nahradit tečkami/mezery
	const match = s.match(/^(\+?\d{3,4})(.*)$/);
	if (!match) return '••• ••• •••';
	const prefix = match[1];
	return prefix + ' ••• ••• •••';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Ad detail page loaded');
    
    // Get ad ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const adId = urlParams.get('id');
    const userId = urlParams.get('userId');
    
    if (adId && userId) {
        loadAdDetail(adId, userId);
    } else {
        console.error('❌ Missing ad ID or user ID in URL');
        showError('Chyba: Chybí ID inzerátu nebo uživatele');
    }
    
    // Auth is initialized automatically via auth.js

    // Robust napojení tlačítka Zpět (když inline onclick selže)
    try {
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.goBack === 'function') {
                    window.goBack();
                } else {
                    // Fallback
                    if (window.history.length > 1) window.history.back();
                    else window.location.href = 'services.html';
                }
            });
        }
    } catch (e) {
        console.warn('Back button wiring warning:', e);
    }
});

// Load ad detail
async function loadAdDetail(adId, userId) {
    try {
        console.log('📋 Loading ad detail:', adId, 'from user:', userId);
        
        const { getDoc, doc, collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Try to load ad data from different possible locations
        let adData = null;
        
        // First try: users/{userId}/inzeraty/{adId}
        try {
            const adRef = doc(window.firebaseDb, 'users', userId, 'inzeraty', adId);
            const adSnap = await getDoc(adRef);
            
            if (adSnap.exists()) {
                adData = adSnap.data();
                console.log('✅ Ad found in users/{userId}/inzeraty/{adId}');
            }
        } catch (error) {
            console.log('❌ Ad not found in users/{userId}/inzeraty/{adId}:', error);
        }
        
        // Second try: services collection
        if (!adData) {
            try {
                const servicesRef = collection(window.firebaseDb, 'services');
                const servicesQuery = query(servicesRef, where('id', '==', adId));
                const servicesSnap = await getDocs(servicesQuery);
                
                if (!servicesSnap.empty) {
                    adData = servicesSnap.docs[0].data();
                    console.log('✅ Ad found in services collection');
                }
            } catch (error) {
                console.log('❌ Ad not found in services collection:', error);
            }
        }
        
        if (!adData) {
            showError('Inzerát nebyl nalezen');
            return;
        }
        
        currentAd = {
            id: adId,
            userId: userId,
            ...adData
        };
        
        console.log('✅ Current ad loaded:', currentAd);
        
        // Load user profile data from users/{userId}/profile/profile
        try {
            const profileRef = doc(window.firebaseDb, 'users', userId, 'profile', 'profile');
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                adOwner = profileSnap.data();
                console.log('✅ User profile loaded from users/{userId}/profile/profile:', adOwner);
            } else {
                console.warn('⚠️ Profile not found in users/{userId}/profile/profile, trying fallback');
                // Fallback: načíst základní data z users/{userId}
                const userRef = doc(window.firebaseDb, 'users', userId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    // Použít alespoň email z user dokumentu
                    adOwner = {
                        name: userData.email?.split('@')[0] || 'Uživatel',
                        email: userData.email || 'N/A'
                    };
                    console.log('✅ User basic data loaded from fallback:', adOwner);
                } else {
                    console.warn('⚠️ User data not found anywhere');
                    adOwner = null;
                }
            }
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            adOwner = null;
        }
        
        // Display ad information
        console.log('🎨 Rendering ad detail:', currentAd);
        displayAdDetail();
        
        // Load user's other ads and update profile stats
        loadUserOtherAds(userId);
        
    } catch (error) {
        console.error('❌ Error loading ad detail:', error);
        showError('Chyba při načítání inzerátu');
    }
}

// Display ad detail
function displayAdDetail() {
    if (!currentAd) {
        console.error('❌ No current ad to display');
        return;
    }
    
    console.log('🖼️ Displaying ad detail:', currentAd);
    
    // Title and price
    document.getElementById('adTitle').textContent = currentAd.title || 'Bez názvu';
    
    // Formátování ceny - pokud je jen číslo, přidat Kč
    let formattedPrice = currentAd.price || '';
    if (formattedPrice && /^\d+$/.test(formattedPrice.toString().trim())) {
        // Pokud je cena jen číslo, přidat "Kč"
        formattedPrice = `${formattedPrice} Kč`;
    }
    document.getElementById('adPrice').textContent = formattedPrice || 'Cena na vyžádání';
    
    // Meta information
    document.getElementById('adLocation').textContent = getLocationName(currentAd.location) || 'Neznámá lokalita';
    document.getElementById('adCategory').textContent = getCategoryName(currentAd.category);
    
    // Debug date information
    console.log('📅 Raw createdAt:', currentAd.createdAt);
    console.log('📅 Formatted date:', formatDate(currentAd.createdAt));
    document.getElementById('adDate').textContent = formatDate(currentAd.createdAt);
    
    // Description
    document.getElementById('adDescription').textContent = currentAd.description || 'Bez popisu';
    
    // Contact information
    if (adOwner) {
        // Načíst jméno z profilu - může být v různých polích
        let displayName = 'Uživatel';
        if (adOwner.firstName && adOwner.lastName) {
            displayName = `${adOwner.firstName} ${adOwner.lastName}`.trim();
        } else if (adOwner.name) {
            displayName = adOwner.name;
        } else if (adOwner.displayName) {
            displayName = adOwner.displayName;
        } else if (adOwner.businessName) {
            displayName = adOwner.businessName;
        } else if (adOwner.companyName) {
            displayName = adOwner.companyName;
        } else if (adOwner.email) {
            displayName = adOwner.email.split('@')[0];
        }
        
        document.getElementById('adUser').textContent = displayName;
        
        const emailEl = document.getElementById('adEmail');
        const phoneEl = document.getElementById('adPhone');
        const fullEmail = adOwner.email || 'N/A';
        const fullPhone = adOwner.phone || adOwner.companyPhone || adOwner.telefon || 'N/A';
        const viewer = window.firebaseAuth?.currentUser;
        
        // Zobrazit/skrýt zprávu o přihlášení
        const loginMessageEl = document.getElementById('adContactLoginMessage');
        
        if (viewer) {
            // Přihlášený uživatel - zobrazit normálně
            emailEl.textContent = fullEmail;
            phoneEl.textContent = fullPhone;
            emailEl.classList.remove('blurred-contact');
            phoneEl.classList.remove('blurred-contact');
            emailEl.onclick = null;
            phoneEl.onclick = null;
            emailEl.style.cursor = 'default';
            phoneEl.style.cursor = 'default';
            if (loginMessageEl) loginMessageEl.style.display = 'none';
        } else {
            // Nepřihlášený uživatel - zobrazit s blur efektem
            emailEl.textContent = fullEmail;
            phoneEl.textContent = fullPhone;
            emailEl.classList.add('blurred-contact');
            phoneEl.classList.add('blurred-contact');
            emailEl.onclick = () => {
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal('login');
                }
            };
            phoneEl.onclick = () => {
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal('login');
                }
            };
            emailEl.style.cursor = 'pointer';
            phoneEl.style.cursor = 'pointer';
            if (loginMessageEl) loginMessageEl.style.display = 'block';
        }
        
        // Zobrazit jméno v profilu níže na stránce
        const userProfileNameEl = document.getElementById('userProfileName');
        if (userProfileNameEl) {
            userProfileNameEl.textContent = displayName;
            
            // Umožni klik na jméno uživatele pro otevření profilu
            try {
                userProfileNameEl.style.cursor = 'pointer';
                userProfileNameEl.setAttribute('title', 'Zobrazit profil');
                userProfileNameEl.onclick = () => {
                    window.location.href = `profile-detail.html?userId=${currentAd.userId}`;
                };
            } catch (e) {
                console.warn('User name link wiring warning:', e);
            }
        }
        
        console.log('👤 User contact info:', {
            name: adOwner.name,
            firstName: adOwner.firstName,
            lastName: adOwner.lastName,
            displayName: adOwner.displayName,
            businessName: adOwner.businessName,
            companyName: adOwner.companyName,
            email: adOwner.email,
            phone: adOwner.phone || adOwner.companyPhone || adOwner.telefon,
            displayNameFinal: displayName
        });
    } else {
        // Pokud není profil načtený, zobrazit výchozí hodnoty
        document.getElementById('adUser').textContent = 'Uživatel';
        document.getElementById('adEmail').textContent = 'N/A';
        document.getElementById('adPhone').textContent = 'N/A';
        const userProfileNameEl = document.getElementById('userProfileName');
        if (userProfileNameEl) {
            userProfileNameEl.textContent = 'Uživatel';
        }
    }
    
    // Images
    console.log('🖼️ Ad images:', currentAd.images);
    if (currentAd.images && currentAd.images.length > 0) {
        // Extract image URLs from the images array
        const imageUrls = currentAd.images.map(img => {
            if (typeof img === 'string') {
                return img;
            } else if (img && img.url) {
                return img.url;
            }
            return null;
        }).filter(url => url !== null);
        
        console.log('🖼️ Extracted image URLs:', imageUrls);
        
        if (imageUrls.length > 0) {
            displayAdImages(imageUrls);
        } else {
            console.log('❌ No valid image URLs found');
            displayNoImages();
        }
    } else {
        console.log('❌ No images found for ad');
        displayNoImages();
    }
}

// Display ad images
function displayAdImages(images) {
    console.log('🖼️ Displaying images:', images);
    const mainImage = document.getElementById('adMainImage');
    const thumbnails = document.getElementById('adThumbnails');
    
    if (images.length > 0) {
        // Set main image
        mainImage.innerHTML = `<img src="${images[0]}" alt="Hlavní obrázek" class="ad-main-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="no-image-placeholder" style="display: none;">
                <i class="fas fa-image"></i>
                <span>Obrázek se nepodařilo načíst</span>
            </div>`;
        
        // Set thumbnails
        if (images.length > 1) {
            thumbnails.innerHTML = images.slice(1).map((img, index) => `
                <div class="ad-thumbnail" onclick="changeMainImage('${img}')">
                    <img src="${img}" alt="Obrázek ${index + 2}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="no-image-placeholder" style="display: none;">
                        <i class="fas fa-image"></i>
                    </div>
                </div>
            `).join('');
        } else {
            thumbnails.innerHTML = '';
        }
    } else {
        displayNoImages();
    }
}

// Display no images placeholder
function displayNoImages() {
    const mainImage = document.getElementById('adMainImage');
    const thumbnails = document.getElementById('adThumbnails');
    
    mainImage.innerHTML = `
        <div class="no-image-placeholder">
            <i class="fas fa-image"></i>
            <span>Žádné obrázky</span>
        </div>
    `;
    
    thumbnails.innerHTML = '';
}

// Change main image
function changeMainImage(imageSrc) {
    const mainImage = document.getElementById('adMainImage');
    mainImage.innerHTML = `<img src="${imageSrc}" alt="Hlavní obrázek" class="ad-main-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="no-image-placeholder" style="display: none;">
            <i class="fas fa-image"></i>
            <span>Obrázek se nepodařilo načíst</span>
        </div>`;
    
    // Update active thumbnail
    const thumbnails = document.querySelectorAll('.ad-thumbnail');
    thumbnails.forEach(thumb => {
        thumb.classList.remove('active');
        const img = thumb.querySelector('img');
        if (img && img.src === imageSrc) {
            thumb.classList.add('active');
        }
    });
}

// Load user's other ads
async function loadUserOtherAds(userId) {
    try {
        console.log('📋 Loading user other ads:', userId);
        
        const { getDocs, collection, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const adsRef = collection(window.firebaseDb, 'users', userId, 'inzeraty');
        const q = query(adsRef, where('status', '==', 'active'));
        const adsSnapshot = await getDocs(q);
        
        const userAds = [];
        adsSnapshot.forEach((doc) => {
            if (doc.id !== currentAd.id) { // Exclude current ad
                userAds.push({
                    id: doc.id,
                    ...doc.data()
                });
            }
        });
        
        console.log('📋 User other ads loaded:', userAds.length);
        
        // Update user ads count (včetně aktuálního inzerátu)
        const totalAdsCount = adsSnapshot.size; // včetně aktuálního
        const userAdsCountEl = document.getElementById('userAdsCount');
        if (userAdsCountEl) {
            userAdsCountEl.textContent = totalAdsCount;
        }
        
        // Aktualizovat hodnocení z profilu
        if (adOwner) {
            const rating = adOwner.rating || 0;
            const totalReviews = adOwner.totalReviews || 0;
            const ratingEl = document.getElementById('userRating');
            if (ratingEl) {
                if (totalReviews > 0) {
                    ratingEl.textContent = rating.toFixed(1);
                } else {
                    ratingEl.textContent = '-';
                }
            }
        }
        
        // Display other ads
        displayOtherAds(userAds);
        
    } catch (error) {
        console.error('❌ Error loading user other ads:', error);
    }
}

// Display other ads
function displayOtherAds(ads) {
    const otherAdsGrid = document.getElementById('otherAdsGrid');
    
    if (ads.length === 0) {
        otherAdsGrid.innerHTML = '<p class="no-other-ads">Žádné další inzeráty</p>';
        return;
    }
    
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
        'specialized_custom': 'Specializované služby / na přání'
    };
    
    otherAdsGrid.innerHTML = ads.slice(0, 3).map(ad => {
        console.log('🖼️ Creating service card for:', ad.title);
        console.log('🖼️ Full service data:', ad);
        console.log('🖼️ Service images:', ad.images);
        console.log('🖼️ Service image:', ad.image);
        console.log('🖼️ Service photo:', ad.photo);
        
        const categoryName = categoryNames[ad.category] || ad.category;
        const createdAt = ad.createdAt ? ad.createdAt.toDate() : new Date();
        const timeAgo = formatTimeAgo(createdAt);
        
        // Check for images - same as services.js
        let imageUrl = './fotky/team.jpg'; // default fallback with explicit relative path
        
        if (ad.images && ad.images.length > 0) {
            if (ad.images[0].url) {
                imageUrl = ad.images[0].url;
                console.log('✅ Using images[0].url:', imageUrl);
            } else if (typeof ad.images[0] === 'string') {
                imageUrl = ad.images[0];
                console.log('✅ Using images[0] as string:', imageUrl);
            }
        } else if (ad.image) {
            if (ad.image.url) {
                imageUrl = ad.image.url;
                console.log('✅ Using image.url:', imageUrl);
            } else if (typeof ad.image === 'string') {
                imageUrl = ad.image;
                console.log('✅ Using image as string:', imageUrl);
            }
        } else if (ad.photo) {
            if (ad.photo.url) {
                imageUrl = ad.photo.url;
                console.log('✅ Using photo.url:', imageUrl);
            } else if (typeof ad.photo === 'string') {
                imageUrl = ad.photo;
                console.log('✅ Using photo as string:', imageUrl);
            }
        }
        
        console.log('🎯 Final image URL:', imageUrl);
        console.log('🔗 Image URL type:', typeof imageUrl);
        console.log('🔗 Image URL length:', imageUrl.length);
        
        let imageHtml = `<img src="${imageUrl}" alt="${ad.title}" loading="lazy" decoding="async" onerror="console.error('❌ Image failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';">`;
        imageHtml += '<div class="no-image" style="display:none;"><i class="fas fa-image"></i></div>';
        
        return `
            <div class="ad-card" onclick="viewAd('${ad.id}', '${currentAd.userId}')">
                <div class="ad-thumb">
                    ${imageHtml}
                </div>
                <div class="ad-body">
                    <h3 class="ad-title">${ad.title}</h3>
                    <div class="ad-meta-details">
                        <div class="ad-meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${getLocationName(ad.location) || 'Lokace neuvedena'}</span>
                        </div>
                        <div class="ad-meta-item">
                            <i class="fas fa-tags"></i>
                            <span>${categoryName}</span>
                        </div>
                        <div class="ad-meta-item">
                            <i class="fas fa-tag"></i>
                            <span class="ad-price-value">${(() => {
                                if (!ad.price) return 'Cena na dotaz';
                                // Pokud je cena jen číslo, přidat Kč
                                const priceStr = ad.price.toString().trim();
                                if (/^\d+$/.test(priceStr)) {
                                    return `${priceStr} Kč`;
                                }
                                return priceStr;
                            })()}</span>
                        </div>
                        <div class="ad-meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${timeAgo}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// View ad - make it globally available
window.viewAd = function(adId, userId) {
    window.location.href = `ad-detail.html?id=${adId}&userId=${userId}`;
};

// Start chat - make it globally available
window.startChat = async function() {
    console.log('💬 Starting chat...');
    console.log('📋 Current ad:', currentAd);
    
    if (!currentAd) {
        console.error('❌ No current ad available');
        showError('Chyba: Inzerát není načten');
        return;
    }
    
    if (!currentAd.userId) {
        console.error('❌ No user ID in ad');
        showError('Chyba: ID uživatele není dostupné');
        return;
    }
    
    // Kontrola přihlášení
    const viewer = window.firebaseAuth?.currentUser;
    console.log('👤 Current user:', viewer);
    if (!viewer) {
        // Zobrazit modal pro přihlášení/registraci
        showAuthRequiredModal();
        return;
    }
    
    // Kontrola, že uživatel nekontaktuje sám sebe
    if (currentAd.userId === viewer.uid) {
        showError('Nemůžete kontaktovat sami sebe');
        return;
    }
    
    console.log('✅ Login check passed, contacting seller...');
    
    // Přesměrování na chat (preferuje contactSeller, jinak přímá URL)
    if (typeof contactSeller === 'function' || window.contactSeller) {
        try {
            const fn = typeof contactSeller === 'function' ? contactSeller : window.contactSeller;
            console.log('🎯 Calling contactSeller function...');
            await fn(currentAd.id, currentAd.userId, currentAd.title);
            return;
        } catch (e) {
            console.warn('⚠️ contactSeller selhal, používám přímé přesměrování', e);
        }
    }

    // Fallback: vytvoř URL relativně k aktuální stránce a přesměruj
    const url = new URL('chat.html', window.location.href);
    url.searchParams.set('userId', currentAd.userId);
    url.searchParams.set('listingId', currentAd.id);
    if (currentAd.title) url.searchParams.set('listingTitle', currentAd.title);
    window.location.href = url.toString();
};

// Bezpečné navázání tlačítka po načtení DOM (fallback k inline onclick)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('startChatBtn');
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.startChat === 'function') {
                window.startChat();
            }
        });
    }
});


// Go back - make it globally available
window.goBack = function() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = 'services.html';
    }
};

// Format time ago
function formatTimeAgo(date) {
    if (!date) return 'Neznámé datum';
    
    const now = new Date();
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
    
    if (isNaN(serviceDate.getTime())) {
        return 'Neznámé datum';
    }
    
    const diff = now - serviceDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Dnes';
    if (days === 1) return 'Včera';
    if (days < 7) return `Před ${days} dny`;
    if (days < 30) return `Před ${Math.floor(days / 7)} týdny`;
    if (days < 365) return `Před ${Math.floor(days / 30)} měsíci`;
    return `Před ${Math.floor(days / 365)} lety`;
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

// Show error message
function showError(message) {
    console.error('❌ Error:', message);
    alert(message);
}

// Get category name
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
    const locations = {
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
        'Moravskoslezsky': 'Moravskoslezský kraj',
        'Bratislavsky': 'Bratislavský kraj',
        'Trnavsky': 'Trnavský kraj',
        'Trenciansky': 'Trenčianský kraj',
        'Nitriansky': 'Nitriansky kraj',
        'Zilinsky': 'Žilinský kraj',
        'Banskobystricky': 'Banskobystrický kraj',
        'Presovsky': 'Prešovský kraj',
        'Kosicky': 'Košický kraj'
    };
    return locations[location] || location;
}

// Format date
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
    const diffTime = Math.abs(now - serviceDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Včera';
    if (diffDays < 7) return `Před ${diffDays} dny`;
    if (diffDays < 30) return `Před ${Math.ceil(diffDays / 7)} týdny`;
    return serviceDate.toLocaleDateString('cs-CZ');
}

// Show error (deduplicated)
// (pozor: funkce již definována výše)
