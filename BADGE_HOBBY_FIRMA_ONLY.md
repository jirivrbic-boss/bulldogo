# ✅ BADGE MAPOVÁNÍ - ZMĚNA NA HOBBY/FIRMA

## 📝 Co bylo změněno?

Odstraněno mapování "Trial" a "Premium" - nyní se vždy zobrazuje **"Hobby"** nebo **"Firma"** podle typu Stripe produktu.

---

## 🔧 Změny v souborech

### 1. **auth.js - `window.getSubscriptionDetails()`**

**PŘED:**
```javascript
validSubscription = {
    plan: data.status === 'trialing' ? 'trial' : 'premium'
};
```

**PO:**
```javascript
// Určit typ plánu podle názvu produktu
let planType = 'hobby'; // výchozí

const productName = (
    data.product?.name || 
    data.items?.[0]?.price?.product?.name || 
    data.metadata?.product_name ||
    ''
).toLowerCase();

// Určit typ podle názvu produktu
if (productName.includes('firma') || productName.includes('business')) {
    planType = 'business';
} else if (productName.includes('hobby')) {
    planType = 'hobby';
}

validSubscription = {
    plan: planType // Vrací 'hobby' nebo 'business'
};
```

**Logika:**
- ✅ Čte název produktu ze Stripe dat
- ✅ Pokud obsahuje "firma" nebo "business" → `'business'`
- ✅ Pokud obsahuje "hobby" → `'hobby'`
- ✅ Výchozí (fallback) → `'hobby'`

---

### 2. **auth.js - `window.checkUserPlanFromDatabase()`**

**PŘED:**
```javascript
const plan = subscriptionDetails.status === 'trialing' ? 'trial' : 'premium';
```

**PO:**
```javascript
const plan = subscriptionDetails.plan; // Už je to 'hobby' nebo 'business'
```

---

### 3. **script.js - `applySidebarBadge()`**

**PŘED:**
```javascript
if (plan === 'trial') {
    label = 'Trial';
    cls = 'badge-trial';
} else if (plan === 'premium') {
    label = 'Premium';
    cls = 'badge-premium';
} else if (plan === 'business') {
    // ...
}
```

**PO:**
```javascript
if (plan === 'business') {
    label = 'Firma';
    cls = 'badge-business';
} else if (plan === 'hobby') {
    label = 'Hobby';
    cls = 'badge-hobby';
}
```

---

### 4. **packages.js - Badge rendering**

Stejná změna jako v `script.js` - odstraněny `trial` a `premium`.

---

### 5. **plan.js - Všechny funkce**

Upraveny 3 funkce:
- `loadCurrentPlan()` - Používá `subscriptionDetails.plan`
- `updatePlanUI()` - Odstraněny "Trial" a "Premium"
- `updatePlanStats()` - Odstraněny "Trial" a "Premium"
- `refreshBadge()` - Používá `subscriptionDetails.plan`

---

## 🎯 Výsledek

### Mapování nyní:

| Stripe Product Name | Badge Text | CSS Class |
|---------------------|-----------|-----------|
| "Hobby ..." | **Hobby** | `badge-hobby` |
| "Firma ..." | **Firma** | `badge-business` |
| "Business ..." | **Firma** | `badge-business` |
| Ostatní/neznámé | **Hobby** | `badge-hobby` |

### Status se NEIGNORUJE:
- ✅ `status: 'trialing'` → Stále se zobrazí jako **Hobby** nebo **Firma** (podle produktu)
- ✅ `status: 'active'` → Stále se zobrazí jako **Hobby** nebo **Firma** (podle produktu)

---

## 🔍 Jak to funguje?

### 1. Uživatel má Stripe předplatné
```
Stripe Product: "Hobby - Měsíční"
Status: 'trialing'
↓
getSubscriptionDetails() čte product.name
↓
Najde "hobby" v názvu
↓
Vrátí: { plan: 'hobby', ... }
↓
Badge: "Hobby" (zelený)
```

