# Instrukce pro vytvoření a nastavení Favicon

## Co je Favicon?
Favicon je malá ikona, která se zobrazuje v záložce prohlížeče, v záložkách, na domovské obrazovce mobilních zařízení a v dalších místech.

## Zjednodušené řešení - stačí 2 soubory!

Vytvořte pouze **2 soubory** v **kořenovém adresáři** vašeho webu (stejná úroveň jako `index.html`):

### 1. **favicon.ico** (povinný)
- **Velikost**: 32×32 nebo 48×48 pixelů (doporučeno 32×32)
- **Formát**: .ico
- **Popis**: Základní favicon pro starší prohlížeče a jako fallback
- **Umístění**: `/favicon.ico` (v kořenovém adresáři)

### 2. **favicon.png** (univerzální)
- **Velikost**: 192×192 nebo 256×256 pixelů (doporučeno 256×256)
- **Formát**: PNG s průhledností
- **Popis**: Univerzální favicon pro všechny moderní prohlížeče, iOS, Android a PWA
- **Umístění**: `/favicon.png` (v kořenovém adresáři)
- **Poznámka**: Prohlížeče si automaticky zmenší tento obrázek podle potřeby

## Jak vytvořit Favicon soubory?

### Možnost 1: Online generátory (nejjednodušší)
1. **Favicon.io** (https://favicon.io/)
   - Nahrajte obrázek nebo použijte text
   - Stáhněte ZIP soubor
   - Z rozbalených souborů použijte:
     - `favicon.ico` → přejmenujte a nahrajte jako `/favicon.ico`
     - `favicon-32x32.png` nebo větší → přejmenujte na `favicon.png` a nahrajte jako `/favicon.png`

2. **RealFaviconGenerator** (https://realfavicongenerator.net/)
   - Nahrajte obrázek (minimálně 260×260 px)
   - Vyberte "I will place favicon files at the root of my website"
   - Stáhněte a použijte `favicon.ico` a `favicon.png` (nebo větší PNG)

### Možnost 2: Z existujícího loga (ručně)
Pokud máte logo v `fotky/bulldogo-logo.png`:
1. Otevřete logo v editoru (Photoshop, GIMP, nebo online editor jako Photopea.com)
2. Vytvořte čtvercový obrázek:
   - **favicon.png**: 256×256 pixelů (nebo 192×192) - exportujte jako PNG
   - **favicon.ico**: 32×32 pixelů - exportujte a převeďte na ICO pomocí https://convertio.co/png-ico/
3. Nahrajte oba soubory do kořenového adresáře

## Důležité poznámky

### Design doporučení:
- **Jednoduchost**: Favicon je malý, takže složité detaily nebudou vidět
- **Kontrast**: Použijte vysoký kontrast pro lepší viditelnost
- **Čtvercový formát**: Favicon by měl být čtvercový (1:1 poměr stran)
- **Barvy**: Použijte výrazné barvy, které odpovídají vaší značce

### Umístění souborů:
Oba favicon soubory musí být v **kořenovém adresáři** (stejná úroveň jako `index.html`):
```
/
├── index.html
├── favicon.ico    ← zde (32×32 nebo 48×48 px)
└── favicon.png   ← zde (192×192 nebo 256×256 px)
```

### Testování:
Po nahrání souborů:
1. Vymažte cache prohlížeče (Ctrl+Shift+Delete nebo Cmd+Shift+Delete)
2. Obnovte stránku (Ctrl+F5 nebo Cmd+Shift+R)
3. Zkontrolujte, zda se favicon zobrazuje v záložce prohlížeče
4. Otestujte na mobilních zařízeních (iOS a Android)

## Co už je nastaveno?

✅ Všechny HTML soubory mají správné odkazy na favicon soubory
✅ `site.webmanifest` je aktualizován s odkazy na favicon.png
✅ HTML obsahuje odkazy pro všechny platformy (desktop, iOS, Android)

**Zbývá pouze**: Vytvořit a nahrát **2 soubory** (`favicon.ico` a `favicon.png`) do kořenového adresáře!

## Proč stačí 2 soubory?

- **favicon.ico** - Starší prohlížeče a některé systémy vyžadují ICO formát
- **favicon.png** - Moderní prohlížeče si automaticky zmenší PNG podle potřeby (16×16, 32×32, atd.)
- Prohlížeče jsou chytré a umí si obrázek škálovat, takže nepotřebujete každou velikost zvlášť
