// Ad Detail Page JavaScript
let currentAd = null;
let adOwner = null;
let currentImageList = []; // Uložit seznam obrázků pro správné přeskupování

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
                        email: userData.email || 'Neuvedeno'
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
        
        // Add uid to adOwner if not present
        if (adOwner && !adOwner.uid) {
            adOwner.uid = userId;
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
    
    // Description - zachovat odřádkování s funkcí "číst dále"
    const descriptionEl = document.getElementById('adDescription');
    if (descriptionEl) {
        const description = currentAd.description || 'Bez popisu';
        // Escapovat HTML
        const escapedText = description
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Funkce pro vytvoření textu s tlačítkem "číst dále"
        const MAX_WORDS = 50;
        // Nejdříve převést \n na placeholder, pak rozdělit na slova
        const PLACEHOLDER = '__NEWLINE__';
        const textWithPlaceholder = escapedText.replace(/\n/g, PLACEHOLDER);
        const words = textWithPlaceholder.split(/\s+/).filter(w => w.length > 0);
        const isLongText = words.length > MAX_WORDS;
        
        if (isLongText) {
            // Vzít prvních MAX_WORDS slov
            const shortWords = words.slice(0, MAX_WORDS);
            const shortText = shortWords.join(' ').replace(new RegExp(PLACEHOLDER, 'g'), '\n');
            const fullText = escapedText.replace(/\n/g, '<br>');
            const shortTextWithBreaks = shortText.replace(/\n/g, '<br>');
            
            // Vytvořit unikátní ID pro tento element
            const descId = 'adDescription_' + Date.now();
            descriptionEl.id = descId;
            
            descriptionEl.innerHTML = `
                <span class="ad-text-short" style="display: inline !important;">${shortTextWithBreaks}...</span>
                <span class="ad-text-full" style="display: none !important;">${fullText}</span>
                <button class="read-more-btn" onclick="toggleAdText('${descId}')" style="display: inline-block;">
                    Číst dále
                </button>
            `;
        } else {
            descriptionEl.innerHTML = escapedText.replace(/\n/g, '<br>');
        }
    }
    
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
        } else if (adOwner.companyName) {
            displayName = adOwner.companyName;
        } else if (adOwner.email) {
            displayName = adOwner.email.split('@')[0];
        }
        
        document.getElementById('adUser').textContent = displayName;
        // Avatar (hlavička profilu u detailu inzerátu)
        try {
            const STOCK_AVATAR_URL = 'data:image/svg+xml;base64,' + btoa('<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f77c00;stop-opacity:1" /><stop offset="100%" style="stop-color:#fdf002;stop-opacity:1" /></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#avatarGradient)"/><circle cx="64" cy="48" r="16" fill="white"/><path d="M32 88C32 80.268 38.268 74 46 74H82C89.732 74 96 80.268 96 88V128H32V88Z" fill="white"/></svg>');
            const avatarUrl = adOwner.photoURL || adOwner.avatarUrl || STOCK_AVATAR_URL;
            const img = document.getElementById('adUserAvatar');
            const ph = document.getElementById('adUserAvatarPh');
            if (img && ph) {
                img.src = avatarUrl;
                img.style.display = 'block';
                ph.style.display = 'none';
            }
        } catch (e) { /* noop */ }
        
        const emailEl = document.getElementById('adEmail');
        const phoneEl = document.getElementById('adPhone');
        const fullEmail = adOwner.email || 'Neuvedeno';
        // Telefon se načítá z users/{uid}/profile/profile jako phoneNumber
        const fullPhone = adOwner.phoneNumber || adOwner.phone || adOwner.companyPhone || adOwner.telefon || 'Neuvedeno';
        const viewer = window.firebaseAuth?.currentUser;
        
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
            
            // Zabránit kopírování zablurovaného kontaktu
            emailEl.addEventListener('copy', (e) => {
                e.preventDefault();
                return false;
            });
            emailEl.addEventListener('cut', (e) => {
                e.preventDefault();
                return false;
            });
            phoneEl.addEventListener('copy', (e) => {
                e.preventDefault();
                return false;
            });
            phoneEl.addEventListener('cut', (e) => {
                e.preventDefault();
                return false;
            });
            emailEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
            phoneEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
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
            companyName: adOwner.companyName,
            email: adOwner.email,
            phone: adOwner.phone || adOwner.companyPhone || adOwner.telefon,
            displayNameFinal: displayName
        });
    } else {
        // Pokud není profil načtený, zobrazit výchozí hodnoty
        document.getElementById('adUser').textContent = 'Uživatel';
        document.getElementById('adEmail').textContent = 'Neuvedeno';
        document.getElementById('adPhone').textContent = 'Neuvedeno';
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
            // Uložit seznam obrázků pro pozdější použití
            currentImageList = imageUrls;
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
        // Optimalizovat URL pro Firebase Storage
        let mainImageUrl = images[0];
        if (mainImageUrl.includes('firebasestorage.googleapis.com') && !mainImageUrl.includes('alt=media')) {
            mainImageUrl = mainImageUrl + (mainImageUrl.includes('?') ? '&' : '?') + 'alt=media';
        }
        const escapedMainImageUrl = mainImageUrl.replace(/"/g, '&quot;');
        const defaultImageUrl = '/fotky/vychozi-inzerat.png';
        const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
        const placeholderStyle = 'background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
        
        // Set main image s optimalizací a retry mechanismem včetně _200x200 varianty
        const imageStyle = `width: 100% !important; height: 100% !important; min-width: 100% !important; min-height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: cover !important; object-position: center !important; position: absolute !important; top: 0 !important; left: 0 !important; ${placeholderStyle}`;
		mainImage.innerHTML = `<img src="${escapedMainImageUrl}" alt="Hlavní obrázek" class="ad-main-img" loading="eager" decoding="async" fetchpriority="high" style="${imageStyle}" onload="this.style.background='transparent'; this.style.animation='none'; this.style.width='100%'; this.style.height='100%'; this.style.minWidth='100%'; this.style.minHeight='100%'; this.style.maxWidth='100%'; this.style.maxHeight='100%'; this.style.objectFit='cover'; this.style.position='absolute'; this.style.top='0'; this.style.left='0';" onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; const newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg').replace('.jpg', '_200x200.jpg'); this.src = newUrl + (params ? '?' + params : ''); } else if(this.dataset.retry === '1') { this.dataset.retry='2'; this.src=this.src.split('?')[0] + '?alt=media'; } else { this.onerror=null; this.src='${escapedDefaultUrl}'; this.style.background='transparent'; this.style.animation='none'; }" data-retry="0">
            <div class="no-image-placeholder" style="display: none;">
                <i class="fas fa-image"></i>
                <span>Obrázek se nepodařilo načíst</span>
            </div>`;
        
        // Set thumbnails - zobrazit další obrázky (bez prvního, který je už zobrazen jako hlavní)
        if (images.length > 1) {
            const placeholderStyle = 'background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
            thumbnails.innerHTML = images.slice(1).map((img, index) => {
                // Optimalizovat URL pro Firebase Storage
                let optimizedImg = img;
                if (img.includes('firebasestorage.googleapis.com') && !img.includes('alt=media')) {
                    optimizedImg = img + (img.includes('?') ? '&' : '?') + 'alt=media';
                }
                // Escapovat URL pro bezpečné použití v data atributu
                const escapedUrl = optimizedImg.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const defaultImageUrl = '/fotky/vychozi-inzerat.png';
                const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
                return `
                <div class="ad-thumbnail" data-image-url="${escapedUrl}" data-image-index="${index + 1}" style="cursor: pointer;">
					<img src="${escapedUrl}" alt="Obrázek ${index + 2}" loading="lazy" decoding="async" width="100" height="75" style="${placeholderStyle}" onload="this.style.background='transparent'; this.style.animation='none';" onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; const newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg').replace('.jpg', '_200x200.jpg'); this.src = newUrl + (params ? '?' + params : ''); } else if(this.dataset.retry === '1') { this.dataset.retry='2'; this.src=this.src.split('?')[0] + '?alt=media'; } else { this.onerror=null; this.src='${escapedDefaultUrl}'; this.style.background='transparent'; this.style.animation='none'; }" data-retry="0">
                    <div class="no-image-placeholder" style="display: none;">
                        <i class="fas fa-image"></i>
                    </div>
                </div>
            `;
            }).join('');
            
            // Použít event delegation pro spolehlivější funkčnost
            if (thumbnails) {
                // Odstranit existující event listener, pokud existuje
                thumbnails.removeEventListener('click', handleThumbnailClick);
                
                // Přidat nový event listener pomocí event delegation
                thumbnails.addEventListener('click', handleThumbnailClick);
            }
        } else {
            thumbnails.innerHTML = '';
        }
    } else {
        displayNoImages();
    }
}

