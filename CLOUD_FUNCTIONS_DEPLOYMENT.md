# 🚀 Cloud Functions - Automatická deaktivace inzerátů

## 📋 Přehled

Tento dokument popisuje implementaci Firebase Cloud Functions pro **automatickou deaktivaci inzerátů** když uživateli vyprší předplatné.

---

## 🎯 Co bylo implementováno

### **1. onSubscriptionExpired** (Hlavní funkce)
- **Trigger:** Firestore `onUpdate`
- **Cesta:** `customers/{userId}/subscriptions/{subId}`
- **Účel:** Automaticky deaktivuje inzeráty když předplatné vyprší

**Kdy se spustí:**
- ⚡ Okamžitě když Stripe webhook změní subscription dokument
- 🔍 Kontroluje `status` (expired, canceled, unpaid, past_due)
- 📅 Kontroluje `current_period_end` (je v minulosti)

**Co dělá:**
1. Najde všechny aktivní inzeráty uživatele (`status: 'active'`)
2. Batch update na `status: 'inactive'`
3. Přidá metadata:
   - `inactiveReason: 'plan_expired'`
   - `inactiveAt: serverTimestamp()`
   - `lastModified: serverTimestamp()`

---

### **2. onSubscriptionActivated** (Reaktivace)
- **Trigger:** Firestore `onUpdate`
- **Cesta:** `customers/{userId}/subscriptions/{subId}`
- **Účel:** Automaticky reaktivuje inzeráty když uživatel obnoví předplatné

**Kdy se spustí:**
- 🎉 Když subscription přejde do stavu `active` nebo `trialing`
- ✅ Když `current_period_end` je v budoucnosti

**Co dělá:**
1. Najde inzeráty s `status: 'inactive'` A `inactiveReason: 'plan_expired'`
2. Batch update na `status: 'active'`
3. Odstraní `inactiveReason` a `inactiveAt`
4. Přidá `reactivatedAt: serverTimestamp()`

---

### **3. checkExpiredSubscriptions** (Záložní kontrola)
- **Trigger:** Scheduled (Pub/Sub)
- **Schedule:** Každou hodinu (`every 1 hours`)
- **Účel:** Záložní mechanismus pro případ selhání `onUpdate` triggeru

**Co dělá:**
1. Projde všechny uživatele v `customers` kolekci
2. Pro každého zkontroluje, zda má platné předplatné
3. Pokud ne, deaktivuje aktivní inzeráty
4. Loguje počet deaktivovaných inzerátů

---

## 📦 Instalace a nasazení

### **Krok 1: Zkontrolovat Firebase projekt**

Ujisti se, že máš nastavený Firebase projekt:

```bash
cd /Users/adam/Desktop/public_html-2
firebase projects:list
```

Pokud není projekt nastavený:

```bash
firebase use --add
# Vyber svůj projekt a přiřaď mu alias (např. "default")
```

---

### **Krok 2: Zkontrolovat Firebase plán**

Cloud Functions **vyžadují Blaze plán** (pay-as-you-go).

Zkontroluj na: https://console.firebase.google.com/project/_/usage

**Free tier limity:**
- ✅ 2M invocations/měsíc ZDARMA
- ✅ 400,000 GB-seconds compute time ZDARMA
- ✅ 200,000 CPU-seconds ZDARMA
- ✅ 5 GB network egress ZDARMA

Pro většinu malých až středních projektů jsou tyto funkce **ZADARMO** i na Blaze plánu.

---

### **Krok 3: Instalace závislostí**

```bash
cd functions
npm install
```

Zkontroluj, že `package.json` obsahuje:
- `firebase-admin: ^12.0.0`
- `firebase-functions: ^4.5.0`

---

### **Krok 4: Build TypeScript**

```bash
npm run build
```

To zkompiluje TypeScript soubory z `src/` do `lib/`.

**Očekávaný výstup:**
```
✔ Compiled successfully
lib/
  └── index.js
```

---

### **Krok 5: Testování lokálně (volitelné)**

