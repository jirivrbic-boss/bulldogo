# Dokumentace nového systému recenzí

## 1. CO BYLA CHYBA A PROČ SE PROJEVILA JEN NĚKDE

### Problém:
- Recenze se ukládaly do `users/{userId}/reviews` (starý systém)
- Na `profile-detail.html` se recenze načítaly z této cesty → fungovalo
- Na `profile.html` a `profile-ratings.html` se recenze načítaly jinak nebo vůbec → nefungovalo

### Důvody:
1. **Různé cesty k datům**: Starý kód používal různé cesty (`users/{userId}/reviews` vs `reviews` collection)
2. **Duplicitní logika**: Každá stránka měla vlastní funkce pro načítání/zobrazování recenzí
3. **Chybějící error handling**: Při chybě v `loadUserData()` se recenze nenačítaly
4. **Nekonzistentní field names**: Používaly se různé názvy polí (`reviewerId` vs `fromUserId`, `text` vs `comment`)

### Řešení:
- **Jediný zdroj pravdy**: Všechny recenze se ukládají do root kolekce `/reviews`
- **Jednotný modul**: Všechny stránky používají `js/reviews.js`
- **Konzistentní datový model**: Všechny recenze mají stejnou strukturu
- **Nezávislé načítání**: Recenze se načítají nezávisle na ostatních datech

## 2. JAK TEĎ FUNGUJE CELÝ FLOW

### UŽIVATEL FLOW:

#### A) Přidání recenze (profile-detail.html):
1. Uživatel klikne na "Napsat recenzi"
2. Vyplní formulář (hodnocení 1-5, text, volitelně fotky)
3. Volá se `window.createReview()` z `js/reviews.js`
4. Recenze se uloží do `/reviews/{reviewId}` s:
   - `authorId`: ID autora recenze
   - `targetUserId`: ID uživatele, kterému se recenze přidává
   - `rating`: 1-5
   - `text`: Text recenze
   - `photoUrls`: Array URL fotek (pokud byly nahrány)
   - `createdAt`, `updatedAt`: Timestampy
   - `isHidden`: false (veřejná)
   - `editedByAdmin`: false
5. Fotky se nahrávají do Storage: `reviews/{authorId}/{timestamp}_{index}_{filename}`
6. Recenze se znovu načtou a zobrazí

#### B) Zobrazení recenzí (profile-detail.html):
1. Stránka se načte
2. Volá se `window.fetchReviewsForTarget(targetUserId)` z `js/reviews.js`
3. Query: `where('targetUserId', '==', targetUserId) && where('isHidden', '==', false)`
4. Recenze se zobrazí pomocí `window.renderReviews()`

#### C) Zobrazení recenzí "o mně" (profile.html):
1. Stránka se načte
2. Volá se `window.fetchReviewsForTarget(currentUserId)` s limitem 5
3. Recenze se zobrazí v sekci "Nedávné recenze"
4. Statistiky se aktualizují pomocí `window.computeRatingsStats()`

#### D) Zobrazení recenzí a grafu (profile-ratings.html):
1. Stránka se načte
2. Volá se `window.fetchReviewsForTarget(currentUserId)`
3. Statistiky se vypočítají: `window.computeRatingsStats(reviews)`
4. Graf se zobrazí: `window.renderRatingsChart(container, stats)`
5. Recenze se zobrazí: `window.renderReviews(container, reviews)`

### ADMIN FLOW:

#### A) Zobrazení všech recenzí (admin-reviews.html):
1. Admin se přihlásí
2. Systém zkontroluje admin status: `window.isAdmin()` → kontroluje `/admins/{uid}`
3. Volá se `window.fetchAllReviewsForAdmin(options)`
4. Zobrazí se všechny recenze s filtry

#### B) Úprava recenze (admin):
1. Admin klikne "Upravit"
2. Otevře se modal s formulářem
3. Admin může změnit: rating, text, isHidden
4. Volá se `window.updateReviewAsAdmin(reviewId, data)`
5. Firestore rules povolí (admin má plná oprávnění)
6. `editedByAdmin` se nastaví na `true`