// Event handler pro klikání na thumbnaily
function handleThumbnailClick(e) {
    const thumbnail = e.target.closest('.ad-thumbnail');
    if (!thumbnail) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const imageUrl = thumbnail.getAttribute('data-image-url');
    if (imageUrl) {
        console.log('🖼️ Clicked thumbnail, changing to:', imageUrl);
        // Dekódovat HTML entity zpět na normální URL
        const decodedUrl = imageUrl.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        window.changeMainImage(decodedUrl);
    }
}

// Display no images placeholder - zobrazit výchozí obrázek s textem
function displayNoImages() {
    const mainImage = document.getElementById('adMainImage');
    const thumbnails = document.getElementById('adThumbnails');
    
    // Zobrazit výchozí obrázek s textem pod ním
    const defaultImageUrl = '/fotky/vychozi-inzerat.png';
    const defaultImageStyle = 'width: 100% !important; height: 100% !important; min-width: 100% !important; min-height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: cover !important; object-position: center !important; position: absolute !important; top: 0 !important; left: 0 !important;';
    mainImage.innerHTML = `
        <div class="default-image-container" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <img src="${defaultImageUrl}" alt="Výchozí obrázek" class="ad-default-img" loading="eager" decoding="async" fetchpriority="high" style="${defaultImageStyle}" onload="this.style.width='100%'; this.style.height='100%'; this.style.objectFit='cover'; this.style.position='absolute'; this.style.top='0'; this.style.left='0';" onerror="this.onerror=null; this.src='/fotky/vychozi-inzerat.png'">
            <div class="default-image-text" style="position: relative; z-index: 1; text-align: center; color: #6b7280; padding: 1rem;">
                <span>Bez fotografie</span>
                <span>Použít výchozí obrázek</span>
            </div>
        </div>
    `;
    
    thumbnails.innerHTML = '';
}

