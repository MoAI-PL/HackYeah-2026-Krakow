#!/usr/bin/env python3
"""Przechodzi scenariusz demo w Firefoksie (headless) i zapisuje czyste zrzuty do img/.

Uruchamia własny serwer demo (port 8765) i geckodriver (port 4444). Przy okazji
działa jako test end-to-end: jeśli któryś krok scenariusza się zepsuje, skrypt rzuci błąd.

  python3 capture_screenshots.py
"""

import base64
import json
import os
import pathlib
import subprocess
import time
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
APP_DIR = HERE.parent
OUT = HERE / "img"
W = "http://localhost:4444"
APP = "http://localhost:8765"


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(W + path, data=data, method=method, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=60).read())["value"]


def main():
    OUT.mkdir(exist_ok=True)
    server = subprocess.Popen(["python3", "server.py"], cwd=APP_DIR, env={**os.environ, "PORT": "8765"},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    driver = subprocess.Popen(["geckodriver", "--port", "4444"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        sid = req("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "firefox", "moz:firefoxOptions": {"args": ["-headless"]}}}})["sessionId"]
        S = f"/session/{sid}"
        js = lambda code: req("POST", S + "/execute/sync", {"script": code, "args": []})

        def click(sel, wait=0.5):
            if not js(f"const e=document.querySelector('{sel}'); if(!e) return false; e.click(); return true;"):
                raise RuntimeError(f"brak elementu: {sel}")
            time.sleep(wait)

        def go(h, wait=0.7):
            js(f"location.hash='{h}'")
            time.sleep(wait)

        def shot(name):
            js("document.querySelectorAll('.toast').forEach(t=>t.remove())")
            time.sleep(0.2)
            (OUT / f"{name}.png").write_bytes(base64.b64decode(req("GET", S + "/screenshot")))

        try:
            req("POST", S + "/window/rect", {"width": 1440, "height": 900})
            req("POST", S + "/url", {"url": APP + "/"}); time.sleep(1.5)
            js("localStorage.clear(); location.reload()"); time.sleep(1.5)
            click('[data-action="start-demo"]', 0.8); js("window.scrollTo(0,0)"); shot("overview")
            go("#/events/EVT-2026-1042", 1); click('[data-act="draft"]', 0.8)
            click('[data-act="analyze"]', 2.8); shot("writer-78")
            click('[data-act="apply"]', 2.0); shot("writer-92")
            click('[data-act="submit"]', 1.2); click("#confirm"); click('[data-act="approve"]', 4.5)
            click('[data-action="advance"]', 1); js("window.scrollTo(0,0)"); shot("changed")
            go("#/map", 1); shot("map")
            go("#/events/EVT-2026-1042"); click('[data-act="update"]', 0.8); click('[data-act="analyze"]', 2.8)
            click('[data-act="submit"]', 1.2); click("#confirm"); click('[data-act="approve"]', 4.5)
            go("#/events/EVT-2026-1042"); js("window.confirm=()=>true"); click('[data-act="close"]')
            go("#/reports/AAR-1042", 1); js("window.scrollTo(0,0)"); shot("aar")
            go("#/audit", 1); shot("audit")
            step = js("return document.querySelector('.presenter .p-step').innerText")
            print("koniec scenariusza:", step)
        finally:
            req("DELETE", S)
    finally:
        driver.terminate()
        server.terminate()


if __name__ == "__main__":
    main()