Můžeš testovat funkce lokálně pomocí emulátorů:

```bash
npm run serve
```

To spustí:
- 🔥 Firestore Emulator
- ⚡ Functions Emulator
- 🌐 UI na http://localhost:4000

**POZNÁMKA:** Emulátory nepodporují skutečné Stripe webhooky, takže budeš muset simulovat změny subscription dokumentů manuálně.

---

### **Krok 6: Nasazení do produkce**

**Nasadit všechny funkce:**

```bash
npm run deploy
```

Nebo explicitně:

```bash
firebase deploy --only functions
```

**Nasadit pouze konkrétní funkci:**

```bash
firebase deploy --only functions:onSubscriptionExpired
firebase deploy --only functions:onSubscriptionActivated
firebase deploy --only functions:checkExpiredSubscriptions
```

---

### **Krok 7: Ověření nasazení**

Po nasazení zkontroluj v konzoli:

https://console.firebase.google.com/project/_/functions

**Očekávané funkce:**
- ✅ `onSubscriptionExpired` (Firestore trigger)
- ✅ `onSubscriptionActivated` (Firestore trigger)
- ✅ `checkExpiredSubscriptions` (Scheduled)

---

## 🧪 Testování funkcí

### **Test 1: Simulace expirace předplatného**

1. **Najdi uživatele s aktivním předplatným:**
   - Firebase Console → Firestore → `customers/{userId}/subscriptions`

2. **Změň `current_period_end` na minulost:**
   ```
   current_period_end: 2026-01-01 00:00:00
   ```

3. **Sleduj logy:**
   ```bash
   firebase functions:log --only onSubscriptionExpired
   ```

4. **Očekávaný výsledek:**
   - ✅ Funkce se spustí během několika sekund
   - ✅ Všechny aktivní inzeráty uživatele budou mít `status: 'inactive'`
   - ✅ Přidáno `inactiveReason: 'plan_expired'`

---

### **Test 2: Simulace reaktivace předplatného**

1. **Změň subscription zpět na aktivní:**
   ```
   status: 'active'
   current_period_end: 2027-12-31 23:59:59
   ```

2. **Sleduj logy:**
   ```bash
   firebase functions:log --only onSubscriptionActivated
   ```

3. **Očekávaný výsledek:**
   - ✅ Funkce se spustí během několika sekund
   - ✅ Inzeráty s `inactiveReason: 'plan_expired'` budou reaktivovány
   - ✅ `status: 'active'`, `inactiveReason` a `inactiveAt` odstraněny

---

### **Test 3: Záložní scheduled funkce**

Scheduled funkce běží **automaticky každou hodinu**.

**Manuální spuštění (pro testování):**

Přes Firebase Console:
1. Jdi na Functions → `checkExpiredSubscriptions`
2. Klikni "Test function"
3. Sleduj logy

Nebo přes CLI:
```bash
firebase functions:shell
# V shellu:
checkExpiredSubscriptions()
```

---

## 📊 Monitoring a logy

### **Sledování logů v reálném čase:**

```bash
firebase functions:log
```

**Filtrovat podle funkce:**

```bash
firebase functions:log --only onSubscriptionExpired
firebase functions:log --only onSubscriptionActivated
firebase functions:log --only checkExpiredSubscriptions
```

---

### **Důležité log messages:**

**onSubscriptionExpired:**
```
🔔 Subscription změna detekována
⚠️ Předplatné vypršelo! Deaktivuji inzeráty
📝 Nalezeno X aktivních inzerátů k deaktivaci
✅ Úspěšně deaktivováno X inzerátů
```

**onSubscriptionActivated:**
```
🎉 Předplatné aktivováno! Reaktivuji inzeráty
📝 Nalezeno X inzerátů k reaktivaci
✅ Úspěšně reaktivováno X inzerátů
```

**checkExpiredSubscriptions:**
```
🕐 Spouštím kontrolu expirovaných předplatných
📊 Kontroluji X uživatelů
⚠️ Uživatel {userId} nemá platné předplatné
✅ Kontrola dokončena. Celkem deaktivováno: X inzerátů
```

