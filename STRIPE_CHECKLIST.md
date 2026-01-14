# ✅ Stripe Checklist - Co zkontrolovat a nastavit

## 🔴 KRITICKÉ - Musí být správně nastaveno

### 1. **Trial NENÍ nastavený na Price**
   - **Kde:** Stripe Dashboard → Products → [Hobby balíček / Firma balíček] → Prices
   - **Co zkontrolovat:**
     - Otevři každý Price (price_1Sf26X1aQBd6ajy2BPS7ioTv pro Hobby, price_1Sf26s1aQBd6ajy2a5mNNLst pro Firmu)
     - **Trial period** musí být **prázdné** nebo **0**
     - Pokud je tam nastavený trial (např. 30 dní), **ODSTRAŇ HO**
   - **Proč:** Pokud je trial na Price, Stripe ho automaticky aplikuje při každém checkoutu, i když uživatel trial už měl

### 2. **Firebase Extension je aktivní**
   - **Kde:** Firebase Console → Extensions → Stripe Payments
   - **Co zkontrolovat:**
     - Extension je nainstalovaná a aktivní
     - Stripe Secret Key je správně nastavený
     - Webhook endpoint je správně nakonfigurovaný

## 🟡 DŮLEŽITÉ - Zkontrolovat správné nastavení

### 3. **Webhook pro faktury**
   - **Kde:** Stripe Dashboard → Developers → Webhooks
   - **Co zkontrolovat:**
     - Webhook endpoint: `https://europe-west1-inzerio-inzerce.cloudfunctions.net/stripeInvoiceWebhook`
     - Events: `invoice.finalized`, `invoice.payment_succeeded`
     - Webhook je aktivní a funguje (zkontroluj logy)

### 4. **Jeden Customer na uživatele**
   - **Kde:** Stripe Dashboard → Customers
   - **Co zkontrolovat:**
     - Firebase Extension automaticky vytváří jednoho Stripe Customer na Firebase UID
     - Metadata `firebaseUID` by mělo být nastavené na každém Customer záznamu
   - **Poznámka:** Toto by mělo být automatické díky Firebase Extension

### 5. **Products a Prices jsou správně nastavené**
   - **Kde:** Stripe Dashboard → Products
   - **Co zkontrolovat:**
     - "Hobby balíček" existuje s recurring price
     - "Firma balíček" existuje s recurring price
     - Prices jsou aktivní
     - Prices **NEMAJÍ** nastavený trial period

## 🟢 VOLITELNÉ - Pro lepší UX

### 6. **Customer Portal je povolený**
   - **Kde:** Stripe Dashboard → Settings → Billing → Customer portal
   - **Co zkontrolovat:**
     - Customer portal je aktivní
     - Uživatelé mohou zrušit subscription přes portál
     - Nastavení zrušení (okamžité vs. na konci období)

### 7. **Email notifikace**
   - **Kde:** Stripe Dashboard → Settings → Emails
   - **Co zkontrolovat:**
     - Emaily pro faktury jsou povolené
     - Emaily pro subscription events jsou povolené

## 📝 Postup kontroly Trial na Price:

1. Otevři Stripe Dashboard: https://dashboard.stripe.com/
2. Jdi na **Products**
3. Klikni na **"Hobby balíček"** (nebo "Firma balíček")
4. Klikni na **Price** (price_1Sf26X1aQBd6ajy2BPS7ioTv nebo price_1Sf26s1aQBd6ajy2a5mNNLst)
5. Zkontroluj sekci **"Recurring"** nebo **"Billing"**
6. Pokud vidíš **"Trial period"** s hodnotou (např. 30 dní):
   - Klikni na **"Edit"** nebo **"..."** → **"Edit price"**
   - Nastav **"Trial period"** na **prázdné** nebo **0**
   - Ulož změny
7. Opakuj pro druhý Price

## ⚠️ DŮLEŽITÉ UPOZORNĚNÍ:

**Trial musí být řízený POUZE přes backend (Cloud Function), NIKDY ne na Price!**

- ✅ Správně: Trial se nastavuje dynamicky v `createCheckoutSession` Cloud Function
- ❌ Špatně: Trial je nastavený na Price v Stripe Dashboard

## 🔍 Jak otestovat, že to funguje:

1. Vytvoř testovací účet
2. Aktivuj trial subscription
3. Zruš subscription (29. den)
4. Zkus znovu aktivovat subscription
5. **Očekávaný výsledek:** Trial by se NEMĚL nastavit, měla by se hned začít platit
