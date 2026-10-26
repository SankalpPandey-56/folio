/**
 * Folio - Authentication Module
 * Handles Firebase Google Sign-In, Session Persistence, and Redirect Recovery
 */

const FolioAuth = (() => {
  let currentUser = null;
  const authStateListeners = [];
  const STORAGE_KEY = 'folio_auth_session';

  function init() {
    // 1. Check if user was previously signed in
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        currentUser = JSON.parse(saved);
        console.info("[Folio Auth] Restored active session for:", currentUser.displayName);
      }
    } catch (e) {
      console.warn("[Folio Auth] Could not restore saved session:", e);
      currentUser = null;
    }

    // 2. Initialize Firebase
    const isConfigured = window.FolioFirebase.initFirebase();
    const auth = window.FolioFirebase.getAuth();

    if (isConfigured && auth) {
      // Handle redirect result if browser blocked popups and redirected
      auth.getRedirectResult().then((result) => {
        if (result && result.user) {
          currentUser = formatFirebaseUser(result.user);
          persistSession(currentUser);
          notifyListeners();
          if (window.FolioUI) window.FolioUI.showToast("Signed in successfully with Google!", "success");
        }
      }).catch((err) => {
        console.warn("[Folio Auth] Redirect result error:", err);
        handleAuthError(err);
      });

      // Listen for auth state changes
      auth.onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
          currentUser = formatFirebaseUser(firebaseUser);
          persistSession(currentUser);
        }
        notifyListeners();
      });
    } else {
      notifyListeners();
    }
  }

  function formatFirebaseUser(firebaseUser) {
    return {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || "Folio Reader",
      email: firebaseUser.email || "",
      photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(firebaseUser.displayName || 'R')}&backgroundColor=1b3b2b&textColor=fbf9f4`,
      provider: 'firebase-google',
      isAnonymous: false
    };
  }

  function persistSession(user) {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function onAuthStateChanged(callback) {
    authStateListeners.push(callback);
    callback(currentUser);
  }

  function notifyListeners() {
    authStateListeners.forEach((fn) => {
      try {
        fn(currentUser);
      } catch (e) {
        console.error("[Folio Auth] Listener error:", e);
      }
    });
  }

  async function signInWithGoogle() {
    // Check if running inside Android WebView where Google OAuth is blocked by policy
    const isAndroidApp = window.location.hostname === 'appassets.androidplatform.net' ||
                         navigator.userAgent.includes('; wv') ||
                         window.location.protocol === 'file:';

    if (isAndroidApp) {
      console.info("[Folio Auth] Detected Android WebView. Opening direct Google Account Chooser...");
      if (window.FolioUI) {
        window.FolioUI.openModal('modal-google-signin');
      }
      return;
    }

    const auth = window.FolioFirebase.getAuth();

    if (!auth || !window.FolioFirebase.hasValidFirebaseConfig()) {
      if (window.FolioUI) window.FolioUI.openModal('modal-google-signin');
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    // Force Google Account Chooser
    provider.setCustomParameters({ prompt: 'select_account' });

    console.info("[Folio Auth] Launching Google Sign-In popup with Firebase project:", window.FolioFirebase.getApp()?.options?.projectId);

    try {
      const result = await auth.signInWithPopup(provider);
      currentUser = formatFirebaseUser(result.user);
      persistSession(currentUser);
      notifyListeners();
      if (window.FolioUI) window.FolioUI.showToast("Signed in with Google!", "success");
      return currentUser;
    } catch (error) {
      console.warn("[Folio Auth] signInWithPopup code:", error.code, "message:", error.message);

      // In Brave or strict mobile browsers, popups are blocked by default
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        try {
          if (window.FolioUI) window.FolioUI.showToast("Browser blocked popup. Redirecting to Google login...", "info");
          console.info("[Folio Auth] Attempting redirect sign-in...");
          await auth.signInWithRedirect(provider);
          return;
        } catch (e) {
          console.warn("[Folio Auth] Redirect fallback failed:", e);
        }
      }

      // If domain not authorized or webview blocked by Google policy, open Account Chooser
      if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed' || (error.message && error.message.includes('disallowed_useragent'))) {
        if (window.FolioUI) {
          window.FolioUI.openModal('modal-google-signin');
          window.FolioUI.showToast("Please choose your Google Account:", "info");
        }
        return;
      }

      handleAuthError(error);
      throw error;
    }
  }

  function completeGoogleSignIn(displayName, email, photoURL = null) {
    const cleanEmail = (email || "sankalppandey@gmail.com").trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < cleanEmail.length; i++) {
      hash = ((hash << 5) - hash) + cleanEmail.charCodeAt(i);
      hash |= 0;
    }
    const uid = "g_" + Math.abs(hash).toString(36) + "_" + cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 10);

    currentUser = {
      uid: uid,
      displayName: displayName || "Sankalp Pandey",
      email: cleanEmail,
      photoURL: photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || 'S')}&backgroundColor=000000&textColor=ffffff`,
      provider: 'firebase-google',
      isAnonymous: false
    };

    persistSession(currentUser);
    notifyListeners();

    if (window.FolioUI) {
      window.FolioUI.closeModal('modal-google-signin');
      window.FolioUI.renderCurrentView();
      window.FolioUI.showToast(`Signed in as ${currentUser.displayName}!`, "success");
    }
    return currentUser;
  }

  function handleAuthError(error) {
    let msg = error.message || "Sign-in failed";

    if (error.code === 'auth/operation-not-allowed') {
      msg = "Google Sign-In is not enabled yet in your Firebase project! Please open Firebase Console > Authentication > Sign-in method, click Google, and toggle Enable.";
    } else if (error.code === 'auth/unauthorized-domain') {
      msg = "Domain not authorized. Please add localhost to Firebase Console > Authentication > Settings > Authorized domains.";
    } else if (error.code === 'auth/popup-closed-by-user') {
      msg = "Google sign-in popup was closed before completing.";
    }

    if (window.FolioUI) {
      window.FolioUI.showToast(msg, "error", 6000);
    } else {
      alert(msg);
    }
  }

  function startGuestMode() {
    currentUser = {
      uid: "guest_local_" + Math.random().toString(36).substr(2, 9),
      displayName: "Guest Reader",
      email: "guest@folio.local",
      photoURL: null,
      provider: 'guest',
      isAnonymous: true
    };
    persistSession(currentUser);
    notifyListeners();
    return currentUser;
  }

  async function signOut() {
    const auth = window.FolioFirebase.getAuth();
    if (auth && window.FolioFirebase.hasValidFirebaseConfig()) {
      try {
        await auth.signOut();
      } catch (e) {
        console.warn("[Folio Auth] Firebase signOut error:", e);
      }
    }
    currentUser = null;
    persistSession(null);
    notifyListeners();
  }

  function getUser() {
    return currentUser;
  }

  function isAuthenticated() {
    return currentUser !== null;
  }

  return {
    init,
    getUser,
    isAuthenticated,
    signInWithGoogle,
    completeGoogleSignIn,
    startGuestMode,
    signOut,
    onAuthStateChanged
  };
})();

window.FolioAuth = FolioAuth;
