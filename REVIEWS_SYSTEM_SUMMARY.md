# Shrnutí nového systému recenzí

## ✅ CO BYLO OPRAVENO

### Hlavní problém:
- **Recenze se zobrazovaly na `profile-detail.html`, ale NE na `profile.html` a `profile-ratings.html`**

### Důvody:
1. **Různé cesty k datům**: Starý kód používal `users/{userId}/reviews`, ale některé stránky to neuměly načíst
2. **Duplicitní logika**: Každá stránka měla vlastní funkce → nekonzistence
3. **Chybějící error handling**: Při chybě v `loadUserData()` se recenze vůbec nenačítaly
4. **Nekonzistentní field names**: `reviewerId` vs `fromUserId`, `text` vs `comment`

### Řešení:
✅ **Jediný zdroj pravdy**: Všechny recenze v `/reviews` kolekci  
✅ **Jednotný modul**: `js/reviews.js` pro všechny operace  
✅ **Nezávislé načítání**: Recenze se načítají i při chybě v ostatních datech  
✅ **Konzistentní datový model**: Všechny recenze mají stejnou strukturu

---

## 🔄 JAK TO FUNGUJE TEĎ

### UŽIVATEL:

1. **Přidání recenze** (`profile-detail.html`):
   - Formulář s hvězdičkami (1-5), textem a volitelnými fotkami
   - Uložení do `/reviews/{reviewId}`
   - Fotky do Storage: `reviews/{authorId}/{timestamp}_{index}_{filename}`

2. **Zobrazení recenzí "o mně"** (`profile.html`):
   - Načte 5 nejnovějších recenzí z `/reviews` kde `targetUserId == currentUserId`
   - Zobrazí v sekci "Nedávné recenze"

3. **Zobrazení recenzí a grafu** (`profile-ratings.html`):
   - Načte všechny recenze z `/reviews` kde `targetUserId == currentUserId`
   - Vypočítá statistiky (průměr, breakdown 1-5)
   - Zobrazí graf a seznam recenzí

### ADMIN:

1. **Správa recenzí** (`admin-reviews.html`):
   - Zobrazí VŠECHNY recenze (bez omezení)
   - Filtry: podle autora, cílového uživatele, hodnocení
   - Možnost upravit, smazat, skrýt recenze

2. **Admin oprávnění**:
   - Kontrola přes `/admins/{uid}` dokument v Firestore
   - Admin může upravit/smazat jakoukoliv recenzi
   - Admin může nahrávat/mazat fotky kdekoliv

---

## 📁 ZMĚNĚNÉ SOUBORY

### Nové:
- ✅ `/js/reviews.js` - Hlavní modul (886 řádků)
- ✅ `/admin-reviews.html` - Admin rozhraní
- ✅ `/firestore-rules-reviews.txt` - Firestore rules
- ✅ `/storage-rules-reviews.txt` - Storage rules

### Upravené:
- ✅ `/profile-detail.html` - Přidán formulář pro fotky
- ✅ `/profile-detail.js` - Přepsán na nový modul
- ✅ `/profile.html` - Přepsán na nový modul
- ✅ `/profile-ratings.html` - Přepsán na nový modul
- ✅ `/auth.js` - Oprava: kontrola `uid` před `doc()`

### Smazaný kód:
- ❌ Všechny staré funkce: `loadUserReviews()`, `displayUserReviews()`, `renderAllReviews()`, atd.
- ❌ Duplicitní logika načítání recenzí
- ❌ Staré query na `users/{userId}/reviews`

---

## 🔥 FIRESTORE RULES (ZKOPÍROVAT DO FIREBASE CONSOLE)

Soubor: `firestore-rules-reviews.txt`

**Klíčové body:**
- Recenze v `/reviews` kolekci
- Veřejné recenze (`isHidden == false`) čitelné pro všechny
- Skryté recenze čitelné jen pro admin
- Autor může upravit své recenze (text, rating, photoUrls)
- Admin může upravit/smazat cokoliv
- `authorId` a `targetUserId` jsou **IMMUTABLE**

---

## 📦 STORAGE RULES (ZKOPÍROVAT DO FIREBASE CONSOLE)

Soubor: `storage-rules-reviews.txt`

**Klíčové body:**
- Fotky v `reviews/{authorId}/...`
- Autor může nahrávat do své složky
- Admin může nahrávat/mazat kdekoliv
- Povolené typy: `image/jpeg`, `image/png`, `image/webp`
- Max velikost: 5 MB

---

## 📊 INDEXY (VYTVOŘIT V FIREBASE CONSOLE)

1. Collection: `reviews`
   - `targetUserId` (Asc), `createdAt` (Desc)

2. Collection: `reviews`
   - `authorId` (Asc), `createdAt` (Desc)

3. Collection: `reviews`
   - `targetUserId` (Asc), `isHidden` (Asc), `createdAt` (Desc)

4. Collection: `reviews`
   - `authorId` (Asc), `isHidden` (Asc), `createdAt` (Desc)

5. Collection: `reviews`
   - `rating` (Asc), `createdAt` (Desc)

---

## 🎯 NASTAVENÍ ADMIN UŽIVATELŮ

V Firebase Console → Firestore → Data:
1. Vytvořte dokument: `/admins/{userId}`
2. Dokument může být prázdný `{}`
3. Uživatel s tímto `uid` bude mít admin oprávnění

---

## 🧪 TESTOVÁNÍ

### Základní testy:
1. ✅ Přidat recenzi na profile-detail → zobrazí se
2. ✅ Zobrazit na profile.html → zobrazí se v "Nedávné recenze"
3. ✅ Zobrazit na profile-ratings.html → zobrazí se + graf
4. ✅ Nahrát fotky k recenzi → zobrazí se jako thumbnaily
5. ✅ Kliknout na fotku → otevře se lightbox
6. ✅ Admin: Zobrazit všechny recenze
7. ✅ Admin: Upravit recenzi
8. ✅ Admin: Smazat recenzi

---

## 📝 DATOVÝ MODEL

### Firestore `/reviews/{reviewId}`:
```javascript
{
  authorId: "userId123",           // IMMUTABLE
  targetUserId: "userId456",       // IMMUTABLE
  rating: 5,                       // 1-5
  text: "Skvělá služba!",
  photoUrls: ["https://..."],      // Array URL
  listingId: null,                 // Volitelné ID inzerátu
  createdAt: Timestamp,
  updatedAt: Timestamp,
  editedByAdmin: false,
  isHidden: false
}
```

### Storage `reviews/{authorId}/{timestamp}_{index}_{filename}`:
- Typ: `image/jpeg`, `image/png`, `image/webp`
- Max velikost: 5 MB

---

## 🚀 DALŠÍ VYLEPŠENÍ (VOLITELNÉ)

- Paginace v `renderReviews()` (aktuálně zobrazuje všechny)
- Možnost editovat vlastní recenze (aktuálně jen admin)
- Notifikace při nové recenzi
- Export recenzí do CSV/PDF (pro admin)

---

## ⚠️ DŮLEŽITÉ POZNÁMKY

1. **Migrace starých recenzí**: Pokud máte staré recenze v `users/{userId}/reviews`, je potřeba je migrovat (viz dokumentace)

2. **Admin setup**: Nezapomeňte vytvořit `/admins/{uid}` dokumenty pro admin uživatele

3. **Indexy**: Vytvořte všechny potřebné indexy, jinak budou dotazy pomalé nebo selžou

4. **Rules**: Zkopírujte rules do Firebase Console - bez nich nebude systém fungovat
