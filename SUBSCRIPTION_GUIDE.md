# 🔐 Subscription Management - Návod k použití

## Přehled

Tento systém poskytuje real-time sledování stavu předplatného uživatele pomocí oficiální Stripe Extension "Run Payments with Stripe".

Všechny funkce jsou dostupné globálně přes `window` objekt a pracují s Firestore strukturou:
- Collection Path: `customers/${userId}/subscriptions`
- Key Fields: `status`, `current_period_end`, `cancel_at_period_end`

---

## 📚 Dostupné funkce

### 1. `subscribeToUserSubscription(userId, callback)`

**Real-time listener** pro sledování změn předplatného.

**Parametry:**
- `userId` (string) - ID přihlášeného uživatele
- `callback` (function) - Funkce volaná při změně stavu

**Callback vrací objekt:**
```javascript
{
  isSubscribed: boolean,      // True = má aktivní předplatné
  isLoading: boolean,          // True = načítá se
  subscriptionEnd: Date|null,  // Datum konce předplatného
  isCanceled: boolean,         // True = nebude obnoveno
  subscriptionId: string|null, // ID Stripe předplatného
  status: string|null          // 'active', 'trialing', 'expired', 'error'
}
```

**Návratová hodnota:**
- Funkce pro odpojení listeneru (unsubscribe)

---

### 2. `checkUserSubscription(userId)`

**Jednorázová kontrola** předplatného (bez real-time updates).

**Parametry:**
- `userId` (string) - ID uživatele

**Vrací:**
- `Promise<boolean>` - True pokud má aktivní předplatné

---

### 3. `requireSubscription(options)`

**Ochrana stránky** - automaticky přesměruje pokud nemá předplatné.

**Parametry (volitelné):**
```javascript
{
  redirectUrl: '/packages.html',  // Kam přesměrovat
  showAlert: true,                // Zobrazit alert
  onSubscribed: (subData) => {}, // Callback pro předplatitele
  onNoSubscription: () => {}      // Callback před přesměrováním
}
```

---

## 🎯 Příklady použití

### ✅ Příklad 1: Ochrana celé stránky (Premium feature)

```html
<!-- statistiky.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Statistiky - Premium</title>
    
    <!-- DŮLEŽITÉ: Firebase MUSÍ být načten PŘED auth.js -->
    <script type="module" src="/firebase-init.js"></script>
    <script type="module" src="auth.js"></script>
</head>
<body>
    <h1>Statistiky</h1>
    <div id="stats-content">
        <!-- Premium obsah -->
    </div>

    <script type="module">
        // Po načtení stránky zkontroluj předplatné
        window.addEventListener('load', async () => {
            await requireSubscription({
                redirectUrl: '/packages.html',
                showAlert: true,
                onSubscribed: (subData) => {
                    console.log('Premium uživatel má přístup');
                    console.log('Předplatné do:', subData.subscriptionEnd);
                }
            });
        });
    </script>
</body>
</html>
```

---

### ✅ Příklad 2: Real-time zobrazení stavu v navigaci

