#!/bin/bash

# 🚀 Deploy script pro Firebase Cloud Functions
# Použití: ./deploy-functions.sh

set -e  # Ukončit při chybě

echo "🔧 Firebase Cloud Functions - Deploy Script"
echo "=========================================="
echo ""

# Zkontrolovat, že jsme ve správném adresáři
if [ ! -d "functions" ]; then
    echo "❌ Chyba: Složka 'functions' nebyla nalezena!"
    echo "   Ujisti se, že spouštíš tento script z kořenového adresáře projektu."
    exit 1
fi

# Přejít do functions složky
cd functions

echo "📦 Krok 1/4: Instalace závislostí..."
npm install

echo ""
echo "🔨 Krok 2/4: Build TypeScript..."
npm run build

echo ""
echo "🧪 Krok 3/4: Lint kontrola..."
npm run lint || echo "⚠️ Lint našel problémy, ale pokračuji..."

echo ""
echo "🚀 Krok 4/4: Deploy do Firebase..."
firebase deploy --only functions

echo ""
echo "✅ Hotovo!"
echo ""
echo "📊 Zkontroluj deployment:"
echo "   https://console.firebase.google.com/project/_/functions"
echo ""
echo "📋 Sleduj logy:"
echo "   firebase functions:log"
echo ""
