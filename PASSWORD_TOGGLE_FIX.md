# Oprava funkce zobrazení hesla

## Problém
Ikona pro zobrazení/skrytí hesla se zobrazovala, ale po kliknutí se heslo nezobrazovalo.

## Příčina
1. **Nesprávná HTML struktura** - `form-group` a `password-input-group` byly na stejném elementu
2. **Klonování elementů odstraňovalo event listenery** - Po klonování tlačítka a jeho nahrazení se event listener nepřidával správně

## Řešení

### 1. Oprava HTML struktury v auth.js
**Původní struktura (nesprávná):**
```html
<div class="form-group password-input-group">
    <input type="password" id="authPassword" name="password" placeholder="Heslo" required>
    <button type="button" class="toggle-password">...</button>
</div>
```

**Nová struktura (správná):**
```html
<div class="form-group">
    <div class="password-input-group">
        <input type="password" id="authPassword" name="password" placeholder="Heslo" required>
        <button type="button" class="toggle-password">...</button>
    </div>
</div>
```

### 2. Oprava přidávání event listenerů
**Problém:** Klonování tlačítka odstraňovalo event listenery

**Řešení:** 
- Odstraněno klonování elementu
- Přidána kontrola pomocí data atributu `data-listener-attached`
- Event listener se přidá pouze jednou
- Zajištěno, že se při opakovaném volání funkce listener nepřidává vícekrát

### 3. Přidání CSS pravidel
- Přidáno `width: 100%` pro `.password-input-group`
- Přidáno `margin: 0` pro input uvnitř `.password-input-group`

### 4. Volání funkce setupPasswordToggle()
Funkce se nyní volá na několika místech:
1. Po vytvoření modalu v `createAuthModal()`
2. Po otevření modalu v `showAuthModal()`
3. V rámci `setupAuthModalEvents()`

### 5. Přidáno logování pro debugging
- Log počtu nalezených tlačítek
- Log při kliknutí na tlačítko
- Log po přidání event listeneru
- Varování při nenalezení elementů

## Testování
1. Otevřete stránku a klikněte na "Registrace" nebo "Přihlášení"
2. V poli pro heslo by se měla zobrazit ikona oka vpravo
3. Klikněte na ikonu oka
4. **V konzoli byste měli vidět:** `👁️ Kliknuto na tlačítko zobrazení hesla`
5. Heslo by se mělo zobrazit jako text a ikona by se měla změnit na přeškrtnuté oko
6. **V konzoli byste měli vidět:** `✅ Heslo zobrazeno`
7. Znovu klikněte na ikonu - heslo by se mělo opět skrýt

## Očekávané logy v konzoli
Po otevření modalu:
```
🔐 Nastavuji toggle hesla, nalezeno tlačítek: 1
✅ Listener přidán na tlačítko 1
```

Po kliknutí na ikonu oka:
```
👁️ Kliknuto na tlačítko zobrazení hesla
✅ Heslo zobrazeno
```

Po opětovném kliknutí:
```
👁️ Kliknuto na tlačítko zobrazení hesla
✅ Heslo skryto
```

## Testovací soubor
Pro samostatné testování funkčnosti byl vytvořen soubor:
`test-password-toggle.html`

## Soubory upravené
1. `/Users/adam/Desktop/public_html-2/auth.js` - přihlášení a registrace
2. `/Users/adam/Desktop/public_html-2/reset-password.html` - obnovení hesla
3. `/Users/adam/Desktop/public_html-2/profile-settings.html` - nastavení profilu

## Použitá technologie
- JavaScript (vanilla) - pro přepínání typu input pole
- CSS - pro styling tlačítka a pozicování
- Font Awesome - ikony fa-eye a fa-eye-slash
- Data atributy - pro prevenci duplicitních event listenerů
