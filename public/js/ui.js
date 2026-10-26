/**
 * Folio - UI Controller & Renderer
 * Mobile-First, Accessible, and Editorial
 */

const FolioUI = (() => {
  let activeTab = 'home';
  let activeBookFilter = 'all';
  let activeJournalFilter = 'all';
  let currentEditingBookId = null;
  let currentEditingReflectionId = null;

  // Initialize UI event bindings
  function init() {
    initTheme();
    bindNavigation();
    bindModals();
    bindForms();
    bindTimerControls();

    // Listen to Auth state changes and immediately render
    FolioAuth.onAuthStateChanged((user) => {
      renderCurrentView();
    });

    // Listen to DB changes and re-render
    FolioDB.onDataChange(() => {
      renderCurrentView();
    });

    // Listen to sync status changes
    FolioDB.onSyncStatusChange((info) => {
      renderSyncBadge(info);
    });

    // Listen to timer ticks
    FolioTimer.onTick((timerInfo) => {
      renderTimerTick(timerInfo);
    });

    // Handle initial route
    switchTab('home');
  }

  // ============================================================================
  // Theme Management (Light, Dark, System)
  // ============================================================================
  function initTheme() {
    const saved = localStorage.getItem('folio_theme') || 'system';
    applyTheme(saved);

    // Watch system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (localStorage.getItem('folio_theme') === 'system') {
        applyTheme('system');
      }
    });
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('folio_theme', theme);

    // Update settings radio buttons if open
    const radios = document.querySelectorAll('input[name="theme-choice"]');
    radios.forEach(r => {
      r.checked = (r.value === theme);
    });
  }

  // ============================================================================
  // Navigation & View Switching
  // ============================================================================
  function bindNavigation() {
    document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // Floating / Center Timer button
    const timerBtn = document.getElementById('nav-timer-btn');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        openTimerModal();
      });
    }

    // Brand logo click goes to home
    const brand = document.querySelector('.brand-wrapper');
    if (brand) {
      brand.addEventListener('click', () => switchTab('home'));
    }

    // Settings avatar button
    const avatarBtn = document.getElementById('header-avatar-btn');
    if (avatarBtn) {
      avatarBtn.addEventListener('click', () => openModal('modal-settings'));
    }
  }

  function switchTab(tabName) {
    activeTab = tabName;

    // Update nav buttons
    document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update view panels
    document.querySelectorAll('.view-panel').forEach((panel) => {
      panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`view-${tabName}`);
    if (activePanel) {
      activePanel.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    renderCurrentView();
  }

  function renderCurrentView() {
    const user = FolioAuth.getUser();
    const welcomeView = document.getElementById('view-welcome');
    const appShell = document.getElementById('app-shell-content');
    const bottomNav = document.getElementById('bottom-navigation');
    const headerActions = document.getElementById('header-actions');

    if (!user) {
      // Show Welcome / Sign-In Screen
      if (welcomeView) welcomeView.style.display = 'flex';
      if (appShell) appShell.style.display = 'none';
      if (bottomNav) bottomNav.style.display = 'none';
      if (headerActions) headerActions.style.display = 'none';
      return;
    }

    // User is signed in
    if (welcomeView) welcomeView.style.display = 'none';
    if (appShell) appShell.style.display = 'block';
    if (bottomNav) bottomNav.style.display = 'block';
    if (headerActions) headerActions.style.display = 'flex';

    // Update Header Avatar
    renderHeaderAvatar(user);

    switch (activeTab) {
      case 'home':
        renderHomeDashboard();
        break;
      case 'books':
        renderBookshelf();
        break;
      case 'journal':
        renderJournal();
        break;
      case 'insights':
        renderInsights();
        break;
    }
  }

  function renderHeaderAvatar(user) {
    const avatarBtn = document.getElementById('header-avatar-btn');
    if (!avatarBtn) return;

    if (user && user.photoURL) {
      avatarBtn.innerHTML = `<img src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" onerror="this.remove(); document.getElementById('header-avatar-btn').textContent='${escapeHtml((user.displayName || 'R')[0].toUpperCase())}';" />`;
    } else {
      const initial = (user ? (user.displayName || "R")[0] : "R").toUpperCase();
      avatarBtn.textContent = initial;
    }

    // Also update settings profile card
    const profileCard = document.getElementById('settings-user-card');
    if (profileCard && user) {
      profileCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--border-subtle);">
          <div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: var(--color-primary-light); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 1.2rem; color: var(--color-primary); flex-shrink: 0;">
            ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.remove();" />` : (user.displayName || 'R')[0].toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(user.displayName)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(user.email)}</div>
            <span class="status-badge reading" style="font-size: 0.68rem; margin-top: 4px; display: inline-block;">Google Account</span>
          </div>
        </div>
      `;
    }
  }

  function renderSyncBadge(info) {
    const badge = document.getElementById('sync-indicator');
    if (!badge) return;

    badge.className = `sync-badge ${info.status}`;
    const label = document.getElementById('sync-label');
    if (label) {
      label.textContent = info.message || 'Synced';
    }
  }

  // ============================================================================
  // View 1: Home Dashboard
  // ============================================================================
  function renderHomeDashboard() {
    const user = FolioAuth.getUser();
    const books = FolioDB.getBooks();
    const sessions = FolioDB.getSessions();
    const reflections = FolioDB.getReflections();
    const prefs = FolioDB.getPreferences();

    // Kicker & Greeting
    const kickerEl = document.getElementById('dashboard-date-kicker');
    if (kickerEl) {
      const now = new Date();
      kickerEl.textContent = now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).toUpperCase();
    }

    const greetingEl = document.getElementById('dashboard-greeting');
    if (greetingEl) {
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const firstName = user ? (user.displayName || 'Reader').split(' ')[0] : 'Reader';
      greetingEl.textContent = `${timeGreeting}, ${firstName}`;
    }

    // Currently Reading Hero
    const currentlyReading = books.filter(b => b.status === 'reading');
    const heroContainer = document.getElementById('dashboard-hero-container');
    if (heroContainer) {
      if (currentlyReading.length > 0) {
        const book = currentlyReading[0];
        const progress = Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
        const pagesRemaining = Math.max(0, (book.totalPages || 0) - (book.currentPage || 0));
        heroContainer.innerHTML = `
          <div class="hero-card">
            <div class="hero-top-row">
              <div class="hero-kicker-badge">
                <span class="reading-pulse-dot"></span> Currently Reading
              </div>
              <span class="hero-time-left">${pagesRemaining > 0 ? `${pagesRemaining} pages left` : 'Completed'}</span>
            </div>
            <div class="hero-main-row">
              ${renderCoverThumb(book, 82, 120)}
              <div class="hero-info">
                <h3 class="hero-title">${escapeHtml(book.title)}</h3>
                <p class="hero-author">by ${escapeHtml(book.author)}</p>
                <div class="hero-progress-block">
                  <div class="hero-progress-labels">
                    <span>Page <strong>${book.currentPage}</strong> of ${book.totalPages}</span>
                    <span><strong>${progress}%</strong></span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="hero-actions-row">
              <button class="btn btn-primary hero-btn-continue" onclick="FolioUI.openTimerWithBook('${book.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
                <span>Continue Reading</span>
              </button>
              <button class="btn btn-secondary btn-icon hero-btn-details" onclick="FolioUI.openBookDetail('${book.id}')" title="Book details & notes">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
              </button>
            </div>
          </div>
        `;
      } else if (books.length > 0) {
        const toRead = books.filter(b => b.status === 'toread');
        const nextBook = toRead.length > 0 ? toRead[0] : books[0];
        const statusLabel = nextBook.status === 'toread' ? 'Want to Read' : (nextBook.status === 'completed' ? 'Completed' : 'Bookshelf');
        heroContainer.innerHTML = `
          <div class="hero-card">
            <div class="hero-header">
              ${renderCoverThumb(nextBook)}
              <div class="hero-info">
                <span class="hero-tag" style="background: var(--bg-surface-subtle); color: var(--text-muted);">${statusLabel}</span>
                <h3 class="hero-title">${escapeHtml(nextBook.title)}</h3>
                <p class="hero-author">by ${escapeHtml(nextBook.author)}</p>
              </div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 14px;">
              <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="FolioUI.startReadingBook('${nextBook.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Start Reading This Book
              </button>
              <button class="btn btn-secondary btn-sm" onclick="FolioUI.switchTab('books')">
                View Shelf (${books.length})
              </button>
            </div>
          </div>
        `;
      } else {
        heroContainer.innerHTML = `
          <div class="card" style="text-align: center; padding: 28px 20px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; color: var(--color-primary);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>
            <p style="font-family: var(--font-serif); font-size: 1.2rem; color: var(--color-primary); margin-bottom: 6px;">Your Library is Empty</p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; max-width: 320px; margin-left: auto; margin-right: auto;">Add the book you're reading right now or explore your want-to-read list.</p>
            <button class="btn btn-primary btn-sm" onclick="FolioUI.openAddBookModal()">+ Add Your First Book</button>
          </div>
        `;
      }
    }

    // Stats Grid
    // 1. Today's minutes
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.filter(s => (s.sessionDate === todayStr || s.createdAt.startsWith(todayStr)));
    const todayMins = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

    // 2. This week's pages
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
    const weekSessions = sessions.filter(s => new Date(s.createdAt) >= oneWeekAgo);
    const weekPages = weekSessions.reduce((acc, s) => acc + (s.pagesRead || 0), 0);
    const weekMins = weekSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

    const todayMinsEl = document.getElementById('stat-today-mins');
    if (todayMinsEl) todayMinsEl.textContent = `${todayMins}m`;

    const weekPagesEl = document.getElementById('stat-week-pages');
    if (weekPagesEl) weekPagesEl.textContent = weekPages;

    const weekMinsEl = document.getElementById('stat-week-mins');
    if (weekMinsEl) weekMinsEl.textContent = `${weekMins}m`;

    // Recent Reflections Preview
    const recentRefContainer = document.getElementById('dashboard-recent-reflections');
    if (recentRefContainer) {
      if (reflections.length > 0) {
        const top3 = reflections.slice(0, 3);
        recentRefContainer.innerHTML = top3.map(r => renderReflectionCard(r)).join('');
      } else {
        recentRefContainer.innerHTML = `
          <div class="empty-reflections-card" onclick="FolioUI.openAddReflectionModal()">
            <div class="empty-quote-icon">“</div>
            <p class="empty-quote-title">Quiet mind, deep reading</p>
            <p class="empty-quote-desc">Jot down your first reflection, highlight, or takeaway from today's session.</p>
            <span class="empty-action-link">+ Write a reflection</span>
          </div>
        `;
      }
    }
  }

  // ============================================================================
  // View 2: Bookshelf
  // ============================================================================
  function renderBookshelf() {
    const books = FolioDB.getBooks();
    const searchInput = document.getElementById('bookshelf-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = books;
    if (activeBookFilter !== 'all') {
      filtered = filtered.filter(b => b.status === activeBookFilter);
    }
    if (query) {
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(query) ||
        b.author.toLowerCase().includes(query) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(query)))
      );
    }

    const container = document.getElementById('bookshelf-list');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
          <p style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--color-primary); margin-bottom: 6px;">No books found</p>
          <p style="font-size: 0.85rem; margin-bottom: 14px;">${query ? "Try another search term" : "Add books to your personal library to track your reading journey."}</p>
          <button class="btn btn-primary btn-sm" onclick="FolioUI.openAddBookModal()">+ Add Book</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(book => {
      const progress = Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
      return `
        <div class="bookshelf-card" onclick="FolioUI.openBookDetail('${book.id}')">
          ${renderCoverThumb(book)}
          <div class="bookshelf-info">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <h4 class="bookshelf-title">${escapeHtml(book.title)}</h4>
                <span class="status-badge ${book.status}">${formatStatus(book.status)}</span>
              </div>
              <p class="bookshelf-author">by ${escapeHtml(book.author)}</p>
            </div>
            <div class="progress-container">
              <div class="progress-header" style="margin-bottom: 4px;">
                <span style="font-size: 0.75rem;">Page ${book.currentPage} / ${book.totalPages}</span>
                <span style="font-size: 0.75rem; font-weight: 600;">${progress}%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================================================
  // View 3: Journal & Reflections
  // ============================================================================
  function renderJournal() {
    const reflections = FolioDB.getReflections();
    const books = FolioDB.getBooks();

    // Populate Book Filter select
    const bookSelect = document.getElementById('journal-book-filter');
    if (bookSelect) {
      const currentVal = bookSelect.value;
      bookSelect.innerHTML = `<option value="all">All Books (${reflections.length})</option>` +
        books.map(b => `<option value="${b.id}" ${currentVal === b.id ? 'selected' : ''}>${escapeHtml(b.title)}</option>`).join('');
    }

    const searchInput = document.getElementById('journal-search');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = reflections;
    if (activeJournalFilter !== 'all') {
      filtered = filtered.filter(r => r.bookId === activeJournalFilter);
    }
    if (query) {
      filtered = filtered.filter(r =>
        (r.bookTitle && r.bookTitle.toLowerCase().includes(query)) ||
        (r.learned && r.learned.toLowerCase().includes(query)) ||
        (r.standout && r.standout.toLowerCase().includes(query)) ||
        (r.quote && r.quote.toLowerCase().includes(query)) ||
        (r.notes && r.notes.toLowerCase().includes(query))
      );
    }

    const container = document.getElementById('journal-list');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
          <p style="font-family: var(--font-serif); font-size: 1.15rem; color: var(--color-primary); margin-bottom: 6px;">No journal entries yet</p>
          <p style="font-size: 0.85rem; margin-bottom: 14px;">Capture the ideas that move you after each reading session.</p>
          <button class="btn btn-primary btn-sm" onclick="FolioUI.openAddReflectionModal()">+ Write Reflection</button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(r => renderReflectionCard(r, true)).join('');
  }

  function renderReflectionCard(r, showActions = false) {
    const dateFormatted = new Date(r.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `
      <div class="journal-card" id="ref-card-${r.id}">
        <div class="journal-header">
          <span class="journal-book-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            ${escapeHtml(r.bookTitle || "Reading Note")}
          </span>
          <span class="journal-date">${dateFormatted}</span>
        </div>

        ${r.quote ? `<blockquote class="journal-quote">“${escapeHtml(r.quote)}”</blockquote>` : ''}

        ${r.learned ? `
          <div class="journal-prompt-item">
            <div class="journal-prompt-q">What I Learned</div>
            <p class="journal-prompt-a">${escapeHtml(r.learned)}</p>
          </div>
        ` : ''}

        ${r.standout ? `
          <div class="journal-prompt-item">
            <div class="journal-prompt-q">Idea That Stood Out</div>
            <p class="journal-prompt-a">${escapeHtml(r.standout)}</p>
          </div>
        ` : ''}

        ${r.application ? `
          <div class="journal-prompt-item">
            <div class="journal-prompt-q">Personal Application</div>
            <p class="journal-prompt-a">${escapeHtml(r.application)}</p>
          </div>
        ` : ''}

        ${r.revisitPage ? `
          <div class="journal-prompt-item">
            <div class="journal-prompt-q">Page to Revisit</div>
            <p class="journal-prompt-a">${escapeHtml(r.revisitPage)}</p>
          </div>
        ` : ''}

        ${r.notes ? `
          <div class="journal-prompt-item" style="margin-top: 10px;">
            <p class="journal-prompt-a" style="font-size: 0.88rem; color: var(--text-muted);">${escapeHtml(r.notes)}</p>
          </div>
        ` : ''}

        ${showActions ? `
          <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <button class="btn btn-subtle btn-sm" onclick="FolioUI.editReflection('${r.id}')">Edit</button>
            <button class="btn btn-subtle btn-sm" style="color: #c53030;" onclick="FolioUI.deleteReflectionConfirm('${r.id}')">Delete</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ============================================================================
  // View 4: Insights & Reading Analytics
  // ============================================================================
  function renderInsights() {
    const sessions = FolioDB.getSessions();
    const books = FolioDB.getBooks();
    const prefs = FolioDB.getPreferences();

    // 1. Reading speed (pages/hr)
    let totalSecs = 0;
    let totalPages = 0;
    sessions.forEach(s => {
      totalSecs += (s.durationSeconds || s.durationMinutes * 60 || 0);
      totalPages += (s.pagesRead || 0);
    });

    const hoursRead = totalSecs / 3600;
    const pacePagesPerHour = hoursRead > 0.2 ? Math.round(totalPages / hoursRead) : 40;

    const paceEl = document.getElementById('insights-pace');
    if (paceEl) paceEl.textContent = `${pacePagesPerHour} pgs/hr`;

    // 2. Completed books count
    const completedBooks = books.filter(b => b.status === 'completed');
    const compEl = document.getElementById('insights-completed-count');
    if (compEl) compEl.textContent = `${completedBooks.length} books`;

    // 3. Estimated Completion Dates for Active Books
    const activeBooks = books.filter(b => b.status === 'reading');
    const estimatesContainer = document.getElementById('insights-completion-estimates');
    if (estimatesContainer) {
      if (activeBooks.length === 0) {
        estimatesContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No active books to forecast.</p>`;
      } else {
        estimatesContainer.innerHTML = activeBooks.map(book => {
          const remainingPages = Math.max(0, book.totalPages - book.currentPage);
          // Days estimate based on 25 pages/day or user's daily rate
          const dailyRate = Math.max(10, Math.round(pacePagesPerHour * 0.5));
          const daysLeft = Math.ceil(remainingPages / dailyRate);
          const estDate = new Date(Date.now() + daysLeft * 86400000);
          const dateStr = estDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);">
              <div>
                <strong style="font-size: 0.9rem; color: var(--text-main);">${escapeHtml(book.title)}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${remainingPages} pages left (${dailyRate} pgs/day est.)</div>
              </div>
              <div style="text-align: right;">
                <span class="status-badge reading" style="font-size: 0.75rem;">Est. ${dateStr}</span>
                <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">~${daysLeft} days</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Weekly Velocity Chart (last 7 days bar chart SVG)
    renderVelocityChart(sessions);

    // 5. Goal Progress
    const goalMins = prefs.weeklyGoalMinutes || 120;
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
    const weekMins = sessions
      .filter(s => new Date(s.createdAt) >= oneWeekAgo)
      .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

    const goalPercent = Math.min(100, Math.round((weekMins / goalMins) * 100));
    const goalBar = document.getElementById('insights-goal-bar');
    if (goalBar) goalBar.style.width = `${goalPercent}%`;

    const goalText = document.getElementById('insights-goal-text');
    if (goalText) goalText.textContent = `${weekMins} of ${goalMins} minutes (${goalPercent}%)`;
  }

  function renderVelocityChart(sessions) {
    const container = document.getElementById('insights-chart-container');
    if (!container) return;

    // Calculate last 7 days minutes
    const days = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dateKey = d.toISOString().split('T')[0];
      const dayName = dayLabels[d.getDay()];
      const dayMinutes = sessions
        .filter(s => (s.sessionDate === dateKey || s.createdAt.startsWith(dateKey)))
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      days.push({ label: dayName, minutes: dayMinutes, isToday: i === 0 });
    }

    const maxMins = Math.max(30, ...days.map(d => d.minutes));

    container.innerHTML = `
      <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 110px; padding: 10px 4px 0 4px; gap: 8px;">
        ${days.map(d => {
          const heightPercent = Math.max(8, Math.round((d.minutes / maxMins) * 100));
          const barColor = d.isToday ? 'var(--color-primary)' : 'var(--color-accent)';
          return `
            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end;">
              <span style="font-size: 0.68rem; color: var(--text-dim); margin-bottom: 4px;">${d.minutes > 0 ? d.minutes + 'm' : ''}</span>
              <div style="width: 100%; max-width: 28px; height: ${heightPercent}%; background-color: ${barColor}; border-radius: 4px 4px 0 0; transition: height var(--transition-normal);"></div>
              <span style="font-size: 0.72rem; color: ${d.isToday ? 'var(--color-primary)' : 'var(--text-muted)'}; font-weight: ${d.isToday ? '700' : '500'}; margin-top: 6px;">${d.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ============================================================================
  // Reading Timer UI & Flow
  // ============================================================================
  function renderTimerTick(timerInfo) {
    const clockEl = document.getElementById('timer-clock-display');
    if (clockEl) clockEl.textContent = timerInfo.formattedTime;

    const navPill = document.getElementById('nav-timer-btn');
    if (navPill) {
      if (timerInfo.state === 'running') navPill.classList.add('running');
      else navPill.classList.remove('running');
    }

    const startBtn = document.getElementById('timer-btn-toggle');
    if (startBtn) {
      if (timerInfo.state === 'running') {
        startBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
      } else {
        startBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      }
    }
  }

  function bindTimerControls() {
    const toggleBtn = document.getElementById('timer-btn-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const state = FolioTimer.getState();
        if (state.state === 'running') {
          FolioTimer.pause();
        } else if (state.state === 'paused') {
          FolioTimer.resume();
        } else {
          // Start fresh
          const bookSelect = document.getElementById('timer-book-select');
          const bookId = bookSelect ? bookSelect.value : null;
          const book = FolioDB.getBookById(bookId);
          if (!book) {
            showToast("Please select a book to start reading", "info");
            return;
          }
          FolioTimer.start(book.id, book.title);
        }
      });
    }

    const finishBtn = document.getElementById('timer-btn-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        const state = FolioTimer.getState();
        if (state.elapsedSeconds < 10 && state.state === 'idle') {
          closeModal('modal-timer');
          return;
        }

        FolioTimer.pause();
        closeModal('modal-timer');
        openFinishSessionModal(state);
      });
    }

    const resetBtn = document.getElementById('timer-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm("Reset active reading timer?")) {
          FolioTimer.reset();
        }
      });
    }
  }

  function openTimerModal() {
    populateTimerBookSelect();
    openModal('modal-timer');
  }

  function openTimerWithBook(bookId) {
    const book = FolioDB.getBookById(bookId);
    if (book && book.status !== 'reading') {
      book.status = 'reading';
      FolioDB.saveBook(book);
    }
    populateTimerBookSelect(bookId);
    openModal('modal-timer');
    const state = FolioTimer.getState();
    if (state.state !== 'running') {
      if (book) FolioTimer.start(book.id, book.title);
    }
  }

  async function startReadingBook(bookId) {
    const book = FolioDB.getBookById(bookId);
    if (!book) return;
    book.status = 'reading';
    book.updatedAt = new Date().toISOString();
    await FolioDB.saveBook(book);
    showToast(`Started reading "${book.title}"!`, 'success');
    renderHomeDashboard();
    openTimerWithBook(bookId);
  }

  function populateTimerBookSelect(selectedBookId = null) {
    const select = document.getElementById('timer-book-select');
    if (!select) return;

    const books = FolioDB.getBooks();
    const readingBooks = books.filter(b => b.status === 'reading');
    const list = readingBooks.length > 0 ? readingBooks : books;

    select.innerHTML = list.map(b =>
      `<option value="${b.id}" ${selectedBookId === b.id ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
    ).join('');
  }

  function openFinishSessionModal(timerState) {
    const book = FolioDB.getBookById(timerState.bookId);
    const modal = document.getElementById('modal-finish-session');
    if (!modal) return;

    document.getElementById('finish-book-title').textContent = timerState.bookTitle || (book ? book.title : "Reading Session");
    document.getElementById('finish-duration-text').textContent = FolioTimer.formatTime(timerState.elapsedSeconds);

    const startPageInput = document.getElementById('finish-start-page');
    const endPageInput = document.getElementById('finish-end-page');
    const pagesReadDisplay = document.getElementById('finish-pages-read-display');

    const startPg = book ? book.currentPage : 0;
    startPageInput.value = startPg;
    endPageInput.value = startPg;
    pagesReadDisplay.textContent = '0';

    const updatePagesRead = () => {
      const start = parseInt(startPageInput.value, 10) || 0;
      const end = parseInt(endPageInput.value, 10) || start;
      pagesReadDisplay.textContent = Math.max(0, end - start);
    };

    startPageInput.oninput = updatePagesRead;
    endPageInput.oninput = updatePagesRead;

    openModal('modal-finish-session');
  }

  // ============================================================================
  // Forms & Modal Binding
  // ============================================================================
  function bindModals() {
    // Modal Close Buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        closeModal(modalId);
      });
    });

    // Close when tapping modal backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop.id);
        }
      });
    });

    // Bookshelf filter pills
    document.querySelectorAll('.bookshelf-pill[data-filter]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.bookshelf-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeBookFilter = pill.getAttribute('data-filter');
        renderBookshelf();
      });
    });

    // Bookshelf Search
    const bSearch = document.getElementById('bookshelf-search');
    if (bSearch) bSearch.addEventListener('input', () => renderBookshelf());

    // Journal Search & Filter
    const jSearch = document.getElementById('journal-search');
    if (jSearch) jSearch.addEventListener('input', () => renderJournal());

    const jBookFilter = document.getElementById('journal-book-filter');
    if (jBookFilter) {
      jBookFilter.addEventListener('change', () => {
        activeJournalFilter = jBookFilter.value;
        renderJournal();
      });
    }

    // Google Sign-In button on Welcome View
    const googleBtn = document.getElementById('btn-google-signin');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        const originalHtml = googleBtn.innerHTML;
        try {
          googleBtn.disabled = true;
          googleBtn.textContent = "Connecting to Google...";
          await FolioAuth.signInWithGoogle();
          renderCurrentView();
        } catch (err) {
          if (err.message === "FIREBASE_NOT_CONFIGURED" || err.message === "FIREBASE_CONFIG_REQUIRED") {
            openModal('modal-firebase-setup');
          }
        } finally {
          googleBtn.disabled = false;
          googleBtn.innerHTML = originalHtml;
        }
      });
    }

    // Guest Mode button on Welcome View
    const guestBtn = document.getElementById('btn-guest-mode');
    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        FolioAuth.startGuestMode();
        showToast("Welcome! Exploring Folio in Local Mode.", "info");
      });
    }

    // Sign out button
    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        if (confirm("Sign out of Folio?")) {
          closeModal('modal-settings');
          await FolioAuth.signOut();
          showToast("Signed out successfully.", "info");
        }
      });
    }

    // Theme selector in settings
    document.querySelectorAll('input[name="theme-choice"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const chosen = e.target.value;
        applyTheme(chosen);
        FolioDB.savePreferences({ theme: chosen });
      });
    });
  }

  function bindForms() {
    // 1. Book Form Submit
    const bookForm = document.getElementById('form-book');
    if (bookForm) {
      bookForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const total = parseInt(document.getElementById('book-form-total-pages').value, 10);
        const current = parseInt(document.getElementById('book-form-current-page').value, 10) || 0;

        const bookPayload = {
          id: currentEditingBookId || undefined,
          title: document.getElementById('book-form-title').value,
          author: document.getElementById('book-form-author').value,
          coverUrl: document.getElementById('book-form-cover').value,
          totalPages: total,
          currentPage: current,
          status: document.getElementById('book-form-status').value,
          tags: document.getElementById('book-form-tags').value,
          description: document.getElementById('book-form-desc').value
        };

        try {
          await FolioDB.saveBook(bookPayload);
          closeModal('modal-book-form');
          showToast(currentEditingBookId ? "Book updated!" : "Book added to shelf!", "success");
          currentEditingBookId = null;
        } catch (err) {
          showToast(err.message || "Failed to save book", "error");
        }
      });
    }

    // 2. Finish Session Submit
    const finishForm = document.getElementById('form-finish-session');
    if (finishForm) {
      finishForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const timerState = FolioTimer.getState();
        const startPg = parseInt(document.getElementById('finish-start-page').value, 10) || 0;
        const endPg = parseInt(document.getElementById('finish-end-page').value, 10) || startPg;
        const rating = parseInt(document.querySelector('input[name="session-rating"]:checked')?.value || '5', 10);
        const notes = document.getElementById('finish-notes').value;

        const sessionPayload = {
          bookId: timerState.bookId,
          bookTitle: timerState.bookTitle,
          startPage: startPg,
          endPage: endPg,
          durationSeconds: timerState.elapsedSeconds,
          durationMinutes: Math.max(1, Math.round(timerState.elapsedSeconds / 60)),
          focusRating: rating,
          notes: notes
        };

        try {
          const savedSession = await FolioDB.saveSession(sessionPayload);
          FolioTimer.reset();
          closeModal('modal-finish-session');
          showToast("Reading session logged!", "success");

          // Offer to add reflection
          if (confirm("Great reading session! Would you like to record a reflection now?")) {
            openAddReflectionModal(timerState.bookId, savedSession.id);
          }
        } catch (err) {
          showToast(err.message || "Failed to save session", "error");
        }
      });
    }

    // 3. Manual Session Log Form
    const manualForm = document.getElementById('form-manual-session');
    if (manualForm) {
      manualForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookId = document.getElementById('manual-book-select').value;
        const book = FolioDB.getBookById(bookId);
        const durationMins = parseInt(document.getElementById('manual-duration').value, 10) || 15;
        const startPg = parseInt(document.getElementById('manual-start-page').value, 10) || 0;
        const endPg = parseInt(document.getElementById('manual-end-page').value, 10) || startPg;
        const dateVal = document.getElementById('manual-date').value || new Date().toISOString().split('T')[0];

        const sessionPayload = {
          bookId: bookId,
          bookTitle: book ? book.title : "Manual Reading",
          startPage: startPg,
          endPage: endPg,
          durationMinutes: durationMins,
          durationSeconds: durationMins * 60,
          sessionDate: dateVal,
          notes: document.getElementById('manual-notes').value
        };

        try {
          await FolioDB.saveSession(sessionPayload);
          closeModal('modal-manual-session');
          showToast("Manual session recorded!", "success");
        } catch (err) {
          showToast(err.message || "Failed to log session", "error");
        }
      });
    }

    // 4. Reflection Form Submit
    const refForm = document.getElementById('form-reflection');
    if (refForm) {
      refForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookId = document.getElementById('reflection-book-select').value;
        const book = FolioDB.getBookById(bookId);

        const refPayload = {
          id: currentEditingReflectionId || undefined,
          bookId: bookId,
          bookTitle: book ? book.title : "General Reading",
          quote: document.getElementById('ref-quote').value,
          learned: document.getElementById('ref-learned').value,
          standout: document.getElementById('ref-standout').value,
          application: document.getElementById('ref-application').value,
          revisitPage: document.getElementById('ref-revisit').value,
          notes: document.getElementById('ref-freeform').value
        };

        try {
          await FolioDB.saveReflection(refPayload);
          closeModal('modal-reflection-form');
          showToast(currentEditingReflectionId ? "Reflection updated!" : "Reflection saved to journal!", "success");
          currentEditingReflectionId = null;
        } catch (err) {
          showToast(err.message || "Failed to save reflection", "error");
        }
      });
    }

    // 5. Firebase Custom Config Save
    const fbForm = document.getElementById('form-firebase-config');
    if (fbForm) {
      fbForm.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          let raw = document.getElementById('fb-json-input').value.trim();
          // Clean up if copied with "const firebaseConfig = " or trailing semicolon
          if (raw.includes('{')) {
            raw = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
          }
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (jsonErr) {
            // Support unquoted JS object keys like { apiKey: "..." }
            const fixedJson = raw
              .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
              .replace(/'/g, '"')
              .replace(/,\s*([}\]])/g, '$1');
            parsed = JSON.parse(fixedJson);
          }

          if (!parsed.apiKey || !parsed.authDomain) {
            throw new Error("Missing apiKey or authDomain in config");
          }

          FolioFirebase.saveCustomConfig(parsed);
        } catch (err) {
          alert("Could not parse Firebase configuration. Please make sure to copy the entire { apiKey: ..., authDomain: ... } object from the Firebase Console.");
        }
      });
    }

    // 6. Gemini API Key Save in Settings
    const geminiForm = document.getElementById('form-gemini-key');
    if (geminiForm) {
      geminiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const keyInput = document.getElementById('gemini-key-input');
        const key = keyInput.value.trim();
        const submitBtn = geminiForm.querySelector('button[type="submit"]');

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "Validating with Google...";
          const res = await FolioAI.saveKey(key);
          showToast(res.message || "Gemini key verified and saved!", "success");
          updateAISettingsUI();
        } catch (err) {
          showToast(err.message || "Could not validate Gemini key", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Key";
        }
      });
    }
  }

  // ============================================================================
  // Book Modal Openers & Actions
  // ============================================================================
  function openAddBookModal() {
    currentEditingBookId = null;
    document.getElementById('modal-book-title').textContent = "Add Book";
    document.getElementById('form-book').reset();
    document.getElementById('book-form-current-page').value = '0';
    document.getElementById('book-form-status').value = 'reading';
    openModal('modal-book-form');
  }

  function openEditBookModal(bookId) {
    const book = FolioDB.getBookById(bookId);
    if (!book) return;

    currentEditingBookId = book.id;
    document.getElementById('modal-book-title').textContent = "Edit Book";
    document.getElementById('book-form-title').value = book.title;
    document.getElementById('book-form-author').value = book.author;
    document.getElementById('book-form-cover').value = book.coverUrl || '';
    document.getElementById('book-form-total-pages').value = book.totalPages;
    document.getElementById('book-form-current-page').value = book.currentPage;
    document.getElementById('book-form-status').value = book.status;
    document.getElementById('book-form-tags').value = (book.tags || []).join(', ');
    document.getElementById('book-form-desc').value = book.description || '';

    closeModal('modal-book-detail');
    openModal('modal-book-form');
  }

  function openBookDetail(bookId) {
    const book = FolioDB.getBookById(bookId);
    if (!book) return;

    const modal = document.getElementById('modal-book-detail');
    if (!modal) return;

    const progress = Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
    const bookSessions = FolioDB.getSessionsForBook(book.id);
    const bookReflections = FolioDB.getReflectionsForBook(book.id);
    const totalMinutes = bookSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    document.getElementById('book-detail-content').innerHTML = `
      <div style="display: flex; gap: 16px; margin-bottom: 20px;">
        ${renderCoverThumb(book, 72, 105)}
        <div style="flex: 1; min-width: 0;">
          <span class="status-badge ${book.status}" style="margin-bottom: 6px;">${formatStatus(book.status)}</span>
          <h3 class="serif-heading" style="font-size: 1.4rem; margin-bottom: 4px;">${escapeHtml(book.title)}</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 8px;">by ${escapeHtml(book.author)}</p>
          <div style="font-size: 0.8rem; color: var(--text-dim);">
            Page ${book.currentPage} of ${book.totalPages} (${progress}%)
          </div>
        </div>
      </div>

      <div class="progress-bar-bg" style="margin-bottom: 18px; height: 8px;">
        <div class="progress-bar-fill" style="width: ${progress}%"></div>
      </div>

      <div class="stats-grid" style="margin-bottom: 18px;">
        <div class="stat-card">
          <div class="stat-value">${bookSessions.length}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalMinutes}m</div>
          <div class="stat-label">Time Read</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${bookReflections.length}</div>
          <div class="stat-label">Reflections</div>
        </div>
      </div>

      ${book.description ? `<p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 18px; background: var(--bg-surface-elevated); padding: 12px; border-radius: 10px;">${escapeHtml(book.description)}</p>` : ''}

      <!-- Book Action Buttons -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <button class="btn btn-primary btn-sm" onclick="FolioUI.openTimerWithBook('${book.id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Read Now
        </button>
        <button class="btn btn-secondary btn-sm" onclick="FolioUI.openAddReflectionModal('${book.id}')">
          + Reflect
        </button>
      </div>

      <!-- AI Features for this book -->
      <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span class="ai-badge">Folio AI (Gemini)</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">Book Companion</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="FolioUI.launchAIQuestionsForBook('${book.id}')">
            Discussion Questions
          </button>
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="FolioUI.launchAISummarizeForBook('${book.id}')">
            Summarize Notes
          </button>
        </div>
      </div>

      <!-- Edit / Delete -->
      <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
        <button class="btn btn-subtle btn-sm" onclick="FolioUI.openEditBookModal('${book.id}')">Edit Book</button>
        <button class="btn btn-subtle btn-sm" style="color: #c53030;" onclick="FolioUI.deleteBookConfirm('${book.id}')">Delete</button>
      </div>
    `;

    openModal('modal-book-detail');
  }

  async function deleteBookConfirm(bookId) {
    if (confirm("Are you sure you want to delete this book? This will not delete past reading sessions.")) {
      closeModal('modal-book-detail');
      await FolioDB.deleteBook(bookId);
      showToast("Book deleted", "info");
    }
  }

  // ============================================================================
  // Reflection Openers & Actions
  // ============================================================================
  function openAddReflectionModal(preselectedBookId = null, sessionId = null) {
    currentEditingReflectionId = null;
    document.getElementById('modal-reflection-title').textContent = "New Reflection";
    document.getElementById('form-reflection').reset();

    const books = FolioDB.getBooks();
    const select = document.getElementById('reflection-book-select');
    if (select) {
      select.innerHTML = books.map(b =>
        `<option value="${b.id}" ${preselectedBookId === b.id ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
      ).join('');
    }

    closeModal('modal-book-detail');
    openModal('modal-reflection-form');
  }

  function editReflection(refId) {
    const reflections = FolioDB.getReflections();
    const r = reflections.find(item => item.id === refId);
    if (!r) return;

    currentEditingReflectionId = r.id;
    document.getElementById('modal-reflection-title').textContent = "Edit Reflection";

    const select = document.getElementById('reflection-book-select');
    if (select) select.value = r.bookId;

    document.getElementById('ref-quote').value = r.quote || '';
    document.getElementById('ref-learned').value = r.learned || '';
    document.getElementById('ref-standout').value = r.standout || '';
    document.getElementById('ref-application').value = r.application || '';
    document.getElementById('ref-revisit').value = r.revisitPage || '';
    document.getElementById('ref-freeform').value = r.notes || '';

    openModal('modal-reflection-form');
  }

  async function deleteReflectionConfirm(refId) {
    if (confirm("Delete this reflection entry?")) {
      await FolioDB.deleteReflection(refId);
      showToast("Reflection deleted", "info");
    }
  }

  // ============================================================================
  // Gemini AI Studio Interactions
  // ============================================================================
  function openAIStudioModal() {
    openModal('modal-ai');
    updateAISettingsUI();
  }

  async function updateAISettingsUI() {
    const statusBox = document.getElementById('ai-status-pill');
    const status = await FolioAI.getStatus();

    if (statusBox) {
      if (status.configured) {
        statusBox.className = "sync-badge";
        statusBox.innerHTML = `<span class="sync-dot" style="background:#38a169;"></span> Active (${status.model})`;
      } else {
        statusBox.className = "sync-badge offline";
        statusBox.innerHTML = `<span class="sync-dot" style="background:#e53e3e;"></span> Key Required`;
      }
    }
  }

  async function launchAIQuestionsForBook(bookId) {
    const book = FolioDB.getBookById(bookId);
    if (!book) return;

    closeModal('modal-book-detail');
    openModal('modal-ai');

    const outputBox = document.getElementById('ai-output-text');
    const loadingEl = document.getElementById('ai-loading');
    outputBox.value = "";
    loadingEl.style.display = "block";

    try {
      const bookReflections = FolioDB.getReflectionsForBook(book.id);
      const notes = bookReflections.map(r => r.notes || r.learned || '').join('\n');
      const questions = await FolioAI.generateQuestions(book.title, book.author, '', notes);
      outputBox.value = questions;
    } catch (err) {
      outputBox.value = `Error generating questions: ${err.message}`;
    } finally {
      loadingEl.style.display = "none";
    }
  }

  async function launchAISummarizeForBook(bookId) {
    const book = FolioDB.getBookById(bookId);
    if (!book) return;

    const bookReflections = FolioDB.getReflectionsForBook(book.id);
    const notes = bookReflections.map(r => [r.learned, r.standout, r.notes].filter(Boolean).join('. ')).join('\n\n');

    if (!notes.trim()) {
      showToast("Add some reflections for this book first so Gemini has notes to summarize!", "info");
      return;
    }

    closeModal('modal-book-detail');
    openModal('modal-ai');

    const outputBox = document.getElementById('ai-output-text');
    const loadingEl = document.getElementById('ai-loading');
    outputBox.value = "";
    loadingEl.style.display = "block";

    try {
      const summary = await FolioAI.summarizeNotes(book.title, book.author, notes);
      outputBox.value = summary;
    } catch (err) {
      outputBox.value = `Error summarizing notes: ${err.message}`;
    } finally {
      loadingEl.style.display = "none";
    }
  }

  async function runAIAction(actionType) {
    const outputBox = document.getElementById('ai-output-text');
    const loadingEl = document.getElementById('ai-loading');
    const books = FolioDB.getBooks();
    const reflections = FolioDB.getReflections();
    const sessions = FolioDB.getSessions();

    outputBox.value = "";
    loadingEl.style.display = "block";

    try {
      let result = "";
      if (actionType === 'summarize') {
        const allNotes = reflections.map(r => `[${r.bookTitle}]: ${r.learned || r.notes}`).filter(Boolean).join('\n');
        if (!allNotes.trim()) throw new Error("Please write some reflections first so Folio AI can summarize them.");
        result = await FolioAI.summarizeNotes("All Current Books", "Various", allNotes);
      } else if (actionType === 'questions') {
        const currentBook = books.find(b => b.status === 'reading') || books[0];
        if (!currentBook) throw new Error("Add a book to your shelf first.");
        result = await FolioAI.generateQuestions(currentBook.title, currentBook.author);
      } else if (actionType === 'quiz') {
        const material = reflections.map(r => r.learned || r.notes).filter(Boolean).join('\n\n');
        if (!material.trim()) throw new Error("Please record some reflections or learnings to generate a quiz from.");
        result = await FolioAI.generateQuiz("Recent Reading", material);
      } else if (actionType === 'connect') {
        if (reflections.length < 2) throw new Error("At least 2 reflections from your reading are needed to connect ideas across books.");
        result = await FolioAI.connectIdeas(reflections.slice(0, 8));
      } else if (actionType === 'weekly') {
        const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
        const weekSessions = sessions.filter(s => new Date(s.createdAt) >= oneWeekAgo);
        const weekRefs = reflections.filter(r => new Date(r.createdAt) >= oneWeekAgo);
        const totalMins = weekSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
        const totalPgs = weekSessions.reduce((acc, s) => acc + (s.pagesRead || 0), 0);
        result = await FolioAI.generateWeeklyReview(weekSessions, weekRefs, totalMins, totalPgs);
      }

      outputBox.value = result;
    } catch (err) {
      outputBox.value = `AI Note: ${err.message}`;
    } finally {
      loadingEl.style.display = "none";
    }
  }

  function saveAIOutputToJournal() {
    const text = document.getElementById('ai-output-text').value.trim();
    if (!text) {
      showToast("No generated text to save", "info");
      return;
    }

    const books = FolioDB.getBooks();
    const activeBook = books.find(b => b.status === 'reading') || books[0];

    FolioDB.saveReflection({
      bookId: activeBook ? activeBook.id : "",
      bookTitle: activeBook ? activeBook.title : "Folio AI Synthesis",
      learned: text.slice(0, 300),
      notes: text
    });

    closeModal('modal-ai');
    showToast("AI insights saved to Journal!", "success");
    switchTab('journal');
  }

  // ============================================================================
  // Helpers & Toast Notifications
  // ============================================================================
  function renderCoverThumb(book, width = 72, height = 105) {
    if (book.coverUrl && (book.coverUrl.startsWith('http://') || book.coverUrl.startsWith('https://'))) {
      return `<img class="book-cover-thumb" style="width: ${width}px; height: ${height}px; object-fit: cover;" src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}" onerror="this.outerHTML=FolioUI.renderFallbackCover('${escapeHtml(book.title)}', '${escapeHtml(book.author)}', ${width}, ${height});" />`;
    }
    return renderFallbackCover(book.title, book.author, width, height);
  }

  function renderFallbackCover(title, author, width = 72, height = 105) {
    const cleanTitle = (title || 'Untitled').trim();
    const cleanAuthor = (author || 'Folio').trim();
    return `
      <div class="book-cover-thumb" style="width: ${width}px; height: ${height}px;">
        <div class="book-cover-inner">
          <div style="font-size: 0.48rem; letter-spacing: 0.12em; opacity: 0.45;">— FOLIO —</div>
          <div class="book-cover-title">${escapeHtml(cleanTitle)}</div>
          <div class="book-cover-author">${escapeHtml(cleanAuthor)}</div>
        </div>
      </div>
    `;
  }

  function formatStatus(status) {
    switch (status) {
      case 'reading': return 'Reading';
      case 'to-read': return 'Want to Read';
      case 'completed': return 'Completed';
      case 'paused': return 'Paused';
      default: return status;
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
  }

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function exportBackupJSON() {
    const data = FolioDB.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folio_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Reading library backup downloaded!", "success");
  }

  return {
    init,
    switchTab,
    openTimerModal,
    openTimerWithBook,
    startReadingBook,
    openAddBookModal,
    openEditBookModal,
    openBookDetail,
    deleteBookConfirm,
    openAddReflectionModal,
    editReflection,
    deleteReflectionConfirm,
    openAIStudioModal,
    runAIAction,
    saveAIOutputToJournal,
    updateAISettingsUI,
    showToast,
    openModal,
    closeModal,
    renderCoverThumb,
    renderFallbackCover,
    exportBackupJSON
  };
})();

window.FolioUI = FolioUI;