// Change main image - globální funkce pro onclick
window.changeMainImage = function(imageSrc) {
    console.log('🖼️ Changing main image to:', imageSrc);
    const mainImage = document.getElementById('adMainImage');
    const thumbnailsContainer = document.getElementById('adThumbnails');
    
    if (!mainImage) {
        console.error('❌ Main image element not found');
        return;
    }
    
    if (!currentImageList || currentImageList.length === 0) {
        console.error('❌ No image list available');
        return;
    }
    
    // Najít aktuální hlavní obrázek (první v seznamu)
    const currentMainImage = currentImageList[0];
    
    // Pokud klikneme na stejný obrázek, nic nedělat
    if (currentMainImage === imageSrc) {
        return;
    }
    
    // Najít index kliknutého obrázku v seznamu
    const clickedIndex = currentImageList.findIndex(img => img === imageSrc);
    if (clickedIndex === -1) {
        console.error('❌ Image not found in list');
        return;
    }
    
    // Přesunout kliknutý obrázek na první místo a původní hlavní na jeho místo
    const newImageList = [...currentImageList];
    newImageList[0] = imageSrc;
    newImageList[clickedIndex] = currentMainImage;
    
    // Aktualizovat globální seznam
    currentImageList = newImageList;
    
    // Escapovat imageSrc pro bezpečné použití v HTML
    const escapedSrc = imageSrc.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    // Optimalizovat URL pro Firebase Storage
    let optimizedSrc = imageSrc;
    if (imageSrc.includes('firebasestorage.googleapis.com') && !imageSrc.includes('alt=media')) {
        optimizedSrc = imageSrc + (imageSrc.includes('?') ? '&' : '?') + 'alt=media';
    }
    const escapedOptimizedSrc = optimizedSrc.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const defaultImageUrl = '/fotky/vychozi-inzerat.png';
    const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
    const placeholderStyle = 'background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
    const imageStyle = `width: 100% !important; height: 100% !important; min-width: 100% !important; min-height: 100% !important; max-width: 100% !important; max-height: 100% !important; object-fit: cover !important; object-position: center !important; position: absolute !important; top: 0 !important; left: 0 !important; ${placeholderStyle}`;
    
	mainImage.innerHTML = `<img src="${escapedOptimizedSrc}" alt="Hlavní obrázek" class="ad-main-img" loading="eager" decoding="async" fetchpriority="high" style="${imageStyle}" onload="this.style.background='transparent'; this.style.animation='none'; this.style.width='100%'; this.style.height='100%'; this.style.minWidth='100%'; this.style.minHeight='100%'; this.style.maxWidth='100%'; this.style.maxHeight='100%'; this.style.objectFit='cover'; this.style.position='absolute'; this.style.top='0'; this.style.left='0';" onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; const newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg').replace('.jpg', '_200x200.jpg'); this.src = newUrl + (params ? '?' + params : ''); } else if(this.dataset.retry === '1') { this.dataset.retry='2'; this.src=this.src.split('?')[0] + '?alt=media'; } else { this.onerror=null; this.src='${escapedDefaultUrl}'; this.style.background='transparent'; this.style.animation='none'; }" data-retry="0">
        <div class="no-image-placeholder" style="display: none;">
            <i class="fas fa-image"></i>
            <span>Obrázek se nepodařilo načíst</span>
        </div>`;
    
    // Aktualizovat thumbnails - přeskupit existující elementy bez znovunačítání obrázků
    if (thumbnailsContainer && newImageList.length > 1) {
        // Najít všechny existující thumbnail elementy
        const existingThumbnails = Array.from(thumbnailsContainer.querySelectorAll('.ad-thumbnail'));
        
        // Vytvořit mapu URL -> element pro rychlé vyhledávání
        const thumbnailMap = new Map();
        existingThumbnails.forEach(thumb => {
            const url = thumb.getAttribute('data-image-url');
            if (url) {
                const decodedUrl = url.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                thumbnailMap.set(decodedUrl, thumb);
            }
        });
        
        // Vymazat container
        thumbnailsContainer.innerHTML = '';
        
        // Přidat thumbnails v novém pořadí (bez prvního, který je hlavní)
        newImageList.slice(1).forEach((img, index) => {
            const escapedUrl = img.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            // Najít existující element nebo vytvořit nový
            let thumbnailElement = thumbnailMap.get(img);
            
            if (thumbnailElement) {
                // Použít existující element - jen aktualizovat data atribut
                thumbnailElement.setAttribute('data-image-index', index + 1);
                // Obrázek už je načtený, takže ho jen přesuneme
            } else {
                // Vytvořit nový element pouze pokud neexistuje
                thumbnailElement = document.createElement('div');
                thumbnailElement.className = 'ad-thumbnail';
                thumbnailElement.setAttribute('data-image-url', escapedUrl);
                thumbnailElement.setAttribute('data-image-index', index + 1);
                thumbnailElement.style.cursor = 'pointer';
                thumbnailElement.innerHTML = `
                    <img src="${img}" alt="Obrázek ${index + 2}" loading="lazy" decoding="async" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                    <div class="no-image-placeholder" style="display: none;">
                        <i class="fas fa-image"></i>
                    </div>
                `;
            }
            
            thumbnailsContainer.appendChild(thumbnailElement);
        });
        
        // Event listenery už jsou nastavené pomocí event delegation, takže není potřeba je znovu přidávat
    }
};

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
        
        // Optimalizovat Firebase Storage URL PRVNÍ (před escapováním)
        let optimizedImageUrl = imageUrl;
        if (imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes('alt=media')) {
            optimizedImageUrl = imageUrl + (imageUrl.includes('?') ? '&' : '?') + 'alt=media';
        }
        
        const escapedImageUrl = optimizedImageUrl.replace(/"/g, '&quot;');
        const escapedTitle = (ad.title || '').replace(/"/g, '&quot;');
        
        const defaultImageUrl = './fotky/team.jpg';
        const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
        const placeholderStyle = 'background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
        
        let imageHtml = `<img src="${escapedImageUrl}" alt="${escapedTitle}" loading="lazy" decoding="async" width="400" height="300" style="${placeholderStyle}" onload="this.classList.add('loaded'); this.style.background='transparent'; this.style.animation='none';" onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; let newUrl = baseUrl; if(baseUrl.includes('_preview.jpg') && !baseUrl.includes('_200x200')) { newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg'); } else if(!baseUrl.includes('_200x200') && (baseUrl.endsWith('.jpg') || baseUrl.endsWith('.jpeg') || baseUrl.endsWith('.png'))) { newUrl = baseUrl.replace(/\\.(jpg|jpeg|png)$/i, '_200x200.$1'); } this.src = newUrl + (params ? '?' + params : ''); } else if(this.dataset.retry === '1') { this.dataset.retry='2'; const parts = this.src.split('?'); const baseUrl = parts[0]; this.src = baseUrl + '?alt=media'; } else { this.onerror=null; this.src='${escapedDefaultUrl}'; this.classList.add('loaded'); this.style.background='transparent'; this.style.animation='none'; }" data-retry="0">`;
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
    
    // Přidat event listenery pro obrázky - přidat třídu .loaded po načtení
    const images = otherAdsGrid.querySelectorAll('.ad-thumb img');
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
        // Rovnou otevřít modal pro přihlášení
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
        }
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const serviceDay = new Date(serviceDate.getFullYear(), serviceDate.getMonth(), serviceDate.getDate());
    
    // Compare dates (without time)
    if (serviceDay.getTime() === today.getTime()) {
        return 'Dnes';
    } else if (serviceDay.getTime() === yesterday.getTime()) {
        return 'Včera';
    } else {
        const diffTime = today.getTime() - serviceDay.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 7) {
            return `Před ${diffDays} dny`;
        } else if (diffDays < 30) {
            return `Před ${Math.ceil(diffDays / 7)} týdny`;
        } else {
            return serviceDate.toLocaleDateString('cs-CZ');
        }
    }
}

