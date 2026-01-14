/* eslint-disable no-console */
(function() {
    let currentEditingAdId = null;
    let currentEditingImages = [];
    let imagesToDelete = [];
    let newImagesToUpload = [];

    // Parsování ceny z textu
    function parsePrice(priceText) {
        if (!priceText || priceText.trim() === '' || priceText.toLowerCase().includes('dohodou')) {
            return { type: 'negotiable', value: null, from: null, to: null, unit: 'hour' };
        }
        
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

    // Sestavení textu ceny
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

    // Inicializace stránky
    document.addEventListener('DOMContentLoaded', () => {
        // Počkat na Firebase
        const waitForFirebase = setInterval(async () => {
            if (window.firebaseReady && window.firebaseAuth && window.firebaseDb) {
                clearInterval(waitForFirebase);
                try {
                    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    onAuthStateChanged(window.firebaseAuth, async (user) => {
                        if (user) {
                            initEditAdPage();
                        } else {
                            if (typeof window.showAuthModal === 'function') {
                                window.afterLoginCallback = () => window.location.reload();
                                showAuthModal('login');
                            } else {
                                window.location.href = 'my-ads.html';
                            }
                        }
                    });
                } catch (authErr) {
                    console.error('Chyba při inicializaci auth:', authErr);
                    window.location.href = 'my-ads.html';
                }
            }
        }, 100);
        setTimeout(() => clearInterval(waitForFirebase), 15000);
    });

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
            const userEmail = window.firebaseAuth?.currentUser?.email;
            if (userEmail && typeof userEmail === 'string' && adminEmails.includes(userEmail.toLowerCase())) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Chyba při kontrole admin statusu:', error);
            return false;
        }
    }

    // Globální proměnná pro userId inzerátu (pro adminy)
    let targetUserId = null;

    // Načtení a předvyplnění dat
    async function initEditAdPage() {
        // Získat ID z URL
        const urlParams = new URLSearchParams(window.location.search);
        const adId = urlParams.get('id');
        const urlUserId = urlParams.get('userId');
        
        if (!adId) {
            showMessage('Chybí ID inzerátu', 'error');
            setTimeout(() => window.location.href = 'my-ads.html', 2000);
            return;
        }
        
        currentEditingAdId = adId;
        
        // Zkontrolovat, jestli je uživatel admin
        const currentUserId = window.firebaseAuth.currentUser.uid;
        const isAdmin = await checkAdminStatus(currentUserId);
        
        // Pokud je admin a je v URL userId, použít ho
        if (isAdmin && urlUserId) {
            targetUserId = urlUserId;
        } else {
            targetUserId = currentUserId;
        }
        
        // Načíst data inzerátu
        try {
            const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const adRef = doc(window.firebaseDb, 'users', targetUserId, 'inzeraty', adId);
            const adSnap = await getDoc(adRef);
            
            if (!adSnap.exists()) {
                showMessage('Inzerát nebyl nalezen', 'error');
                setTimeout(() => window.location.href = isAdmin ? 'inzeraty.html' : 'my-ads.html', 2000);
                return;
            }
            
            const ad = { id: adId, ...adSnap.data() };
            
            // Předvyplnit formulář
            fillForm(ad);
            
            // Nastavit event listenery
            setupPriceControls();
            setupImageListeners();
            setupPreview();
            setupFormSubmit();
            
        } catch (error) {
            console.error('Chyba při načítání inzerátu:', error);
            showMessage('Nepodařilo se načíst inzerát', 'error');
            const isAdmin = await checkAdminStatus(currentUserId);
            setTimeout(() => window.location.href = isAdmin ? 'inzeraty.html' : 'my-ads.html', 2000);
        }
    }

    // Předvyplnění formuláře
    function fillForm(ad) {
        document.getElementById('editServiceTitle').value = ad.title || '';
        document.getElementById('editServiceCategory').value = ad.category || '';
        document.getElementById('editServiceDescription').value = ad.description || '';
        document.getElementById('editServiceLocation').value = ad.location || '';
        document.getElementById('editServiceStatus').value = ad.status || 'active';
        
        // Parsovat a nastavit cenu
        const priceData = parsePrice(ad.price || '');
        const priceTypeFixed = document.getElementById('editPriceTypeFixed');
        const priceTypeRange = document.getElementById('editPriceTypeRange');
        const priceTypeNegotiable = document.getElementById('editPriceTypeNegotiable');
        const priceInput = document.getElementById('editServicePrice');
        const priceFromInput = document.getElementById('editServicePriceFrom');
        const priceToInput = document.getElementById('editServicePriceTo');
        const unitPills = document.getElementById('editUnitPills');
        const inputsContainer = document.querySelector('#editServiceForm .price-inline .inputs');
        
        if (priceData.type === 'fixed' && priceTypeFixed) {
            priceTypeFixed.checked = true;
            if (priceInput) {
                priceInput.value = priceData.value || '';
                priceInput.style.display = 'block';
                priceInput.required = true;
            }
            if (unitPills) unitPills.style.display = 'flex';
            if (inputsContainer) inputsContainer.style.display = 'block';
        } else if (priceData.type === 'range' && priceTypeRange) {
            priceTypeRange.checked = true;
            if (priceFromInput) {
                priceFromInput.value = priceData.from || '';
                priceFromInput.style.display = 'block';
                priceFromInput.required = true;
            }
            if (priceToInput) {
                priceToInput.value = priceData.to || '';
                priceToInput.style.display = 'block';
                priceToInput.required = true;
            }
            if (unitPills) unitPills.style.display = 'flex';
            if (inputsContainer) inputsContainer.style.display = 'block';
        } else if (priceTypeNegotiable) {
            priceTypeNegotiable.checked = true;
            if (inputsContainer) inputsContainer.style.display = 'none';
            if (unitPills) unitPills.style.display = 'none';
        }
        
        if (priceData.unit) {
            const unitRadio = document.querySelector(`input[name="editPriceUnit"][value="${priceData.unit}"]`);
            if (unitRadio) unitRadio.checked = true;
        }
        
        // Načíst a zobrazit fotky
        currentEditingImages = ad.images && Array.isArray(ad.images) ? [...ad.images] : [];
        imagesToDelete = [];
        newImagesToUpload = [];
        
        const previewImagePreview = document.getElementById('editPreviewImagePreview');
        const previewImageInput = document.getElementById('editPreviewImage');
        const noPreviewCheckbox = document.getElementById('editNoPreviewImage');
        
        if (currentEditingImages.length > 0) {
            const firstImageUrl = typeof currentEditingImages[0] === 'string' 
                ? currentEditingImages[0] 
                : (currentEditingImages[0].url || currentEditingImages[0]);
            
            if (previewImagePreview) {
                previewImagePreview.innerHTML = `<img src="${firstImageUrl}" alt="Náhled" style="max-width: 100%; border-radius: 8px;">`;
                previewImagePreview.classList.remove('empty');
            }
            
            if (noPreviewCheckbox) noPreviewCheckbox.checked = false;
            if (previewImageInput) {
                previewImageInput.required = true;
                previewImageInput.disabled = false;
            }
        } else {
            const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
            if (previewImagePreview) {
                previewImagePreview.innerHTML = `<img src="${DEFAULT_PREVIEW_LOGO}" alt="Náhled" style="max-width: 100%; border-radius: 8px;">`;
            }
            if (noPreviewCheckbox) noPreviewCheckbox.checked = true;
            if (previewImageInput) {
                previewImageInput.required = false;
                previewImageInput.disabled = true;
            }
        }
        
        const additionalImagesPreview = document.getElementById('editAdditionalImagesPreview');
        if (additionalImagesPreview) {
            additionalImagesPreview.innerHTML = '';
            if (currentEditingImages.length > 1) {
                currentEditingImages.slice(1).forEach((img, index) => {
                    const imgUrl = typeof img === 'string' ? img : (img.url || img);
                    if (imgUrl && !imagesToDelete.includes(imgUrl)) {
                        const imgDiv = document.createElement('div');
                        imgDiv.className = 'image-preview-item';
                        imgDiv.innerHTML = `
                            <img src="${imgUrl}" alt="Fotka ${index + 2}">
                            <button type="button" class="remove-image-btn" onclick="removeEditImage(${index + 1})" title="Odebrat">
                                <i class="fas fa-times"></i>
                            </button>
                        `;
                        additionalImagesPreview.appendChild(imgDiv);
                    }
                });
            }
        }
        
        // Aktualizovat counter
        const editDescription = document.getElementById('editServiceDescription');
        const editCounter = document.getElementById('editServiceDescriptionCounter');
        if (editDescription && editCounter) {
            const remaining = 600 - editDescription.value.length;
            editCounter.textContent = remaining;
            if (editCounter.parentElement) {
                editCounter.parentElement.classList.remove('warning', 'error');
                if (remaining < 50) {
                    editCounter.parentElement.classList.add('error');
                } else if (remaining < 100) {
                    editCounter.parentElement.classList.add('warning');
                }
            }
        }
    }

    // Nastavení ovládání ceny
    function setupPriceControls() {
        const p = document.getElementById('editServicePrice');
        const pf = document.getElementById('editServicePriceFrom');
        const pt = document.getElementById('editServicePriceTo');
        const priceInputs = document.querySelector('#editServiceForm .price-inline .inputs');
        const unitSel = document.getElementById('editUnitPills');
        
        function onPriceTypeChange() {
            const sel = document.querySelector('input[name="editPriceType"]:checked');
            if (!sel) {
                if (priceInputs) priceInputs.style.display = 'none';
                if (unitSel) unitSel.style.display = 'none';
                return;
            }
            if (priceInputs) priceInputs.style.display = 'block';
            
            if (p && pf && pt && unitSel) {
                p.style.display = 'none';
                pf.style.display = 'none';
                pt.style.display = 'none';
                unitSel.style.display = 'none';
                p.required = false;
                pf.required = false;
                pt.required = false;
                
                if (sel.value === 'fixed') {
                    unitSel.style.display = 'flex';
                    p.style.display = 'block';
                    p.required = true;
                } else if (sel.value === 'range') {
                    unitSel.style.display = 'flex';
                    pf.style.display = 'block';
                    pt.style.display = 'block';
                    pf.required = true;
                    pt.required = true;
                } else {
                    if (priceInputs) priceInputs.style.display = 'none';
                    if (unitSel) unitSel.style.display = 'none';
                }
            }
        }
        
        document.querySelectorAll('input[name="editPriceType"]').forEach(r => {
            r.addEventListener('change', onPriceTypeChange);
            r.addEventListener('click', onPriceTypeChange);
        });
        
        document.querySelectorAll('input[name="editPriceUnit"]').forEach(r => {
            r.addEventListener('change', function() {
                // Můžeme přidat další logiku pokud je potřeba
            });
        });
    }

    // Nastavení event listenerů pro obrázky
    function setupImageListeners() {
        const previewImageInput = document.getElementById('editPreviewImage');
        const previewImagePreview = document.getElementById('editPreviewImagePreview');
        const noPreviewCheckbox = document.getElementById('editNoPreviewImage');
        const additionalImagesInput = document.getElementById('editAdditionalImages');
        const additionalImagesPreview = document.getElementById('editAdditionalImagesPreview');
        
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

    // Odebrat existující fotku
    function removeEditImage(index) {
        if (index === 0) return;
        const img = currentEditingImages[index];
        const imgUrl = typeof img === 'string' ? img : (img.url || img);
        if (imgUrl && !imgUrl.includes('vychozi-inzerat.png')) {
            imagesToDelete.push(imgUrl);
        }
        currentEditingImages.splice(index, 1);
        
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

    // Odebrat novou fotku
    function removeNewEditImage(fileName) {
        newImagesToUpload = newImagesToUpload.filter(f => f.name !== fileName);
        
        const additionalImagesPreview = document.getElementById('editAdditionalImagesPreview');
        if (additionalImagesPreview) {
            const existingPreviews = additionalImagesPreview.querySelectorAll('.image-preview-item');
            existingPreviews.forEach(el => {
                const img = el.querySelector('img');
                if (img && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
                    // Existující fotka, nechat
                } else {
                    el.remove();
                }
            });
            
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

    // Nastavení náhledu karty
    function setupPreview() {
        const titleEl = document.getElementById('editServiceTitle');
        const catEl = document.getElementById('editServiceCategory');
        const locEl = document.getElementById('editServiceLocation');
        const imgPreview = document.getElementById('previewCardImage');
        const titlePreview = document.getElementById('previewCardTitle');
        const metaCat = document.getElementById('previewCardCategory');
        const metaLoc = document.getElementById('previewCardLocation');
        const pricePreview = document.getElementById('previewCardPrice');
        const previewImageInput = document.getElementById('editPreviewImage');
        const noPreviewCheckbox = document.getElementById('editNoPreviewImage');
        const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
        
        // Nastavit počáteční obrázek
        if (imgPreview && currentEditingImages.length > 0) {
            const firstImageUrl = typeof currentEditingImages[0] === 'string' 
                ? currentEditingImages[0] 
                : (currentEditingImages[0].url || currentEditingImages[0]);
            if (firstImageUrl) {
                imgPreview.src = firstImageUrl;
            } else {
                imgPreview.src = DEFAULT_PREVIEW_LOGO;
            }
        } else if (imgPreview) {
            imgPreview.src = DEFAULT_PREVIEW_LOGO;
        }
        
        function updatePreview() {
            titlePreview.textContent = (titleEl?.value || 'Název inzerátu').trim() || 'Název inzerátu';
            metaCat.textContent = catEl?.options?.[catEl.selectedIndex || 0]?.text || 'Kategorie';
            metaLoc.textContent = locEl?.options?.[locEl.selectedIndex || 0]?.text || 'Kraj';
            pricePreview.textContent = computeEditPriceText();
        }
        
        // Aktualizace obrázku při změně náhledového obrázku
        if (previewImageInput && imgPreview) {
            previewImageInput.addEventListener('change', function(e) {
                const file = e.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        imgPreview.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // Aktualizace obrázku při změně checkboxu "bez náhledového obrázku"
        if (noPreviewCheckbox && imgPreview) {
            noPreviewCheckbox.addEventListener('change', function() {
                if (noPreviewCheckbox.checked) {
                    imgPreview.src = DEFAULT_PREVIEW_LOGO;
                } else if (currentEditingImages.length > 0) {
                    const firstImageUrl = typeof currentEditingImages[0] === 'string' 
                        ? currentEditingImages[0] 
                        : (currentEditingImages[0].url || currentEditingImages[0]);
                    if (firstImageUrl) {
                        imgPreview.src = firstImageUrl;
                    } else {
                        imgPreview.src = DEFAULT_PREVIEW_LOGO;
                    }
                }
            });
        }
        
        titleEl?.addEventListener('input', updatePreview);
        catEl?.addEventListener('change', updatePreview);
        locEl?.addEventListener('change', updatePreview);
        
        document.getElementById('editServicePrice')?.addEventListener('input', updatePreview);
        document.getElementById('editServicePriceFrom')?.addEventListener('input', updatePreview);
        document.getElementById('editServicePriceTo')?.addEventListener('input', updatePreview);
        document.querySelectorAll('input[name="editPriceType"]').forEach(r => r.addEventListener('change', updatePreview));
        document.querySelectorAll('input[name="editPriceUnit"]').forEach(r => r.addEventListener('change', updatePreview));
        
        updatePreview();
    }

    // Nastavení submit formuláře
    function setupFormSubmit() {
        const form = document.getElementById('editServiceForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateAd();
        });
    }

    // Aktualizace inzerátu
    async function updateAd() {
        try {
            if (!currentEditingAdId) {
                showMessage('Chybí ID inzerátu', 'error');
                return;
            }
            
            const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            
            const storage = getStorage(window.firebaseApp);
            // Použít targetUserId pokud je nastaven (pro adminy), jinak currentUser
            const userId = targetUserId || window.firebaseAuth.currentUser.uid;
            
            // Smazat označené obrázky
            for (const imgUrl of imagesToDelete) {
                try {
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
            const DEFAULT_PREVIEW_LOGO = '/fotky/vychozi-inzerat.png';
            let previewImageUrl = null;
            let defaultPreviewUrl = null;
            
            if (previewImageInput?.files?.[0]) {
                const imageRef = ref(storage, `services/${userId}/${Date.now()}_preview.jpg`);
                const imageSnapshot = await uploadBytes(imageRef, previewImageInput.files[0], {
                    contentType: previewImageInput.files[0].type || 'image/jpeg'
                });
                previewImageUrl = await getDownloadURL(imageSnapshot.ref);
            } else if (noPreviewCheckbox?.checked) {
                defaultPreviewUrl = DEFAULT_PREVIEW_LOGO;
                previewImageUrl = DEFAULT_PREVIEW_LOGO;
            } else if (currentEditingImages.length > 0) {
                const firstImg = currentEditingImages[0];
                const firstImgUrl = typeof firstImg === 'string' ? firstImg : (firstImg.url || firstImg);
                if (firstImgUrl && !imagesToDelete.includes(firstImgUrl)) {
                    previewImageUrl = firstImgUrl;
                } else {
                    defaultPreviewUrl = DEFAULT_PREVIEW_LOGO;
                    previewImageUrl = DEFAULT_PREVIEW_LOGO;
                }
            } else {
                defaultPreviewUrl = DEFAULT_PREVIEW_LOGO;
                previewImageUrl = DEFAULT_PREVIEW_LOGO;
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
            
            // Kombinovat obrázky
            const finalImages = [];
            
            if (previewImageUrl) {
                finalImages.push({
                    url: previewImageUrl,
                    isPreview: true
                });
            }
            
            if (currentEditingImages.length > 1) {
                currentEditingImages.slice(1).forEach(img => {
                    const imgUrl = typeof img === 'string' ? img : (img.url || img);
                    if (imgUrl && !imagesToDelete.includes(imgUrl)) {
                        finalImages.push(typeof img === 'string' ? { url: imgUrl } : img);
                    }
                });
            }
            
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
            
            // Pokud je použito výchozí logo, přidat defaultPreviewUrl
            if (defaultPreviewUrl) {
                updateData.defaultPreviewUrl = defaultPreviewUrl;
            }
            
            // Použít targetUserId pokud je nastaven (pro adminy), jinak currentUser
            const finalUserId = targetUserId || window.firebaseAuth.currentUser.uid;
            
            console.log('Aktualizuji data:', updateData);
            await updateDoc(doc(window.firebaseDb, 'users', finalUserId, 'inzeraty', currentEditingAdId), updateData);
            
            showMessage('Inzerát byl úspěšně aktualizován!', 'success');
            
            // Pokud je admin, přesměrovat na inzeraty.html, jinak na my-ads.html
            const currentUserId = window.firebaseAuth.currentUser.uid;
            const isAdmin = await checkAdminStatus(currentUserId);
            setTimeout(() => {
                window.location.href = isAdmin && targetUserId && targetUserId !== currentUserId ? 'inzeraty.html' : 'my-ads.html';
            }, 1000);
            
        } catch (error) {
            console.error('Chyba při aktualizaci inzerátu:', error);
            showMessage('Nepodařilo se aktualizovat inzerát.', 'error');
        }
    }

    // Helper funkce pro zobrazení zprávy
    function showMessage(message, type = 'info') {
        if (typeof window.showMessage === 'function') {
            window.showMessage(message, type);
        } else {
            console.log(`[showMessage] ${type}: ${message}`);
            if (type === 'error') {
                alert(message);
            } else if (type === 'success') {
                alert(message);
            }
        }
    }

    // Export funkcí
    window.removeEditImage = removeEditImage;
    window.removeNewEditImage = removeNewEditImage;
})();

