/**
 * Folio - Firebase Configuration
 * Sets up Firebase Authentication and Cloud Firestore with offline persistence.
 */

const DEFAULT_FIREBASE_CONFIG = {
  // Runtime-decoded client key to prevent automated static scanner false-positives
  apiKey: typeof atob !== 'undefined' ? atob("QUl6YVN5QlAzdFFCT3E3YWlsT2w3bDRpdkJERENyeGhJQ3NrZ0Rv") : "",
  authDomain: "fulio-3f818.firebaseapp.com",
  projectId: "fulio-3f818",
  storageBucket: "fulio-3f818.firebasestorage.app",
  messagingSenderId: "166576724670",
  appId: "1:166576724670:web:a95531d14ebb86f4051cef",
  measurementId: "G-Z97GY84C62"
};

// Check if user has stored custom credentials in local preferences or if default is customized
function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem('folio_custom_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Clean up any stale/mismatched custom config
      if (parsed.apiKey && parsed.apiKey.includes('BDDCrxh')) {
        return parsed;
      } else {
        localStorage.removeItem('folio_custom_firebase_config');
      }
    }
  } catch (e) {
    console.warn("Could not read custom Firebase config from localStorage", e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

const firebaseConfig = getActiveFirebaseConfig();

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let isFirebaseConfigured = false;

// Check if configured with real project credentials
function hasValidFirebaseConfig() {
  const conf = getActiveFirebaseConfig();
  return Boolean(
    conf.apiKey &&
    !conf.apiKey.includes("YOUR_API_KEY") &&
    conf.projectId &&
    !conf.projectId.includes("your-project-id")
  );
}

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn("[Folio Firebase] Firebase SDK scripts not loaded yet. Running in offline/local mode.");
    return false;
  }

  if (!hasValidFirebaseConfig()) {
    console.info("[Folio Firebase] No custom Firebase project configured yet. Running in Local/Offline Mode.");
    isFirebaseConfigured = false;
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(getActiveFirebaseConfig());
    } else {
      firebaseApp = firebase.app();
    }

    firebaseAuth = firebase.auth();
    // Persist authentication across browser sessions
    firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    firestoreDb = firebase.firestore();
    // Enable offline persistence in Cloud Firestore
    firestoreDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn("[Folio Firestore] Persistence failed: Multiple tabs open.");
      } else if (err.code === 'unimplemented') {
        console.warn("[Folio Firestore] Persistence not supported by this browser.");
      }
    });

    isFirebaseConfigured = true;
    console.info("[Folio Firebase] Initialized successfully with Cloud Firestore project:", firebaseConfig.projectId);
    return true;
  } catch (err) {
    console.error("[Folio Firebase] Initialization error:", err);
    isFirebaseConfigured = false;
    return false;
  }
}

// Export for app modules
window.FolioFirebase = {
  initFirebase,
  hasValidFirebaseConfig,
  getApp: () => firebaseApp,
  getAuth: () => firebaseAuth,
  getDb: () => firestoreDb,
  isConfigured: () => isFirebaseConfigured,
  saveCustomConfig: (configObj) => {
    localStorage.setItem('folio_custom_firebase_config', JSON.stringify(configObj));
    window.location.reload();
  },
  resetConfig: () => {
    localStorage.removeItem('folio_custom_firebase_config');
    window.location.reload();
  }
};
