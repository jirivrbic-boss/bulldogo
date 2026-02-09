import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../auth';

/**
 * Typ pro stav předplatného
 */
export interface SubscriptionData {
  isSubscribed: boolean;
  isLoading: boolean;
  subscriptionEnd: Date | null;
  isCanceled: boolean;
  subscriptionId: string | null;
  status: 'active' | 'trialing' | 'expired' | 'error' | null;
}

/**
 * Typ pro Stripe předplatné z Firestore
 */
interface StripeSubscription {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  current_period_end: Timestamp;
  cancel_at_period_end: boolean;
  items?: any[];
  metadata?: Record<string, any>;
  price?: {
    id: string;
    product: string;
  };
}

/**
 * Custom hook pro real-time sledování stavu předplatného uživatele
 * Funguje s oficiální Stripe Extension "Run Payments with Stripe"
 * 
 * @param userId - ID přihlášeného uživatele
 * @returns Stav předplatného s real-time aktualizacemi
 * 
 * @example
 * ```tsx
 * const { isSubscribed, isLoading, subscriptionEnd, isCanceled } = useSubscription(user?.uid);
 * 
 * if (isLoading) return <Loading />;
 * if (!isSubscribed) return <Navigate to="/packages" />;
 * return <PremiumContent />;
 * ```
 */
export const useSubscription = (userId: string | undefined): SubscriptionData => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
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
        let validSubscription: (StripeSubscription & { id: string }) | null = null;
        const now = new Date();

        snapshot.forEach((doc) => {
          const data = doc.data() as StripeSubscription;
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
              ...data
            };
          }
        });

        if (validSubscription) {
          // Našli jsme platné předplatné
          setSubscriptionData({
            isSubscribed: true,
            isLoading: false,
            subscriptionEnd: validSubscription.current_period_end.toDate(),
            isCanceled: validSubscription.cancel_at_period_end || false,
            subscriptionId: validSubscription.id,
            status: validSubscription.status === 'active' || validSubscription.status === 'trialing' 
              ? validSubscription.status 
              : 'active'
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

/**
 * Pomocná funkce pro kontrolu, zda má uživatel aktivní předplatné
 * Použitelné pro inline podmínky
 */
export const checkIfSubscribed = async (userId: string): Promise<boolean> => {
  try {
    const subscriptionsRef = collection(db, 'customers', userId, 'subscriptions');
    const q = query(subscriptionsRef, where('status', 'in', ['active', 'trialing']));
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;

    const now = new Date();
    let hasValid = false;

    snapshot.forEach((doc) => {
      const data = doc.data() as StripeSubscription;
      const periodEnd = data.current_period_end?.toDate();
      if (periodEnd && periodEnd > now) {
        hasValid = true;
      }
    });

    return hasValid;
  } catch (error) {
    console.error('Chyba při kontrole předplatného:', error);
    return false;
  }
};
