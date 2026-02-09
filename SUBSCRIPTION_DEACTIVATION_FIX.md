# 🔧 Řešení: Automatická deaktivace inzerátů při expiraci předplatného

## 📋 Problém

**Původní situace:**
```
Když předplatné uživatele vyprší:
1. services.html SKRYJE inzeráty (real-time filtr) ✅
2. Databáze: status zůstává 'active' ❌
3. Deaktivace nastane AŽ když se uživatel přihlásí na my-ads.html ❌
```

**Kritická mezera:**
- Pokud uživatel **nepřijde na web týdny/měsíce**, inzeráty zůstanou `status: 'active'` v databázi
- Při obnovení předplatného se inzeráty **OKAMŽITĚ objeví** (i když byly "skryté" celou dobu)
- **Nekonzistence** mezi skutečným stavem (skrytý) a databází (active)

---

## ✅ Řešení: Firebase Cloud Functions

### **3 automatické funkce:**

#### **1. onSubscriptionExpired** ⚡ (hlavní)
- **Trigger:** Změna subscription dokumentu v Firestore
- **Kdy:** Okamžitě po expiraci (< 5 sekund)
- **Co dělá:**
  1. Detekuje expiraci (`status: 'expired'` nebo `current_period_end` v minulosti)
  2. Najde všechny aktivní inzeráty uživatele
  3. Batch update → `status: 'inactive'`, `inactiveReason: 'plan_expired'`
  4. Přidá timestamp `inactiveAt`

#### **2. onSubscriptionActivated** 🎉 (bonus)
- **Trigger:** Změna subscription dokumentu v Firestore
- **Kdy:** Okamžitě po aktivaci předplatného
- **Co dělá:**
  1. Detekuje aktivaci (`status: 'active'` a platný `current_period_end`)
  2. Najde inzeráty s `inactiveReason: 'plan_expired'`
  3. Batch update → `status: 'active'`, odstraní `inactiveReason`
  4. Přidá timestamp `reactivatedAt`

#### **3. checkExpiredSubscriptions** 🕐 (záložní)
- **Trigger:** Scheduled (každou hodinu)
- **Kdy:** Automaticky každou hodinu
- **Co dělá:**
  1. Projde všechny uživatele
  2. Zkontroluje, zda mají platné předplatné
  3. Deaktivuje aktivní inzeráty uživatelů bez předplatného
  4. Slouží jako backup pro případ selhání trigger funkcí

---

## 🔄 Jak to funguje v praxi

### **Scénář 1: Předplatné vyprší v půlnoci**

```
📅 31.01.2026 23:59:59
   User má předplatné:
   - subscription: status='active', current_period_end='2026-01-31 23:59:59'
   - inzeráty: 3x status='active'
   
   🌐 services.html: Inzeráty SE ZOBRAZUJÍ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 01.02.2026 00:00:15
   ⚡ Stripe webhook se spustí
   → Změní subscription dokument v Firestore
   
📅 01.02.2026 00:00:16
   🔥 onSubscriptionExpired trigger se aktivuje
   → Funkce detekuje expiraci
   → Najde 3 aktivní inzeráty
   → Batch update na 'inactive'
   
📅 01.02.2026 00:00:17
   ✅ HOTOVO
   - subscription: status='expired'
   - inzeráty: 3x status='inactive', inactiveReason='plan_expired'
   
   🌐 services.html: Inzeráty SE NEZOBRAZUJÍ (filtr + status)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 15.02.2026 10:00:00
   💳 User si zakoupí nové předplatné
   
📅 15.02.2026 10:00:10
   ⚡ Stripe webhook se spustí
   → Změní subscription dokument: status='active', period_end='2027-02-15'
   
📅 15.02.2026 10:00:11
   🔥 onSubscriptionActivated trigger se aktivuje
   → Funkce detekuje aktivaci
   → Najde 3 inzeráty s inactiveReason='plan_expired'
   → Batch update na 'active'
   
📅 15.02.2026 10:00:12
   ✅ HOTOVO
   - subscription: status='active'
   - inzeráty: 3x status='active'
   
   🌐 services.html: Inzeráty SE ZOBRAZUJÍ
```

---

## 📊 Před vs. Po implementaci

### **PŘED (bez Cloud Functions):**

