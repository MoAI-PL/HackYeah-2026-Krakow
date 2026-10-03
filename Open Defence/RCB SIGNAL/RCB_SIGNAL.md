# RCB SIGNAL — kompletna koncepcja projektu HackYeah 2026 Defence

## 1. Executive summary

**RCB SIGNAL** to system wspomagania decyzji dla Rządowego Centrum Bezpieczeństwa, którego celem jest poprawa całego procesu ostrzegania — od wykrycia zagrożenia, przez przygotowanie i dystrybucję alertu, aż po analizę jego skuteczności.

Projekt **nie jest aplikacją dla obywateli** i nie tworzy kolejnego kanału powiadomień.

Zamiast tego wykorzystuje istniejący system alertów RCB lepiej, dostarczając pracownikom RCB warstwę analityczną, która:

1. łączy informacje o tym samym zagrożeniu z wielu źródeł;
2. wykrywa niespójności i duplikaty;
3. pomaga przygotować jasny i wykonalny komunikat;
4. analizuje adekwatność obszaru ostrzegania;
5. pozwala śledzić cykl życia alertu;
6. mierzy jakość i skuteczność ostrzegania;
7. tworzy wiedzę możliwą do wykorzystania przy kolejnych zdarzeniach.

### Główna idea

> **Nie potrzebujemy kolejnego alertu. Potrzebujemy alertu, który ma sens.**

Celem nie jest maksymalizacja liczby wysłanych komunikatów.

Celem jest maksymalizacja prawdopodobieństwa, że właściwa osoba:

**otrzyma → zrozumie → uwierzy → wykona właściwe działanie.**

---

# 2. Problem

System ostrzegania musi działać w warunkach presji czasu, niepełnej informacji i zmieniającej się sytuacji.

Problemy, które projekt adresuje:

### 2.1. Problem komunikatu

Alert może być:

* zbyt ogólny;
* nieprecyzyjny;
* pozbawiony instrukcji;
* trudny do zrozumienia;
* niespójny z poprzednimi komunikatami;
* ograniczony technicznymi wymaganiami SMS.

RCB wskazuje m.in. limit 160 znaków dla wiadomości SMS oraz ograniczenie związane z polskimi znakami.

### 2.2. Alert fatigue

Jeżeli użytkownik otrzymuje wiele komunikatów, które:

* nie dotyczą go bezpośrednio;
* nie zawierają konkretnej instrukcji;
* powtarzają wcześniejsze informacje;
* nie są później aktualizowane lub wyjaśniane,

może stopniowo obniżać swoją uwagę wobec kolejnych ostrzeżeń.

Projekt nie zakłada automatycznego blokowania alertów.

Zamiast tego pomaga RCB lepiej zarządzać ich jakością i cyklem życia.

### 2.3. Problem dystrybucji

RCB wskazuje, że dystrybucja alertów SMS wykorzystuje infrastrukturę operatorów, a najmniejszym obszarem dystrybucji jest powiat.

Może to powodować różnice pomiędzy:

* rzeczywistym obszarem zagrożenia;
* obszarem wybranym do ostrzeżenia;
* obszarem technicznego dotarcia wiadomości.

System powinien więc umożliwiać analizę tych różnic.

### 2.4. Problem koordynacji

To samo zdarzenie może generować informacje z wielu źródeł:

* IMGW;
* PSP;
* Policji;
* centrów zarządzania kryzysowego;
* samorządów;
* innych uprawnionych źródeł.

Pracownik potrzebuje **jednego obrazu sytuacji**, a nie zbioru niezależnych komunikatów.

### 2.5. Problem uczenia się

Po zakończeniu zdarzenia trzeba wiedzieć:

* co się wydarzyło;
* jakie informacje były dostępne;
* kiedy podjęto decyzję;
* jaki komunikat wysłano;
* jak szybko został przekazany;
* jak zmieniła się sytuacja;
* jakie elementy komunikatu były niezrozumiałe;
* co należy zmienić następnym razem.

---

# 3. Kluczowa zmiana perspektywy

Standardowe podejście:

> „Zbudujmy lepszą aplikację, żeby obywatel dostawał alert.”

RCB SIGNAL:

> „Zbudujmy system, który pozwoli RCB podejmować lepsze decyzje dotyczące istniejących alertów.”

To oznacza, że obywatel **nie musi instalować żadnego oprogramowania**.

Nie tworzymy:

