/**
 * PŘÍKLAD 1: Použití v hlavní komponentě aplikace
 * 
 * Tento příklad ukazuje, jak použít useSubscription hook
 * pro zobrazení stavu předplatného v navigaci nebo dashboardu
 */

import React from 'react';
import { useAuth } from './hooks/useAuth'; // Váš auth hook
import { useSubscription } from './hooks/useSubscription';

function App() {
  const { user } = useAuth(); // Předpokládám, že máte auth context
  const { 
    isSubscribed, 
    isLoading, 
    subscriptionEnd, 
    isCanceled,
    status 
  } = useSubscription(user?.uid);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <p>Načítání stavu předplatného...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <nav>
          {/* Zobrazení stavu předplatného */}
          {isSubscribed ? (
            <div className="subscription-badge active">
              <span>✓ Aktivní předplatné</span>
              {isCanceled && (
                <span className="warning">
                  Vyprší: {subscriptionEnd?.toLocaleDateString('cs-CZ')}
                </span>
              )}
            </div>
          ) : (
            <div className="subscription-badge inactive">
              <span>⚠️ Bez předplatného</span>
              <button onClick={() => window.location.href = '/packages.html'}>
                Aktivovat
              </button>
            </div>
          )}
        </nav>
      </header>

      <main>
        {/* Váš obsah aplikace */}
      </main>
    </div>
  );
}

export default App;


/**
 * PŘÍKLAD 2: Ochrana Route / Komponenty
 * 
 * HOC (Higher Order Component) pro ochranu stránek,
 * které vyžadují aktivní předplatné
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSubscription } from './hooks/useSubscription';

export function ProtectedRoute({ children, requireSubscription = false }) {
  const { user, loading: authLoading } = useAuth();
  const { isSubscribed, isLoading: subLoading } = useSubscription(user?.uid);

  // Čekáme na načtení autentizace
  if (authLoading) {
    return <div>Načítání...</div>;
  }

  // Pokud není přihlášen, přesměruj na login
  if (!user) {
    return <Navigate to="/index.html" replace />;
  }

  // Pokud je potřeba předplatné
  if (requireSubscription) {
    // Čekáme na načtení stavu předplatného
    if (subLoading) {
      return <div>Kontrola předplatného...</div>;
    }

    // Pokud není předplatné, přesměruj na packages
    if (!isSubscribed) {
      return <Navigate to="/packages.html" replace />;
    }
  }

  // Vše OK, zobraz chráněný obsah
  return children;
}


/**
 * PŘÍKLAD 3: Použití v React Router
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Veřejné stránky */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Chráněné stránky - pouze přihlášení uživatelé */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Prémiové stránky - vyžadují aktivní předplatné */}
        <Route 
          path="/premium-features" 
          element={
            <ProtectedRoute requireSubscription={true}>
              <PremiumFeaturesPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/statistiky" 
          element={
            <ProtectedRoute requireSubscription={true}>
              <StatistikyPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}


/**
 * PŘÍKLAD 4: Použití pro podmíněné zobrazení funkcí
 */

function DashboardPage() {
  const { user } = useAuth();
  const { isSubscribed, subscriptionEnd, isCanceled } = useSubscription(user?.uid);

  return (
    <div className="dashboard">
      <h1>Můj Dashboard</h1>

      {/* Zobrazení informací o předplatném */}
      {isSubscribed ? (
        <div className="subscription-info">
          <h2>Vaše předplatné</h2>
          <p>Status: ✓ Aktivní</p>
          <p>Platné do: {subscriptionEnd?.toLocaleDateString('cs-CZ')}</p>
          {isCanceled && (
            <div className="alert warning">
              Vaše předplatné se po tomto datu neobnoví.
              <button onClick={handleReactivate}>Znovu aktivovat</button>
            </div>
          )}
        </div>
      ) : (
        <div className="subscription-info">
          <h2>Nemáte aktivní předplatné</h2>
          <p>Získejte přístup k premium funkcím!</p>
          <a href="/packages.html" className="btn-primary">
            Zobrazit balíčky
          </a>
        </div>
      )}

      {/* Podmíněné zobrazení funkcí */}
      <div className="features">
        <h2>Funkce</h2>
        
        {/* Základní funkce - vždy dostupné */}
        <button onClick={handleBasicFeature}>
          Základní funkce
        </button>

        {/* Premium funkce - pouze pro předplatitele */}
        {isSubscribed ? (
          <button onClick={handlePremiumFeature}>
            Premium funkce
          </button>
        ) : (
          <button disabled title="Vyžaduje aktivní předplatné">
            Premium funkce 🔒
          </button>
        )}
      </div>
    </div>
  );
}


/**
 * PŘÍKLAD 5: Inline použití s vanilla HTML stránkami
 * 
 * Pokud používáte vanilla JavaScript místo Reactu,
 * zde je ekvivalent pro vaše HTML stránky:
 */

// V auth.js přidejte tuto funkci:
export function subscribeToUserSubscription(userId, callback) {
  if (!userId) {
    callback({ isSubscribed: false, isLoading: false });
    return () => {};
  }

  const subscriptionsRef = collection(db, 'customers', userId, 'subscriptions');
  const q = query(subscriptionsRef, where('status', 'in', ['active', 'trialing']));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback({ 
        isSubscribed: false, 
        isLoading: false,
        subscriptionEnd: null,
        isCanceled: false 
      });
      return;
    }

    const now = new Date();
    let validSubscription = null;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const periodEnd = data.current_period_end?.toDate();
      
      if (periodEnd && periodEnd > now) {
        validSubscription = {
          id: doc.id,
          ...data,
          current_period_end: periodEnd
        };
      }
    });

    if (validSubscription) {
      callback({
        isSubscribed: true,
        isLoading: false,
        subscriptionEnd: validSubscription.current_period_end,
        isCanceled: validSubscription.cancel_at_period_end || false,
        status: validSubscription.status
      });
    } else {
      callback({
        isSubscribed: false,
        isLoading: false,
        subscriptionEnd: null,
        isCanceled: false
      });
    }
  });

  return unsubscribe;
}

// Použití ve vaší HTML stránce:
// <script type="module">
//   import { subscribeToUserSubscription } from './auth.js';
//   
//   let unsubscribe;
//   
//   onAuthStateChanged(auth, (user) => {
//     if (user) {
//       unsubscribe = subscribeToUserSubscription(user.uid, (subData) => {
//         if (!subData.isSubscribed) {
//           // Přesměruj na packages nebo zobraz varování
//           window.location.href = '/packages.html';
//         } else {
//           // Uživatel má předplatné
//           console.log('Předplatné aktivní do:', subData.subscriptionEnd);
//         }
//       });
//     } else if (unsubscribe) {
//       unsubscribe();
//     }
//   });
// </script>
