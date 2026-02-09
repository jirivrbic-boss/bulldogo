# 📊 Architektura a tok dat - Cloud Functions

## 🔄 Diagram toku dat

```
┌─────────────────────────────────────────────────────────────────┐
│                         STRIPE WEBHOOK                          │
│  (když předplatné vyprší nebo se obnoví)                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STRIPE EXTENSION                               │
│  Zapisuje subscription data do Firestore:                       │
│  customers/{userId}/subscriptions/{subId}                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼ (Firestore onUpdate trigger)
┌─────────────────────────────────────────────────────────────────┐
│              CLOUD FUNCTION #1                                  │
│         onSubscriptionExpired                                   │
│                                                                 │
│  IF: status='expired' OR current_period_end < now              │
│  THEN:                                                          │
│    1. Najít users/{userId}/inzeraty WHERE status='active'      │
│    2. Batch update:                                             │
│       - status = 'inactive'                                     │
│       - inactiveReason = 'plan_expired'                        │
│       - inactiveAt = serverTimestamp()                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              FIRESTORE DATABASE                                 │
│  users/{userId}/inzeraty/{adId}                                │
│    - status: 'inactive'                                         │
│    - inactiveReason: 'plan_expired'                            │
│    - inactiveAt: timestamp                                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼ (Real-time listener)
┌─────────────────────────────────────────────────────────────────┐
│              services.html (FRONTEND)                           │
│                                                                 │
│  onSnapshot listener detekuje změnu                            │
│  Filtr: hasActivePlan && status === 'active'                   │
│  Výsledek: Inzerát SE NEZOBRAZÍ                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Reaktivační tok

```
┌─────────────────────────────────────────────────────────────────┐
│                    UŽIVATEL SI KOUPÍ PŘEDPLATNÉ                 │
│                  (přes Stripe Checkout)                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STRIPE WEBHOOK                          │
│  (subscription.updated nebo subscription.created)               │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STRIPE EXTENSION                               │
│  Aktualizuje subscription dokument:                             │
│    - status = 'active'                                          │
│    - current_period_end = budoucí datum                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼ (Firestore onUpdate trigger)
┌─────────────────────────────────────────────────────────────────┐
│              CLOUD FUNCTION #2                                  │
│         onSubscriptionActivated                                 │
│                                                                 │
│  IF: status IN ['active','trialing'] AND period_end > now      │
│  THEN:                                                          │
│    1. Najít users/{userId}/inzeraty WHERE                      │
│       status='inactive' AND inactiveReason='plan_expired'      │
│    2. Batch update:                                             │
│       - status = 'active'                                       │
│       - DELETE inactiveReason                                   │
│       - DELETE inactiveAt                                       │
│       - reactivatedAt = serverTimestamp()                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              FIRESTORE DATABASE                                 │
│  users/{userId}/inzeraty/{adId}                                │
│    - status: 'active'                                           │
│    - reactivatedAt: timestamp                                   │
│    (inactiveReason a inactiveAt odstraněny)                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼ (Real-time listener)
┌─────────────────────────────────────────────────────────────────┐
│              services.html (FRONTEND)                           │
│                                                                 │
│  onSnapshot listener detekuje změnu                            │
│  Filtr: hasActivePlan && status === 'active'                   │
│  Výsledek: Inzerát SE ZOBRAZÍ                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏰ Záložní scheduled funkce

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE SCHEDULER                           │
│               (spouští se každou hodinu)                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUD FUNCTION #3                                  │
│        checkExpiredSubscriptions                                │
│                                                                 │
│  FOR EACH user IN customers:                                    │
│    1. Zkontrolovat subscription                                 │
│    2. IF nemá platné předplatné:                               │
│       - Najít aktivní inzeráty                                  │
│       - Batch update na 'inactive'                              │
│                                                                 │
│  Slouží jako BACKUP pro případ selhání trigger funkcí          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architektura komponent

```
┌─────────────────────────────────────────────────────────────────┐
│                         KLIENT (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ services.html │  │ my-ads.html  │  │ auth.js      │         │
│  │              │  │              │  │              │         │
│  │ Real-time    │  │ LoadUserAds  │  │ checkUser    │         │
│  │ listener     │  │ + Grace      │  │ Subscription │         │
│  │ + filtr      │  │ period       │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼ (Firestore JS SDK)
┌─────────────────────────────────────────────────────────────────┐
│                    FIRESTORE DATABASE                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Collection: customers/{userId}/subscriptions/{subId}      │ │
│  │   - status: 'active' | 'expired' | 'canceled' | ...       │ │
│  │   - current_period_end: timestamp                         │ │
│  │   - created: timestamp                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Collection: users/{userId}/inzeraty/{adId}                │ │
│  │   - status: 'active' | 'inactive' | 'paused'              │ │
│  │   - inactiveReason: 'plan_expired' | null                 │ │
│  │   - inactiveAt: timestamp | null                          │ │
│  │   - reactivatedAt: timestamp | null                       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼ (Firestore Triggers + Scheduled)
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUD FUNCTIONS (Server)                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ onSubscriptionExpired                                     │  │
│  │   Trigger: Firestore onUpdate                            │  │
│  │   Path: customers/{userId}/subscriptions/{subId}         │  │
│  │   Action: Deaktivovat aktivní inzeráty                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ onSubscriptionActivated                                   │  │
│  │   Trigger: Firestore onUpdate                            │  │
│  │   Path: customers/{userId}/subscriptions/{subId}         │  │
│  │   Action: Reaktivovat expirované inzeráty                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ checkExpiredSubscriptions                                 │  │
│  │   Trigger: Scheduled (every 1 hours)                     │  │
│  │   Action: Záložní kontrola všech uživatelů               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     STRIPE (External)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Checkout    │  │  Webhooks    │  │  Dashboard   │         │
│  │  Session     │  │  Events      │  │  Management  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Stavy inzerátu

```
┌─────────────────────────────────────────────────────────────────┐
│                         STAVY INZERÁTU                          │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   ACTIVE     │ ← Normální stav s platným předplatným
    └──────┬───────┘
           │
           │ Předplatné vyprší
           │ (Cloud Function)
           ▼
    ┌──────────────┐
    │  INACTIVE    │ ← inactiveReason: 'plan_expired'
    │ (plan_expired)│
    └──────┬───────┘
           │
           │ Předplatné obnoveno
           │ (Cloud Function)
           ▼
    ┌──────────────┐
    │   ACTIVE     │ ← reactivatedAt: timestamp
    └──────────────┘

