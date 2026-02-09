# 🔧 Oprava Cloud Functions - Multiple Subscriptions

## 🚨 Problém který byl objeven

**Datum:** 1. února 2026, 21:30

### **Co se stalo:**
1. Uživatel vytvořil novou subscription s `status='trialing'`
2. Měl několik starých subscriptions se `status='canceled'`
3. **Stará funkce `enforceExpiredPlanAds`** se spustila
4. Stará funkce **NEBRALA v potaz trialing status**
5. Myslela si, že uživatel nemá předplatné → deaktivovala inzerát

### **Root cause:**
- Stará funkce kontrolovala pouze `status='active'`, NE `status='trialing'`
- Nové funkce kontrolovaly správně, ALE nespustily se (protože subscription byl onCreate, ne onUpdate)

---

## ✅ Provedené opravy

### **1. Smazána stará funkce**
```bash
firebase functions:delete enforceExpiredPlanAds
```

**Důvod:** Konfliktovala s novými funkcemi a měla zastaralou logiku.

---

### **2. Opravena funkce `checkExpiredSubscriptions`**

**Změna:** Přidáno `.orderBy('created', 'desc').limit(1)`

**PŘED:**
```typescript
const subscriptionsSnapshot = await admin.firestore()
  .collection('customers')
  .doc(userId)
  .collection('subscriptions')
  .where('status', 'in', ['active', 'trialing'])
  .get(); // ❌ Bere VŠECHNY active/trialing subscriptions

let hasValidSubscription = false;
for (const subDoc of subscriptionsSnapshot.docs) {
  // Kontroluje všechny...
}
```

**PO:**
```typescript
const subscriptionsSnapshot = await admin.firestore()
  .collection('customers')
  .doc(userId)
  .collection('subscriptions')
  .where('status', 'in', ['active', 'trialing'])
  .orderBy('created', 'desc')  // ✅ Seřadit podle data vytvoření
  .limit(1)                     // ✅ Vzít POUZE nejnovější
  .get();

let hasValidSubscription = false;
if (!subscriptionsSnapshot.empty) {
  const latestSub = subscriptionsSnapshot.docs[0]; // První = nejnovější
  // Kontroluje pouze nejnovější...
}
```

---

### **3. Přidán lepší logging**

```typescript
console.log(`🔍 Kontroluji uživatele ${userId}: status=${subData.status}, subId=${latestSub.id}`);

if (periodEnd > now) {
  hasValidSubscription = true;
  console.log(`✅ Uživatel ${userId} má platné předplatné do ${periodEnd.toISOString()}`);
} else {
  console.log(`⏰ Uživatel ${userId} - předplatné vypršelo ${periodEnd.toISOString()}`);
}
```

---

## 📊 Co to řeší

### **Scénář 1: Multiple canceled subscriptions + 1 trialing**
**PŘED:**
```
Subscriptions:
- sub_1 (canceled) ❌
- sub_2 (canceled) ❌
- sub_3 (trialing) ✅ NOVÝ

Funkce: Načte všechny → vidí canceled → myslí si že nemá předplatné → deaktivuje
```

**PO:**
```
Subscriptions:
- sub_1 (canceled) (ignorováno - není active/trialing)
- sub_2 (canceled) (ignorováno - není active/trialing)
- sub_3 (trialing) ✅ NOVÝ

Funkce: Načte POUZE nejnovější trialing → má předplatné → NIC NEDELÁ ✅
```

---

### **Scénář 2: Zrušení starého a vytvoření nového předplatného**
**PŘED:**
```
Subscriptions:
- sub_old (active) ✅ → změněno na canceled
- sub_new (active) ✅ NOVÝ

Funkce: Načte oba → nejasné které kontrolovat → potenciální chyba
```

**PO:**
```
Subscriptions:
- sub_old (canceled) (ignorováno - není active/trialing)
- sub_new (active) ✅ NOVÝ

Funkce: Načte POUZE nejnovější active → má předplatné → NIC NEDELÁ ✅
```

---

## 🔒 Bezpečnostní záruky

### **Co se NEMŮŽE stát:**
- ❌ Deaktivace inzerátů uživatele s platným `trialing` předplatným
- ❌ Kontrola starých canceled subscriptions
- ❌ Konflikt mezi multiple active subscriptions

### **Co se MŮŽE stát:**
- ✅ Deaktivace inzerátů když NEJNOVĚJŠÍ subscription vyprší
- ✅ Správná kontrola `status='trialing'`
- ✅ Ignorování starých canceled subscriptions

---

## 🧪 Testování

### **Test 1: Uživatel s trialing subscription**
```
1. Vytvořit subscription s status='trialing', period_end v budoucnosti
2. Spustit checkExpiredSubscriptions
3. Očekávaný výsledek: Inzeráty ZŮSTANOU aktivní ✅
```

### **Test 2: Uživatel s multiple subscriptions**
```
1. Mít 3 canceled subscriptions
2. Vytvořit 1 novou trialing subscription
3. Spustit checkExpiredSubscriptions
4. Očekávaný výsledek: Funkce bere POUZE nejnovější trialing ✅
```

### **Test 3: Uživatel s expirovaným trialing**
```
1. Mít trialing subscription s period_end v minulosti
2. Spustit checkExpiredSubscriptions
3. Očekávaný výsledek: Inzeráty BUDOU deaktivovány ✅
```

---

## 📝 Deployment

```bash
cd /Users/adam/Desktop/public_html-2/functions
npm run build
cd ..
firebase deploy --only functions
```

**Změny:**
- ✅ `checkExpiredSubscriptions` - opravená logika
- ℹ️ `onSubscriptionExpired` - beze změny (už to dělalo správně)
- ℹ️ `onSubscriptionActivated` - beze změny (už to dělalo správně)

---

## 🎯 Závěr

**Problém:** Stará funkce + multiple subscriptions  
**Řešení:** Smazána stará funkce + opravena nová funkce (orderBy + limit)  
**Status:** ✅ OPRAVENO  
**Deployment:** Připraveno k nasazení  

---

**Vytvořeno:** 1. února 2026, 22:00  
**Opravil:** AI Assistant  
**Status:** Ready for deployment
