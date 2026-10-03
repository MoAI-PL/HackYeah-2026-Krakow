# RCB SIGNAL — instrukcje dla agenta

Projekt na HackYeah 2026 Kraków, Open Task **Defence**, zespół **MoAI**. Ten plik opisuje stan projektu i zasady, które użytkownik już ustalił. Przeczytaj go w całości, zanim zaczniesz poprawki w demo lub w prezentacji.

## Najważniejsze w skrócie

- **Termin:** zgłoszenie trzeba wysłać do **4 października 2026, 23:00** (regulamin konkursu). Po terminie zmiany nie są brane pod uwagę. Dbaj o to, żeby demo i PDF były zawsze w stanie gotowym do oddania.
- **Git:** użytkownik **sam robi commit i push**. Ty nie commitujesz i nie pushujesz. Po zakończeniu pracy powiedz, które pliki się zmieniły i że można commitować.
- **Język:** z użytkownikiem rozmawiasz po polsku. UI, dokumentacja i prezentacja też są po polsku.
- **Repozytorium:** https://github.com/MoAI-PL/HackYeah-2026-Krakow (organizacja MoAI-PL, gałąź `main`). Jest **prywatne**. Link do niego jest na slajdzie 6 prezentacji, więc przed oddaniem trzeba je upublicznić albo usunąć link. Przypomnij o tym użytkownikowi, jeśli nadal jest prywatne (`gh repo view MoAI-PL/HackYeah-2026-Krakow --json visibility`). Dostęp z prawem zapisu ma też konto `jaaneeczek`.
- **Lokalizacja:** pracuj w `/home/user/Documents/hackyeah2026/HackYeah-2026-Krakow/Open Defence/RCB SIGNAL/`. Folder `/home/user/Documents/hackyeah2026/signal/` to **stara kopia** sprzed repozytorium. Nie edytuj jej i nie traktuj jako źródła prawdy.

## Decyzje użytkownika (nie cofaj ich)

1. **Wyłącznie jasna kolorystyka.** Użytkownik powiedział wprost: „żadna rządowa struktura nie jest ciemna”. Nie wprowadzaj ciemnego motywu ani ciemnych paneli. Kolory są tokenami w `:root` na początku `web/css/signal.css`: granat `--accent` jako kolor główny, czerwień tylko dla stanów krytycznych.
2. **Żadnych procentów wiarygodności.** Nie mamy danych, które by je uzasadniały. Źródło jest **zweryfikowane** (służba uprawniona: IMGW, PSP, WCZK…) albo **niezweryfikowane** (media, formularze, brak potwierdzenia; wariant „kwarantanna” przy prompt injection). Zdarzenie jest zweryfikowane, gdy potwierdzają je **co najmniej 2 niezależne źródła uprawnione**. Nie dodawaj pól `confidence` ani `similarity` z powrotem.
3. **Żadnych wymyślonych statystyk.** Liczby w demo i prezentacji pochodzą z danych syntetycznych albo z koncepcji. Benchmarki są oznaczone „DEMO BENCHMARK — dane syntetyczne”, a cele pilotażu „do zmierzenia”. Nie przedstawiaj ich jako wyników wdrożenia.
4. **To nie jest aplikacja dla obywatela.** To narzędzie dla dyżurnego RCB. Zasada: **AI rekomenduje, człowiek decyduje**. AI nie wysyła, nie odwołuje i nie zmienia obszaru alertu. Wysyłka jest zawsze tylko symulowana.
5. **Zespół** (kolejność alfabetyczna wg nazwiska, tak jest w prezentacji): Jan Domański, Jakub Goleman, Krystian Góźdź, Maks Kozieł, Piotr Niemiec. Ról nie podano, więc ich nie wymyślaj.
6. Procenty **pokrycia obszaru** (SIGNAL GEO, np. 96% → 83%) zostają. Są wyliczane z populacji syntetycznej, a nie z oceny źródeł. Użytkownik o nie nie pytał.

## Środowisko