#### C) Smazání recenze (admin):
1. Admin klikne "Smazat"
2. Potvrdí akci
3. Volá se `window.deleteReviewAsAdmin(reviewId)`
4. Smazou se i fotky ze Storage
5. Firestore rules povolí (admin má plná oprávnění)

## 3. SEZNAM ZMĚNĚNÝCH SOUBORŮ

### Nové soubory:
- `/js/reviews.js` - Nový modul pro všechny operace s recenzemi
- `/admin-reviews.html` - Admin rozhraní pro správu recenzí
- `/firestore-rules-reviews.txt` - Aktualizované Firestore rules
- `/storage-rules-reviews.txt` - Aktualizované Storage rules

### Upravené soubory:
- `/profile-detail.html` - Přidán formulář pro fotky, používá nový modul
- `/profile-detail.js` - Smazán starý kód, používá nový modul
- `/profile.html` - Smazán starý kód, používá nový modul
- `/profile-ratings.html` - Smazán starý kód, používá nový modul
- `/auth.js` - Oprava: kontrola `uid` před voláním `doc()`

### Smazaný kód:
- Všechny staré funkce: `loadUserReviews()`, `displayUserReviews()`, `renderAllReviews()`, `updateRatingFromReviews()`, atd.
- Duplicitní logika načítání recenzí
- Staré query na `users/{userId}/reviews`

## 4. FINÁLNÍ FIRESTORE RULES

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper funkce pro kontrolu admin statusu
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // ===== PRAVIDLA PRO RECENZE (NOVÝ SYSTÉM) =====
    match /reviews/{reviewId} {
      // READ: Veřejné recenze (isHidden == false) jsou čitelné pro všechny
      // Skryté recenze (isHidden == true) jsou čitelné jen pro admin
      allow read: if resource.data.isHidden == false || 
                     (request.auth != null && isAdmin());
      
      // CREATE: Jen přihlášení uživatelé, authorId MUSÍ být request.auth.uid
      allow create: if request.auth != null &&
                       request.resource.data.authorId == request.auth.uid &&
                       request.resource.data.targetUserId is string &&
                       request.resource.data.rating is int &&
                       request.resource.data.rating >= 1 &&
                       request.resource.data.rating <= 5 &&
                       request.resource.data.text is string &&
                       request.resource.data.text.size() > 0 &&
                       // Immutable fields
                       request.resource.data.authorId == request.resource.data.authorId &&
                       request.resource.data.targetUserId == request.resource.data.targetUserId;
      
      // UPDATE: Autor může upravit text, rating, photoUrls
      // Admin může upravit COKOLIV
      allow update: if request.auth != null && (
                       // Autor může upravit své recenze
                       (resource.data.authorId == request.auth.uid &&
                        // Immutable fields nelze změnit
                        request.resource.data.authorId == resource.data.authorId &&
                        request.resource.data.targetUserId == resource.data.targetUserId) ||
                       // Admin může upravit cokoliv
                       isAdmin()
                     );
      
      // DELETE: Autor nebo admin
      allow delete: if request.auth != null && (
                       resource.data.authorId == request.auth.uid ||
                       isAdmin()
                     );
    }
    
    // ===== ADMIN KOLEKCE =====
    match /admins/{adminId} {
      allow read, write: if request.auth != null && isAdmin();
    }
    
    // ... další pravidla (inzeráty, konverzace, atd.)
  }
}
```

## 5. FINÁLNÍ STORAGE RULES

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // ===== FOTKY RECENZÍ =====
    match /reviews/{authorId}/{allPaths=**} {
      // READ: Jen přihlášení mohou vidět fotky
      allow read: if request.auth != null;
      
      // WRITE: Autor nebo admin
      allow write: if request.auth != null && (
                     request.auth.uid == authorId ||
                     exists(/databases/(default)/documents/admins/$(request.auth.uid))
                   ) &&
                   request.resource.contentType.matches('image/(jpeg|png|webp)') &&
                   request.resource.size <= 5 * 1024 * 1024;
      
      // DELETE: Autor nebo admin
      allow delete: if request.auth != null && (
                      request.auth.uid == authorId ||
                      exists(/databases/(default)/documents/admins/$(request.auth.uid))
                    );
    }
    
    // ... další pravidla (services, profile-pictures, chat)
  }
}
```