```html
<!-- V hlavičce stránky -->
<head>
    <!-- Firebase MUSÍ být načten PRVNÍ -->
    <script type="module" src="/firebase-init.js"></script>
    <script type="module" src="auth.js"></script>
</head>

<nav>
    <div id="subscription-badge">
        <span class="loading">Načítání předplatného...</span>
    </div>
</nav>

<script type="module">
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    let unsubscribeListener = null;
    
    // Počkat na Firebase inicializaci
    async function waitForFirebase() {
        while (!window.firebaseAuth) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    waitForFirebase().then(() => {
        onAuthStateChanged(window.firebaseAuth, (user) => {
            const badge = document.getElementById('subscription-badge');
            
            if (!user) {
                badge.innerHTML = '<span class="no-auth">Nepřihlášen</span>';
                return;
            }

            // Zapni real-time listener
            unsubscribeListener = subscribeToUserSubscription(user.uid, (subData) => {
                if (subData.isLoading) {
                    badge.innerHTML = '<span class="loading">Načítání...</span>';
                    return;
                }

                if (subData.isSubscribed) {
                    const endDate = subData.subscriptionEnd.toLocaleDateString('cs-CZ');
                    badge.innerHTML = `
                        <div class="active">
                            <span class="icon">✓</span>
                            <span>Premium</span>
                            ${subData.isCanceled ? `<small>Vyprší: ${endDate}</small>` : ''}
                        </div>
                    `;
                } else {
                    badge.innerHTML = `
                        <div class="inactive">
                            <span class="icon">⚠️</span>
                            <span>Bez předplatného</span>
                            <a href="/packages.html">Aktivovat</a>
                        </div>
                    `;
                }
            });
        });
    });

    // Vyčisti listener při opuštění stránky
    window.addEventListener('beforeunload', () => {
        if (unsubscribeListener) {
            unsubscribeListener();
        }
    });
</script>

<style>
    #subscription-badge .active {
        background: #4CAF50;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
    }

    #subscription-badge .inactive {
        background: #FF9800;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
    }

    #subscription-badge small {
        display: block;
        font-size: 11px;
        opacity: 0.9;
        margin-top: 2px;
    }
</style>
```

---

### ✅ Příklad 3: Podmíněné zobrazení tlačítek/funkcí

```html
<!-- dashboard.html -->
<div class="features">
    <button onclick="openBasicFeature()">
        Základní funkce
    </button>

    <button id="premium-btn" disabled>
        Premium funkce 🔒
    </button>
</div>

<script type="module">
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    onAuthStateChanged(firebaseAuth, (user) => {
        if (!user) return;

        subscribeToUserSubscription(user.uid, (subData) => {
            const premiumBtn = document.getElementById('premium-btn');
            
            if (subData.isSubscribed) {
                // Uživatel má předplatné - odbonuj tlačítko
                premiumBtn.disabled = false;
                premiumBtn.textContent = 'Premium funkce ✓';
                premiumBtn.onclick = () => openPremiumFeature();
            } else {
                // Nemá předplatné - zůstává disabled
                premiumBtn.disabled = true;
                premiumBtn.textContent = 'Premium funkce 🔒';
                premiumBtn.title = 'Vyžaduje aktivní předplatné';
                premiumBtn.onclick = () => {
                    alert('Tato funkce vyžaduje aktivní předplatné');
                    window.location.href = '/packages.html';
                };
            }
        });
    });

    function openBasicFeature() {
        console.log('Základní funkce - dostupná všem');
        // ...
    }

    function openPremiumFeature() {
        console.log('Premium funkce - pouze pro předplatitele');
        // ...
    }

    window.openBasicFeature = openBasicFeature;
    window.openPremiumFeature = openPremiumFeature;
</script>
```

---

### ✅ Příklad 4: Rychlá kontrola před akcí (bez real-time)

```javascript
// Před provedením premium akce zkontroluj předplatné
async function performPremiumAction() {
    const user = firebaseAuth.currentUser;
    if (!user) {
        alert('Musíte být přihlášeni');
        return;
    }

    // Rychlá jednorázová kontrola
    const hasSubscription = await checkUserSubscription(user.uid);
    
    if (!hasSubscription) {
        alert('Tato akce vyžaduje aktivní předplatné');
        window.location.href = '/packages.html';
        return;
    }

    // Pokračuj s akcí
    console.log('Provádím premium akci...');
    // ... tvůj kód ...
}
```

---

### ✅ Příklad 5: Zobrazení detailů předplatného

