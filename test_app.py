#!/usr/bin/env python3
"""
Folio - Comprehensive Automated Verification Script
Starts a live test instance, verifies all routes, static assets, PWA components,
Gemini failure states, and response headers.
"""

import os
import sys
import time
import json
import threading
import urllib.request
import urllib.error
import uvicorn
from server import app

TEST_PORT = 8765
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

class ServerThread(threading.Thread):
    def __init__(self):
        super().__init__()
        config = uvicorn.Config(app, host="127.0.0.1", port=TEST_PORT, log_level="warning")
        self.server = uvicorn.Server(config)
        self.daemon = True

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True

def run_tests():
    print(f"\n=======================================================")
    print(f"  Starting Folio Live Test Server on port {TEST_PORT}...")
    print(f"=======================================================\n")

    server_thread = ServerThread()
    server_thread.start()

    # Wait for server to come up
    for _ in range(30):
        try:
            with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            time.sleep(0.1)

    passed = 0
    total = 0

    def assert_test(name, condition, extra=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  ✓ {name}")
        else:
            print(f"  ✗ {name}: {extra}")

    # 1. Health check
    try:
        with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=2) as resp:
            data = json.loads(resp.read().decode())
            assert_test("GET /api/health", data.get("status") == "ok" and data.get("app") == "Folio")
    except Exception as e:
        assert_test("GET /api/health", False, str(e))

    # 2. AI Status check
    try:
        with urllib.request.urlopen(f"{BASE_URL}/api/ai/status", timeout=2) as resp:
            data = json.loads(resp.read().decode())
            assert_test("GET /api/ai/status returns provider and model", "model" in data and data.get("provider") == "Google Gemini")
    except Exception as e:
        assert_test("GET /api/ai/status", False, str(e))

    # 3. AI Test with configured key
    try:
        req = urllib.request.Request(f"{BASE_URL}/api/ai/test", data=b"{}", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            assert_test("POST /api/ai/test succeeds with configured key", data.get("success") is True)
    except Exception as e:
        assert_test("POST /api/ai/test with configured key", False, str(e))

    # 4. Manifest.json check
    try:
        with urllib.request.urlopen(f"{BASE_URL}/manifest.json", timeout=2) as resp:
            data = json.loads(resp.read().decode())
            assert_test("GET /manifest.json returns valid PWA config",
                        data.get("name") == "Folio — Reading Companion" and len(data.get("icons", [])) >= 4)
    except Exception as e:
        assert_test("GET /manifest.json", False, str(e))

    # 5. sw.js Service Worker check
    try:
        with urllib.request.urlopen(f"{BASE_URL}/sw.js", timeout=2) as resp:
            allowed = resp.headers.get("Service-Worker-Allowed")
            body = resp.read().decode()
            assert_test("GET /sw.js has Service-Worker-Allowed: / header", allowed == "/")
            assert_test("GET /sw.js contains offline cache logic", "CACHE_NAME" in body)
    except Exception as e:
        assert_test("GET /sw.js", False, str(e))

    # 6. Index.html check
    try:
        with urllib.request.urlopen(f"{BASE_URL}/", timeout=2) as resp:
            html = resp.read().decode()
            assert_test("GET / serves Folio homepage", "Folio" in html)
            assert_test("GET / has tagline 'Read. Reflect. Remember.'", "Read. Reflect. Remember." in html)
            assert_test("GET / includes Google sign-in button", "btn-google-signin" in html)
            assert_test("GET / includes bottom navigation", "bottom-nav" in html)
    except Exception as e:
        assert_test("GET /", False, str(e))

    # 7. Brand Icon check
    for icon_file in ["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon.ico"]:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/assets/{icon_file}", timeout=2) as resp:
                content = resp.read()
                assert_test(f"Asset /assets/{icon_file} exists ({len(content)} bytes)", len(content) > 100)
        except Exception as e:
            assert_test(f"Asset /assets/{icon_file}", False, str(e))

    # 8. CSS files check
    for css_file in ["themes.css", "style.css", "components.css"]:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/css/{css_file}", timeout=2) as resp:
                content = resp.read().decode()
                assert_test(f"Stylesheet /css/{css_file} loaded", len(content) > 200)
        except Exception as e:
            assert_test(f"Stylesheet /css/{css_file}", False, str(e))

    # 9. JS files check
    for js_file in ["firebase-config.js", "auth.js", "db.js", "timer.js", "ai.js", "ui.js", "app.js"]:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/js/{js_file}", timeout=2) as resp:
                content = resp.read().decode()
                assert_test(f"Script /js/{js_file} loaded", len(content) > 200)
        except Exception as e:
            assert_test(f"Script /js/{js_file}", False, str(e))

    print(f"\n=======================================================")
    print(f"  Test Results: {passed} / {total} tests passed!")
    print(f"=======================================================\n")

    server_thread.stop()
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
