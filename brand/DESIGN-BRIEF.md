# e-Formularze – design brief v2

Wersja: 21.11.2026, wieczór. Zastępuje kierunek z canvasu „e-Formularze – Brand canvas” (runda 1).
Podstawa: audyt „AI slop” z 21.11 (48 uwag) oraz dokument COI „HackNation. Standardy i dobre praktyki projektowania formularzy” z paczki zadania.

Oznaczenia w tekście:
- **[decyzja]** – wynika z regulaminu, materiałów COI albo audytu; nie zmieniamy bez powodu.
- **[propozycja]** – do akceptacji zespołu.
- **[otwarte]** – brak decyzji, opisane w sekcji 11.

---

## 1. Dla kogo projektujemy i jaka ma być reakcja

| Odbiorca | Co ogląda | Po czym poznamy, że zadziałało |
|---|---|---|
| Jury COI (5 kryteriów: kompletność 30%, intuicyjność 20%, jakość kodu 20%, wdrożenie i koszt 20%, oryginalność 10%) | film do 3 min, slajdy (do 10), landing, działające demo | po 10 sekundach wie, że wynik to JSON w formacie COI i że każde pole ma sprawdzone źródło |
| Urzędnik | Panel Lintera, edytor, Audit Trail | rozumie flagę bez szkolenia i wie, co kliknąć |
| Obywatel | formularz krok po kroku | wypełnia formularz bez pytania, po co są dane |

Strona ma wyglądać jak narzędzie zrobione dla polskiego urzędu, a nie jak startup AI. **[decyzja]**

## 2. Kierunek: „druk urzędowy i narzędzie pracy” [propozycja]

Łączymy dwa kierunki z audytu:

- Na stronach marketingowych (landing, slajdy, film) język wizualny dobrze złożonego dokumentu: biel, czarny i granatowy tekst, siatka jak w formularzu, cytaty prawne złożone jak w Dzienniku Ustaw.
- W miejscu ilustracji pokazujemy prawdziwy produkt w skali 1:1: Panel Lintera z flagami na prawdziwym formularzu z paczki COI.

Test kierunku: zasłoń logo. Jeśli z ekranu nie wynika, że chodzi o polski urząd i polskie prawo, ekran trzeba poprawić.

Odrzucamy: ciemne hero z gradientem, unoszące się okna aplikacji, schematy „AI pipeline”, ikony w kafelkach.

## 3. Materiały, z których budujemy [decyzja]

Nic nie rysujemy „na wzór”. Każdy obraz na stronie pochodzi z tej listy.

| Materiał | Skąd | Gdzie użyć |
|---|---|---|
| Skany 9 formularzy (PDF, JPG, PNG) | `data-pdf/*.zip` – od „Wniosek o ustalenie numeru porządkowego” do „Wniosek o przyznanie stypendium…” | hero, sekcja „Materiał COI”, slajdy |
| Wniosek o zwrot opłaty skarbowej | `data-pdf/2. …zip` | formularz przewodni w całym demo, filmie i na landingu |
| Referencyjne pliki JSON COI | `data-pdf/1. …zip` i `5. …zip` (`konfiguracja_form_…json`) | prawdziwe fragmenty JSON na stronie i w slajdach |
| Wizualizacje formularzy po cyfryzacji | dwa pliki `… wizualizacja formularza …docx` z `Materiały do zadania` | wzór układu formularza obywatela |
| Dosłowny tekst ustawy o opłacie skarbowej | ISAP, pobrany wcześniej i trzymany w repozytorium (bez API na żywo) | cytaty przy polach, sekcja cytowania |
| Zrzuty prawdziwego frontendu | `frontend/` (Next.js), uruchomiony na danych demo | Panel Lintera, edytor, formularz obywatela |
| JSON z naszego backendu | odpowiedź `POST /drafts` dla formularza przewodniego | jedyne źródło liczb (pola, strony, flagi) |

Zdjęcia: tylko własne z hackathonu (zespół przy pracy, ekran z demo). Bez zdjęć stockowych urzędów i ludzi. **[decyzja]**
Dopóki backend nie zwróci prawdziwego wyniku, używamy jednego zestawu danych demo (sekcja 9).

## 4. Zasady wizualne

Każdą zasadę da się sprawdzić na gotowym ekranie.

### 4.1 Siatka i kompozycja
- 12 kolumn, treść do 1200 px, wyrównanie do lewej. Bez wyśrodkowanych bloków tekstu. **[propozycja]**
- Na każdym ekranie jest jeden dominujący element, który zajmuje co najmniej połowę wysokości: skan, zrzut panelu albo tabela.
- Sąsiednie sekcje mają różną formę (tabela, zrzut, lista, oś czasu). Układ „nagłówek + lead + siatka kart” najwyżej raz na stronę.
- Formularz obywatela ma jedną kolumnę – tak wymaga standard COI (rozdz. 2, „Ogólne zasady”, pkt 2).