```html
<!-- profile-settings.html -->
<div id="subscription-details">
    <h2>Vaše předplatné</h2>
    <div id="sub-info">Načítání...</div>
</div>

<script type="module">
    import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

    onAuthStateChanged(firebaseAuth, (user) => {
        if (!user) return;

        subscribeToUserSubscription(user.uid, (subData) => {
            const infoDiv = document.getElementById('sub-info');
            
            if (subData.isLoading) {
                infoDiv.innerHTML = '<p>Načítání...</p>';
                return;
            }

            if (subData.isSubscribed) {
                const endDate = subData.subscriptionEnd.toLocaleDateString('cs-CZ', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });

                infoDiv.innerHTML = `
                    <div class="subscription-active">
                        <h3>✓ Aktivní předplatné</h3>
                        <p><strong>Status:</strong> ${subData.status === 'trialing' ? 'Zkušební období' : 'Aktivní'}</p>
                        <p><strong>Platné do:</strong> ${endDate}</p>
                        <p><strong>Automatické obnovení:</strong> ${subData.isCanceled ? 'Ne ❌' : 'Ano ✓'}</p>
                        ${subData.isCanceled ? `
                            <div class="warning">
                                <p>⚠️ Vaše předplatné se po tomto datu neobnoví.</p>
                                <button onclick="reactivateSubscription()">Znovu aktivovat</button>
                            </div>
                        ` : ''}
                        <button onclick="manageSubscription()">Spravovat předplatné</button>
                    </div>
                `;
            } else {
                infoDiv.innerHTML = `
                    <div class="subscription-inactive">
                        <h3>⚠️ Nemáte aktivní předplatné</h3>
                        <p>Získejte přístup k premium funkcím!</p>
                        <a href="/packages.html" class="btn-primary">Zobrazit balíčky</a>
                    </div>
                `;
            }
        });
    });

    function manageSubscription() {
        // Odkaz na Stripe customer portal
        window.location.href = '/customer-portal.html';
    }

    function reactivateSubscription() {
        // Logika pro znovuaktivaci
        alert('Přesměrování na obnovení předplatného...');
        window.location.href = '/packages.html';
    }

    window.manageSubscription = manageSubscription;
    window.reactivateSubscription = reactivateSubscription;
</script>
```

---

### ✅ Příklad 6: Použití s React (pomocí hooku)

```jsx
// hooks/useSubscription.jsx
import { useState, useEffect } from 'react';

export function useSubscription(userId) {
  const [subData, setSubData] = useState({
    isSubscribed: false,
    isLoading: true,
    subscriptionEnd: null,
    isCanceled: false,
    status: null
  });

  useEffect(() => {
    if (!userId || !window.subscribeToUserSubscription) {
      setSubData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const unsubscribe = window.subscribeToUserSubscription(userId, (data) => {
      setSubData(data);
    });

    return () => unsubscribe && unsubscribe();
  }, [userId]);

  return subData;
}

// Použití v komponentě:
function PremiumFeature() {
  const { user } = useAuth();
  const { isSubscribed, isLoading } = useSubscription(user?.uid);

  if (isLoading) return <div>Načítání...</div>;
  if (!isSubscribed) return <Navigate to="/packages" />;

  return <div>Premium obsah</div>;
}
```

---

## 🎨 Doporučený CSS

```css
/* Subscription badges */
.subscription-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
}

.subscription-badge.active {
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.subscription-badge.inactive {
    background: linear-gradient(135deg, #FF9800 0%, #f57c00 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
}

.subscription-badge.loading {
    background: #e0e0e0;
    color: #666;
}

/* Subscription details */
.subscription-active {
    background: #f1f8f4;
    border: 2px solid #4CAF50;
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
}

.subscription-inactive {
    background: #fff3e0;
    border: 2px solid #FF9800;
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
    text-align: center;
}

.subscription-active h3 {
    color: #4CAF50;
    margin-top: 0;
}

.subscription-inactive h3 {
    color: #FF9800;
    margin-top: 0;
}

.warning {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 8px;
    padding: 12px;
    margin-top: 16px;
}

/* Premium buttons */
button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    background: #2196F3;
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    text-decoration: none;
    display: inline-block;
    transition: background 0.3s;
}

.btn-primary:hover {
    background: #1976D2;
}
```

---

## 🔧 Testování

### Test 1: Kontrola v konzoli
```javascript
// V browser console
const user = firebaseAuth.currentUser;
if (user) {
    const unsub = await subscribeToUserSubscription(user.uid, (data) => {
        console.log('Subscription data:', data);
    });
}
```