| Událost | Status v DB | Zobrazí se na web | Problém |
|---------|-------------|-------------------|---------|
| Předplatné vyprší | `active` ❌ | ❌ Ne (filtr) | Nekonzistence |
| User se nepřihlásí | `active` ❌ | ❌ Ne (filtr) | Status neodpovídá realitě |
| User koupí předplatné | `active` ❌ | ✅ Ano 😱 | Inzerát byl "skrytý" týdny! |
| User otevře my-ads.html | `inactive` ✅ | ❌ Ne | Teprve TEĎ se deaktivuje |

**Problémy:**
- ❌ Závislost na přihlášení uživatele
- ❌ Nekonzistence v databázi
- ❌ Chybějící `inactiveReason`
- ❌ Topování může běžet i když je inzerát "skrytý"

---

### **PO (s Cloud Functions):**

| Událost | Status v DB | Zobrazí se na web | Řešení |
|---------|-------------|-------------------|--------|
| Předplatné vyprší | `inactive` ✅ | ❌ Ne | Okamžitá deaktivace (< 5s) |
| User se nepřihlásí | `inactive` ✅ | ❌ Ne | Status odpovídá realitě |
| User koupí předplatné | `active` ✅ | ✅ Ano | Okamžitá reaktivace (< 5s) |
| User otevře my-ads.html | `inactive` ✅ | ❌ Ne | Už je deaktivovaný |

**Výhody:**
- ✅ **Nezávislé na uživateli** - funguje i když se nepřihlásí
- ✅ **Konzistentní databáze** - status odpovídá realitě
- ✅ **Rychlá reakce** - deaktivace < 5 sekund
- ✅ **Důvod deaktivace** - `inactiveReason: 'plan_expired'`
- ✅ **Automatická reaktivace** - při obnovení předplatného
- ✅ **Záložní mechanismus** - hodinová kontrola

---

## 🛠️ Implementované soubory

### **1. Cloud Functions kód:**
```
functions/
├── src/
│   └── index.ts                    # 3 Cloud Functions
├── lib/
│   └── index.js                    # Zkompilovaný JS
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── .eslintrc.js                    # Linter config
├── .gitignore                      # Ignore lib/
└── README.md                       # Rychlý přehled
```

### **2. Dokumentace:**
```
/
├── CLOUD_FUNCTIONS_DEPLOYMENT.md   # Kompletní deployment guide
├── CLOUD_FUNCTIONS_TESTING.md      # Testovací scénáře
└── SUBSCRIPTION_DEACTIVATION_FIX.md # Tento soubor (přehled)
```

---

## 📦 Co je potřeba udělat (Deployment)

### **Krok 1: Zkontrolovat Firebase plán**
```bash
# Otevři Firebase Console
https://console.firebase.google.com/project/_/usage

# Zkontroluj, že máš Blaze plán (pay-as-you-go)
# Pro malé projekty: ZDARMA (free tier: 2M invocations/měsíc)
```

### **Krok 2: Build a Deploy**
```bash
cd functions
npm install
npm run build
npm run deploy
```

### **Krok 3: Ověření**
```bash
# Sleduj logy
firebase functions:log

# Zkontroluj v konzoli
https://console.firebase.google.com/project/_/functions

# Měly by být viditelné 3 funkce:
# - onSubscriptionExpired
# - onSubscriptionActivated
# - checkExpiredSubscriptions
```

### **Krok 4: Testování**
```bash
# Změň subscription dokument v Firestore
# Nastav current_period_end na datum v minulosti

# Sleduj logy pro ověření
firebase functions:log --only onSubscriptionExpired

# Zkontroluj inzeráty - měly by být 'inactive'
```

---

## 💰 Náklady

### **Odhad pro malý projekt (100 uživatelů):**
- Expirace: ~10/den = 300/měsíc
- Aktivace: ~5/den = 150/měsíc
- Scheduled: 24/den = 720/měsíc
- **Celkem: ~1,170 invocations/měsíc**

**Náklady: 0 Kč** (pod free tier limitem 2M)

### **Odhad pro střední projekt (1,000 uživatelů):**
- Expirace: ~100/den = 3,000/měsíc
- Aktivace: ~50/den = 1,500/měsíc
- Scheduled: 24/den = 720/měsíc
- **Celkem: ~5,220 invocations/měsíc**