// Show error (deduplicated)
// (pozor: funkce již definována výše)

// ==========================================
// REPORT AD FUNCTIONALITY
// ==========================================

// Open report modal
function openReportModal() {
    const modal = document.getElementById('reportAdModal');
    const titleEl = document.getElementById('reportAdTitle');
    
    if (!currentAd) {
        alert('Chyba: Inzerát nebyl načten');
        return;
    }
    
    // Set ad title in modal
    if (titleEl) {
        titleEl.textContent = currentAd.title || 'Bez názvu';
    }
    
    // Reset form
    const reasonSelect = document.getElementById('reportReason');
    const descriptionTextarea = document.getElementById('reportDescription');
    if (reasonSelect) reasonSelect.value = '';
    if (descriptionTextarea) descriptionTextarea.value = '';
    
    // Show modal
    if (modal) {
        modal.style.display = 'flex';
    }
}
window.openReportModal = openReportModal;

// Close report modal
function closeReportModal() {
    const modal = document.getElementById('reportAdModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
window.closeReportModal = closeReportModal;

// Submit report
async function submitReport() {
    const reasonSelect = document.getElementById('reportReason');
    const descriptionTextarea = document.getElementById('reportDescription');
    const submitBtn = document.getElementById('submitReportBtn');
    
    const reason = reasonSelect ? reasonSelect.value : '';
    const description = descriptionTextarea ? descriptionTextarea.value.trim() : '';
    
    if (!reason) {
        alert('Vyberte prosím důvod nahlášení');
        return;
    }
    
    if (!currentAd) {
        alert('Chyba: Inzerát nebyl načten');
        return;
    }
    
    // Get URL params for ad ID and user ID
    const urlParams = new URLSearchParams(window.location.search);
    const adId = urlParams.get('id');
    const adOwnerId = urlParams.get('userId');
    
    // Get current user info
    let reporterName = 'Anonymní uživatel';
    let reporterEmail = '';
    let reporterUid = '';
    
    if (window.firebaseAuth && window.firebaseAuth.currentUser) {
        const user = window.firebaseAuth.currentUser;
        reporterEmail = user.email || '';
        reporterUid = user.uid || '';
        
        // Try to get name from profile
        try {
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const profileDoc = await getDoc(doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile'));
            if (profileDoc.exists()) {
                const profile = profileDoc.data();
                reporterName = profile.name || profile.firstName || profile.companyName || reporterEmail || 'Přihlášený uživatel';
            }
        } catch (e) {
            reporterName = reporterEmail || 'Přihlášený uživatel';
        }
    }
    
    // Disable button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Odesílám...';
    }
    
    try {
        // Call Firebase function to send report
        const response = await fetch('https://europe-west1-inzerio-inzerce.cloudfunctions.net/reportAd', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                adId: adId,
                adTitle: currentAd.title || 'Bez názvu',
                adOwnerId: adOwnerId,
                adOwnerName: adOwner?.name || adOwner?.companyName || 'Neznámý',
                adOwnerEmail: adOwner?.email || '',
                reporterUid: reporterUid,
                reporterName: reporterName,
                reporterEmail: reporterEmail,
                reason: reason,
                description: description,
            }),
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Nahlášení bylo úspěšně odesláno. Děkujeme za váš podnět!');
            closeReportModal();
        } else {
            throw new Error(result.error || 'Neznámá chyba');
        }
    } catch (error) {
        console.error('Report error:', error);
        alert('❌ Nepodařilo se odeslat nahlášení: ' + (error.message || 'Zkuste to prosím později'));
    } finally {
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Odeslat nahlášení';
        }
    }
}
window.submitReport = submitReport;

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('reportAdModal');
    if (e.target === modal) {
        closeReportModal();
    }
});

// Funkce pro přepínání zobrazení textu inzerátu
window.toggleAdText = function(descId) {
    const descEl = document.getElementById(descId);
    if (!descEl) return;
    
    const shortText = descEl.querySelector('.ad-text-short');
    const fullText = descEl.querySelector('.ad-text-full');
    const button = descEl.querySelector('.read-more-btn');
    
    if (!shortText || !fullText || !button) return;
    
    const isExpanded = fullText.style.display !== 'none' && fullText.style.display !== '';
    
    if (isExpanded) {
        // Sbalit text - zobrazit jen prvních 50 slov
        shortText.style.display = 'inline';
        fullText.style.display = 'none';
        button.textContent = 'Číst dále';
    } else {
        // Rozbalit text - zobrazit celý text
        shortText.style.display = 'none';
        fullText.style.display = 'inline';
        button.textContent = 'Zobrazit méně';
    }
};
