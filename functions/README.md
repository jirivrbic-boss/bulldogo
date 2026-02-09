# Firebase Cloud Functions

Automatická deaktivace a reaktivace inzerátů při expiraci/obnovení předplatného.

## 🚀 Rychlý start

```bash
# Instalace závislostí
npm install

# Build TypeScript
npm run build

# Deploy do produkce
npm run deploy
```

## 📋 Funkce

### 1. **onSubscriptionExpired**
- Automaticky deaktivuje inzeráty když předplatné vyprší
- Trigger: Změna subscription dokumentu v Firestore
- Reakce: < 5 sekund

### 2. **onSubscriptionActivated**
- Automaticky reaktivuje inzeráty když předplatné je obnoveno
- Trigger: Změna subscription dokumentu v Firestore
- Reakce: < 5 sekund

### 3. **checkExpiredSubscriptions** (záložní)
- Kontroluje expirovaná předplatné každou hodinu
- Trigger: Scheduled (cron)
- Slouží jako backup pro případ selhání trigger funkcí

## 📚 Dokumentace

Kompletní dokumentace: [CLOUD_FUNCTIONS_DEPLOYMENT.md](../CLOUD_FUNCTIONS_DEPLOYMENT.md)

## 🧪 Testování

```bash
# Lokální emulátory
npm run serve

# Sledování logů
firebase functions:log
```

## 📦 Struktura

```
functions/
├── src/
│   └── index.ts      # Cloud Functions kód
├── lib/              # Zkompilovaný JS (gitignored)
├── package.json
└── tsconfig.json
```

## ⚠️ Požadavky

- Firebase Blaze plán (pay-as-you-go)
- Firebase Admin SDK v12+
- Firebase Functions v4.5+
- Node.js 20

## 💰 Náklady

Pro malé až střední projekty: **ZDARMA** (pod free tier limitem)

Free tier: 2M invocations/měsíc

## 📞 Podpora

Při problémech zkontroluj:
1. `firebase functions:log` pro chyby
2. Firebase Console → Functions
3. Dokumentaci výše
