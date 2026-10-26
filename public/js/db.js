/**
 * Folio - Database & Cloud Sync Module
 * Cloud Firestore source of truth with real-time sync, offline persistence,
 * and strict user-isolated storage. Zero data leakage across accounts.
 */

const FolioDB = (() => {
  let books = [];
  // let sessions = [];
  let reflections = [];
  let preferences = {
    theme: 'system',
    weeklyGoalMinutes: 120,
    weeklyGoalPages: 100,
    annualGoalBooks: 24
  };

  const changeListeners = [];
  const syncStatusListeners = [];
  let firestoreUnsubscribers = [];

  function setSyncStatus(status, message) {
    syncStatusListeners.forEach(fn => fn({ status, message, timestamp: new Date() }));
  }

  function onSyncStatusChange(callback) {
    syncStatusListeners.push(callback);
  }

  function onDataChange(callback) {
    changeListeners.push(callback);
  }

  function notifyDataChange() {
    changeListeners.forEach(fn => {
      try {
        fn({ books, sessions, reflections, preferences });
      } catch (e) {
        console.error("[Folio DB] Change listener error:", e);
      }
    });
  }

  // Local Storage Helpers (Strictly isolated by authenticated userId)
  function getStorageKey(type, userId) {
    return `folio_u_${userId}_${type}`;
  }

  function loadLocalData(userId) {
    try {
      const bStr = localStorage.getItem(getStorageKey('books', userId));
      const sStr = localStorage.getItem(getStorageKey('sessions', userId));
      const rStr = localStorage.getItem(getStorageKey('reflections', userId));
      const pStr = localStorage.getItem(getStorageKey('preferences', userId));

      // Filter out any legacy sample data
      books = bStr ? JSON.parse(bStr).filter(b => b.id !== "sample_deep_work") : [];
      sessions = sStr ? JSON.parse(sStr).filter(s => s.id !== "sample_session_1") : [];
      reflections = rStr ? JSON.parse(rStr).filter(r => r.id !== "sample_reflection_1") : [];

      if (pStr) preferences = Object.assign(preferences, JSON.parse(pStr));
    } catch (e) {
      console.warn("[Folio DB] Error reading local storage data:", e);
      books = [];
      sessions = [];
      reflections = [];
    }
  }

  function saveLocalData(userId) {
    try {
      localStorage.setItem(getStorageKey('books', userId), JSON.stringify(books));
      localStorage.setItem(getStorageKey('sessions', userId), JSON.stringify(sessions));
      localStorage.setItem(getStorageKey('reflections', userId), JSON.stringify(reflections));
      localStorage.setItem(getStorageKey('preferences', userId), JSON.stringify(preferences));
    } catch (e) {
      console.warn("[Folio DB] Error writing local storage data:", e);
    }
  }

  // ============================================================================
  // User Session Attachment & Real-Time Cloud Listeners
  // ============================================================================
  function attachUser(user) {
    // Clear existing Firestore listeners from previous user session
    firestoreUnsubscribers.forEach(unsub => unsub());
    firestoreUnsubscribers = [];

    if (!user) {
      books = [];
      sessions = [];
      reflections = [];
      notifyDataChange();
      setSyncStatus('idle', 'Signed out');
      return;
    }

    // 1. Immediately load this specific user's isolated local storage
    loadLocalData(user.uid);
    notifyDataChange();

    const db = window.FolioFirebase.getDb();
    const isCloud = window.FolioFirebase.isConfigured() && db && !user.isAnonymous;

    if (!isCloud) {
      setSyncStatus('saved', 'Local');
      return;
    }

    // 2. Connect to Cloud Firestore with live real-time listeners for this user
    setSyncStatus('saving', 'Connecting...');
    try {
      const userRef = db.collection('users').doc(user.uid);

      // Books Listener
      const unsubBooks = userRef.collection('books').orderBy('updatedAt', 'desc')
        .onSnapshot((snapshot) => {
          const cloudBooks = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== "sample_deep_work") {
              cloudBooks.push({ id: doc.id, ...data });
            }
          });

          books = cloudBooks;
          saveLocalData(user.uid);

          const isPending = snapshot.metadata.hasPendingWrites;
          setSyncStatus(isPending ? 'saving' : 'saved', isPending ? 'Syncing...' : 'Synced');
          notifyDataChange();
        }, (err) => {
          console.warn("[Folio Firestore] Books snapshot error:", err);
          setSyncStatus('offline', 'Local Mode');
          notifyDataChange();
        });
      firestoreUnsubscribers.push(unsubBooks);

      // Sessions Listener
      const unsubSessions = userRef.collection('sessions').orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
          const cloudSessions = [];
          snapshot.forEach(doc => {
            if (doc.id !== "sample_session_1") {
              cloudSessions.push({ id: doc.id, ...doc.data() });
            }
          });
          sessions = cloudSessions;
          saveLocalData(user.uid);
          notifyDataChange();
        }, (err) => {
          console.warn("[Folio Firestore] Sessions snapshot error:", err);
          notifyDataChange();
        });
      firestoreUnsubscribers.push(unsubSessions);

      // Reflections Listener
      const unsubReflections = userRef.collection('reflections').orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
          const cloudReflections = [];
          snapshot.forEach(doc => {
            if (doc.id !== "sample_reflection_1") {
              cloudReflections.push({ id: doc.id, ...doc.data() });
            }
          });
          reflections = cloudReflections;
          saveLocalData(user.uid);
          notifyDataChange();
        }, (err) => {
          console.warn("[Folio Firestore] Reflections snapshot error:", err);
          notifyDataChange();
        });
      firestoreUnsubscribers.push(unsubReflections);

      // Preferences Listener
      const unsubPrefs = userRef.collection('preferences').doc('settings')
        .onSnapshot((doc) => {
          if (doc.exists) {
            preferences = Object.assign(preferences, doc.data());
            notifyDataChange();
          }
        }, (err) => {
          console.warn("[Folio Firestore] Preferences snapshot error:", err);
          notifyDataChange();
        });
      firestoreUnsubscribers.push(unsubPrefs);
    } catch (e) {
      console.warn("[Folio Firestore] Connection error:", e);
      setSyncStatus('offline', 'Offline (cached)');
      notifyDataChange();
    }
  }

  // ============================================================================
  // CRUD Operations (Optimistic, Offline-First)
  // ============================================================================

  // Books
  async function saveBook(bookData) {
    const user = window.FolioAuth.getUser();
    if (!user) throw new Error("User must be signed in to save book");

    const bookId = bookData.id || "book_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();
    const totalPages = parseInt(bookData.totalPages, 10) || 1;
    const currentPage = parseInt(bookData.currentPage, 10) || 0;
    const status = bookData.status || (currentPage >= totalPages ? 'completed' : currentPage > 0 ? 'reading' : 'to-read');

    const cleanBook = {
      id: bookId,
      userId: user.uid,
      title: (bookData.title || "Untitled Book").trim(),
      author: (bookData.author || "Unknown Author").trim(),
      coverUrl: (bookData.coverUrl || "").trim(),
      totalPages: totalPages,
      currentPage: currentPage,
      status: status,
      tags: Array.isArray(bookData.tags) ? bookData.tags : (bookData.tags ? bookData.tags.split(',').map(t => t.trim()) : []),
      description: (bookData.description || "").trim(),
      createdAt: bookData.createdAt || now,
      updatedAt: now,
      completedAt: status === 'completed' ? (bookData.completedAt || now) : null
    };

    // 1. Optimistic Local Save (Instant UI update)
    const idx = books.findIndex(b => b.id === bookId);
    if (idx >= 0) books[idx] = cleanBook;
    else books.unshift(cleanBook);
    saveLocalData(user.uid);
    notifyDataChange();

    // 2. Cloud Firestore Persistence
    const db = window.FolioFirebase.getDb();
    if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
      setSyncStatus('saving', 'Saving...');
      try {
        await db.collection('users').doc(user.uid).collection('books').doc(bookId).set(cleanBook, { merge: true });
        setSyncStatus('saved', 'Synced');
      } catch (err) {
        console.warn("[Folio Firestore] Could not sync book to Cloud:", err);
        setSyncStatus('offline', 'Local');
        if (err.code === 'permission-denied' && window.FolioUI) {
          window.FolioUI.showToast("Saved locally. Publish Cloud Firestore rules to enable sync.", "info", 5000);
        }
      }
    } else {
      setSyncStatus('saved', 'Saved');
    }

    return cleanBook;
  }

  async function deleteBook(bookId) {
    const user = window.FolioAuth.getUser();
    if (!user) return;

    // 1. Optimistic Local Delete
    books = books.filter(b => b.id !== bookId);
    saveLocalData(user.uid);
    notifyDataChange();

    // 2. Cloud Delete
    const db = window.FolioFirebase.getDb();
    if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
      setSyncStatus('saving', 'Deleting from Cloud...');
      try {
        await db.collection('users').doc(user.uid).collection('books').doc(bookId).delete();
        setSyncStatus('saved', 'Deleted');
      } catch (err) {
        console.warn("[Folio Firestore] Cloud delete error:", err);
        setSyncStatus('offline', 'Deleted locally');
      }
    }
  }

  // Reading Sessions
  async function saveSession(sessionData) {
    const user = window.FolioAuth.getUser();
    if (!user) throw new Error("User must be signed in to save session");

    const sessionId = sessionData.id || "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();
    const startPage = parseInt(sessionData.startPage, 10) || 0;
    const endPage = parseInt(sessionData.endPage, 10) || startPage;
    const pagesRead = Math.max(0, endPage - startPage);
    const durationSeconds = parseInt(sessionData.durationSeconds, 10) || ((parseInt(sessionData.durationMinutes, 10) || 0) * 60);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    const cleanSession = {
      id: sessionId,
      userId: user.uid,
      bookId: sessionData.bookId,
      bookTitle: sessionData.bookTitle || "Reading Session",
      startPage: startPage,
      endPage: endPage,
      pagesRead: pagesRead,
      durationSeconds: durationSeconds,
      durationMinutes: durationMinutes,
      focusRating: parseInt(sessionData.focusRating, 10) || 5,
      title: (sessionData.title || "").trim(),
      notes: (sessionData.notes || "").trim(),
      createdAt: sessionData.createdAt || now,
      sessionDate: sessionData.sessionDate || now.split('T')[0]
    };

    // 1. Optimistic Local Save
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) sessions[idx] = cleanSession;
    else sessions.unshift(cleanSession);
    saveLocalData(user.uid);
    notifyDataChange();

    // Auto-advance book current page if endPage is greater
    const targetBook = books.find(b => b.id === sessionData.bookId);
    if (targetBook && endPage > targetBook.currentPage) {
      const isComplete = endPage >= targetBook.totalPages;
      await saveBook({
        ...targetBook,
        currentPage: endPage,
        status: isComplete ? 'completed' : 'reading',
        completedAt: isComplete ? now : null
      });
    }

    // 2. Cloud Firestore Save
    const db = window.FolioFirebase.getDb();
    if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
      setSyncStatus('saving', 'Saving...');
      try {
        await db.collection('users').doc(user.uid).collection('sessions').doc(sessionId).set(cleanSession);
        setSyncStatus('saved', 'Synced');
      } catch (err) {
        console.warn("[Folio Firestore] Could not sync session to Cloud:", err);
        setSyncStatus('offline', 'Local');
      }
    } else {
      setSyncStatus('saved', 'Saved');
    }

    return cleanSession;
  }

  async function deleteSession(sessionId) {
    const user = window.FolioAuth.getUser();
    if (!user) return;

    // 1. Optimistic Local Delete
    sessions = sessions.filter(s => s.id !== sessionId);
    saveLocalData(user.uid);
    notifyDataChange();

    // 2. Cloud Delete
    const db = window.FolioFirebase.getDb();
    if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
      try {
        await db.collection('users').doc(user.uid).collection('sessions').doc(sessionId).delete();
      } catch (err) {
        console.warn("[Folio Firestore] Cloud delete error:", err);
      }
    }
  }

  // Reflections
  async function saveReflection(refData) {
    const user = window.FolioAuth.getUser();
    if (!user) throw new Error("User must be signed in to save reflection");

    const refId = refData.id || "reflection_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();

    const cleanRef = {
      id: refId,
      userId: user.uid,
      bookId: refData.bookId || "",
      bookTitle: refData.bookTitle || "General Reflection",
      sessionId: refData.sessionId || "",
      learned: (refData.learned || "").trim(),
      standout: (refData.standout || "").trim(),
      application: (refData.application || "").trim(),
      revisitPage: (refData.revisitPage || "").trim(),
      quote: (refData.quote || "").trim(),
      notes: (refData.notes || "").trim(),
      createdAt: refData.createdAt || now,
      updatedAt: now
    };

    // 1. Optimistic Local Save
    const idx = reflections.findIndex(r => r.id === refId);
    if (idx >= 0) reflections[idx] = cleanRef;
    else reflections.unshift(cleanRef);
    saveLocalData(user.uid);
    notifyDataChange();

    // 2. Cloud Firestore Save
    const db = window.FolioFirebase.getDb();
    if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
      setSyncStatus('saving', 'Saving...');
      try {
        await db.collection('users').doc(user.uid).collection('reflections').doc(refId).set(cleanRef, { merge: true });
        setSyncStatus('saved', 'Synced');
      } catch (err) {
        console.warn("[Folio Firestore] Could not sync reflection to Cloud:", err);
        setSyncStatus('offline', 'Local');
      }
    } else {
      setSyncStatus('saved', 'Saved');
    }

    return cleanRef;
  }

  async function deleteReflection(refId) {
    const user = window.FolioAuth.getUser();
    if (!user) return;

    // 1. Optimistic Local Delete
    reflections = reflections.filter(r => r.id !== refId);
    saveLocalData(user.uid);
    notifyDataChange();

    // 2. Cloud Delete
    const db = window.FolioFirebase.getDb();
    if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
      try {
        await db.collection('users').doc(user.uid).collection('reflections').doc(refId).delete();
      } catch (err) {
        console.warn("[Folio Firestore] Cloud delete error:", err);
      }
    }
  }

  // Preferences
  async function savePreferences(newPrefs) {
    const user = window.FolioAuth.getUser();
    preferences = Object.assign(preferences, newPrefs);

    if (user) {
      saveLocalData(user.uid);
      const db = window.FolioFirebase.getDb();
      if (window.FolioFirebase.isConfigured() && db && !user.isAnonymous) {
        try {
          await db.collection('users').doc(user.uid).collection('preferences').doc('settings').set(preferences, { merge: true });
        } catch (err) {
          console.warn("[Folio Firestore] Preferences sync error:", err);
        }
      }
    }
    notifyDataChange();
  }

  // Export all data to JSON
  function exportAllData() {
    return {
      exportedAt: new Date().toISOString(),
      user: window.FolioAuth.getUser(),
      books,
      sessions,
      reflections,
      preferences
    };
  }

  return {
    attachUser,
    getBooks: () => [...books],
    getBookById: (id) => books.find(b => b.id === id),
    getSessions: () => [...sessions],
    getSessionsForBook: (bookId) => sessions.filter(s => s.bookId === bookId),
    getReflections: () => [...reflections],
    getReflectionsForBook: (bookId) => reflections.filter(r => r.bookId === bookId),
    getPreferences: () => ({ ...preferences }),
    saveBook,
    deleteBook,
    saveSession,
    deleteSession,
    saveReflection,
    deleteReflection,
    savePreferences,
    exportAllData,
    onDataChange,
    onSyncStatusChange,
    setSyncStatus
  };
})();

window.FolioDB = FolioDB;
