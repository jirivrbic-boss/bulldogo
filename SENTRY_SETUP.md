# 🛡️ Sentry.io - Nastavení Error Trackingu

## ✅ Co bylo provedeno

Sentry.io error tracking byl úspěšně implementován na všech HTML stránkách projektu Bulldogo.cz.

### 📄 Stránky s aktivním Sentry:
- ✅ **Hlavní stránky**: index.html, services.html, my-ads.html
- ✅ **Inzeráty**: create-ad.html, edit-ad.html, ad-detail.html
- ✅ **Profil**: profile.html, profile-settings.html, profile-detail.html, profile-plan.html, profile-top.html, profile-ratings.html, profile-services.html
- ✅ **Administrace**: dashboard.html, uzivatele.html, statistiky.html, admin-reviews.html, inzeraty.html, nahlaseni.html
- ✅ **Další**: chat.html, packages.html, top-ads.html, reset-password.html, success.html, failed.html, terms.html, 404.html

**Celkem: 27 stránek**

---

## 🧪 Jak otestovat, že Sentry funguje

### Test 1: Záměrná chyba (doporučeno)
1. Otevřete Developer Console (F12) v prohlížeči
2. Na jakékoliv stránce napište do konzole:
```javascript
myUndefinedFunction();
```
3. Stiskněte Enter
4. Za 1-2 minuty se chyba objeví v Sentry dashboardu

### Test 2: Test v produkci
1. Nasaďte změny na server
2. Otevřete libovolnou stránku (např. https://bulldogo.cz)
3. Vyvolejte chybu (např. klikněte na něco, co nefunguje)
4. Zkontrolujte Sentry dashboard

---

## 📊 Co Sentry sleduje

### Automaticky zachycuje:
- ✅ **JavaScript chyby** (TypeError, ReferenceError, atd.)
- ✅ **Nezachycené Promise rejection**
- ✅ **Chyby v async funkcích**
- ✅ **Firebase chyby** (connection issues, auth errors)
- ✅ **Network errors** (failed API calls)

### Performance Monitoring:
- ✅ **Page load times** (jak rychle se stránky načítají)
- ✅ **User interactions** (klikání, scrollování)
- ✅ **Transaction tracking**

### Session Replay:
- ✅ **10% běžných sessions** (replaysSessionSampleRate: 0.1)
- ✅ **100% sessions s chybou** (replaysOnErrorSampleRate: 1)

---

## 🔧 Přístup k Sentry Dashboard

1. Přihlaste se na: **https://sentry.io**
2. Vyberte projekt: **bulldogo-frontend** (nebo jak jste ho pojmenovali)
3. V menu najdete:
   - **Issues** - seznam všech chyb
   - **Performance** - rychlost stránek
   - **Replays** - záznam uživatelských sessions
   - **Releases** - pokud budete tagovat verze

---

## 🎯 Doporučené nastavení

### Filtrace citlivých dat
Pokud chcete filtrovat citlivá data (hesla, tokeny), můžete přidat custom konfiguraci.

Vytvořte soubor `/js/sentry-config.js`:

```javascript
// Volitelná custom konfigurace Sentry
if (window.Sentry) {
  Sentry.setBeforeSend((event, hint) => {
    // Odstranit citlivá data
    if (event.request?.headers) {
      delete event.request.headers.Authorization;
      delete event.request.headers.Cookie;
    }
    
    // Filtrovat URL s tokeny
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/token=[^&]+/, 'token=***');
    }
    
    return event;
  });
  
  // Nastavit uživatelský kontext (volitelné)
  if (window.currentUser) {
    Sentry.setUser({
      id: window.currentUser.uid,
      email: window.currentUser.email
    });
  }
}
```

Pak přidejte do HTML (za Sentry script):
```html
<script src="/js/sentry-config.js"></script>
```

### Environment tagy
Pro rozlišení development/production můžete nastavit:
```javascript
Sentry.setTag("environment", "production");
```

---

## 📈 Sledování vlastních událostí

### Zachycení vlastní chyby:
```javascript
try {
  // nějaký kód
} catch (error) {
  Sentry.captureException(error);
}
```

### Zaznamenání zprávy:
```javascript
Sentry.captureMessage('Uživatel nemohl uložit inzerát', 'warning');
```

### Breadcrumbs (kontext):
```javascript
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'Uživatel se pokusil přihlásit',
  level: 'info'
});
```

---

## 🚀 Nasazení

### 1. Commitněte změny
```bash
git add .
git commit -m "Přidán Sentry.io error tracking"
git push
```

### 2. Deploy
Podle vašeho workflow (Firebase Hosting, Vercel, nebo jiný hosting)

### 3. Ověření
- Otevřete produkční web
- Zkontrolujte Developer Console - měl by se načíst Sentry script
- Vyvolejte testovací chybu
- Zkontrolujte Sentry dashboard (Issues tab)

---

## 💰 Náklady

### Free Tier (zdarma):
- ✅ **5,000 chyb/měsíc**
- ✅ **10,000 performance events**
- ✅ **50 session replays**
- ✅ 1 projekt
- ✅ 7 dní historie

Pro běžný provoz webu by to mělo stačit. Pokud překročíte limit, Sentry jen přestane sbírat další data (nepřeruší web).

### Upgrade (pokud potřebujete více):
- **Team plan**: $26/měsíc - 50,000 chyb
- **Business plan**: $80/měsíc - 100,000 chyb

---

## 🔒 Bezpečnost

### Co Sentry NIKDY neposílá:
- ❌ Hesla (pokud je správně nastavený)
- ❌ Tokeny (filtrované)
- ❌ Citlivé osobní údaje

### Co posílá:
- ✅ Stack traces (kde chyba vznikla)
- ✅ Browser info (Chrome, Firefox, Safari, atd.)
- ✅ URL stránky
- ✅ User actions (kliknutí, scrollování)

### GDPR compliance:
- Sentry je GDPR compliant
- Data jsou v EU (js-de.sentry-cdn.com = Německo)
- Můžete přidat do Privacy Policy/GDPR dokumentu

---

## 🐛 Typické chyby, které Sentry odchytí

1. **Firebase connection issues**
   ```
   FirebaseError: Missing or insufficient permissions
   ```

2. **Null reference errors**
   ```
   TypeError: Cannot read property 'uid' of null
   ```

3. **Network failures**
   ```
   Failed to fetch
   ```

4. **Auth errors**
   ```
   auth/user-not-found
   ```

---

## 📞 Support

- **Sentry dokumentace**: https://docs.sentry.io
- **Status page**: https://status.sentry.io
- **Community Discord**: https://discord.gg/sentry

---

## ✨ Shrnutí

✅ Sentry nainstalován na všech 27 HTML stránkách  
✅ Automatický error tracking aktivní  
✅ Performance monitoring zapnutý  
✅ Session replay nastaven (10% + 100% při chybě)  
✅ Free tier (5,000 chyb/měsíc)  
✅ GDPR compliant (EU servery)  

**Stav: PŘIPRAVENO K NASAZENÍ** 🚀

---

**Vytvořeno:** 2026-02-09  
**Script URL:** https://js-de.sentry-cdn.com/71a7ef47a161ed9be852276795dcbc22.min.js
