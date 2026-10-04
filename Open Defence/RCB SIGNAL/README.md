# RCB SIGNAL — live demo

Demonstrator systemu wspomagania decyzji dla dyżurnego RCB: od wykrycia zagrożenia, przez kontrolę jakości komunikatu i zatwierdzenie przez człowieka, po symulowaną dystrybucję i raport po zdarzeniu.

> **Środowisko demonstracyjne — dane syntetyczne.** Aplikacja nie łączy się z żadnym systemem RCB ani operatorów i nie może wysłać prawdziwego alertu.

To **nie jest aplikacja dla obywatela**. To warstwa analityczna nad istniejącym procesem ostrzegania.

## Szybki start

Wymagany jest tylko **Python 3.10+**. Nie trzeba instalować zależności, budować projektu ani mieć internetu czy klucza API.

```bash
# 1. instalacja — brak zależności
# 2. konfiguracja (opcjonalnie)
cp .env.example .env
# 3. uruchomienie
python3 server.py          # lub: npm start
# 4. otwórz http://localhost:8080 i kliknij ▶ START DEMO
# 5. klawisz P pokazuje pasek prezentera; RESET DEMO przywraca stan początkowy
```

Port zmienisz przez `PORT=9000 python3 server.py`. Docker:

```bash
docker build -t rcb-signal . && docker run --rm -p 8080:8080 rcb-signal
```

## Wersja statyczna (publiczny link do demo)

Aplikacja liczy wszystko w przeglądarce, więc działa bez serwera:

```bash
python build_static.py        # tworzy folder dist/ (web + data, ok. 0,4 MB)
python -m http.server 8000 --directory dist   # podgląd: http://localhost:8000
```

Folder `dist/` można opublikować na GitHub Pages (wymaga publicznego repo), przez Netlify Drop (przeciągnięcie folderu) albo na dowolnym hostingu plików. W wersji statycznej opcjonalny doradczy LLM jest niedostępny — ocena działa na silniku regułowym.

## Co pokazuje demo

Jeden kompletny scenariusz end-to-end: **„Intensywne opady / podtopienia”** (prawdziwe granice powiatów woj. małopolskiego — Nowy Sącz i Dunajec; zdarzenia, populacja i komunikaty fikcyjne).

| Moduł | Ekran | Co widać |
|---|---|---|
| SIGNAL COMMAND | 01 Przegląd | wskaźniki sytuacji, zdarzenia priorytetowe, ostatnie działania |
| SIGNAL INTELLIGENCE | 02 Zdarzenia | 3 źródła połączone w jedno zdarzenie, oś czasu, status weryfikacji (zweryfikowane / niezweryfikowane), źródło niezweryfikowane, kwarantanna treści sterującej (prompt injection), możliwy duplikat z decyzją „połącz / to osobne zdarzenie” |
| SIGNAL GEO | 03 Mapa | obszar zagrożenia, obszar alertu i zgłoszenia, pokrycie populacji, luki |
| SIGNAL WRITER | 04 Alerty | edytor 160 znaków, analiza WHAT/WHERE/WHEN/ACTION, **wynik 78 → 92**, inne alerty w tych powiatach (7 dni) z planem odwołania, zatwierdzenie przez człowieka, symulowana dystrybucja z czasem dostarczenia per operator, aktualizacja |
| SIGNAL FEEDBACK | 05 Analityka | baseline vs SIGNAL, KPI pilotażu, uczenie się systemu |
| AFTER ACTION | 06 Raporty | raport AAR z dziennika sesji (dystrybucja, problemy, rekomendacje, podsumowanie dla mieszkańców) i raporty historyczne |
| AUDIT LOG | 07 Dziennik audytu | KTO · KIEDY · CO · DLACZEGO · NA PODSTAWIE dla każdej decyzji |

Scenariusz prowadzi **pasek prezentera** (domyślnie ukryty, klawisz `P`): pokazuje bieżący krok (0–12), podpowiedź, skrót „Przejdź →” i „Reset demo”. System nie przeskakuje etapów samodzielnie.

