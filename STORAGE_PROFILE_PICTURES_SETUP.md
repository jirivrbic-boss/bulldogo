# Nastavení Storage Rules pro profilové obrázky

## Problém
Chyba `storage/unauthorized` znamená, že Firebase Storage pravidla nejsou správně nastavena pro profilové obrázky.

## Rychlé řešení (Firebase Console)

### KROK 1: Otevři Firebase Console
1. Jdi na: https://console.firebase.google.com/
2. Vyber projekt **inzerio-inzerce**

### KROK 2: Otevři Storage Rules
1. V levém menu klikni na **Storage**
2. Klikni na záložku **Rules**

### KROK 3: Zkopíruj a vlož pravidla
Zkopíruj celý obsah ze souboru `storage-rules.txt` nebo použij tento kód:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Povolit přihlášeným uživatelům nahrávat obrázky služeb do jejich složek
    match /services/{userId}/{allPaths=**} {
      // Každý může číst obrázky
      allow read: if true;
      
      // Pouze vlastník (userId odpovídá UID) může nahrávat a upravovat
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Povolit přihlášeným uživatelům nahrávat profilové obrázky do jejich složek
    match /profile-pictures/{userId}/{allPaths=**} {
      // Každý může číst profilové obrázky
      allow read: if true;
      
      // Pouze vlastník (userId odpovídá UID) může nahrávat, upravovat a mazat
      allow write: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Výchozí: zakázat přístup
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### KROK 4: Publikuj pravidla
1. Klikni na tlačítko **"Publish"**
2. Počkej 1-2 minuty, než se pravidla aktivují

## Alternativní řešení (pomocí Firebase CLI)

Pokud máš Firebase CLI nainstalovaný:

```bash
firebase deploy --only storage
```

## Ověření

Po publikování pravidel:
1. Obnov stránku v prohlížeči
2. Zkus znovu nahrát profilový obrázek
3. Chyba `storage/unauthorized` by měla zmizet

## Pokud stále vidíš chyby

1. Zkontroluj, že jsi klikl na **"Publish"** (ne jen uložil)
2. Počkej 2-3 minuty (pravidla se aktivují s malým zpožděním)
3. Obnov stránku v prohlížeči (Ctrl+Shift+R)
4. Zkontroluj, že jsi přihlášený jako správný uživatel

