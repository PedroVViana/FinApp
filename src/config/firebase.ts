import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  connectFirestoreEmulator, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// For debugging in development only
if (import.meta.env.DEV) {
  console.log('Firebase initialized with config:', 
    Object.keys(firebaseConfig).reduce((acc, key) => {
      // Mostra apenas primeiros e últimos caracteres das chaves por segurança
      const value = (firebaseConfig as any)[key];
      if (typeof value === 'string' && value.length > 8) {
        return { ...acc, [key]: `${value.substring(0, 3)}...${value.substring(value.length - 3)}` };
      }
      return { ...acc, [key]: value };
    }, {})
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence settings
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

console.log('[FIREBASE] Inicializado com persistência de dados aprimorada');

// Use emulator in development if VITE_USE_FIREBASE_EMULATOR is set
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('Connected to Firestore emulator');
}

// Only initialize Analytics in production and if available
let analytics = null;
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.error('Analytics initialization error:', error);
  }
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { analytics };

// Configurações adicionais do provedor Google
googleProvider.setCustomParameters({
  prompt: 'select_account'
}); 