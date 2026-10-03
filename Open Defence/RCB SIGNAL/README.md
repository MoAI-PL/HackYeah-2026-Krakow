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
# 5. RESET DEMO (pasek na dole ekranu) przywraca stan początkowy
```

Port zmienisz przez `PORT=9000 python3 server.py`. Docker:

```bash
docker build -t rcb-signal . && docker run --rm -p 8080:8080 rcb-signal
```

## Co pokazuje demo

Jeden kompletny scenariusz end-to-end: **„Intensywne opady / podtopienia”** (fikcyjne województwo, powiaty i dane).

| Moduł | Ekran | Co widać |
|---|---|---|
| SIGNAL COMMAND | 01 Przegląd | wskaźniki sytuacji, zdarzenia priorytetowe, cykl ostrzegania |
| SIGNAL INTELLIGENCE | 02 Zdarzenia | 3 źródła połączone w jedno zdarzenie, oś czasu, status weryfikacji (zweryfikowane / niezweryfikowane), źródło niezweryfikowane, kwarantanna treści sterującej (prompt injection), możliwy duplikat |
| SIGNAL GEO | 03 Mapa | obszar zagrożenia, obszar alertu i zgłoszenia, pokrycie populacji, luki |
| SIGNAL WRITER | 04 Alerty | edytor 160 znaków, analiza WHAT/WHERE/WHEN/ACTION, **wynik 78 → 92**, zatwierdzenie przez człowieka, symulowana dystrybucja, aktualizacja |
| SIGNAL FEEDBACK | 05 Analityka | baseline vs SIGNAL, KPI pilotażu, uczenie się systemu |
| AFTER ACTION | 06 Raporty | raport AAR budowany z dziennika bieżącej sesji i raporty historyczne |
| AUDIT LOG | 07 Dziennik audytu | KTO · KIEDY · CO · DLACZEGO · NA PODSTAWIE dla każdej decyzji |

Scenariusz prowadzi **pasek prezentera** na dole ekranu: pokazuje bieżący krok (0–12), podpowiedź i skrót „Przejdź →”. System nie przeskakuje etapów samodzielnie. Klawisz `P` zwija pasek.

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
data/demo-events.json     dane syntetyczne: 14 zdarzeń, 17 źródeł, 5 alertów, 8 obszarów, raporty AAR
web/index.html            punkt wejścia
web/css/signal.css        system wizualny (tokeny kolorów, układ, druk raportu)
web/js/app.js             powłoka, routing, pasek prezentera
web/js/store.js           stan i maszyna stanów scenariusza, dziennik audytu, analiza GEO
web/js/analyzer.js        SIGNAL WRITER — deterministyczna kontrola jakości komunikatu
web/js/services.js        warstwa usług: dane, dostawca LLM z fallbackiem
web/js/views/*.js         ekrany modułów
tests/                    testy
```

## Zasady bezpieczeństwa w demo

- **AI rekomenduje, człowiek decyduje.** Wysyłka wymaga potwierdzenia i uzasadnienia operatora.
- Każda decyzja trafia do dziennika audytu.
- Informacje niezweryfikowane są oznaczane i wyłączane z oceny.
- Treść źródeł traktowana jest jako dane, nie jako instrukcje (kwarantanna prompt injection; w zapytaniu do LLM treść jest odseparowana znacznikiem).
- Brak danych osobowych: wyłącznie dane zagregowane i syntetyczne.
- Brak możliwości wysłania prawdziwego alertu: dystrybucja jest wyłącznie symulowana (`/api/health` → `realDistribution: false`).
- Stan sesji jest zapisywany w `localStorage` przeglądarki, więc odświeżenie strony nie przerywa prezentacji. RESET DEMO go czyści.