### Test 2: Jednorázová kontrola
```javascript
const hasSubscription = await checkUserSubscription(user.uid);
console.log('Má předplatné?', hasSubscription);
```

### Test 3: Ochrana stránky
```javascript
// Na začátku stránky
await requireSubscription({
    onSubscribed: (data) => console.log('OK!', data),
    onNoSubscription: () => console.log('Přesměrování...')
});
```

---

## ⚠️ Důležité poznámky

1. **Real-time aktualizace**: Pokud uživatel zaplatí v jiném tabu, změna se projeví okamžitě díky `onSnapshot`.

2. **Odpojování listenerů**: Vždy odpojte listener pomocí `unsubscribe()` funkce při opuštění stránky nebo unmount komponentě.

3. **Bezpečnost**: Tato kontrola je pouze frontend! Vždy validujte předplatné i na backendu (Firebase Functions) před poskytnutím dat.

4. **Caching**: Pro lepší výkon můžete cachovat výsledek `checkUserSubscription()` s krátkým TTL.

5. **Error handling**: Funkce automaticky zpracovávají chyby a vrací `status: 'error'`.

---

## 📞 Debug

Pokud něco nefunguje, zkontrolujte console:
- ✅ "Subscription management funkce načteny" - Funkce jsou připraveny
- 📊 "Subscription snapshot: X dokumentů" - Listener funguje
- 🔍 "Kontrola předplatného: {...}" - Detail kontroly
- ❌ "Chyba při..." - Něco se pokazilo

### Časté problémy a řešení

#### 1. Firebase se nenačítá (`firebaseAuth is not defined`)
**Příznaky:** Console ukazuje `firebaseReady: false`, stránka se neinicializuje

**Řešení:**
```html
<!-- SPRÁVNÉ pořadí v HTML -->
<head>
    <script type="module" src="/firebase-init.js"></script>  <!-- PRVNÍ -->
    <script type="module" src="auth.js"></script>             <!-- DRUHÝ -->
</head>
```

#### 2. Subscription funkce nenalezena
**Příznaky:** `subscribeToUserSubscription is not a function`

**Řešení:**
- Ujistěte se, že `auth.js` je plně načten
- Zkontrolujte console: měli byste vidět "✅ Subscription management funkce načteny"
- Počkejte na Firebase: `await waitForFirebase()`

#### 3. Real-time updates nefungují
**Příznaky:** Po platbě ve Stripe se stav na webu neaktualizuje

**Řešení:**
1. Zkontrolujte Firebase Security Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customers/{userId}/subscriptions/{subscriptionId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Pouze Stripe Extension
    }
  }
}
```

2. Ověřte Stripe Webhooks:
   - Stripe Dashboard → Developers → Webhooks
   - Zkontrolujte Event logs
   - Měli byste vidět: `customer.subscription.created`, `customer.subscription.updated`

3. Zkontrolujte Firestore data:
   - Firebase Console → Firestore Database
   - Navigujte na: `customers/{userId}/subscriptions`
   - Měli byste vidět dokumenty s Stripe předplatnými

#### 4. Status "active" ale isSubscribed je false
**Příznaky:** Firestore ukazuje `status: 'active'`, ale hook vrací `isSubscribed: false`

**Řešení:**
- Zkontrolujte `current_period_end` - je v budoucnosti?
- Log v console: `🔍 Kontrola předplatného: { ... isExpired: true/false }`
- Pokud je `isExpired: true`, předplatné už vypršelo

#### 5. Data v Firestore neexistují
**Příznaky:** `Cannot read property 'toDate' of undefined`

**Řešení:**
1. Firebase Console → Extensions
2. Najděte "Run Payments with Stripe"
3. Zkontrolujte Extension status (musí být "Active")
4. Zkontrolujte Extension logs pro chyby
5. Ověřte, že Stripe webhook je správně nastaven

---

**Vytvořeno pro Stripe Extension "Run Payments with Stripe"**
**Firebase v9 Modular SDK**