### 4.2 Kolor: każdy kolor ma jedną rolę [propozycja]

| Rola | Kolor | Gdzie wolno |
|---|---|---|
| Tekst i nagłówki | `#03254C` (nagłówki), `#393939` (tekst) | wszędzie |
| Papier | `#FFFFFF` | tło stron marketingowych i dokumentów |
| Tło robocze | `#F0F6FB` | tylko w interfejsie aplikacji (panel, formularz obywatela) |
| Akcja | `#0353A8` | przyciski główne, linki, obrys fokusu. Nic więcej. |
| Flaga krytyczna | `#B42318` na `#FDECEA` | flagi, błędy pól, blokada publikacji |
| Ostrzeżenie | `#4F3406` na `#FEF0D3` | flagi ostrzegawcze |
| Sprawdzone | `#0B7A66` (tekst), `#14A38B` (znak) | wyłącznie stan „cytat znaleziony / flaga obsłużona / opublikowano” |

- Gradient: zero na stronach, w interfejsie i na slajdach. Zostaje tylko w sygnecie, jeśli wybrany znak go ma. **[decyzja z audytu]**
- Granat `#2251A2` jako tło: najwyżej jedna sekcja na stronę (stopka albo kontakt).

### 4.3 Typografia [propozycja]
- Dwa kroje zamiast czterech:
  - **Public Sans** (400, 600, 700) na interfejs i nagłówki, z literacją 0, bez ściskania.
  - **Source Serif 4** na cytaty z przepisów i tytuły dokumentów (np. „Wniosek o zwrot opłaty skarbowej” nad skanem).
- **IBM Plex Mono** zostaje tylko w kodzie i identyfikatorach `techName`. Nie stosujemy go jako ozdobnej etykiety.
- Plus Jakarta Sans wypada, bo wygląda jak domyślny szablon SaaS (uwaga 27 z audytu).
- Skala: 44 / 30 / 22 / 17 / 15 / 13 px. Nagłówek strony najwyżej 44 px, bez haseł w rozmiarze plakatu.
- Polski skład **[decyzja]**:
  - twarda spacja po jednoliterowych wyrazach (w, i, a, z, o, u) i między liczbą a jednostką;
  - cudzysłów „…”, półpauza w zakresach (s. 1–3), bez myślników jako wtrąceń.
- Cytat prawny zawsze w tej postaci: tekst dosłowny kursywą serifową, pod nim źródło w formacie „art. 9 ust. 1 pkt 1 ustawy z dnia 16 listopada 2006 r. o opłacie skarbowej”. Numer artykułu i tytuł ustawy sprawdzają myśliciele w ISAP. Bez weryfikacji źródła nie publikujemy.

### 4.4 Kształt i głębia [propozycja]
- Promienie: 4 px (pola, przyciski), 8 px (okna, panele). Pigułka tylko dla plakietki statusu.
- Elementy oddzielamy ramką 1 px `#C9D3DF` albo tłem. Bez cieni, poza menu rozwijanym i modalem.
- Plakietki tylko dla statusu flagi i statusu formularza: na ekranie marketingowym najwyżej 2, w panelu bez limitu.
- Ikony liniowe 24 px, kreska 2 px, zawsze obok etykiety. Bez obudowy w kwadracie lub kółku.

### 4.5 Obrazy
- Skan pokazujemy jak skan: lekko szare tło papieru, prawdziwe krawędzie, bez retuszu i bez rysowania formularza w HTML.
- Zrzut interfejsu w skali 1:1 albo przycięty krawędzią sekcji. Okno nie unosi się nad tłem.
- JSON i kod tylko prawdziwe, skopiowane z wyniku. Bez trzykropków w miejscu treści.
- Bez ilustracji, terminali „dla klimatu” i schematów z biegnącymi kropkami.

### 4.6 Ruch [propozycja]
- Jedna animacja na stronę marketingową: w hero pole na skanie podświetla się, a obok pojawia się jego cytat i status „znaleziono w tekście ustawy”. Gra raz, 1,2 s.
- W aplikacji jedna animacja potwierdzenia „Zweryfikowano” po obsłużeniu ostatniej flagi krytycznej (400 ms).
- Reakcja na najechanie tylko na linkach i przyciskach: zmiana koloru, podkreślenie. Karty się nie unoszą.
- Bez wejść „fade-up”, bez pętli. Przy `prefers-reduced-motion` stan końcowy od razu.

## 5. Tekst