Scenariusz krok po kroku opisuje [DEMO_SCRIPT.md](DEMO_SCRIPT.md), a architekturę [ARCHITECTURE.md](ARCHITECTURE.md).

## Stany błędów

W edytorze alertu menu **„Wariant testowy”** wczytuje:

- **przekroczony limit znaków** — 173 / 160, zatwierdzenie zablokowane;
- **brak instrukcji działania** — „odbiorca może nie wiedzieć, co zrobić”, zatwierdzenie zablokowane;
- **polskie znaki** — ostrzeżenie o kodowaniu UCS-2.

W widoku zdarzeń widać źródło niezweryfikowane (EVT-2026-1042) i zgłoszenie z treścią sterującą poddane kwarantannie (EVT-2026-1044).

## Opcjonalny model językowy

Wynik jakości liczy zawsze **deterministyczny silnik regułowy** ([web/js/analyzer.js](web/js/analyzer.js)), dlatego demo jest powtarzalne i audytowalne. Model Claude może dodać wyłącznie **opinię doradczą** (bez wpływu na wynik):

```bash
pip install anthropic
# w .env: SIGNAL_PROVIDER=anthropic oraz ANTHROPIC_API_KEY=...
python3 server.py
```

Gdy dostawca nie odpowiada, interfejs pokazuje to i dalej działa na wyniku regułowym.

## Testy

```bash
python3 -m unittest discover tests        # serwer: endpointy, fallback, path traversal
node --test tests/analyzer.test.mjs        # silnik analizy i pełny scenariusz (Node 18+)
npm test                                   # oba zestawy
```

## Struktura

```text
server.py                 serwer HTTP (stdlib) + /api/health + /api/analyze (opcjonalny LLM)
data/poland-powiaty.json  powiaty Polski (PRG/GUGiK) do mapy poglądowej
data/demo-events.json     dane syntetyczne: 9 zdarzeń, 17 źródeł, 5 alertów, 8 powiatów, raporty AAR
web/index.html            punkt wejścia
web/css/signal.css        system wizualny (tokeny kolorów, układ, druk raportu)
web/js/app.js             powłoka, routing, pasek prezentera
web/js/store.js           stan i maszyna stanów scenariusza, dziennik audytu, analiza GEO
web/js/analyzer.js        SIGNAL WRITER — deterministyczna kontrola jakości komunikatu
web/js/services.js        warstwa usług: dane, dostawca LLM z fallbackiem
web/js/views/*.js         ekrany modułów
tests/                    testy
```

## Dane zewnętrzne i licencje

- **Granice powiatów** (`data/poland-powiaty.json` i geometria 8 powiatów w `data/demo-events.json`): Państwowy Rejestr Granic (PRG), Główny Urząd Geodezji i Kartografii — dane udostępniane bez opłat; wersja uproszczona `powiaty-min.geojson` z repozytorium [ppatrzyk/polska-geojson](https://github.com/ppatrzyk/polska-geojson) (licencja MIT). Geometria została wstępnie zrzutowana do SVG, więc demo działa offline.
- Przebieg Dunajca na mapie jest przybliżony (kilkanaście punktów). Zdarzenia, zgłoszenia, populacja i komunikaty są fikcyjne.

## Zasady bezpieczeństwa w demo

- **AI rekomenduje, człowiek decyduje.** Wysyłka wymaga potwierdzenia i uzasadnienia operatora.
- Każda decyzja trafia do dziennika audytu.
- Informacje niezweryfikowane są oznaczane i wyłączane z oceny.
- Treść źródeł traktowana jest jako dane, nie jako instrukcje (kwarantanna prompt injection; w zapytaniu do LLM treść jest odseparowana znacznikiem).
- Brak danych osobowych: wyłącznie dane zagregowane i syntetyczne.
- Brak możliwości wysłania prawdziwego alertu: dystrybucja jest wyłącznie symulowana (`/api/health` → `realDistribution: false`).
- Stan sesji jest zapisywany w `localStorage` przeglądarki, więc odświeżenie strony nie przerywa prezentacji. RESET DEMO go czyści.
