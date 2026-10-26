/**
 * Folio - Timestamp-Based Reading Timer
 * Survives page reloads, tab navigation, and mobile backgrounding.
 */

const FolioTimer = (() => {
  const STORAGE_KEY = 'folio_active_reading_timer';

  let timerState = {
    bookId: null,
    bookTitle: '',
    startTimestamp: null, // ms timestamp when current run started
    accumulatedMs: 0,     // ms accumulated from prior runs before pause
    state: 'idle'         // 'idle' | 'running' | 'paused'
  };

  let tickInterval = null;
  const tickListeners = [];

  function init() {
    restoreTimer();
  }

  function restoreTimer() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        timerState = parsed;
        if (timerState.state === 'running') {
          startTicker();
        }
        notifyTick();
      }
    } catch (e) {
      console.warn("[Folio Timer] Restore error:", e);
      reset();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timerState));
    } catch (e) {
      console.warn("[Folio Timer] Persist error:", e);
    }
  }

  function start(bookId, bookTitle) {
    if (timerState.state === 'running') return;

    if (timerState.state === 'paused' && timerState.bookId === bookId) {
      resume();
      return;
    }

    timerState = {
      bookId: bookId,
      bookTitle: bookTitle,
      startTimestamp: Date.now(),
      accumulatedMs: 0,
      state: 'running'
    };

    persist();
    startTicker();
    notifyTick();
  }

  function pause() {
    if (timerState.state !== 'running') return;

    const now = Date.now();
    timerState.accumulatedMs += (now - timerState.startTimestamp);
    timerState.startTimestamp = null;
    timerState.state = 'paused';

    stopTicker();
    persist();
    notifyTick();
  }

  function resume() {
    if (timerState.state !== 'paused') return;

    timerState.startTimestamp = Date.now();
    timerState.state = 'running';

    persist();
    startTicker();
    notifyTick();
  }

  function reset() {
    stopTicker();
    timerState = {
      bookId: null,
      bookTitle: '',
      startTimestamp: null,
      accumulatedMs: 0,
      state: 'idle'
    };
    localStorage.removeItem(STORAGE_KEY);
    notifyTick();
  }

  function getElapsedMs() {
    if (timerState.state === 'running' && timerState.startTimestamp) {
      return timerState.accumulatedMs + (Date.now() - timerState.startTimestamp);
    }
    return timerState.accumulatedMs;
  }

  function getElapsedSeconds() {
    return Math.floor(getElapsedMs() / 1000);
  }

  function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  function startTicker() {
    stopTicker();
    tickInterval = setInterval(() => {
      notifyTick();
    }, 1000);
  }

  function stopTicker() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  function onTick(callback) {
    tickListeners.push(callback);
    callback(getState());
  }

  function notifyTick() {
    const current = getState();
    tickListeners.forEach(fn => fn(current));
  }

  function getState() {
    const elapsedSeconds = getElapsedSeconds();
    return {
      bookId: timerState.bookId,
      bookTitle: timerState.bookTitle,
      state: timerState.state,
      elapsedSeconds: elapsedSeconds,
      formattedTime: formatTime(elapsedSeconds)
    };
  }

  return {
    init,
    start,
    pause,
    resume,
    reset,
    getState,
    onTick,
    formatTime
  };
})();

window.FolioTimer = FolioTimer;
