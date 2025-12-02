/* eslint-disable no-console */
(function() {
    // Po načtení DOM připravit stránku
    document.addEventListener('DOMContentLoaded', () => {
        // Počkat na Firebase a poté rozhodnout podle onAuthStateChanged
        const waitForFirebase = setInterval(async () => {
            if (window.firebaseReady && window.firebaseAuth && window.firebaseDb) {
                clearInterval(waitForFirebase);
                try {
                    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    onAuthStateChanged(window.firebaseAuth, (user) => {
                        if (user) {
                            // Zavřít případný auth modal, pokud se zobrazil dříve
                            const authModal = document.getElementById('authModal');
                            if (authModal) {
                                authModal.style.display = 'none';
                                document.body.style.overflow = 'auto';
                            }
                            initCreateAdPage();
                        } else {
                            // Uživatel není přihlášen – až TEĎ zobrazit login
                            if (typeof window.showAuthModal === 'function') {
                                window.afterLoginCallback = () => window.location.reload();
                                showAuthModal('login');
                            } else {
                                alert('Pro vytvoření inzerátu se prosím přihlaste.');
                                window.location.href = 'index.html';
                            }
                        }
                    });
                } catch {
                    // Bezpečný fallback
                    if (!window.firebaseAuth?.currentUser) {
                        if (typeof window.showAuthModal === 'function') {
                            window.afterLoginCallback = () => window.location.reload();
                            showAuthModal('login');
                        } else {
                            alert('Pro vytvoření inzerátu se prosím přihlaste.');
                            window.location.href = 'index.html';
                        }
                    } else {
                        initCreateAdPage();
                    }
                }
            }
        }, 100);
        setTimeout(() => clearInterval(waitForFirebase), 15000);
    });

    function initCreateAdPage() {
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

        // Přepínání cen
        const priceInputs = document.getElementById('priceInputs');
        const unitSel = document.querySelector('.price-unit-selection');
        const p = document.getElementById('servicePrice');
        const pf = document.getElementById('servicePriceFrom');
        const pt = document.getElementById('servicePriceTo');
        const priceRadios = document.querySelectorAll('input[name=\"priceType\"]');
        priceRadios.forEach(r => r.addEventListener('change', onPriceTypeChange));
        onPriceTypeChange();
        function onPriceTypeChange() {
            const sel = document.querySelector('input[name=\"priceType\"]:checked');
            if (!sel) { if (priceInputs) priceInputs.style.display = 'none'; return; }
            if (priceInputs) priceInputs.style.display = 'block';
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
                }
            }
        }
        function updatePlaceholders() {
            const unit = (document.querySelector('input[name=\"priceUnit\"]:checked')?.value || 'hour');
            const unitText = unit === 'hour' ? 'hod' : 'práci';
            const cur = 'Kč';
            if (p) p.placeholder = `Cena (např. 500 ${cur}/${unitText})`;
            if (pf) pf.placeholder = `Od (např. 300 ${cur}/${unitText})`;
            if (pt) pt.placeholder = `Do (např. 800 ${cur}/${unitText})`;
        }
        document.querySelectorAll('input[name=\"priceUnit\"]').forEach(r => r.addEventListener('change', updatePlaceholders));

        // Náhledy obrázků – použít existující helper, když je k dispozici
        if (typeof window.setupImagePreviews === 'function') {
            window.setupImagePreviews();
        }

        // Odeslání formuláře
        const form = document.getElementById('addServiceForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                // Poskládat cenu jako text podle výběru
                const priceType = document.querySelector('input[name=\"priceType\"]:checked')?.value || 'negotiable';
                const unit = (document.querySelector('input[name=\"priceUnit\"]:checked')?.value || 'hour');
                const unitText = unit === 'hour' ? 'hod' : 'práci';
                const cur = 'Kč';
                let priceText = 'dohodou';
                if (priceType === 'fixed') {
                    const val = (document.getElementById('servicePrice')?.value || '').trim();
                    if (val) priceText = `${val} ${cur}/${unitText}`;
                } else if (priceType === 'range') {
                    const from = (document.getElementById('servicePriceFrom')?.value || '').trim();
                    const to = (document.getElementById('servicePriceTo')?.value || '').trim();
                    if (from && to) priceText = `od ${from} ${cur}/${unitText} do ${to} ${cur}/${unitText}`;
                }

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
                if (!previewImage?.files?.[0]) {
                    alert('Náhledový obrázek je povinný.');
                    return;
                }
                data.previewImage = previewImage.files[0];
                if (additionalImages?.files?.length) {
                    if (additionalImages.files.length > 10) {
                        alert('Můžete nahrát maximálně 10 dalších fotek.');
                        return;
                    }
                    data.additionalImages = Array.from(additionalImages.files);
                }

                // Odeslat přes existující Firebase funkci
                if (typeof window.addService === 'function') {
                    await window.addService(data);
                    // Po úspěchu přesměrovat na moje inzeráty (pokud existuje stránka), nebo na homepage
                    setTimeout(() => {
                        window.location.href = 'my-ads.html';
                    }, 800);
                } else {
                    alert('Chyba: funkcionalita přidání služby není dostupná.');
                }
            });
        }
    }
})();