Stosujemy rozdział 1 dokumentu COI „Standardy i dobre praktyki”: tekst uniwersalny, zrozumiały, rzetelny, bez treści marketingowych i bez metafor. **[decyzja]**

### 5.1 Zasady
- Nagłówek mówi, co jest w sekcji: „Panel Lintera”, „Wdrożenie na serwerze urzędu”, „Pytania urzędów”.
- Jedno zdanie, jedna myśl. Strona czynna, forma osobowa, bez „dokonać”, „posiadać”, imiesłowów na -ąc i bez określania płci.
- Przyciski: czasownik i rzecz („Umów pokaz”, „Pobierz JSON”, „Zobacz Panel Lintera”).
- Każdy fakt pada raz, w sekcji, która go „posiada” (tabela 5.3).
- Liczby tylko z wyniku backendu albo z regulaminu. Bez liczb wymyślonych dla wiarygodności.

### 5.2 Przed i po (z audytu)

| Było | Ma być |
|---|---|
| „AI napisało. My to sprawdziliśmy.” | Usunąć. Fakt pokazuje Panel Lintera. |
| „Stary formularz. Nowa e-usługa. Zero zgadywania.” | „Wniosek o zwrot opłaty skarbowej: 3 strony, 18 pól, 18 cytatów.” (po sprawdzeniu w wyniku) |
| „Formularz, któremu można zaufać.” | „Cyfryzacja formularzy dla urzędów z cytatem przy każdym polu” (h1, opis zamiast hasła) |
| „Jeden formularz, dwie strony okienka” | „Panel urzędnika i formularz obywatela” |
| „Urzędnik zaczyna od gotowego szkicu, a nie od pustego edytora.” | „Urzędnik dostaje szkic z cytatem przy każdym polu.” |
| „Działa w serwerowni urzędu, bez opłat za zewnętrzne API” | „Wdrożenie na serwerze urzędu” |
| „Pokaż nam swój formularz, a zbudujemy z niego e-usługę przy Tobie” | „Umów pokaz. Przetworzymy formularz wskazany przez urząd.” |

### 5.3 Mapa faktów: który fakt mieszka w której sekcji

| Fakt | Sekcja | Gdzie poza nią najwyżej raz |
|---|---|---|
| Formaty wejściowe (PDF, DOC, DOCX, ODS, XLSX, JPG, PNG), wynik JSON COI | Hero | Pytania |
| Flaga krytyczna blokuje publikację | Panel Lintera | – |
| Pięć linterów i co sprawdzają | Lintery | – |
| Model lokalny, brak zewnętrznych API, plik tylko w pamięci | Wdrożenie | Pytania |
| Audit Trail | Panel urzędnika | – |
| Prefill i rejestry jako makieta | Formularz obywatela | stopka |

## 6. Landing page: jedna wersja zamiast A i B [propozycja]

| # | Sekcja | Forma i dominujący element | Tekst (najwyżej) |
|---|---|---|---|
| 1 | Hero | Skan wniosku o zwrot opłaty skarbowej na 7 kolumnach. Na polu „Numer rachunku” nakładka edytora z cytatem i statusem. Tytuł i przycisk na 5 kolumnach. | h1, 1 zdanie, linia formatów, 2 przyciski |
| 2 | Panel Lintera | Zrzut 1:1 na całą szerokość, przycięty dolną krawędzią sekcji | h2 + 1 zdanie |
| 3 | Jak powstaje e-usługa | Pionowa oś na przykładzie jednego formularza: skan → pola z cytatami → opublikowana wersja. Przy każdym etapie fragment prawdziwego wyniku, bez kart. | 3 zdania |
| 4 | Lintery | Tabela 5 wierszy: nazwa, co sprawdza, kod czy model, przykład flagi z demo | h2 + tabela |
| 5 | Formularz obywatela | Telefon z prawdziwym ekranem formularza obok tabeli Audit Trail | 2 zdania |
| 6 | Materiał COI | Miniatury 9 formularzy z paczki. Pod każdą tylko fakty: „przetworzony, 3 strony, JSON” albo „w kolejce”. Tylko to, co naprawdę przeszło przez backend. | h2 + 1 zdanie |
| 7 | Wdrożenie | Tabela faktów (gdzie działa, dane, dostęp, licencje) i jedna linia `docker compose up` | h2 + tabela |
| 8 | Pytania urzędów | Rozwijane pytania | 5 pytań |
| 9 | Kontakt i stopka | Granatowe tło, przycisk „Umów pokaz”, uwaga o makiecie integracji | 1 zdanie |

Strona ma najwyżej 700 słów, nie licząc zrzutów i tabel.

## 7. Co zmienić w brand kicie (artboardy Kit-*)