* kolejnej aplikacji;
* kolejnego komunikatora;
* kolejnego systemu push;
* kolejnego kanału alarmowego.

Budujemy **warstwę intelligence nad istniejącym procesem**.

---

# 4. RCB SIGNAL — architektura

System składa się z pięciu głównych modułów.

```text
                 ┌──────────────────────┐
                 │   ŹRÓDŁA INFORMACJI  │
                 │ IMGW / PSP / WCZK /  │
                 │ inne źródła          │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ SIGNAL INTELLIGENCE  │
                 │ agregacja + analiza  │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │SIGNAL      │ │SIGNAL GEO  │ │SIGNAL      │
     │WRITER      │ │            │ │COMMAND     │
     │            │ │obszar      │ │            │
     │jakość      │ │zagrożenia  │ │operator RCB│
     └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                  ┌──────────────────┐
                  │   ALERT / UPDATE │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ SIGNAL FEEDBACK  │
                  │ pomiar + learning│
                  └──────────────────┘
```

---

# 5. SIGNAL INTELLIGENCE

## Cel

Stworzyć jeden obraz sytuacji.

System otrzymuje informacje z wielu źródeł i grupuje je według potencjalnie wspólnego zdarzenia.

### Przykład

Dane wejściowe:

```text
IMGW:
silne opady, 18:00–22:00

PSP:
12 interwencji związanych z podtopieniami

WCZK:
zgłoszenia zalania dróg

Aktywny RCB:
ostrzeżenie meteorologiczne
```

System tworzy:

```text
EVENT #2026-1042

INTENSYWNE OPADY / PODTOPIENIA

Źródła:
3 niezależne

Aktywny alert:
TAK

Nowe informacje:
4

Zmiana sytuacji:
WYKRYTA

Wymaga weryfikacji:
TAK
```

### Ważne

AI **nie może uznawać niezweryfikowanej informacji za fakt**.

Każda informacja powinna mieć:

```text
source
timestamp
confidence
verification_status
```

---

# 6. SIGNAL WRITER

## Cel

Nie jest to generator tekstu.

To **system kontroli jakości komunikatu**.

Każdy projektowany alert jest sprawdzany pod kątem:

### WHAT

Czy wiadomo, co się dzieje?

### WHERE

Czy wiadomo, jakiego obszaru dotyczy?

### WHEN

Czy podano istotny czas obowiązywania?

### ACTION

Czy wiadomo, co odbiorca powinien zrobić?

### CONSISTENCY

Czy komunikat jest zgodny z wcześniejszymi informacjami?

### LENGTH

Czy mieści się w ograniczeniach technicznych?

---

## Actionability Score

Przykładowy wynik:

```text
ACTIONABILITY SCORE

████████░░ 78/100

✓ zagrożenie
✓ obszar
✓ instrukcja
✓ czas

⚠ instrukcja może być bardziej konkretna

⚠ brak informacji o przewidywanym zakończeniu
```

Nie powinno to być traktowane jako „ocena prawdy”.

To wyłącznie ocena jakości konstrukcji komunikatu.

---

# 7. SIGNAL GEO

## Cel

Porównać:

```text
OBSZAR ZAGROŻENIA
        ↓
OBSZAR PLANOWANEGO ALERTU
        ↓
DOSTĘPNE INFORMACJE O DYSTRYBUCJI
```

System powinien wskazywać:

* obszary zagrożenia;
* obszary objęte ostrzeżeniem;
* potencjalne luki;
* niespójności;
* zmiany w czasie.

Nie należy przedstawiać systemu jako narzędzia śledzącego indywidualnych obywateli.

Dane powinny być zagregowane.

---

# 8. SIGNAL COMMAND

To główny dashboard operatora RCB.

## Dashboard

```text
RCB SIGNAL
────────────────────────────────────────

AKTYWNE ZDARZENIA                 12

WYMAGAJĄCE WERYFIKACJI             4

ALERTY W PRZYGOTOWANIU             3

WYMAGAJĄCE AKTUALIZACJI            2

────────────────────────────────────────

PRIORYTETOWE ZDARZENIA

🔴 Intensywne opady
   3 źródła
   zmiana sytuacji
   alert aktywny

🟠 Silny wiatr
   2 źródła
   projekt alertu

🟡 Podtopienia
   4 zgłoszenia
   wymaga analizy
```

---

# 9. Human in the loop

