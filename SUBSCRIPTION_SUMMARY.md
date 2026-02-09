# 📦 Subscription System - Souhrn implementace

## ✅ Co bylo vytvořeno

### 1. **React Hook** (pro React aplikace)
- **Soubor:** `hooks/useSubscription.js` (JavaScript verze)
- **Soubor:** `hooks/useSubscription.ts` (TypeScript verze)
- Real-time listener s pomocí Firebase onSnapshot
- Automatická kontrola expirace předplatného

### 2. **Vanilla JavaScript funkce** (pro HTML stránky)
- **Soubor:** `auth.js` (přidáno na konec souboru)
- **3 hlavní funkce:**
  1. `subscribeToUserSubscription()` - Real-time listener
  2. `checkUserSubscription()` - Jednorázová kontrola
  3. `requireSubscription()` - Ochrana stránky

### 3. **Dokumentace a příklady**
- **SUBSCRIPTION_GUIDE.md** - Kompletní návod s 6 praktickými příklady
- **SUBSCRIPTION_USAGE_EXAMPLES.js** - Ukázky použití v různých scénářích
- **test-subscription.html** - Testovací rozhraní s live preview

---

## 🚀 Jak začít

### Varianta A: React aplikace

```jsx
import { useSubscription } from './hooks/useSubscription';

function MyComponent() {
  const { user } = useAuth();
  const { isSubscribed, isLoading, subscriptionEnd } = useSubscription(user?.uid);

  if (isLoading) return <div>Načítání...</div>;
  if (!isSubscribed) return <Navigate to="/packages" />;

  return <div>Premium obsah</div>;
}
```

### Varianta B: Vanilla HTML/JavaScript

#### 1. Ochrana celé stránky
```html
<script type="module">
  window.addEventListener('load', async () => {
    await requireSubscription();
  });
</script>
```

#### 2. Real-time badge v navigaci
```html
<div id="subscription-badge"></div>

<script type="module">
  import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

  onAuthStateChanged(firebaseAuth, (user) => {
    if (!user) return;

    subscribeToUserSubscription(user.uid, (subData) => {
      const badge = document.getElementById('subscription-badge');
      
      if (subData.isSubscribed) {
        badge.innerHTML = '<span class="active">✓ Premium</span>';
      } else {
        badge.innerHTML = '<span class="inactive">Upgrade</span>';
      }
    });
  });
</script>
```

#### 3. Podmíněné zobrazení tlačítek
```javascript
subscribeToUserSubscription(user.uid, (subData) => {
  const premiumBtn = document.getElementById('premium-feature-btn');
  
  if (subData.isSubscribed) {
    premiumBtn.disabled = false;
    premiumBtn.onclick = () => openPremiumFeature();
  } else {
    premiumBtn.disabled = true;
    premiumBtn.onclick = () => {
      alert('Vyžaduje premium předplatné');
      window.location.href = '/packages.html';
    };
  }
});
```

---

## 🧪 Testování

### Krok 1: Otevřete testovací stránku
```
http://localhost/test-subscription.html
```

### Krok 2: Přihlaste se
- Testovací rozhraní automaticky načte váš stav předplatného

### Krok 3: Sledujte console output
- Uvidíte real-time změny
- Testujte různé akce pomocí tlačítek

### Krok 4: Debug (pokud něco nefunguje)
```javascript
// V browser console spusťte:
const script = document.createElement('script');
script.src = '/debug-subscription.js';
document.head.appendChild(script);

// Pak spusťte diagnostiku:
debugSubscription()
```

### Krok 5: Otestujte změny v reálném čase
1. Otevřete Stripe Dashboard
2. Vytvořte testovací předplatné
3. Sledujte, jak se UI okamžitě aktualizuje (žádná potřeba refresh!)

**💡 TIP:** Pokud se stránka nenačítá, zkontrolujte:
1. Je Firebase načten? (console: `✅ Firebase načten a připraven`)
2. Jsou funkce dostupné? (console: `✅ Subscription management funkce načteny`)
3. Pokud ne, zkontrolujte pořadí scriptů v HTML (Firebase MUSÍ být první)

---

## 📊 Databázová struktura (potvrzená)

```
Firestore:
└── customers/
    └── {userId}/
        └── subscriptions/
            └── {subscriptionId}/  (např. sub_1SkQg...)
                ├── status: "active" | "trialing" | "past_due" | ...
                ├── current_period_end: Timestamp
                ├── cancel_at_period_end: boolean
                └── ... další Stripe metadata
```

---

## ⚙️ Jak to funguje

### Real-time flow:
1. Uživatel se přihlásí → získáme `userId`
2. Spustíme `subscribeToUserSubscription(userId, callback)`
3. Listener sleduje `customers/${userId}/subscriptions`
4. Když se data změní v Firestore → callback je automaticky volán
5. UI se aktualizuje okamžitě (bez refresh)

### Validační logika:
```javascript
✅ Má předplatné = (status === 'active' || status === 'trialing') 
                   AND 
                   (current_period_end > NOW)

❌ Nemá předplatné = jinak
```

---

## 🔒 Bezpečnost

