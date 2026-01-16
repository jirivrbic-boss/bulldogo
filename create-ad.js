/* eslint-disable no-console */
(function() {
    // Globální proměnné pro image cropper
    let cropperInstance = null;
    let currentCropFile = null;
    let currentCropInput = null;
    let isSettingCroppedFile = false; // Flag pro detekci programatického nastavení souboru
    
    // Globální pomocné funkce pro publikovat tlačítko a validaci (dostupné i před init)
    function disablePublish(disabled){
        const btn = document.getElementById('publishSideBtn');
        if (!btn) return;
        btn.disabled = !!disabled;
        btn.style.opacity = disabled ? .6 : 1;
    }
    function validateRequired(){
        const titleEl = document.getElementById('serviceTitle');
        const catEl = document.getElementById('serviceCategory');
        const locEl = document.getElementById('serviceLocation');
        const desc = document.getElementById('serviceDescription');
        const noPrev = !!document.getElementById('noPreviewImage')?.checked;
        const previewInput = document.getElementById('previewImage');
        const ok = !!titleEl?.value && !!catEl?.value && !!locEl?.value && !!desc?.value && (noPrev || !!previewInput?.files?.[0]);
        disablePublish(!ok);
        return ok;
    }
    // Po načtení DOM připravit stránku
    document.addEventListener('DOMContentLoaded', () => {
        // Inicializace UI prvků nezávislá na Firebase (aby price inputs fungovaly hned)
        setupPriceControls();

        // Počkat na Firebase a poté rozhodnout podle onAuthStateChanged
        const waitForFirebase = setInterval(async () => {
            if (window.firebaseReady && window.firebaseAuth && window.firebaseDb) {
                clearInterval(waitForFirebase);
                try {
                    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    onAuthStateChanged(window.firebaseAuth, async (user) => {
                        if (user) {
                            // Zavřít případný auth modal, pokud se zobrazil dříve
                            const authModal = document.getElementById('authModal');
                            if (authModal) {
                                authModal.style.display = 'none';
                                document.body.style.overflow = 'auto';
                            }
                            
                            // Kontrola aktivního předplatného - POVINNÁ
                            console.log('🔒 Kontroluji předplatné pro vytvoření inzerátu...');
                            
                            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                            const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
                            const profileSnap = await getDoc(profileRef);
                            
                            let hasActiveSubscription = false;
                            let subscriptionExpired = false;
                            
                            console.log('📋 Profil existuje:', profileSnap.exists());
                            
                            if (profileSnap.exists()) {
                                const profile = profileSnap.data();
                                const plan = profile.plan;
                                console.log('📋 Aktuální plán:', plan);
                                
                                if (plan === 'hobby' || plan === 'business') {
                                    // Zkontrolovat, zda předplatné nevypršelo
                                    const planPeriodEnd = profile.planPeriodEnd;
                                    if (planPeriodEnd) {
                                        const endDate = planPeriodEnd.toDate ? planPeriodEnd.toDate() : new Date(planPeriodEnd);
                                        console.log('📅 Datum vypršení:', endDate, 'Nyní:', new Date());
                                        if (endDate >= new Date()) {
                                            hasActiveSubscription = true;
                                            console.log('✅ Předplatné aktivní');
                                        } else {
                                            subscriptionExpired = true;
                                            console.log('❌ Předplatné vypršelo');
                                        }
                                    } else {
                                        // Pokud není datum vypršení, považujeme za aktivní (trial?)
                                        hasActiveSubscription = true;
                                        console.log('✅ Předplatné aktivní (bez data vypršení)');
                                    }
                                } else {
                                    console.log('❌ Žádný platný plán');
                                }
                            } else {
                                console.log('❌ Profil neexistuje');
                            }
                            
                            // Zobrazit blokující overlay pokud není předplatné
                            if (!hasActiveSubscription) {
                                console.log('🚫 BLOKOVÁNO: Chybí předplatné, zobrazuji overlay');
                                
                                // Skrýt formulář
                                const formContainer = document.querySelector('.create-ad-container, .add-service-form, main');
                                if (formContainer) {
                                    formContainer.style.display = 'none';
                                }
                                
                                // Zobrazit upozornění
                                const message = subscriptionExpired 
                                    ? 'Vaše předplatné vypršelo. Pro vytváření inzerátů si prosím obnovte balíček.'
                                    : 'Pro vytváření inzerátů potřebujete aktivní předplatné (Hobby nebo Firma).';
                                
                                // Vytvořit overlay s upozorněním
                                const overlay = document.createElement('div');
                                overlay.id = 'packageRequiredOverlay';
                                overlay.className = 'modal';
                                overlay.style.display = 'flex';
                                overlay.innerHTML = `
                                    <div class="modal-content" style="max-width: 500px; width: 100%; text-align: center;">
                                        <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
                                            <h2 class="modal-title" style="margin: 0 auto;">Vyžadováno předplatné</h2>
                                        </div>
                                        <div class="modal-body">
                                            <div style="width:80px;height:80px;background:linear-gradient(135deg,#f77c00 0%,#fdf002 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem;">
                                                <i class="fas fa-crown" style="font-size:2.5rem;color:#fff;"></i>
                                            </div>
                                            <p style="color:#666;margin-bottom:1.5rem;line-height:1.6;font-size:1rem;">${message}</p>
                                            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 2rem;">
                                                <a href="packages.html" class="btn btn-primary">
                                                    <i class="fas fa-box"></i> Zobrazit balíčky
                                                </a>
                                            </div>
                                            <p style="margin-top:1.5rem;font-size:0.85rem;color:#999;">
                                                Budete přesměrováni za 5 sekund...
                                            </p>
                                        </div>
                                    </div>
                                `;
                                document.body.appendChild(overlay);
                                
                                // Přesměrovat po 5 sekundách
                                setTimeout(() => {
                                    window.location.href = 'packages.html';
                                }, 5000);
                                return; // DŮLEŽITÉ: Zastavit a nepokračovat
                            }
                            
                            console.log('✅ Předplatné OK, inicializuji stránku...');
                            initCreateAdPage();
                        } else {
                            // Uživatel není přihlášen – až TEĎ zobrazit login
                            // DŮLEŽITÉ: Čekat na načtení auth.js před otevřením modalu
                            waitForAuthJS(() => {
                                if (typeof window.showAuthModal === 'function') {
                                    window.afterLoginCallback = () => window.location.reload();
                                    
                                    // Použít hash modal hook pokud je dostupný
                                    if (window.hashModal && typeof window.hashModal.open === 'function') {
                                        window.hashModal.open('login');
                                    } else {
                                        showAuthModal('login');
                                    }
                                    
                                    // Sledovat přihlášení a reload stránky
                                    const checkLogin = setInterval(() => {
                                        if (window.firebaseAuth?.currentUser) {
                                            clearInterval(checkLogin);
                                            // Po přihlášení reload stránky (aby se zkontrolovalo předplatné)
                                            setTimeout(() => {
                                                window.location.reload();
                                            }, 500);
                                        }
                                    }, 500);
                                    
                                    // Pokud se modal zavře bez přihlášení, přesměrovat zpět
                                    const checkModalClose = setInterval(() => {
                                        const modal = document.getElementById('authModal');
                                        if (modal && modal.style.display === 'none' && !window.firebaseAuth?.currentUser) {
                                            clearInterval(checkModalClose);
                                            window.location.href = 'index.html';
                                        }
                                    }, 1000);
                                } else {
                                    alert('Pro vytvoření inzerátu se prosím přihlaste.');
                                    window.location.href = 'index.html';
                                }
                            });
                        }
                    });
                } catch (authErr) {
                    console.error('Chyba při inicializaci auth:', authErr);
                    // Bezpečný fallback - přesměrovat na balíčky, protože nemůžeme ověřit předplatné
                    if (!window.firebaseAuth?.currentUser) {
                        waitForAuthJS(() => {
                            if (typeof window.showAuthModal === 'function') {
                                window.afterLoginCallback = () => window.location.reload();
                                
                                // Použít hash modal hook pokud je dostupný
                                if (window.hashModal && typeof window.hashModal.open === 'function') {
                                    window.hashModal.open('login');
                                } else {
                                    showAuthModal('login');
                                }
                                
                                // Sledovat přihlášení a reload stránky
                                const checkLogin = setInterval(() => {
                                    if (window.firebaseAuth?.currentUser) {
                                        clearInterval(checkLogin);
                                        setTimeout(() => {
                                            window.location.reload();
                                        }, 500);
                                    }
                                }, 500);
                                
                                // Pokud se modal zavře bez přihlášení, přesměrovat zpět
                                const checkModalClose = setInterval(() => {
                                    const modal = document.getElementById('authModal');
                                    if (modal && modal.style.display === 'none' && !window.firebaseAuth?.currentUser) {
                                        clearInterval(checkModalClose);
                                        window.location.href = 'index.html';
                                    }
                                }, 1000);
                            } else {
                                alert('Pro vytvoření inzerátu se prosím přihlaste.');
                                window.location.href = 'index.html';
                            }
                        });
                    } else {
                        // Pokud nemůžeme ověřit předplatné, raději přesměrujeme
                        console.warn('⚠️ Nelze ověřit předplatné, přesměrovávám na balíčky');
                        alert('Nepodařilo se ověřit předplatné. Budete přesměrováni na stránku balíčků.');
                        window.location.href = 'packages.html';
                    }
                }
            }
        }, 100);
        setTimeout(() => clearInterval(waitForFirebase), 15000);
    });

    // Samostatná inicializace ovládání ceny (funguje i bez Firebase)
    function setupPriceControls() {
        if (window._priceUiInit) return;
        window._priceUiInit = true;

        const p = document.getElementById('servicePrice');
        const pf = document.getElementById('servicePriceFrom');
        const pt = document.getElementById('servicePriceTo');
        const priceInputs = document.querySelector('.price-inline .inputs');
        const unitSel = document.getElementById('unitPills');

        function updatePlaceholders() {
            const unit = (document.querySelector('input[name="priceUnit"]:checked')?.value || 'hour');
            const unitText = unit === 'hour' ? 'hod' : 'práci';
            const cur = 'Kč';
            if (p) p.placeholder = `Cena (např. 500)`;
            if (pf) pf.placeholder = `Od (např. 300)`;
            if (pt) pt.placeholder = `Do (např. 800)`;
        }
        function onPriceTypeChange() {
            const sel = document.querySelector('input[name="priceType"]:checked');
            if (!sel) { if (priceInputs) priceInputs.style.display = 'none'; return; }
            if (priceInputs) priceInputs.style.display = 'block';
            if (p && pf && pt && unitSel) {
                p.style.display = 'none'; pf.style.display = 'none'; pt.style.display = 'none'; unitSel.style.display = 'none';
                p.required = false; pf.required = false; pt.required = false;
                if (sel.value === 'fixed') {
                    unitSel.style.display = 'flex';
                    p.style.display = 'block';
                    p.required = true;
                    setTimeout(() => p?.focus(), 0);
                } else if (sel.value === 'range') {
                    unitSel.style.display = 'flex';
                    pf.style.display = 'block'; pt.style.display = 'block';
                    pf.required = true; pt.required = true;
                    setTimeout(() => pf?.focus(), 0);
                } else {
                    // negotiable
                    unitSel.style.display = 'none';
                }
            }
        }
        document.querySelectorAll('input[name="priceType"]').forEach(r => {
            r.addEventListener('change', onPriceTypeChange);
            r.addEventListener('click', onPriceTypeChange);
        });
        document.querySelectorAll('input[name="priceUnit"]').forEach(r => r.addEventListener('change', updatePlaceholders));

        // Výchozí stav
        if (!document.querySelector('input[name="priceType"]:checked')) {
            const fallback = document.getElementById('priceTypeFixed');
            if (fallback) fallback.checked = true;
        }
        updatePlaceholders();
        onPriceTypeChange();
    }

    function initCreateAdPage() {
        // Pomocná funkce pro čekání na načtení auth.js
    function waitForAuthJS(callback, maxWait = 5000) {
        if (typeof window.showAuthModal === 'function') {
            callback();
            return;
        }
        
        let waited = 0;
        const checkInterval = setInterval(() => {
            waited += 100;
            if (typeof window.showAuthModal === 'function') {
                clearInterval(checkInterval);
                callback();
            } else if (waited >= maxWait) {
                clearInterval(checkInterval);
                console.error('[CREATE-AD] ❌ Timeout čekání na auth.js');
            }
        }, 100);
    }

    // Počítadlo znaků popisu
        const desc = document.getElementById('serviceDescription');
        const counter = document.getElementById('serviceDescriptionCounter');
        if (desc && counter) {
            const update = () => {
                const max = parseInt(desc.getAttribute('maxlength') || '600', 10);
                const left = Math.max(0, max - (desc.value || '').length);
                counter.textContent = String(left);
            };
            desc.addEventListener('input', update);
            update();
        }

        // Živý náhled karty vpravo
        const titleEl = document.getElementById('serviceTitle');
        const catEl = document.getElementById('serviceCategory');
        const locEl = document.getElementById('serviceLocation');
        const imgPreview = document.getElementById('previewCardImage');
        const titlePreview = document.getElementById('previewCardTitle');
        const metaCat = document.getElementById('previewCardCategory');
        const metaLoc = document.getElementById('previewCardLocation');
        const pricePreview = document.getElementById('previewCardPrice');

        function updatePreview() {
            titlePreview.textContent = (titleEl?.value || 'Název inzerátu').trim() || 'Název inzerátu';
            metaCat.textContent = catEl?.options?.[catEl.selectedIndex || 0]?.text || 'Kategorie';
            metaLoc.textContent = locEl?.options?.[locEl.selectedIndex || 0]?.text || 'Kraj';
            // cenu vypočítáme stejně jako při submitu
            const priceText = computePriceText();
            // Vždy zobrazit cenu - buď vypočítanou nebo "Dohodou"
            if (priceText && priceText !== 'Dohodou') {
                pricePreview.textContent = priceText;
            } else {
                pricePreview.textContent = 'Dohodou';
            }
            // Zajistit, že cena je vždy viditelná
            pricePreview.style.display = 'block';
            pricePreview.style.visibility = 'visible';
            pricePreview.style.opacity = '1';
        }
        titleEl?.addEventListener('input', updatePreview);
        catEl?.addEventListener('change', updatePreview);
        locEl?.addEventListener('change', updatePreview);
        
        // Event listenery pro aktualizaci ceny v náhledu
        const priceInput = document.getElementById('servicePrice');
        const priceFromInput = document.getElementById('servicePriceFrom');
        const priceToInput = document.getElementById('servicePriceTo');
        const priceTypeRadios = document.querySelectorAll('input[name="priceType"]');
        const priceUnitRadios = document.querySelectorAll('input[name="priceUnit"]');
        
        priceInput?.addEventListener('input', updatePreview);
        priceInput?.addEventListener('change', updatePreview);
        priceFromInput?.addEventListener('input', updatePreview);
        priceFromInput?.addEventListener('change', updatePreview);
        priceToInput?.addEventListener('input', updatePreview);
        priceToInput?.addEventListener('change', updatePreview);
        
        priceTypeRadios.forEach(radio => {
            radio.addEventListener('change', updatePreview);
            radio.addEventListener('click', updatePreview);
        });
        
        priceUnitRadios.forEach(radio => {
            radio.addEventListener('change', updatePreview);
            radio.addEventListener('click', updatePreview);
        });
        
        updatePreview();

        // Náhled obrázku v pravé kartě
        const previewImageInput = document.getElementById('previewImage');
        const noPreviewCheckbox = document.getElementById('noPreviewImage');
        // Výchozí logo pro náhledový obrázek - změňte cestu zde
        const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
        
        if (imgPreview && !imgPreview.getAttribute('src')) {
            imgPreview.setAttribute('src', DEFAULT_PREVIEW_LOGO);
        }
        if (previewImageInput && imgPreview) {
            previewImageInput.addEventListener('change', function(e) {
                // Pokud právě nastavujeme oříznutý soubor, neotevírat modal
                if (isSettingCroppedFile) {
                    isSettingCroppedFile = false;
                    return;
                }
                const file = e.target.files?.[0];
                if (!file) return;
                currentCropFile = file;
                currentCropInput = previewImageInput;
                openImageCropModal(file);
            });
        }
        
        // Funkce pro odstranění hlavní fotky
        window.removePreviewImage = function() {
            const previewImageInput = document.getElementById('previewImage');
            const previewImagePreview = document.getElementById('previewImagePreview');
            const imgPreview = document.getElementById('previewCardImage');
            const noPreviewCheckbox = document.getElementById('noPreviewImage');
            const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
            
            // Vymazat soubor z inputu
            if (previewImageInput) {
                previewImageInput.value = '';
            }
            
            // Obnovit výchozí logo v náhledu
            if (previewImagePreview) {
                previewImagePreview.innerHTML = '';
                previewImagePreview.classList.add('empty');
            }
            
            // Obnovit výchozí logo v kartě
            if (imgPreview) {
                imgPreview.src = DEFAULT_PREVIEW_LOGO;
            }
            
            // Zrušit checkbox "bez náhledu" pokud je zaškrtnutý
            if (noPreviewCheckbox && noPreviewCheckbox.checked) {
                noPreviewCheckbox.checked = false;
                if (previewImageInput) {
                    previewImageInput.required = true;
                    previewImageInput.disabled = false;
                }
            }
            
            // Aktualizovat validaci
            if (typeof validateRequired === 'function') {
                validateRequired();
            }
        };
        if (noPreviewCheckbox && previewImageInput && imgPreview) {
            const previewImagePreview = document.getElementById('previewImagePreview');
            const updateNoPreviewState = () => {
                const checked = !!noPreviewCheckbox.checked;
                previewImageInput.required = !checked;
                previewImageInput.disabled = checked;
                if (checked) {
                    try { previewImageInput.value = ''; } catch(_) {}
                    imgPreview.src = DEFAULT_PREVIEW_LOGO;
                    if (previewImagePreview) {
                        previewImagePreview.innerHTML = '';
                        previewImagePreview.classList.add('empty');
                    }
                } else {
                    if (!previewImageInput.files?.[0]) {
                        imgPreview.src = DEFAULT_PREVIEW_LOGO;
                        if (previewImagePreview) {
                            previewImagePreview.innerHTML = '';
                            previewImagePreview.classList.add('empty');
                        }
                    } else {
                        // Pokud je fotka nahraná, zobrazit ji s křížkem
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            if (previewImagePreview) {
                                previewImagePreview.innerHTML = `
                                    <div style="position: relative; display: inline-block; width: 100%;">
                                        <img src="${e.target.result}" alt="Náhled" style="max-width: 100%; border-radius: 8px; display: block;">
                                        <button type="button" class="remove-image-btn" onclick="removePreviewImage()" title="Odstranit fotku" style="position: absolute; top: 5px; right: 5px;">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                `;
                                previewImagePreview.classList.remove('empty');
                            }
                        };
                        reader.readAsDataURL(previewImageInput.files[0]);
                    }
                }
                validateRequired();
            };
            noPreviewCheckbox.addEventListener('change', updateNoPreviewState);
            updateNoPreviewState();
        }

        // Přepínání cen
        const priceInputs = document.querySelector('.price-inline .inputs');
        const unitSel = document.getElementById('unitPills');
        const p = document.getElementById('servicePrice');
        const pf = document.getElementById('servicePriceFrom');
        const pt = document.getElementById('servicePriceTo');
        const priceRadios = document.querySelectorAll('input[name=\"priceType\"]');
        priceRadios.forEach(r => {
            r.addEventListener('change', onPriceTypeChange);
            r.addEventListener('click', onPriceTypeChange);
        });
        // Výchozí stav: žádné pole není vybráno, pole jsou skrytá
        if (priceInputs) priceInputs.style.display = 'none';
        function onPriceTypeChange() {
            const sel = document.querySelector('input[name=\"priceType\"]:checked');
            if (!sel) { if (priceInputs) priceInputs.style.display = 'none'; return; }
            if (priceInputs) priceInputs.style.display = 'block';
            const unitHint = null;
            if (p && pf && pt && unitSel) {
                p.style.display = 'none'; pf.style.display = 'none'; pt.style.display = 'none'; unitSel.style.display = 'none';
                p.required = false; pf.required = false; pt.required = false;
                if (sel.value === 'fixed') {
                    unitSel.style.display = 'block';
                    p.style.display = 'block';
                    p.required = true;
                    updatePlaceholders();
                } else if (sel.value === 'range') {
                    unitSel.style.display = 'block';
                    pf.style.display = 'block'; pt.style.display = 'block';
                    pf.required = true; pt.required = true;
                    updatePlaceholders();
                } else {
                    // negotiable
                    // no inputs required
                }
                // Aktualizovat náhled po změně typu ceny
                setTimeout(() => updatePreview(), 50);
            }
            if (unitSel) unitSel.style.display = sel?.value === 'negotiable' ? 'none' : 'flex';
        }
        function updatePlaceholders() {
            const unit = (document.querySelector('input[name=\"priceUnit\"]:checked')?.value || 'hour');
            const unitText = unit === 'hour' ? 'hod' : 'práci';
            const cur = 'Kč';
            if (p) p.placeholder = `Cena (např. 500)`;
            if (pf) pf.placeholder = `Od (např. 300)`;
            if (pt) pt.placeholder = `Do (např. 800)`;
            updatePreview();
        }
        document.querySelectorAll('input[name=\"priceUnit\"]').forEach(r => r.addEventListener('change', updatePlaceholders));
        // Přidat event listenery pro všechna pole ceny - zajistit, že se aktualizuje náhled
        ;['input','change','keyup','paste'].forEach(evt=>{
            p?.addEventListener(evt, () => {
                setTimeout(() => updatePreview(), 10);
            });
            pf?.addEventListener(evt, () => {
                setTimeout(() => updatePreview(), 10);
            });
            pt?.addEventListener(evt, () => {
                setTimeout(() => updatePreview(), 10);
            });
        });

        // Náhledy obrázků – použít existující helper, když je k dispozici
        if (typeof window.setupImagePreviews === 'function') {
            window.setupImagePreviews();
        }

        // Odeslání formuláře
        const form = document.getElementById('addServiceForm');
        if (form && !form.hasAttribute('data-submit-handler')) {
            form.setAttribute('data-submit-handler', 'true');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                // Poskládat cenu jako text podle výběru
                const priceText = computePriceText();

                const fd = new FormData(form);
                const data = {
                    title: fd.get('title'),
                    category: fd.get('category'),
                    description: fd.get('description'),
                    price: priceText,
                    location: fd.get('location')
                };

                const previewImage = document.getElementById('previewImage');
                const additionalImages = document.getElementById('additionalImages');
                const noPreview = !!noPreviewCheckbox?.checked;
                if (!noPreview) {
                    if (!previewImage?.files?.[0]) {
                        alert('Náhledový obrázek je povinný (nebo zaškrtněte volbu bez náhledu).');
                        return;
                    }
                    const previewFile = previewImage.files[0];
                    console.log('📤 Předávám náhledový obrázek do addService:', {
                        name: previewFile.name,
                        size: previewFile.size,
                        type: previewFile.type,
                        lastModified: previewFile.lastModified,
                        isFile: previewFile instanceof File,
                        isBlob: previewFile instanceof Blob,
                        constructor: previewFile.constructor.name
                    });
                    
                    // Ověřit, že soubor je platný
                    if (!previewFile || previewFile.size === 0) {
                        console.error('❌ Soubor je prázdný nebo neplatný!');
                        alert('Soubor je prázdný nebo neplatný. Zkuste to znovu.');
                        return;
                    }
                    
                    data.previewImage = previewFile;
                } else {
                    // použít výchozí logo, neuploadovat do Storage
                    // Výchozí logo pro náhledový obrázek - změňte cestu zde
                    const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
                    data.defaultPreviewUrl = DEFAULT_PREVIEW_LOGO;
                }
                if (additionalImages?.files?.length) {
                    if (additionalImages.files.length > 10) {
                        alert('Můžete nahrát maximálně 10 dalších fotek.');
                        return;
                    }
                    data.additionalImages = Array.from(additionalImages.files);
                }

                // Odeslat přes existující Firebase funkci
                console.log('📤 Příprava k odeslání inzerátu...');
                console.log('📤 Data:', {
                    title: data.title,
                    category: data.category,
                    location: data.location,
                    hasPreviewImage: !!data.previewImage,
                    previewImageSize: data.previewImage?.size,
                    hasAdditionalImages: !!data.additionalImages?.length,
                    additionalImagesCount: data.additionalImages?.length || 0
                });
                
                if (typeof window.addService === 'function') {
                    console.log('✅ addService funkce je dostupná, volám ji...');
                    disablePublish(true);
                    
                    try {
                        const result = await window.addService(data);
                        console.log('📤 addService vrátila:', result);
                        disablePublish(false);
                        
                        // Pokud addService vrátila false (např. chybí předplatné), nepřesměrovat
                        if (result === false) {
                            console.log('❌ Inzerát nebyl přidán - chybí předplatné nebo jiná chyba');
                            return;
                        }
                        
                        // Po úspěchu přesměrovat na moje inzeráty (pokud existuje stránka), nebo na homepage
                        console.log('✅ Inzerát úspěšně přidán, přesměrovávám...');
                        // Uložit log do sessionStorage pro pozdější zobrazení
                        const logs = console.history || [];
                        sessionStorage.setItem('lastUploadLogs', JSON.stringify(logs));
                        setTimeout(() => {
                            window.location.href = 'my-ads.html';
                        }, 800);
                    } catch (error) {
                        console.error('❌ Chyba při volání addService:', error);
                        disablePublish(false);
                        alert('Chyba při ukládání inzerátu: ' + (error.message || error));
                    }
                } else {
                    console.error('❌ addService funkce není dostupná!');
                    console.error('❌ window.addService:', typeof window.addService);
                    alert('Chyba: funkcionalita přidání služby není dostupná. Zkontrolujte, zda je načten soubor auth.js');
                }
            });
        }

        // Disablovat publish, dokud nejsou povinné položky (globální helper již existuje)
        ;['input','change'].forEach(evt=>{
            titleEl?.addEventListener(evt, validateRequired);
            catEl?.addEventListener(evt, validateRequired);
            locEl?.addEventListener(evt, validateRequired);
            desc?.addEventListener(evt, validateRequired);
            previewImageInput?.addEventListener('change', validateRequired);
        });
        validateRequired();

        // Helper pro sestavení textu ceny
        function computePriceText(){
            const priceType = document.querySelector('input[name=\"priceType\"]:checked')?.value || 'negotiable';
            const unit = (document.querySelector('input[name=\"priceUnit\"]:checked')?.value || 'hour');
            const unitText = unit === 'hour' ? 'hod' : ''; // Pro "práci" nebudeme zobrazovat jednotku
            const cur = 'Kč';
            
            if (priceType === 'fixed') {
                const priceEl = document.getElementById('servicePrice');
                if (!priceEl) return 'Dohodou';
                const val = (priceEl.value || '').trim();
                if (!val) return 'Dohodou'; // Pokud není cena, zobrazit "Dohodou"
                // Zajistit, že číslo je správně formátované s Kč
                const numVal = val.replace(/[^0-9]/g, ''); // Odebrat všechny nečíselné znaky
                if (!numVal) return 'Dohodou'; // Pokud není číslo, zobrazit "Dohodou"
                // Pokud je jednotka "hod", zobrazit "750 Kč/hod", jinak jen "750 Kč"
                const result = unitText ? `${numVal} ${cur}/${unitText}` : `${numVal} ${cur}`;
                return result;
            } else if (priceType === 'range') {
                const fromEl = document.getElementById('servicePriceFrom');
                const toEl = document.getElementById('servicePriceTo');
                if (!fromEl || !toEl) return 'Dohodou';
                const from = (fromEl.value || '').trim();
                const to = (toEl.value || '').trim();
                if (!from || !to) return 'Dohodou'; // Pokud není rozmezí, zobrazit "Dohodou"
                const numFrom = from.replace(/[^0-9]/g, '');
                const numTo = to.replace(/[^0-9]/g, '');
                if (!numFrom || !numTo) return 'Dohodou'; // Pokud není číslo, zobrazit "Dohodou"
                // Formát: "200 - 600 Kč/hod" nebo "200 - 600 Kč" (bez jednotky pro práci)
                const unitPart = unitText ? `/${unitText}` : '';
                const result = `${numFrom} - ${numTo} ${cur}${unitPart}`;
                return result;
            }
            return 'Dohodou';
        }
    }
    
    // Funkce pro otevření modalu pro ořez obrázku
    window.openImageCropModal = async function(file) {
        // Zkontrolovat, zda je Cropper knihovna dostupná - počkat pokud se ještě načítá
        let waitCount = 0;
        while (typeof Cropper === 'undefined' && waitCount < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }
        
        if (typeof Cropper === 'undefined') {
            console.error('❌ Cropper knihovna není načtena po 5 sekundách čekání');
            alert('Editor obrázků není k dispozici. Prosím obnovte stránku a zkuste to znovu.');
            return;
        }
        
        const modal = document.getElementById('imageCropModal');
        const cropImage = document.getElementById('cropImage');
        const cropLoading = document.getElementById('cropLoading');
        
        if (!modal || !cropImage) {
            console.error('❌ Crop modal elements not found');
            return;
        }
        
        // Uložit soubor pro pozdější použití
        currentCropFile = file;
        currentCropInput = document.getElementById('previewImage');
        
        // Zničit předchozí cropper instanci
        if (cropperInstance) {
            try {
                cropperInstance.destroy();
            } catch (err) {
                console.warn('⚠️ Chyba při ničení předchozího cropperu:', err);
            }
            cropperInstance = null;
        }
        
        // Zobrazit modal
        modal.style.display = 'flex';
        
        // Zobrazit loading spinner
        if (cropLoading) {
            cropLoading.style.display = 'flex';
        }
        
        // Resetovat obrázek
        cropImage.onload = null;
        cropImage.onerror = null;
        cropImage.src = '';
        cropImage.style.display = 'none';
        
        // Načíst obrázek pomocí FileReader
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            if (!dataUrl) {
                console.error('❌ Data URL není k dispozici');
                if (cropLoading) cropLoading.style.display = 'none';
                modal.style.display = 'none';
                alert('Chyba při načítání obrázku. Zkuste to znovu.');
                return;
            }
            
            // Nastavit error handler
            cropImage.onerror = function() {
                console.error('❌ Chyba při načítání obrázku do editoru');
                if (cropLoading) cropLoading.style.display = 'none';
                modal.style.display = 'none';
                alert('Nepodařilo se načíst obrázek do editoru. Zkuste to znovu.');
            };
            
            // Nastavit onload handler pro inicializaci cropperu
            cropImage.onload = function() {
                // Zkontrolovat, zda je obrázek skutečně načtený
                if (!cropImage.complete || cropImage.naturalWidth === 0 || cropImage.naturalHeight === 0) {
                    console.warn('⚠️ Obrázek není plně načtený');
                    return;
                }
                
                // Zkontrolovat, zda už není cropper inicializovaný
                if (cropperInstance) {
                    console.log('⚠️ Cropper už je inicializovaný');
                    return;
                }
                
                // Skrýt loading spinner
                if (cropLoading) {
                    cropLoading.style.display = 'none';
                }
                
                // Zobrazit obrázek s maximální šířkou pro správné zobrazení v kontejneru
                cropImage.style.display = 'block';
                cropImage.style.maxWidth = '100%';
                cropImage.style.height = 'auto';
                
                // Inicializovat cropper po krátkém zpoždění (aby se modal a obrázek zobrazily)
                setTimeout(() => {
                    try {
                        // Znovu zkontrolovat, zda není už inicializovaný
                        if (cropperInstance) {
                            return;
                        }
                        
                        // Zkontrolovat dostupnost Cropper
                        if (typeof Cropper === 'undefined') {
                            console.error('❌ Cropper není dostupný při inicializaci');
                            alert('Editor obrázků není k dispozici. Prosím obnovte stránku.');
                            modal.style.display = 'none';
                            return;
                        }
                        
                        console.log('🖼️ Inicializuji cropper...');
                        
                        // Vytvořit novou instanci cropperu
                        cropperInstance = new Cropper(cropImage, {
                            aspectRatio: 4 / 3,
                            viewMode: 1,
                            dragMode: 'move',
                            autoCropArea: 0.8,
                            restore: false,
                            guides: true,
                            center: true,
                            highlight: false,
                            cropBoxMovable: true,
                            cropBoxResizable: true,
                            toggleDragModeOnDblclick: false,
                            responsive: true,
                            minContainerWidth: 300,
                            minContainerHeight: 225,
                            ready: function() {
                                console.log('✅ Cropper initialized with 4:3 aspect ratio');
                                if (cropLoading) {
                                    cropLoading.style.display = 'none';
                                }
                            },
                            error: function(error) {
                                console.error('❌ Cropper error:', error);
                                if (cropLoading) {
                                    cropLoading.style.display = 'none';
                                }
                                modal.style.display = 'none';
                                alert('Chyba při inicializaci editoru. Zkuste to znovu.');
                            }
                        });
                    } catch (error) {
                        console.error('❌ Chyba při inicializaci cropperu:', error);
                        if (cropLoading) {
                            cropLoading.style.display = 'none';
                        }
                        modal.style.display = 'none';
                        alert('Chyba při inicializaci editoru: ' + (error.message || error));
                    }
                }, 100);
            };
            
            // Nastavit src obrázku
            cropImage.src = dataUrl;
            
            // Fallback kontrola pro data URL (mohou se načíst okamžitě)
            setTimeout(() => {
                if (cropImage.complete && cropImage.naturalWidth > 0 && cropImage.naturalHeight > 0 && !cropperInstance) {
                    // Obrázek je načtený, ale onload se možná nespustil
                    console.log('✅ Obrázek je už načtený (fallback kontrola)');
                    cropImage.onload();
                }
            }, 200);
        };
        
        reader.onerror = function() {
            console.error('❌ Chyba při čtení souboru');
            if (cropLoading) cropLoading.style.display = 'none';
            modal.style.display = 'none';
            alert('Chyba při čtení obrázku. Zkuste to znovu.');
        };
        
        reader.readAsDataURL(file);
    };
    
    // Funkce pro zavření modalu
    window.closeImageCropModal = function() {
        const modal = document.getElementById('imageCropModal');
        if (modal) {
            modal.style.display = 'none';
        }
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
        currentCropFile = null;
        currentCropInput = null;
    };
    
    // Funkce pro potvrzení ořezu
    window.confirmImageCrop = function() {
        if (!cropperInstance || !currentCropInput) {
            console.error('❌ Cropper instance or input not found');
            return;
        }
        
        console.log('✂️ Potvrzuji ořez obrázku...');
        
        // Získat oříznutý obrázek jako canvas s poměrem 4:3
        const canvas = cropperInstance.getCroppedCanvas({
            width: 800,
            height: 600,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        
        if (!canvas) {
            console.error('❌ Failed to get cropped canvas');
            return;
        }
        
        console.log('✅ Canvas vytvořen, převádím na blob...');
        
        // Převést canvas na blob
        canvas.toBlob(function(blob) {
            if (!blob) {
                console.error('❌ Failed to create blob from canvas');
                return;
            }
            
            console.log('✅ Blob vytvořen, velikost:', blob.size, 'typ:', blob.type);
            
            // Vytvořit File objekt z blobu
            const fileName = currentCropFile ? (currentCropFile.name || 'cropped-image.jpg') : 'cropped-image.jpg';
            const fileExtension = fileName.split('.').pop() || 'jpg';
            const croppedFile = new File([blob], `cropped-${Date.now()}.${fileExtension}`, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });
            
            console.log('✅ File objekt vytvořen:', {
                name: croppedFile.name,
                size: croppedFile.size,
                type: croppedFile.type,
                lastModified: croppedFile.lastModified
            });
            
            // Nastavit oříznutý soubor do inputu pomocí DataTransfer
            try {
                // Nastavit flag, aby se change event neotevřel modal znovu
                isSettingCroppedFile = true;
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(croppedFile);
                currentCropInput.files = dataTransfer.files;
                
                console.log('✅ Soubor nastaven do inputu:', {
                    filesLength: currentCropInput.files.length,
                    fileName: currentCropInput.files[0]?.name,
                    fileSize: currentCropInput.files[0]?.size,
                    fileType: currentCropInput.files[0]?.type,
                    isFile: currentCropInput.files[0] instanceof File,
                    isBlob: currentCropInput.files[0] instanceof Blob
                });
                
                // Flag se resetuje v change listeneru
                
                // Aktualizovat náhled
                const imgPreview = document.getElementById('previewCardImage');
                const previewImagePreview = document.getElementById('previewImagePreview');
                if (imgPreview || previewImagePreview) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (imgPreview) {
                            imgPreview.src = e.target.result;
                        }
                        if (previewImagePreview) {
                            // Zobrazit obrázek s křížkem pro odstranění
                            previewImagePreview.innerHTML = `
                                <div style="position: relative; display: inline-block; width: 100%;">
                                    <img src="${e.target.result}" alt="Náhled" style="max-width: 100%; border-radius: 8px; display: block;">
                                    <button type="button" class="remove-image-btn" onclick="removePreviewImage()" title="Odstranit fotku" style="position: absolute; top: 5px; right: 5px;">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `;
                            previewImagePreview.classList.remove('empty');
                        }
                        console.log('✅ Náhled aktualizován');
                        
                        // Zavřít modal až po aktualizaci náhledu
                        closeImageCropModal();
                        
                        // Aktualizovat validaci
                        if (typeof validateRequired === 'function') {
                            validateRequired();
                        }
                        
                        console.log('✅ Ořez dokončen, modal zavřen');
                    };
                    reader.readAsDataURL(croppedFile);
                } else {
                    // Pokud není náhled, zavřít modal hned
                    closeImageCropModal();
                    
                    // Aktualizovat validaci
                    if (typeof validateRequired === 'function') {
                        validateRequired();
                    }
                    
                    console.log('✅ Ořez dokončen, modal zavřen (bez náhledu)');
                }
            } catch (error) {
                console.error('❌ Chyba při nastavení souboru:', error);
                alert('Chyba při uložení oříznutého obrázku. Zkuste to znovu.');
            }
        }, 'image/jpeg', 0.9);
    };
})();


