#!/usr/bin/env python3
"""Renderuje slides.html do RCB_SIGNAL_MoAI.pdf (16:9, 10 stron) i podglądów PNG.

Wymaga: Firefox + geckodriver (na tej maszynie: snap). Bez dodatkowych pakietów Pythona.
Fonty (Roboto Mono, Hind) ładowane są z Google Fonts — potrzebny internet.

  python3 render_pdf.py                 # PDF obok skryptu
  python3 render_pdf.py --previews DIR  # dodatkowo PNG każdego slajdu do DIR
"""

import argparse
import base64
import json
import pathlib
import subprocess
import time
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
PORT = 4444
W = f"http://localhost:{PORT}"


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(W + path, data=data, method=method, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=120).read())["value"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(HERE / "slides.html"))
    ap.add_argument("--out", default=str(HERE / "RCB_SIGNAL_MoAI.pdf"))
    ap.add_argument("--previews", default=None)
    a = ap.parse_args()

    driver = subprocess.Popen(["geckodriver", "--port", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        sid = req("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "firefox", "moz:firefoxOptions": {"args": ["-headless"]}}}})["sessionId"]
        S = f"/session/{sid}"
        try:
            req("POST", S + "/window/rect", {"width": 1300, "height": 800})
            req("POST", S + "/url", {"url": pathlib.Path(a.src).resolve().as_uri()})
            time.sleep(2)
            fonts = req("POST", S + "/execute/sync", {"script": "return document.fonts.check('700 20px \"Roboto Mono\"') && document.fonts.check('16px Hind')", "args": []})
            print("fonty załadowane:", fonts)
            slides = req("POST", S + "/elements", {"using": "css selector", "value": ".slide"})
            print("slajdy:", len(slides))
            if a.previews:
                out = pathlib.Path(a.previews)
                out.mkdir(parents=True, exist_ok=True)
                for i, el in enumerate(slides, 1):
                    eid = list(el.values())[0]
                    req("POST", S + "/execute/sync", {"script": "arguments[0].scrollIntoView()", "args": [el]})
                    time.sleep(0.2)
                    (out / f"slide-{i:02d}.png").write_bytes(base64.b64decode(req("GET", S + f"/element/{eid}/screenshot")))
            # 1280×720 px = 33,8667 × 19,05 cm
            pdf = req("POST", S + "/print", {"page": {"width": 33.8667, "height": 19.05},
                                              "margin": {"top": 0, "bottom": 0, "left": 0, "right": 0},
                                              "background": True, "shrinkToFit": False})
            pathlib.Path(a.out).write_bytes(base64.b64decode(pdf))
            print("zapisano:", a.out)
        finally:
            req("DELETE", S)
    finally:
        driver.terminate()


if __name__ == "__main__":
    main()
