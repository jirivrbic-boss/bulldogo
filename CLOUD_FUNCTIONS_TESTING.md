# 🧪 Testovací scénáře pro Cloud Functions

## Scénář 1: Expirace předplatného při půlnoci

### **Časová osa:**
```
23:59:00 - Uživatel má aktivní předplatné
           - Subscription: status='active', current_period_end='2026-01-31 23:59:59'
           - Inzeráty: 3x status='active'

00:00:00 - Předplatné končí

00:00:15 - Stripe webhook se spustí
           - Změní subscription dokument v Firestore

00:00:16 - onSubscriptionExpired trigger se aktivuje
           - Funkce detekuje expiraci
           - Najde 3 aktivní inzeráty
           - Batch update na 'inactive'

00:00:17 - Hotovo ✅
           - Všechny inzeráty: status='inactive', inactiveReason='plan_expired'
```

### **Testování v Firebase Console:**

1. Otevři Firestore v konzoli
2. Najdi `customers/{userId}/subscriptions/{subId}`
3. Změň `current_period_end` na datum v minulosti:
   ```
   current_period_end: 2026-01-01 00:00:00
   ```
4. Sleduj logy:
   ```bash
   firebase functions:log --only onSubscriptionExpired
   ```
5. Zkontroluj `users/{userId}/inzeraty/` - měly by být `inactive`

---

## Scénář 2: Uživatel obnoví předplatné

### **Časová osa:**
```
10:00:00 - Předplatné vypršelo včera
           - Subscription: status='expired'
           - Inzeráty: 3x status='inactive', inactiveReason='plan_expired'

10:05:00 - Uživatel si zakoupí nové předplatné
           - Stripe vytvoří novou subscription nebo obnoví starou

10:05:10 - Stripe webhook aktualizuje Firestore
           - status='active', current_period_end='2027-02-01 23:59:59'

10:05:11 - onSubscriptionActivated trigger se aktivuje
           - Funkce detekuje aktivaci
           - Najde 3 inzeráty s inactiveReason='plan_expired'
           - Batch update na 'active'

10:05:12 - Hotovo ✅
           - Všechny inzeráty: status='active'
           - inactiveReason a inactiveAt odstraněny
```

### **Testování v Firebase Console:**

1. Otevři Firestore v konzoli
2. Najdi `customers/{userId}/subscriptions/{subId}`
3. Změň na aktivní stav:
   ```
   status: 'active'
   current_period_end: 2027-12-31 23:59:59
   ```
4. Sleduj logy:
   ```bash
   firebase functions:log --only onSubscriptionActivated
   ```
5. Zkontroluj `users/{userId}/inzeraty/` - měly by být `active`

---

## Scénář 3: Záložní scheduled funkce

### **Časová osa:**
```
Každou hodinu (např. 14:00, 15:00, 16:00...)

14:00:00 - checkExpiredSubscriptions se spustí
           - Načte všechny uživatele z 'customers'
           - Pro každého zkontroluje předplatné

14:00:05 - Najde uživatele bez platného předplatného
           - userId='user123'
           - Nemá žádnou aktivní subscription s valid period_end

14:00:06 - Najde aktivní inzeráty uživatele
           - 2x status='active'

14:00:07 - Batch update na 'inactive'

14:00:08 - Hotovo ✅
           - Log: "Celkem deaktivováno: 2 inzerátů"
```

### **Testování:**

Scheduled funkce běží automaticky každou hodinu. Pro okamžité testování:

**Metoda 1: Firebase Console**
1. Jdi na https://console.firebase.google.com
2. Functions → `checkExpiredSubscriptions`
3. Klikni "Run now" nebo "Test function"

**Metoda 2: Functions Shell**
```bash
cd functions
npm run shell

# V shellu:
checkExpiredSubscriptions()
```

