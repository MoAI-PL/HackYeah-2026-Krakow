# RCB SIGNAL — ściąga do obrony projektu

Regulamin: jury ocenia realną pracę techniczną i to, czy zespół rozumie i obroni swoje rozwiązanie, także fragmenty tworzone z pomocą AI. Poniżej każdy moduł w 2–3 zdaniach: co robi, jak i dlaczego tak.

## Architektura w jednym zdaniu
Przeglądarka robi wszystko (vanilla JS w modułach ES, ok. 2,4 tys. linii), a `server.py` (Python, biblioteka standardowa) tylko serwuje pliki i opcjonalnie pyta LLM o opinię. Dlatego demo działa offline, a wersja statyczna (`build_static.py`) — na dowolnym hostingu plików.

## Moduły

| Plik | Co robi | Jak i dlaczego |
|---|---|---|
| `web/js/correlate.js` | **Łączy meldunki w zdarzenia** (SIGNAL INTELLIGENCE) | Dwa meldunki są łączone, gdy mają wspólny powiat, dzieli je ≤ 60 min i opisują ten sam rodzaj zagrożenia (słownik rdzeni słów). Meldunek bez nazwanego zagrożenia (np. „prośba o alert”) dołącza po obszarze i czasie. Grupy liczy union-find (łączenie przechodnie). Reguły zamiast ML, bo wynik musi być powtarzalny i wyjaśnialny — karta zdarzenia pokazuje „dlaczego połączono”. Test: odtwarza przypisanie eksperckie 17/17. |
| `web/js/correlate.js` (duplikaty) | **Wskazuje możliwy duplikat** | Zdarzenie bez własnych meldunków, z tym samym zagrożeniem, wspólnym powiatem i czasem ±120 min. System **nie łączy sam** — podobny obszar nie oznacza tego samego zagrożenia; decyzja dyżurnego trafia do dziennika. |
| `web/js/analyzer.js` | **Ocena jakości alertu** (SIGNAL WRITER) | 7 kryteriów z wagami (WHAT 12, WHERE 15, WHEN 15, ACTION 25, LENGTH 10, CONSISTENCY 15, CLARITY 8 = 100). Wykrywa zagrożenie, nazwę powiatu, godzinę zakończenia, konkretne instrukcje, limit 160 znaków GSM-7 / polskie znaki (UCS-2), zgodność z godziną IMGW i obszarem. Błędy blokujące (np. 173/160, brak instrukcji) uniemożliwiają zatwierdzenie. Deterministyczny: ten sam tekst = ten sam wynik, więc da się go audytować. |
| `web/js/analyzer.js` (`buildSuggestion`) | **Rekomendacja treści** | Składa SMS z szablonu zdarzenia (do kiedy, zagrożenie, obszar, 2 instrukcje, 112) i sprawdza limit — gdy się nie mieści, pomija numer alarmowy. 78 → 92 w scenariuszu. |
| `web/js/store.js` | **Stan scenariusza i reguły biznesowe** | Maszyna stanów (etapy 0–12), dziennik audytu (kto, kiedy, co, dlaczego, podstawa), `geoAnalysis` (pokrycie: populacja strefy zagrożenia × udział w obszarze alertu), `alertLoad` (inne alerty w powiatach z 7 dni), `deliveryStats` (czas dostarczenia per operator, ostrzeżenie gdy najwolniejszy > 2× najszybszy), `sourceHealth`/`setOutage` (awaria źródła), `liveAar` (raport z dziennika). Stan w `localStorage`. |
| `web/js/views/map.js` | **Mapa powiatów** (SIGNAL GEO) | Prawdziwe granice 8 powiatów z PRG (GUGiK), wstępnie zrzutowane do SVG skryptem (rzut równoodległościowy z korektą cos φ), więc mapa działa offline bez bibliotek. Mapa Polski z 380 powiatami jako widok położenia. |
| `web/js/views/alerts.js` | **Kreator alertu** | Kroki treść → ocena → zatwierdzenie → wysyłka, podgląd SMS, wybór powiatów, zasięg alertu, inne alerty w powiatach, zatwierdzenie z uzasadnieniem, symulowana dystrybucja z raportem czasu dostarczenia. |
| `web/js/views/reports.js` | **Raport po zdarzeniu** | Budowany z dziennika sesji: wskaźniki, dystrybucja, przebieg, problemy, rekomendacje i **podsumowanie dla mieszkańców** (prosty tekst do publikacji przez samorząd). |
| `server.py` | Serwer plików + opcjonalny LLM | `SIGNAL_PROVIDER=anthropic` włącza doradczą opinię modelu; domyślnie wyłączone i **w demo nieużywane**. Wynik oceny zawsze liczy silnik reguł. |

## Trudne pytania — krótkie odpowiedzi
- **Gdzie jest AI?** W demo: algorytmy regułowe (łączenie meldunków, ocena, rekomendacja, wykrywanie nieaktualnego alertu, duplikatów i nierównej dystrybucji). LLM jest opcjonalny i tylko doradczy — świadomie, bo w ostrzeganiu ludności wynik musi być powtarzalny i audytowalny. AI (Claude) pomagało nam też w tworzeniu kodu i materiałów — jest to ujawnione.
- **Skąd dane?** Granice powiatów prawdziwe (PRG/GUGiK). Zdarzenia, meldunki, populacja, czasy dostarczenia — syntetyczne, opisane jako scenariusz demonstracyjny.
- **Co, gdy źródło padnie?** Panel „Stan źródeł”: ocena oznaczona jako niepełna, procedura zastępcza (telefon/radio), dyżurny pracuje dalej; silnik działa lokalnie, bez usług zewnętrznych.
- **Czy system może sam wysłać alert?** Nie. Nie wysyła, nie odwołuje, nie zmienia obszaru. Każda decyzja to człowiek + uzasadnienie w dzienniku.
- **Dlaczego nie aplikacja dla obywatela?** Problem leży w jakości i spójności istniejących alertów; kolejny kanał nie naprawi treści, częstotliwości ani dystrybucji.
- **Jak zmierzycie efekt?** Cele pilotażu (slajd 9) i 4 etapy walidacji: test historyczny, eksperyment z odbiorcami, symulacja dyżuru, pilotaż obserwacyjny. Zaufanie mierzymy osobno.
- **Ograniczenia:** dane operatorów i integracje ze służbami to kolejny etap; najmniejszy obszar alertu to powiat; scenariusz jest jeden (wezbranie Dunajca).

## Testy
`node --test tests/analyzer.test.mjs` (15: silnik, pełny scenariusz, łączenie meldunków, dystrybucja, obciążenie, awaria) i `python -m unittest discover tests` (5: serwer).