Jedna z najważniejszych zasad projektu:

> **AI rekomenduje. Człowiek decyduje.**

AI nie powinno samodzielnie:

* wysyłać alertu;
* odwoływać alertu;
* zmieniać jego obszaru;
* uznawać niepotwierdzonej informacji za prawdziwą;
* ukrywać ostrzeżenia.

Każda decyzja powinna mieć:

```text
WHO
WHEN
WHAT
WHY
BASED ON WHICH DATA
```

---

# 10. SIGNAL FEEDBACK

To moduł, który odróżnia projekt od zwykłego dashboardu.

Po zdarzeniu system tworzy raport:

```text
EVENT AFTER ACTION REPORT

Zdarzenie:
Intensywne opady

────────────────────────

Czas wykrycia:
18:02

Czas decyzji:
18:14

Czas wysłania:
18:17

Aktualizacja:
19:05

────────────────────────

Jakość komunikatu:
82/100

Zrozumiałość:
+24 p.p. vs baseline

Czas przygotowania:
-31%

Wykryte problemy:
2

Rekomendacje:
3
```

---

# 11. Closed loop

Najważniejszy mechanizm całego systemu:

```text
ZAGROŻENIE
     ↓
INFORMACJE
     ↓
ANALIZA
     ↓
DECYZJA
     ↓
ALERT
     ↓
DYSTRYBUCJA
     ↓
EFEKT
     ↓
POMIAR
     ↓
WIEDZA
     ↓
LEPSZY KOLEJNY ALERT
```

To właśnie jest:

> **closed-loop emergency communication system**

---

# 12. Mierzalność

Nie należy twierdzić, że projekt „zwiększy zaufanie”, jeśli nie przeprowadzono badania.

Należy pokazać, **jak można to zmierzyć**.

## KPI

| KPI                              | Przykładowy cel pilotażu |
| -------------------------------- | -----------------------: |
| kompletność komunikatów          |                     ≥95% |
| zrozumienie instrukcji           |                 +20 p.p. |
| czas przygotowania               |                     -30% |
| wykrywanie zdefiniowanych błędów |                     ≥90% |
| alerty z pełnym audytem          |                     100% |
| zaufanie w badanej grupie        |                 +10 p.p. |

Wartości są **celami demonstracyjnymi**, a nie wynikami uzyskanymi przez system.

---

# 13. Walidacja

## Test 1 — historyczny

Porównać istniejące przykładowe komunikaty z wersjami przygotowanymi z wykorzystaniem SIGNAL.

## Test 2 — zrozumiałość

Uczestnicy otrzymują komunikaty i odpowiadają:

* co się dzieje?
* gdzie?
* kiedy?
* co mam zrobić?

## Test 3 — symulacja operatora

Porównać pracę:

```text
BASELINE
vs
RCB SIGNAL
```

mierząc:

* czas;
* liczbę błędów;
* kompletność;
* liczbę wymaganych korekt.

## Test 4 — after action

Po symulowanym zdarzeniu system generuje raport i wskazuje rzeczy, które można poprawić.

---

# 14. MVP na HackYeah

Nie budować całego systemu produkcyjnego.

Zbudować jeden kompletny scenariusz:

```text
INPUT
  ↓
3 źródła informacji
  ↓
SIGNAL INTELLIGENCE
  ↓
wykrycie wspólnego zdarzenia
  ↓
SIGNAL GEO
  ↓
analiza obszaru
  ↓
SIGNAL WRITER
  ↓
walidacja alertu
  ↓
OPERATOR
  ↓
zatwierdzenie
  ↓
SIMULATED DISTRIBUTION
  ↓
FEEDBACK
  ↓
AFTER ACTION REPORT
```

To wystarczy, żeby jury zobaczyło cały mechanizm.

---

# 15. Technologia

Rekomendowany stack:

```text
Frontend:
React / Next.js

UI:
Tailwind / shadcn

Map:
Leaflet / MapLibre

Backend:
Python / FastAPI

Database:
PostgreSQL

AI:
LLM + structured output

Geodata:
GeoJSON

Charts:
Recharts

Deployment:
Docker
```

Dane demo powinny być syntetyczne lub publiczne.

Nie należy uzależniać demonstracji od rzeczywistego dostępu do systemów RCB lub operatorów.

---

# 16. Zasady bezpieczeństwa

System powinien stosować:

* role użytkowników;
* audit log;
* walidację źródeł;
* timestampy;
* confidence score;
* human approval;
* zasadę najmniejszych uprawnień;
* brak danych osobowych w MVP;
* wyraźne oznaczanie danych syntetycznych;
* ochronę przed prompt injection w danych wejściowych;
* brak automatycznego wysyłania prawdziwych alertów.

---

# 17. Najważniejszy przekaz

Projekt nie brzmi:

> „Zrobiliśmy AI do generowania SMS-ów.”

Projekt brzmi:

> **„Zbudowaliśmy warstwę intelligence dla istniejącego systemu ostrzegania, która pomaga RCB przejść od pojedynczego SMS-a do mierzalnego, uczącego się procesu ostrzegania.”**

---

# Instrukcja dla agenta AI — zbuduj live demo RCB SIGNAL

Poniższy tekst można wkleić bezpośrednio do agenta programistycznego.

---

## ROLE

Jesteś senior full-stack engineerem, product designerem i AI engineerem.

Masz zbudować **działające live demo systemu RCB SIGNAL** na hackathon HackYeah 2026 Defence.

Nie twórz makiety statycznej.

Musisz stworzyć **interaktywną aplikację webową**, którą można uruchomić lokalnie i przeprowadzić na niej 3–5 minutowy live demo.

---

# CEL

Zbuduj demonstrator systemu dla operatora RCB.

System ma pokazać cały cykl:

```text
SOURCE DATA
→ EVENT INTELLIGENCE
→ GEO ANALYSIS
→ ALERT QUALITY
→ HUMAN APPROVAL
→ SIMULATED DISTRIBUTION
→ FEEDBACK
→ AFTER ACTION REPORT
```

Aplikacja ma pokazać, że RCB SIGNAL nie jest aplikacją dla obywatela.

To jest **operacyjny system wspomagania decyzji dla RCB**.

---

# ZASADA #1 — NIE BUDUJ APLIKACJI DLA OBYWATELA

Nie twórz:

* logowania mieszkańca;
* push notification;
* aplikacji mobilnej;
* feedu newsów;
* social network;
* chatbota dla obywatela.

Całość ma wyglądać jak profesjonalny system centrum operacyjnego.

---

# ZASADA #2 — HUMAN IN THE LOOP

AI nigdy nie może samodzielnie wysłać alertu.

Przyciski powinny wyglądać:

```text
GENERATE RECOMMENDATION
```

a następnie:

```text
REVIEW
```

i dopiero:

```text
APPROVE & SIMULATE SEND
```

Nie używaj:

```text
AI SENDS ALERT
```

---

# ZASADA #3 — DANE DEMONSTRACYJNE

Użyj wyłącznie syntetycznych danych.

W całym UI dodaj dyskretną informację:

```text
DEMO ENVIRONMENT — SYNTHETIC DATA
```

Nie udawaj, że aplikacja ma dostęp do prawdziwych systemów RCB.

---

# ZASADA #4 — JEDEN SCENARIUSZ END-TO-END

Zbuduj główny scenariusz:

## „INTENSYWNE OPADY + PODTOPIENIA”

Przykładowy timeline:

```text
17:42 — IMGW warning
17:49 — PSP incidents
17:53 — WCZK reports flooding
17:56 — system detects related event
18:01 — analyst opens event
18:04 — alert draft created
18:07 — quality analysis
18:09 — operator approves
18:10 — simulated distribution
18:30 — new incident data
18:32 — system recommends update
19:15 — event closed
19:20 — after action report
```

---

# UI

Stwórz aplikację typu:

```text
┌──────────────────────────────────────────────────────────┐
│ RCB SIGNAL                         ● OPERATIONAL          │
├───────────────┬──────────────────────────────────────────┤
│               │                                          │
│ OVERVIEW      │       MAIN CONTENT                       │
│ EVENTS        │                                          │
│ ALERTS        │                                          │
│ MAP           │                                          │
│ ANALYTICS     │                                          │
│ REPORTS       │                                          │
│               │                                          │
└───────────────┴──────────────────────────────────────────┘
```

Design:

* dark navy;
* charcoal;
* white;
* cyan;
* amber;
* red;
* professional;
* minimal;
* zero „AI gimmicks”.

Ma wyglądać jak narzędzie używane w centrum operacyjnym, nie startupowy landing page.

---

# SCREEN 1 — OVERVIEW

Zbuduj dashboard:

```text
RCB SIGNAL

ACTIVE EVENTS                  12
REQUIRES REVIEW                 4
ALERTS IN PREPARATION           3
RECOMMENDED UPDATES             2
```

Poniżej:

```text
PRIORITY EVENTS
```

Karty:

```text
🔴 INTENSYWNE OPADY
3 sources
Situation changing
Alert active

🟠 STRONG WIND
2 sources
Alert preparation

🟡 LOCAL FLOODING
4 reports
Requires review
```

Kliknięcie w pierwszy event otwiera szczegóły.

---

# SCREEN 2 — EVENT INTELLIGENCE

Pokaż:

```text
EVENT #2026-1042

INTENSYWNE OPADY / PODTOPIENIA

STATUS
● ACTIVE

CONFIDENCE
87%

SOURCES
3 verified
1 pending
```

Następnie timeline:

```text
17:42 IMGW
Heavy rainfall warning

17:49 PSP
Flooding intervention

17:53 WCZK
Road flooding report

17:56 SIGNAL
Sources linked into common event
```

Dodaj panel:

```text
SIGNAL ANALYSIS

✓ Multiple independent sources
✓ Temporal correlation
✓ Geographic overlap

⚠ Situation intensity increasing
⚠ Existing alert may require review
```

---

# SCREEN 3 — MAP

Użyj MapLibre lub Leaflet.

Nie potrzebujesz dokładnej mapy Polski, jeśli jej przygotowanie zajmie zbyt dużo czasu.

Wystarczy realistyczna mapa demonstracyjna.

Pokaż:

```text
RED       = affected area
AMBER     = warning area
BLUE      = reported incidents
```

Dodaj legendę.

Kliknięcie obszaru pokazuje:

```text
AREA
Powiat X

RISK
High

REPORTS
12

ALERT
Active

LAST UPDATE
18:31
```

---

# SCREEN 4 — ALERT WRITER

Stwórz edytor:

```text
ALERT DRAFT

[ tekst alertu ]

Characters: 143 / 160
```

Pod spodem:

```text
QUALITY CHECK
```

Pokaż:

```text
✓ WHAT
✓ WHERE
✓ WHEN
⚠ ACTION
✓ LENGTH
✓ CONSISTENCY
```

Dodaj score:

```text
ACTIONABILITY
78 / 100
```

Przycisk:

```text
ANALYZE
```

Po kliknięciu wykonaj analizę.

---

# AI ANALYSIS

Jeżeli dostępny jest model LLM, wykorzystaj go do structured output.

Schema:

```json
{
  "what": true,
  "where": true,
  "when": true,
  "action": false,
  "consistency": true,
  "length_ok": true,
  "score": 78,
  "issues": [
    "Instruction is not explicit enough"
  ],
  "suggestion": "..."
}
```

Jeśli API modelu nie jest dostępne:

**NIE BLOKUJ DEMO.**

Użyj deterministycznego mock engine.

---

# MOCK AI

Stwórz funkcję:

```typescript
analyzeAlert(text)
```

która:

1. liczy znaki;
2. sprawdza obecność słów związanych z działaniem;
3. sprawdza obecność obszaru;
4. sprawdza obecność czasu;
5. zwraca score;
6. generuje problemy;
7. zwraca rekomendowaną wersję.

Dzięki temu aplikacja zawsze działa podczas prezentacji.

---

# SCREEN 5 — APPROVAL

Pokaż:

```text
ALERT READY FOR REVIEW

ACTIONABILITY
92 / 100

FACTUAL SOURCES
3

GEO VALIDATION
PASSED

CHARACTER LIMIT
PASSED
```

Przyciski:

```text
EDIT
```

```text
REQUEST CHANGES
```

```text
APPROVE & SIMULATE SEND
```

Kliknięcie ostatniego przycisku rozpoczyna animację:

```text
VALIDATING
    ↓
APPROVED
    ↓
DISTRIBUTION INITIATED
    ↓
SIMULATED DELIVERY COMPLETE
```

---

# SCREEN 6 — DISTRIBUTION

Nie udawaj prawdziwej integracji z operatorami.

Wyświetl:

```text
SIMULATED DISTRIBUTION

TARGET AREA
Powiat X

ESTIMATED REACH
92%

REPORTING
Operator A   94%
Operator B   91%
Operator C   90%

STATUS
SIMULATION COMPLETE
```