**Metoda 3: Změň schedule (pro testing)**
```typescript
// V src/index.ts, dočasně změň:
.schedule('every 1 hours')
// na:
.schedule('every 5 minutes')

// Pak deploy:
npm run deploy
```

---

## Scénář 4: Edge case - Duplicitní trigger

### **Problém:**
Subscription dokument se změní vícekrát rychle za sebou (např. Stripe webhook retry).

### **Ochrana:**
```typescript
// Funkce kontroluje zda už byl deaktivován:
const wasAlreadyExpired = expiredStatuses.includes(before.status);
if (wasAlreadyExpired && isStatusExpired && before.status === after.status) {
  console.log('⏭️ Předplatné bylo již expirované, přeskakuji deaktivaci');
  return null;
}
```

### **Testování:**

1. Manuálně změň subscription dokument 2x:
   - První změna: `status: 'expired'`
   - Počkej 3 sekundy
   - Druhá změna: `status: 'expired'` (stejné)

2. Sleduj logy - měla by být vidět zpráva:
   ```
   ⏭️ Předplatné bylo již expirované, přeskakuji deaktivaci
   ```

3. Zkontroluj počet batch updates - měl by být jen **1**, ne 2.

---

## Scénář 5: Uživatel má mix inzerátů

### **Stav před expirací:**
```
users/user123/inzeraty/
  ├── ad1 → status: 'active'     (normální inzerát)
  ├── ad2 → status: 'active'     (normální inzerát)
  ├── ad3 → status: 'inactive'   (ručně pozastavený)
  ├── ad4 → status: 'paused'     (jiný důvod)
  └── ad5 → status: 'active'     (normální inzerát)
```

### **Po expiraci:**
```
users/user123/inzeraty/
  ├── ad1 → status: 'inactive', inactiveReason: 'plan_expired' ✅
  ├── ad2 → status: 'inactive', inactiveReason: 'plan_expired' ✅
  ├── ad3 → status: 'inactive'   (beze změny) ✅
  ├── ad4 → status: 'paused'     (beze změny) ✅
  └── ad5 → status: 'inactive', inactiveReason: 'plan_expired' ✅
```

**Co se stalo:**
- ✅ Pouze `status='active'` inzeráty byly deaktivovány
- ✅ Inzeráty s jiným statusem nebyly dotčeny
- ✅ Přidán `inactiveReason` pouze pro nově deaktivované

### **Po reaktivaci:**
```
users/user123/inzeraty/
  ├── ad1 → status: 'active' ✅ (reaktivován)
  ├── ad2 → status: 'active' ✅ (reaktivován)
  ├── ad3 → status: 'inactive' ✅ (NEBYL reaktivován - nemá inactiveReason='plan_expired')
  ├── ad4 → status: 'paused' ✅ (NEBYL reaktivován)
  └── ad5 → status: 'active' ✅ (reaktivován)
```

**Co se stalo:**
- ✅ Pouze inzeráty s `inactiveReason='plan_expired'` byly reaktivovány
- ✅ Ručně pozastavené inzeráty zůstaly neaktivní
- ✅ Důvody deaktivace (`inactiveReason`, `inactiveAt`) odstraněny

---

## 🔍 Monitoring očekávaných logů

### **onSubscriptionExpired - Úspěšná expirace:**
```
🔔 Subscription změna detekována: {userId: 'user123', subId: 'sub_abc', statusBefore: 'active', statusAfter: 'expired', periodEnd: 2026-01-31T23:59:59.000Z}
⚠️ Předplatné vypršelo! Deaktivuji inzeráty uživatele: user123
📝 Nalezeno 3 aktivních inzerátů k deaktivaci
✅ Úspěšně deaktivováno 3 inzerátů pro uživatele user123
```

### **onSubscriptionExpired - Žádné inzeráty:**
```
🔔 Subscription změna detekována: {userId: 'user456', ...}
⚠️ Předplatné vypršelo! Deaktivuji inzeráty uživatele: user456
ℹ️ Uživatel nemá žádné aktivní inzeráty k deaktivaci
```

