# Oprava Cloud Function pro email o změně údajů

## Problém
Při registraci se posílá email o změně údajů v profilu, i když by se posílat neměl. Email by se měl posílat pouze při manuální změně údajů v nastavení.

## Řešení

Cloud Function, která posílá emaily o změně údajů v profilu, musí kontrolovat následující flagy:

### 1. Kontrola flagu `_skipChangeNotification`
- Pokud je `_skipChangeNotification: true` → **NEPOSÍLAT email**
- Tento flag se nastavuje při registraci

### 2. Kontrola flagu `_userInitiatedChange`
- Pokud je `_userInitiatedChange: true` → **POSÍLAT email**
- Tento flag se nastavuje při manuální změně v nastavení

### 3. Kontrola, zda se jedná o nový dokument
- Pokud se jedná o vytvoření nového dokumentu (onCreate) → **NEPOSÍLAT email**
- Email se má posílat pouze při aktualizaci existujícího dokumentu (onUpdate)

## Příklad implementace v Cloud Function

```javascript
exports.onProfileUpdate = functions.firestore
  .document('users/{userId}/profile/profile')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Pokud je flag _skipChangeNotification nastaven na true, neposílat email
    if (after._skipChangeNotification === true) {
      console.log('Skipping email notification - registration or automatic update');
      return null;
    }
    
    // Pokud není flag _userInitiatedChange nastaven, neposílat email
    if (after._userInitiatedChange !== true) {
      console.log('Skipping email notification - not user initiated');
      return null;
    }
    
    // Poslat email o změně údajů
    // ... kód pro odeslání emailu ...
    
    // Po odeslání emailu odstranit flagy
    await change.after.ref.update({
      _userInitiatedChange: null,
      _skipChangeNotification: null
    });
  });
```

## Důležité poznámky

1. **Při registraci** se nastavuje `_skipChangeNotification: true` v root dokumentu i v profilu
2. **Při manuální změně** v nastavení se nastavuje `_userInitiatedChange: true` a odstraňuje se `_skipChangeNotification`
3. Cloud Function musí kontrolovat **oba flagy** před odesláním emailu
4. Po odeslání emailu se flagy **odstraní** (nastaví na `null`)

## Kontrola v root dokumentu

Cloud Function by měla také kontrolovat root dokument `users/{userId}`, pokud tam posílá emaily:

```javascript
exports.onUserUpdate = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    
    // Pokud je flag _skipChangeNotification nastaven na true, neposílat email
    if (after._skipChangeNotification === true) {
      console.log('Skipping email notification - registration');
      return null;
    }
    
    // ... zbytek kódu ...
  });
```
