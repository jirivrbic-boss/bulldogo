# 🚀 Rychlé příkazy pro Cloud Functions

## Deployment

### Deploy všech funkcí
```bash
./deploy-functions.sh
```

Nebo manuálně:
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### Deploy konkrétní funkce
```bash
firebase deploy --only functions:onSubscriptionExpired
firebase deploy --only functions:onSubscriptionActivated
firebase deploy --only functions:checkExpiredSubscriptions
```

---

## Testování

### Lokální emulátory
```bash
cd functions
npm run serve
```
Otevře: http://localhost:4000

### Functions shell (interaktivní testování)
```bash
cd functions
npm run shell

# V shellu:
> checkExpiredSubscriptions()
```

---

## Monitoring

### Sledování logů (všechny funkce)
```bash
firebase functions:log
```

### Sledování konkrétní funkce
```bash
firebase functions:log --only onSubscriptionExpired
firebase functions:log --only onSubscriptionActivated
firebase functions:log --only checkExpiredSubscriptions
```

### Real-time logy
```bash
firebase functions:log --follow
```

---

## Build a Lint

### Build TypeScript
```bash
cd functions
npm run build
```

### Lint kontrola
```bash
cd functions
npm run lint
```

### Lint fix
```bash
cd functions
npm run lint -- --fix
```

---

## Firebase Management

### Seznam funkcí
```bash
firebase functions:list
```

### Smazání funkce
```bash
firebase functions:delete onSubscriptionExpired
firebase functions:delete onSubscriptionActivated
firebase functions:delete checkExpiredSubscriptions
```

### Konfigurace prostředí
```bash
firebase functions:config:set someservice.key="THE API KEY"
firebase functions:config:get
```

---

## Debugging

### Zobrazit chyby
```bash
firebase functions:log --only onSubscriptionExpired | grep "ERROR"
```

### Zobrazit logy za posledních 5 minut
```bash
firebase functions:log --since 5m
```

### Zobrazit pouze chyby
```bash
firebase functions:log --only "ERROR"
```

---

## Projekty

### Zobrazit aktuální projekt
```bash
firebase projects:list
```

### Přepnout projekt
```bash
firebase use projekt-alias
```

### Přidat projekt
```bash
firebase use --add
```

---

## Užitečné zkratky

### Celý deploy workflow
```bash
cd functions && npm install && npm run build && firebase deploy --only functions
```

### Build + Lint + Deploy
```bash
cd functions && npm run build && npm run lint && firebase deploy --only functions
```

### Quick test
```bash
cd functions && npm run build && npm run serve
```

---

## Troubleshooting

### Problém: "command not found: firebase"
```bash
npm install -g firebase-tools
firebase login
```

### Problém: "Permission denied"
```bash
chmod +x deploy-functions.sh
```

### Problém: "tsc: command not found"
```bash
cd functions
npm install
```

### Problém: "Project is not configured"
```bash
firebase use --add
# Vyber projekt z listu
```

---

## Odkazy

- Firebase Console: https://console.firebase.google.com
- Functions dokumentace: https://firebase.google.com/docs/functions
- Deployment guide: `CLOUD_FUNCTIONS_DEPLOYMENT.md`
- Testing guide: `CLOUD_FUNCTIONS_TESTING.md`
