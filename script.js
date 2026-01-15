// Mailchimp popup (sitewide newsletter) – inject once
(function initMailchimpPopup() {
    try {
        if (document.getElementById('mcjs')) return;
        const s = document.createElement('script');
        s.id = 'mcjs';
        s.async = true;
        s.src = 'https://chimpstatic.com/mcjs-connected/js/users/e223755f97b06a0750d885407/971d5b572a7403c313f3aacc9.js';
        (document.head || document.documentElement).appendChild(s);
        
        // Zmenšit Mailchimp popup po načtení
        setTimeout(function() {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            // Najít všechny možné Mailchimp popupy
                            const popups = node.querySelectorAll ? node.querySelectorAll('div[id*="mce"], div[class*="mce"], div[id*="mailchimp"], div[class*="mailchimp"], div[id*="mc-"], div[class*="mc-"]') : [];
                            popups.forEach(function(popup) {
                                if (popup.style) {
                                    popup.style.maxWidth = '380px';
                                    popup.style.width = '90%';
                                }
                            });
                            
                            // Pokud je samotný node popup
                            if (node.tagName === 'DIV' && (node.id && (node.id.includes('mce') || node.id.includes('mailchimp') || node.id.includes('mc-')) || 
                                (node.className && (node.className.includes('mce') || node.className.includes('mailchimp') || node.className.includes('mc-'))))) {
                                if (node.style) {
                                    node.style.maxWidth = '380px';
                                    node.style.width = '90%';
                                }
                            }
                        }
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }, 1000);
    } catch (_) {}
})();

// Sidebar toggle functionality
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('expanded');
    mainContent.classList.toggle('sidebar-collapsed');
    
    // Show/hide the toggle button
    if (sidebar.classList.contains('collapsed')) {
        toggleBtn.classList.add('show');
    } else {
        toggleBtn.classList.remove('show');
    }
    
    // Save preference to localStorage
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    
    // Reaplikovat avatar (jiné zobrazení v collapsed režimu)
    try {
        const uid = window.firebaseAuth?.currentUser?.uid;
        if (uid) {
            loadAndApplyUserAvatar(uid);
        }
    } catch (_) {}
}

