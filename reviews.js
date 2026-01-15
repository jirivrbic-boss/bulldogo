/**
 * Reviews System Module
 * Jediný zdroj pravdy pro všechny operace s recenzemi
 */

// ===== KONFIGURACE =====
const REVIEWS_COLLECTION = 'reviews';
const STORAGE_PATH_PREFIX = 'reviews';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ===== POMOCNÉ FUNKCE =====

/**
 * Zkontroluje, zda je uživatel admin
 */
async function isAdmin(userId) {
    if (!userId || !window.firebaseDb) return false;
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const adminRef = doc(window.firebaseDb, 'admins', userId);
        const adminSnap = await getDoc(adminRef);
        return adminSnap.exists();
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Escape HTML pro bezpečné zobrazení
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formátování data (relativní čas)
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Neznámé datum';
    
    let date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Dnes';
    if (diffDays === 1) return 'Včera';
    if (diffDays < 7) return `Před ${diffDays} dny`;
    if (diffDays < 30) return `Před ${Math.floor(diffDays / 7)} týdny`;
    if (diffDays < 365) return `Před ${Math.floor(diffDays / 30)} měsíci`;
    return `Před ${Math.floor(diffDays / 365)} lety`;
}

/**
 * Načte jméno uživatele z profilu
 */
async function getUserName(userId) {
    if (!userId || !window.firebaseDb) return 'Anonymní';
    try {
        const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const profileRef = doc(window.firebaseDb, 'users', userId, 'profile', 'profile');
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            return data.name || 
                   (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : null) ||
                   data.email?.split('@')[0] || 
                   'Anonymní';
        }
    } catch (error) {
        console.warn('Error loading user name:', error);
    }
    return 'Anonymní';
}

// ===== HLAVNÍ API FUNKCE =====

/**
 * Vytvoří novou recenzi
 * @param {Object} params
 * @param {string} params.targetUserId - ID uživatele, kterému se recenze přidává
 * @param {number} params.rating - Hodnocení 1-5
 * @param {string} params.text - Text recenze
 * @param {File[]} params.files - Volitelné obrázky
 * @param {string|null} params.listingId - Volitelné ID inzerátu
 * @returns {Promise<string>} ID vytvořené recenze
 */
