// Detekce AdBlocku a zobrazení varování uživateli
(function() {
    'use strict';
    
    // Funkce pro detekci AdBlocku
    function detectAdBlock(callback) {
        let detected = false;
        let checksCompleted = 0;
        const totalChecks = 4;
        
        function checkComplete(result) {
            checksCompleted++;
            if (result) {
                detected = true;
                callback(true);
                return;
            }
            if (checksCompleted >= totalChecks && !detected) {
                callback(false);
            }
        }
        
        // Metoda 1: Zkusit načíst skript s názvem, který adblockery typicky blokují (Opera, uBlock...)
        var scriptDone = false;
        var testScript = document.createElement('script');
        testScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        testScript.onerror = function() {
            if (!scriptDone) { scriptDone = true; checkComplete(true); }
        };
        testScript.onload = function() {
            if (!scriptDone) { scriptDone = true; checkComplete(false); }
        };
        setTimeout(function() {
            if (!scriptDone && !detected) { scriptDone = true; checkComplete(false); }
        }, 2000);
        document.head.appendChild(testScript);
        
        // Metoda 2: Bait element s id="ad" - Brave a další blokují kosmetickými filtry
        setTimeout(function() {
            if (!detected && document.body) {
                var bait = document.createElement('div');
                bait.id = 'ad';
                bait.className = 'advertisement';
                bait.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;visibility:visible;display:block !important;';
                bait.innerHTML = '&nbsp;';
                document.body.appendChild(bait);
                // Počkat na aplikaci kosmetických filtrů (Brave, uBlock...)
                setTimeout(function() {
                    var cs = window.getComputedStyle(bait);
                    var hidden = cs.display === 'none' || cs.visibility === 'hidden' || 
                                 bait.offsetHeight === 0 || bait.offsetWidth === 0;
                    if (bait.parentNode) document.body.removeChild(bait);
                    checkComplete(hidden);
                }, 150);
            }
        }, 300);
        
        // Metoda 3: Fetch na blokovanou URL - Brave a další blokují request (mode: no-cors kvůli CORS)
        setTimeout(function() {
            if (!detected) {
                fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
                    .then(function() { checkComplete(false); })
                    .catch(function() { checkComplete(true); });
            }
        }, 600);
        
        // Metoda 4: Zkontrolovat, zda jsou služby zobrazené (grid prázdný, ale data existují)
        setTimeout(function() {
            if (!detected) {
                var grid = document.getElementById('servicesGrid');
                if (grid && grid.children.length === 0) {
                    if (typeof allServices !== 'undefined' && allServices && allServices.length > 0) {
                        checkComplete(true);
                    } else {
                        checkComplete(false);
                    }
                } else {
                    checkComplete(false);
                }
            }
        }, 3500);
    }
    
    // Zobrazit varování o AdBlocku
    function showAdBlockWarning() {
        // Zkontrolovat, zda už není zobrazeno varování
        if (document.getElementById('adblock-warning')) {
            return;
        }
        
        const warning = document.createElement('div');
        warning.id = 'adblock-warning';
        warning.setAttribute('role', 'dialog');
        warning.setAttribute('aria-modal', 'true');
        warning.setAttribute('aria-labelledby', 'adblock-warning-title');
        warning.style.cssText = `
            position: fixed !important;
            inset: 0 !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            min-width: 100vw !important;
            min-height: 100vh !important;
            background: rgba(0, 0, 0, 0.85) !important;
            z-index: 2147483647 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 20px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
            box-sizing: border-box !important;
        `;
        
        warning.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                padding: 40px;
                max-width: 600px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
                <h2 id="adblock-warning-title" style="
                    color: #f77c00;
                    margin: 0 0 16px 0;
                    font-size: 28px;
                    font-weight: 700;
                ">AdBlocker detekován</h2>
                <p style="
                    color: #374151;
                    font-size: 16px;
                    line-height: 1.6;
                    margin: 0 0 24px 0;
                ">
                    Váš prohlížeč blokuje zobrazení inzerátů. Na této stránce však <strong>nejsou reklamy</strong> - 
                    zobrazujeme pouze <strong>nabídky služeb od uživatelů</strong>.
                </p>
                <p style="
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0 0 32px 0;
                ">
                    Pro zobrazení všech služeb prosím <strong>vypněte AdBlocker</strong> pro tuto stránku 
                    nebo přidejte <strong>bulldogo.cz</strong> do seznamu výjimek.
                </p>
                <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <button id="adblock-reload" style="
                        background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%);
                        color: white;
                        border: none;
                        padding: 14px 32px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.2s;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        Obnovit stránku
                    </button>
                    <button id="adblock-close" style="
                        background: #e5e7eb;
                        color: #374151;
                        border: none;
                        padding: 14px 32px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#d1d5db'" onmouseout="this.style.background='#e5e7eb'">
                        Pokračovat bez služeb
                    </button>
                </div>
                <p style="
                    color: #9ca3af;
                    font-size: 12px;
                    margin: 24px 0 0 0;
                    line-height: 1.5;
                ">
                    Po vypnutí AdBlockeru obnovte stránku (F5) pro zobrazení všech služeb.
                </p>
            </div>
        `;
        
        document.documentElement.appendChild(warning);
        
        // Tlačítko pro obnovení stránky
        document.getElementById('adblock-reload').addEventListener('click', function() {
            window.location.reload();
        });
        
        // Tlačítko pro zavření (skryje varování, ale služby se stále nezobrazí)
        document.getElementById('adblock-close').addEventListener('click', function() {
            warning.style.display = 'none';
            // Zobrazit zprávu v gridu místo služeb
            const grid = document.getElementById('servicesGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="no-services" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                        <div class="no-services-icon" style="font-size: 64px; margin-bottom: 20px;">🚫</div>
                        <h3 style="color: #f77c00; margin-bottom: 16px;">AdBlocker blokuje zobrazení služeb</h3>
                        <p style="color: #6b7280; margin-bottom: 24px;">
                            Pro zobrazení služeb prosím vypněte AdBlocker a obnovte stránku.
                        </p>
                        <button onclick="window.location.reload()" style="
                            background: linear-gradient(135deg, #f77c00 0%, #fdf002 100%);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                        ">
                            Obnovit stránku
                        </button>
                    </div>
                `;
            }
        });
    }
    
    // Spustit detekci po načtení DOM a Firebase
    function startDetection() {
        // Počkat na Firebase inicializaci
        if (window.firebaseReady) {
            setTimeout(function() {
                detectAdBlock(function(isBlocked) {
                    if (isBlocked) {
                        console.warn('⚠️ AdBlocker detekován - služby mohou být skryté');
                        showAdBlockWarning();
                    } else {
                        console.log('✅ AdBlocker není aktivní');
                    }
                });
            }, 2000); // Počkat 2 sekundy, aby se služby stihly načíst
        } else {
            // Počkat na firebaseReady event
            window.addEventListener('firebaseReady', function() {
                setTimeout(function() {
                    detectAdBlock(function(isBlocked) {
                        if (isBlocked) {
                            console.warn('⚠️ AdBlocker detekován - služby mohou být skryté');
                            showAdBlockWarning();
                        } else {
                            console.log('✅ AdBlocker není aktivní');
                        }
                    });
                }, 2000);
            }, { once: true });
            
            // Fallback timeout
            setTimeout(function() {
                if (!document.getElementById('adblock-warning')) {
                    detectAdBlock(function(isBlocked) {
                        if (isBlocked) {
                            console.warn('⚠️ AdBlocker detekován - služby mohou být skryté');
                            showAdBlockWarning();
                        }
                    });
                }
            }, 5000);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDetection);
    } else {
        startDetection();
    }
    
    // Exportovat funkci pro ruční kontrolu
    window.checkAdBlock = function() {
        detectAdBlock(function(isBlocked) {
            if (isBlocked) {
                showAdBlockWarning();
            } else {
                console.log('✅ AdBlocker není aktivní');
            }
        });
    };
    
    console.log('✅ AdBlock detektor načten');
})();
