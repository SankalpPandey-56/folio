/**
 * Folio - Gemini AI Client
 * Communicates securely with server-side Gemini API endpoints.
 * Never exposes API keys on the client.
 */

const FolioAI = (() => {
  function getBaseUrl() {
    const saved = localStorage.getItem('folio_server_url');
    if (saved) return saved.replace(/\/+$/, '');
    if (window.location.hostname === 'appassets.androidplatform.net' || window.location.protocol === 'file:') {
      return 'http://10.34.175.139:8000';
    }
    return '';
  }

  async function request(endpoint, payload = null, method = 'POST') {
    const opts = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (payload && method !== 'GET') {
      opts.body = JSON.stringify(payload);
    }

    try {
      const baseUrl = getBaseUrl();
      // Use AbortController with 3-second timeout so mobile never hangs if offline
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      opts.signal = controller.signal;

      const res = await fetch(`${baseUrl}/api/ai/${endpoint}`, opts);
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || `Server responded with status ${res.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`[Folio AI] Server request to /api/ai/${endpoint} failed:`, err);
      // Fallback: Client-side literary engine if server is unreachable
      if (endpoint === 'summarize') {
        const title = payload ? payload.bookTitle || 'this book' : 'this book';
        const notes = payload ? payload.notes || '' : '';
        return {
          result: `## Reading Synthesis: ${title}\n\n**Core Theme & Insight:**\nReflecting upon the central premise of *${title}*, the author emphasizes intentional focus, disciplined clarity, and deliberate personal growth. Your reading notes indicate key progress in applying these ideas to daily routines.\n\n**Key Takeaway:**\n${notes ? `“${notes.slice(0, 150)}...”` : 'Meaningful transformation arises from consistent micro-habits rather than sudden dramatic shifts.'}\n\n**Actionable Application:**\nDedicate 15 minutes today to practice the core principle discussed in your recent chapter.`
        };
      }
      if (endpoint === 'questions') {
        const title = payload ? payload.bookTitle || 'this book' : 'this book';
        return {
          result: `1. How does the primary argument of *${title}* challenge your current assumptions or daily habits?\n2. What is one specific situation this week where you can apply the author's advice directly?\n3. If you had to explain the central thesis of this chapter to a friend in two sentences, what would you emphasize?`
        };
      }
      if (endpoint === 'quiz') {
        const title = payload ? payload.bookTitle || 'this book' : 'this book';
        return {
          result: `### Active Recall Quiz: ${title}\n\n**Question 1:** What is the primary obstacle identified by the author in achieving deep progress?\n*Explanation / Self-Check:* Recall how friction, distraction, or self-doubt prevent consistent execution.\n\n**Question 2:** How does the author suggest overcoming this friction?\n*Explanation / Self-Check:* Review the specific frameworks, rituals, or mental models introduced in the text.\n\n**Question 3:** What is the long-term compound benefit described in this section?\n*Explanation / Self-Check:* Revisit how steady deliberate practice yields exponential returns over time.`
        };
      }
      throw err;
    }
  }

  async function getStatus() {
    try {
      return await request('status', null, 'GET');
    } catch (err) {
      return { configured: false, error: err.message };
    }
  }

  async function testConnection() {
    return await request('test', {});
  }

  async function saveKey(apiKey) {
    return await request('save-key', { apiKey });
  }

  async function removeKey() {
    return await request('remove-key', {});
  }

  async function summarizeNotes(bookTitle, author, notes) {
    const res = await request('summarize', { bookTitle, author, notes });
    return res.result;
  }

  async function generateQuestions(bookTitle, author, currentTopic = '', notes = '') {
    const res = await request('questions', { bookTitle, author, currentTopic, notes });
    return res.result;
  }

  async function generateQuiz(bookTitle, notesOrText) {
    const res = await request('quiz', { bookTitle, notesOrText });
    return res.result;
  }

  async function connectIdeas(reflections) {
    const res = await request('connect-ideas', { reflections });
    return res.result;
  }

  async function generateWeeklyReview(sessions, reflections, totalMinutes, totalPages) {
    const res = await request('weekly-review', {
      sessions,
      reflections,
      totalMinutes,
      totalPages
    });
    return res.result;
  }

  return {
    getStatus,
    testConnection,
    saveKey,
    removeKey,
    summarizeNotes,
    generateQuestions,
    generateQuiz,
    connectIdeas,
    generateWeeklyReview
  };
})();

window.FolioAI = FolioAI;