// Mobile menu toggle with improved UX
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const isOpen = sidebar.classList.contains('mobile-open');
    
    // Uložit aktuální scroll pozici před otevřením menu
    const scrollY = window.scrollY || window.pageYOffset;
    
    if (isOpen) {
        sidebar.classList.remove('mobile-open');
        body.classList.remove('sidebar-open');
        body.removeAttribute('data-scroll-pos');
        
        // Remove overlay if exists
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.remove();
        // Zobrazit tlačítko menu
        if (menuBtn) menuBtn.style.display = 'flex';
    } else {
        // Uložit scroll pozici před otevřením (pro případné budoucí použití)
        const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        body.setAttribute('data-scroll-pos', currentScrollY.toString());
        
        sidebar.classList.add('mobile-open');
        body.classList.add('sidebar-open');
        // Schovat tlačítko menu
        if (menuBtn) menuBtn.style.display = 'none';
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            min-width: 100vw !important;
            min-height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 1999 !important;
            animation: fadeIn 0.3s ease;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
        `;
        overlay.addEventListener('click', toggleMobileMenu);
        document.body.appendChild(overlay);
        
        // Zajistit načtení avatara při otevření mobilního menu
        try {
            const uid = window.firebaseAuth?.currentUser?.uid;
            if (uid) {
                // Znovu aplikovat avatar, pokud už existuje
                if (window.__sidebarAvatarUrl) {
                    applySidebarAvatar(window.__sidebarAvatarUrl);
                } else {
                    // Načíst avatar znovu
                    loadAndApplyUserAvatar(uid);
                }
            } else {
                // Pokud není přihlášený, zobrazit stock avatar
                applySidebarAvatar(STOCK_AVATAR_URL);
            }
        } catch (_) {
            // Fallback na stock avatar
            applySidebarAvatar(STOCK_AVATAR_URL);
        }
    }
}

// Reset mobile menu state on page load
function resetMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar) {
        sidebar.classList.remove('mobile-open');
    }
    if (body) {
        body.classList.remove('sidebar-open');
    }
    if (overlay) {
        overlay.remove();
    }
    if (menuBtn) {
        menuBtn.style.display = 'flex';
    }
}

// Automaticky nastavit aktivní stav navigace podle aktuální stránky
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';
    
    // Najít všechny navigační odkazy
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Odstranit aktivní stav ze všech odkazů
        link.classList.remove('active');
        
        // Zkontrolovat, zda odkaz odpovídá aktuální stránce
        if (href === currentPage || 
            (currentPage === '' && href === 'index.html') ||
            (currentPage === 'index.html' && href === 'index.html')) {
            link.classList.add('active');
        } else if (href.includes(currentPage) && currentPage !== 'index.html') {
            link.classList.add('active');
        }
    });
}

// Close mobile menu when clicking on a link
document.addEventListener('DOMContentLoaded', () => {
    // Reset menu state on page load
    resetMobileMenu();
    
    // Nastavit aktivní stav navigace
    setActiveNavLink();
    
    // Use event delegation for nav links (works for dynamically added links)
    document.addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                // Close menu immediately before navigation
                resetMobileMenu();
            }
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                resetMobileMenu();
            }
        }
    });
    
    // Reset menu when page is loaded with hash (after navigation)
    if (window.location.hash) {
        // Wait a bit for page to fully load
        setTimeout(() => {
            resetMobileMenu();
        }, 100);
    }
});

// Also reset on page visibility change (when user returns to tab)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        resetMobileMenu();
    }
});

// Reset on page unload
window.addEventListener('beforeunload', () => {
    resetMobileMenu();
});

// Reset menu when hash changes (navigation to anchor links)
window.addEventListener('hashchange', () => {
    resetMobileMenu();
});

// Reset menu after page load (handles cases where DOMContentLoaded already fired)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        resetMobileMenu();
    }, 0);
}

// Dark mode disabled: force light theme
function toggleDarkMode() {}

// Globální funkce pro inicializaci character counteru pro textarea
window.initCharCounter = function(textareaId, counterId, maxLength = 600) {
    const textarea = document.getElementById(textareaId);
    const counter = document.getElementById(counterId);
    
    if (!textarea || !counter) return;
    
    // Funkce pro aktualizaci counteru
    const updateCounter = () => {
        const remaining = maxLength - textarea.value.length;
        counter.textContent = remaining;
        
        // Změna barvy podle zbývajících znaků
        if (counter.parentElement) {
            counter.parentElement.classList.remove('warning', 'error');
            if (remaining < 50) {
                counter.parentElement.classList.add('error');
            } else if (remaining < 100) {
                counter.parentElement.classList.add('warning');
            }
        }
    };
    
    // Event listenery pro real-time aktualizaci
    textarea.addEventListener('input', updateCounter);
    textarea.addEventListener('paste', () => {
        setTimeout(updateCounter, 10);
    });
    textarea.addEventListener('change', updateCounter);
    
    // Inicializace při načtení (pro případ, že textarea už má hodnotu)
    updateCounter();
    
    // Vrátit funkci updateCounter pro případné manuální volání
    return updateCounter;
}

// Globální funkce pro kontrolu a zobrazení admin menu (dostupná všude)
window.checkAndShowAdminMenu = async function() {
    const adminSection = document.getElementById('adminSection');
    if (!adminSection) return;
    
    try {
        // Počkat na Firebase
        if (!window.firebaseAuth || !window.firebaseDb) {
            setTimeout(checkAndShowAdminMenu, 500);
            return;
        }
        
        const auth = window.firebaseAuth;
        const user = auth.currentUser;
        
        if (!user) {
            adminSection.style.display = 'none';
            return;
        }
        
        // Zkontrolovat admin status
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', user.uid, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        let isAdmin = false;
        
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            if (profileData.isAdmin === true || profileData.role === 'admin') {
                isAdmin = true;
            }
        }
        
        // Fallback: kontrola přes email (pouze pro skutečné admin emaily)
        if (!isAdmin) {
            const adminEmails = ['admin@bulldogo.cz', 'support@bulldogo.cz'];
            if (user.email && adminEmails.includes(user.email.toLowerCase())) {
                isAdmin = true;
            }
        }
        
        // Poznámka: localStorage fallback byl odstraněn kvůli bezpečnosti
        // Admin menu se zobrazuje pouze uživatelům s isAdmin=true nebo role='admin' v profilu
        
        if (isAdmin) {
            adminSection.style.display = 'block';
            console.log('✅ Admin menu zobrazeno');
        } else {
            adminSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Chyba při kontrole admin menu:', error);
        adminSection.style.display = 'none';
    }
}

// Load preferences on page load
document.addEventListener('DOMContentLoaded', () => {
    // Force light mode
    document.body.classList.remove('dark-mode');
    
    // Load sidebar preference
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        const toggleBtn = document.querySelector('.sidebar-toggle-btn');
        
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('expanded');
        mainContent.classList.add('sidebar-collapsed');
        toggleBtn.classList.add('show');
    }

    // Initialize auth state management
    initializeAuthState();
    
    // Zkontrolovat admin menu po načtení stránky
    setTimeout(checkAndShowAdminMenu, 1000);
    
    // Pokud je už plán v localStorage, vykreslit odznak hned (rychlý náběh)
    try {
        const cachedPlan = localStorage.getItem('bdg_plan');
        if (cachedPlan) applySidebarBadge(cachedPlan);
    } catch (_) {}
    
    // Po návratu na stránku re-aplikovat z cache (např. „Mé inzeráty“)
    window.addEventListener('pageshow', () => {
        try {
            const cachedPlan = localStorage.getItem('bdg_plan');
            if (cachedPlan) applySidebarBadge(cachedPlan);
        } catch (_) {}
    });
    
    // Přepínání vzhledu avataru podle hoveru sidebaru
    try {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const reapply = () => applySidebarAvatar(window.__sidebarAvatarUrl || '');
            sidebar.addEventListener('mouseenter', reapply);
            sidebar.addEventListener('mouseleave', reapply);
        }
    } catch (_) {}
    
    // Inicializace character counteru pro popis inzerátu
    initCharCounter('serviceDescription', 'serviceDescriptionCounter', 600);
    initCharCounter('editServiceDescription', 'editServiceDescriptionCounter', 600);

    // Lazy-load pro všechny obrázky bez atributu (kromě hlavního loga v hero)
    try {
        const imgs = Array.from(document.images || []);
        imgs.forEach((img) => {
            if (!img.hasAttribute('loading') && !img.classList.contains('hero-logo')) {
                img.setAttribute('loading', 'lazy');
                img.setAttribute('decoding', 'async');
            }
        });
    } catch (_) {}

    // Propojení vyhledávače na hlavní stránce se stránkou služeb
    const homeSearchBtn = document.getElementById('homeSearchBtn');
    const homeSearchInput = document.getElementById('homeSearchInput');
    const homeRegionFilter = document.getElementById('homeRegionFilter');
    const goToServices = () => {
        const q = (homeSearchInput?.value || '').trim();
        const region = (homeRegionFilter?.value || '').trim();
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (region) params.set('region', region);
        const url = `services.html${params.toString() ? '?' + params.toString() : ''}`;
        window.location.href = url;
    };
    if (homeSearchBtn) {
        homeSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToServices();
        });
    }
    if (homeSearchInput) {
        homeSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                goToServices();
            }
        });
    }

    // Init Services Categories Carousel
    initServicesCarousel();

    // Promo rotating word with slide animation
    const rotateWrap = document.querySelector('.promo-rotate-wrap');
    if (rotateWrap) {
        const words = ['partnery', 'kolegy', 'klienty'];
        let index = 0;
        const durationMs = 450;
        const delayMs = 2000;

        // zajistí počáteční slovo absolutně pozicované a spočítá výšku
        let current = rotateWrap.querySelector('.promo-rotate-word');
        current.style.width = 'auto';
        // změř výšku písma i skutečný line-height řádku a srovnej do stejné vertikální roviny
        const measureSpan = document.createElement('span');
        measureSpan.className = 'promo-rotate-word';
        measureSpan.style.visibility = 'hidden';
        measureSpan.textContent = current.textContent;
        rotateWrap.appendChild(measureSpan);
        const wordHeight = Math.ceil(measureSpan.getBoundingClientRect().height);
        const subtitleEl = rotateWrap.closest('.promo-subtitle') || rotateWrap.parentElement;
        const lh = Math.ceil(parseFloat(getComputedStyle(subtitleEl).lineHeight));
        const cssAdjust = parseFloat(getComputedStyle(rotateWrap).getPropertyValue('--baseline-adjust')) || 0;
        const baseTop = Math.max(0, Math.floor((lh - wordHeight) / 2)) + cssAdjust;
        rotateWrap.style.height = lh + 'px';
        current.style.top = baseTop + 'px';
        measureSpan.remove();
        // helper: spočítá šířku textu bez absolutního pozicování
        const measureWidth = (text) => {
            const s = document.createElement('span');
            s.className = 'promo-rotate-word';
            s.style.visibility = 'hidden';
            s.style.position = 'static';
            s.style.left = 'auto';
            s.style.top = 'auto';
            s.textContent = text;
            rotateWrap.appendChild(s);
            const w = s.getBoundingClientRect().width;
            s.remove();
            return Math.ceil(w);
        };

        // nastav počáteční šířku podle aktuálního slova
        rotateWrap.style.width = measureWidth(current.textContent) + 'px';

        const showNext = () => {
            const nextIndex = (index + 1) % words.length;
            const next = document.createElement('span');
            next.className = 'promo-rotate-word anim-in';
            next.textContent = words[nextIndex];
            rotateWrap.appendChild(next);

            // zarovnat absolutně do stejné pozice
            next.style.left = '0';
            next.style.top = baseTop + 'px';

            // animate out current
            current.classList.remove('is-current');
            current.classList.add('anim-out');

            // after animation, cleanup
            window.setTimeout(() => {
                current.remove();
                next.classList.remove('anim-in');
                next.classList.add('is-current');
                current = next;
                index = nextIndex;
                // aktualizuj šířku kontejneru podle nového slova
                rotateWrap.style.width = measureWidth(current.textContent) + 'px';
            }, durationMs);
        };

        window.setInterval(showNext, delayMs);
    }
});

// Fallback loader for category images: tries .jpg, .png, sanitized names
function categoryImgFallback(imgEl) {
    if (!imgEl || imgEl._triedFallback) return;
    imgEl._triedFallback = true;
    const category = imgEl.getAttribute('data-category') || '';
    // Build candidate filenames
    const variants = [];
    // Original name (already tried .jpg)
    variants.push(`fotky/${category}.png`);
    // Replace HTML entities and dangerous chars
    const decoded = category
        .replace(/&amp;/g, '&')
        .replace(/\//g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    variants.push(`fotky/${decoded}.jpg`);
    variants.push(`fotky/${decoded}.png`);
    // ASCII-friendly variant: remove diacritics
    const ascii = decoded.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    variants.push(`fotky/${ascii}.jpg`);
    variants.push(`fotky/${ascii}.png`);

    const tryNext = (idx) => {
        if (idx >= variants.length) {
            imgEl.style.display = 'none';
            return;
        }
        const testImg = new Image();
        testImg.onload = () => { imgEl.src = variants[idx]; };
        testImg.onerror = () => tryNext(idx + 1);
        testImg.src = variants[idx];
    };
    tryNext(0);
}

// User dropdown toggle
function toggleUserDropdown() {
    const userProfileCard = document.querySelector('.user-profile-card');
    userProfileCard.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const userProfileCard = document.querySelector('.user-profile-card');
    const dropdown = document.querySelector('.user-dropdown-menu');
    
    if (userProfileCard && dropdown && !userProfileCard.contains(e.target)) {
        userProfileCard.classList.remove('active');
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        e.preventDefault();

        // Speciální zacházení pro kontakt: posunout na úplné zápatí (pokud je k dispozici), jinak přejít na index.html#contact
        if (href === '#contact') {
            const footerBottom = document.querySelector('.footer-bottom') || document.querySelector('footer');
            if (footerBottom) {
                footerBottom.scrollIntoView({ behavior: 'smooth', block: 'end' });
                try { history.replaceState(null, '', href); } catch (_) { /* no-op */ }
            } else {
                window.location.href = 'index.html#contact';
            }
            return;
        }

        // Výchozí: pokud cíl existuje na stránce, plynule scrollovat; jinak přejít na index.html s hashem
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try { history.replaceState(null, '', href); } catch (_) { /* no-op */ }
        } else {
            window.location.href = `index.html${href}`;
        }
    });
});

// Zpracování odkazů na kontakt obsahujících index.html#contact - scrollovat na footer na aktuální stránce
document.querySelectorAll('a[href*="#contact"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || !href.includes('#contact')) return;
        
        // Pokud odkaz obsahuje index.html#contact, zkontrolovat, zda jsme na index.html
        if (href.includes('index.html#contact')) {
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            // Pokud nejsme na index.html, scrollovat na footer na aktuální stránce
            if (currentPage !== 'index.html') {
                e.preventDefault();
                // Počkat na renderování, pak scrollovat
                setTimeout(() => {
                    const footerBottom = document.querySelector('.footer-bottom') || document.querySelector('footer');
                    if (footerBottom) {
                        footerBottom.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        try { history.replaceState(null, '', '#contact'); } catch (_) { /* no-op */ }
                    } else {
                        // Pokud footer není na stránce, přejít na index.html a scrollovat tam
                        window.location.href = 'index.html#contact';
                    }
                }, 50);
                return;
            }
            // Pokud jsme na index.html, nechat prohlížeč přirozeně zpracovat odkaz
        }
    });
});

// Při načtení stránky se zadaným hashem zajistit správné doscrollování
function scrollToHash() {
    const h = window.location.hash;
    if (!h) return;
    
    if (h === '#contact') {
        // Počkat na načtení stránky, pak scrollovat na footer
        setTimeout(() => {
            const footerBottom = document.querySelector('.footer-bottom') || document.querySelector('footer');
            if (footerBottom) {
                footerBottom.scrollIntoView({ behavior: 'smooth', block: 'end' });
            } else {
                window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            }
        }, 100);
        return;
    }
    
    const target = document.querySelector(h);
    if (target) {
        // Offset pro případný fixní header
        const offset = 20;
        const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
            top: elementPosition - offset,
            behavior: 'smooth'
        });
    }
}

// Počkat na načtení inzerátů (pro #features hash)
function waitForAdsAndScroll() {
    const h = window.location.hash;
    if (!h) return;
    
    const servicesGrid = document.getElementById('servicesGrid');
    
    // Pokud je to #features a existuje servicesGrid, počkáme na načtení inzerátů
    if (h === '#features' && servicesGrid) {
        // Pokud už jsou inzeráty načtené (více než 0 dětí nebo má třídu indikující načtení)
        if (servicesGrid.children.length > 0) {
            // Inzeráty už jsou načtené, scrollovat hned
            setTimeout(scrollToHash, 50);
            return;
        }
        
        // Jinak čekáme pomocí MutationObserver
        const observer = new MutationObserver((mutations, obs) => {
            // Kontrola, zda byly přidány inzeráty
            if (servicesGrid.children.length > 0) {
                obs.disconnect();
                // Malé zpoždění pro zajištění vykreslení
                setTimeout(scrollToHash, 100);
            }
        });
        
        observer.observe(servicesGrid, { childList: true, subtree: true });
        
        // Fallback: pokud se do 5 sekund nic nenačte, scrollovat přesto
        setTimeout(() => {
            observer.disconnect();
            scrollToHash();
        }, 5000);
        
        return;
    }
    
    // Pro ostatní hashe scrollovat normálně
    scrollToHash();
}

// Spustit scrollování po načtení DOM
document.addEventListener('DOMContentLoaded', () => {
    // Použít vylepšenou funkci, která čeká na načtení inzerátů
    waitForAdsAndScroll();
});

// Spustit také po úplném načtení stránky (včetně obrázků) pro přesnější pozici
window.addEventListener('load', () => {
    if (window.location.hash && window.location.hash !== '#features') {
        setTimeout(scrollToHash, 200);
    }
});

// Chat link handling with auth check
document.querySelectorAll('a[href="chat.html"]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        checkAuthForChat();
    });
});

function checkAuthForChat() {
    // Check if user is authenticated
    const currentUser = window.firebaseAuth?.currentUser;
    if (currentUser) {
        // User is logged in, allow access to chat
        window.location.href = 'chat.html';
    } else {
        // User is not logged in, show auth modal
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
        } else {
            // Fallback if showAuthModal is not available yet
            window.location.href = 'chat.html';
        }
    }
}

// Export for global use
window.checkAuthForChat = checkAuthForChat;

// Initialize auth state management
function initializeAuthState() {
    // Wait for Firebase to load
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth) {
            console.log('Firebase loaded, setting up auth state listener');
            setupAuthStateListener();
            clearInterval(checkFirebase);
        }
    }, 100);
}

// Setup auth state listener
function setupAuthStateListener() {
    import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ onAuthStateChanged }) => {
        onAuthStateChanged(window.firebaseAuth, (user) => {
            console.log('Auth state changed:', user);
            updateAuthUI(user);
        });
    }).catch(error => {
        console.error('Error importing Firebase Auth:', error);
    });
}

// Update auth UI based on user state
function updateAuthUI(user) {
    const authSection = document.getElementById('authSection');
    const userProfileSection = document.getElementById('userProfileSection');
    
    if (user) {
        // User is logged in
        if (authSection) authSection.style.display = 'none';
        if (userProfileSection) {
            userProfileSection.style.display = 'block';
            updateUserProfile(user);
            // 1) Okamžitě zkusit vykreslit odznak z cache (bdg_plan), aby byl vidět hned
            try {
                const cachedPlan = localStorage.getItem('bdg_plan');
                if (cachedPlan) applySidebarBadge(cachedPlan);
            } catch (_) {}
            // 2) Asynchronně stáhnout skutečný plán a odznak případně opravit
            try {
                if (typeof window.checkUserPlanFromDatabase === 'function') {
                    window.checkUserPlanFromDatabase(user.uid).then((plan) => {
                        if (plan) {
                            try { localStorage.setItem('bdg_plan', plan); } catch (_) {}
                            applySidebarBadge(plan);
                        }
                    }).catch(() => {});
                }
            } catch (_) {}
        }
    } else {
        // User is not logged in
        if (authSection) authSection.style.display = 'block';
        if (userProfileSection) userProfileSection.style.display = 'none';
    }
}

// Update user profile information
function updateUserProfile(user) {
    // Get user data from Firebase or use default
    const displayName = user.displayName || 'Uživatel';
    const email = user.email || 'email@example.com';
    
    // Update profile display
    const userDisplayName = document.getElementById('userDisplayName');
    const userEmail = document.getElementById('userEmail');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    
    if (userDisplayName) userDisplayName.textContent = displayName;
    if (userEmail) userEmail.textContent = email;
    if (dropdownUserName) dropdownUserName.textContent = displayName;
    if (dropdownUserEmail) dropdownUserEmail.textContent = email;
	
	// Načíst avatar z Firestore profilu a propsat do UI (sidebar + hero, pokud existuje)
	try {
		loadAndApplyUserAvatar(user.uid);
	} catch (_) {}
}

// Stock avatar URL - použije se když uživatel nemá nahranou profilovku
// SVG ikona uživatele - oranžovo-žlutý gradient s bílou siluetou (minimalistická verze)
const STOCK_AVATAR_URL = 'data:image/svg+xml;base64,' + btoa('<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f77c00;stop-opacity:1" /><stop offset="100%" style="stop-color:#fdf002;stop-opacity:1" /></linearGradient></defs><circle cx="64" cy="64" r="64" fill="url(#avatarGradient)"/><circle cx="64" cy="48" r="16" fill="white"/><path d="M32 88C32 80.268 38.268 74 46 74H82C89.732 74 96 80.268 96 88V128H32V88Z" fill="white"/></svg>');

// Avatar helpers (sidebar + hero profilů)
async function loadAndApplyUserAvatar(uid) {
	try {
		if (!uid || !window.firebaseDb) return;
		const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
		const profileRef = doc(window.firebaseDb, 'users', uid, 'profile', 'profile');
		const snap = await getDoc(profileRef);
		const url = snap.exists() ? (snap.data()?.photoURL || snap.data()?.avatarUrl || '') : '';
		applySidebarAvatar(url || STOCK_AVATAR_URL);
		applyHeroAvatar(url || STOCK_AVATAR_URL);
	} catch (_) { /* tichý fallback */ }
}

// Odznak balíčku u tlačítka Profil (rychlá aplikace z cache/DB)
function applySidebarBadge(plan) {
	try {
		const userProfileSection = document.getElementById('userProfileSection');
		const btnProfile = userProfileSection && userProfileSection.querySelector('.btn-profile');
		if (!btnProfile) return;
		const old = btnProfile.querySelector('.user-badge');
		if (old) old.remove();
		if (!plan || plan === 'none') return;
		const label = plan === 'business' ? 'Firma' : plan === 'hobby' ? 'Hobby' : '?';
		const cls = plan === 'business' ? 'badge-business' : plan === 'hobby' ? 'badge-hobby' : 'badge-unknown';
		const badge = document.createElement('span');
		badge.className = 'user-badge ' + cls;
		badge.textContent = label;
		btnProfile.appendChild(badge);
	} catch (_) {}
}

function ensureSidebarAvatarNode() {
	try {
		// Primárně vložit k dolnímu bloku s tlačítkem Profil (vedle odznaku balíčku)
		const btnProfile = document.querySelector('.sidebar .user-profile-section .btn-profile');
		let wrap = document.getElementById('sidebarUserAvatar');
		if (btnProfile) {
			if (!wrap) {
				wrap = document.createElement('span');
				wrap.id = 'sidebarUserAvatar';
				wrap.style.cssText = 'display:inline-flex; margin-left:8px; vertical-align:middle;';
				const circle = document.createElement('span');
				circle.style.cssText = 'width:32px;height:32px;border-radius:50%;overflow:hidden;background:#f3f4f6;border:1px solid #e5e7eb;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;';
				const img = document.createElement('img');
				img.id = 'sidebarUserAvatarImg';
				img.alt = 'Profilová fotka';
				img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:none;';
				img.loading = 'lazy';
				img.decoding = 'async';
				const icon = document.createElement('i');
				icon.id = 'sidebarUserAvatarPh';
				icon.className = 'fas fa-user';
				icon.style.cssText = 'color:#9ca3af;font-size:12px;';
				circle.appendChild(img);
				circle.appendChild(icon);
				wrap.appendChild(circle);
				btnProfile.appendChild(wrap);
			}
			return wrap;
		}
		// Fallback: staré umístění v záhlaví (kdyby spodní část neexistovala)
		const headerButtons = document.querySelector('.sidebar .sidebar-header .header-buttons');
		if (headerButtons) {
			if (!wrap) {
				wrap = document.createElement('div');
				wrap.id = 'sidebarUserAvatar';
				wrap.style.cssText = 'margin-left:auto; display:flex; align-items:center; gap:8px;';
				const circle = document.createElement('div');
				circle.style.cssText = 'width:32px;height:32px;border-radius:50%;overflow:hidden;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;';
				const img = document.createElement('img');
				img.id = 'sidebarUserAvatarImg';
				img.alt = 'Profilová fotka';
				img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:none;';
				img.loading = 'lazy';
				img.decoding = 'async';
				const icon = document.createElement('i');
				icon.id = 'sidebarUserAvatarPh';
				icon.className = 'fas fa-user';
				icon.style.cssText = 'color:#9ca3af;font-size:14px;';
				circle.appendChild(img);
				circle.appendChild(icon);
				wrap.appendChild(circle);
				headerButtons.appendChild(wrap);
			}
			return wrap;
		}
		return null;
	} catch (_) {
		return null;
	}
}

function applySidebarAvatar(url) {
	// Uložit poslední URL pro re-aplikaci při hover/leave
	const avatarUrl = url || STOCK_AVATAR_URL;
	window.__sidebarAvatarUrl = avatarUrl;
	const wrap = ensureSidebarAvatarNode();
	const img = document.getElementById('sidebarUserAvatarImg');
	const ph = document.getElementById('sidebarUserAvatarPh');
	const btn = document.querySelector('.sidebar .user-profile-section .btn-profile');
	const btnIcon = btn ? btn.querySelector('i') : null;
	const sidebar = document.querySelector('.sidebar');
	
	// Pokud nejsou elementy, zkusit je vytvořit znovu
	if (!img || !ph) {
		if (wrap) {
			const existingImg = wrap.querySelector('img');
			const existingPh = wrap.querySelector('i');
			if (!existingImg || !existingPh) {
				// Znovu vytvořit elementy
				const circle = wrap.querySelector('span') || wrap.querySelector('div');
				if (circle) {
					if (!existingImg) {
						const newImg = document.createElement('img');
						newImg.id = 'sidebarUserAvatarImg';
						newImg.alt = 'Profilová fotka';
						newImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:none;';
						newImg.loading = 'lazy';
						newImg.decoding = 'async';
						circle.appendChild(newImg);
					}
					if (!existingPh) {
						const newPh = document.createElement('i');
						newPh.id = 'sidebarUserAvatarPh';
						newPh.className = 'fas fa-user';
						newPh.style.cssText = 'color:#9ca3af;font-size:12px;';
						circle.appendChild(newPh);
					}
				}
			}
		}
	}
	
	const finalImg = document.getElementById('sidebarUserAvatarImg');
	const finalPh = document.getElementById('sidebarUserAvatarPh');
	if (!btn || !finalImg || !finalPh) return;
	
	// Vždy zobrazit avatar (buď nahraný nebo stock)
	// Nejdřív nastavit display na block, aby se zobrazil okamžitě
	finalImg.style.display = 'block';
	finalImg.style.borderRadius = '50%';
	finalImg.style.width = '100%';
	finalImg.style.height = '100%';
	finalImg.style.objectFit = 'cover';
	finalPh.style.display = 'none';
	
	// Nastavit src až po nastavení display
	finalImg.src = avatarUrl;
	
	// Zajistit, aby se obrázek načetl
	finalImg.onload = function() {
		finalImg.style.display = 'block';
		finalPh.style.display = 'none';
	};
	finalImg.onerror = function() {
		// Pokud se obrázek nenačte, použít stock avatar
		finalImg.src = STOCK_AVATAR_URL;
		finalImg.style.display = 'block';
		finalPh.style.display = 'none';
	};
	
	// Vždy zobrazit profilovku v kruhu, ne přes celé tlačítko
	if (wrap) {
		const circle = wrap.querySelector('span') || wrap.querySelector('div');
		if (circle) {
			// Zajistit, aby kruh byl skutečně kruhový
			circle.style.width = '32px';
			circle.style.height = '32px';
			circle.style.borderRadius = '50%';
			circle.style.overflow = 'hidden';
			circle.style.display = 'inline-flex';
			circle.style.alignItems = 'center';
			circle.style.justifyContent = 'center';
		}
		wrap.style.display = 'inline-flex';
		wrap.style.visibility = 'visible';
		wrap.style.opacity = '1';
		wrap.style.width = '32px';
		wrap.style.height = '32px';
		wrap.style.flexShrink = '0';
	}
	// Odstranit backgroundImage z tlačítka
	btn.style.backgroundImage = '';
	btn.style.backgroundSize = '';
	btn.style.backgroundPosition = '';
	btn.style.backgroundRepeat = '';
	if (btnIcon) {
		btnIcon.style.display = 'none';
	}
}

function applyHeroAvatar(url) {
	// Avatar vedle nadpisu "Můj profil" apod. – očekává <img id="profileHeroAvatar">
	const img = document.getElementById('profileHeroAvatar');
	if (!img) return;
	const avatarUrl = url || STOCK_AVATAR_URL;
	img.src = avatarUrl;
	img.style.display = 'inline-block';
}

// Logout function
function logout() {
    if (window.firebaseAuth) {
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js').then(({ signOut }) => {
            signOut(window.firebaseAuth).then(() => {
                console.log('User logged out successfully');
                // Redirect to home page
                window.location.href = 'index.html';
            }).catch(error => {
                console.error('Error logging out:', error);
            });
        });
    }
}

// Check auth for profile access
function checkAuthForProfile() {
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                // User is logged in, allow access to profile
                window.location.href = 'profile.html';
            } else {
                // User is not logged in, show auth modal
                showAuthModal('login');
            }
        });
    } else {
        // Firebase not loaded yet, show auth modal
        showAuthModal('login');
    }
}

// Check auth for adding service - new behavior: redirect to create-ad page
function checkAuthForAddService() {
    window.location.href = 'create-ad.html';
}

// Setup callback to open add service modal after login
function setupLoginCallback() {
    // Store the callback in a global variable
    window.afterLoginCallback = () => {
        window.location.href = 'create-ad.html';
    };
}

// Price input toggle function
function togglePriceInputs() {
    const priceType = document.querySelector('input[name="priceType"]:checked');
    const priceInputs = document.getElementById('priceInputs');
    const priceUnitSelection = document.querySelector('.price-unit-selection');
    const servicePrice = document.getElementById('servicePrice');
    const servicePriceFrom = document.getElementById('servicePriceFrom');
    const servicePriceTo = document.getElementById('servicePriceTo');
    
    if (!priceType) {
        priceInputs.style.display = 'none';
        return;
    }
    
    priceInputs.style.display = 'block';
    
    // Hide all inputs first
    servicePrice.style.display = 'none';
    servicePriceFrom.style.display = 'none';
    servicePriceTo.style.display = 'none';
    priceUnitSelection.style.display = 'none';
    
    switch(priceType.value) {
        case 'fixed':
            priceUnitSelection.style.display = 'block';
            servicePrice.style.display = 'block';
            servicePrice.required = true;
            servicePriceFrom.required = false;
            servicePriceTo.required = false;
            updatePricePlaceholders();
            break;
        case 'range':
            priceUnitSelection.style.display = 'block';
            servicePriceFrom.style.display = 'block';
            servicePriceTo.style.display = 'block';
            servicePrice.required = false;
            servicePriceFrom.required = true;
            servicePriceTo.required = true;
            updatePricePlaceholders();
            break;
        case 'negotiable':
            // No inputs needed for "dohodou"
            servicePrice.required = false;
            servicePriceFrom.required = false;
            servicePriceTo.required = false;
            break;
    }
}

// Update price placeholders based on unit selection
function updatePricePlaceholders() {
    const priceUnit = document.querySelector('input[name="priceUnit"]:checked');
    const servicePrice = document.getElementById('servicePrice');
    const servicePriceFrom = document.getElementById('servicePriceFrom');
    const servicePriceTo = document.getElementById('servicePriceTo');
    
    if (!priceUnit) return;
    
    const unit = priceUnit.value === 'hour' ? 'hod' : 'práce';
    
    servicePrice.placeholder = `Cena (např. 500 Kč/${unit})`;
    servicePriceFrom.placeholder = `Od (např. 300 Kč/${unit})`;
    servicePriceTo.placeholder = `Do (např. 800 Kč/${unit})`;
}

// Add event listener for unit selection
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('input[name="priceUnit"]').forEach(radio => {
        radio.addEventListener('change', updatePricePlaceholders);
    });
});

// Export functions for global use
window.checkAuthForAddService = checkAuthForAddService;
window.setupLoginCallback = setupLoginCallback;
window.togglePriceInputs = togglePriceInputs;

// Contact form handling
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const name = formData.get('name');
        const email = formData.get('email');
        const subject = formData.get('subject');
        const message = formData.get('message');
        
        // Simple validation
        if (!name || !email || !subject || !message) {
            alert('Prosím vyplňte všechna pole.');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Prosím zadejte platnou emailovou adresu.');
            return;
        }
        
        // Simulate form submission
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Odesílám...';
        submitBtn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            alert('Děkujeme za vaši zprávu! Ozveme se vám co nejdříve.');
            this.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 2000);
    });
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('loading');
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.service-card').forEach(el => {
    observer.observe(el);
});

// Counter animation for stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat h3');
    
    counters.forEach(counter => {
        const target = parseInt(counter.textContent.replace(/\D/g, ''));
        const increment = target / 100;
        let current = 0;
        
        const updateCounter = () => {
            if (current < target) {
                current += increment;
                counter.textContent = Math.ceil(current) + (counter.textContent.includes('%') ? '%' : '+');
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = counter.textContent;
            }
        };
        
        updateCounter();
    });
}

// Trigger counter animation when stats section is visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.stats');
if (statsSection) {
    statsObserver.observe(statsSection);
}

// Header background change on scroll
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (header) {
        if (window.scrollY > 100) {
            header.style.background = 'rgba(102, 126, 234, 0.95)';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            header.style.backdropFilter = 'none';
        }
    }
});

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
        const rate = scrolled * -0.5;
        heroImage.style.transform = `translateY(${rate}px)`;
    }
});

// Service cards hover effect enhancement
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Loading animation for page
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
    
    // Add fade-in animation to main sections
    const sections = document.querySelectorAll('section');
    sections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            section.style.opacity = '1';
            section.style.transform = 'translateY(0)';
        }, index * 200);
    });
});

// Add click effect to buttons
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});

// Add ripple effect CSS
const style = document.createElement('style');
style.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Console welcome message
console.log(`
🚀 Vítejte na Bulldogo.cz!
📧 Kontakt: support@bulldogo.cz
📱 Telefon: +420 123 456 789
🌐 Web: https://www.bulldogo.cz
`);

// ================= Cookie Consent (GDPR/ePrivacy) =================
// Simple, compliant cookie banner with Accept/Reject, storing granular consent
(function initCookieConsent() {
    const CONSENT_KEY = 'cookie-consent-v1';

    function getStoredConsent() {
        try {
            const raw = localStorage.getItem(CONSENT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function storeConsent(consent) {
        try {
            localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
        } catch (_) {}
        window.cookieConsent = { ...consent };
        document.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: consent }));
    }

    function hideBanner() {
        const banner = document.getElementById('cookieBanner');
        if (banner) banner.remove();
    }

    function renderBanner() {
        if (document.getElementById('cookieBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'cookieBanner';
        banner.innerHTML = `
            <div class="cookie-banner__content">
                <div class="cookie-banner__text">
                    Používáme <a href="soubory/cookies.pdf" target="_blank" rel="noopener noreferrer">cookies</a> pro zajištění funkcí webu a zlepšení služeb. 
                    Před uložením nepovinných cookies potřebujeme váš souhlas. 
                    Více informací najdete v <a href="https://commission.europa.eu/cookies-policy_cs" target="_blank" rel="noopener noreferrer">zásadách EU o cookies</a>.
                </div>
                <div class="cookie-banner__actions">
                    <button id="cookieReject" class="btn btn-outline">Odmítnout nepovinné</button>
                    <button id="cookieAccept" class="btn btn-success">Souhlasím</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        // Wire buttons
        const rejectBtn = document.getElementById('cookieReject');
        const acceptBtn = document.getElementById('cookieAccept');
        rejectBtn?.addEventListener('click', () => {
            storeConsent({ necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
            hideBanner();
        });
        acceptBtn?.addEventListener('click', () => {
            storeConsent({ necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
            hideBanner();
        });
    }

    // Public helpers
    window.getCookieConsent = function() { return getStoredConsent(); };
    window.onCookieConsent = function(callback) {
        document.addEventListener('cookie-consent-updated', (e) => callback(e.detail));
        const current = getStoredConsent();
        if (current) callback(current);
    };
    window.isNonEssentialAllowed = function() {
        const c = getStoredConsent();
        return !!(c && (c.analytics || c.marketing));
    };

    // Initial state and banner rendering
    document.addEventListener('DOMContentLoaded', () => {
        const existing = getStoredConsent();
        window.cookieConsent = existing || { necessary: true, analytics: false, marketing: false };
        if (!existing) renderBanner();
    }, { once: true });

    // Styles
    const cookieStyleEl = document.createElement('style');
    cookieStyleEl.textContent = `
        #cookieBanner {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 20px;
            z-index: 9999;
            display: flex;
            justify-content: center;
            pointer-events: none; /* allow inner card to capture */
        }
        #cookieBanner .cookie-banner__content {
            pointer-events: all;
            width: min(960px, calc(100% - 32px));
            box-sizing: border-box;
            padding: 16px 18px;
            border-radius: 14px;
            color: #fff;
            background: linear-gradient(135deg, rgba(255,156,32,0.96) 0%, rgba(255,106,0,0.96) 100%);
            box-shadow: 0 12px 28px rgba(0,0,0,0.28);
            border: 1px solid rgba(255,255,255,0.18);
            backdrop-filter: blur(10px) saturate(120%);
            display: grid;
            grid-template-columns: 1fr auto;
            grid-gap: 16px;
            align-items: center;
        }
        .cookie-banner__text {
            line-height: 1.55;
            font-size: 14px;
        }
        .cookie-banner__text a { color: #ffffff; text-decoration: underline; font-weight: 600; }
        .cookie-banner__actions { display: inline-flex; gap: 10px; }
        .cookie-banner__actions .btn { white-space: nowrap; }
        .cookie-banner__actions .btn-success { background: #ff8c00; border: none; color: #fff; }
        .cookie-banner__actions .btn-outline { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.85); }

        @media (max-width: 640px) {
            #cookieBanner .cookie-banner__content {
                grid-template-columns: 1fr;
                row-gap: 12px;
                padding: 14px;
            }
            .cookie-banner__actions { 
                justify-content: center; 
                flex-wrap: wrap;
            }
            .cookie-banner__actions .btn {
                font-size: 12px !important;
                padding: 8px 12px !important;
                text-align: center !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .cookie-banner__actions .btn-outline {
                font-size: 11px !important;
                padding: 8px 10px !important;
            }
        }
    `;
    document.head.appendChild(cookieStyleEl);
})();
// ==============================================================

// Error handling for missing elements - tichý režim (nevyhazovat warnings)
document.addEventListener('DOMContentLoaded', () => {
    // Check if all required elements exist (pouze pro debug, nevyhazovat warnings)
    // Tyto elementy nemusí být na všech stránkách, což je normální
    // Odstraněno .about a .contact, protože tyto sekce už neexistují
    const requiredElements = [
        '.header',
        '.hero',
        '.services',
        '.footer'
    ];
    
    // Tichý režim - nevyhazovat warnings, protože tyto elementy nemusí být na všech stránkách
    // requiredElements.forEach(selector => {
    //     if (!document.querySelector(selector)) {
    //         console.warn(`Element ${selector} not found`);
    //     }
    // });
});

// Clockwise (12 směrů) pro hero bubliny
function initHeroBubbles() {
    const bubbles = document.querySelectorAll('.tool-bubbles .tool-bubble');
    if (!bubbles.length) return false;

    // Úhly jako na hodinách (0 = 12h, po směru hodin)
    const hourAngles = Array.from({ length: 12 }, (_, i) => -Math.PI / 2 + (i * Math.PI * 2) / 12);
    const radius = 280; // px, jednotná vzdálenost letu od středu
    const baseDuration = 12.8; // s, základní délka animace

    const setDirectionByIndex = (el, index) => {
        const angle = hourAngles[index % 12];
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        el.style.setProperty('--dx', dx.toFixed(1) + 'px');
        el.style.setProperty('--dy', dy.toFixed(1) + 'px');
    };

    const bubbleArray = Array.from(bubbles);
    // Nastavit směry podle ciferníku
    bubbleArray.forEach((bubble, idx) => setDirectionByIndex(bubble, idx));

    // Zamíchat pořadí startu
    const shuffled = bubbleArray.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Spouštění po dvojicích každou 1s, donekonečna, s okamžitým startem prvních 2
    const pairSize = 2;
    const intervalMs = 1000;
    const groups = Math.ceil(shuffled.length / pairSize); // obvykle 6 pro 12 bublin
    const durationSec = (groups * intervalMs) / 1000; // aby se páry cyklily každou vteřinu v rámci jednoho cyklu

    // Připravit: vše pauznout, sjednotit duration, bez delay
    shuffled.forEach((bubble) => {
        bubble.style.animationDuration = `${durationSec}s`;
        bubble.style.animationDelay = '0s';
        bubble.style.animationPlayState = 'paused';
        const bg = bubble.querySelector('.bubble-bg');
        if (bg) {
            bg.style.animationDuration = `${durationSec}s`;
            bg.style.animationDelay = '0s';
            bg.style.animationPlayState = 'paused';
        }

        const originalIdx = bubbleArray.indexOf(bubble);
        bubble.addEventListener('animationiteration', (e) => {
            if (e.animationName === 'bubbleLaunch') {
                setDirectionByIndex(bubble, originalIdx);
            }
        });
        bubble.addEventListener('webkitAnimationIteration', (e) => {
            if (e.animationName === 'bubbleLaunch') {
                setDirectionByIndex(bubble, originalIdx);
            }
        });
    });

    let order = shuffled.slice();
    let cursor = 0;

    const firePair = () => {
        // Když dojedeme na konec, znovu zamíchat a začít od 0
        if (cursor >= order.length) {
            // Fisher–Yates shuffle
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            cursor = 0;
        }

        const toFire = order.slice(cursor, cursor + pairSize);
        cursor += pairSize;

        toFire.forEach((bubble) => {
            // Restart animace od začátku
            bubble.style.animation = 'none';
            // eslint-disable-next-line no-unused-expressions
            bubble.offsetHeight;
            // Nastavit kompletní shorthand s negativním delay pro okamžitou viditelnost
            const fadeSkipSec = 1.0; // přeskočit ~1s z počátku cyklu (za fade-in)
            bubble.style.animation = `bubbleLaunch ${durationSec}s ease-out -${fadeSkipSec}s infinite`;
            bubble.style.animationPlayState = 'running';

            const bg = bubble.querySelector('.bubble-bg');
            if (bg) {
                bg.style.animation = 'none';
                // eslint-disable-next-line no-unused-expressions
                bg.offsetHeight;
                bg.style.animation = `bubblePop ${durationSec}s ease-out -${fadeSkipSec}s infinite`;
                bg.style.animationPlayState = 'running';
            }
        });
    };

    // Spustit okamžitě první dvojici, pak každou vteřinu další
    firePair();
    setInterval(firePair, intervalMs);
    return true;
}

// Spusť hned po načtení skriptu (skript je za obsahem), fallback na DOMContentLoaded
if (!initHeroBubbles()) {
    document.addEventListener('DOMContentLoaded', initHeroBubbles, { once: true });
}

// Services Categories Carousel (infinite, 3 visible, smooth)
function initServicesCarousel() {
    const wrapper = document.querySelector('.services-carousel .carousel-wrapper');
    if (!wrapper) return;

    const track = wrapper.querySelector('.carousel-track');
    const viewport = wrapper.querySelector('.carousel-viewport');
    const prevBtn = wrapper.querySelector('.carousel-arrow.prev');
    const nextBtn = wrapper.querySelector('.carousel-arrow.next');
    if (!track || !viewport || !prevBtn || !nextBtn) return;

    let slides = Array.from(track.children);
    if (!slides.length) return;

    // Calculate visible count based on CSS breakpoints
    const getVisible = () => {
        const width = viewport.clientWidth;
        if (width <= 640) return 1;
        if (width <= 1024) return 2;
        return 3;
    };

    // Clone head and tail to enable seamless infinite loop
    const ensureClones = () => {
        // Clear existing clones
        track.querySelectorAll('.is-clone').forEach(c => c.remove());

        const visible = getVisible();
        slides = Array.from(track.querySelectorAll(':scope > li.carousel-slide:not(.is-clone)'));
        const count = slides.length;
        const headClones = slides.slice(0, visible).map(node => cloneSlide(node));
        const tailClones = slides.slice(count - visible).map(node => cloneSlide(node));
        // Append head clones to end, tail clones to start
        headClones.forEach(c => track.appendChild(c));
        tailClones.forEach(c => track.insertBefore(c, track.firstChild));
    };

    const cloneSlide = (node) => {
        const c = node.cloneNode(true);
        c.classList.add('is-clone');
        return c;
    };

    // State
    let index = 0; // index within original slides
    let offset = 0; // in pixels
    let slideWidth = 0;
    let isAnimating = false;

    const allSlides = () => Array.from(track.querySelectorAll(':scope > li.carousel-slide'));
    const markSlides = () => {
        const visible = getVisible();
        const startShift = visible;
        const centerOffset = Math.floor(visible / 2);
        const list = allSlides();
        if (!list.length) return;
        list.forEach(s => s.classList.remove('is-prev', 'is-active', 'is-next'));
        const len = list.length;
        const idx = (i) => ((i % len) + len) % len;
        const centerPos = startShift + index + centerOffset;
        list[idx(centerPos - 1)].classList.add('is-prev');
        list[idx(centerPos)].classList.add('is-active');
        list[idx(centerPos + 1)].classList.add('is-next');
    };

    const updateMeasurements = () => {
        // Each slide width is viewport width / visible
        const visible = getVisible();
        slideWidth = viewport.clientWidth / visible;
        track.querySelectorAll('.carousel-slide').forEach(slide => {
            slide.style.flexBasis = `calc(100% / ${visible})`;
        });
        // Rebuild clones because visible may change
        ensureClones();
        // Jump to current logical index position (after clones exist)
        const startShift = getVisible();
        offset = -(index + startShift) * slideWidth;
        setTransform(0);
        markSlides();
    };

    const setTransform = (durationMs = 500) => {
        if (durationMs > 0) wrapper.classList.add('carousel-animating');
        else wrapper.classList.remove('carousel-animating');
        track.style.transform = `translate3d(${offset}px, 0, 0)`;
        if (durationMs === 0) return;
        // Remove class after transition
        window.clearTimeout(setTransform._t);
        setTransform._t = window.setTimeout(() => {
            wrapper.classList.remove('carousel-animating');
        }, durationMs);
    };

    const goTo = (newIndex, direction) => {
        if (isAnimating) return;
        isAnimating = true;
        const visible = getVisible();
        const total = slides.length;
        const startShift = visible; // number of clones at the start

        // Move by +/-1 logical slide (but allow multiple if needed)
        const delta = newIndex - index;
        offset += -delta * slideWidth;
        setTransform(500);

        // After transition, handle seamless wrap
        window.setTimeout(() => {
            index = ((newIndex % total) + total) % total; // normalize
            // If we moved past bounds, jump without animation to mirrored position
            const currentPos = -offset / slideWidth;
            const expectedPos = index + startShift;
            offset = -expectedPos * slideWidth;
            setTransform(0);
            isAnimating = false;
            markSlides();
        }, 520);
    };

    const next = () => goTo(index + 1, 1);
    const prev = () => goTo(index - 1, -1);

    // Controls
    nextBtn.addEventListener('click', next);
    prevBtn.addEventListener('click', prev);

    // Swipe support
    let touchStartX = 0;
    let dragging = false;
    viewport.addEventListener('pointerdown', (e) => {
        dragging = true;
        touchStartX = e.clientX;
        viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e) => {
        if (!dragging || isAnimating) return;
        const dx = e.clientX - touchStartX;
        track.style.transform = `translate3d(${offset + dx}px, 0, 0)`;
    });
    const endDrag = (e) => {
        if (!dragging) return;
        dragging = false;
        const dx = e.clientX - touchStartX;
        const threshold = slideWidth * 0.25;
        if (dx <= -threshold) next();
        else if (dx >= threshold) prev();
        else setTransform(200);
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // Autoplay (optional, can be adjusted)
    let autoplayTimer = null;
    const startAutoplay = () => {
        stopAutoplay();
        autoplayTimer = window.setInterval(next, 3000);
    };
    const stopAutoplay = () => {
        if (autoplayTimer) {
            window.clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    };
    wrapper.addEventListener('mouseenter', stopAutoplay);
    wrapper.addEventListener('mouseleave', startAutoplay);

    // Handle resize
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(updateMeasurements, 150);
    });

    // Initialize
    updateMeasurements();
    // Align to initial position without animation
    setTransform(0);
    startAutoplay();
    markSlides();
}