Jiné stavy (nedotčené funkcemi):
    ┌──────────────┐
    │  INACTIVE    │ ← Ručně pozastavený uživatelem
    │ (user_paused) │   (nebude reaktivován automaticky)
    └──────────────┘

    ┌──────────────┐
    │   PAUSED     │ ← Jiný důvod pozastavení
    └──────────────┘   (nebude dotčen funkcemi)
```

---

## 🔐 Security Rules (nezměněno)

```
┌─────────────────────────────────────────────────────────────────┐
│                   FIRESTORE SECURITY RULES                      │
│                                                                 │
│  Client (Browser):                                              │
│    ✅ Může ČÍST: users/{userId}/inzeraty (své i cizí)          │
│    ✅ Může PSÁT: users/{userId}/inzeraty (pouze své)           │
│    ❌ Nemůže PSÁT: customers/{userId}/subscriptions            │
│                                                                 │
│  Cloud Functions:                                               │
│    ✅ ADMIN PRÁVA - může VŠECHNO                               │
│    ✅ Obchází Security Rules                                   │
│    ✅ Může upravit inzeráty JAKÉHOKOLIV uživatele             │
│                                                                 │
│  Stripe Extension:                                              │
│    ✅ ADMIN PRÁVA - může VŠECHNO                               │
│    ✅ Zapisuje do customers/{userId}/subscriptions             │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ Časování a latence

```
┌─────────────────────────────────────────────────────────────────┐
│                      ČASOVÁ OSA UDÁLOSTÍ                        │
└─────────────────────────────────────────────────────────────────┘

T+0ms    │ Předplatné vyprší v Stripe
         │
T+500ms  │ Stripe webhook se spustí
         │
T+1000ms │ Stripe Extension zapisuje do Firestore
         │
T+1100ms │ Firestore onUpdate trigger aktivuje funkci
         │
T+1200ms │ Cloud Function načte aktivní inzeráty (query)
         │
T+1300ms │ Cloud Function provede batch update
         │
T+1400ms │ Firestore commit změn
         │
T+1500ms │ Real-time listener na services.html detekuje změnu
         │
T+1600ms │ UI se aktualizuje - inzerát zmizí
         │
         ▼

CELKOVÁ LATENCE: ~1.5-5 sekund
```

---

## 💰 Cost breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                        NÁKLADY NA MĚSÍC                         │
└─────────────────────────────────────────────────────────────────┘

Předpoklady:
- 100 aktivních uživatelů
- 10% churn rate (10 expirací/měsíc)
- 5 reaktivací/měsíc

Cloud Functions invocations:
┌────────────────────────────────┬──────────┬────────────────┐
│ Funkce                         │ Freq.    │ Total/měsíc    │
├────────────────────────────────┼──────────┼────────────────┤
│ onSubscriptionExpired          │ 10/měs.  │ 10             │
│ onSubscriptionActivated        │ 5/měs.   │ 5              │
│ checkExpiredSubscriptions      │ 24/den   │ 720            │
├────────────────────────────────┴──────────┼────────────────┤
│ CELKEM                                     │ 735 invocations│
└────────────────────────────────────────────┴────────────────┘

Free tier: 2,000,000 invocations/měsíc
Využití: 735 / 2,000,000 = 0.04%

💰 NÁKLADY: 0 Kč
```

---

## 📈 Škálování

```
┌─────────────────────────────────────────────────────────────────┐
│                    ŠKÁLOVÁNÍ S RŮSTEM                           │
└─────────────────────────────────────────────────────────────────┘

100 uživatelů:
  Invocations: ~735/měsíc
  Náklady: 0 Kč (free tier)

1,000 uživatelů:
  Invocations: ~5,220/měsíc
  Náklady: 0 Kč (free tier)

10,000 uživatelů:
  Invocations: ~52,200/měsíc
  Náklady: 0 Kč (free tier)

100,000 uživatelů:
  Invocations: ~522,000/měsíc
  Náklady: ~8 Kč (0.04 * 100,000 * $0.40/million * 25 Kč/$)

1,000,000 uživatelů:
  Invocations: ~5,220,000/měsíc
  Náklady: ~800 Kč

Poznámka: Pro velké projekty lze vypnout scheduled funkci
a ušetřit 720 invocations/měsíc (99% všech volání).
```

---

Tento diagram poskytuje kompletní vizuální přehled architektury! 🎉