- **Python 3.14:** jest. **Node.js: brak** w systemie. Jeśli potrzebujesz testów JS, pobierz przenośny Node do swojego katalogu scratchpad: `curl -sL https://nodejs.org/dist/v22.11.0/node-v22.11.0-linux-x64.tar.xz | tar xJ`. Nie instaluj go globalnie.
- **Przeglądarka do weryfikacji:** Firefox + `geckodriver` (snap, port 4444). Nie ma Playwrighta ani Selenium. Sterujemy przez surowe WebDriver HTTP z `urllib`; gotowe wzorce są w `presentation/*.py`.
- **`gh`:** zalogowane jako `geoglof` (członek MoAI-PL).
- **Uwaga:** `pkill -f server.py` zabija też powłokę, z której go uruchamiasz. Serwer zatrzymuj po PID z `ss -ltnp | grep :PORT` albo przez `pkill -x geckodriver` dla sterownika.

## Demo — jak działa

Uruchomienie: `python3 server.py` → http://localhost:8080 → ▶ START DEMO. Nie trzeba instalować zależności ani mieć internetu (poza fontami prezentacji). Szczegóły: `README.md`, `ARCHITECTURE.md`, `DEMO_SCRIPT.md` (scenariusz wystąpienia i odpowiedzi na pytania jury). Pierwotna koncepcja: `RCB_SIGNAL.md`.

**Stos:** Python (tylko biblioteka standardowa) + vanilla JS w modułach ES. Bez bundlera i frameworka. Wybraliśmy to, bo w systemie nie ma Node, a demo musi działać offline. Nie przepisuj tego na React/Next.js bez wyraźnej prośby użytkownika.

| Plik | Rola |
|---|---|
| `server.py` | Serwuje `web/` i `data/`, `GET /api/health`, `POST /api/analyze` (opcjonalny doradczy LLM: `SIGNAL_PROVIDER=anthropic`, model `claude-opus-5-5`; nieprzetestowany, bo brak klucza). |
| `data/demo-events.json` | Dane syntetyczne: 14 zdarzeń, 17 źródeł, 5 alertów, 8 powiatów (GeoJSON w układzie lokalnym 800×560), zgłoszenia, warianty błędów, benchmarki, 2 historyczne raporty AAR. |
| `web/js/analyzer.js` | SIGNAL WRITER — deterministyczny silnik oceny: WHAT 12, WHERE 15, WHEN 15 (8+7), ACTION 25, LENGTH 10, CONSISTENCY 15 (8+7), CLARITY 8. |
| `web/js/store.js` | Stan i maszyna stanów scenariusza (etapy 0–12), dziennik audytu, `geoAnalysis()`, `liveAar()`. Stan w `localStorage` (klucz `rcb-signal-demo-v1`). |
| `web/js/app.js` | Powłoka, routing hash, pasek prezentera, powiadomienia. |
| `web/js/views/*.js` | Ekrany: overview, events, map, alerts (writer + zatwierdzanie + dystrybucja), analytics, reports, audit. Każdy eksportuje `render(ctx)` i `mount(root, ctx)`. |
| `web/css/signal.css` | Cały system wizualny; tokeny kolorów w `:root`. |
| `tests/` | `analyzer.test.mjs` (11 testów: silnik i pełny scenariusz) i `test_server.py` (5 testów). |

**Niezmienniki, na których opiera się prezentacja i scenariusz wystąpienia.** Jeśli zmieniasz dane lub silnik, testy muszą je dalej potwierdzać:

- projekt alertu ALR-1042-01 → **78/100**, po „Zastosuj rekomendację” → **92/100**;
- wariant „przekroczony limit” ma dokładnie **173/160** znaków i blokuje zatwierdzenie; wariant „brak instrukcji” też blokuje;
- pokrycie GEO: **96%** przed zmianą sytuacji, **83%** po niej (18:30), **97%** po dodaniu pow. lipnickiego;
- szacowany zasięg symulowanej dystrybucji **92%**; raport AAR: czas do decyzji 13 min, 1 aktualizacja, 4 wykryte problemy;
- oś czasu scenariusza: 17:42 źródła → 17:56 powiązanie → 18:07 analiza → 18:08 poprawa → 18:10 wysyłka → 18:32 zmiana → 18:36 aktualizacja → 19:15 zamknięcie → 19:20 AAR.

