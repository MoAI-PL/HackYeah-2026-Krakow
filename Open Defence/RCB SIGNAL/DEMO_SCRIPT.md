# RCB SIGNAL — scenariusz prezentacji (3–5 min)

**Przed prezentacją:** `python3 server.py`, otwórz http://localhost:8080 w trybie pełnoekranowym (F11) i kliknij **RESET DEMO**. Pasek prezentera na dole zawsze pokazuje następny krok, a przycisk **Przejdź →** otwiera właściwy ekran.

---

### 0. Otwarcie (15 s) — ekran 01 Przegląd

> „Nie potrzebujemy kolejnego alertu. Potrzebujemy alertu, który ma sens. RCB SIGNAL nie jest aplikacją dla obywatela. To warstwa wspomagania decyzji dla dyżurnego RCB, zbudowana nad istniejącym systemem.”

Pokaż żółty pasek u góry: środowisko demonstracyjne, dane syntetyczne.

### 1. Mamy zagrożenie (20 s)

Kliknij **▶ START DEMO**.

> „W ciągu 11 minut przychodzą trzy meldunki: IMGW, PSP i WCZK. SIGNAL wykrywa, że dotyczą tego samego zdarzenia.”

Wskaż kartę **INTENSYWNE OPADY / PODTOPIENIA** i liczniki (12 aktywnych, 4 do weryfikacji).

### 2. Jeden obraz sytuacji (30 s) — kliknij kartę zdarzenia

- oś czasu 17:42 → 17:56, **status ZWERYFIKOWANE: 3 niezależne źródła uprawnione**;
- panel **Analiza SIGNAL** (✓ wiele źródeł, ✓ korelacja czasowa, ✓ pokrycie geograficzne, ⚠ intensywność rośnie);
- przewiń do źródła **MEDIA — „zerwany most w Lipnicy”**:

> „Informacja niezweryfikowana nie staje się faktem. SIGNAL ją oznacza i wyłącza z oceny.”

### 3. Sprawdzamy obszar (20 s) — 03 Mapa

Czerwony obszar to strefa zagrożenia, niebieskie punkty to zgłoszenia. Kliknij m. Nadrzecze, żeby pokazać ryzyko, zgłoszenia i populację.

> „Najmniejszą jednostką dystrybucji jest powiat, więc porównujemy obszar zagrożenia z obszarem, który faktycznie dostanie alert.”

### 4. Analizujemy alert (40 s) — wróć do zdarzenia → **Przygotuj projekt alertu**

Projekt brzmi: *„…Mozliwe lokalne podtopienia. Zachowaj ostroznosc.”*

Kliknij **ANALIZUJ** (sekwencja sprawdzeń) → **78/100**.

> „Komunikat mówi, co się dzieje i gdzie, ale nie mówi, do kiedy, a instrukcja »zachowaj ostrożność« jest za ogólna. Obywatel nie wie, co zrobić.”

Opcjonalnie pokaż menu **Wariant testowy → przekroczony limit znaków** (173/160, blokada), a potem **Przywróć projekt wyjściowy** i ponownie ANALIZUJ.

### 5. Operator poprawia komunikat (20 s)

W panelu **Rekomendacja SIGNAL** widać zmiany. Kliknij **Zastosuj rekomendację**.

> „Score rośnie z 78 do 92. To mierzalna zmiana, nie ozdobnik.”

### 6. Człowiek decyduje (25 s)

**Przekaż do zatwierdzenia** → panel zatwierdzenia: Actionability 92, 3 źródła, GEO OK 96%, 154/160 znaków.

> „AI rekomenduje, człowiek decyduje. Operator potwierdza i podaje uzasadnienie, a wszystko trafia do dziennika audytu.”

Zaznacz potwierdzenie → **Zatwierdź i symuluj wysyłkę** → zasięg 92% (operatorzy A/B/C).

### 7. Sytuacja się zmienia (30 s)

Na pasku prezentera kliknij **Następny etap scenariusza ⏭** (18:30).

> „PSP: +8 interwencji, w tym w powiecie lipnickim. IMGW wydłuża ostrzeżenie do 23:00. SIGNAL wykrywa, że wysłany alert nie opisuje już sytuacji: pokrycie spadło do 83%, a godzina jest nieaktualna.”

Opcjonalnie pokaż na mapie rozszerzoną strefę.

### 8. Aktualizacja (25 s)

**Otwórz proces aktualizacji**: diff względem wysłanej wersji, dodany pow. lipnicki, „Do 23:00”. **ANALIZUJ** (92) → **Przekaż do zatwierdzenia** → potwierdzenie → **Zatwierdź**.

### 9. Pętla się zamyka (30 s)

Na zdarzeniu kliknij **Zamknij zdarzenie**, potem **Raport po zdarzeniu (AAR)**.

> „Czas do decyzji 13 minut, jakość 78 → 92, jedna aktualizacja, cztery wykryte problemy i rekomendacje na przyszłość.”

Na koniec **05 Analityka** (baseline vs SIGNAL, oznaczone jako demo benchmark) i **07 Dziennik audytu**.

> **„I właśnie w ten sposób każdy alert staje się informacją, która pomaga przygotować następny lepiej.”**

---

## Pytania jury — krótkie odpowiedzi

- **Skąd 78 i 92?** Z deterministycznego silnika regułowego (wagi w ARCHITECTURE.md). Ten sam tekst zawsze daje ten sam wynik, więc ocenę można audytować.
- **Gdzie jest AI?** Korelacja zdarzeń i rekomendacje; opcjonalnie LLM (Claude) jako opinia doradcza ze structured output. LLM nigdy nie decyduje o wyniku ani o wysyłce.
- **Czy wyniki są prawdziwe?** Nie. To demo benchmark na danych syntetycznych. Pokazujemy, *jak* mierzyć: test historyczny, test zrozumiałości, symulacja operatora i raport AAR.
- **Jak oceniana jest wiarygodność?** Nie podajemy procentów, bo nie mamy danych, które by je uzasadniały. Źródło jest *zweryfikowane*, gdy pochodzi od służby uprawnionej (IMGW, PSP, WCZK itd.), a *niezweryfikowane*, gdy pochodzi z mediów, formularzy lub nie ma potwierdzenia. Zdarzenie jest *zweryfikowane*, gdy potwierdzają je co najmniej 2 niezależne źródła uprawnione.
- **Dane osobowe?** Brak. Wyłącznie dane zagregowane, bez śledzenia jednostek.
- **Prompt injection?** Zgłoszenie z formularza w EVT-2026-1044 trafia do kwarantanny; treść źródeł jest zawsze traktowana jako dane.

## Awaryjnie

- Odświeżenie strony nie traci stanu (zapis w przeglądarce).
- Zagubiony krok: przycisk **Przejdź →** na pasku prezentera.
- Pełny restart: **RESET DEMO**.