| Artboard | Zmiana |
|---|---|
| Kit-Kolory | Tabela ról z punktu 4.2 zamiast palety „4 duże próbki + gradient”. Usunąć „Proporcje na ekranie”. |
| Kit-Typografia | Dwa kroje, nowa skala, przykład cytatu prawnego z prawdziwym tekstem z ISAP, przykłady polskiego składu. |
| Kit-Ikony | Bez kwadratowych obudów. Nazwy typów pól zgodne ze standardem COI (rozdz. 2, „Ogólne zasady”, pkt 4: krótkie pole tekstowe, długie pole opisowe, pole numeryczne…). |
| Kit-Komponenty | Promienie 4/8, plakietki tylko dla statusów, karta flagi bez cienia, zgody jako „sekcja zgód” (nie checkbox – standard COI, „Ogólne zasady”, pkt 4i). |
| Kit-Zastosowania | Slajdy i plansze na bieli ze skanem. Bez haseł. Post i story pokazują prawdziwy formularz i jego e-usługę. |
| Kit-Tokeny | Zaktualizować zmienne CSS pod punkty 4.2–4.4. Usunąć `--ef-gradient`. |

## 8. Animacje logo

Z 7 wariantów zostają 2: plansza otwierająca film (sygnet + nazwa, 1,5 s, bez przesunięć) i potwierdzenie „Zweryfikowano” w aplikacji. Wersje „przed/po” w socialach zastępuje statyczna grafika ze skanem. **[propozycja]**

## 9. Jeden zestaw danych demo [decyzja do czasu prawdziwego wyniku]

Wniosek o zwrot opłaty skarbowej: 3 strony, 18 pól, 18 cytatów. Flagi: 2 krytyczne (`numer_dowodu` – RODO, `numer_rachunku` – cytat nie występuje w ustawie), 1 ostrzeżenie (`adres_email` – brak podstawy prawnej), 1 poprawiona (`kwota_oplaty`). Publikacja: wersja 1.0.
Te same liczby na landingu, w slajdach, w filmie i w mockach frontendu (`frontend/src/mocks`). Gdy backend zwróci wynik, podmieniamy wszystko naraz.

## 10. Zakazy z limitami: lista odbiorcza

Każdy ekran przed oddaniem sprawdzamy na tej liście. Jedno „nie” cofa ekran do poprawki.

| Element | Limit |
|---|---|
| Gradient poza sygnetem | 0 |
| Ikona w kwadracie lub kółku nad nagłówkiem | 0 |
| Siatka 3 jednakowych kart | 0 |
| Plakietki na ekranie marketingowym | do 2 |
| Cień na karcie lub oknie | 0 |
| Karta lub blok, który unosi się po najechaniu, a nie jest linkiem | 0 |
| Animacja w pętli na stronie | 0 |
| Hasło w rytmie „X. Y. Z.” lub nagłówek z parą liczb | 0 |
| Rama „nie X, tylko Y / zamiast / bez” w nagłówku | 0 |
| „każdy / każde” | do 2 na stronę |
| Liczba bez źródła w wyniku backendu lub regulaminie | 0 |
| Etykieta nad nagłówkiem (eyebrow), numeracja sekcji 01/02/03 | 0 |
| Podpis pod obrazem, który go opisuje | 0 |
| Sierotka (jednoliterowy wyraz na końcu wiersza) | 0 |
| Kolor morski w roli innej niż „sprawdzone” | 0 |

Kryteria odbioru całości:
1. Test zasłoniętego logo z sekcji 2.
2. Każdy obraz da się wskazać w tabeli materiałów (sekcja 3).
3. Każda liczba zgadza się z sekcją 9 albo z wynikiem backendu.
4. Kontrast tekstu co najmniej 4,5:1, obrys pól co najmniej 3:1, cele dotyku od 44 px (WCAG 2.1 AA – standard COI, „Ogólne zasady”, pkt 1).
5. Strona czytana na głos brzmi jak informacja urzędu, nie jak reklama.

## 11. Otwarte decyzje

| Decyzja | Kto | Termin |
|---|---|---|
| Wybór znaku (runda 1 lub 2). Kryterium: działa bez gradientu, w 16 px i na skanie formularza. Haczyk jako jedyny pomysł jest zbyt częsty, więc lepiej, gdy znak mówi o formularzu albo przepisie. | cały zespół | przed przebudową brand kitu |
| Akceptacja kierunku z sekcji 2 | cały zespół | przed pracą nad landingiem |
| Dosłowne cytaty z ustawy o opłacie skarbowej dla pól formularza przewodniego | myśliciele | przed nagraniem filmu |
| Zdjęcia z hackathonu (czy robimy) | pitch | sobota wieczór |
| Nazwa „e-Formularze” jako ostateczna | cały zespół | przed slajdami |
