export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registered:', registration);

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New version available! Please refresh.');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('ServiceWorker registration failed:', error);
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

export function checkOnlineStatus(): boolean {
  return navigator.onLine;
}

export function addOnlineStatusListener(callback: (isOnline: boolean) => void) {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export async function syncPendingTransactions() {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      if (registration.sync) {
        await registration.sync.register('sync-transactions');
        console.log('Background sync registered');
      }
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
}

interface PendingTransaction {
  id: string;
  data: unknown;
  timestamp: number;
}

export async function savePendingTransaction(data: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('pending_transactions', 'readwrite');
  const store = tx.objectStore('pending_transactions');

  const transaction: PendingTransaction = {
    id: crypto.randomUUID(),
    data,
    timestamp: Date.now(),
  };

  await store.add(transaction);
  await syncPendingTransactions();
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await openDB();
  const tx = db.transaction('pending_transactions', 'readonly');
  const store = tx.objectStore('pending_transactions');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pos-db', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('pending_transactions')) {
        db.createObjectStore('pending_transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_products')) {
        db.createObjectStore('cached_products', { keyPath: 'id' });
      }
    };
  });
}