Dodaj informację:

```text
Synthetic data — demonstration only.
```

---

# SCREEN 7 — EVENT UPDATE

Po kliknięciu:

```text
ADVANCE SCENARIO
```

dodaj nowe dane:

```text
18:30

PSP
+8 incidents

WCZK
2 additional flooded roads
```

System powinien pokazać:

```text
SITUATION CHANGED

Existing alert may no longer fully represent current situation.

RECOMMENDATION:
Review alert.
```

Przycisk:

```text
OPEN UPDATE WORKFLOW
```

---

# SCREEN 8 — AFTER ACTION REPORT

Po zakończeniu scenariusza:

```text
AFTER ACTION REPORT

INTENSYWNE OPADY / PODTOPIENIA

────────────────────────

DECISION TIME
12 min

ALERT PREPARATION
4 min

QUALITY SCORE
92 / 100

SOURCE CORRELATION
3 sources

UPDATES
1

────────────────────────

IMPROVEMENT

Communication clarity
+24%

Preparation time
-31%

Detected inconsistencies
2
```

Ważne:

oznacz te wartości jako **demo benchmark**, jeśli są syntetyczne.

---

# SCREEN 9 — ANALYTICS

Dodaj wykresy:

### Alert Quality

```text
BASELINE       68
RCB SIGNAL     92
```

### Preparation Time

```text
BASELINE       9.4 min
RCB SIGNAL     6.1 min
```

### Understanding

```text
BASELINE       61%
RCB SIGNAL     85%
```

Pod każdym wykresem:

```text
DEMO BENCHMARK — SYNTHETIC TEST DATA
```

Nie prezentuj tego jako wynik rzeczywistego wdrożenia.

---

# SCREEN 10 — LEARNING

Pokaż:

```text
SYSTEM LEARNING

From 47 simulated events:

Most frequent issues:

1. Missing action instruction      31%
2. Ambiguous location              22%
3. Inconsistent terminology        18%
4. Missing time information        14%
```

Następnie:

```text
RECOMMENDED PROCEDURAL IMPROVEMENTS

→ standardize action language
→ introduce mandatory action field
→ improve event linking
→ review geographic workflow
```

---

# INTERAKCJE

Demo musi dać się przeprowadzić w tej kolejności:

```text
1. Open dashboard
2. Open flooding event
3. Inspect sources
4. Open map
5. Open alert
6. Click ANALYZE
7. Show problems
8. Apply suggested improvement
9. Show score increase
10. Approve
11. Simulate distribution
12. Advance scenario
13. Show new information
14. Generate update recommendation
15. Close event
16. Open After Action Report
17. Show measurable improvement
```

---

# WAŻNE — SCORE CHANGE

To bardzo ważne dla live demo.

Początkowo:

```text
ACTIONABILITY
78
```

Po poprawie:

```text
ACTIONABILITY
92
```

Animuj zmianę.

Jury musi zobaczyć **mierzalną transformację**, a nie tylko dashboard.

---

# UX

Każda akcja musi dawać natychmiastowy feedback.

Przykład:

```text
ANALYZING...

✓ 3 sources verified
✓ geographic consistency checked
✓ message structure checked
✓ character limit checked

ANALYSIS COMPLETE
```

---

# ERROR STATES

Dodaj również minimum trzy realistyczne błędy:

### Unverified source

```text
⚠ SOURCE NOT VERIFIED

Do not use this information as confirmed fact.
```

### Too long SMS

```text
✕ CHARACTER LIMIT EXCEEDED

173 / 160
```

### Missing action

```text
⚠ ACTION REQUIRED

Recipient may not know what to do.
```

---

# TECHNICAL REQUIREMENTS

Aplikacja musi:

* działać lokalnie;
* mieć README;
* mieć `.env.example`;
* nie wymagać sekretów do podstawowego demo;
* mieć seed data;
* mieć deterministic demo mode;
* nie wykonywać prawdziwych wysyłek;
* nie zawierać prawdziwych danych osobowych;
* mieć responsywny layout;
* działać płynnie podczas prezentacji.

---

# DEMO MODE

Dodaj specjalny przycisk:

```text
▶ START DEMO
```

Po jego kliknięciu system automatycznie przygotowuje dane, ale **nie powinien automatycznie przeskakiwać całej prezentacji**.

Każdy etap ma być kontrolowany przez prezentera.

Dodaj:

```text
RESET DEMO
```