### ⚠️ DŮLEŽITÉ:
Frontend kontrola je pouze pro UX! Pro skutečnou bezpečnost:

1. **Firebase Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customers/{userId}/subscriptions/{subscriptionId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Pouze Stripe Extension může zapisovat
    }
  }
}
```

2. **Backend validace:**
```javascript
// V Firebase Functions
const hasValidSubscription = async (userId) => {
  const subsRef = admin.firestore()
    .collection('customers').doc(userId)
    .collection('subscriptions');
  
  const snapshot = await subsRef
    .where('status', 'in', ['active', 'trialing'])
    .get();
  
  const now = new Date();
  
  return snapshot.docs.some(doc => {
    const data = doc.data();
    return data.current_period_end.toDate() > now;
  });
};
```

## 🐛 Troubleshooting

### ⚠️ Firebase se nenačítá

**Příznaky:** Console ukazuje `firebaseReady: false` nebo `firebaseAuth is not defined`

**Řešení:**
```html
<!-- SPRÁVNÉ pořadí v HTML <head> -->
<script type="module" src="/firebase-init.js"></script>  <!-- PRVNÍ! -->
<script type="module" src="auth.js"></script>             <!-- DRUHÝ! -->
```

### 🔧 Debug nástroje

**Metoda 1: Použití debug scriptu**
```javascript
// V browser console
const script = document.createElement('script');
script.src = '/debug-subscription.js';
document.head.appendChild(script);

// Po načtení spustit:
debugSubscription()  // Kompletní diagnostika
quickSubTest()       // Rychlá kontrola
```

**Metoda 2: Manuální kontrola**
```javascript
// Zkontrolovat Firebase
console.log('Firebase:', !!window.firebaseAuth, !!window.firebaseDb);

// Zkontrolovat funkce
console.log('Functions:', 
  typeof window.subscribeToUserSubscription,
  typeof window.checkUserSubscription
);

// Zkontrolovat uživatele
console.log('User:', window.firebaseAuth?.currentUser);
```

### 📊 Časté problémy

| Problém | Příznaky | Řešení |
|---------|----------|--------|
| Firebase nenačten | `firebaseAuth is not defined` | Zkontrolujte pořadí scriptů |
| Funkce nenalezena | `is not a function` | Počkejte na načtení auth.js |
| Listener nereaguje | Změny se neprojeví | Zkontrolujte Security Rules |
| Data neexistují | `toDate is not a function` | Ověřte Stripe Extension |
| Expirované předplatné | `isSubscribed: false` | Zkontrolujte `current_period_end` |

---

## 📁 Vytvořené soubory

```
public_html-2/
├── hooks/
│   ├── useSubscription.js      # React hook (JS)
│   └── useSubscription.ts      # React hook (TS)
├── auth.js                     # ← Přidány 3 nové funkce na konec
├── test-subscription.html      # Testovací UI s live preview
├── debug-subscription.js       # 🆕 Debug nástroj
├── SUBSCRIPTION_GUIDE.md       # Kompletní dokumentace
├── SUBSCRIPTION_USAGE_EXAMPLES.js  # Ukázky použití
└── SUBSCRIPTION_SUMMARY.md     # Tento soubor
```

---

## 🎯 Quick Start Checklist

- [ ] Otevřít `test-subscription.html` a ověřit, že funguje
- [ ] Přidat `requireSubscription()` na stránky, které chcete chránit
- [ ] Přidat subscription badge do navigace (viz GUIDE)
- [ ] Nastavit Firebase Security Rules (viz sekce Bezpečnost)
- [ ] Testovat real-time aktualizace (zaplatit v jiném tabu)
- [ ] Implementovat backend validaci ve Functions

---

## 💡 Tipy

1. **Cache pro výkon:** Pro opakované rychlé kontroly cachujte výsledek
2. **Loading states:** Vždy zobrazujte loading během `isLoading === true`
3. **Error handling:** Funkce automaticky zpracovávají chyby
4. **Cleanup:** Vždy odpojte listenery pomocí `unsubscribe()`
5. **Console logs:** Pro debug zapněte console a sledujte emoji log messages

---

## 🐛 Troubleshooting

### Problém: "subscribeToUserSubscription is not a function"
**Řešení:** Zkontrolujte, že `auth.js` je načten před použitím funkce

### Problém: Listener nereaguje na změny
**Řešení:** Zkontrolujte Firebase Security Rules - musí povolit read

### Problém: "Cannot read property 'toDate' of undefined"
**Řešení:** Data v Firestore ještě neexistují - zkontrolujte Stripe Extension

### Problém: Status je "active" ale isSubscribed je false
**Řešení:** `current_period_end` je v minulosti - předplatné expirovala

---

## 📞 Další kroky

1. **Otestovat** pomocí `test-subscription.html`
2. **Implementovat** na vybrané stránky
3. **Přidat** UI indikátory do navigace
4. **Nastavit** Security Rules
5. **Validovat** na backendu

---

**Hotovo! 🎉**

Máte plně funkční subscription systém s real-time aktualizacemi, který spolupracuje s oficiální Stripe Extension.