### 2. Uživatel má Stripe předplatné na firmu
```
Stripe Product: "Firma - Roční"
Status: 'active'
↓
getSubscriptionDetails() čte product.name
↓
Najde "firma" v názvu
↓
Vrátí: { plan: 'business', ... }
↓
Badge: "Firma" (modrý)
```

---

## 📊 Kde se produkty čtou?

### Struktura Stripe dat v Firestore:
```javascript
customers/{uid}/subscriptions/{sub_id}
{
    status: 'active' nebo 'trialing',
    current_period_end: Timestamp,
    product: {
        name: "Hobby - Měsíční"  // ← ODTUD se čte
    },
    items: [{
        price: {
            product: {
                name: "Hobby - Měsíční"  // ← Fallback
            }
        }
    }],
    metadata: {
        product_name: "..."  // ← Další fallback
    }
}
```

**Pořadí čtení:**
1. `data.product.name`
2. `data.items[0].price.product.name`
3. `data.metadata.product_name`
4. Výchozí: `'hobby'`

---

## 🧪 Testování

### Test 1: Hobby uživatel
```
1. Vytvořte Stripe předplatné s produktem "Hobby"
2. Přihlaste se na web
3. Badge by měl zobrazit "Hobby" ✅
4. Console: 🔍 Product name: "hobby - měsíční"
```

### Test 2: Firma uživatel
```
1. Vytvořte Stripe předplatné s produktem "Firma"
2. Přihlaste se na web
3. Badge by měl zobrazit "Firma" ✅
4. Console: 🔍 Product name: "firma - roční"
```

### Test 3: Trial období
```
1. Vytvořte Stripe předplatné s trial
2. Přihlaste se na web
3. Badge by měl zobrazit "Hobby" nebo "Firma" (podle produktu) ✅
4. NE "Trial" ❌
```

### Test 4: Stránka Spravovat balíček
```
1. Otevřete profile-plan.html
2. "Aktuální balíček:" by měl zobrazit "Hobby" nebo "Firma" ✅
3. NE "Zkušební období" nebo "Premium" ❌
```

---

## 💡 Důležité poznámky

### 1. **Fallback na Hobby**
Pokud nelze určit typ produktu, použije se `'hobby'` jako výchozí:
```javascript
let planType = 'hobby'; // výchozí
```

### 2. **Case-insensitive**
Názvy produktů se převádějí na lowercase:
```javascript
productName.toLowerCase().includes('firma')
```

### 3. **Aliasy**
Podporuje anglické i české názvy:
- `'firma'` nebo `'business'` → `'business'`
- `'hobby'` → `'hobby'`

### 4. **Console logy**
Pro debugging se loguje název produktu:
```javascript
console.log('🔍 Product name:', productName);
```

---

## ✅ Výhody nového systému

### 1. **Přesnější mapování**
- ✅ Badge odpovídá skutečnému produktu
- ✅ Ne jen statusu ('trialing' vs 'active')

### 2. **Konzistentní terminologie**
- ✅ "Hobby" a "Firma" všude
- ✅ Žádné "Trial" nebo "Premium"

### 3. **Flexibilní**
- ✅ Snadno přidat nové typy produktů
- ✅ Podporuje více názvů (aliasy)

### 4. **Robustní**
- ✅ Fallback na 'hobby' pokud nelze určit
- ✅ Kontroluje více míst v datech

---

## 🎨 CSS

Pro správné zobrazení musí být v `styles.css`:

```css
.badge-hobby {
    background: #10b981; /* Zelená */
    color: white;
}

.badge-business {
    background: #3b82f6; /* Modrá */
    color: white;
}
```

**Odstraňte/ignorujte:**
- `.badge-trial` (už se nepoužívá)
- `.badge-premium` (už se nepoužívá)

---

## ✅ Výsledek

Badge a všechny části webu nyní:
- ✅ Zobrazují vždy **"Hobby"** nebo **"Firma"**
- ✅ Čtou typ z **Stripe product name**
- ✅ Nezávisí na `status` ('trialing' vs 'active')
- ✅ Mají **fallback na 'hobby'**

---

**Datum:** 2026-01-31  
**Soubory změněny:** auth.js, script.js, packages.js, plan.js (4 soubory)  
**Status:** ✅ Hotovo