**Náklady: 0 Kč** (stále pod free tier limitem)

---

## 🔒 Bezpečnost

**Cloud Functions běží s admin právy:**
- ✅ Mohou číst/zapisovat jakákoliv data
- ✅ Obcházejí Firestore Security Rules
- ✅ Běží na serverové straně (nemohou být obejity klientem)

**Firestore Security Rules:**
- ❌ NENÍ potřeba měnit
- Client-side kód stále podléhá pravidlům
- Cloud Functions mají plná práva

---

## 📊 Monitoring

### **Logy v reálném čase:**
```bash
firebase functions:log
```

### **Filtrovat podle funkce:**
```bash
firebase functions:log --only onSubscriptionExpired
firebase functions:log --only onSubscriptionActivated
firebase functions:log --only checkExpiredSubscriptions
```

### **Očekávané log messages:**
```
🔔 Subscription změna detekována
⚠️ Předplatné vypršelo! Deaktivuji inzeráty
📝 Nalezeno X aktivních inzerátů k deaktivaci
✅ Úspěšně deaktivováno X inzerátů

🎉 Předplatné aktivováno! Reaktivuji inzeráty
📝 Nalezeno X inzerátů k reaktivaci
✅ Úspěšně reaktivováno X inzerátů

🕐 Spouštím kontrolu expirovaných předplatných
✅ Kontrola dokončena. Celkem deaktivováno: X inzerátů
```

---

## ✅ Výhody tohoto řešení

### **1. Automatické**
- ✅ Žádná závislost na přihlášení uživatele
- ✅ Funguje 24/7 na pozadí

### **2. Rychlé**
- ✅ Reakce < 5 sekund po expiraci
- ✅ Okamžitá reaktivace při obnovení

### **3. Spolehlivé**
- ✅ Serverová strana (bezpečné)
- ✅ Záložní scheduled funkce (každou hodinu)
- ✅ Atomické batch operace

### **4. Konzistentní**
- ✅ Status v databázi odpovídá realitě
- ✅ Jasný důvod deaktivace (`inactiveReason`)
- ✅ Timestamp kdy k tomu došlo

### **5. Levné**
- ✅ Pro malé/střední projekty: ZDARMA
- ✅ Free tier: 2M invocations/měsíc
- ✅ Žádné skryté náklady

---

## 🐛 Známé edge cases a jejich řešení

### **Edge case 1: Duplicitní webhook**
**Problém:** Stripe webhook se opakuje (retry)

**Řešení:** Funkce kontroluje `before.status` a přeskočí, pokud už je expirovaný:
```typescript
if (wasAlreadyExpired && isStatusExpired && before.status === after.status) {
  return null; // Přeskočit
}
```

---

### **Edge case 2: Ručně pozastavené inzeráty**
**Problém:** Uživatel má mix aktivních a ručně pozastavených inzerátů

**Řešení:**
- ✅ Deaktivují se **POUZE** inzeráty s `status: 'active'`
- ✅ Při reaktivaci se aktivují **POUZE** inzeráty s `inactiveReason: 'plan_expired'`
- ✅ Ručně pozastavené inzeráty zůstanou nedotčené

---

### **Edge case 3: Webhook delay**
**Problém:** Stripe webhook může mít zpoždění (až několik minut)

**Řešení:**
- ✅ Záložní scheduled funkce běží každou hodinu
- ✅ Real-time filtr na services.html funguje okamžitě (neviditelné inzeráty)
- ✅ Grace period v my-ads.js (2 minuty) toleruje delay

---

## 📚 Další dokumentace

- **Deployment:** `CLOUD_FUNCTIONS_DEPLOYMENT.md`
- **Testování:** `CLOUD_FUNCTIONS_TESTING.md`
- **Functions README:** `functions/README.md`
- **Subscription systém:** `SUBSCRIPTION_SUMMARY.md`

---

## 🎉 Závěr

**Problém vyřešen!**

✅ Inzeráty se **automaticky deaktivují** během sekund po expiraci  
✅ **Není nutné**, aby se uživatel přihlásil  
✅ **Konzistentní** databáze  
✅ **Automatická reaktivace** při obnovení předplatného  
✅ **Záložní mechanismus** pro maximální spolehlivost  
✅ **Žádné náklady** pro malé/střední projekty  

**Hotovo!** 🚀
