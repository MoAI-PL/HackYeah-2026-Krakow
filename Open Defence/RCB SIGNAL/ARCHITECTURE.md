# RCB SIGNAL — architektura demonstratora

## Założenia

1. **Demo musi zawsze działać:** offline, bez klucza API i bez kroku budowania. Dlatego frontend to natywne moduły ES (bez bundlera), a serwer korzysta wyłącznie z biblioteki standardowej Pythona.
2. **Wynik jest powtarzalny i audytowalny.** Ocenę jakości komunikatu liczy deterministyczny silnik regułowy. LLM jest opcjonalny i ma wyłącznie rolę doradczą.
3. **Człowiek decyduje.** Żadna ścieżka w kodzie nie prowadzi od rekomendacji do wysyłki bez akcji operatora: potwierdzenia, uzasadnienia i kliknięcia „Zatwierdź”.
4. **Wymienialność dostawców.** Każde źródło danych i każdy dostawca analizy stoi za warstwą usług, więc mock można później zastąpić rzeczywistą integracją.

## Przepływ

```text
 ŹRÓDŁA (IMGW / PSP / WCZK / media / formularze JST)       data/demo-events.json
        │
        ▼
 SIGNAL INTELLIGENCE   korelacja czasowa i geograficzna → wspólne zdarzenie
        │              weryfikacja źródeł, kwarantanna treści sterującej, kandydaci na duplikat
        ▼
 SIGNAL GEO            pokrycie populacji w strefie zagrożenia przez obszar alertu (powiat)
        │              luki, odbiorcy poza strefą, próg walidacji 90%
        ▼
 SIGNAL WRITER         analyzeAlert(): WHAT / WHERE / WHEN / ACTION / LENGTH / CONSISTENCY / CLARITY
        │              wynik 0–100, problemy, rekomendowana wersja (GSM-7, ≤160 znaków)
        ▼
 OPERATOR              przegląd → potwierdzenie + uzasadnienie → zatwierdzenie
        │
        ▼
 SYMULOWANA DYSTRYBUCJA   szacowany zasięg wg operatorów (dane syntetyczne)
        │
        ▼
 SIGNAL FEEDBACK       zmiana sytuacji → rekomendacja aktualizacji → raport AAR → wnioski
```

## Komponenty

| Plik | Odpowiedzialność |
|---|---|
| `server.py` | Serwuje `web/` i `data/` (z ochroną przed path traversal), `GET /api/health`, `POST /api/analyze` (opcjonalny LLM). Ładuje `.env` bez zależności. |
| `web/js/analyzer.js` | **SIGNAL WRITER.** Czysta funkcja `analyzeAlert(text, ctx)` bez efektów ubocznych. Wagi: WHAT 12, WHERE 15, WHEN 15, ACTION 25, LENGTH 10, CONSISTENCY 15, CLARITY 8. Zwraca również obiekt `schema` zgodny ze strukturą z koncepcji (`what/where/when/action/consistency/length_ok/score/issues/suggestion`). |
| `web/js/store.js` | Stan aplikacji i maszyna stanów scenariusza (etapy 0–12), dziennik audytu, analiza GEO, budowa raportu AAR z przebiegu sesji. Stan trwały w `localStorage` (z obsługą braku dostępu). |
| `web/js/services.js` | Warstwa usług: wczytanie danych i analiza z dostawcą doradczym oraz fallbackiem. |
| `web/js/app.js` | Powłoka (pasek klasyfikacji, nagłówek, nawigacja), routing hash (`#/events/:id`, `#/reports/:id`), pasek prezentera, powiadomienia. |
| `web/js/views/*.js` | Ekrany. Każdy eksportuje `render(ctx)` → HTML oraz `mount(root, ctx)`, który podpina zdarzenia. |

## Warstwa dostawców

```text
REAL PROVIDER (Claude, structured output)      ← tylko gdy SIGNAL_PROVIDER=anthropic
        │  opinia doradcza: issues + suggestion
        ▼
┌──────────────────────────┐
│ SERVICE LAYER            │  services.analyze(): wynik ZAWSZE z reguł,
│                          │  LLM dokładany jako `advisory`, timeout 20 s
└──────────────────────────┘
        ▲
MOCK PROVIDER (analyzer.js — deterministyczny)  ← zawsze dostępny
```

Zapytanie do LLM (`server.py → advisory_review`):

