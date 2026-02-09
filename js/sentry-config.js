/**
 * Sentry.io - Volitelná konfigurace
 * 
 * Tento soubor obsahuje pokročilé nastavení pro Sentry error tracking.
 * Můžete ho aktivovat přidáním do HTML (za Sentry script):
 * <script src="/js/sentry-config.js"></script>
 */

(function() {
  'use strict';

  // Počkáme, až se Sentry načte
  if (!window.Sentry) {
    console.warn('⚠️ Sentry není načten. Sentry-config.js se nemůže spustit.');
    return;
  }

  console.log('🛡️ Načítám Sentry konfiguraci...');

  // ============================================
  // 1. FILTRACE CITLIVÝCH DAT
  // ============================================
  Sentry.onLoad(function() {
    Sentry.init({
      beforeSend(event, hint) {
        // Odstranit citlivá data z HTTP hlaviček
        if (event.request?.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers['X-Firebase-Token'];
        }

        // Filtrovat URL parametry (tokeny, hesla)
        if (event.request?.url) {
          event.request.url = event.request.url
            .replace(/token=[^&]+/gi, 'token=***')
            .replace(/password=[^&]+/gi, 'password=***')
            .replace(/apiKey=[^&]+/gi, 'apiKey=***')
            .replace(/access_token=[^&]+/gi, 'access_token=***');
        }

        // Filtrovat query string
        if (event.request?.query_string) {
          event.request.query_string = event.request.query_string
            .replace(/token=[^&]+/gi, 'token=***')
            .replace(/password=[^&]+/gi, 'password=***');
        }

        // Odstranit lokální storage data (může obsahovat tokeny)
        if (event.contexts?.browser) {
          delete event.contexts.browser.localStorage;
          delete event.contexts.browser.sessionStorage;
        }

        return event;
      },

      // ============================================
      // 2. IGNOROVÁNÍ BĚŽNÝCH/NERELEVANTNÍCH CHYB
      // ============================================
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',
        
        // Random plugins
        'NonError: Object captured as promise rejection',
        'Non-Error promise rejection captured',
        
        // Network errors (timeout apod.)
        'NetworkError',
        'Network request failed',
        
        // Facebook related
        'fb_xd_fragment',
        
        // Generic error messages
        'Script error.',
        'Uncaught',
        
        // ResizeObserver (běžné, neškodit)
        'ResizeObserver loop',
        'ResizeObserver loop completed'
      ],

      // ============================================
      // 3. DENYURLS - Ignorovat chyby z těchto domén
      // ============================================
      denyUrls: [
        // Facebook
        /graph\.facebook\.com/i,
        /connect\.facebook\.net/i,
        
        // Google Analytics
        /www\.google-analytics\.com/i,
        /googletagmanager\.com/i,
        
        // Browser extensions
        /extensions\//i,
        /^chrome:\/\//i,
        /^moz-extension:\/\//i,
        
        // Ads
        /doubleclick\.net/i,
        /googlesyndication\.com/i
      ],

      // ============================================
      // 4. SAMPLING (omezení množství dat)
      // ============================================
      
      // Traces sampling (performance monitoring)
      // 1.0 = 100% (všechny), 0.3 = 30% (doporučeno pro produkci)
      tracesSampleRate: 0.3,
      
      // Session Replay sampling
      replaysSessionSampleRate: 0.1,  // 10% běžných sessions
      replaysOnErrorSampleRate: 1.0,  // 100% sessions s chybou
    });
  });

  // ============================================
  // 5. NASTAVENÍ UŽIVATELSKÉHO KONTEXTU
  // ============================================
  
  // Počkat na Firebase auth
  if (window.firebaseAuth) {
    window.firebaseAuth.onAuthStateChanged(function(user) {
      if (user) {
        // Nastavit uživatele v Sentry (pro lepší tracking)
        Sentry.setUser({
          id: user.uid,
          email: user.email || 'unknown',
          // Nepřidávat citlivá data jako phone, address, atd.
        });
        
        console.log('🛡️ Sentry: Uživatel nastaven');
      } else {
        // Odhlášený uživatel
        Sentry.setUser(null);
      }
    });
  }

  // ============================================
  // 6. ENVIRONMENT TAG
  // ============================================
  
  // Detekovat environment (development vs production)
  var environment = 'production';
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('127.0.0.1') ||
      window.location.port === '5000' || // Firebase local
      window.location.port === '8080') {
    environment = 'development';
  }
  
  Sentry.setTag('environment', environment);
  Sentry.setTag('site', 'bulldogo.cz');

  // ============================================
  // 7. BREADCRUMBS - Sledování uživatelských akcí
  // ============================================
  
  // Automaticky přidávat breadcrumbs pro Firebase Auth události
  if (window.firebaseAuth) {
    // Auth success
    window.addEventListener('firebaseAuthSuccess', function(e) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Uživatel přihlášen',
        level: 'info'
      });
    });
    
    // Auth failed
    window.addEventListener('firebaseAuthFailed', function(e) {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Přihlášení selhalo: ' + (e.detail?.error || 'unknown'),
        level: 'warning'
      });
    });
  }

  // ============================================
  // 8. CUSTOM ERROR HANDLER PRO FIREBASE
  // ============================================
  
  // Globální handler pro Firebase chyby
  window.handleFirebaseError = function(error, context) {
    console.error('Firebase Error:', error);
    
    Sentry.withScope(function(scope) {
      scope.setContext('firebase', {
        code: error.code,
        message: error.message,
        context: context
      });
      Sentry.captureException(error);
    });
  };

  // ============================================
  // 9. PERFORMANCE MONITORING
  // ============================================
  
  // Sledovat důležité Firebase operace
  if (window.performance && window.performance.mark) {
    // Např. při načítání inzerátů
    window.measureServiceLoad = function(serviceName, startMark, endMark) {
      performance.mark(endMark);
      performance.measure(serviceName, startMark, endMark);
      
      var measure = performance.getEntriesByName(serviceName)[0];
      if (measure) {
        Sentry.captureMessage('Performance: ' + serviceName, {
          level: 'info',
          extra: {
            duration: measure.duration,
            name: serviceName
          }
        });
      }
    };
  }

  // ============================================
  // 10. RATE LIMITING (prevence spamu)
  // ============================================
  
  // Omezit počet stejných chyb (např. při smyčce)
  var errorCache = {};
  var ERROR_THRESHOLD = 5; // Max 5 stejných chyb za minutu
  
  window.addEventListener('error', function(e) {
    var errorKey = e.message + ':' + e.filename + ':' + e.lineno;
    var now = Date.now();
    
    if (!errorCache[errorKey]) {
      errorCache[errorKey] = { count: 1, firstSeen: now };
    } else {
      errorCache[errorKey].count++;
      
      // Pokud je chyba spamovaná, ignorovat
      if (errorCache[errorKey].count > ERROR_THRESHOLD && 
          (now - errorCache[errorKey].firstSeen) < 60000) {
        e.preventDefault();
        console.warn('🛡️ Sentry: Příliš mnoho stejných chyb - ignoruji');
      }
    }
    
    // Vyčistit cache každou minutu
    if (now % 60000 < 1000) {
      errorCache = {};
    }
  }, true);

  console.log('✅ Sentry konfigurace načtena');
  console.log('🌍 Environment:', environment);

})();
