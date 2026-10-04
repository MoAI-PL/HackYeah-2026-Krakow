# RCB SIGNAL — materiały do zgłoszenia (HackYeah 2026, Defence)

Pola wymagane przez organizatora: tytuł, nazwa zespołu, członkowie, opis projektu, PDF do 10 slajdów.
Poniżej gotowe teksty do wklejenia. Fragmenty w [nawiasach] uzupełnia zespół.

## Tytuł projektu
RCB SIGNAL — od alertu do działania

## Nazwa zespołu
MoAI

## Członkowie zespołu
Jan Domański, Jakub Goleman, Krystian Góźdź, Maks Kozieł, Piotr Niemiec

## Opis projektu (PL)

Alerty RCB tracą sens w oczach odbiorców: bywają nieprecyzyjne, nie mówią, co zrobić, przychodzą za często, a osoby w tym samym miejscu dostają je w różnym czasie. Ludzie przestają traktować ostrzeżenia poważnie — także te, które ratują życie.

RCB SIGNAL nie jest kolejną aplikacją dla obywatela. To system wspomagania decyzji dla dyżurnego RCB, który lepiej wykorzystuje istniejący Alert RCB. Zasada: AI rekomenduje, człowiek decyduje — system nie wysyła, nie odwołuje i nie zmienia obszaru alertu.

Co robi:
- łączy meldunki IMGW, PSP i WCZK w jedno zdarzenie; zdarzenie jest zweryfikowane, gdy potwierdzają je co najmniej 2 niezależne służby, a sygnały z mediów i treści z próbą prompt injection są oznaczane i izolowane;
- sprawdza projekt alertu przed wysyłką (co, gdzie, do kiedy, co zrobić, 160 znaków GSM-7, zgodność ze źródłami) i proponuje poprawioną wersję — w scenariuszu wynik rośnie z 78 do 92/100;
- na mapie prawdziwych powiatów porównuje strefę zagrożenia z obszarem alertu i wskazuje pominięte powiaty;
- ogranicza zmęczenie alertami: pokazuje inne alerty w tych samych powiatach i pozwala zaplanować odwołanie nieaktualnego; możliwy duplikat zdarzenia rozstrzyga człowiek;
- raportuje dystrybucję: czas dostarczenia u operatorów i ostrzeżenie, gdy ludzie w tym samym powiecie dostają alert w różnym czasie;
- wykrywa, że wysłany alert się zdezaktualizował (zasięg 96% → 83%) i prowadzi aktualizację (97%);
- działa przy niepełnych danych: gdy źródło przestaje odpowiadać, ocena jest oznaczana jako niepełna, system podaje procedurę zastępczą i pracuje dalej lokalnie;
- po zdarzeniu tworzy raport z dziennika decyzji oraz podsumowanie dla mieszkańców — co się stało i dlaczego wysłano alert — które buduje zaufanie do kolejnych ostrzeżeń.

Pierwszy realny pomiar: przepuściliśmy przez walidator 9 prawdziwych Alertów RCB z lat 2020–2026 (treści za hasłem „Alert RCB” w Wikipedii) — 8 z 9 nie mówi, do kiedy obowiązuje zagrożenie.

Mierzalność: proponujemy cele pilotażu (np. ≥95% komunikatów spełnia kryteria, +20 p.p. zrozumienia instrukcji, −30% czasu przygotowania) i 4 etapy walidacji: test historyczny, eksperyment z odbiorcami, symulacja dyżuru, pilotaż obserwacyjny. Liczby w demo pochodzą ze scenariusza demonstracyjnego, nie z wdrożenia.

Technologia: Python (biblioteka standardowa) + JavaScript bez frameworków, działa offline; wersja statyczna działa w samej przeglądarce. Deterministyczny silnik reguł (ten sam tekst = ten sam wynik), opcjonalny LLM wyłącznie jako opinia doradcza.

## Project description (EN, short)

RCB SIGNAL is a decision-support system for the duty officer of Poland's Government Centre for Security (RCB), not another citizen app. It merges reports from official services into one verified event (≥2 independent sources; rumours and prompt-injection content are isolated), checks a draft Alert RCB before sending (what, where, until when, what to do, 160-char GSM-7, consistency with sources) and suggests a better version, compares the hazard zone with the alert area on real county borders, reduces alert fatigue (parallel alerts, duplicates decided by a human), reports uneven delivery times across operators, detects outdated alerts, keeps working when a data source fails, and produces an after-action report plus a plain-language summary for residents. AI recommends, a human decides.

## Linki
- Demo online: [link po publikacji folderu dist/ — patrz README, sekcja „Wersja statyczna”]
- Film z przebiegu demo (4:10, z lektorem): `presentation/rcb_signal_demo.mp4` [lub link po wgraniu]
- Repozytorium: https://github.com/MoAI-PL/HackYeah-2026-Krakow (folder `Open Defence/RCB SIGNAL`) [podać tylko, jeśli repo jest publiczne]
- Prezentacja: `presentation/RCB_SIGNAL_MoAI.pdf` (10 slajdów)

## Ujawnienie użycia AI i zasobów zewnętrznych

- **Claude (Anthropic)** — asystent przy tworzeniu kodu, danych scenariusza, dokumentacji, prezentacji, scenariusza i tekstu lektora filmu. Zespół przegląda kod i odpowiada za całość rozwiązania.
- **Anthropic API (opcjonalnie)** — moduł doradczego LLM w `server.py`; w demo wyłączony i nieużywany (brak klucza). Wynik oceny zawsze liczy silnik regułowy.
- **Dane: granice powiatów** — Państwowy Rejestr Granic (PRG), GUGiK, dane udostępniane bez opłat; uproszczona wersja z repozytorium ppatrzyk/polska-geojson (licencja MIT). Przebieg Dunajca przybliżony ręcznie.
- **Test historyczny** — treści 9 Alertów RCB przytoczone w haśle „Alert RCB” w polskiej Wikipedii (z przypisami do mediów i RCB).
- **Dane scenariusza** — zdarzenia, meldunki, populacja, czasy dostarczenia i komunikaty są fikcyjne (syntetyczne).
- **Głos lektora w filmie** — syntezator mowy Microsoft Paulina (Windows).
- **Fonty prezentacji** — Roboto Mono i Hind (Google Fonts, licencja OFL).
- **Biblioteki** — brak zewnętrznych bibliotek w aplikacji (Python: biblioteka standardowa; JS: bez zależności).

## Praca wykonana podczas HackYeah
Kod, dane scenariusza, prezentacja i film powstały w trakcie hackathonu (pierwszy commit w repozytorium: 3.10.2026, 23:39). [Zespół: potwierdźcie, czy koncepcja w `RCB_SIGNAL.md` lub inne materiały powstały przed startem — jeśli tak, trzeba to tu wpisać.]