---

## 🔒 Firestore Security Rules

Cloud Functions běží s **admin právy**, takže **NEMUSÍŠ měnit** Firestore Security Rules.

Funkce mohou číst a zapisovat jakákoliv data bez omezení.

---

## 💰 Náklady

### **Odhad pro malý/střední projekt:**

**Předpoklady:**
- 100 aktivních uživatelů
- 10 expirací předplatného denně
- 1 scheduled funkce každou hodinu

**Invocations:**
- `onSubscriptionExpired`: ~10/den = 300/měsíc
- `onSubscriptionActivated`: ~10/den = 300/měsíc
- `checkExpiredSubscriptions`: 24/den = 720/měsíc
- **Celkem: ~1,320 invocations/měsíc**

**Náklady:**
- ✅ 0 Kč (pod free tier limitem 2M invocations)

**Pro větší projekty:**
- 100,000 invocations = $0.40
- 1M invocations = $4.00

---

## 🐛 Troubleshooting

### **Problém 1: Funkce se nespouští**

**Řešení:**
1. Zkontroluj deployment:
   ```bash
   firebase functions:list
   ```

2. Zkontroluj logy pro chyby:
   ```bash
   firebase functions:log
   ```

3. Zkontroluj Firestore cesty:
   - Funkce poslouchá: `customers/{userId}/subscriptions/{subId}`
   - Ujisti se, že Stripe Extension zapisuje do této cesty

---

### **Problém 2: Permission denied**

**Řešení:**
- Cloud Functions používají **Firebase Admin SDK** s plnými právy
- Pokud vidíš permission denied, zkontroluj:
  1. Zda je `firebase-admin` správně inicializovaný
  2. Zda projekt má správně nastavené IAM permissions

---

### **Problém 3: Funkce se spouští vícekrát**

**Řešení:**
- `onUpdate` trigger se spustí při **každé změně** dokumentu
- Funkce obsahuje kontrolu pro prevenci duplicitních deaktivací:
  ```typescript
  if (wasAlreadyExpired && isStatusExpired && before.status === after.status) {
    return null; // Přeskočit
  }
  ```

---

### **Problém 4: Vysoké náklady**

**Řešení:**
1. Vypni `checkExpiredSubscriptions` (záložní funkci):
   ```bash
   firebase functions:delete checkExpiredSubscriptions
   ```

2. Primární funkce (`onSubscriptionExpired`) jsou efektivnější a stačí.

---

## 📝 Struktura souborů

```
functions/
├── src/
│   └── index.ts           # Cloud Functions kód
├── lib/                   # Zkompilovaný JavaScript (gitignore)
│   └── index.js
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript konfigurace
└── .eslintrc.js          # ESLint pravidla (volitelné)
```

---

## ✅ Checklist pro nasazení

- [ ] Firebase projekt je nastavený (`firebase use`)
- [ ] Blaze plán je aktivní (nebo ověřeno, že free tier stačí)
- [ ] Dependencies instalovány (`npm install`)
- [ ] TypeScript zkompilován (`npm run build`)
- [ ] Funkce nasazeny (`npm run deploy`)
- [ ] Funkce viditelné v konzoli (https://console.firebase.google.com)
- [ ] Logy sledovány pro ověření funkčnosti
- [ ] Testovací expirace provedena
- [ ] Dokumentace přečtena ✅

---

## 🎉 Hotovo!

Po nasazení budou inzeráty **automaticky deaktivovány** během několika sekund po expiraci předplatného, **bez nutnosti** aby se uživatel přihlásil na web.

**Žádné další kroky nejsou potřeba** - funkce běží automaticky na pozadí.

---

## 📚 Další zdroje

- [Firebase Cloud Functions dokumentace](https://firebase.google.com/docs/functions)
- [Firestore Triggers](https://firebase.google.com/docs/functions/firestore-events)
- [Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
