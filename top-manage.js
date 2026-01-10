// Správa topování (profile-top.html)

async function topManage_waitForFirebase() {
    return new Promise((resolve) => {
        (function wait() {
            if (window.firebaseAuth && window.firebaseDb) return resolve();
            setTimeout(wait, 100);
        })();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await topManage_waitForFirebase();
    
    // Zkontrolovat, zda je uživatel přihlášen
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    if (user) {
        await topManageLoad();
    } else {
        // Pokud není přihlášen, počkat na přihlášení
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        onAuthStateChanged(window.firebaseAuth, async (user) => {
            if (user) {
                await topManageLoad();
            } else {
                // Zobrazit prázdný stav, pokud není přihlášen
                const list = document.getElementById('topManageList');
                const empty = document.getElementById('topManageEmpty');
                if (list) list.innerHTML = '';
                if (empty) {
                    empty.style.display = '';
                    const h3 = empty.querySelector('h3');
                    if (h3) h3.textContent = 'Pro zobrazení topovaných inzerátů se musíte přihlásit';
                    const p = empty.querySelector('p');
                    if (p) p.textContent = 'Přihlaste se pro správu topování vašich inzerátů.';
                }
            }
        });
    }
});

async function topManageLoad() {
    try {
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        const list = document.getElementById('topManageList');
        const empty = document.getElementById('topManageEmpty');
        if (!user || !window.firebaseDb || !list) return;

        list.innerHTML = '<div class="loading-services"><i class="fas fa-spinner fa-spin"></i><p>Načítám inzeráty…</p></div>';

        const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const adsRef = collection(window.firebaseDb, 'users', user.uid, 'inzeraty');
        const snap = await getDocs(adsRef);

        if (snap.empty) {
            list.innerHTML = '';
            if (empty) {
                empty.style.display = '';
                const h3 = empty.querySelector('h3');
                if (h3) h3.textContent = 'Nemáte žádné topované inzeráty';
                const p = empty.querySelector('p');
                if (p) p.textContent = 'Až inzerát topujete, zobrazí se zde.';
            }
            return;
        }

        const ads = [];
        snap.forEach(d => {
            const data = d.data() || {};
            ads.push({ id: d.id, ...data });
        });

        // Pouze topované inzeráty
        const topAds = ads.filter(a => !!a.isTop);

        if (topAds.length === 0) {
            list.innerHTML = '';
            if (empty) {
                empty.style.display = '';
                const h3 = empty.querySelector('h3');
                if (h3) h3.textContent = 'Nemáte žádné topované inzeráty';
                const p = empty.querySelector('p');
                if (p) p.textContent = 'Až inzerát topujete, zobrazí se zde.';
            }
            return;
        }

        // Seřadit podle nejbližší expirace (vzestupně)
        topAds.sort((a, b) => {
            const ta = a.topExpiresAt?.toDate ? a.topExpiresAt.toDate() : (a.topExpiresAt ? new Date(a.topExpiresAt) : new Date(8640000000000000));
            const tb = b.topExpiresAt?.toDate ? b.topExpiresAt.toDate() : (b.topExpiresAt ? new Date(b.topExpiresAt) : new Date(8640000000000000));
            return ta - tb;
        });

        list.innerHTML = topAds.map(renderTopManageCard).join('');
        if (empty) empty.style.display = 'none';
    } catch (e) {
        console.error('topManageLoad:', e);
        showMessage('Nepodařilo se načíst inzeráty', 'error');
    }
}

// Pomocná funkce pro získání názvu kategorie (stejná jako v services.js)
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

// Pomocná funkce pro získání názvu lokace (stejná jako v services.js)
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

function renderTopManageCard(ad) {
    const isTop = !!ad.isTop;
    const topExpiresAt = ad.topExpiresAt?.toDate ? ad.topExpiresAt.toDate() : (ad.topExpiresAt ? new Date(ad.topExpiresAt) : null);
    const topUntilText = topExpiresAt ? topExpiresAt.toLocaleDateString('cs-CZ') : '-';
    const remaining = topExpiresAt ? Math.max(0, Math.ceil((topExpiresAt - new Date()) / (24*60*60*1000))) : 0;
    const remainingText = isTop && topExpiresAt ? `${remaining} ${remaining === 1 ? 'den' : remaining < 5 ? 'dny' : 'dní'}` : '-';

    const topStyle = isTop ? 'style="border: 3px solid #ff8a00 !important; box-shadow: 0 8px 28px rgba(255, 138, 0, 0.6), 0 0 0 2px rgba(255, 138, 0, 0.4) !important;"' : '';
    const status = (ad?.status || 'active').toString().trim().toLowerCase();
    
    // Formátování ceny - pokud je jen číslo, přidat Kč
    let formattedPrice = ad.price || '';
    if (formattedPrice && /^\d+$/.test(formattedPrice.toString().trim())) {
        formattedPrice = `${formattedPrice} Kč`;
    }
    
    // Získat URL obrázku - stejná logika jako v services.js
    let imageUrl = '/fotky/vychozi-inzerat.png';
    if (ad.images && ad.images.length > 0) {
        const firstImg = ad.images[0];
        if (typeof firstImg === 'string') {
            imageUrl = firstImg;
        } else if (firstImg && firstImg.url) {
            imageUrl = firstImg.url;
        }
    } else if (ad.image) {
        if (typeof ad.image === 'string') {
            imageUrl = ad.image;
        } else if (ad.image.url) {
            imageUrl = ad.image.url;
        }
    } else if (ad.photo) {
        if (typeof ad.photo === 'string') {
            imageUrl = ad.photo;
        } else if (ad.photo.url) {
            imageUrl = ad.photo.url;
        }
    }
    
    // Ověřit, že imageUrl je platná URL nebo cesta
    if (!imageUrl || imageUrl === 'undefined' || imageUrl === 'null') {
        imageUrl = '/fotky/vychozi-inzerat.png';
    }
    
    const escapedImageUrl = imageUrl.replace(/"/g, '&quot;');
    const defaultImageUrl = '/fotky/vychozi-inzerat.png';
    const escapedDefaultUrl = defaultImageUrl.replace(/"/g, '&quot;');
    
    // Optimalizace obrázků
    const isLocalImage = imageUrl.startsWith('/fotky/') || imageUrl.startsWith('./fotky/');
    
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
    
    const widthHeightAttr = ' width="400" height="300"';
    const placeholderStyle = 'background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
    
    let imageHtml;
    if (isLocalImage) {
        const webpUrl = imageUrl.replace(/\.(png|jpg|jpeg|PNG|JPG|JPEG)(\?.*)?$/, '.webp$2');
        const escapedWebpUrl = webpUrl.replace(/"/g, '&quot;');
        imageHtml = `
            <picture>
                <source srcset="${escapedWebpUrl}" type="image/webp">
                <img src="${escapedImageUrl}" alt="Inzerát" loading="lazy" decoding="async"${widthHeightAttr} style="${placeholderStyle}" onload="this.classList.add('loaded'); this.style.background='transparent'; this.style.animation='none';" onerror="this.onerror=null; this.src='${escapedDefaultUrl}'; this.classList.add('loaded'); this.style.background='transparent'; this.style.animation='none';">
            </picture>
        `;
    } else {
        imageHtml = `<img src="${optimizedImageUrl}" alt="Inzerát" loading="lazy" decoding="async"${widthHeightAttr} style="${placeholderStyle}" onload="this.classList.add('loaded'); this.style.background='transparent'; this.style.animation='none';" onerror="if(this.dataset.retry === '0') { this.dataset.retry='1'; const parts = this.src.split('?'); const baseUrl = parts[0]; const params = parts[1] || ''; const newUrl = baseUrl.replace('_preview.jpg', '_preview_200x200.jpg').replace('.jpg', '_200x200.jpg'); this.src = newUrl + (params ? '?' + params : ''); } else if(this.dataset.retry === '1') { this.dataset.retry='2'; this.src=this.src.split('?')[0] + '?alt=media'; } else { this.onerror=null; this.src='${escapedDefaultUrl}'; this.classList.add('loaded'); this.style.background='transparent'; this.style.animation='none'; }" data-retry="0">`;
    }

    return `
        <article class="ad-card${isTop ? ' is-top' : ''}" data-category="${ad.category || ''}" data-status="${status}" ${topStyle} onclick="topManageView('${ad.id}')" style="cursor: pointer;">
            <div class="ad-thumb">
                ${imageHtml}
            </div>
            <div class="ad-body" data-location="${getLocationName(ad.location || '') || 'Neuvedeno'}">
                <div class="ad-meta"><span>${getCategoryName(ad.category || '')}</span></div>
                <h3 class="ad-title">${ad.title || 'Bez názvu'}</h3>
                ${formattedPrice ? `<div class="ad-price">${formattedPrice}</div>` : ''}
                <div class="ad-location">${getLocationName(ad.location || '') || 'Neuvedeno'}</div>
                ${isTop ? `
                <div style="margin-top:8px; padding:6px 8px; background:rgba(255,138,0,0.1); border-radius:6px; font-size:12px; color:#f77c00; font-weight:600;">
                    TOP: Zbývá ${remainingText}
                </div>
                ` : ''}
            </div>
            ${isTop ? `
            <div class="ad-badge-top"><i class="fas fa-fire"></i> TOP</div>
            <div class="ad-flames" aria-hidden="true"></div>
            ` : ''}
        </article>
    `;
}

function topManageExtend(adId) {
    // Přejít na stránku top-ads s předvybraným inzerátem
    const url = new URL('top-ads.html', window.location.href);
    url.searchParams.set('adId', adId);
    window.location.href = url.toString();
}

async function topManageCancel(adId) {
    try {
        if (!confirm('Opravdu chcete zrušit topování tohoto inzerátu?')) return;
        const user = window.firebaseAuth && window.firebaseAuth.currentUser;
        if (!user || !window.firebaseDb) return;
        const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const ref = doc(window.firebaseDb, 'users', user.uid, 'inzeraty', adId);
        await updateDoc(ref, { isTop: false });
        showMessage('Topování bylo zrušeno', 'success');
        await topManageLoad();
    } catch (e) {
        console.error('topManageCancel:', e);
        showMessage('Nepodařilo se zrušit topování', 'error');
    }
}

async function topManageRefresh() {
    await topManageLoad();
}

function topManageView(adId) {
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    if (!user) return;
    const url = new URL('ad-detail.html', window.location.href);
    url.searchParams.set('id', adId);
    url.searchParams.set('userId', user.uid);
    window.location.href = url.toString();
}

// Expose
window.topManageExtend = topManageExtend;
window.topManageCancel = topManageCancel;
window.topManageRefresh = topManageRefresh;
window.topManageView = topManageView;

function topManageExtendQuick(adId, duration) {
    const priceByDuration = { 1: 19, 7: 49, 30: 149 };
    const price = priceByDuration[duration] || 0;
    const url = new URL('top-ads.html', window.location.href);
    url.searchParams.set('adId', adId);
    url.searchParams.set('duration', String(duration));
    url.searchParams.set('price', String(price));
    window.location.href = url.toString();
}

window.topManageExtendQuick = topManageExtendQuick;


