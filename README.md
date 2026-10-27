# Folio — Lightweight Mobile-First AI Reading Companion

> **"Read. Reflect. Remember."**

Folio is a lightweight, mobile-first personal reading companion designed for one-handed phone use, offline-first reliability, and cloud synchronization. It enables readers to track physical books, measure reading sessions with a timestamp-based timer, capture deep reflections through guided literary prompts, and synthesize personal notes using Google Gemini AI.

---

## Architecture & Technology Stack

Designed specifically to be understandable, maintainable, and lightweight for developers familiar with Python, HTML, and CSS:

- **Frontend Structure**: Semantic HTML5 with an editorial layout.
- **Styling**: Vanilla CSS3 custom properties with Light, Dark, and System modes, fluid typography, and accessible touch targets ($\ge 44\text{px}$).
- **Interactions**: Clean Vanilla JavaScript (zero React, Next.js, or heavyweight framework overhead).
- **Authentication**: Firebase Authentication supporting Google Sign-In with session persistence.
- **Cloud Database**: Cloud Firestore with user-level isolation and real-time cross-device synchronization.
- **Security Rules**: Restrictive `firestore.rules` strictly requiring authentication and `request.auth.uid == userId`.
- **Backend & AI**: Lightweight Python FastAPI server (`server.py`) handling static asset delivery and server-side Google Gemini REST API requests. Secret API keys remain strictly on the server and are never exposed to browser bundles.
- **PWA Support**: Web App Manifest (`manifest.json`) and Service Worker (`sw.js`) supporting home-screen installation and offline app shell caching.
- **Total Asset Footprint**: Entire application and all icon variants comprise under **0.5 MB**!

---

## Quick Start (Local Development)

### 1. Requirements
- Python 3.8+
- Modern web browser (Chrome, Firefox, Safari, Edge)

### 2. Installation
Clone or navigate to the project directory and install the lightweight server requirements:

```bash
cd /Users/sankalppandey/Documents/book
pip install -r requirements.txt
```

### 3. Configure Gemini AI (Optional but Recommended)
Copy the example environment configuration:

```bash
cp .env.example .env
```

Open `.env` and add your free Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
PORT=8000
```
> **Tip:** You can obtain a free Gemini API key in under 60 seconds from [Google AI Studio](https://aistudio.google.com/).
> If skipped, all reading tracking, bookshelf management, and journaling features continue working seamlessly without AI.

### 4. Start the Application
Run the Python server:

```bash
python3 server.py
```

Open your browser to:
[http://localhost:8000](http://localhost:8000)

---

## Google Authentication & Firebase Cloud Sync Setup

Folio includes dual-mode data storage:
1. **Local/Guest Mode**: Works immediately out of the box without any cloud setup!
2. **Cloud Firestore Mode**: Provides multi-device real-time sync with Google Sign-In.

### Setting up Firebase Cloud Sync:
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. **Enable Google Sign-In**:
   - In the left sidebar, navigate to **Build** > **Authentication** > **Sign-in method**.
   - Enable **Google**, specify your project support email, and click **Save**.
3. **Create Cloud Firestore**:
   - In the left sidebar, navigate to **Build** > **Firestore Database**.
   - Click **Create database** (start in production mode).
   - In the **Rules** tab, deploy the restrictive security rules from [`firestore.rules`](./firestore.rules):
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if false;
         }
         match /users/{userId}/{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
4. **Register Web App**:
   - Go to **Project Settings** (gear icon) > **General** > **Your apps** > click the **Web (</>)** icon.
   - Copy the generated `firebaseConfig` object into [`public/js/firebase-config.js`](./public/js/firebase-config.js) or paste it directly in the app via **Settings > Firebase Cloud Sync**.
5. **Authorized Domains**:
   - Under **Authentication** > **Settings** > **Authorized domains**, ensure your deployment domain (e.g., `localhost` or your production HTTPS domain) is listed.

---

## Gemini AI Features

Folio connects directly with Google Gemini to offer reading assistance:

1. **Distill & Summarize Notes**: Synthesizes the reader's personal reflections into core principles, mental models, and actionable takeaways.
2. **Deep Reflective Questions**: Generates 3–4 thought-provoking philosophical and personal inquiry questions for active reading.
3. **Active Recall Quizzes**: Creates a 3-question self-test from chapter notes or user highlights to strengthen retention.
4. **Connecting Ideas Across Books**: Analyzes reflections across different books to uncover shared themes, philosophical tensions, or complementary frameworks.
5. **Weekly Reading Digest**: Automatically compiles reading minutes, pages read, and recorded takeaways into an encouraging weekly retrospective.

> **Context-Bounded AI**: Folio only transmits the notes or context you provide. It never hallucinates book passages or fabricates quotations. All AI outputs can be reviewed and edited before saving to your journal.

---

## Verification & Automated Tests

Folio includes a comprehensive test suite verifying routes, headers, PWA assets, and Gemini error handling:

```bash
python3 test_app.py
```

All 26 automated tests verify:
- Health check and server endpoints
- Secure API key validation
- Service worker registration and caching headers (`Service-Worker-Allowed: /`)
- Web app manifest integrity
- Icon dimensions, masks, and resolutions
- PWA installability

---

## Mobile First & PWA Installation

- **On Android**: Open Folio in Chrome, tap the menu (⋮), and select **Install app** or tap the install prompt banner at the top of the screen.
- **On iOS**: Open Folio in Safari, tap the Share icon, and select **Add to Home Screen**.
- **Offline Resilience**: If connectivity drops, Folio queues changes locally in IndexedDB/localStorage. A status indicator shows **Offline (Changes pending)** and synchronizes automatically upon reconnection.
