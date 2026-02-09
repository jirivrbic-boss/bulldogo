import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../auth'; // Upravte cestu k vašemu Firebase config

/**
 * Custom hook pro real-time sledování stavu předplatného uživatele
 * Funguje s oficiální Stripe Extension "Run Payments with Stripe"
 * 
 * @param {string} userId - ID přihlášeného uživatele
 * @returns {Object} - Stav předplatného
 */
export const useSubscription = (userId) => {
  const [subscriptionData, setSubscriptionData] = useState({
    isSubscribed: false,
    isLoading: true,
    subscriptionEnd: null,
    isCanceled: false,
    subscriptionId: null,
    status: null
  });

  useEffect(() => {
    // Pokud není userId, vrátíme prázdný stav
    if (!userId) {
      setSubscriptionData({
        isSubscribed: false,
        isLoading: false,
        subscriptionEnd: null,
        isCanceled: false,
        subscriptionId: null,
        status: null
      });
      return;
    }

    // Nastavíme referenci na subcollection předplatných
    const subscriptionsRef = collection(db, 'customers', userId, 'subscriptions');
    
    // Query pro active nebo trialing předplatné
    const q = query(
      subscriptionsRef,
      where('status', 'in', ['active', 'trialing'])
    );

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log('Subscription snapshot received:', snapshot.size, 'documents');
        
        if (snapshot.empty) {
          // Žádné aktivní předplatné
          setSubscriptionData({
            isSubscribed: false,
            isLoading: false,
            subscriptionEnd: null,
            isCanceled: false,
            subscriptionId: null,
            status: null
          });
          return;
        }

        // Projdeme všechny dokumenty a najdeme platné předplatné
        let validSubscription = null;
        const now = new Date();

        snapshot.forEach((doc) => {
          const data = doc.data();
          const periodEnd = data.current_period_end?.toDate();
          
          console.log('Checking subscription:', {
            id: doc.id,
            status: data.status,
            periodEnd,
            isExpired: periodEnd ? periodEnd < now : 'no date'
          });

          // Kontrola, zda předplatné ještě neexpirovala
          if (periodEnd && periodEnd > now) {
            validSubscription = {
              id: doc.id,
              ...data,
              current_period_end: periodEnd
            };
          }
        });

        if (validSubscription) {
          // Našli jsme platné předplatné
          setSubscriptionData({
            isSubscribed: true,
            isLoading: false,
            subscriptionEnd: validSubscription.current_period_end,
            isCanceled: validSubscription.cancel_at_period_end || false,
            subscriptionId: validSubscription.id,
            status: validSubscription.status
          });
        } else {
          // Všechna předplatné jsou expirovaná
          setSubscriptionData({
            isSubscribed: false,
            isLoading: false,
            subscriptionEnd: null,
            isCanceled: false,
            subscriptionId: null,
            status: 'expired'
          });
        }
      },
      (error) => {
        console.error('Chyba při načítání předplatného:', error);
        setSubscriptionData({
          isSubscribed: false,
          isLoading: false,
          subscriptionEnd: null,
          isCanceled: false,
          subscriptionId: null,
          status: 'error'
        });
      }
    );

    // Cleanup funkce - odpojí listener při unmount
    return () => unsubscribe();
  }, [userId]);

  return subscriptionData;
};
