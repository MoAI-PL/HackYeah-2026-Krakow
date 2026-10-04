#!/usr/bin/env python3
"""Składa statyczną wersję demo do publikacji (GitHub Pages, Netlify Drop, dowolny hosting plików).

Aplikacja liczy wszystko w przeglądarce, więc serwer nie jest potrzebny: wystarczy skopiować
web/ i data/ do jednego folderu. Opcjonalny doradczy LLM (/api/analyze) w wersji statycznej
jest niedostępny — aplikacja sama przechodzi wtedy na silnik regułowy.

Użycie:  python build_static.py  →  folder dist/
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

if DIST.exists():
    shutil.rmtree(DIST)
shutil.copytree(ROOT / "web", DIST)
shutil.copytree(ROOT / "data", DIST / "data")
(DIST / ".nojekyll").write_text("")  # GitHub Pages: nie przetwarzaj plików przez Jekyll
# Hugging Face Spaces (SDK „static”): konfiguracja Space'a w nagłówku README.md
(DIST / "README.md").write_text("""---
title: RCB SIGNAL
emoji: 🛡️
colorFrom: indigo
colorTo: pink
sdk: static
app_file: index.html
pinned: false
short_description: Wspomaganie decyzji dla dyżurnego RCB (demo)
---

# RCB SIGNAL — od alertu do działania

Demo systemu wspomagania decyzji dla dyżurnego RCB (HackYeah 2026, Open Task Defence, zespół MoAI).
Kliknij **▶ START DEMO** i przejdź scenariusz. Dane i zdarzenia są fikcyjne; wysyłka alertu jest tylko symulowana.

Kod źródłowy: https://github.com/MoAI-PL/HackYeah-2026-Krakow (folder `Open Defence/RCB SIGNAL`).
""", encoding="utf-8")

files = [p for p in DIST.rglob("*") if p.is_file()]
size = sum(p.stat().st_size for p in files) / 1e6
print(f"Gotowe: {DIST} ({len(files)} plików, {size:.1f} MB)")
print("Podgląd lokalny:  python -m http.server 8000 --directory dist  →  http://localhost:8000")