aby można było rozpocząć ponownie.

---

# DEMO DATA

Stwórz plik:

```text
/data/demo-events.json
```

z minimum:

```text
5 events
15 source reports
5 alerts
3 geographic areas
3 after-action reports
```

Głównym wydarzeniem ma być:

```text
INTENSYWNE OPADY / PODTOPIENIA
```

---

# DESIGN SYSTEM

Kolory:

```css
--bg: #07111f;
--panel: #0d1b2a;
--panel-2: #12263a;
--text: #e8f0f7;
--muted: #8fa5b8;
--cyan: #22d3ee;
--green: #22c55e;
--amber: #f59e0b;
--red: #ef4444;
```

Nie używaj przesadnych gradientów.

Nie używaj ogromnych napisów „AI”.

Nie używaj robotów, mózgów, neonowych ikon ani typowego „AI startup design”.

---

# PRIORYTET IMPLEMENTACYJNY

Jeżeli brakuje czasu:

### MUST HAVE

1. Dashboard
2. Event intelligence
3. Map
4. Alert writer
5. Quality score
6. Human approval
7. Simulated distribution
8. After-action report
9. Demo reset

### SHOULD HAVE

10. Analytics
11. Event timeline
12. Source confidence
13. Update workflow

### NICE TO HAVE

14. Real LLM
15. Real public-data ingestion
16. Advanced GIS
17. Authentication
18. Multi-user collaboration

---

# KRYTYCZNA ZASADA

Jeśli jakaś funkcjonalność wymaga zewnętrznego API i może zepsuć demo:

**zbuduj fallback.**

Demo musi działać bez internetu i bez API key.

Architektura:

```text
REAL PROVIDER
      ↓
┌───────────────┐
│ SERVICE LAYER │
└───────────────┘
      ↓
MOCK PROVIDER
```

Dzięki temu można później podmienić mock na rzeczywiste źródło danych.

---

# FINALNY FLOW DLA JURY

Agent ma zapewnić, że można powiedzieć:

> „Mamy alert.”

↓

> „SIGNAL analizuje informacje z trzech źródeł.”

↓

> „Wykrywa, że dotyczą tego samego zdarzenia.”

↓

> „Sprawdza obszar.”

↓

> „Analizuje alert.”

↓

> „Wykrywa, że obywatel nie dostaje konkretnej instrukcji.”

↓

> „Operator poprawia komunikat.”

↓

> „Score rośnie z 78 do 92.”

↓

> „Operator zatwierdza alert.”

↓

> „Symulujemy dystrybucję.”

↓

> „Sytuacja się zmienia.”

↓

> „SIGNAL wykrywa zmianę i rekomenduje aktualizację.”

↓

> „Po zakończeniu zdarzenia system tworzy After Action Report.”

↓

> **„I właśnie w ten sposób każdy alert staje się informacją, która pomaga przygotować następny lepiej.”**

---

# OSTATECZNY TEST PRZED PREZENTACJĄ

Agent ma wykonać:

```bash
npm install
npm run build
npm run start
```

oraz sprawdzić:

* brak błędów konsoli;
* brak broken routes;
* brak pustych ekranów;
* działający reset;
* działający scenariusz end-to-end;
* działający mock mode;
* działający tryb bez API key;
* poprawne wyświetlanie mapy;
* poprawne animacje;
* poprawne wartości score;
* brak prawdziwych danych;
* brak możliwości wysłania prawdziwego alertu.

Na końcu agent ma przygotować:

```text
README.md
ARCHITECTURE.md
DEMO_SCRIPT.md
```

oraz instrukcję:

```text
1. install
2. configure
3. run
4. start demo
5. reset demo
```

---

## Najważniejsza rzecz do zrobienia teraz

Jeżeli chcecie **realnie dowieźć ten projekt na HackYeah**, nie zaczynałbym od kodowania całej powyższej wizji.

Najpierw zbudowałbym **jeden perfekcyjny vertical slice**:

**„podtopienia → 3 źródła → AI łączy zdarzenie → mapa → zły alert → analiza 78/100 → poprawa → 92/100 → human approval → symulowana dystrybucja → zmiana sytuacji → update → after-action report”.**

Jeżeli ten jeden przepływ będzie wyglądał i działał bardzo dobrze, macie już **rdzeń całego pitchu**, a kolejne funkcje można dokładać bez zmiany koncepcji.
