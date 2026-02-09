#!/bin/bash

# 🚀 Quick Start - Cloud Functions Deploy
# Pro okamžité nasazení spusť: ./quick-start.sh

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🚀 Cloud Functions - Quick Start                          ║"
echo "║  Automatická deaktivace inzerátů při expiraci předplatného ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Funkce pro kontrolu chyb
check_error() {
    if [ $? -ne 0 ]; then
        echo "❌ Chyba: $1"
        exit 1
    fi
}

# Krok 1: Zkontrolovat Firebase projekt
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Krok 1/5: Kontrola Firebase projektu"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Zkontrolovat zda je firebase-tools nainstalovaný
if ! command -v firebase &> /dev/null; then
    echo "⚠️  firebase-tools není nainstalovaný!"
    echo ""
    echo "Nainstaluj pomocí:"
    echo "  npm install -g firebase-tools"
    echo "  firebase login"
    echo ""
    exit 1
fi

# Zkontrolovat aktuální projekt
CURRENT_PROJECT=$(firebase use 2>/dev/null | grep "active project" | awk '{print $4}')
if [ -z "$CURRENT_PROJECT" ]; then
    echo "⚠️  Firebase projekt není nastaven!"
    echo ""
    echo "Nastav projekt pomocí:"
    echo "  firebase use --add"
    echo ""
    exit 1
fi

echo "✅ Firebase projekt: $CURRENT_PROJECT"
echo ""

# Krok 2: Zkontrolovat functions složku
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 Krok 2/5: Kontrola functions složky"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -d "functions" ]; then
    echo "❌ Složka 'functions' nebyla nalezena!"
    exit 1
fi

if [ ! -f "functions/src/index.ts" ]; then
    echo "❌ Soubor 'functions/src/index.ts' nebyl nalezen!"
    exit 1
fi

echo "✅ Cloud Functions kód nalezen"
echo "   - functions/src/index.ts (370 řádků)"
echo ""

# Krok 3: Instalace závislostí
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Krok 3/5: Instalace závislostí"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd functions
echo "Spouštím: npm install"
npm install --silent
check_error "Instalace závislostí selhala"
cd ..

echo "✅ Závislosti nainstalovány"
echo ""

# Krok 4: Build TypeScript
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Krok 4/5: Build TypeScript"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd functions
echo "Spouštím: npm run build"
npm run build
check_error "Build TypeScript selhal"
cd ..

echo "✅ TypeScript zkompilován"
echo "   - functions/lib/index.js"
echo ""

# Krok 5: Deploy
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Krok 5/5: Deploy do Firebase"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Pozor: Vyžaduje Blaze plán (pay-as-you-go)"
echo "   Pro malé projekty: ZDARMA (free tier: 2M invocations)"
echo ""
read -p "Pokračovat v deploymentu? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment zrušen uživatelem"
    exit 1
fi

echo ""
echo "Spouštím: firebase deploy --only functions"
firebase deploy --only functions
check_error "Deployment selhal"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT DOKONČEN!                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Co bylo nasazeno:"
echo "   ✅ onSubscriptionExpired (Firestore trigger)"
echo "   ✅ onSubscriptionActivated (Firestore trigger)"
echo "   ✅ checkExpiredSubscriptions (Scheduled)"
echo ""
echo "🔍 Další kroky:"
echo ""
echo "1. Zkontroluj deployment v konzoli:"
echo "   https://console.firebase.google.com/project/$CURRENT_PROJECT/functions"
echo ""
echo "2. Sleduj logy pro ověření:"
echo "   firebase functions:log"
echo ""
echo "3. Proveď testovací expiraci:"
echo "   - Změň subscription dokument v Firestore"
echo "   - Nastav current_period_end na minulost"
echo "   - Sleduj logy: firebase functions:log --only onSubscriptionExpired"
echo ""
echo "4. Přečti si dokumentaci:"
echo "   - IMPLEMENTATION_COMPLETE.md (přehled)"
echo "   - CLOUD_FUNCTIONS_TESTING.md (testování)"
echo "   - DOCUMENTATION_INDEX.md (index všech dokumentů)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Hotovo! Inzeráty se nyní automaticky deaktivují při expiraci."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