Jeśli zmienisz którąkolwiek z tych wartości, zaktualizuj też `DEMO_SCRIPT.md`, `ARCHITECTURE.md` i slajdy 5, 7 i 9.

## Prezentacja

Folder `presentation/`:

- `slides.html` — **źródło** 10 slajdów (1280×720 px każdy). Edytuj tutaj, nigdy w PDF.
- `RCB_SIGNAL_MoAI.pdf` — plik do oddania. Regulamin dopuszcza **maksymalnie 10 slajdów**, a deck ma dokładnie 10. Nie dodawaj slajdów bez usunięcia innego.
- `img/` — zrzuty ekranu aplikacji używane na slajdzie 6.
- `render_pdf.py` — generuje PDF (`python3 render_pdf.py`; `--previews DIR` zapisuje PNG każdego slajdu do sprawdzenia). Wymaga internetu do fontów Google (Roboto Mono, Hind) i sam uruchamia geckodriver.
- `capture_screenshots.py` — przechodzi cały scenariusz demo w Firefoksie i nadpisuje `img/*.png`. Działa też jako test end-to-end. Uruchom go po każdej zmianie wyglądu demo, a potem `render_pdf.py`.

**Styl** (odwzorowanie wcześniejszego decku zespołu „TITAN”): białe tło, gradientowe plamy niebieski → fiolet → róż/karmin (`gBlue`, `gBlue2`, `gRed`, `gPink`, kształty `b1`–`b4`, `edgeR`, `edgeL` w ukrytym `<svg>` na górze pliku), nagłówki Roboto Mono 700 wielkimi literami, tekst Hind, cienkie czarne linie (`.rule`, `.vrule`), tabele z czarnym nagłówkiem, logo (tarcza z linią sygnału) w lewym górnym rogu.

**Slajdy:** 1 tytuł · 2 dlaczego to ważne · 3 kto korzysta · 4 architektura (5 modułów) · 5 kontrola jakości 78→92 · 6 demo (link do repozytorium, zrzuty) · 7 oś czasu scenariusza · 8 bezpieczeństwo · 9 dalsze kroki i cele pilotażu · 10 zespół i ujawnienie użycia AI.

Slajd 10 zawiera **ujawnienie użycia AI** (Claude wspierał kod, dokumentację i prezentację), którego wymaga regulamin konkursu. Nie usuwaj go.

## Procedura po każdej zmianie

1. **Demo:** `python3 -m unittest discover tests` oraz `node --test tests/analyzer.test.mjs` (Node ze scratchpada). Potem `python3 presentation/capture_screenshots.py`. Musi skończyć się na „KROK 12/12”. Obejrzyj zmienione ekrany (Read na PNG), zanim powiesz, że działa.
2. **Prezentacja:** `python3 presentation/render_pdf.py --previews <scratchpad>/deck`. Obejrzyj podglądy i sprawdź `pdfinfo` (10 stron). Nie zostawiaj PDF zmienionego tylko w metadanych. Jeśli treść się nie zmieniła, przywróć wersję z gita (`git checkout -- presentation/RCB_SIGNAL_MoAI.pdf`).
3. Usuń `__pycache__/` po testach. Jest w `.gitignore`, ale nie śmieć.
4. Podsumuj użytkownikowi po polsku, co się zmieniło i które pliki są gotowe do commita.

## Otwarte sprawy

- Repozytorium jest prywatne, a link do niego jest na slajdzie 6 (patrz wyżej).
- Ścieżka z doradczym LLM w `server.py` nigdy nie została uruchomiona z prawdziwym kluczem. Domyślnie jest wyłączona; demo jej nie potrzebuje.
- Na kartach zespołu (slajd 10) są inicjały zamiast zdjęć i nie ma ról. Można je dodać, jeśli użytkownik je poda.
