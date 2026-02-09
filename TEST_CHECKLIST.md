# ✅ TEST CHECKLIST - Stripe Extension Migrace

## 🎯 Rychlý test - 5 minut

### 1. Přihlášení a Badge
- [ ] Otevřít `index.html`
- [ ] Přihlásit se
- [ ] Badge v navigaci se zobrazuje ✅
- [ ] Badge ukazuje správný stav (Premium / Upgrade)

### 2. Vytvoření inzerátu
- [ ] Otevřít `create-ad.html`
- [ ] S předplatným → formulář viditelný ✅
- [ ] Bez předplatného → přesměrování na packages.html

### 3. Mé inzeráty
- [ ] Otevřít `my-ads.html`
- [ ] Inzeráty se zobrazují správně
- [ ] Topování funguje (pokud je předplatné)
- [ ] Aktivace/deaktivace funguje

---

## 🔍 Detailní test - 15 minut

### Test A: Console logs
Otevřít Developer Tools (F12) a sledovat console:

✅ **Měli byste vidět:**
```
✅ Subscription management funkce načteny
✅ Helper funkce pro kompatibilitu načteny
📡 Subscription Manager: Spouštím real-time listener
📊 Subscription snapshot: X dokumentů
```

❌ **NEMĚLI byste vidět:**
```
❌ Chyba při načítání předplatného
❌ firebaseDb není dostupný
❌ Profil neexistuje
```

---

### Test B: Funkce v console

```javascript
// 1. Zkontrolovat uživatele
firebaseAuth.currentUser.email

// 2. Zkontrolovat předplatné
await window.checkUserSubscription(firebaseAuth.currentUser.uid)
// Výsledek: true nebo false

// 3. Detail předplatného
await window.getSubscriptionDetails(firebaseAuth.currentUser.uid)
// Výsledek: { status, current_period_end, ... } nebo null

// 4. Zpětná kompatibilita
await window.checkActiveSubscription(firebaseAuth.currentUser.uid)
// Výsledek: { hasSubscription: true/false, plan, expired }
```

---

### Test C: Real-time aktualizace

**Postup:**
1. Otevřít web v prohlížeči (tab 1)
2. Otevřít Stripe Dashboard v druhém tabu (tab 2)
3. Změnit předplatné ve Stripe (zrušit / vytvořit)
4. Sledovat tab 1 - **badge by se měl aktualizovat do 2 sekund!**

✅ **Očekávaný výsledek:** Badge se změní automaticky bez refresh

---

### Test D: Jednotlivé stránky

#### 1. create-ad.html
```
✅ S předplatným: Formulář viditelný
✅ Bez předplatného: Přesměruje na packages.html
✅ Console log: "✅ Předplatné aktivní"
```

#### 2. my-ads.html
```
✅ Načtení inzerátů
✅ Topování funguje (s předplatným)
✅ Varování při deaktivaci topovaného inzerátu
✅ Aktivace vyžaduje předplatné
```

#### 3. top-ads.html
```
✅ Tlačítko "Topovat" viditelné
✅ S předplatným: Modal se otevře
✅ Bez předplatného: Přesměruje na packages
✅ 30denní topování vyžaduje auto-renewal
```

#### 4. services.html
```
✅ Zobrazují se pouze služby premium uživatelů
✅ Filtrování funguje správně
✅ Žádné chyby v console
```

#### 5. profile-settings.html
```
✅ Varování při smazání s aktivním předplatným
✅ Kontrola topování funguje
✅ Modal se zobrazuje správně
```

#### 6. statistiky.html (admin)
```
✅ Uživatelé se načtou
✅ Sloupec "plan" zobrazuje premium/null
✅ Žádné chyby v console
```

---

## 🐛 Známé problémy a řešení

### Problém 1: Badge se nezobrazuje
**Řešení:**
```javascript
// Zkontrolovat Firebase:
console.log(window.firebaseAuth, window.firebaseDb)

// Reinicializovat:
window.subscriptionManager?.reinitialize()
```

### Problém 2: "checkUserSubscription is not a function"
**Řešení:**
```javascript
// Počkat na načtení auth.js:
setTimeout(() => {
    window.checkUserSubscription(uid)
}, 2000)
```

### Problém 3: Špatný stav předplatného
**Řešení:**
```javascript
// Vymazat cache:
window.subscriptionManager.clearCache()
location.reload()
```

---

## 📊 Performance checklist

- [ ] Badge se načte do 2 sekund
- [ ] Real-time update do 2 sekund
- [ ] Žádné chyby v console
- [ ] Žádné nekonečné loading stavy
- [ ] Cache funguje (druhé načtení je rychlejší)

---

## ✅ Finální kontrola

Po dokončení testů zkontrolovat:

1. **Všechny funkce fungují** ✅
2. **Real-time updates fungují** ✅
3. **Žádné chyby v console** ✅
4. **Badge se zobrazuje správně** ✅
5. **Zpětná kompatibilita funguje** ✅

---

## 🎉 Hotovo!

Pokud všechny testy prošly, migrace je **úspěšná**! 

### Co dál?
1. ✅ Monitorovat production
2. ✅ Sledovat Stripe webhooks
3. ✅ Kontrolovat Firebase Usage
4. ✅ Později odstranit stará pole z profilu

---

**Test dokončen:** _____  
**Tester:** _____  
**Výsledek:** PASS ✅ / FAIL ❌  
**Poznámky:** _____