## 6. INDEXY, KTERÉ MUSÍTE VYTVOŘIT

V Firebase Console → Firestore → Indexes → Create Index:

1. **Collection**: `reviews`
   - Fields: `targetUserId` (Ascending), `createdAt` (Descending)
   - Query scope: Collection

2. **Collection**: `reviews`
   - Fields: `authorId` (Ascending), `createdAt` (Descending)
   - Query scope: Collection

3. **Collection**: `reviews`
   - Fields: `targetUserId` (Ascending), `isHidden` (Ascending), `createdAt` (Descending)
   - Query scope: Collection

4. **Collection**: `reviews`
   - Fields: `authorId` (Ascending), `isHidden` (Ascending), `createdAt` (Descending)
   - Query scope: Collection

5. **Collection**: `reviews`
   - Fields: `rating` (Ascending), `createdAt` (Descending)
   - Query scope: Collection (pro admin filtry)

## 7. NASTAVENÍ ADMIN UŽIVATELŮ

Pro nastavení admin uživatele:
1. V Firebase Console → Firestore → Data
2. Vytvořte dokument: `/admins/{userId}`
3. Dokument může být prázdný `{}` nebo obsahovat metadata:
   ```json
   {
     "createdAt": "2026-01-15T10:00:00Z",
     "createdBy": "admin@bulldogo.cz"
   }
   ```

## 8. MIGRACE STARÝCH RECENZÍ (VOLITELNÉ)

Pokud máte staré recenze v `users/{userId}/reviews`, můžete je migrovat:

```javascript
// Spustit jednou v Firebase Console → Functions nebo v admin rozhraní
async function migrateOldReviews() {
  const { getDocs, collection, addDoc, deleteDoc } = await import('firebase/firestore');
  
  // Pro každého uživatele
  const usersSnapshot = await getDocs(collection(db, 'users'));
  
  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const oldReviewsRef = collection(db, 'users', userId, 'reviews');
    const oldReviewsSnap = await getDocs(oldReviewsRef);
    
    for (const reviewDoc of oldReviewsSnap.docs) {
      const oldData = reviewDoc.data();
      
      // Vytvořit novou recenzi v root kolekci
      await addDoc(collection(db, 'reviews'), {
        authorId: oldData.reviewerId || oldData.fromUserId,
        targetUserId: userId,
        rating: oldData.rating,
        text: oldData.text || oldData.comment,
        photoUrls: oldData.photoUrls || [],
        listingId: null,
        createdAt: oldData.createdAt || serverTimestamp(),
        updatedAt: oldData.updatedAt || oldData.createdAt || serverTimestamp(),
        editedByAdmin: false,
        isHidden: false
      });
      
      // Smazat starou recenzi (volitelné)
      // await deleteDoc(reviewDoc.ref);
    }
  }
}
```

## 9. TESTOVÁNÍ

### Testovací scénáře:
1. ✅ Přidat recenzi na profile-detail → měla by se zobrazit
2. ✅ Zobrazit recenze na profile.html → měly by se zobrazit v "Nedávné recenze"
3. ✅ Zobrazit recenze na profile-ratings.html → měly by se zobrazit + graf
4. ✅ Admin: Zobrazit všechny recenze na admin-reviews.html
5. ✅ Admin: Upravit recenzi
6. ✅ Admin: Smazat recenzi
7. ✅ Nahrát fotky k recenzi → měly by se zobrazit jako thumbnaily
8. ✅ Kliknout na fotku → měl by se otevřít lightbox

## 10. STRUKTURA DAT

### Firestore:
```
/reviews/{reviewId}
  - authorId: string (immutable)
  - targetUserId: string (immutable)
  - rating: number (1-5)
  - text: string
  - photoUrls: array<string>
  - listingId: string | null
  - createdAt: Timestamp
  - updatedAt: Timestamp
  - editedByAdmin: boolean
  - isHidden: boolean
```

### Storage:
```
/reviews/{authorId}/{timestamp}_{index}_{filename}
  - contentType: image/jpeg | image/png | image/webp
  - size: <= 5 MB
```

### Admin:
```
/admins/{uid}
  - (prázdný dokument nebo metadata)
```
