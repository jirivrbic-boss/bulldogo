// Detekce AdBlocku a zobrazení varování uživateli
(function() {
    'use strict';
    
    // Funkce pro detekci AdBlocku
    function detectAdBlock(callback) {
        let detected = false;
        let checksCompleted = 0;
        const totalChecks = 3;
        
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
        
        // Metoda 1: Zkusit načíst skript s názvem, který adblockery typicky blokují
        const testScript = document.createElement('script');
        testScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        testScript.onerror = function() {
            checkComplete(true);
        };
        testScript.onload = function() {
            checkComplete(false);
        };
        
        // Timeout pro skript
        setTimeout(function() {
            if (!detected) {
                checkComplete(false);
            }
        }, 2000);
        
        document.head.appendChild(testScript);
        
        // Metoda 2: Zkontrolovat, zda se blokují elementy s třídou "ad"
        setTimeout(function() {
            if (!detected) {
                const testDiv = document.createElement('div');
                testDiv.className = 'adsbox';
                testDiv.style.position = 'absolute';
                testDiv.style.left = '-9999px';
                testDiv.style.top = '-9999px';
                testDiv.innerHTML = '&nbsp;';
                document.body.appendChild(testDiv);
                
                setTimeout(function() {
                    const computedStyle = window.getComputedStyle(testDiv);
                    const isBlocked = testDiv.offsetHeight === 0 || 
                                     testDiv.offsetWidth === 0 ||
                                     testDiv.style.display === 'none' ||
                                     computedStyle.display === 'none' ||
                                     computedStyle.visibility === 'hidden' ||
                                     computedStyle.opacity === '0';
                    
                    document.body.removeChild(testDiv);
                    checkComplete(isBlocked);
                }, 100);
            }
        }, 500);
        
        // Metoda 3: Zkontrolovat, zda jsou služby skutečně zobrazené (pokud už jsou načtené)
        setTimeout(function() {
            if (!detected) {
                const grid = document.getElementById('servicesGrid');
                if (grid && grid.children.length === 0) {
                    // Grid existuje, ale nemá děti - možná jsou blokované
                    // Zkontrolovat, zda jsou služby v allServices, ale nezobrazují se
                    if (typeof allServices !== 'undefined' && allServices && allServices.length > 0) {
                        // Máme služby v paměti, ale nezobrazují se - pravděpodobně AdBlocker
                        checkComplete(true);
                    } else {
                        checkComplete(false);
                    }
                } else {
                    checkComplete(false);
                }
            }
        }, 3000); // Počkat 3 sekundy, aby se služby stihly načíst
    }
    
    // Zobrazit varování o AdBlocku
    function showAdBlockWarning() {
        // Zkontrolovat, zda už není zobrazeno varování
        if (document.getElementById('adblock-warning')) {
            return;
        }
        
        const warning = document.createElement('div');
        warning.id = 'adblock-warning';
        warning.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
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
                <h2 style="
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
        
        document.body.appendChild(warning);
        
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
