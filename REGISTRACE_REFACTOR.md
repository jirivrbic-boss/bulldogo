# Refaktor registrace - Sjednocení a oprava bugů

## Problém
Registrace přes Cloud OTP vytvářela auth uživatele, ale Firestore profil se neukládal konzistentně ze všech stránek. Některé modaly zapisovaly do DB, jiné ne.

## Root Cause
1. **Data z formuláře se ztrácela mezi fázemi**: Data se četla z DOM v momentě kliknutí na tlačítko, ale pokud došlo k unmountu modalu nebo redirectu před dokončením Firestore zápisu, data byla ztracena.
2. **afterLoginCallback se volal předčasně**: `onAuthStateChanged` se spustil hned po vytvoření auth uživatele a zavolal callback, který reloadoval stránku dřív, než se dokončil Firestore zápis.
3. **Chybějící error handling**: Některé catch bloky nebyly logovány nebo zobrazovány uživateli (silent fails).

## Implementované řešení

### 1. Centralizovaná služba pro profily (`lib/userProfileService.js`)
- `ensureUserProfile(uid, payload)` - fail-safe mechanismus pro vytvoření/aktualizaci profilu
- `saveUserProfile(uid, payload)` - kompletní uložení profilu s validací
- Detailní logging všech operací
- Ověření uložení po zápisu

### 2. Uložení dat do sessionStorage
- Data formuláře se ukládají do `sessionStorage` před odesláním OTP
- Data přežijí unmount modalu, redirect nebo route change
- Po úspěšné registraci se sessionStorage vyčistí
- Při chybě zůstávají data v sessionStorage pro retry

### 3. Flag `_registrationInProgress`
- Zabrání předčasnému volání `afterLoginCallback` z `onAuthStateChanged`
- Callback se zavolá až po dokončení Firestore zápisu
- Zajišťuje, že reload stránky neproběhne dřív, než se profil uloží

### 4. Detailní logging
- Všechny registrační operace logují: pathname, hash, uid, error details
- Formát: `[REGISTER]` nebo `[AUTH]` prefix pro snadné filtrování
- Žádné silent fails - všechny chyby se logují a zobrazují

### 5. Retry mechanismus
- Pokud Firestore zápis selže, zobrazí se tlačítko "Zkusit znovu uložit profil"
- Tlačítko načte data z sessionStorage a zkusí uložit znovu
- Modal se nezavře automaticky při chybě

### 6. ensureUserProfile při přihlášení
- Po každém přihlášení se automaticky zkontroluje a případně vytvoří profil
- Opraví i existující účty, které byly vytvořeny bez profilu

## Změny v souborech

### Nové soubory
- `lib/userProfileService.js` - centralizovaná služba pro profily

### Upravené soubory
- `auth.js` - refaktor registračního flow, přidání sessionStorage, retry mechanismus
- `index.html` - přidáno načítání `userProfileService.js`
- `create-ad.html` - přidáno načítání `userProfileService.js`

## Test scénáře

### 1. Registrace z homepage
1. Otevřít `/#registrace`
2. Vyplnit formulář (osoba/firma)
3. Odeslat OTP
4. Ověřit kód
5. ✅ Ověřit v Firestore: `users/{uid}` a `users/{uid}/profile/profile` existují

### 2. Registrace z create-ad.html
1. Otevřít `/create-ad.html#registrace`
2. Vyplnit formulář
3. Odeslat OTP
4. Ověřit kód
5. ✅ Ověřit v Firestore: `users/{uid}` a `users/{uid}/profile/profile` existují
6. ✅ Stránka se NEPŘESMĚRUJE dřív, než se profil uloží

### 3. Přihlášení existujícího uživatele bez profilu
1. Přihlásit se přes OTP uživatelem, který má auth, ale nemá Firestore profil
2. ✅ `ensureUserProfile` automaticky vytvoří profil

### 4. Retry při chybě
1. Simulovat Firestore chybu (např. permission-denied)
2. ✅ Zobrazí se tlačítko "Zkusit znovu uložit profil"
3. Kliknout na tlačítko
4. ✅ Profil se uloží

## Logging

Všechny operace logují do konzole s prefixy:
- `[REGISTER]` - registrační operace
- `[AUTH]` - auth operace
- `[USER PROFILE SERVICE]` - operace s profily
- `[AUTH MODAL]` - operace s modalem

Příklad logu:
```
[REGISTER] 📍 route: /create-ad.html hash: #registrace
[REGISTER] 💾 Ukládám data formuláře do sessionStorage před OTP
[REGISTER] ✅ OTP verified uid: abc123 phone: +420123456789
[REGISTER] 💾 Ukládám data do databáze přes userProfileService...
[USER PROFILE SERVICE] 💾 saveUserProfile spuštěno z: /create-ad.html
[REGISTER] ✅ Registrace úspěšně dokončena - DB zápis ověřen
```

## Acceptance Criteria ✅

- ✅ Registrace z homepage vytvoří Auth uživatele + Firestore profil
- ✅ Registrace z `/create-ad.html` vytvoří Auth uživatele + Firestore profil
- ✅ Přímé URL `/create-ad.html#registrace` funguje
- ✅ Pokud existuje uživatel v Auth bez Firestore profilu, po přihlášení se profil automaticky vytvoří
- ✅ Žádný silent fail: pokud Firestore zápis selže, vidím error v UI i konzoli
- ✅ Data formuláře přežijí unmount modalu/redirect díky sessionStorage
- ✅ Retry mechanismus umožní znovu uložit profil při chybě