### **onSubscriptionExpired - Stále aktivní:**
```
🔔 Subscription změna detekována: {userId: 'user789', statusBefore: 'active', statusAfter: 'active', periodEnd: 2027-12-31T23:59:59.000Z}
✅ Předplatné je stále aktivní, žádná akce není potřeba
```

### **onSubscriptionActivated - Úspěšná aktivace:**
```
🎉 Předplatné aktivováno! Reaktivuji inzeráty uživatele: user123
📝 Nalezeno 3 inzerátů k reaktivaci
✅ Úspěšně reaktivováno 3 inzerátů pro uživatele user123
```

### **checkExpiredSubscriptions - Hodinová kontrola:**
```
🕐 Spouštím kontrolu expirovaných předplatných...
📊 Kontroluji 50 uživatelů...
⚠️ Uživatel user123 nemá platné předplatné, deaktivuji 2 inzeráty
⚠️ Uživatel user456 nemá platné předplatné, deaktivuji 1 inzerátů
✅ Kontrola dokončena. Celkem deaktivováno: 3 inzerátů
```

---

## ⚠️ Chybové stavy a troubleshooting

### **Chyba 1: Permission denied**
```
❌ Chyba při deaktivaci inzerátů: Error: Missing or insufficient permissions
```

**Příčina:** Firestore Security Rules blokují zápis

**Řešení:** Cloud Functions používají Admin SDK - měly by mít plná práva.
Zkontroluj, zda je `admin.initializeApp()` správně zavoláno.

---

### **Chyba 2: Funkce se nespouští**
```
(žádné logy)
```

**Příčina:** Trigger není správně nasazený nebo cesta se neshoduje

**Řešení:**
1. Zkontroluj deployment:
   ```bash
   firebase functions:list
   ```
2. Zkontroluj cestu dokumentu - měla by být přesně:
   ```
   customers/{userId}/subscriptions/{subId}
   ```
3. Zkontroluj Stripe Extension config - zapisuje do správné cesty?

---

### **Chyba 3: Funkce se spouští příliš často**
```
🔔 Subscription změna detekována (10x během minuty)
```

**Příčina:** Stripe webhook se opakuje nebo dokument se mění moc často

**Řešení:** Funkce má built-in ochranu proti duplicitním deaktivacím.
Měla by logovat:
```
⏭️ Předplatné bylo již expirované, přeskakuji deaktivaci
```

---

## 📊 Očekávané metriky

### **Pro malý projekt (100 uživatelů):**
- `onSubscriptionExpired`: ~10 invocations/den
- `onSubscriptionActivated`: ~5 invocations/den
- `checkExpiredSubscriptions`: 24 invocations/den
- **Celkem: ~39 invocations/den = ~1,170/měsíc**

### **Pro střední projekt (1,000 uživatelů):**
- `onSubscriptionExpired`: ~100 invocations/den
- `onSubscriptionActivated`: ~50 invocations/den
- `checkExpiredSubscriptions`: 24 invocations/den
- **Celkem: ~174 invocations/den = ~5,220/měsíc**

Všechny scénáře jsou **pod free tier limitem** (2M invocations).

---

## ✅ Checklist pro ověření

Po nasazení zkontroluj:

- [ ] Funkce jsou viditelné v Firebase Console
- [ ] Logy obsahují "Subscription změna detekována"
- [ ] Testovací expirace deaktivuje inzeráty během < 10 sekund
- [ ] Testovací reaktivace aktivuje inzeráty během < 10 sekund
- [ ] Scheduled funkce běží každou hodinu (zkontroluj logy)
- [ ] Žádné chyby v logech
- [ ] Inzeráty mají správný `inactiveReason`
- [ ] Duplicitní triggery jsou ignorovány
- [ ] services.html nezobrazuje inzeráty expirovaných uživatelů

---

Hotovo! 🎉
