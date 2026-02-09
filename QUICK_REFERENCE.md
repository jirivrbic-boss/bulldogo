# 🚀 Subscription System - Quick Reference

## ⚡ TL;DR

```html
<!-- 1. V HTML -->
<script type="module" src="/firebase-init.js"></script>
<script type="module" src="auth.js"></script>

<!-- 2. Ochrana stránky -->
<script type="module">
  window.addEventListener('load', async () => {
    await requireSubscription();
  });
</script>
```

---

## 📋 3 Hlavní funkce

### 1️⃣ Real-time listener
```javascript
const unsubscribe = await subscribeToUserSubscription(userId, (data) => {
  console.log('Má předplatné?', data.isSubscribed);
  console.log('Platné do:', data.subscriptionEnd);
  console.log('Zruší se?', data.isCanceled);
});

// Odpojit:
unsubscribe();
```

### 2️⃣ Jednorázová kontrola
```javascript
const hasSub = await checkUserSubscription(userId);
console.log(hasSub); // true/false
```

### 3️⃣ Ochrana stránky
```javascript
await requireSubscription({
  redirectUrl: '/packages.html',
  showAlert: true
});
```

---

## 🎯 Nejčastější použití

### ✅ Chránit celou stránku
```javascript
window.addEventListener('load', async () => {
  await requireSubscription();
});
```

### ✅ Podmíněné tlačítko
```javascript
subscribeToUserSubscription(userId, ({ isSubscribed }) => {
  document.getElementById('premium-btn').disabled = !isSubscribed;
});
```

### ✅ Zobrazit badge
```javascript
subscribeToUserSubscription(userId, ({ isSubscribed }) => {
  const badge = document.getElementById('badge');
  badge.textContent = isSubscribed ? '✓ Premium' : 'Upgrade';
  badge.className = isSubscribed ? 'active' : 'inactive';
});
```

---

## 🔧 Debug v 3 krocích

### Krok 1: Načti debug script
```javascript
const s = document.createElement('script');
s.src = '/debug-subscription.js';
document.head.appendChild(s);
```

### Krok 2: Spusť diagnostiku
```javascript
debugSubscription()
```

### Krok 3: Oprav podle výstupu
- ❌ Firebase nenačten → Zkontroluj pořadí scriptů
- ❌ Funkce nenalezeny → Počkej na auth.js
- ❌ Listener nereaguje → Security Rules

---

## ⚠️ Nejčastější chyby

### Chyba 1: Firebase není načten
```html
<!-- ❌ ŠPATNĚ -->
<script src="auth.js"></script>

<!-- ✅ SPRÁVNĚ -->
<script type="module" src="/firebase-init.js"></script>
<script type="module" src="auth.js"></script>
```

### Chyba 2: Funkce není nalezena
```javascript
// ❌ ŠPATNĚ - voláme hned
subscribeToUserSubscription(userId, ...);

// ✅ SPRÁVNĚ - počkáme
window.addEventListener('load', async () => {
  await subscribeToUserSubscription(userId, ...);
});
```

### Chyba 3: Listener se neodpojí
```javascript
// ❌ ŠPATNĚ
subscribeToUserSubscription(userId, ...);

// ✅ SPRÁVNĚ
const unsub = subscribeToUserSubscription(userId, ...);
window.addEventListener('beforeunload', () => unsub());
```

---

## 📊 Data struktura

```javascript
{
  isSubscribed: true,           // ✓ Má předplatné
  isLoading: false,             // Načítá se
  subscriptionEnd: Date,        // Kdy vyprší
  isCanceled: false,            // Obnoví se?
  subscriptionId: "sub_...",    // Stripe ID
  status: "active"              // active/trialing/expired
}
```

---

## 🧪 Test checklist

- [ ] Otevřít `test-subscription.html`
- [ ] Přihlásit se
- [ ] Console ukazuje: "✅ Firebase načten"
- [ ] Console ukazuje: "✅ Subscription management funkce načteny"
- [ ] UI zobrazuje stav předplatného
- [ ] Změna ve Stripe se projeví okamžitě

---

## 📞 Pomoc

**Console:**
- ✅ "Firebase načten" → OK
- ✅ "Subscription management funkce načteny" → OK
- 📊 "Subscription snapshot: X dokumentů" → Listener funguje
- ❌ "Chyba při..." → Zkontroluj debug

**Dokumentace:**
- `SUBSCRIPTION_GUIDE.md` - Kompletní návod
- `SUBSCRIPTION_SUMMARY.md` - Detailní přehled
- `test-subscription.html` - Live test

**Debug:**
```javascript
debugSubscription()  // Kompletní check
quickSubTest()       // Rychlá kontrola
```

---

## 🎓 Co dál?

1. ✅ Otestovat na `test-subscription.html`
2. ✅ Přidat ochranu na premium stránky
3. ✅ Přidat subscription badge do navigace
4. ✅ Nastavit Firebase Security Rules
5. ✅ Implementovat backend validaci

---

**Vytvořeno pro Stripe Extension "Run Payments with Stripe"**  
**Firebase v9 Modular SDK**
