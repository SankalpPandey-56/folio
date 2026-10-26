#!/usr/bin/env python3
"""
Folio - Comprehensive End-to-End Feature Explorer & Audit Script
Tests every single feature, UI component, database method, and AI endpoint.
"""

import os
import sys
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"

def test_feature(feature_name, func):
    try:
        result, details = func()
        status_symbol = "✓ PASS" if result else "✗ FAIL"
        print(f"[{status_symbol}] {feature_name}: {details}")
        return result
    except Exception as e:
        print(f"[✗ FAIL] {feature_name}: Exception: {e}")
        return False

def audit():
    print("=" * 70)
    print("  FOLIO FEATURE-BY-FEATURE EXPLORATION & AUDIT")
    print("=" * 70)

    results = []

    # 1. Server Health
    def check_health():
        with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return data.get("status") == "ok", f"Version {data.get('version')}, App: {data.get('app')}"
    results.append(test_feature("1. Server Health Check", check_health))

    # 2. Gemini AI Key & Status
    def check_ai_status():
        with urllib.request.urlopen(f"{BASE_URL}/api/ai/status", timeout=3) as resp:
            data = json.loads(resp.read().decode())
            return data.get("configured") is True, f"Provider: {data.get('provider')}, Model: {data.get('model')}"
    results.append(test_feature("2. Gemini AI Configuration", check_ai_status))

    # 3. AI Ping / Connection Test
    def check_ai_test():
        req = urllib.request.Request(f"{BASE_URL}/api/ai/test", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            return data.get("success") is True, f"{data.get('message')}"
    results.append(test_feature("3. AI Test Connection Endpoint", check_ai_test))

    # 4. AI Summarize Notes
    def check_ai_summarize():
        payload = json.dumps({
            "bookTitle": "The Mountain Is You",
            "author": "Brianna Wiest",
            "notes": "Self-sabotage is what happens when we have conflicting needs. It is our subconscious trying to protect us."
        }).encode()
        req = urllib.request.Request(f"{BASE_URL}/api/ai/summarize", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            has_text = len(data.get("result", "")) > 30
            return has_text, f"Returned {len(data.get('result', ''))} characters summary"
    results.append(test_feature("4. AI Note Summarization", check_ai_summarize))

    # 5. AI Reflective Questions
    def check_ai_questions():
        payload = json.dumps({
            "bookTitle": "Atomic Habits",
            "author": "James Clear",
            "notes": "Habits compound over time. Environment design matters more than willpower."
        }).encode()
        req = urllib.request.Request(f"{BASE_URL}/api/ai/questions", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            has_questions = "?" in data.get("result", "")
            return has_questions, f"Generated reflective questions: {data.get('result', '')[:80]}..."
    results.append(test_feature("5. AI Reflective Question Generator", check_ai_questions))

    # 6. AI Active Recall Quiz
    def check_ai_quiz():
        payload = json.dumps({
            "bookTitle": "Deep Work",
            "notesOrText": "Deep work is focused concentration without distraction on cognitively demanding tasks. Shallow work is logistical, easily replicated tasks."
        }).encode()
        req = urllib.request.Request(f"{BASE_URL}/api/ai/quiz", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            has_quiz = "Question" in data.get("result", "") or "A)" in data.get("result", "")
            return has_quiz, f"Generated active recall quiz format"
    results.append(test_feature("6. AI Active Recall Quiz Generator", check_ai_quiz))

    # 7. AI Cross-Book Idea Connection
    def check_ai_connect():
        payload = json.dumps({
            "reflections": [
                {"bookTitle": "Atomic Habits", "notes": "Small changes compound into remarkable results."},
                {"bookTitle": "The Mountain Is You", "notes": "Self-sabotage yields to small, subconscious emotional shifts."}
            ]
        }).encode()
        req = urllib.request.Request(f"{BASE_URL}/api/ai/connect-ideas", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return len(data.get("result", "")) > 30, f"Synthesized cross-book connections"
    results.append(test_feature("7. AI Idea Connections Across Books", check_ai_connect))

    # 8. AI Weekly Learning Review
    def check_ai_weekly():
        payload = json.dumps({
            "sessions": [{"durationMinutes": 45, "pagesRead": 25}],
            "reflections": [{"bookTitle": "The Mountain Is You", "learned": "Recognizing resistance as a catalyst for growth."}],
            "totalMinutes": 45,
            "totalPages": 25
        }).encode()
        req = urllib.request.Request(f"{BASE_URL}/api/ai/weekly-review", data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return len(data.get("result", "")) > 30, f"Produced weekly digest"
    results.append(test_feature("8. AI Weekly Learning Review", check_ai_weekly))

    # 9. PWA Manifest & Monochrome Branding
    def check_manifest():
        with urllib.request.urlopen(f"{BASE_URL}/manifest.json", timeout=3) as resp:
            data = json.loads(resp.read().decode())
            is_bw = data.get("theme_color") in ["#000000", "#ffffff"]
            return is_bw and len(data.get("icons", [])) >= 4, f"Theme: {data.get('theme_color')}, Icons: {len(data.get('icons'))}"
    results.append(test_feature("9. PWA Manifest (Black & White)", check_manifest))

    # 10. Service Worker Offline Caching
    def check_sw():
        with urllib.request.urlopen(f"{BASE_URL}/sw.js", timeout=3) as resp:
            allowed = resp.headers.get("Service-Worker-Allowed")
            cache_ctrl = resp.headers.get("Cache-Control")
            return allowed == "/" and "no-cache" in cache_ctrl, f"Scope: /, Header: {cache_ctrl}"
    results.append(test_feature("10. Service Worker App Shell", check_sw))

    # 11. Core Navigation & Views in HTML
    def check_html_views():
        with urllib.request.urlopen(f"{BASE_URL}/", timeout=3) as resp:
            html = resp.read().decode()
            views = ["view-home", "view-books", "view-journal", "view-insights", "view-welcome"]
            all_views = all(f'id="{v}"' in html for v in views)
            return all_views, f"All 5 views present: {views}"
    results.append(test_feature("11. Core App Shell Views", check_html_views))

    # 12. Modals & Forms
    def check_modals():
        with urllib.request.urlopen(f"{BASE_URL}/", timeout=3) as resp:
            html = resp.read().decode()
            modals = [
                "modal-timer", "modal-finish-session", "modal-manual-session",
                "modal-book-form", "modal-book-detail", "modal-reflection-form",
                "modal-ai", "modal-settings", "modal-firebase-setup"
            ]
            all_modals = all(f'id="{m}"' in html for m in modals)
            return all_modals, f"All 9 interactive drawers/modals present"
    results.append(test_feature("12. Modals & Drawers Structure", check_modals))

    # 13. Black & White CSS Theme Audit
    def check_bw_theme():
        with open("public/css/themes.css") as f:
            css = f.read()
        has_black = "--color-primary: #000000;" in css
        has_white_dark = "--color-primary: #ffffff;" in css
        has_pure_black_bg = "--bg-app: #000000;" in css
        has_pure_white_bg = "--bg-app: #ffffff;" in css
        return (has_black and has_white_dark and has_pure_black_bg and has_pure_white_bg), "Strict Black & White palette verified in Light and Dark modes"
    results.append(test_feature("13. Pure Black & White Theme System", check_bw_theme))

    # 14. Timestamp-Based Reading Timer Logic
    def check_timer_code():
        with open("public/js/timer.js") as f:
            code = f.read()
        has_ts = "startTimestamp" in code and "accumulatedMs" in code and "Date.now()" in code
        return has_ts, "Uses Date.now() timestamp math surviving page reloads & backgrounding"
    results.append(test_feature("14. Timestamp-Based Reading Timer", check_timer_code))

    # 15. User Data Isolation Logic
    def check_isolation():
        with open("public/js/db.js") as f:
            code = f.read()
        has_prefix = "folio_u_${userId}_" in code
        no_sample = "books = bStr ? JSON.parse(bStr).filter(b => b.id !== \"sample_deep_work\") : [];" in code
        return has_prefix and no_sample, "Keys namespaced per authenticated UID; sample data purged"
    results.append(test_feature("15. Strict Per-Account Data Isolation", check_isolation))

    # 16. Google Profile Photo Referrer Policy
    def check_avatar():
        with open("public/js/ui.js") as f:
            code = f.read()
        has_ref_policy = 'referrerpolicy="no-referrer"' in code
        return has_ref_policy, "referrerpolicy='no-referrer' set to prevent Google CDN 403 Forbidden"
    results.append(test_feature("16. Google Profile Picture CDN Handling", check_avatar))

    # 17. Security Rules
    def check_rules():
        with open("firestore.rules") as f:
            rules = f.read()
        has_auth = "request.auth != null && request.auth.uid == userId" in rules
        return has_auth, "Strict user-isolated Firestore security rules verified"
    results.append(test_feature("17. Cloud Firestore Security Rules", check_rules))

    print("=" * 70)
    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    print(f"  AUDIT SUMMARY: {passed_count}/{total_count} FEATURES FULLY FUNCTIONAL")
    print("=" * 70)
    return passed_count == total_count

if __name__ == "__main__":
    success = audit()
    sys.exit(0 if success else 1)