async function createReview({ targetUserId, rating, text, files = [], listingId = null }) {
    console.log('📝 Creating review:', { targetUserId, rating, text, filesCount: files.length, listingId });
    
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        throw new Error('Musíte být přihlášeni pro vytvoření recenze');
    }
    
    if (currentUser.uid === targetUserId) {
        throw new Error('Nemůžete hodnotit sami sebe');
    }
    
    if (!rating || rating < 1 || rating > 5) {
        throw new Error('Hodnocení musí být mezi 1 a 5');
    }
    
    if (!text || text.trim().length === 0) {
        throw new Error('Text recenze je povinný');
    }
    
    try {
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Nahrát obrázky do Storage
        const photoUrls = [];
        if (files && files.length > 0 && window.firebaseStorage) {
            const { ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Validace typu
                if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                    throw new Error(`Nepovolený typ souboru: ${file.type}. Povolené typy: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
                }
                
                // Validace velikosti
                if (file.size > MAX_FILE_SIZE) {
                    throw new Error(`Soubor ${file.name} je příliš velký. Maximální velikost: 5 MB`);
                }
                
                const timestamp = Date.now();
                const fileName = `${STORAGE_PATH_PREFIX}/${currentUser.uid}/${timestamp}_${i}_${file.name}`;
                const storageRef = ref(window.firebaseStorage, fileName);
                
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                photoUrls.push(downloadURL);
            }
        }
        
        // Vytvořit recenzi v Firestore
        const reviewData = {
            authorId: currentUser.uid,
            targetUserId: targetUserId,
            rating: rating,
            text: text.trim(),
            photoUrls: photoUrls,
            listingId: listingId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            editedByAdmin: false,
            isHidden: false
        };
        
        const reviewsRef = collection(window.firebaseDb, REVIEWS_COLLECTION);
        const docRef = await addDoc(reviewsRef, reviewData);
        
        console.log('✅ Review created:', docRef.id);
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Error creating review:', error);
        throw error;
    }
}

/**
 * Načte recenze pro konkrétního uživatele (targetUserId)
 * @param {string} targetUserId - ID uživatele, pro kterého se načítají recenze
 * @param {Object} options
 * @param {boolean} options.includeHidden - Zahrnout skryté recenze (jen pro admin)
 * @param {number} options.limit - Maximální počet recenzí
 * @param {string} options.orderBy - Řazení ('createdAt' nebo 'rating')
 * @param {string} options.orderDirection - Směr řazení ('desc' nebo 'asc')
 * @returns {Promise<Array>} Pole recenzí
 */
async function fetchReviewsForTarget(targetUserId, options = {}) {
    console.log('📖 Fetching reviews for target:', targetUserId, options);
    
    if (!targetUserId || !window.firebaseDb) {
        console.warn('⚠️ Missing targetUserId or Firebase DB');
        return [];
    }
    
    try {
        const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const reviewsRef = collection(window.firebaseDb, REVIEWS_COLLECTION);
        
        // Zkontrolovat admin status před dotazem
        const currentUser = window.firebaseAuth?.currentUser;
        let userIsAdmin = false;
        if (currentUser) {
            try {
                userIsAdmin = await isAdmin(currentUser.uid);
            } catch (error) {
                console.warn('⚠️ Error checking admin status, assuming not admin:', error);
                userIsAdmin = false;
            }
        }
        
        // Vytvořit dotaz - použít jen jeden where pro targetUserId (aby nepotřeboval index)
        let q = query(reviewsRef, where('targetUserId', '==', targetUserId));
        
        // Limit pro dotaz (max 1000, pak filtrujeme na klientovi)
        const queryLimit = options.limit ? Math.min(options.limit * 2, 1000) : 1000;
        q = query(q, limit(queryLimit));
        
        const snapshot = await getDocs(q);
        let reviews = [];
        
        snapshot.forEach(doc => {
            const reviewData = {
                id: doc.id,
                ...doc.data()
            };
            
            // Filtrovat skryté recenze na klientovi (pokud není admin)
            if (userIsAdmin || options.includeHidden || !reviewData.isHidden) {
                reviews.push(reviewData);
            }
        });
        
        // Řazení na klientovi (aby nepotřeboval Firestore index)
        const orderField = options.orderBy || 'createdAt';
        const orderDir = options.orderDirection || 'desc';
        reviews.sort((a, b) => {
            let aVal = a[orderField];
            let bVal = b[orderField];
            
            // Konvertovat Timestamp na Date pro porovnání
            if (aVal && aVal.toDate && typeof aVal.toDate === 'function') {
                aVal = aVal.toDate().getTime();
            } else if (aVal instanceof Date) {
                aVal = aVal.getTime();
            }
            if (bVal && bVal.toDate && typeof bVal.toDate === 'function') {
                bVal = bVal.toDate().getTime();
            } else if (bVal instanceof Date) {
                bVal = bVal.getTime();
            }
            
            if (orderDir === 'desc') {
                return (bVal || 0) - (aVal || 0);
            } else {
                return (aVal || 0) - (bVal || 0);
            }
        });
        
        // Aplikovat limit po seřazení
        if (options.limit) {
            reviews = reviews.slice(0, options.limit);
        }
        
        console.log('✅ Loaded reviews:', reviews.length);
        return reviews;
        
    } catch (error) {
        console.error('❌ Error fetching reviews for target:', error);
        if (error.code === 'permission-denied') {
            throw new Error('Nemáte oprávnění k načtení recenzí');
        }
        throw error;
    }
}

/**
 * Načte recenze napsané konkrétním uživatelem (authorId)
 * @param {string} authorId - ID autora recenzí
 * @param {Object} options - Stejné jako fetchReviewsForTarget
 * @returns {Promise<Array>} Pole recenzí
 */
async function fetchReviewsByAuthor(authorId, options = {}) {
    console.log('📖 Fetching reviews by author:', authorId, options);
    
    if (!authorId || !window.firebaseDb) {
        return [];
    }
    
    try {
        const { collection, query, where, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const reviewsRef = collection(window.firebaseDb, REVIEWS_COLLECTION);
        
        // Zkontrolovat admin status před dotazem
        const currentUser = window.firebaseAuth?.currentUser;
        let userIsAdmin = false;
        if (currentUser) {
            try {
                userIsAdmin = await isAdmin(currentUser.uid);
            } catch (error) {
                console.warn('⚠️ Error checking admin status, assuming not admin:', error);
                userIsAdmin = false;
            }
        }
        
        // Vytvořit dotaz - použít jen jeden where pro authorId (aby nepotřeboval index)
        let q = query(reviewsRef, where('authorId', '==', authorId));
        
        // Limit pro dotaz (max 1000, pak filtrujeme na klientovi)
        const queryLimit = options.limit ? Math.min(options.limit * 2, 1000) : 1000;
        q = query(q, limit(queryLimit));
        
        const snapshot = await getDocs(q);
        let reviews = [];
        
        snapshot.forEach(doc => {
            const reviewData = {
                id: doc.id,
                ...doc.data()
            };
            
            // Filtrovat skryté recenze na klientovi (pokud není admin)
            if (userIsAdmin || options.includeHidden || !reviewData.isHidden) {
                reviews.push(reviewData);
            }
        });
        
        // Řazení na klientovi (aby nepotřeboval Firestore index)
        const orderField = options.orderBy || 'createdAt';
        const orderDir = options.orderDirection || 'desc';
        reviews.sort((a, b) => {
            let aVal = a[orderField];
            let bVal = b[orderField];
            
            // Konvertovat Timestamp na Date pro porovnání
            if (aVal && aVal.toDate && typeof aVal.toDate === 'function') {
                aVal = aVal.toDate().getTime();
            } else if (aVal instanceof Date) {
                aVal = aVal.getTime();
            }
            if (bVal && bVal.toDate && typeof bVal.toDate === 'function') {
                bVal = bVal.toDate().getTime();
            } else if (bVal instanceof Date) {
                bVal = bVal.getTime();
            }
            
            if (orderDir === 'desc') {
                return (bVal || 0) - (aVal || 0);
            } else {
                return (aVal || 0) - (bVal || 0);
            }
        });
        
        // Aplikovat limit po seřazení
        if (options.limit) {
            reviews = reviews.slice(0, options.limit);
        }
        
        console.log('✅ Loaded reviews by author:', reviews.length);
        return reviews;
        
    } catch (error) {
        console.error('❌ Error fetching reviews by author:', error);
        throw error;
    }
}

/**
 * Načte všechny recenze (pro admin)
 * @param {Object} options
 * @param {string} options.filterBy - Filtr ('authorId', 'targetUserId', 'rating')
 * @param {string} options.filterValue - Hodnota filtru
 * @param {number} options.limit - Maximální počet
 * @returns {Promise<Array>} Pole recenzí
 */
async function fetchAllReviewsForAdmin(options = {}) {
    console.log('📖 Fetching all reviews for admin:', options);
    
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        throw new Error('Musíte být přihlášeni');
    }
    
    let userIsAdmin = false;
    try {
        userIsAdmin = await isAdmin(currentUser.uid);
    } catch (error) {
        console.warn('⚠️ Error checking admin status:', error);
    }
    
    if (!userIsAdmin) {
        throw new Error('Nemáte oprávnění administrátora');
    }
    
    if (!window.firebaseDb) {
        throw new Error('Firebase DB není dostupný');
    }
    
    try {
        const { collection, query, where, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const reviewsRef = collection(window.firebaseDb, REVIEWS_COLLECTION);
        let q = query(reviewsRef);
        
        // Pokud je filtr, použít ho v dotazu (ale bez orderBy, aby nepotřeboval index)
        if (options.filterBy === 'authorId' && options.filterValue) {
            q = query(q, where('authorId', '==', options.filterValue));
        } else if (options.filterBy === 'targetUserId' && options.filterValue) {
            q = query(q, where('targetUserId', '==', options.filterValue));
        } else if (options.filterBy === 'rating' && options.filterValue) {
            q = query(q, where('rating', '==', parseInt(options.filterValue)));
        }
        
        // Limit pro dotaz (max 1000, pak filtrujeme na klientovi)
        const queryLimit = options.limit ? Math.min(options.limit * 2, 1000) : 1000;
        q = query(q, limit(queryLimit));
        
        const snapshot = await getDocs(q);
        let reviews = [];
        
        snapshot.forEach(doc => {
            reviews.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Řazení na klientovi (aby nepotřeboval Firestore index)
        reviews.sort((a, b) => {
            let aVal = a.createdAt;
            let bVal = b.createdAt;
            
            // Konvertovat Timestamp na Date pro porovnání
            if (aVal && aVal.toDate && typeof aVal.toDate === 'function') {
                aVal = aVal.toDate().getTime();
            } else if (aVal instanceof Date) {
                aVal = aVal.getTime();
            }
            if (bVal && bVal.toDate && typeof bVal.toDate === 'function') {
                bVal = bVal.toDate().getTime();
            } else if (bVal instanceof Date) {
                bVal = bVal.getTime();
            }
            
            return (bVal || 0) - (aVal || 0); // desc
        });
        
        // Aplikovat limit po seřazení
        if (options.limit) {
            reviews = reviews.slice(0, options.limit);
        }
        
        console.log('✅ Loaded all reviews for admin:', reviews.length);
        return reviews;
        
    } catch (error) {
        console.error('❌ Error fetching all reviews:', error);
        throw error;
    }
}

/**
 * Aktualizuje recenzi (admin nebo autor)
 * @param {string} reviewId - ID recenze
 * @param {Object} data - Data k aktualizaci
 * @returns {Promise<void>}
 */
async function updateReviewAsAdmin(reviewId, data) {
    console.log('✏️ Updating review:', reviewId, data);
    
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        throw new Error('Musíte být přihlášeni');
    }
    
    if (!window.firebaseDb) {
        throw new Error('Firebase DB není dostupný');
    }
    
    try {
        const { doc, getDoc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const reviewRef = doc(window.firebaseDb, REVIEWS_COLLECTION, reviewId);
        const reviewSnap = await getDoc(reviewRef);
        
        if (!reviewSnap.exists()) {
            throw new Error('Recenze nebyla nalezena');
        }
        
        const reviewData = reviewSnap.data();
        const userIsAdmin = await isAdmin(currentUser.uid);
        
        // Autor může upravit jen své recenze (text, rating, photoUrls)
        if (!userIsAdmin && reviewData.authorId !== currentUser.uid) {
            throw new Error('Nemáte oprávnění upravit tuto recenzi');
        }
        
        // Admin může upravit cokoliv
        const updateData = {
            ...data,
            updatedAt: serverTimestamp()
        };
        
        if (userIsAdmin && (data.text || data.rating)) {
            updateData.editedByAdmin = true;
        }
        
        // Immutable fields nelze změnit
        delete updateData.authorId;
        delete updateData.targetUserId;
        
        await updateDoc(reviewRef, updateData);
        console.log('✅ Review updated');
        
    } catch (error) {
        console.error('❌ Error updating review:', error);
        throw error;
    }
}

/**
 * Smaže recenzi (admin nebo autor)
 * @param {string} reviewId - ID recenze
 * @returns {Promise<void>}
 */
async function deleteReviewAsAdmin(reviewId) {
    console.log('🗑️ Deleting review:', reviewId);
    
    const currentUser = window.firebaseAuth?.currentUser;
    if (!currentUser) {
        throw new Error('Musíte být přihlášeni');
    }
    
    if (!window.firebaseDb) {
        throw new Error('Firebase DB není dostupný');
    }
    
    try {
        const { doc, getDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const reviewRef = doc(window.firebaseDb, REVIEWS_COLLECTION, reviewId);
        const reviewSnap = await getDoc(reviewRef);
        
        if (!reviewSnap.exists()) {
            throw new Error('Recenze nebyla nalezena');
        }
        
        const reviewData = reviewSnap.data();
        const userIsAdmin = await isAdmin(currentUser.uid);
        
        // Autor může smazat jen své recenze
        if (!userIsAdmin && reviewData.authorId !== currentUser.uid) {
            throw new Error('Nemáte oprávnění smazat tuto recenzi');
        }
        
        // Smazat obrázky ze Storage
        if (reviewData.photoUrls && reviewData.photoUrls.length > 0 && window.firebaseStorage) {
            const { ref, deleteObject } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
            
            for (const photoUrl of reviewData.photoUrls) {
                try {
                    // Extrahovat cestu z URL
                    const urlParts = photoUrl.split('/o/');
                    if (urlParts.length > 1) {
                        const pathPart = urlParts[1].split('?')[0];
                        const decodedPath = decodeURIComponent(pathPart);
                        const storageRef = ref(window.firebaseStorage, decodedPath);
                        await deleteObject(storageRef);
                    }
                } catch (storageError) {
                    console.warn('⚠️ Error deleting photo from storage:', storageError);
                }
            }
        }
        
        await deleteDoc(reviewRef);
        console.log('✅ Review deleted');
        
    } catch (error) {
        console.error('❌ Error deleting review:', error);
        throw error;
    }
}

/**
 * Vypočítá statistiky z recenzí
 * @param {Array} reviews - Pole recenzí
 * @returns {Object} Statistiky
 */
function computeRatingsStats(reviews) {
    if (!reviews || reviews.length === 0) {
        return {
            average: 0,
            total: 0,
            breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            percentages: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        };
    }
    
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    let sum = 0;
    
    reviews.forEach(review => {
        const rating = review.rating || 0;
        if (rating >= 1 && rating <= 5) {
            breakdown[rating]++;
            total++;
            sum += rating;
        }
    });
    
    const average = total > 0 ? sum / total : 0;
    const percentages = {
        5: total > 0 ? (breakdown[5] / total) * 100 : 0,
        4: total > 0 ? (breakdown[4] / total) * 100 : 0,
        3: total > 0 ? (breakdown[3] / total) * 100 : 0,
        2: total > 0 ? (breakdown[2] / total) * 100 : 0,
        1: total > 0 ? (breakdown[1] / total) * 100 : 0
    };
    
    return {
        average: parseFloat(average.toFixed(1)),
        total: total,
        breakdown: breakdown,
        percentages: percentages
    };
}

/**
 * Vykreslí recenze do kontejneru
 * @param {HTMLElement} containerEl - DOM element pro zobrazení
 * @param {Array} reviews - Pole recenzí
 * @param {Object} options
 * @param {boolean} options.showAuthorName - Zobrazit jméno autora
 * @param {boolean} options.showPhotos - Zobrazit fotky
 * @param {number} options.maxReviews - Maximální počet recenzí
 */
async function renderReviews(containerEl, reviews, options = {}) {
    console.log('🎨 Rendering reviews:', reviews.length, options);
    
    if (!containerEl) {
        console.error('❌ Container element not provided');
        return;
    }
    
    if (!reviews || reviews.length === 0) {
        containerEl.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 16px; border: 2px dashed #e5e7eb;">
                <i class="fas fa-star" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px;"></i>
                <p style="font-size: 16px; color: #6b7280; margin: 0; font-weight: 500;">Zatím žádné recenze</p>
            </div>
        `;
        return;
    }
    
    const maxReviews = options.maxReviews || reviews.length;
    const reviewsToShow = reviews.slice(0, maxReviews);
    
    // Načíst jména autorů
            const reviewsWithNames = await Promise.all(
                reviewsToShow.map(async (review) => {
                    let authorName = 'Anonymní';
                    if (options.showAuthorName !== false && review.authorId) {
                        authorName = await getUserName(review.authorId);
                    }
                    return {
                        ...review,
                        authorName: authorName
                    };
                })
            );
    
    // Vykreslit recenze
    containerEl.innerHTML = reviewsWithNames.map(review => {
        const rating = review.rating || 0;
        const filledStars = '★'.repeat(rating);
        const emptyStars = '☆'.repeat(5 - rating);
        const text = escapeHtml(review.text || 'Žádný komentář');
        const authorName = escapeHtml(review.authorName || 'Anonymní');
        const timeAgo = formatTimeAgo(review.createdAt || review.updatedAt);
        const editedBadge = review.editedByAdmin 
            ? '<span style="background: #fbbf24; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Upraveno adminem</span>' 
            : '';
        
        // Fotky
        let photosHtml = '';
        if (options.showPhotos !== false && review.photoUrls && review.photoUrls.length > 0) {
            photosHtml = `
                <div class="review-photos" style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;">
                    ${review.photoUrls.map((url, idx) => `
                        <img src="${url}" 
                             alt="Foto ${idx + 1}" 
                             class="review-photo-thumbnail"
                             style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid #e5e7eb;"
                             onclick="openReviewPhotoLightbox(${JSON.stringify(review.photoUrls)}, ${idx})"
                             loading="lazy">
                    `).join('')}
                </div>
            `;
        }
        
        return `
            <div class="review-card" style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div class="review-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div class="reviewer-info" style="display: flex; align-items: center; gap: 12px;">
                        <div class="reviewer-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-user" style="color: #6b7280;"></i>
                        </div>
                        <div class="reviewer-details">
                            <h4 class="reviewer-name" style="margin: 0; font-size: 16px; font-weight: 600; color: #111827; display: flex; align-items: center;">
                                ${authorName}
                                ${editedBadge}
                            </h4>
                            <span class="review-date" style="font-size: 14px; color: #6b7280;">${timeAgo}</span>
                        </div>
                    </div>
                    <div class="review-rating" style="font-size: 18px;">
                        <span style="color: #fbbf24;">${filledStars}</span>
                        <span style="color: #d1d5db;">${emptyStars}</span>
                    </div>
                </div>
                <div class="review-content">
                    <p class="review-text" style="margin: 0; color: #374151; line-height: 1.6;">${text}</p>
                    ${photosHtml}
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Reviews rendered');
}

/**
 * Vykreslí graf hodnocení
 * @param {HTMLElement} containerEl - DOM element pro graf
 * @param {Object} stats - Statistiky z computeRatingsStats
 */
function renderRatingsChart(containerEl, stats) {
    console.log('📊 Rendering ratings chart:', stats);
    
    if (!containerEl) {
        console.error('❌ Container element not provided');
        return;
    }
    
    if (!stats || stats.total === 0) {
        containerEl.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <p>Zatím žádná hodnocení</p>
            </div>
        `;
        return;
    }
    
    containerEl.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="font-size: 2rem; font-weight: 700; color: #111827;">${stats.average}</div>
                <div>
                    <div style="font-size: 1.2rem; color: #fbbf24;">
                        ${'★'.repeat(Math.round(stats.average))}${'☆'.repeat(5 - Math.round(stats.average))}
                    </div>
                    <div style="font-size: 14px; color: #6b7280;">Založeno na ${stats.total} ${stats.total === 1 ? 'recenzi' : stats.total < 5 ? 'recenzích' : 'recenzích'}</div>
                </div>
            </div>
            <div class="rating-breakdown">
                ${[5, 4, 3, 2, 1].map(rating => `
                    <div class="rating-bar rating-bar-${rating}" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <span style="min-width: 80px; font-size: 14px; color: #374151;">${rating} ${rating === 1 ? 'hvězda' : rating < 5 ? 'hvězdy' : 'hvězd'}</span>
                        <div class="bar" style="flex: 1; height: 24px; background: #e5e7eb; border-radius: 12px; overflow: hidden; position: relative;">
                            <div class="fill" style="height: 100%; background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%); border-radius: 12px; transition: width 0.3s ease;" style="width: ${stats.percentages[rating]}%"></div>
                        </div>
                        <span class="rating-count" style="min-width: 30px; text-align: right; font-size: 14px; font-weight: 600; color: #111827;">${stats.breakdown[rating]}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Aktualizovat šířky pruhů po renderování
    setTimeout(() => {
        [5, 4, 3, 2, 1].forEach(rating => {
            const fillEl = containerEl.querySelector(`.rating-bar-${rating} .fill`);
            if (fillEl) {
                fillEl.style.width = `${stats.percentages[rating]}%`;
            }
        });
    }, 100);
}

/**
 * Lightbox pro zobrazení fotek recenze
 */
function openReviewPhotoLightbox(photoUrls, startIndex = 0) {
    if (!photoUrls || photoUrls.length === 0) return;
    
    const modal = document.createElement('div');
    modal.className = 'review-photo-lightbox';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;
    
    let currentIndex = startIndex;
    
    const img = document.createElement('img');
    img.src = photoUrls[currentIndex];
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
    `;
    
    const updateImage = () => {
        img.src = photoUrls[currentIndex];
    };
    
    // Navigace
    if (photoUrls.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.style.cssText = `
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 24px;
            padding: 16px 20px;
            border-radius: 50%;
            cursor: pointer;
            transition: background 0.2s;
        `;
        prevBtn.onmouseover = () => prevBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        prevBtn.onmouseout = () => prevBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + photoUrls.length) % photoUrls.length;
            updateImage();
        };
        modal.appendChild(prevBtn);
        
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.style.cssText = prevBtn.style.cssText;
        nextBtn.style.left = 'auto';
        nextBtn.style.right = '20px';
        nextBtn.onmouseover = () => nextBtn.style.background = 'rgba(255, 255, 255, 0.3)';
        nextBtn.onmouseout = () => nextBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % photoUrls.length;
            updateImage();
        };
        modal.appendChild(nextBtn);
        
        const counter = document.createElement('div');
        counter.textContent = `${currentIndex + 1} / ${photoUrls.length}`;
        counter.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 16px;
            background: rgba(0, 0, 0, 0.5);
            padding: 8px 16px;
            border-radius: 20px;
        `;
        modal.appendChild(counter);
        
        const updateCounter = () => {
            counter.textContent = `${currentIndex + 1} / ${photoUrls.length}`;
        };
        
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + photoUrls.length) % photoUrls.length;
            updateImage();
            updateCounter();
        };
        
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % photoUrls.length;
            updateImage();
            updateCounter();
        };
    }
    
    // Zavření
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 24px;
        padding: 12px 16px;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onclick = () => modal.remove();
    modal.appendChild(closeBtn);
    
    modal.appendChild(img);
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    // Klávesnice
    const handleKey = (e) => {
        if (e.key === 'Escape') modal.remove();
        if (e.key === 'ArrowLeft' && photoUrls.length > 1) {
            currentIndex = (currentIndex - 1 + photoUrls.length) % photoUrls.length;
            updateImage();
            updateCounter();
        }
        if (e.key === 'ArrowRight' && photoUrls.length > 1) {
            currentIndex = (currentIndex + 1) % photoUrls.length;
            updateImage();
            updateCounter();
        }
    };
    document.addEventListener('keydown', handleKey);
    modal.addEventListener('remove', () => {
        document.removeEventListener('keydown', handleKey);
    });
    
    document.body.appendChild(modal);
}

// Export funkcí pro globální použití
window.ReviewsSystem = {
    createReview,
    fetchReviewsForTarget,
    fetchReviewsByAuthor,
    fetchAllReviewsForAdmin,
    updateReviewAsAdmin,
    deleteReviewAsAdmin,
    computeRatingsStats,
    renderReviews,
    renderRatingsChart,
    openReviewPhotoLightbox,
    isAdmin,
    getUserName: getUserName
};

// Export pro globální použití (kompatibilita)
window.createReview = createReview;
window.fetchReviewsForTarget = fetchReviewsForTarget;
window.fetchReviewsByAuthor = fetchReviewsByAuthor;
window.fetchAllReviewsForAdmin = fetchAllReviewsForAdmin;
window.updateReviewAsAdmin = updateReviewAsAdmin;
window.deleteReviewAsAdmin = deleteReviewAsAdmin;
window.computeRatingsStats = computeRatingsStats;
window.renderReviews = renderReviews;
window.renderRatingsChart = renderRatingsChart;
window.openReviewPhotoLightbox = openReviewPhotoLightbox;
window.getUserName = getUserName; // Export pro admin rozhraní
window.ReviewsSystem = {
    createReview,
    fetchReviewsForTarget,
    fetchReviewsByAuthor,
    fetchAllReviewsForAdmin,
    updateReviewAsAdmin,
    deleteReviewAsAdmin,
    computeRatingsStats,
    renderReviews,
    renderRatingsChart,
    openReviewPhotoLightbox,
    getUserName,
    isAdmin // Export isAdmin funkce
};
