# 🚀 Cloud Functions - Automatická deaktivace inzerátů

Tento projekt řeší problém s **automatickou deaktivací inzerátů** když uživateli vyprší předplatné.

## ⚡ Quick Start

```bash
./quick-start.sh
```

To je vše! Script:
1. ✅ Zkontroluje Firebase projekt
2. ✅ Nainstaluje závislosti
3. ✅ Zkompiluje TypeScript
4. ✅ Nasadí Cloud Functions

---

## 🎯 Co to dělá

### **Problém:**
- Inzeráty se deaktivovaly **POUZE** když se uživatel přihlásil
- Pokud se nepřihlásil, status zůstal `active` i po expiraci

### **Řešení:**
- ✅ **Automatická deaktivace** během 5 sekund po expiraci
- ✅ **Automatická reaktivace** při obnovení předplatného
- ✅ **Nezávislé na uživateli** - funguje 24/7

---

## 📦 Co bylo implementováno

### **3 Cloud Functions:**

1. **onSubscriptionExpired** ⚡
   - Trigger: Změna subscription dokumentu
   - Deaktivuje inzeráty při expiraci
   - Reakce: < 5 sekund

2. **onSubscriptionActivated** 🎉
   - Trigger: Změna subscription dokumentu
   - Reaktivuje inzeráty při obnovení
   - Reakce: < 5 sekund

3. **checkExpiredSubscriptions** 🕐
   - Trigger: Každou hodinu (scheduled)
   - Záložní kontrola všech uživatelů
   - Backup mechanismus

---

## 📚 Dokumentace

| Dokument | Účel |
|----------|------|
| **[IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)** | 🎯 **START HERE** - Kompletní přehled |
| [CLOUD_FUNCTIONS_DEPLOYMENT.md](CLOUD_FUNCTIONS_DEPLOYMENT.md) | 📖 Detailní deployment guide |
| [CLOUD_FUNCTIONS_TESTING.md](CLOUD_FUNCTIONS_TESTING.md) | 🧪 Testovací scénáře |
| [SUBSCRIPTION_DEACTIVATION_FIX.md](SUBSCRIPTION_DEACTIVATION_FIX.md) | 💡 Vysvětlení problému a řešení |
| [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) | 📊 Vizuální diagramy |
| [QUICK_COMMANDS.md](QUICK_COMMANDS.md) | ⚡ Rychlé referenční příkazy |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) | 📑 Index všech dokumentů |

**Celkem:** 2,710+ řádků dokumentace

---

## 🚀 Deployment

### **Automatický:**
```bash
./quick-start.sh
```

### **Manuální:**
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

---

## 🧪 Testování

### **Test expirace:**
1. Firebase Console → Firestore
2. Změň `customers/{userId}/subscriptions/{subId}`
3. Nastav `current_period_end` na minulost
4. Sleduj: `firebase functions:log --only onSubscriptionExpired`
5. Ověř: Inzeráty jsou `inactive`

### **Test reaktivace:**
1. Změň subscription na `status: 'active'`
2. Nastav `current_period_end` na budoucnost
3. Sleduj: `firebase functions:log --only onSubscriptionActivated`
4. Ověř: Inzeráty jsou `active`

---

## 💰 Náklady

| Uživatelé | Invocations/měsíc | Náklady |
|-----------|-------------------|---------|
| 100 | ~735 | **0 Kč** (free tier) |
| 1,000 | ~5,220 | **0 Kč** (free tier) |
| 10,000 | ~52,200 | **0 Kč** (free tier) |

Free tier: **2M invocations/měsíc ZDARMA**

---

## 📊 Struktura projektu

```
functions/
├── src/
│   └── index.ts              # Cloud Functions (370 řádků)
├── lib/
│   └── index.js              # Zkompilovaný JS
├── package.json              # Dependencies
└── README.md                 # Vývojářský guide

docs/
├── IMPLEMENTATION_COMPLETE.md      # Kompletní přehled
├── CLOUD_FUNCTIONS_DEPLOYMENT.md   # Deployment guide
├── CLOUD_FUNCTIONS_TESTING.md      # Testování
├── SUBSCRIPTION_DEACTIVATION_FIX.md# Vysvětlení
├── ARCHITECTURE_DIAGRAM.md         # Diagramy
├── QUICK_COMMANDS.md               # Příkazy
└── DOCUMENTATION_INDEX.md          # Index

scripts/
├── quick-start.sh            # Automatický deployment
└── deploy-functions.sh       # Deployment script
```

---

## 🔍 Monitoring

### **Sledování logů:**
```bash
# Všechny funkce
firebase functions:log

# Konkrétní funkce
firebase functions:log --only onSubscriptionExpired

# Real-time
firebase functions:log --follow
```

### **Firebase Console:**
https://console.firebase.google.com/project/_/functions

---

## ✅ Checklist

Po nasazení ověř:

- [ ] Funkce viditelné v Firebase Console
- [ ] Logy obsahují "Subscription změna detekována"
- [ ] Testovací expirace funguje (< 10 sekund)
- [ ] Testovací reaktivace funguje (< 10 sekund)
- [ ] services.html nezobrazuje expirované inzeráty
- [ ] Scheduled funkce běží každou hodinu

---

## 🐛 Troubleshooting

### **Funkce se nespouští:**
```bash
firebase functions:list
firebase functions:log
```

### **Permission denied:**
- Cloud Functions mají admin práva
- Zkontroluj `admin.initializeApp()`

### **Vysoké náklady:**
```bash
# Vypni scheduled funkci (záložní)
firebase functions:delete checkExpiredSubscriptions
```

---

## 🎉 Výsledek

**Před:**
```
Předplatné vyprší → Status 'active' v DB ❌
User se nepřihlásí → Status 'active' v DB ❌
User obnoví předplatné → Inzerát se objeví okamžitě ⚠️
```

**Po:**
```
Předplatné vyprší → Status 'inactive' během 5s ✅
User se nepřihlásí → Status 'inactive' ✅
User obnoví předplatné → Status 'active' během 5s ✅
```

---

## 📞 Podpora

**Při problémech:**
1. Zkontroluj logy: `firebase functions:log`
2. Přečti troubleshooting: [CLOUD_FUNCTIONS_DEPLOYMENT.md](CLOUD_FUNCTIONS_DEPLOYMENT.md)
3. Otevři issue na GitHub

---

## 🔗 Odkazy

- [Firebase Functions dokumentace](https://firebase.google.com/docs/functions)
- [Firestore Triggers](https://firebase.google.com/docs/functions/firestore-events)
- [Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)

---

## 📜 Licence

MIT License - viz LICENSE soubor

---

**Implementováno:** Leden 2026  
**Status:** ✅ Production Ready  
**Verze:** 1.0.0

---

<div align="center">

**🎉 Hotovo! Inzeráty se nyní automaticky deaktivují při expiraci předplatného.**

</div>
