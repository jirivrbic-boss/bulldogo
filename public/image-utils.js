/**
 * Pomocné funkce pro práci s obrázky a WebP
 */

/**
 * Vytvoří URL WebP verze obrázku (pokud existuje)
 * @param {string} imageUrl - URL původního obrázku
 * @returns {string|null} - URL WebP verze nebo null
 */
function getWebPUrl(imageUrl) {
    if (!imageUrl) return null;
    
    // Pokud je to již WebP, vrátit stejné URL
    if (imageUrl.endsWith('.webp')) return null;
    
    // Pokud je to Firebase Storage URL, přidat .webp před query parametry
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
        const url = new URL(imageUrl);
        const pathname = url.pathname;
        if (!pathname.endsWith('.webp')) {
            url.pathname = pathname + '.webp';
            return url.toString();
        }
        return null;
    }
    
    // Pro lokální soubory, nahradit příponu
    if (imageUrl.includes('/fotky/')) {
        return imageUrl.replace(/\.(png|jpg|jpeg|PNG|JPG|JPEG)(\?.*)?$/, '.webp$2');
    }
    
    // Pro ostatní URL, zkusit přidat .webp
    const match = imageUrl.match(/\.(png|jpg|jpeg|PNG|JPG|JPEG)(\?|#|$)/);
    if (match) {
        return imageUrl.replace(/\.(png|jpg|jpeg|PNG|JPG|JPEG)(\?|#|$)/, '.webp$2');
    }
    
    return null;
}

/**
 * Vytvoří HTML picture element s WebP fallbackem
 * @param {string} imageUrl - URL původního obrázku
 * @param {string} alt - Alt text
 * @param {string} additionalAttributes - Další atributy (loading, decoding, class, atd.)
 * @returns {string} - HTML kód picture elementu
 */
function createPictureElement(imageUrl, alt = '', additionalAttributes = '') {
    if (!imageUrl) {
        return `<img src="/fotky/vychozi-inzerat.webp" alt="${alt}" ${additionalAttributes} onerror="this.src='/fotky/vychozi-inzerat.png'">`;
    }
    
    const webpUrl = getWebPUrl(imageUrl);
    
    // Pokud není WebP URL (už je WebP nebo neznámý formát), použít obyčejný img
    if (!webpUrl) {
        return `<img src="${imageUrl}" alt="${alt}" ${additionalAttributes}>`;
    }
    
    // Escape URL pro HTML atributy
    const escapedImageUrl = imageUrl.replace(/"/g, '&quot;');
    const escapedWebpUrl = webpUrl.replace(/"/g, '&quot;');
    const escapedAlt = alt.replace(/"/g, '&quot;');
    
    // Vytvořit picture element s fallbackem
    return `
        <picture>
            <source srcset="${escapedWebpUrl}" type="image/webp">
            <img src="${escapedImageUrl}" alt="${escapedAlt}" ${additionalAttributes}>
        </picture>
    `.trim();
}

/**
 * Zkontroluje, zda prohlížeč podporuje WebP (pomocí JavaScript)
 * Tato funkce může být použita pro podmíněné načítání
 */
function supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

// Export pro globální použití
window.getWebPUrl = getWebPUrl;
window.createPictureElement = createPictureElement;
window.supportsWebP = supportsWebP;