- model `claude-opus-5-5`, `output_config.format` z JSON Schema (structured output), `effort: low`;
- treść komunikatu odseparowana znacznikiem `<komunikat>`, a prompt systemowy każe traktować ją wyłącznie jako dane (ochrona przed prompt injection);
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) oraz obsługa `stop_reason: "refusal"`;
- długość tekstu i liczba obszarów są obcinane po stronie serwera.

Docelowo w ten sam sposób można podłączyć rzeczywiste źródła (IMGW, PSP, WCZK): adapter → wspólny format `source / time / verification`.

## Model danych (`data/demo-events.json`)

| Klucz | Zawartość |
|---|---|
| `meta` | wersja zbioru, data scenariusza, znacznik `synthetic: true` |
| `areas` | GeoJSON `FeatureCollection` w lokalnym układzie płaskim 800×560: 8 jednostek z populacją syntetyczną i udziałem w strefie zagrożenia w fazach `T1`/`T2` |
| `hazardZones` | poligon strefy zagrożenia w fazach T1 (17:56) i T2 (18:30) |
| `incidents` | zgłoszenia punktowe (PSP, WCZK, media) z fazą i statusem weryfikacji |
| `sources` | 17 meldunków źródłowych: `source, time, verification` (`verified` = zweryfikowane; `pending` / `quarantined` = niezweryfikowane) |
| `events` | 14 zdarzeń; zdarzenie główne zawiera reguły terminologii, okna ważności i szablony rekomendacji |
| `alerts` | projekty i wysłane komunikaty (5) |
| `testVariants` | warianty stanów błędów dla edytora |
| `distribution` | operatorzy z udziałem i skutecznością dostarczenia (synt.) |
| `afterActionReports`, `benchmarks` | raporty historyczne, demo benchmark, KPI, uczenie się systemu |

## Maszyna stanów scenariusza

| Etap | Wyzwalacz (operator) | Czas | Efekt |
|---|---|---|---|
| 0 → 1 | START DEMO | 17:56 | 3 źródła powiązane w EVT-2026-1042, źródło medialne oznaczone jako niezweryfikowane |
| 1 → 2 | otwarcie zdarzenia | 18:01 | wpis w dzienniku |
| 2 → 3 | „Przygotuj projekt alertu” | 18:04 | projekt ALR-1042-01 |
| 3 → 4 | ANALIZUJ | 18:07 | wynik 78/100 i rekomendacja |
| 4 → 5 | „Zastosuj rekomendację” | 18:08 | wynik 92/100 |
| 5 → 6 | „Przekaż do zatwierdzenia” | 18:08 | panel zatwierdzenia |
| 6 → 7 | potwierdzenie + „Zatwierdź i symuluj wysyłkę” | 18:09/18:10 | symulowana dystrybucja, zasięg 92% |
| 7 → 8 | NASTĘPNY ETAP SCENARIUSZA | 18:30/18:32 | nowe dane, pokrycie spada do 83%, rekomendacja aktualizacji |
| 8 → 9 | „Otwórz proces aktualizacji” | 18:32 | projekt ALR-1042-02 (+ pow. lipnicki, do 23:00) |
| 9 → 10 | analiza → przegląd → zatwierdzenie | 18:33–18:36 | wysłana aktualizacja |
| 10 → 11 | „Zamknij zdarzenie” | 19:15 | raport AAR-1042 |
| 11 → 12 | otwarcie raportu | 19:20 | koniec scenariusza |

## Bezpieczeństwo

- Brak kodu wysyłki: serwer nie ma żadnego endpointu dystrybucji, a `/api/health` raportuje `realDistribution: false`.
- Pasek klasyfikacji „ŚRODOWISKO DEMONSTRACYJNE — DANE SYNTETYCZNE” jest widoczny na każdym ekranie i na wydruku raportu.
- Rola operatora jest stała (`OP-07`). Uwierzytelnianie i role to element wdrożenia produkcyjnego (poza zakresem MVP).
- Wszystkie treści z danych są escapowane przed wstawieniem do DOM (`esc()`).

## Ścieżka do wdrożenia (poza MVP)

React/Next.js + MapLibre (rzeczywiste granice powiatów, GeoJSON z PRG), FastAPI + PostgreSQL (zdarzenia, audyt append-only), uwierzytelnianie z rolami i zasadą najmniejszych uprawnień, adaptery źródeł oraz pilotaż z testem zrozumiałości.
